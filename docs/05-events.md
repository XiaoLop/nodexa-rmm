# 事件与设备离线消息

MeshCentral 控制通道既能请求数据，也会推送实时事件。接收设备在线、离线、变更消息，核心是保持 `control.ashx` WebSocket 长连接，并监听所有无 `responseid` 或 `action=event` 类消息。

## 实时事件流

`meshctrl ShowEvents` 的实现是连接控制通道后不发送业务请求，直接打印服务端推送事件。

连接成功后保持 WebSocket 打开即可接收事件。

### 常见事件结构

推送事件通常包含顶层 `"action": "event"`，内部 `"event"` 对象中按类别（`etype`）和具体操作（`action`）进行划分。

## 常见实时事件类型

根据实际服务端采集的事件推送，主要包含以下几大类事件：

### 1. 设备与节点事件 (`etype: "node"`)

- **`nodeconnect`（设备上线）**：设备 Agent 与服务端成功建立连接。

  ```json
  {
    "action": "event",
    "event": {
      "action": "nodeconnect",
      "meshid": "mesh//xxxx",
      "nodeid": "node//yyyy",
      "conn": 1,
      "pwr": 1,
      "ct": 1787033321015,
      "nolog": 1
    }
  }
  ```

- **`changenode`（设备属性变更）**：设备的名称、操作系统、IP 地址、登录用户或配置发生了更新，事件附带最新的 `node` 详细对象（注：用于同步更新本地设备属性，不单独存储至 `events` 列表）。

  ```json
  {
    "action": "event",
    "event": {
      "etype": "node",
      "action": "changenode",
      "nodeid": "node//yyyy",
      "node": {
        "_id": "node//yyyy",
        "name": "机房53号",
        "rname": "机房53号",
        "meshid": "mesh//xxxx",
        "osdesc": "Microsoft Windows 10 专业版 - 22H2/19045",
        "host": "172.18.0.1",
        "ip": "172.18.0.1",
        "users": ["机房53号\\Administrator"],
        "agent": { "id": 4, "ver": 0, "caps": 31, "root": true },
        "lastbootuptime": 1786261684000
      }
    }
  }
  ```

- **`devicesessions`（设备会话状态变更）**：该设备的远程会话状态（如桌面、文件、命令行会话）发生变化。
- **`sysinfohash`（系统信息 Hash 更新）**：设备系统硬件与软件配置 Hash 更新，用于客户端判断是否需要重新拉取详细设备信息。
- **`ifchange`（网络接口变更）**：设备的网卡、IP 地址或网络连接发生改变（注：此事件被忽略，不存入应用状态）。
- **`agentlog`（Agent 操作日志与行为审计）**：记录设备 Agent 执行的具体操作（如文件上传/下载、命令执行等）。

  ```json
  {
    "action": "event",
    "event": {
      "etype": "node",
      "action": "agentlog",
      "nodeid": "node//yyyy",
      "domain": "",
      "msg": "Upload: \"C:/autostart/AutoStartMonitor.exe\", Size: 11706388",
      "msgid": 105,
      "msgArgs": [
        "C:/autostart/AutoStartMonitor.exe",
        11706388
      ],
      "remoteaddr": "172.18.0.1",
      "userid": "user//admin",
      "username": "admin",
      "sessionid": "user//admin/ea6067960206dde59c2224b8b3306a2fd9a45668",
      "time": "2026-08-18T07:04:33.687Z"
    }
  }
  ```

### 2. 用户与 WebSocket 会话事件

- **`wssessioncount`（WebSocket 会话数变更）**：通知当前登录用户当前建立的 WebSocket 连接总数。

  ```json
  {
    "action": "event",
    "event": {
      "action": "wssessioncount",
      "userid": "user//admin",
      "username": "admin",
      "count": 6
    }
  }
  ```

### 3. 控制与中继审计事件 (`etype: "relay"`)

- **`relaylog`（中继日志/远控会话统计）**：记录一次远程控制会话（如文件管理 `protocol: 5`、远程桌面 `protocol: 2`）结束时的审计日志与流量统计信息。

  ```json
  {
    "action": "event",
    "event": {
      "etype": "relay",
      "action": "relaylog",
      "userid": "user//admin",
      "username": "admin",
      "protocol": 5,
      "nodeid": "node//yyyy",
      "msg": "Ended file management session \"678dmimiq09\" from 172.18.0.1 to 172.18.0.1, 60 second(s)",
      "bytesin": 9682,
      "bytesout": 8076,
      "time": "2026-08-18T06:07:53.274Z"
    }
  }
  ```

### 4. 服务器性能监控统计事件

- **`servertimelinestats`（服务器性能统计）**：定时推送 MeshCentral 服务端自身的内存使用量（RSS、Heap）、活跃连接数（`conn`）、协议网络流量（`traffic`）与 CPU 负载数据。

  ```json
  {
    "action": "event",
    "event": {
      "action": "servertimelinestats",
      "data": {
        "time": "2026-08-18T06:08:28.133Z",
        "mem": { "rss": 236351488, "heapUsed": 72789880 },
        "conn": { "ca": 139, "cu": 1, "us": 6, "rs": 6 },
        "traffic": { "httpRequestCount": 98, "httpIn": 90996, "httpOut": 5703209 },
        "cpu": [0.01, 0.07, 0.04]
      }
    }
  }
  ```

## 过滤事件

MeshCtrl 的 `ShowEvents --filter` 是客户端过滤：收到事件后按 `event.action` 或顶层 `action` 判断。

示例过滤逻辑：

```js
const filters = new Set(['nodeconnect', 'changenode']);

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

## 接收设备与系统事件

推荐封装：

```js
client.events.on('deviceOffline', (event) => {
  console.log('offline:', event.nodeid);
});
```

内部标准化映射示例：

```js
function normalizeEvent(data) {
  const event = data.event ?? data;
  const action = event.action;

  // 1. 节点与设备在线/离线/属性变更/Agent日志
  if (event.etype === 'node') {
    if (action === 'nodeconnect') {
      const isOnline = typeof event.conn === 'number' && event.conn > 0;
      return { type: isOnline ? 'deviceOnline' : 'deviceOffline', nodeid: event.nodeid, raw: event };
    }
    if (action === 'changenode') {
      // 用于增量更新设备属性数据，不作为事件存入 state
      return null;
    }
    if (action === 'sysinfohash') {
      return { type: 'sysInfoHashUpdated', nodeid: event.nodeid, hash: event.hash, raw: event };
    }
    if (action === 'ifchange') {
      // 忽略网卡接口变更事件，不存入状态
      return null;
    }
    if (action === 'agentlog') {
      return { type: 'agentLog', nodeid: event.nodeid, msg: event.msg, raw: event };
    }
  }

  // 2. 远控/中继会话日志
  if (event.etype === 'relay' && action === 'relaylog') {
    return { type: 'relayLog', protocol: event.protocol, nodeid: event.nodeid, raw: event };
  }

  // 3. 用户 WebSocket 会话与服务器统计
  if (action === 'wssessioncount') {
    return { type: 'userSessionCount', count: event.count, raw: event };
  }
  if (action === 'servertimelinestats') {
    return { type: 'serverStats', data: event.data, raw: event };
  }

  return { type: action, raw: event };
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
