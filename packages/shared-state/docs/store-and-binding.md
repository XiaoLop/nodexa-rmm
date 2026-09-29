# Store 与客户端绑定

本文说明 `MeshCentralControlStore` 的状态结构、`bindMeshCentralClient` 的同步规则，以及在应用中如何管理二者的生命周期。

## 架构关系

```text
MeshCentral Server
        |
        | WebSocket 请求与推送
        v
@meshcentral/control-client
        |
        | connection / message / event / userInfo / error
        v
bindMeshCentralClient
        |
        | Zustand actions
        v
MeshCentralControlStore -> Web / React Native UI
```

`MeshCentralClient` 是协议和连接层，`MeshCentralControlStore` 是 UI 状态层，`bindMeshCentralClient` 是两者之间的适配器。

## 创建 Store

```ts
import { createMeshCentralControlStore } from '@meshcentral/shared-state';

export const gatewayStore = createMeshCentralControlStore();
```

`createMeshCentralControlStore()` 每次都会返回独立实例。多服务器、多账号或测试场景可以创建多个 Store；普通应用通常只创建一个。

## 状态字段

| 字段 | 说明 | 更新来源 |
| --- | --- | --- |
| `status` | 面向 UI 的连接状态 | `connection` 通道 |
| `devices` | 设备字典 | 快照同步和设备领域事件 |
| `groups` | 设备组字典 | 快照同步 |
| `events` | 最新事件在前，最多 100 条 | `event` 通道 |
| `userInfo` | 当前登录用户 | `userInfo` 通道 |
| `reconnectAttempt` | 当前自动重连次数 | `connection` 通道 |
| `lastConnectedAt` | 最近连接成功时间 | 状态变为 `connected` 时 |
| `lastMessageAt` | 最近收到服务端消息的时间 | `message` 通道 |
| `error` | 最近错误文本 | 连接、同步或 `error` 通道 |

客户端的 `authenticating` 会映射为 Store 的 `connecting`，`destroyed` 会映射为 `disconnected`。这样 UI 不需要了解客户端内部连接阶段。

## 创建绑定

```ts
import { MeshCentralClient } from '@meshcentral/control-client';
import { bindMeshCentralClient, createMeshCentralControlStore } from '@meshcentral/shared-state';

const store = createMeshCentralControlStore();
const client = new MeshCentralClient({
  url: 'wss://gateway.example.com/control',
  getAccessToken: async () => loadAccessToken(),
});
const binding = bindMeshCentralClient(store, client);

await client.connect();
```

绑定器不会主动调用 `connect()`。建议先建立绑定再连接，以免错过初始连接事件和用户信息推送。

## 自动同步

每次客户端进入 `connected` 状态，绑定器都会并行调用：

```ts
await Promise.all([
  client.devices.list(),
  client.groups.list(),
  client.devices.lastConnects(),
]);
```

同步成功后：

1. 设备列表会整体替换；
2. `lastConnects()` 的结果会合并到设备的 `lastSeenAt`；
3. 设备组列表会整体替换；
4. `error` 会被清空。

同步失败不会清空已有数据，只会把错误文本写入 `error`。

连续触发多次同步时，只有最后一次同步结果可以写入 Store。解绑后，仍在进行中的同步结果也不会再写入。

## 手动同步

写操作完成、页面重新获得焦点或用户点击刷新时，可以调用：

```ts
try {
  await binding.sync();
} catch {
  // sync 会把错误写入 store.error，本身不会向外抛出同步错误。
}
```

当前实现中 `sync()` 会在内部捕获错误，因此调用方应通过 `store.getState().error` 或 selector 展示失败状态。

## 实时事件处理

绑定器对设备事件执行以下增量更新：

| 事件 | Store 行为 |
| --- | --- |
| `deviceOnline` | 新增或合并设备，设置 `online: true`，并加入事件列表 |
| `deviceOffline` | 新增或合并设备，设置 `online: false`、更新 `lastSeenAt`，并加入事件列表 |
| `deviceChanged` | 从原始事件的 `node` 或 `device` 归一化设备并合并，不加入事件列表 |
| `deviceRemoved` | 从设备字典删除，并加入事件列表 |
| 其他已知事件 | 加入事件列表 |
| `unknown` | 不加入事件列表 |

设备合并会尽量保留已有名称、分组、平台、Agent 版本和最后连接时间，避免字段不完整的推送覆盖快照数据。

## Selectors

```ts
import { meshCentralControlSelectors } from '@meshcentral/shared-state';

const state = store.getState();
const devices = meshCentralControlSelectors.devices(state);
const groups = meshCentralControlSelectors.groups(state);
const onlineCount = meshCentralControlSelectors.onlineDeviceCount(state);
```

可用 selector：

| Selector | 返回值 |
| --- | --- |
| `status` | 当前连接状态 |
| `error` | 当前错误文本 |
| `reconnectAttempt` | 当前重连次数 |
| `devices` | 设备数组 |
| `groups` | 设备组数组 |
| `events` | 实时事件数组 |
| `userInfo` | 当前用户信息 |
| `deviceCount` | 设备总数 |
| `onlineDeviceCount` | 在线设备数 |

`devices` 和 `groups` 使用基于字典引用的缓存。底层字典未变化时会返回相同的数组引用。

## React 使用

```tsx
import { meshCentralControlSelectors, useMeshCentralControlStore } from '@meshcentral/shared-state';

export function ConnectionBadge() {
  const status = useMeshCentralControlStore(gatewayStore, meshCentralControlSelectors.status);
  const error = useMeshCentralControlStore(gatewayStore, meshCentralControlSelectors.error);

  return <span title={error}>{status}</span>;
}
```

选择器应只返回组件需要的数据。不要直接订阅整个 Store，否则任意字段变化都会触发组件更新。

## 写操作后的状态一致性

shared-state 当前只自动同步设备、设备组、设备最后连接时间和当前用户推送，不保存以下资源：

- 历史事件查询结果；
- 命令执行输出；
- 用户列表和用户在线会话数；
- 用户组列表；
- 设备系统信息、网络信息和详情；
- 邀请链接和邀请发送结果。

这些结果应由页面直接消费，或存入对应功能自己的状态。设备和设备组写操作完成后，如果服务端没有立即推送可识别事件，应调用 `binding.sync()` 获取最终状态。

## 生命周期与清理

```ts
binding.dispose();
client.destroy();
```

必须先调用 `dispose()`，再调用 `destroy()`：

- `dispose()` 移除绑定器注册的所有监听器并阻止后续写入；
- `destroy()` 关闭连接、停止重连和心跳，并清理客户端监听器。

`dispose()` 可重复调用。解绑不会自动重置 Store；登出时如需清空界面数据，可另外调用：

```ts
store.getState().reset();
```

## 扩展绑定

如果页面需要缓存更多客户端结果，建议在应用层组合一个独立 Store 或包装现有绑定，而不是修改底层协议消息：

```ts
const unsubscribe = client.on('event', (event) => {
  if (event.type === 'commandExecution') {
    commandHistoryStore.getState().append(event);
  }
});

// 页面销毁时
unsubscribe();
```

扩展时要保持与 `MeshCentralClientBinding` 相同的清理纪律，避免重复监听和卸载后写状态。
