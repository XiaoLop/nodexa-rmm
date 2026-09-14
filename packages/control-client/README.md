# @meshcentral/control-client

`@meshcentral/control-client` 是 MeshCentral 控制通道的 TypeScript 客户端。它负责建立和维护 WebSocket 连接、完成鉴权、关联请求与响应、处理超时和服务端错误，并把常用的 MeshCentral action 封装为设备、命令、设备组、事件、用户组和用户资源 API。

这个包适合浏览器、React Native、Node.js 脚本和测试环境。它只负责控制通道，不负责远程桌面、终端或文件传输的数据通道；这些场景应配合 Relay 客户端使用。

## 能做什么

- 建立经过鉴权的控制通道，并在异常断线后自动重连。
- 查询、修改、删除设备，获取系统、网络和最后连接信息。
- 执行单设备或多设备电源操作、分组迁移和 Agent 邀请。
- 提交命令，或持续跟踪每台设备的输出、退出码和最终状态。
- 管理设备组，设置或移除用户的设备组权限。
- 标准化站点和设备权限，判断桌面、终端、设备文件等常用能力。
- 查询历史事件，订阅设备上下线、命令执行等实时事件。
- 查询用户组、用户和在线会话数，创建、编辑、锁定和删除用户。
- 通过 `request()` 和 `send()` 调用尚未封装的 MeshCentral action。

## 安装

在当前 pnpm workspace 中添加依赖：

```json
{
  "dependencies": {
    "@meshcentral/control-client": "workspace:*"
  }
}
```

## 快速开始

```ts
import { GatewayClient } from '@meshcentral/control-client';

const client = new GatewayClient({
  url: 'wss://gateway.example.com/control',
  getAccessToken: async () => loadShortLivedToken(),
});

const unsubscribe = client.on('connection', ({ current }) => {
  console.log('control channel:', current);
});

try {
  // connect() 会等待 WebSocket 打开并完成鉴权初始化。
  await client.connect();

  const devices = await client.devices.list();
  const groups = await client.groups.list();
  console.log({ devices, groups });
} finally {
  unsubscribe();
  client.destroy();
}
```

浏览器和 React Native 默认使用运行环境提供的全局 `WebSocket`。Node.js 或测试环境可以通过 `webSocketFactory` 注入兼容实现。

## 鉴权

如果网关通过 WebSocket URL 接收认证参数，应在创建客户端前组装 URL：

```ts
const authParam = encodeURIComponent('encoded-credentials');
const client = new GatewayClient({
  url: `wss://gateway.example.com/control?x-meshauth=${authParam}`,
});
```

如果网关要求在 WebSocket 打开后发送认证消息，可以配置 `getAccessToken`。令牌存在时，客户端会发送 `{ "type": "authenticate", "token": "..." }`。

不要把密码、长期令牌或 Cookie 写入日志、错误消息或公共前端环境变量。

## 连接生命周期

```ts
await client.connect();
console.log(client.connectionStatus, client.currentReconnectAttempt);

// 主动断开；不会自动重连，之后仍可再次 connect()。
client.disconnect();

// 永久销毁；之后不能再次使用。
client.destroy();
```

异常断线会按照默认间隔自动重连：1 秒、2 秒、5 秒、10 秒、30 秒、60 秒。可以覆盖 `heartbeatIntervalMs`、`connectionTimeoutMs`、`requestTimeoutMs` 和 `reconnectDelaysMs`。

连接状态包括 `idle`、`connecting`、`authenticating`、`connected`、`reconnecting`、`disconnected`、`error` 和 `destroyed`。

## 资源 API

| 资源                | 主要能力                                               | 典型用途             |
| ------------------- | ------------------------------------------------------ | -------------------- |
| `client.devices`    | 设备列表、详情、修改、删除、电源、批量操作、Agent 邀请 | 设备管理页、批量运维 |
| `client.commands`   | 命令提交和带输出跟踪的命令执行                         | 脚本执行、批量诊断   |
| `client.groups`     | 设备组增删改查、用户权限                               | 分组管理、授权       |
| `client.events`     | 全局、设备或用户历史事件                               | 审计记录、活动时间线 |
| `client.userGroups` | 用户组列表                                             | 权限配置界面         |
| `client.users`      | 用户、锁定状态、会话数和账号维护                       | 管理员用户管理       |

常见用法：

```ts
const devices = await client.devices.list();
const details = await client.devices.details('node//device-id');
await client.devices.update('node//device-id', { name: 'Web Server' });
await client.devices.powerAction('node//device-id', 'reset');

