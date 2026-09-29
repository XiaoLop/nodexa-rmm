# @meshcentral/relay

`@meshcentral/relay` 是 MeshCentral `meshrelay.ashx` 的中继客户端和协议适配包。它负责通过现有控制通道申请中继凭据、通知目标 Agent、建立独立 WebSocket、完成 MeshCentral 握手，并为终端、文件管理和远程桌面提供可直接使用的会话 API。

这个包适合放在浏览器、React Native 或其他应用层与 MeshCentral 服务之间。应用负责登录、设备选择、权限判断和 UI；本包负责中继连接和协议数据。

目前已实现：

- 通用 `RelayClient`、`RelayConnection` 和 `RelaySession`。
- 文件管理协议 `p=5` 的 `FilesSession`。
- 终端协议 `p=1` 的 `TerminalSession`。
- 桌面协议 `p=2` 的 `DesktopSession`、二进制命令解析和输入消息编码。
- 目录读取和归一化。
- 单设备单文件分块上传。
- 单设备单文件流式下载。
- 上传和下载进度、取消、无活动超时和连接中断处理。
- Windows、Linux 和 macOS 路径处理。

## 边界

- 不维护设备、分组或登录状态。
- 不依赖 React 或应用层状态。
- 核心中继层不解释文件、终端或桌面业务消息。
- 文件和终端协议分别通过 `FilesSession`、`TerminalSession` 实现，不向通用 `RelaySession` 添加协议业务。
- 不自动重连或重放文件传输；断开后由调用方决定是否创建新会话。
- 不实现断点续传、离线队列和跨会话恢复。

## 创建中继会话

```ts
import { RelayClient, RELAY_PROTOCOLS } from '@meshcentral/relay';

const relayClient = new RelayClient({
  baseUrl: 'https://mesh.example.com/domain',
  control: meshCentralClient,
});

const relaySession = await relayClient.createSession({
  deviceId: 'node//device-id',
  protocol: RELAY_PROTOCOLS.files,
  onStateChange: ({ current }) => console.log(current),
});
```

`control` 只需结构化满足 `RelayControlChannel`，提供：

- `request(payload, timeoutMs)`：发送请求并等待控制通道响应。
- `send(payload)`：发送无需等待响应的控制消息。

现有 `MeshCentralClient` 可直接满足该接口，中继包不会访问其内部控制 WebSocket。Agent tunnel 通知会等待带 `responseid` 的结果；目标服务端返回 `OK` 后才创建 Relay WebSocket，`Unable to route` 会抛出可重试的 `RelayAgentRouteError`。

中继收到 MeshCentral 的 `c` 或 `cr` 握手后，默认自动发送当前协议号，例如文件协议发送文本 `5`。需要在协议号前发送配置的协议可以提供 `createStartupMessages`，启动帧全部发送后连接才进入 `ready`。

所有 `onStateChange`、`onMessage`、`onError` 和 `onClose` 监听方法都会返回取消监听函数。完整的连接状态、事件载荷、原始发送 API 和关闭语义见 [核心中继文档](docs/01-core-relay.md)。

## 终端会话

终端必须在握手后先发送 `options`，再发送 Shell 协议号：

```ts
import {
  RELAY_PROTOCOLS,
  TerminalSession,
  createTerminalOptionsMessage,
} from '@meshcentral/relay';

const initialSize = { cols: 120, rows: 30 };
let recorded = false;
const relay = await relayClient.createSession({
  deviceId: 'node//device-id',
  protocol: RELAY_PROTOCOLS.terminal,
  onHandshakeMessage: (message) => {
    recorded = message === 'cr';
  },
  createStartupMessages: () => [createTerminalOptionsMessage(1, initialSize), '1'],
});

const terminal = new TerminalSession(relay, { initialSize, recorded });
terminal.onData((data) => xterm.write(data));
terminal.onLatencyChange((latencyMs) => console.log(latencyMs));
terminal.write('whoami\r');
terminal.resize({ cols: 132, rows: 36 });
```

字符串输入会按 UTF-8 编码为二进制帧。二进制输出以保留 `byteOffset` 和 `byteLength` 的 `Uint8Array` 发布，Blob 与其他消息通过串行队列保持接收顺序。当前目标版本只确认入站 RTT 控制响应，因此只有 `ctrlChannel` 为 `102938` 且 `type` 为 `rtt` 的 JSON 会被过滤；尚未确认的 `ping`、`pong`、`metadata` 和 `disconnect` 仍作为普通终端文本交付。

