# 事件与消息速查

本文从应用调用方视角集中回答两个问题：应该监听哪些事件，以及可以发送哪些消息。

## 事件速查

| 对象 | 监听入口 | 载荷 | 主要用途 |
| --- | --- | --- | --- |
| `RelaySession` | `onStateChange` | `RelayStateChangeEvent` | 连接状态 UI、日志、失败恢复 |
| `RelaySession` | `onMessage` | `RelayInboundData` | 处理没有专用适配器的原始协议 |
| `RelaySession` | `onError` | `Error` | 处理连接、握手和传输错误 |
| `RelaySession` | `onClose` | `RelayCloseEventLike` | 读取关闭码并释放应用资源 |
| `TerminalSession` | `onData` | `string \| Uint8Array` | 写入终端模拟器或日志流 |
| `TerminalSession` | `onLatencyChange` | `number \| undefined` | 显示 RTT 或超时状态 |
| `TerminalSession` | `onStateChange` | `TerminalSessionState` | 禁用输入和销毁终端 UI |
| `TerminalSessionOptions` | `onControlMessage` | `TerminalControlMessage` | 观察已识别 RTT 控制帧 |
| `TerminalSessionOptions` | `onUnhandledMessage` | `RelayInboundData` | 诊断无法处理的终端数据 |
| `UploadFileOptions` | `onProgress` | `FileUploadProgress` | 展示 Agent 确认的上传进度 |
| `DownloadFileOptions` | `onProgress` | `FileDownloadProgress` | 展示已写入 sink 的下载进度 |
| `FilesSessionOptions` | `onUnhandledMessage` | `unknown` | 观察未关联到当前文件操作的消息 |
| `DesktopSession` | `onStateChange` | `DesktopSessionState` | 观察屏幕已知、关闭和错误状态 |
| `DesktopSession` | `onScreenSize` | `DesktopScreenSize` | 设置远程画布尺寸 |
| `DesktopSession` | `onDisplayGeometry` | `DesktopDisplayGeometry` | 维护多显示器布局 |
| `DesktopSession` | `onTile` | `DesktopTile` | 绘制远程桌面图像块 |
| `DesktopSession` | `onControlMessage` | `DesktopControlMessage` | 消费 metadata 消息 |
| `DesktopSession` | `onUnknownCommand` | `DesktopProtocolCommand` | 记录尚未支持的桌面命令 |
| `DesktopSession` | `onError` | `DesktopSessionError` | 处理桌面协议错误 |

公开 `on...` 方法均返回 `() => void`，调用后解除对应监听。构造选项中的回调随适配器 `dispose()` 一起停止接收。

## 原始 relay 消息

| API | 输入 | 返回值 | 远端结果如何到达 |
| --- | --- | --- | --- |
| `sendText(text)` | 字符串 | `void` | `onMessage` |
| `sendJson(payload)` | 任意可 JSON 序列化值 | `void` | `onMessage` |
| `sendBinary(data)` | `ArrayBuffer \| ArrayBufferView \| Blob` | `void` | `onMessage` |
| `send(data)` | 字符串或二进制 | `void` | `onMessage` |

原始 API 不做请求 ID 关联，也不等待响应。协议响应可能是文本、JSON 字符串或二进制帧，调用方必须自行解释。

## 终端消息

| 发送者 | 消息 | 作用 | 结果 |
| --- | --- | --- | --- |
| 启动逻辑 | options 文本 JSON | 配置 Shell 协议和初始尺寸 | Agent 创建终端环境 |
| 启动逻辑 | 文本 `"1"` | 选择终端协议 | 开始终端数据交换 |
| `write` | UTF-8 或原始二进制 | 发送命令和按键 | `onData` 收到输出 |
| `resize` | `termsize` JSON | 调整伪终端尺寸 | 远端后续按新尺寸输出 |
| 自动探测 | `rtt` JSON | 测量延迟 | `onLatencyChange` |

## 文件消息

| API 或阶段 | 发送消息 | 等待的响应 | 最终结果 |
| --- | --- | --- | --- |
| `listDirectory` | `ls` | 包含 `dir` 的 JSON | `DirectoryListing` |
| `uploadFile` 开始 | `upload` | `uploadstart` | 开始读源文件 |
| 上传数据块 | 二进制块 | `uploadack` | 更新确认进度并发送下一块 |
| 上传完成 | `uploaddone` | `uploaddone` | `FileUploadResult` |
| 取消上传 | `uploadcancel` | 不等待稳定响应 | Promise 以 `cancelled` 拒绝 |
| `downloadFile` 开始 | `download/start` | download start JSON | 发送 `startack` 并接收二进制 |
| 下载非最终块 | `download/ack` | 下一二进制块 | 持续写入 sink |
| 取消下载 | `download/stop` | 不等待稳定响应 | 调用 `sink.abort` |
| 下载最终块 | 无额外完成请求 | flags 标记最终块 | `sink.close` 和 `FileDownloadResult` |
| `createDirectory` | `mkdir` | 无 | 本地 `FileCommandReceipt` |
| `removeEntries` | `rm` | 无 | 本地 `FileCommandReceipt` |
| `renameEntry` | `rename` | 无 | 本地 `FileCommandReceipt` |
| `copyFiles` | `copy` | 无 | 本地 `FileCommandReceipt` |
| `moveFiles` | `move` | 无 | 本地 `FileCommandReceipt` |
| `createZip` | `zip` | 会话级 `dialogmessage`、`refresh` | 阶段与刷新事件，无可靠结果 |
| `extractZip` | `unzip` | 会话级 `dialogmessage`、`refresh` | 阶段与刷新事件，无可靠结果 |

文件管理控制 JSON 与 `ls` 使用相同的 `RelaySession.sendJson()` 编码和发送路径。无响应命令不会建立等待远端确认的 Promise，也不会占用目录、上传或下载的活动操作槽位。

## 桌面消息

| API | 二进制命令号 | 作用 | 结果观察方式 |
| --- | ---: | --- | --- |
| `sendMouseMove` | 2 | 移动指针 | 后续 `onTile` 图像变化 |
| `sendMouseButton` | 2 | 鼠标按下或抬起 | 后续 `onTile` 图像变化 |
| `sendMouseDoubleClick` | 2 | 鼠标双击 | 后续 `onTile` 图像变化 |
| `sendMouseWheel` | 2 | 滚动 | 后续 `onTile` 图像变化 |
| `sendKey` | 1 | 虚拟键输入 | 后续 `onTile` 图像变化 |
| `sendUnicode` | 85 | Unicode 输入 | 后续 `onTile` 图像变化 |
| `sendCad` | 10 | Ctrl+Alt+Delete | 后续桌面画面或 Agent 行为 |

桌面输入没有协议级 Promise 确认。成功调用只表示消息已交给 ready WebSocket，不代表操作系统已经执行；最终效果取决于设备权限、Agent 和远端会话状态。

## 如何选择层级

- 有 `TerminalSession`、`FilesSession` 或 `DesktopSession` 时，使用协议适配器。
- 只有协议常量但没有适配器时，例如当前的 WebSSH `p=11`，使用原始 `RelaySession` 并在应用层实现协议。
- 需要抓取未知消息或验证上游协议时，可以同时使用创建选项 `onRawMessage` 记录原始数据。
- 不要让协议适配器和应用代码同时消费同一类业务消息，避免重复处理和状态竞争。