const execution = client.commands.execute(['node//device-a', 'node//device-b'], 'hostname', {
  shell: 'powershell',
  timeoutMs: 60_000,
});
const unsubscribeOutput = execution.subscribe((snapshot) => {
  console.log(snapshot.status, snapshot.results);
});
const finalSnapshot = await execution.completed;
unsubscribeOutput();

const events = await client.events.listByDevice('node//device-id', {
  limit: 50,
  filter: 'runcommands',
});

const users = await client.users.list();
const sessionCounts = await client.users.listSessionCounts();
```

## 权限判断

```ts
import {
  MeshRight,
  SiteRight,
  canUseDeviceFiles,
  canUseTerminal,
  getDesktopAccess,
  hasMeshRight,
  hasSiteRight,
} from '@meshcentral/control-client';

const users = await client.users.list();
const canManageUsers = hasSiteRight(users[0].siteRights, SiteRight.ManageUsers);

const devices = await client.devices.list();
const rights = devices[0].effectiveRights;
if (rights !== undefined) {
  console.log(getDesktopAccess(rights));
  console.log(canUseTerminal(rights));
  console.log(canUseDeviceFiles(rights));
  console.log(hasMeshRight(rights, MeshRight.WakeDevice));
}
```

普通设备终端和目标设备文件传输都以 `MeshRight.RemoteControl` 为基础，并分别受 `NoTerminal`、`NoFiles` 限制。`AgentConsole` 与 `ServerFiles` 是不同功能，不应代替上述能力判断。

客户端权限 API 只用于标准化、界面控制和授权编辑。服务端仍是最终安全边界；调用方不应通过遍历 `ManagedUser.links` 自行重算完整有效权限。完整说明见 [权限 API](docs/permissions.md)。

完整方法、底层 action、返回值和使用场景见 [docs/messages-and-resources.md](docs/messages-and-resources.md)。

## 事件与订阅

`on()` 返回取消订阅函数。一个监听器抛出异常不会阻断其他监听器，而是产生 `listener-error` 诊断。

```ts
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
```

订阅通道：

| 通道         | 内容                             | 适合做什么                       |
| ------------ | -------------------------------- | -------------------------------- |
| `connection` | 连接状态转换、重连次数和相关错误 | 更新在线状态、禁用依赖连接的操作 |
| `event`      | 标准化后的领域事件               | 增量更新设备、审计和任务状态     |
| `userInfo`   | 当前登录用户信息                 | 初始化身份、权限和个人资料       |
| `message`    | 每一条已解析的原始控制通道消息   | 调试协议、实现尚未标准化的功能   |
| `error`      | 连接、请求、协议和服务端错误     | 统一错误提示和日志上报           |
| `diagnostic` | 无效、未知、歧义响应和监听器异常 | 开发期排错和兼容性监控           |

`event` 通道当前会产生 `deviceOnline`、`deviceOffline`、`deviceChanged`、`deviceRemoved`、`relayLog`、`agentLog`、`manualOperation`、`commandExecution`、`batchUpload` 和 `userSessionCount`。每种事件的来源、字段和建议处理方式见 [docs/events.md](docs/events.md)。

## 可以发送哪些消息

推荐优先使用资源 API。资源 API 会校验参数、自动添加 `responseid`、处理超时和服务端错误，并在有稳定结构时返回标准化结果。

对于尚未封装的 MeshCentral action，可以使用：

```ts
// 请求-响应：等待匹配响应，适合查询或需要确认结果的修改操作。
const response = await client.request<{ value: string }>(
  { action: 'custom-action', argument: 'value' },
  10_000,
);

