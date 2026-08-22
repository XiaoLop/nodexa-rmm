# @meshcentral/shared-state

`@meshcentral/shared-state` 是 monorepo 中的共享状态管理与网关通信模块。它封装了基于 Zustand 的全局 Store、WebSocket 自动化客户端 `GatewayClient`、协议适配器以及 React Hook，供 Web 端和 App (React Native) 端共享使用。

---

## 核心架构与组成

| 模块 | 说明 |
| --- | --- |
| **Store (`GatewayStore`)** | 基于 Zustand vanilla 状态库，维护连接状态、设备字典、分组、事件历史及用户信息 |
| **Client (`GatewayClient`)** | 管理 WebSocket 连接生命周期，包括鉴权、心跳、断线重连及状态同步 |
| **Adapter (`meshCentralGatewayAdapter`)** | 网关 WebSocket 协议适配器，解析网关推送的消息并转换为状态突变 (`GatewayMutation`) |
| **React Hook (`useGatewayStore`)** | React / React Native 的状态订阅 Hook |

---

## 包含的数据 (Data & State)

`GatewayState` 维护的核心状态字段如下：

### 1. 状态结构 (`GatewayState`)

| 字段 | 类型 | 初始值 | 说明 |
| --- | --- | --- | --- |
| `status` | `ConnectionStatus` | `'idle'` | 连接状态：`'idle'` \| `'connecting'` \| `'connected'` \| `'reconnecting'` \| `'disconnected'` \| `'error'` |
| `devices` | `Record<string, Device>` | `{}` | 设备列表字典（以 `deviceId` 为 Key） |
| `groups` | `Record<string, DeviceGroup>` | `{}` | 设备分组字典（以 `groupId` 为 Key） |
| `events` | `GatewayEvent[]` | `[]` | 接收到的实时事件历史（最多保留 100 条） |
| `userInfo` | `UserInfo \| undefined` | `undefined` | 当前登录用户的属性与权限信息 |
| `reconnectAttempt` | `number` | `0` | 当前自动重连尝试次数 |
| `lastConnectedAt` | `string \| undefined` | `undefined` | 最近一次成功建立连接的时间 (ISO 8601) |
| `lastMessageAt` | `string \| undefined` | `undefined` | 最近一次收到网关消息的时间 (ISO 8601) |
| `error` | `string \| undefined` | `undefined` | 异常提示文本 |

### 2. 核心数据模型

- **`Device`** (设备模型)
  - `id`: 设备节点 ID
  - `name`: 设备显示名称
  - `groupId` / `groupName`: 所属分组 ID 与分组名
  - `online`: 是否在线 (`boolean`)
  - `agentVersion`: Agent 版本号
  - `platform`: 操作系统/平台描述
  - `lastSeenAt`: 最后在线/连接时间 (ISO 8601)
  - `raw`: 网关原始数据对象

- **`DeviceGroup`** (设备分组模型)
  - `id`: 分组 ID
  - `name`: 分组名称
  - `description`: 分组描述
  - `raw`: 网关原始数据对象

- **`UserInfo`** (用户信息模型)
  - `id`: 用户 ID
  - `name` / `email`: 用户名与邮箱
  - `siteadmin`: 是否为站点管理员标志
  - `lastLoginAt` / `lastAccessAt`: 登录/访问时间

### 3. 选择器 (`gatewaySelectors`)

为避免不必要的 React 重渲染，库内置了常用的 Zustand 选择器：

- `gatewaySelectors.status(state)`: 当前连接状态
- `gatewaySelectors.error(state)`: 错误信息
- `gatewaySelectors.reconnectAttempt(state)`: 当前重连次数
- `gatewaySelectors.devices(state)`: 设备列表数组 `Device[]`
- `gatewaySelectors.groups(state)`: 分组列表数组 `DeviceGroup[]`
- `gatewaySelectors.events(state)`: 实时事件列表 `GatewayEvent[]`
- `gatewaySelectors.userInfo(state)`: 用户个人信息 `UserInfo | undefined`
- `gatewaySelectors.deviceCount(state)`: 总设备数
- `gatewaySelectors.onlineDeviceCount(state)`: 在线设备数

---

## 包含的事件 (Events)

当网关推送实时消息时，协议适配器将其转换为归一化的 **`GatewayEvent`**。

### 1. 归一化事件类型 (`GatewayEventType`)

