# @meshcentral/control-client

无 React、无 Zustand 依赖的 MeshCentral 控制通道客户端。

提供 `GatewayClient`、连接与错误订阅、通用 `request`/`send`，以及 `devices`、`groups`、`events` 资源 API。

## 安装

在当前 pnpm workspace 中添加依赖：

```json
{
  "dependencies": {
    "@meshcentral/control-client": "workspace:*"
  }
}
```

## 最小示例

```ts
import { GatewayClient } from '@meshcentral/control-client';

const client = new GatewayClient({
  url: 'wss://gateway.example.com/control',
});

try {
  // connect() 会等待 WebSocket 打开并完成客户端定义的鉴权初始化，
  // 不只是等待 socket.onopen。
  await client.connect();

  const devices = await client.devices.list();
  console.log(devices);
} finally {
  client.destroy();
}
```

浏览器和 React Native 默认使用运行环境提供的全局 `WebSocket`。Node.js 或测试环境可以通过 `webSocketFactory` 注入兼容实现。

## 鉴权

客户端支持两种由网关决定的认证输入方式。

### URL 查询参数

如果网关通过 WebSocket URL 接收认证参数，应在创建客户端前组装 URL：

```ts
const authParam = encodeURIComponent('encoded-credentials');

const client = new GatewayClient({
  url: `wss://gateway.example.com/control?x-meshauth=${authParam}`,
});
```

### 建连后的访问令牌

如果网关要求在 WebSocket 打开后发送认证消息，可以配置 `getAccessToken`：

```ts
const client = new GatewayClient({
  url: 'wss://gateway.example.com/control',
  getAccessToken: async () => loadShortLivedToken(),
});
```

令牌存在时，客户端会发送：

```json
{ "type": "authenticate", "token": "..." }
```

不要把密码、长期令牌或 Cookie 写入日志、错误消息或公共前端环境变量。

## 连接生命周期

```ts
await client.connect();

console.log(client.connectionStatus);
console.log(client.currentReconnectAttempt);

// 主动断开；不会自动重连，之后仍可再次 connect()。
client.disconnect();

// 永久销毁；清理连接、请求、定时器和监听器，之后不能再次使用。
client.destroy();
```

异常断线会按照默认间隔自动重连：1 秒、2 秒、5 秒、10 秒、30 秒、60 秒。可以覆盖连接参数：

```ts
const client = new GatewayClient({
  url,
  heartbeatIntervalMs: 27_500,
  connectionTimeoutMs: 15_000,
  requestTimeoutMs: 15_000,
  reconnectDelaysMs: [1_000, 3_000, 10_000],
});
```

连接状态包括：

- `idle`
- `connecting`
- `authenticating`
- `connected`
- `reconnecting`
- `disconnected`
- `error`
- `destroyed`

## 订阅通知

`on()` 返回取消订阅函数。一个监听器抛出异常不会阻断其他监听器。

```ts
const unsubscribeConnection = client.on('connection', (change) => {
  console.log(change.previous, change.current, change.reconnectAttempt);
});

const unsubscribeEvent = client.on('event', (event) => {
  if (event.type === 'deviceOffline') {
    console.log('设备离线：', event.deviceId);
  }
});

const unsubscribeError = client.on('error', (error) => {
  console.error(error.name, error.message);
});

const unsubscribeDiagnostic = client.on('diagnostic', (diagnostic) => {
  console.warn(diagnostic.type, diagnostic.message);
});

// 不再需要时取消订阅。
unsubscribeConnection();
unsubscribeEvent();
unsubscribeError();
unsubscribeDiagnostic();
```

支持的通道：

| 通道         | 内容                                      |
| ------------ | ----------------------------------------- |
| `connection` | 连接状态转换、重连次数和相关错误          |
| `event`      | 标准化的设备、Agent、Relay 和用户会话事件 |
| `userInfo`   | 标准化的当前用户信息                      |
| `message`    | 已解析的原始控制通道消息                  |
| `error`      | 客户端、连接、请求和协议错误              |
| `diagnostic` | 无效消息、未知消息、歧义响应和监听器异常  |

也可以在构造参数中配置默认的 `onConnectionChange`、`onEvent`、`onError` 和 `onDiagnostic` 回调。

## 设备 API

```ts
// 全部设备或指定分组的设备。
const devices = await client.devices.list();
const groupDevices = await client.devices.listByGroup('mesh//group-id');

// 设备详情相关请求。
const systemInfo = await client.devices.systemInfo('node//device-id');
const networkInfo = await client.devices.networkInfo('node//device-id');
const lastConnect = await client.devices.lastConnect('node//device-id');
const lastSeenByDeviceId = await client.devices.lastConnects();

// 并行获取设备列表、网络信息、最后连接和系统信息。
const details = await client.devices.details('node//device-id');
console.log(details.device, details.networkInfo, details.systemInfo);

