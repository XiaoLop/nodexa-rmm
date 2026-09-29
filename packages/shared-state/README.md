# @meshcentral/shared-state

`@meshcentral/shared-state` 是 Web 与 React Native 共用的 MeshCentral UI 状态层。它基于 Zustand vanilla Store 保存设备、设备组、实时事件、当前用户和连接状态，并通过 `bindMeshCentralClient` 将 `@meshcentral/control-client` 的连接与推送结果同步到 Store。

它解决的是“客户端数据如何稳定地提供给 UI”这个问题，而不是 WebSocket 协议通信本身。

## 能做什么

- 创建与框架无关的 `MeshCentralControlStore`，可在 Web、React Native 或普通 TypeScript 中使用；
- 缓存设备、设备组、当前用户和最近 100 条可展示的实时事件；
- 保存连接状态、错误、重连次数、最近连接时间和最近消息时间；
- 在首次连接和每次重连成功后同步设备、设备组和设备最后连接时间；
- 根据设备上线、离线、变更和删除事件增量更新设备状态；
- 提供稳定引用的 selector 和 React Hook，减少无关组件更新；
- 转发常用领域类型，以及部分 MeshCentral 原始事件的 TypeScript 类型。

## 不负责什么

以下能力由 `@meshcentral/control-client` 负责：

- 创建和维护 WebSocket；
- Access Token 鉴权、心跳、自动重连；
- 原始消息编解码和 `responseid` 请求匹配；
- 设备、分组、事件、命令和用户管理等资源请求；
- 协议错误、超时和服务端错误处理。

因此，业务代码通常同时持有 `client` 和 `store`：使用 `client` 发送操作，使用 `store` 驱动 UI。

## 安装

在 monorepo 内作为 workspace 依赖使用：

```json
{
  "dependencies": {
    "@meshcentral/control-client": "workspace:*",
    "@meshcentral/shared-state": "workspace:*"
  }
}
```

## 快速开始

### 创建并绑定

```ts
import { MeshCentralClient } from '@meshcentral/control-client';
import { bindMeshCentralClient, createMeshCentralControlStore } from '@meshcentral/shared-state';

const store = createMeshCentralControlStore();
const client = new MeshCentralClient({
  url: 'wss://gateway.example.com/control',
  getAccessToken: () => sessionStorage.getItem('accessToken') ?? undefined,
});
const binding = bindMeshCentralClient(store, client);

await client.connect();
```

`connect()` 成功后，绑定器会自动请求：

- `client.devices.list()`：设备列表；
- `client.groups.list()`：设备组列表；
- `client.devices.lastConnects()`：所有设备的最后连接时间。

也可以在需要时手动刷新：

```ts
await binding.sync();
```

应用退出、登出或切换服务器时，应先解绑，再销毁客户端：

```ts
binding.dispose();
client.destroy();
```

### 在普通 TypeScript 中读取和订阅

```ts
import { meshCentralControlSelectors } from '@meshcentral/shared-state';

const unsubscribe = store.subscribe((state) => {
  console.log(state.status, meshCentralControlSelectors.onlineDeviceCount(state));
});

const devices = meshCentralControlSelectors.devices(store.getState());

unsubscribe();
```

### 在 React 或 React Native 中使用

```tsx
import { meshCentralControlSelectors, useMeshCentralControlStore } from '@meshcentral/shared-state';

export function DeviceSummary() {
  const status = useMeshCentralControlStore(store, meshCentralControlSelectors.status);
  const deviceCount = useMeshCentralControlStore(store, meshCentralControlSelectors.deviceCount);
  const onlineCount = useMeshCentralControlStore(store, meshCentralControlSelectors.onlineDeviceCount);

  return (
    <p>
      {status}: {onlineCount}/{deviceCount} online
    </p>
  );
}
```

`store` 建议在应用生命周期内创建一次，不要在组件渲染过程中重复创建。

### 发送操作并更新 UI

推荐通过 `MeshCentralClient` 的资源方法发送操作，不要在 shared-state 中拼接原始协议消息：

```ts
await client.devices.update(deviceId, { name: 'New name' });
await binding.sync();
```

某些服务端操作会随后推送 `deviceChanged`、`deviceRemoved` 等事件，此时 Store 会自动更新。对没有对应实时事件、需要立即展示结果或要求严格一致性的操作，请在成功后调用 `binding.sync()`，或将调用结果写入你自己的业务 Store。

命令执行、历史事件、用户与用户组数据不属于当前 `MeshCentralControlState`，应直接消费对应资源方法的返回值，或在上层建立独立状态。

## Store 内容

| 字段               | 类型或含义                                                                 |
| ------------------ | -------------------------------------------------------------------------- |
| `status`           | `idle \| connecting \| connected \| reconnecting \| disconnected \| error` |
| `devices`          | 以设备 ID 为 key 的设备字典                                                |
| `groups`           | 以设备组 ID 为 key 的设备组字典                                            |
| `events`           | 最新事件在前，最多保存 100 条                                              |
| `userInfo`         | 当前登录用户信息                                                           |
| `reconnectAttempt` | 当前自动重连次数                                                           |
| `lastConnectedAt`  | 最近一次进入已连接状态的 ISO 时间                                          |
| `lastMessageAt`    | 最近一次收到任意服务端消息的 ISO 时间                                      |
| `error`            | 最近一次连接、同步或客户端错误信息                                         |

Store 还提供 `replaceDevices`、`replaceGroups`、`upsertDevice`、`removeDevice`、`appendEvent`、`setUserInfo`、`setConnectionStatus`、`setError`、`touchMessage` 和 `reset` 等 action。通常应让绑定器调用这些 action；只有在实现自定义数据源或扩展绑定时才需要直接使用。

## Selectors

`meshCentralControlSelectors` 包含：

- `status`、`error`、`reconnectAttempt`；
- `devices`、`groups`、`events`、`userInfo`；
- `deviceCount`、`onlineDeviceCount`。

`devices` 和 `groups` selector 会在底层字典引用不变时复用数组引用，适合直接用于 React 订阅。

## 事件与消息

shared-state 监听 `MeshCentralClient` 的 `connection`、`message`、`event`、`userInfo` 和 `error` 五个通道。领域事件包括设备上下线、设备变更、设备删除、中继日志、Agent 日志、手动操作、命令执行、批量上传和用户会话数变化等。

“可以发送哪些消息”属于 `@meshcentral/control-client` 的职责。推荐使用 `client.devices.*`、`client.groups.*`、`client.events.*`、`client.commands.*`、`client.users.*` 和 `client.userGroups.*`，这些 API 会负责参数校验、请求关联和结果归一化。

## 详细文档

- [Store 与客户端绑定](docs/store-and-binding.md)：状态模型、同步流程、生命周期和扩展方式；
- [事件参考](docs/events.md)：客户端通道、领域事件、原始事件类型和 Store 处理规则；
- [消息与资源 API](docs/messages-and-resources.md)：可发送操作、返回结果和典型用途；
- [文档编写指南](docs/writing-docs.md)：如何在 `docs` 目录新增和维护 Markdown 文档。

基础业务类型由 `@meshcentral/control-client` 定义，本包为状态消费者提供类型转发。`MeshCentralClient` 类、客户端错误、WebSocket 类型和底层协议工具不从本包导出。