| 事件类型 (`type`) | 描述 |
| --- | --- |
| `'deviceOnline'` | 设备上线连接成功 |
| `'deviceOffline'` | 设备断开连接或下线 |
| `'deviceChanged'` | 设备属性（名称、分组、网络等）变更 |
| `'deviceRemoved'` | 设备节点被删除 |
| `'relayLog'` | 远程控制（桌面/终端/文件）审计日志 |
| `'agentLog'` | Agent 系统的日志消息 |
| `'userSessionCount'` | 当前用户的 WebSocket 在线会话数变动 |
| `'unknown'` | 其他未识别的事件 |

### 2. 事件对象结构 (`GatewayEvent`)

```ts
export interface GatewayEvent {
  id: string;          // 事件唯一 ID
  type: GatewayEventType; // 归一化事件类型
  deviceId?: string;   // 关联的设备 ID
  deviceName?: string; // 关联的设备名称
  user?: string;       // 触发或关联的操作用户
  ip?: string;         // 操作源 IP
  message?: string;    // 事件详细消息内容
  occurredAt: string;  // 发生时间 (ISO 8601)
  raw?: unknown;       // 服务端原始事件 Payload
}
```

### 3. 底层网关 Action 枚举 (`EventAction`)

在 `types/events.type.ts` 中定义的协议层原始事件 Action 枚举：

- `EventAction.ChangeNode` (`'changenode'`): 设备属性变更
- `EventAction.NodeConnect` (`'nodeconnect'`): 设备连接/上线
- `EventAction.DeviceSessions` (`'devicesessions'`): 设备控制会话状态变动
- `EventAction.WsSessionCount` (`'wssessioncount'`): 用户在线 WS 会话计数变动
- `EventAction.RelayLog` (`'relaylog'`): 中继控制审计日志
- `EventAction.AgentLog` (`'agentlog'`): Agent 操作日志
- `EventAction.IfChange` (`'ifchange'`): 网卡/网络接口变动
- `EventAction.SysInfoHash` (`'sysinfohash'`): 系统 Hash 变化
- `EventAction.ServerTimelineStats` (`'servertimelinestats'`): 服务器性能与状态统计

---

## 如何使用 (Usage)

### 1. 创建 Store 并初始化 GatewayClient

```ts
import { createGatewayStore, GatewayClient } from '@meshcentral/shared-state';

// 1. 创建 Store 实例
export const store = createGatewayStore();

// 2. 创建 Client 实例
export const client = new GatewayClient({
  url: 'wss://your-gateway.example.com/control.ashx',
  store,
  // 动态获取 Token
  getAccessToken: async () => {
    return 'your-auth-token';
  },
  // 可选配置：心跳间隔（默认 27.5 秒）、连接超时时间（默认 15 秒）
  heartbeatIntervalMs: 27500,
});

// 3. 建立连接
await client.connect();

// 4. 手动拉取设备与分组快照
client.requestSnapshot();

// 5. 断开连接 / 销毁
client.disconnect();
```

### 2. 在 React / React Native 中消费状态

```tsx
import React from 'react';
import { useGatewayStore, gatewaySelectors } from '@meshcentral/shared-state';
import { store } from './gateway';

export function DeviceOverview() {
  // 使用内置 selector 精确订阅
  const status = useGatewayStore(store, gatewaySelectors.status);
  const devices = useGatewayStore(store, gatewaySelectors.devices);
  const onlineCount = useGatewayStore(store, gatewaySelectors.onlineDeviceCount);

  return (
    <div>
      <h3>网关状态: {status}</h3>
      <p>在线设备: {onlineCount} / {devices.length}</p>

      <ul>
        {devices.map((device) => (
          <li key={device.id}>
            {device.name} [{device.online ? '在线' : '离线'}]
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 3. 发送设备指令

```ts
// 修改设备名称、描述或所属分组
client.changeDevice('node-id-123', {
  name: '服务器-01',
  groupId: 'group-id-456',
});

// 发送电源操作指令
// 支持操作: 'wake' | 'reset' | 'poweroff' | 'sleep'
client.sendPowerAction('node-id-123', 'wake');
```

---

## 关键流程原理

1. **连接与鉴权**：`GatewayClient` 在建连后，自动发送 Auth Token。得到服务端确认后切为 `connected` 状态并启动心跳机制。
2. **退避重连**：当连接非正常中断，`GatewayClient` 按设定的退避间隔（`1s, 2s, 5s, 10s, 30s, 60s`）尝试自动重连。
3. **状态突变 (Mutation)**：网关接收到的各种消息解码为 `GatewayMutation`（如 `snapshot`, `deviceUpserted`, `deviceStatusChanged`, `deviceRemoved` 等），由 `store.applyMutation()` 进行增量式更新。