// 单向发送：只保证消息写入已连接的 WebSocket，不等待服务端确认。
client.send({ action: 'msg', type: 'console', nodeid: 'node//device-id' });
```

注意：

- `request()` 的泛型只提供 TypeScript 提示，不会在运行时验证服务端响应。
- `send()` 不代表操作成功；需要确认结果时应使用资源 API 或 `request()`。
- `message` 通道包含响应、推送和未知消息，业务代码应先检查结构再使用。
- `authcookie`、`events`、`meshes`、`usergroups`、`users` 和 `wssessioncount` 会按 action 串行请求，以兼容不返回 `responseid` 的服务端版本。
- 原始协议可能因 MeshCentral 或网关版本不同而变化，应保留抓包或测试证据，并优先把稳定能力封装为资源方法。

已封装消息的完整清单见 [docs/messages-and-resources.md](docs/messages-and-resources.md)，原始消息的扩展原则见 [docs/raw-messages.md](docs/raw-messages.md)。

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

公开错误类型包括 `GatewayAuthenticationError`、`GatewayConnectionError`、`GatewayConnectionClosedError`、`GatewayRequestTimeoutError`、`GatewayProtocolError`、`GatewayServerError`、`GatewayValidationError` 和 `GatewayClientDestroyedError`。

错误的 `context` 可能包含 action、请求 ID、设备 ID、是否可重试和原始响应。

## 与 shared-state 配合

控制客户端本身不缓存设备、分组和事件。React 或 React Native 应用可以使用 `@meshcentral/shared-state`：

```ts
import { GatewayClient } from '@meshcentral/control-client';
import { bindGatewayClient, createGatewayStore } from '@meshcentral/shared-state';

const store = createGatewayStore();
const client = new GatewayClient({ url });
const binding = bindGatewayClient(store, client);

await client.connect();

// 释放时必须先解绑，避免旧客户端继续写入 Store。
binding.dispose();
client.destroy();
```

## 在 docs 中编写详细文档

包级 README 保持为入口和能力总览，详细说明放在 `docs/`。新增或修改公开能力时：

1. 在 `docs/` 中按主题创建 kebab-case 文件，例如 `device-invitations.md`。
2. 说明使用前提、公开方法、参数、返回值、底层 action、事件影响、失败方式和完整示例。
3. 对 `unknown` 或 `raw` 响应给出已验证样例，并注明来源版本；不要猜测未验证字段。
4. 同步更新 [docs/README.md](docs/README.md) 的目录，以及本 README 中相关能力入口。
5. 对协议解析或标准化行为补充测试，运行 `pnpm --filter @meshcentral/control-client test`、`typecheck` 和 `lint`。

详细模板、术语和维护检查表见 [docs/README.md](docs/README.md)。

## 兼容方法

为已有消费者保留了以下薄委托方法，新代码建议优先使用资源 API：

| 兼容方法                      | 推荐替代                                 |
| ----------------------------- | ---------------------------------------- |
| `requestSystemInfo(id)`       | `devices.systemInfo(id)`                 |
| `requestSnapshot()`           | 由 Binding 同步，或分别调用资源查询      |
| `refreshDevices()`            | 由 Binding 同步，或调用 `devices.list()` |
| `updateDevice(id, patch)`     | `devices.update(id, patch)`              |
| `sendPowerAction(id, action)` | `devices.powerAction(id, action)`        |

## 详细文档

- [文档索引与编写规范](docs/README.md)
- [资源 API 与消息清单](docs/messages-and-resources.md)
- [事件、订阅通道与诊断](docs/events.md)
- [原始 request/send 消息指南](docs/raw-messages.md)
