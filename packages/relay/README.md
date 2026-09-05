# @meshcentral/relay

MeshCentral `meshrelay.ashx` 中继客户端及协议适配层。包内负责申请中继认证、通知 Agent、创建独立 WebSocket、完成握手、启动指定协议，以及统一传输文本、JSON 和二进制数据。

目前已实现：

- 通用 `RelayClient`、`RelayConnection` 和 `RelaySession`。
- 文件管理协议 `p=5` 的 `FilesSession`。
- 目录读取和归一化。
- 单设备单文件分块上传。
- 单设备单文件流式下载。
- 上传和下载进度、取消、无活动超时和连接中断处理。
- Windows、Linux 和 macOS 路径处理。

终端和桌面目前仍只提供协议描述符及通用中继能力。

## 边界

- 不维护设备、分组或登录状态。
- 不依赖 React 或应用层状态。
- 核心中继层不解释文件、终端或桌面业务消息。
- 文件协议通过独立的 `FilesSession` 实现，不向通用 `RelaySession` 添加文件操作。
- 不自动重连或重放文件传输；断开后由调用方决定是否创建新会话。
- 不实现断点续传、离线队列和跨会话恢复。

## 创建中继会话

```ts
import { RelayClient, RELAY_PROTOCOLS } from '@meshcentral/relay';

const relayClient = new RelayClient({
  baseUrl: 'https://mesh.example.com/domain',
  control: gatewayClient,
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

现有 `GatewayClient` 可直接满足该接口，中继包不会访问其内部控制 WebSocket。

中继收到 MeshCentral 的 `c` 或 `cr` 握手后，会自动发送当前协议号，例如文件协议发送文本 `5`。调用方不需要手动发送协议启动标识。

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

包内命令：

```text
pnpm --filter @meshcentral/relay lint
pnpm --filter @meshcentral/relay typecheck
pnpm --filter @meshcentral/relay test
pnpm --filter @meshcentral/relay build
```
