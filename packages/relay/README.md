# @meshcentral/relay

与业务协议无关的 MeshCentral `meshrelay.ashx` 中继客户端。包内负责申请中继认证、通知 Agent、创建独立 WebSocket、完成握手，以及统一传输文本、JSON 和二进制数据。

## 边界

- 不维护设备、分组或登录状态。
- 不依赖 React、DOM 组件或应用层状态。
- 不自动重连；断开后由调用方决定是否创建新会话。
- 文件、终端和桌面目前只提供协议边界，具体状态机将在验证实际协议后分别实现。

## 使用

```ts
import { RelayClient, RELAY_PROTOCOLS } from '@meshcentral/relay';

const relay = new RelayClient({
  baseUrl: 'https://mesh.example.com/domain',
  control: gatewayClient,
});

const session = await relay.createSession({
  deviceId: 'node//device-id',
  protocol: RELAY_PROTOCOLS.files,
  onStateChange: ({ current }) => console.log(current),
});

session.onMessage((data) => {
  console.log(data);
});

session.sendJson({ action: 'ls', path: '/' });
session.close();
```

`control` 只需结构化满足 `RelayControlChannel`：提供 `request(payload, timeoutMs)` 和 `send(payload)`。现有 `GatewayClient` 可直接满足此接口，中继包不访问其内部控制 WebSocket。

## 生命周期

`idle → authorizing → notifying → connecting → handshaking → ready → closing → closed`，任何阶段都可能进入 `error`；通过 `AbortSignal` 或 `session.cancel()` 可取消连接或会话。

## 测试

`@meshcentral/relay/testing` 导出 `FakeRelayControlChannel` 与 `FakeRelayWebSocket`，用于验证调用方的会话调度和协议适配器。
