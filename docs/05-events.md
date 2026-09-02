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

通过控制通道发送 `action: "events"` 可以获取最近保存的历史事件。`limit` 表示期望返回的最大事件数量；服务端通常按事件时间从新到旧返回。

### 获取最近事件

下面的请求获取最近 60 条事件：

```json
{
  "action": "events",
  "limit": 60
}
```

响应中的 `events` 是事件数组：

```json
{
  "action": "events",
  "events": [
    {
      "etype": "node",
      "action": "agentlog",
      "nodeid": "node//ZNWmO2ABRN0XMEm$VkfiEqrFArZK4x@RqKeZweKvdAZzfRS0uLNFoJ$UvQlR5xGY",
      "msg": "Performing power action=2, forced=0",
      "msgid": 25,
      "msgArgs": [2, 0],
      "remoteaddr": "172.18.0.1",
      "userid": "user//admin",
      "username": "admin",
      "time": "2026-09-02T04:08:06.266Z"
    },
    {
      "etype": "node",
      "action": "agentlog",
      "nodeid": "node//DFm$t7nBrWNjtFyoO8Ao9ruebL3i3IwRRnMvwsmJHltfiGqdqtiZaGaUOwLE0kvD",
      "msg": "Performing power action=2, forced=0",
      "msgid": 25,
      "msgArgs": [2, 0],
      "remoteaddr": "172.18.0.1",
      "userid": "user//admin",
      "username": "admin",
      "time": "2026-09-02T04:07:57.219Z"
    }
  ]
}
```

常用响应字段：

| 字段 | 说明 |
| --- | --- |
| `etype` | 事件类别，例如 `node` 或 `relay`；部分事件可能省略 |
| `action` | 具体事件动作，例如 `agentlog`、`relaylog` |
| `nodeid` | 事件关联的设备 ID；是否存在取决于查询方式和事件类型 |
| `msg` | 服务端生成的事件消息 |
| `msgid` | MeshCentral 内部消息类型 ID，可配合 `msgArgs` 生成本地化消息 |
| `msgArgs` | 消息模板参数 |
| `remoteaddr` | 发起操作的客户端或代理地址 |
| `userid` | 操作用户的完整 ID |
| `username` | 操作用户名 |
| `time` | ISO 8601 格式的事件发生时间 |

例如上述 `msgid: 25`、`msgArgs: [2, 0]` 表示设备正在执行电源操作；原始消息为 `Performing power action=2, forced=0`。应用层应保留原始字段，并根据 `action`、`msgid` 和 `msgArgs` 转换为适合展示的本地化描述。

### 按用户过滤

使用完整用户 ID 作为 `user` 参数：

```json
{
  "action": "events",
  "user": "user//admin",
  "limit": 100
}
```

### 按设备过滤

发送 `events` 请求时可以携带完整设备 ID 作为 `nodeid` 参数，只获取指定节点关联的历史事件：

```json
{
  "action": "events",
  "limit": 60,
  "nodeid": "node//17qDHvBbIuFqTjlUN1w0cb8GLCq4UySgG3BGu1ePPc4YSG9jVNCEoX$vnuCL1VFL"
}
```

响应中的 `events` 仅包含该节点的相关记录，例如远程桌面会话和 Agent 操作日志：

```json
{
  "action": "events",
  "events": [
    {
      "action": "relaylog",
      "userid": "user//admin",
      "username": "admin",
      "msgid": 11,
      "msgArgs": ["dt7s1c74v3m", "172.18.0.1", "172.18.0.1", 52],
      "msg": "Ended desktop session \"dt7s1c74v3m\" from 172.18.0.1 to 172.18.0.1, 52 second(s)",
      "protocol": 2,
      "bytesin": 24493,
      "bytesout": 22745,
      "time": "2026-09-01T13:03:32.806Z"
    },
    {
      "action": "agentlog",
      "msg": "Started remote desktop without notification (172.18.0.1)",
      "msgid": 36,
      "remoteaddr": "172.18.0.1",
      "userid": "user//admin",
      "username": "admin",
      "sessionid": "user//admin/e153a04f0fce626413f094a8c25f4702ff84cd37",
      "time": "2026-09-01T13:02:40.252Z"
    }
  ]
}
```

对应的 TypeScript 请求与响应类型可定义为：

