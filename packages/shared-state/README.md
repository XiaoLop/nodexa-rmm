# @meshcentral/shared-state

`@meshcentral/shared-state` 提供 Web 与 React Native 共享的 Zustand vanilla Store、selector、React Hook，以及将 `@meshcentral/control-client` 显式绑定到 Store 的适配器。

## 职责

- 缓存设备、分组、事件和当前用户信息；
- 保存面向 UI 的连接状态、错误、重连次数和最近消息时间；
- 提供稳定引用的 selector 与 `useGatewayStore`；
- 使用 `bindGatewayClient(store, client)` 消费客户端资源结果和标准领域事件；
- 首次连接与重连成功后重新同步设备、分组和最后连接时间。

本包不创建 WebSocket、不解析原始 JSON、不生成 `responseid`，也不实现鉴权、心跳或自动重连。

## 使用

```ts
import { GatewayClient } from '@meshcentral/control-client';
import { bindGatewayClient, createGatewayStore } from '@meshcentral/shared-state';

const store = createGatewayStore();
const client = new GatewayClient({
  url: 'wss://gateway.example.com/control',
});
const binding = bindGatewayClient(store, client);

await client.connect();

// 释放顺序：先解绑，再销毁客户端。
binding.dispose();
client.destroy();
```

React 与 React Native 可以继续通过 `useGatewayStore(store, selector)` 订阅状态。

## Store 内容

- `status`：`idle | connecting | connected | reconnecting | disconnected | error`
- `devices`：按设备 ID 保存的设备字典
- `groups`：按分组 ID 保存的分组字典
- `events`：最多 100 条实时事件
- `userInfo`：当前用户信息
- `reconnectAttempt`、`lastConnectedAt`、`lastMessageAt`、`error`

基础业务类型由 `@meshcentral/control-client` 定义，本包为状态消费者提供类型转发。客户端类、客户端错误、WebSocket 和协议类型不从本包导出。
