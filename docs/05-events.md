# 事件与设备离线消息

MeshCentral 控制通道既能请求数据，也会推送实时事件。接收设备在线、离线、变更消息，核心是保持 `control.ashx` WebSocket 长连接，并监听所有无 `responseid` 或 `action=event` 类消息。

## 实时事件流

`meshctrl ShowEvents` 的实现是连接控制通道后不发送业务请求，直接打印服务端推送事件。

连接成功后保持 WebSocket 打开即可接收事件。

事件示例：

```json
{
  "action": "event",
  "event": {
    "etype": "node",
    "action": "nodeconnect",
    "nodeid": "node//yyyyyyyy",
    "meshid": "mesh//xxxxxxxx",
    "domain": "",
    "msg": "Agent connected"
  }
}
```

离线事件可能类似：

```json
{
  "action": "event",
  "event": {
    "etype": "node",
    "action": "nodedisconnect",
    "nodeid": "node//yyyyyyyy",
    "meshid": "mesh//xxxxxxxx",
    "domain": "",
    "msg": "Agent disconnected"
  }
}
```

设备变更事件：

```json
{
  "action": "event",
  "event": {
    "etype": "node",
    "action": "changenode",
    "nodeid": "node//yyyyyyyy",
    "node": {}
  }
}
```

## 过滤事件

MeshCtrl 的 `ShowEvents --filter` 是客户端过滤：收到事件后按 `event.action` 或顶层 `action` 判断。

示例过滤逻辑：

```js
const filters = new Set(['nodeconnect', 'nodedisconnect', 'changenode']);

client.on('message', (data) => {
  const action = data.event?.action ?? data.action;
  if (filters.has(action)) {
    handleEvent(data.event ?? data);
  }
});
```

## 获取历史事件

请求最近事件：

```json
{
  "action": "events",
  "limit": 100,
  "responseid": "req-events"
}
```

按用户过滤：

```json
{
  "action": "events",
  "user": "user//admin",
  "limit": 100,
  "responseid": "req-user-events"
}
```

按设备过滤：

```json
{
  "action": "events",
  "nodeid": "node//yyyyyyyy",
  "limit": 100,
  "responseid": "req-node-events"
}
```

响应：

```json
{
  "action": "events",
  "responseid": "req-events",
  "events": []
}
```

## 接收设备离线消息

推荐封装：

```js
client.events.on('deviceOffline', (event) => {
  console.log('offline:', event.nodeid);
});
```

内部映射：

```js
function normalizeEvent(data) {
  const event = data.event ?? data;
  if (event.etype === 'node' && event.action === 'nodeconnect') {
    return { type: 'deviceOnline', nodeid: event.nodeid, raw: event };
  }
  if (event.etype === 'node' && event.action === 'nodedisconnect') {
    return { type: 'deviceOffline', nodeid: event.nodeid, raw: event };
  }
  if (event.etype === 'node' && event.action === 'changenode') {
    return { type: 'deviceChanged', nodeid: event.nodeid, raw: event };
  }
  return { type: event.action, raw: event };
}
```

## 断线重连

控制通道断开时应自动重连：

- `close`：清理 pending 请求，标记为 `ConnectionClosedError` 或等待重试。
- `error`：记录错误并进入退避重连。
- 重连成功后重新拉取 `meshes` 和 `nodes`，修正本地状态。
- 重新订阅事件不需要额外请求，只要连接恢复即可继续接收推送。

推荐退避策略：

```text
1s, 2s, 5s, 10s, 30s, 60s
```

## 心跳

浏览器端控制脚本会定期发送：

```json
{
  "action": "ping"
}
```

建议 SDK 每 25 到 30 秒发送一次 ping，避免代理或负载均衡关闭空闲连接。

## 本地设备状态缓存

为了可靠识别离线消息，建议维护本地缓存：

```js
const devices = new Map();

client.events.on('deviceOnline', ({ nodeid }) => {
  devices.set(nodeid, { ...devices.get(nodeid), online: true });
});

client.events.on('deviceOffline', ({ nodeid }) => {
  devices.set(nodeid, { ...devices.get(nodeid), online: false });
});
```

启动时先调用 `nodes` 建立初始状态，再用实时事件增量更新。
