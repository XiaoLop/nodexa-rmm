# 远程桌面协议

`DesktopSession` 适配 MeshCentral desktop relay 协议 `p=2`。它解析远端桌面二进制命令，发布屏幕、显示器和图像块事件，并可在显式授权后编码鼠标与键盘输入。

## 创建会话

```ts
import { DesktopSession, RELAY_PROTOCOLS } from '@meshcentral/relay';

const relay = await relayClient.createSession({
  deviceId,
  protocol: RELAY_PROTOCOLS.desktop,
});

const desktop = new DesktopSession(relay, {
  inputAllowed: canControlDevice,
  maxPendingProtocolBytes: 8 * 1024 * 1024,
  onUnhandledMessage: (message) => console.warn(message),
});
```

`DesktopSession` 要求底层 relay 的协议为 `2` 且状态为 `ready`。握手后默认发送文本 `"2"`。

## 入站二进制帧

普通桌面命令使用 4 字节大端头：

```text
uint16 command
uint16 totalSize
payload...
```

`totalSize` 包含 4 字节命令头。解析器支持数据跨 WebSocket 消息分片，也支持一个 WebSocket 消息中包含多个命令。

Jumbo 外层命令号为 `27`，用于承载超过普通 16 位长度的命令。解析后的 `DesktopProtocolCommand` 会保留：

- `command`：内层命令号。
- `size`：命令总长度。
- `bytes`：完整内层命令数据。
- `jumbo`：是否来自 jumbo 包。
- `outerBytes`：jumbo 时的外层原始数据。

## 已解释的入站命令

| 命令号 | 事件 | 结果 | 可用于 |
| ---: | --- | --- | --- |
| `7` | `onScreenSize` | `{ width, height }` | 创建或调整远程画布 |
| `3` | `onTile` | `{ x, y, image, imageFormat }` | 在坐标处绘制 JPEG、PNG 或 WebP 图像块 |
| `82` | `onDisplayGeometry` | `{ id, x, y, width, height, bytes }` | 构建多显示器布局和显示器选择 UI |
| 其他 | `onUnknownCommand` | `DesktopProtocolCommand` | 诊断、记录和后续兼容尚未适配的命令 |

未知图像格式会产生 `unsupported-image` 错误。调用方可通过 Blob URL、Canvas、Skia 或平台图像 API 解码 `tile.image`。

## 文本控制消息

当前只识别满足以下条件的 metadata JSON：

- 是 JSON 对象。
- 包含 `ctrlChannel`。
- `type` 等于 `"metadata"`。

已识别消息会同时发送到构造选项 `onControlMessage` 和 `desktop.onControlMessage()` 监听器。其他文本交给 `onUnhandledMessage`。

## 事件

```ts
const removeScreen = desktop.onScreenSize(({ width, height }) => {
  resizeCanvas(width, height);
});

const removeTile = desktop.onTile((tile) => {
  renderTile(tile.x, tile.y, tile.image, tile.imageFormat);
});

const removeGeometry = desktop.onDisplayGeometry((geometry) => {
  updateDisplays(geometry);
});

const removeError = desktop.onError((error) => {
  console.error(error.code, error.message);
});
```

| 监听方法 | 载荷 | 用途 |
| --- | --- | --- |
| `onStateChange` | `DesktopSessionState` | 屏幕已知、关闭或错误时更新 UI |
| `onScreenSize` | `DesktopScreenSize` | 设置远程画布尺寸 |
| `onDisplayGeometry` | `DesktopDisplayGeometry` | 维护多显示器坐标系 |
| `onTile` | `DesktopTile` | 解码并绘制增量图像块 |
| `onControlMessage` | `DesktopControlMessage` | 消费 metadata 控制信息 |
| `onUnknownCommand` | `DesktopProtocolCommand` | 保留未知协议能力和调试证据 |
| `onError` | `DesktopSessionError` | 处理解析、资源上限和输入权限错误 |

当前实现会从 `ready` 在收到合法屏幕尺寸后进入 `screen-known`。类型中保留了 `desktop-ready`，但当前实现不会主动进入该状态，调用方不应等待它。

## 发送桌面输入

所有输入方法都发送大端二进制命令，且只有 `inputAllowed: true` 时可用。

| API | 命令号 | 作用 | 预期效果 |
| --- | ---: | --- | --- |
| `sendMouseMove(point)` | `2` | 发送绝对坐标移动 | 远端指针移动 |
| `sendMouseButton(button, phase, point)` | `2` | 发送左、右或中键按下/抬起 | 远端鼠标点击或拖拽 |
| `sendMouseDoubleClick(point)` | `2` | 发送双击标记 | 远端执行双击 |
| `sendMouseWheel(point, delta)` | `2` | 发送滚轮增量 | 远端滚动 |
| `sendKey(keyCode, phase, extended?)` | `1` | 发送 8 位虚拟键码 | 远端键盘按下或抬起 |
| `sendUnicode(codeUnit, phase)` | `85` | 发送 16 位 Unicode code unit | 输入无法由普通虚拟键码表达的字符 |
| `sendCad()` | `10` | 请求 Ctrl+Alt+Delete | 打开安全注意序列界面，是否成功取决于 Agent 和权限 |

示例：

```ts
desktop.sendMouseMove({ x: 400, y: 240 });
desktop.sendMouseButton('left', 'down', { x: 400, y: 240 });
desktop.sendMouseButton('left', 'up', { x: 400, y: 240 });

desktop.sendKey(0x41, 'down');
desktop.sendKey(0x41, 'up');

desktop.sendUnicode('中'.charCodeAt(0), 'down');
desktop.sendUnicode('中'.charCodeAt(0), 'up');
```

坐标必须是 `0..65535` 的整数；普通 key code 必须是 `0..255`；Unicode code unit 必须是 `0..65535`；滚轮增量范围为 `-32767..32767`。

这些发送方法没有 Promise 响应。实际结果表现为后续远端图像块变化，或由上层控制通道、权限与 Agent 行为决定。

## 错误与资源限制

`DesktopSessionError.code`：

| code | 含义 |
| --- | --- |
| `protocol` | relay 协议错误或命令处理失败 |
| `connection-lost` | relay 未 ready、已关闭或断线 |
| `invalid-command-size` | 命令长度字段无效 |
| `command-too-large` | 普通或 jumbo 命令超过配置上限 |
| `output-overflow` | 待处理入站数据超过上限 |
| `unsupported-image` | tile 不是 JPEG、PNG 或 WebP |
| `invalid-screen-size` | 屏幕尺寸命令无效 |
| `input-not-allowed` | 未设置 `inputAllowed: true` 却调用输入方法 |

默认最大待处理桌面数据为 8 MiB。超过上限时使用关闭码 `4009`；协议处理失败使用关闭码 `4002`。

## 关闭

```ts
desktop.dispose(); // 停止解析和发布事件，不关闭 relay
desktop.close();   // 同时关闭底层 relay
```

## 实现依据

- `src/protocols/desktop/DesktopSession.ts`
- `src/protocols/desktop/DesktopProtocolParser.ts`
- `src/protocols/desktop/commands.ts`
- `src/protocols/desktop/controlMessages.ts`
- `src/protocols/desktop/*.test.ts`