// 修改和删除设备。
await client.devices.update('node//device-id', {
  name: 'Web Server',
  desc: 'Production server',
  groupId: 'mesh//group-id',
  tags: ['production'],
});
await client.devices.remove('node//device-id');

// 电源操作。
await client.devices.powerAction('node//device-id', 'wake');
await client.devices.powerAction('node//device-id', 'reset');
await client.devices.powerAction('node//device-id', 'sleep');
await client.devices.powerAction('node//device-id', 'poweroff');
```

`details()` 使用并行 fail-fast 策略，任意关键请求失败时整个调用会失败。`details.raw` 保留各项原始响应。

## 分组 API

```ts
const groups = await client.groups.list();

await client.groups.create('Production', {
  description: 'Production devices',
  type: 2,
});

await client.groups.update('mesh//group-id', {
  name: 'Production Servers',
  description: 'Updated description',
});

await client.groups.remove('mesh//group-id');
```

## 历史事件 API

```ts
const recentEvents = await client.events.list({ limit: 100 });
const deviceEvents = await client.events.listByDevice('node//device-id', { limit: 50 });
const userEvents = await client.events.listByUser('user//admin', { limit: 50 });
```

历史事件和实时 `event` 通知使用同一种 `GatewayEvent` 结构。

## 原始请求

尚未封装的 MeshCentral action、Relay 授权和批量操作可以使用原始入口：

```ts
// 等待响应。客户端自动添加 responseid，并处理超时和服务端错误。
const response = await client.request<{ value: string }>(
  { action: 'custom-action', argument: 'value' },
  10_000,
);

// 单向发送，不等待响应。
client.send({ action: 'msg', type: 'console', nodeid: 'node//device-id' });
```

`authcookie` 请求会自动串行执行，以兼容不返回 `responseid` 的服务端版本。`getsysinfo` 响应缺少 `responseid` 时，会按 action 和设备 ID 安全匹配。

## 错误处理

```ts
import {
  GatewayAuthenticationError,
  GatewayRequestTimeoutError,
  GatewayServerError,
} from '@meshcentral/control-client';

try {
  await client.connect();
  await client.devices.list();
} catch (error) {
  if (error instanceof GatewayAuthenticationError) {
    // 清除无效凭据并返回登录页。
  } else if (error instanceof GatewayRequestTimeoutError) {
    console.warn('请求超时，可以重试。');
  } else if (error instanceof GatewayServerError) {
    console.warn('服务端拒绝了请求。');
  }
}
```

公开错误类型包括：

- `GatewayAuthenticationError`
- `GatewayConnectionError`
- `GatewayConnectionClosedError`
- `GatewayRequestTimeoutError`
- `GatewayProtocolError`
- `GatewayServerError`
- `GatewayValidationError`
- `GatewayClientDestroyedError`

错误的 `context` 可能包含 action、请求 ID、设备 ID、是否可重试和原始响应。

## 自定义 WebSocket

Node.js、React Native 特殊适配或测试环境可注入 WebSocket 工厂：

```ts
import type { WebSocketLike } from '@meshcentral/control-client';

const client = new GatewayClient({
  url,
  webSocketFactory: (targetUrl): WebSocketLike => createCompatibleWebSocket(targetUrl),
});
```

注入对象需要提供 `readyState`、`onopen`、`onmessage`、`onerror`、`onclose`、`send()` 和 `close()`。

## 与 shared-state 配合

控制客户端本身不缓存设备、分组和事件。React 或 React Native 应用可以使用 `@meshcentral/shared-state`：

```ts
import { GatewayClient } from '@meshcentral/control-client';
import { bindGatewayClient, createGatewayStore } from '@meshcentral/shared-state';

const store = createGatewayStore();
const client = new GatewayClient({ url });
const binding = bindGatewayClient(store, client);

await client.connect();

// Binding 会在首次连接和重连后同步设备、分组及最后连接时间，
// 并把实时领域事件映射到 Store。

// 释放时必须先解绑，避免旧客户端继续写入 Store。
binding.dispose();
client.destroy();
```

只需要控制通道、Relay 或脚本调用时，无需安装或创建 shared-state。

## 兼容方法

为已有消费者保留了以下薄委托方法，新代码建议优先使用资源 API：

| 兼容方法                      | 推荐替代                                 |
| ----------------------------- | ---------------------------------------- |
| `requestSystemInfo(id)`       | `devices.systemInfo(id)`                 |
| `requestSnapshot()`           | 由 Binding 同步，或分别调用资源查询      |
| `refreshDevices()`            | 由 Binding 同步，或调用 `devices.list()` |
| `updateDevice(id, patch)`     | `devices.update(id, patch)`              |
| `sendPowerAction(id, action)` | `devices.powerAction(id, action)`        |