```ts
interface NodeEventsRequest {
  action: 'events';
  limit?: number;
  nodeid: string;
  responseid?: string;
}

interface HistoricalEventBase {
  /** 按节点查询时通常省略，使用请求中的 nodeid 作为关联节点。 */
  nodeid?: string;
  /** 某些按节点查询的历史事件不会返回 etype。 */
  etype?: string;
  userid?: string;
  username?: string;
  msg?: string;
  msgid?: number;
  msgArgs?: Array<string | number | boolean | null>;
  time: string;
}

interface RelayLogEvent extends HistoricalEventBase {
  action: 'relaylog';
  /** 例如 2 表示远程桌面，5 表示文件管理。 */
  protocol: number;
  /** 通常仅会话结束事件包含流量统计。 */
  bytesin?: number;
  bytesout?: number;
}

interface AgentLogEvent extends HistoricalEventBase {
  action: 'agentlog';
  remoteaddr?: string;
  sessionid?: string;
}

interface UnknownHistoricalEvent extends HistoricalEventBase {
  action: string;
  [field: string]: unknown;
}

type HistoricalEvent = RelayLogEvent | AgentLogEvent | UnknownHistoricalEvent;

interface EventsResponse {
  action: 'events';
  responseid?: string;
  events: HistoricalEvent[];
}
```

实际服务端还可能返回其他 `action`，因此类型中保留了 `UnknownHistoricalEvent`。消费事件时应先判断 `action`，再读取该事件类型特有的字段：

```ts
function isRelayLogEvent(event: HistoricalEvent): event is RelayLogEvent {
  return event.action === 'relaylog' && 'protocol' in event && typeof event.protocol === 'number';
}

function isAgentLogEvent(event: HistoricalEvent): event is AgentLogEvent {
  return event.action === 'agentlog';
}

function handleHistoricalEvent(event: HistoricalEvent, requestedNodeId: string): void {
  const nodeid = event.nodeid ?? requestedNodeId;

  if (isRelayLogEvent(event)) {
    console.log(nodeid, event.protocol, event.bytesin, event.bytesout);
    return;
  }

  if (isAgentLogEvent(event)) {
    console.log(nodeid, event.remoteaddr, event.sessionid);
  }
}
```

`nodeid` 参数还会影响响应事件的字段结构，但不同事件类型返回的字段并不完全一致：

- 请求携带 `nodeid` 时，服务端已知查询上下文，返回的节点相关历史事件可能省略 `nodeid`，有些记录还可能省略 `etype`。客户端应将请求中的节点 ID 作为所有返回事件的关联节点上下文。
- 请求未携带 `nodeid` 时，节点事件（例如 `etype: "node"` 的 `agentlog`）通常会携带 `nodeid`，用于区分事件所属设备。
- `relaylog`、`agentlog` 等不同事件类型拥有不同字段集合。例如 `relaylog` 可能包含 `protocol`、`bytesin` 和 `bytesout`，而 `agentlog` 可能包含 `remoteaddr` 和 `sessionid`；开始事件与结束事件的字段也可能不同。
- 并非所有历史事件都与设备关联。用户、服务器或其他全局事件即使在未按节点查询时，也可能没有 `nodeid`。

因此，客户端不应仅凭某个字段是否存在来判断事件类型，也不应假设每条历史事件都有 `etype`、`nodeid`、`msgArgs`、`protocol` 或流量统计字段。应优先根据 `action` 识别事件，并将其余字段按可选字段处理；按节点查询时，不能因为事件缺少 `nodeid` 而将其丢弃。

### 请求与响应匹配

如果同一控制连接上会并发发送多个请求，建议添加唯一的 `responseid`：

```json
{
  "action": "events",
  "limit": 60,
  "responseid": "req-events-001"
}
```

服务端会在对应响应中返回相同的 `responseid`：

```json
{
  "action": "events",
  "responseid": "req-events-001",
  "events": []
}
```

未提供 `responseid` 时，服务端仍可返回历史事件，但客户端难以在并发请求场景中可靠区分响应和实时推送。因此 SDK 或 Web 应用应始终自动生成 `responseid`，并在收到响应后解除对应的待处理请求。

### 客户端处理建议

- 将历史响应中的每一项与实时推送事件复用同一套标准化逻辑。
- 使用服务端事件 ID；若事件没有 ID，可基于 `action`、`nodeid`、`userid`、`time`、`msgid` 和 `msgArgs` 生成稳定指纹，用于历史事件与实时事件去重。
- 不要只使用接收时间或随机数生成去重 ID，否则同一事件通过历史查询和实时推送到达时会被视为两条记录。
- 将 `time` 作为事件发生时间，客户端接收时间仅用于连接诊断。
- 保留完整原始事件，界面展示时再进行设备名称解析、消息本地化和敏感字段脱敏。
- 当前原生 `events` 请求适合获取最近事件；复杂的时间范围、关键字和分页查询应由业务网关封装，避免浏览器直接依赖 MeshCentral 的内部查询能力。

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
