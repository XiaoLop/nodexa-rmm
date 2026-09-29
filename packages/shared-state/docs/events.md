# 事件参考

本文说明 shared-state 会监听哪些客户端通道、领域事件分别代表什么，以及包中导出的原始 MeshCentral 事件类型如何使用。

## 三个层次

事件相关数据分为三个层次：

1. 服务端原始消息，例如 `{ action: 'event', event: { action: 'nodeconnect' } }`；
2. `@meshcentral/control-client` 归一化后的 `MeshCentralEvent`；
3. `bindMeshCentralClient` 对 `MeshCentralControlStore` 的更新。

UI 应优先使用第二和第三层。只有需要读取服务端特有字段时，才访问 `MeshCentralEvent.raw` 或使用原始事件类型。

## 客户端通道

`bindMeshCentralClient` 注册五个 `MeshCentralClient` 通道：

| 通道 | 数据 | 在 shared-state 中的用途 |
| --- | --- | --- |
| `connection` | 连接状态变化 | 更新 `status`、`error`、`reconnectAttempt`，连接成功后同步快照 |
| `message` | 任意已解析服务端消息 | 更新 `lastMessageAt` |
| `event` | `MeshCentralEvent` | 增量更新设备并维护事件列表 |
| `userInfo` | `UserInfo` | 更新当前用户信息 |
| `error` | `Error` | 更新 `error` 文本 |

`MeshCentralClient` 还提供 `diagnostic` 通道，但 shared-state 不订阅它。协议诊断适合日志和遥测，应直接在客户端上监听：

```ts
const unsubscribe = client.on('diagnostic', (diagnostic) => {
  console.warn(diagnostic.type, diagnostic.message, diagnostic.payload);
});
```

## MeshCentralEvent 结构

```ts
interface MeshCentralEvent {
  id: string;
  type: MeshCentralEventType;
  action?: string;
  deviceId?: string;
  deviceName?: string;
  user?: string;
  ip?: string;
  message?: string;
  occurredAt: string;
  raw?: unknown;
}
```

- `type` 是客户端归一化后的稳定分类；
- `action` 是服务端原始 action；
- `occurredAt` 始终是 ISO 时间字符串；
- `raw` 保留服务端原始事件，便于读取协议特有字段；
- 服务端没有事件 ID 时，客户端会根据事件内容生成稳定 ID。

## 领域事件类型

| `MeshCentralEventType` | 常见原始 action | 含义 | Store 行为 | 典型用途 |
| --- | --- | --- | --- | --- |
| `deviceOnline` | `nodeconnect`、`connect`、`connected` | 设备在线或恢复连接 | 更新设备在线状态并记录事件 | 在线徽标、通知、设备计数 |
| `deviceOffline` | `nodedisconnect`、`disconnect`、`disconnected`，或 `nodeconnect` 且连接值不大于 0 | 设备离线 | 更新在线状态和最后在线时间并记录事件 | 离线告警、资产状态 |
| `deviceChanged` | `changenode` | 设备属性变化 | 合并设备数据，不记录到事件列表 | 名称、系统、标签或分组变化 |
| `deviceRemoved` | `removenode`、`deletenode` | 设备被删除 | 删除设备并记录事件 | 从列表移除、审计提示 |
| `relayLog` | `relaylog` 或 `etype: relay` | 中继/控制会话审计 | 记录事件 | 远程桌面、终端、文件会话审计 |
| `agentLog` | `agentlog` | Agent 操作日志 | 记录事件 | 文件传输、命令等 Agent 操作审计 |
| `manualOperation` | `manual` | 手动操作记录 | 记录事件 | 管理员操作历史 |
| `commandExecution` | `runcommands` | 命令执行事件 | 记录事件 | 命令任务历史和结果提示 |
| `batchUpload` | `batchupload` | 批量上传事件 | 记录事件 | 批量部署或文件分发审计 |
| `userSessionCount` | `wssessioncount` | 用户 WebSocket 会话数变化 | 记录事件 | 在线用户和多会话提示 |
| `unknown` | 未识别 action | 客户端尚未归类的消息 | 不记录到 Store 事件列表 | 诊断、协议扩展 |

Store 中的事件始终按最新在前排列，最多保存 100 条。`deviceChanged` 被视为状态更新而不是时间线事件，因此不会加入列表。

## 直接监听领域事件

当业务需要处理 Store 未缓存的数据时，可以直接监听客户端：

```ts
const unsubscribe = client.on('event', (event) => {
  if (event.type === 'relayLog') {
    auditStore.getState().append(event);
  }
});

unsubscribe();
```

不要假设所有事件都有 `deviceId`、`user` 或 `message`，使用前应检查可选字段。

## 原始 MeshCentral 事件类型

shared-state 从 `src/types/events.type.ts` 导出一组服务端原始事件类型。这些类型描述原始 payload，不等同于 `MeshCentralEvent`。

| 原始 action | 导出类型 | 用途 |
| --- | --- | --- |
| `changenode` | `ChangeNodeEventPayload` | 读取设备最新完整数据 |
| `devicesessions` | `DeviceSessionsEventPayload` | 感知设备控制会话变化 |
| `wssessioncount` | `WsSessionCountEventPayload` | 获取用户当前 WebSocket 会话数 |
| `relaylog` | `RelayLogEventPayload` | 获取协议、流量、用户和目标设备等审计字段 |
| `sysinfohash` | `SysInfoHashEventPayload` | 判断设备系统信息是否需要重新拉取 |
| `servertimelinestats` | `ServerTimelineStatsEventPayload` | 读取服务器内存、连接、流量和 CPU 指标 |
| `nodeconnect` | `NodeConnectEventPayload` | 获取设备连接、电源和连接时间信息 |
| `ifchange` | `IfChangeEventPayload` | 感知网卡或 IP 信息变化 |
| `agentlog` | `AgentLogEventPayload` | 获取 Agent 操作的详细审计字段 |

还导出了：

- `EventAction`：上述原始 action 的枚举；
- `MeshCentralEventPayload`：原始事件 payload 联合类型；
- `MeshCentralEventMessage<T>`：`action: 'event'` 顶层消息；
- 各事件对应的完整 `...EventMessage` 类型。

示例：

```ts
import {
  EventAction,
  type MeshCentralEventMessage,
  type RelayLogEventPayload,
} from '@meshcentral/shared-state';

function readRelayLog(message: MeshCentralEventMessage<RelayLogEventPayload>) {
  if (message.event.action !== EventAction.RelayLog) return;
  console.log(message.event.protocol, message.event.bytesin, message.event.bytesout);
}
```

## 读取 raw 字段

`MeshCentralEvent.raw` 的类型是 `unknown`，使用时必须先缩小类型：

```ts
import { EventAction, type RelayLogEventPayload } from '@meshcentral/shared-state';

function isRelayLog(value: unknown): value is RelayLogEventPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'action' in value &&
    value.action === EventAction.RelayLog
  );
}

const event = store.getState().events[0];
if (event?.type === 'relayLog' && isRelayLog(event.raw)) {
  console.log(event.raw.bytesin, event.raw.bytesout);
}
```

不要直接使用类型断言跳过检查，因为服务端版本、权限和代理层都可能导致字段缺失。

## 实时事件与历史事件

Store 的 `events` 只保存绑定期间收到的实时事件，不是完整审计历史。查询历史事件应使用：

```ts
const recent = await client.events.list({ limit: 100 });
const deviceHistory = await client.events.listByDevice(deviceId, {
  limit: 50,
  filter: 'relaylog',
});
```

历史查询结果不会自动写入 `MeshCentralControlStore.events`，页面应单独保存和分页展示。