已确认的最小脱敏协议夹具位于 `src/testing/fixtures/terminal/`。夹具只保留帧方向、消息形状、帧长度、正常关闭和 relaylog 字段，不包含终端内容、用户、设备、地址、Cookie 或真实会话标识。

`TerminalSession` 默认每 10 秒发送一次 RTT 探测，支持尺寸去重和范围校验，并在待处理输出超过上限时关闭中继。`dispose()` 只释放适配层，`close()` 同时关闭底层中继。

终端可发送的启动、输入、resize 和 RTT 消息，以及每个事件的用途见 [终端协议文档](docs/02-terminal.md)。

## 文件管理会话

### 创建 `FilesSession`

```ts
import { FilesSession } from '@meshcentral/relay';

const files = new FilesSession(relaySession, {
  defaultTimeoutMs: 60_000,
  onUnhandledMessage: (message) => console.warn('未关联消息', message),
});
```

同一个 `FilesSession` 当前只允许一个活动文件操作。操作结束、失败或取消后才能开始下一项操作，避免不同请求错误消费同一条 Agent 消息。

### 读取目录

```ts
const listing = await files.listDirectory('C:\\Temp', {
  timeoutMs: 20_000,
});

for (const entry of listing.entries) {
  console.log(entry.name, entry.kind, entry.size, entry.modifiedAt);
}
```

读取根目录时传入空字符串：

```ts
const roots = await files.listDirectory('');
```

返回的 `DirectoryListing` 包含规范化后的路径及 `FileEntry[]`。目录项类型包括：

- `drive`
- `directory`
- `file`
- `unknown`

### 浏览器文件上传

```ts
import { browserFileSource } from '@meshcentral/relay';

const input = document.querySelector<HTMLInputElement>('input[type=file]');
const file = input?.files?.[0];

if (file) {
  const result = await files.uploadFile('C:\\Temp', browserFileSource(file), {
    timeoutMs: 60_000,
    onProgress: (progress) => {
      console.log(
        progress.state,
        progress.percentage,
        progress.acknowledgedBytes,
        progress.totalBytes,
      );
    },
  });

  console.log('上传完成', result.path, result.name);
}
```

### 自定义上传数据源

协议层通过 `UploadSource` 读取文件，不依赖浏览器 `File`：

```ts
import type { UploadSource } from '@meshcentral/relay';

const source: UploadSource = {
  name: 'demo.bin',
  size: data.byteLength,
  async read(start, end) {
    return data.slice(start, end);
  },
};

await files.uploadFile('/tmp', source);
```

`read(start, end)` 必须只返回指定范围的数据。上传实现不会一次性把整个文件加载到内存。

## 上传分块和确认

默认上传分块大小为 `5 MiB`：

```text
5 * 1024 * 1024 = 5,242,880 字节
```

可在单次上传中覆盖：

```ts
await files.uploadFile('/tmp', source, {
  chunkSize: 1024 * 1024,
});
```

也可以设置会话默认值：

```ts
const files = new FilesSession(relaySession, {
  defaultChunkSize: 1024 * 1024,
});
```

上传流程：

1. 发送 `upload` 请求。
2. 等待 Agent 返回 `uploadstart`。
3. 读取并发送一块二进制数据。
4. 等待 Agent 返回 `uploadack`。
5. 收到确认后发送下一块。
6. 所有字节确认后发送 `uploaddone`。
7. 等待 Agent 返回 `uploaddone`，操作才算完成。

进度按 Agent 已确认的字节数计算，而不是仅按浏览器已发送的字节数计算。

如果数据块首字节为 `0` 或 `{`（ASCII `123`），协议层会自动在前面添加一个 `0`，避免 Agent 将二进制内容误判为 JSON 命令。该转义字节不计入文件大小和上传进度。

## 超时和取消

`timeoutMs` 表示等待远端活动的最长时间，不是整个操作必须完成的总时间。每次收到匹配请求的 `uploadstart`、`uploadack`、`uploaddone` 或目录响应后，计时器都会重置。

使用 `AbortSignal` 取消：

```ts
const controller = new AbortController();

const uploading = files.uploadFile('/tmp', source, {
  signal: controller.signal,
  timeoutMs: 60_000,
});

controller.abort();
await uploading;
```

也可以取消当前文件操作：

```ts
files.cancelActive('用户取消上传');
```

取消上传时会尽力向 Agent 发送 `uploadcancel`。中继已经断开时，操作只在本地结束，不会自动重传。

## 原始中继接口

未使用协议适配层时，可以直接监听和发送原始数据：

