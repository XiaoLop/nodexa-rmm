# 公开 API、错误与测试

## 包入口

`package.json` 只声明两个公开入口：

```ts
import { RelayClient, FilesSession } from '@meshcentral/relay';
import { FakeRelayControlChannel, FakeRelayWebSocket } from '@meshcentral/relay/testing';
```

源码中的 `protocols/*/index.ts` 是内部聚合文件，当前没有被 `package.json#exports` 声明为可用子路径。应用代码应始终从包根导入正式 API。

## 主要公开能力

### 通用中继

- 类：`RelayClient`、`RelayConnection`、`RelaySession`。
- URL：`buildRelayUrl`、`buildAgentRelayPath`。
- 协议：`RELAY_PROTOCOLS`、`BuiltInRelayProtocol`、`RelayProtocolDescriptor`。
- 类型：控制通道、WebSocket 抽象、连接选项、创建会话选项、连接事件和数据类型。

### 终端

- `TerminalSession`、`TerminalSessionError`、`terminalRelayProtocol`。
- `createTerminalOptionsMessage`、`createTerminalResizeMessage`、`createTerminalRttMessage`、`parseTerminalControlMessage`。
- `TERMINAL_CONTROL_CHANNEL` 和终端尺寸、状态、控制消息类型。

### 文件

- `FilesSession`、`FileOperationError`、`filesRelayProtocol`。
- 目录、上传、下载、文件命令和 ZIP 消息构造器及解析函数。
- Windows、POSIX 和根路径处理函数，包括安全名称和父目录计算。
- `browserFileSource`、`UploadSource`、`DownloadSink` 及进度和结果类型。
- `FileCommandReceipt`、`FileDialogMessage` 和无响应命令选项类型。

### 桌面

- `DesktopSession`、`DesktopProtocolParser`、`DesktopSessionError`、`desktopRelayProtocol`。
- 鼠标、键盘、Unicode 和 CAD 消息构造器。
- 屏幕、图像块、显示器几何和 metadata 解析函数。
- 桌面状态、命令、图像、输入和错误类型。

精确导出列表以 `src/index.ts` 为准。

## 通用错误

| 错误类 | code | 常见原因 |
| --- | --- | --- |
| `RelayAuthenticationError` | `RELAY_AUTHENTICATION_FAILED` | 授权响应无效或缺少 cookie |
| `RelayAgentRouteError` | `RELAY_AGENT_ROUTE_FAILED` | Agent 返回非 OK、Unable to route 或响应无效 |
| `RelayConnectionError` | `RELAY_CONNECTION_FAILED` | WebSocket 失败、未 ready 时发送、意外断线 |
| `RelayHandshakeError` | `RELAY_HANDSHAKE_FAILED` | 握手消息不是 `c` 或 `cr` |
| `RelayProtocolError` | `RELAY_PROTOCOL_ERROR` | 通用协议错误基类 |
| `RelayTimeoutError` | `RELAY_TIMEOUT` | 连接或握手等待超时 |
| `RelayCancelledError` | `RELAY_CANCELLED` | 建立过程被 AbortSignal 取消 |

协议适配器还会抛出：

- `FileOperationError`：包含请求 ID 和文件操作错误码。
- `TerminalSessionError`：错误码包括 `protocol`、`connection-lost`、`cancelled`、`invalid-size`、`output-overflow`、`unsupported-message`。
- `DesktopSessionError`：包含协议、长度、溢出、图像、屏幕尺寸和输入权限错误码。

推荐按错误类或稳定 `code` 分支，不要根据英文错误文本判断：

```ts
try {
  await files.listDirectory(path);
} catch (error) {
  if (error instanceof FileOperationError && error.code === 'permission-denied') {
    showPermissionMessage();
  } else {
    throw error;
  }
}
```

## 测试替身

```ts
import {
  FakeRelayControlChannel,
  FakeRelayWebSocket,
} from '@meshcentral/relay/testing';
```

### FakeRelayControlChannel

适合验证：

- `authcookie` 请求内容和超时参数。
- Agent tunnel 通知中的 `nodeid`、`usage`、`value` 和 `responseid`。
- 成功、拒绝、无效响应和控制通道异常。

### FakeRelayWebSocket

适合验证：

- WebSocket URL 和 `binaryType`。
- `open -> c/cr -> startup messages -> ready` 顺序。
- 文本、JSON 和二进制发送内容。
- 入站消息、错误、正常关闭和意外断线。
- 连接、握手和适配器资源上限行为。

## 测试建议

新增协议能力至少覆盖：

1. 正常创建和成功结果。
2. 线上发送消息的完整字段或字节。
3. 分片、粘包或 Blob 等边界输入。
4. 请求 ID 不匹配和未知消息。
5. 超时、AbortSignal、主动取消和意外断线。
6. `dispose()` 不关闭 relay，`close()` 会关闭 relay。
7. 监听函数解除后不再收到事件。

文件和桌面二进制测试应断言实际字节布局，而不只断言调用了 `sendBinary()`。

## 协议夹具

终端最小脱敏夹具位于 `src/testing/fixtures/terminal/`。夹具只应保留理解协议所需的信息：

- 帧方向和消息形状。
- 帧长度、握手和正常关闭。
- relaylog 开始/结束字段。
- 已确认的控制消息字段。

不要提交终端内容、用户名、设备名、地址、Cookie、令牌或真实会话标识。新增夹具时同步更新该目录的 README 和夹具测试。

## 验证命令

```text
pnpm --filter @meshcentral/relay lint
pnpm --filter @meshcentral/relay typecheck
pnpm --filter @meshcentral/relay test
pnpm --filter @meshcentral/relay build
```