```ts
relaySession.onMessage((data) => {
  console.log(data);
});

relaySession.sendText('hello');
relaySession.sendJson({ action: 'custom' });
relaySession.sendBinary(new Uint8Array([1, 2, 3]));
```

对于文件管理，应优先使用 `FilesSession`，避免调用方自行处理请求路由、二进制 JSON、上传确认和数据块转义。

目录、上传、下载的完整请求响应时序及消息字段见 [文件协议文档](docs/03-files.md)。

## 远程桌面会话

```ts
import { DesktopSession, RELAY_PROTOCOLS } from '@meshcentral/relay';

const relay = await relayClient.createSession({
  deviceId: 'node//device-id',
  protocol: RELAY_PROTOCOLS.desktop,
});

const desktop = new DesktopSession(relay, { inputAllowed: true });

desktop.onScreenSize(({ width, height }) => console.log(width, height));
desktop.onDisplayGeometry((geometry) => console.log(geometry));
desktop.onTile(({ x, y, image, imageFormat }) => {
  renderTile(x, y, image, imageFormat);
});
desktop.onError((error) => console.error(error.code, error.message));

desktop.sendMouseMove({ x: 400, y: 240 });
desktop.sendMouseButton('left', 'down', { x: 400, y: 240 });
desktop.sendMouseButton('left', 'up', { x: 400, y: 240 });
desktop.sendKey(0x41, 'down');
desktop.sendKey(0x41, 'up');
```

桌面输入默认关闭，只有显式设置 `inputAllowed: true` 后才会发送输入命令。`DesktopSession` 当前解释屏幕尺寸、JPEG/PNG/WebP 图像块、显示器几何和 metadata，并将未知命令交给 `onUnknownCommand`。详细的二进制帧格式、事件与输入命令见 [远程桌面协议文档](docs/04-desktop.md)。

## 事件概览

| 来源 | 事件或监听方法 | 用途 |
| --- | --- | --- |
| `RelaySession` | `onStateChange` | 观察授权、通知、连接、握手、就绪、关闭和错误状态 |
| `RelaySession` | `onMessage` | 接收未经过协议适配器解释的原始入站消息 |
| `RelaySession` | `onError` / `onClose` | 处理连接错误和 WebSocket 关闭信息 |
| `TerminalSession` | `onData` | 接收终端文本或二进制输出 |
| `TerminalSession` | `onLatencyChange` | 获取 RTT 毫秒值，超时为 `undefined` |
| `FilesSession` | 操作的 `onProgress` | 获取上传确认进度或下载接收进度 |
| `DesktopSession` | `onScreenSize` / `onDisplayGeometry` | 获取画布和显示器布局 |
| `DesktopSession` | `onTile` | 获取可绘制的桌面图像块 |
| `DesktopSession` | `onControlMessage` / `onUnknownCommand` | 处理 metadata 或保留尚未适配的命令 |

完整事件载荷与可发送消息的横向索引见 [事件与消息速查](docs/05-events-and-messages.md)。

## 生命周期

通用中继生命周期：

```text
idle → authorizing → notifying → connecting → handshaking → ready → closing → closed
```

任何阶段都可能进入 `error`。通过创建会话时的 `AbortSignal`、`relaySession.cancel()` 或 `relaySession.close()` 可以结束中继。

文件操作状态包括：

```text
requesting → waiting-start → reading → sending → waiting-ack → completed
```

异常终态包括 `cancelled`、`failed`、`timed-out` 和 `connection-lost`。

## 关闭

仅释放文件协议监听器：

```ts
files.dispose();
```

释放文件协议并关闭底层中继：

```ts
files.close(1000, 'File operations completed.');
```

## 测试

`@meshcentral/relay/testing` 导出：

- `FakeRelayControlChannel`
- `FakeRelayWebSocket`

可用于验证中继会话调度、协议适配器、超时、取消、断线和请求响应顺序。

## 详细文档

- [文档目录和编写约定](docs/README.md)
- [架构、连接、生命周期与事件](docs/01-core-relay.md)
- [终端协议](docs/02-terminal.md)
- [文件管理协议](docs/03-files.md)
- [远程桌面协议](docs/04-desktop.md)
- [事件与消息速查](docs/05-events-and-messages.md)
- [公开 API、错误与测试](docs/06-api-and-testing.md)

包内命令：

```text
pnpm --filter @meshcentral/relay lint
pnpm --filter @meshcentral/relay typecheck
pnpm --filter @meshcentral/relay test
pnpm --filter @meshcentral/relay build
```
