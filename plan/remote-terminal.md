# 远程终端功能实施计划

## 1. 目标与约束

基于现有 `GatewayClient` 控制通道、`@meshcentral/relay` 中继通道和 MeshCentral `p=1` 终端协议，实现可用于生产环境的交互式远程终端。

本计划覆盖：

1. 真实终端中继协议确认和脱敏协议夹具。
2. `TerminalSession` 协议适配层。
3. 基于 xterm.js 的终端渲染、输入、ANSI 转义序列和滚动缓冲区。
4. 终端尺寸同步、中文输入、复制、粘贴、搜索、全屏和快捷键。
5. 连接状态、延迟、录制提示、超时、主动断开和有限重连。
6. 设备工作台和设备列表入口。
7. 有效权限检查、服务端授权和会话审计。
8. 单元测试、集成测试和浏览器端端到端测试。

必须遵守以下约束：

- 不自行实现 ANSI、VT100、VT220 或 xterm 终端仿真器。
- xterm.js 只负责终端渲染和浏览器输入，不直接负责 MeshCentral 中继连接。
- 所有终端数据通过现有 `RelayClient` 和 `RelaySession` 传输，不创建绕过认证流程的独立 WebSocket。
- 前端权限判断只用于菜单、路由和按钮控制，最终授权必须由 MeshCentral 服务端执行。
- 不默认记录完整按键、命令或终端输出，避免审计日志收集密码、令牌和其他敏感信息。
- 断线重连默认创建新的 Shell，不将新会话描述为恢复原会话。
- 未经目标 MeshCentral 版本真实消息确认的控制消息、启动顺序和会话能力不得作为稳定接口实现。

## 2. 非目标与能力边界

本期不实现：

- 浏览器内 SSH 客户端和 `p=11` Web SSH 协议。
- SSH 密钥、跳板机、主机指纹和 SSH 会话管理。
- 跨浏览器、跨设备或跨登录会话恢复同一个远端 Shell。
- 多人共享终端、协同输入和只读旁观模式。
- 终端录像回放、按键审计和完整输出归档。
- 文件上传协议、远程桌面协议或端口转发协议。
- 在浏览器中解析用户输入以判断命令是否危险。
- 无限数量的终端标签、无限滚动缓冲或无限自动重连。

终端与现有远程命令功能用途不同：

- 远程命令用于一次性执行和结果汇总。
- 远程终端用于持续交互式 Shell、全屏终端程序和实时输入输出。
- 不使用远程命令的 `msg/console` 消息模拟交互式终端。

## 3. 已有基础与当前缺口

### 3.1 已有基础

当前仓库已经具备：

- `RelayClient` 可以申请 `authcookie`、通知 Agent 并创建 `meshrelay.ashx` WebSocket。
- `RelayConnection` 已实现连接超时、握手超时、取消、关闭和连接状态转换。
- `RelaySession` 已提供文本、JSON 和二进制收发接口。
- `RELAY_PROTOCOLS.terminal` 和 `terminalRelayProtocol` 已定义 `p=1` 协议描述符。
- 已采集一组目标 Windows 设备的终端 WebSocket 消息，确认握手后存在 `options` 启动配置、RTT 控制消息和二进制终端输出。
- `FilesSession` 已展示协议专用会话与通用中继层分离的实现方式。
- Web 端设备工作台已有“终端”标签和概览页“远程终端”入口。
- 权限定义中已有终端允许位 `0x00000010` 和禁用终端限制位 `0x00000200`。
- 实时事件页面已经能够展示部分 `relaylog` 审计事件。

### 3.2 当前缺口

- `@meshcentral/relay` 没有 `TerminalSession`，终端仍只有协议描述符。
- Windows 样本尚未整理为脱敏协议夹具，Linux、macOS、PowerShell、录制会话和失败场景仍待采集。
- 当前 `RelayConnection` 收到 `c` 或 `cr` 后立即发送协议号，但 Windows 样本和 MeshCentral 上游实现均表明应先发送包含协议及初始尺寸的 `options`，再发送协议号。
- 当前抓包记录将单字符 `"1"` 标记为入站响应，但 MeshCentral 上游客户端将其作为出站协议选择帧；必须复核浏览器开发者工具中的帧方向。
- 没有统一处理字符串、`ArrayBuffer`、`ArrayBufferView` 和 `Blob` 的终端输入流。
- 没有将二进制终端字节流按顺序直接桥接到 xterm.js，也没有定义字符串输出的兼容处理。
- 没有过滤 `ctrlChannel=102938` 的控制消息。
- 没有 xterm.js 依赖、终端 React 组件和终端页面状态管理。
- 设备工作台除概览和远程桌面外仍显示统一占位状态。
- 设备工作台模型没有提供最终有效设备权限。
- 没有终端会话并发限制、审计确认和端到端测试。

## 4. 总体架构

远程终端分为四层：

```text
TerminalPanel / XtermTerminal
  └─ useTerminalSession
       └─ TerminalSession
            └─ RelaySession / RelayConnection
                 └─ GatewayClient + MeshCentral Agent
```

各层职责：

| 层级                 | 主要职责                                       | 不应承担的职责                 |
| -------------------- | ---------------------------------------------- | ------------------------------ |
| xterm.js             | ANSI/VT 渲染、光标、选择、滚动缓冲、浏览器输入 | 中继认证、重连、权限和审计     |
| React 组件           | 工具栏、状态提示、快捷键、容器尺寸和用户交互   | 解析 MeshCentral 控制消息      |
| `useTerminalSession` | 创建和释放会话、连接状态、重连策略、错误映射   | ANSI 解析和底层 WebSocket 握手 |
| `TerminalSession`    | 终端数据流、UTF-8 解码、尺寸消息、控制消息     | React 状态和页面布局           |
| `RelaySession`       | 通用中继传输、握手、关闭和错误事件             | 终端业务语义                   |

## 5. 阶段 0：确认真实终端协议

### 5.0 当前 Windows 样本结论（2026-09-12）

已从目标 Windows 设备采集到以下部分消息序列：

```text
发送 RTT 请求
收到 c
发送 { "protocol": 1, "cols": 154, "rows": 27, "type": "options" }
观察到单字符 "1"
收到相同时间戳的 RTT 消息
收到二进制终端数据
约 10 秒后再次发送 RTT 请求并收到回显
```

当前可以确认：

- WebSocket 打开后、收到 `c` 之前即可发送 RTT 探测。
- `c` 表示中继两端已经配对，不等于 Shell 已经产生首个提示符。
- 初始终端配置使用 `type: "options"`，同时携带 Shell 协议、列数和行数。
- 后续终端输出至少在 Windows 场景中使用二进制 WebSocket 帧。
- RTT 响应保留客户端发送的时间戳，可按 `Date.now() - time` 计算往返延迟。
- `ctrlChannel` 在请求中观察为数字 `102938`，响应中观察为字符串 `"102938"`，解析时必须使用 `String(value) === "102938"` 标准化。
- RTT 探测间隔约为 10 秒，与 MeshCentral 上游客户端实现一致。

当前仍不能确认：

- 抓包中单字符 `"1"` 的真实方向。用户记录将其标记为响应，但 MeshCentral 上游 `agent-redir-ws` 和 `meshctrl` 均在发送 `options` 后由客户端发送协议号。
- 二进制数据是否始终是可直接交给 xterm.js 的 UTF-8/ANSI 字节流，还是某些 Agent 版本存在额外封包头。
- 浏览器键盘输入在目标版本中使用文本帧还是 UTF-8 二进制帧。
- `cr`、`ping`、`pong`、主动关闭和权限失败的目标版本行为。

实现以已确认事实为基础，并将帧方向、输入编码和其他平台行为保留为阶段 0 的阻断检查。

### 5.1 必须采集的场景

使用目标 MeshCentral 版本的原生 Web 终端执行并记录以下场景：

1. 在线 Windows 设备成功连接 CMD 或 PowerShell。
2. 在线 Linux 或 macOS 设备成功连接默认 Shell。
3. Agent 离线时请求终端。
4. 当前用户没有终端权限时请求终端。
5. 设备设置了“禁用终端”限制时请求终端。
6. 中继返回握手消息 `c`。
7. 中继返回握手消息 `cr`，确认其录制语义。
8. 首次连接时发送终端尺寸。
9. 浏览器窗口变化后发送新的终端尺寸。
10. 普通文本输出和二进制输出。
11. `ping`、`pong`、`rtt`、`options`、`termsize` 等控制消息。
12. 服务端主动关闭、Agent 断线、网关断线和用户主动断开。
13. 运行 `vim`、`top` 或其他全屏程序并调整终端尺寸。
14. 输入中文、粘贴多行文本以及发送 `Ctrl+C`。

### 5.2 已确认的启动消息结构

Windows 样本和 MeshCentral 上游实现共同支持以下启动顺序：

```text
WebSocket open
  → 可选 RTT 请求
  → 等待 c 或 cr
  → 发送 options（Shell 协议 + 初始 cols/rows）
  → 发送 Shell 协议号（目标普通 Windows 终端为 "1"）
  → 进入端到端连接状态
  → 接收二进制终端输出
```

初始配置样本：

```json
{
  "protocol": 1,
  "cols": 154,
  "rows": 27,
  "type": "options"
}
```

需要区分三个概念：

- 中继 URL 中的 `p=1` 表示建立终端类型的中继。
- `options.protocol=1` 表示要求 Agent 使用普通终端 Shell。
- 紧随 `options` 的单字符协议号用于启动或选择对应终端协议。

当前抓包对单字符 `"1"` 的方向标记与上游实现存在冲突。必须通过浏览器开发者工具箭头、原始抓包或客户端发送日志确认方向；在确认前，实现应按上游已验证顺序设计可配置的启动消息队列，不把入站 `"1"` 当作普通终端输出。

当前 `RelayConnection` 在收到 `c/cr` 后自动发送 `String(protocol)` 并立即进入 `ready`，无法在协议号前插入 `options`。应增加协议专用启动扩展点，例如由调用方提供有序启动帧：

```ts
createStartupMessages: () => [
  JSON.stringify({ type: 'options', protocol: shellProtocol, cols, rows }),
  String(shellProtocol),
];
```

只有启动帧全部发送成功后才进入 `ready`。不得在 `TerminalSession` 构造后补发 `options`，否则顺序会变为 `c/cr → 协议号 → options`；也不得再次补发协议号。

### 5.3 控制消息确认

至少确认以下控制消息的方向、字段和响应要求：

| 类型         | 候选用途                    | 实现要求                                       |
| ------------ | --------------------------- | ---------------------------------------------- |
| `termsize`   | 客户端通知 Agent 后续行列数 | 确认目标版本消息方向和尺寸边界                 |
| `options`    | 初始 Shell 协议和终端尺寸   | Windows 样本已确认，必须先于协议号发送         |
| `ping`       | 保活请求                    | 确认是否需要返回 `pong`                        |
| `pong`       | 保活响应                    | 更新最后活动时间                               |
| `rtt`        | 延迟探测                    | 已确认时间戳回显和约 10 秒周期，不写入终端输出 |
| `metadata`   | 会话或录制元数据            | 只展示已确认字段                               |
| `disconnect` | 远端请求断开                | 转换为明确结束原因                             |

只有满足以下条件的文本才按控制消息处理：

- 可以解析为 JSON 对象。
- `ctrlChannel` 标准化后等于字符串 `"102938"`。
- `type` 是已确认的控制消息类型。

RTT 实现还必须确认响应时间戳由本客户端发出，并限制同时等待的探测数量。RTT 超时只将延迟状态标记为不可用，不直接关闭仍有终端数据活动的会话。

其他 JSON 外观文本必须作为普通终端输出，不能因为以 `{` 开头就被过滤。

### 5.4 协议夹具

新增脱敏夹具目录：

```text
packages/relay/src/testing/fixtures/terminal/
  handshake-connected.json
  handshake-recorded.json
  windows-startup-options.json
  protocol-selection.json
  resize.json
  rtt-request.json
  rtt-response.json
  ping.json
  pong.json
  disconnect.json
  binary-output.bin
  binary-input.bin
  utf8-split.json
```

夹具不得包含真实设备 ID、用户名、IP、认证 Cookie、中继 ID、命令历史、终端输出中的凭据或其他可识别信息。

阶段 0 完成标准：确认启动顺序、数据编码、控制消息、关闭原因和权限失败行为，并为无法确认的能力明确“不实现或降级处理”的结论。

## 6. 终端协议适配层

### 6.1 文件结构

建议扩展：

```text
packages/relay/src/protocols/terminal/
  TerminalSession.ts
  TerminalSession.test.ts
  controlMessages.ts
  controlMessages.test.ts
  types.ts
  index.ts
```

并从 `packages/relay/src/index.ts` 导出公开类型和 `TerminalSession`。

### 6.2 公开接口

建议接口：

```ts
export type TerminalSessionState = 'configuring' | 'ready' | 'closed' | 'error';

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface TerminalSessionOptions {
  shellProtocol: number;
  initialSize: TerminalSize;
  maxPendingOutputBytes?: number;
  onControlMessage?: (message: TerminalControlMessage) => void;
}

export class TerminalSession {
  readonly relay: RelaySession;
  readonly state: TerminalSessionState;
  readonly recorded: boolean;

  onData(listener: (data: string | Uint8Array) => void): () => void;
  onStateChange(listener: (state: TerminalSessionState) => void): () => void;
  onLatencyChange(listener: (latencyMs: number) => void): () => void;
  write(data: string | Uint8Array): void;
  resize(size: TerminalSize): void;
  close(code?: number, reason?: string): void;
  dispose(): void;
}
```

最终接口以实际协议样本和仓库既有事件风格为准，不强制照搬以上命名。

### 6.3 构造检查

终端的 `options` 必须在通用中继进入 `ready` 前发送，因此初始 Shell 协议和尺寸应参与 `RelayClient.createSession()` 的启动配置，而不是等 `TerminalSession` 构造后才提供。`TerminalSession` 构造时必须检查：

- `relay.protocol === RELAY_PROTOCOLS.terminal`。
- `relay.state === "ready"`。
- 会话尚未被关闭或释放。

不满足条件时抛出带稳定错误码的 `TerminalSessionError`，至少区分：

- `protocol`
- `connection-lost`
- `cancelled`
- `invalid-size`
- `output-overflow`
- `unsupported-message`

### 6.4 输入输出处理

输入规则：

- xterm.js `onData` 返回的字符串不自动附加 `\r` 或 `\n`。
- 阶段 0 必须确认目标版本键盘输入使用文本帧还是 UTF-8 二进制帧；若与上游客户端一致，应使用持久化 `TextEncoder` 转为 `Uint8Array` 并通过二进制帧发送。
- 控制消息始终使用 WebSocket 文本帧，键盘输入不得与 `options`、`termsize`、`rtt` 等控制消息共用解析路径。
- 不解析用户命令，不在协议层保存输入历史。
- 连接非 `ready` 状态时拒绝写入并返回明确错误。
- 可增加短时输入队列上限，但不得在重连后自动重放按键。

输出规则：

- `c`、`cr`、已确认的控制 JSON 和启动状态帧不得进入终端输出。
- Windows 样本确认终端输出为二进制帧；优先转换为 `Uint8Array` 后直接交给 xterm.js，让其处理 UTF-8 和 ANSI 字节流。
- `ArrayBufferView` 必须尊重 `byteOffset` 和 `byteLength`，不能错误发送整个底层 buffer。
- `Blob` 异步转换为 `ArrayBuffer` 后按接收顺序发布为 `Uint8Array`。
- 如果目标 Agent 版本返回普通字符串终端输出，则作为兼容路径直接交给 xterm.js。
- 只有当 Web 层无法直接消费二进制字节时才使用持久化 `TextDecoder` 和 `{ stream: true }`，不得逐帧创建解码器。
- 所有异步转换通过串行队列处理，不能让较晚的 Blob 输出先于较早消息显示。

### 6.5 输出背压和内存限制

终端高速输出可能快于 React 和 xterm.js 渲染速度。实现中需要：

- 维护待写入 xterm.js 的字节数或字符数。
- 对输出进行批量刷新，避免每个小帧触发一次 React 更新。
- 输出内容不进入 React state，直接写入 xterm.js。
- 设置待处理输出上限；超限时主动断开并显示“输出过快，会话已结束”。
- xterm.js `scrollback` 默认建议为 `10,000` 行，并设置产品级最大值。
- 不把完整终端缓冲复制到全局 store、日志或错误上报系统。

### 6.6 尺寸同步

`resize({ cols, rows })` 必须：

- 只接受有限正整数。
- 设置合理范围，例如 `2–500` 列、`1–200` 行，最终范围通过兼容测试确定。
- 与上一次尺寸相同时不重复发送。
- 按阶段 0 确认的格式发送 `termsize` 控制消息。
- 连接断开后不缓存并在新会话中自动重放旧尺寸；新会话应使用当前 xterm 实际尺寸。

候选消息：

```json
{
  "ctrlChannel": "102938",
  "type": "termsize",
  "cols": 120,
  "rows": 30
}
```

### 6.7 生命周期

- `dispose()` 移除协议监听器和定时器，但不强制关闭底层中继。
- `close()` 移除监听器并主动关闭底层中继。
- 中继 `error` 或意外 `close` 必须使终端会话进入终态。
- 终态后不得继续发送输入或尺寸消息。
- 用户主动断开、连接失败、超时、网关断开、Agent 断开和权限拒绝应映射为不同的 UI 原因。

## 7. xterm.js 组件选型

### 7.1 基础依赖

Web 应用增加：

```text
@xterm/xterm
@xterm/addon-fit
@xterm/addon-search
```

用途：

- `@xterm/xterm`：ANSI/VT 渲染、终端缓冲、光标、选择、键盘和输入法。
- `@xterm/addon-fit`：根据容器尺寸计算终端列数和行数。
- `@xterm/addon-search`：在当前终端缓冲区中搜索。

后续可选依赖：

- `@xterm/addon-web-links`：需要安全确认交互后再启用。
- `@xterm/addon-webgl`：仅在性能测试证明 Canvas 渲染不足时动态加载，并提供回退。
- `@xterm/addon-unicode11` 或官方后续 Unicode 插件：经过中日韩字符宽度兼容测试后启用。

不使用 `@xterm/addon-attach`，因为它会将 xterm.js 直接绑定 WebSocket，无法表达现有认证、Agent 通知、协议握手和错误模型。

### 7.2 React 组件结构

建议新增：

```text
apps/web/src/components/device-workspace/terminal/
  TerminalPanel.tsx
  XtermTerminal.tsx
  TerminalToolbar.tsx
  TerminalStatusBar.tsx
  TerminalPasteConfirmModal.tsx
  MobileTerminalKeys.tsx

apps/web/src/features/terminal/
  useTerminalSession.ts
  terminalErrors.ts
  terminalShortcuts.ts
  types.ts
```

组件职责：

- `TerminalPanel`：组合工具栏、终端、状态栏和断线覆盖层。
- `XtermTerminal`：创建和释放 xterm 实例，桥接输入输出和尺寸事件。
- `TerminalToolbar`：连接、断开、搜索、复制、粘贴、清屏和全屏。
- `TerminalStatusBar`：状态、会话时长、延迟、尺寸和录制提示。
- `TerminalPasteConfirmModal`：多行或高风险形态粘贴确认。
- `MobileTerminalKeys`：移动端 `Ctrl`、`Alt`、`Esc`、`Tab` 和方向键。
- `useTerminalSession`：创建 `RelayClient`、`RelaySession` 和 `TerminalSession`，管理连接状态和重连。

### 7.3 xterm 实例生命周期

- xterm 实例保存在 `useRef`，每次组件挂载只创建一次。
- 引入 `@xterm/xterm/css/xterm.css`，再使用项目样式覆盖外围布局。
- xterm 输出直接调用 `terminal.write()`，不通过 JSX 渲染终端文本。
- 使用 `ResizeObserver` 观察容器变化。
- 容器变化后调用 `FitAddon.fit()`，再读取最终 `cols` 和 `rows`。
- 尺寸上报使用约 `100–200ms` 防抖，首个稳定尺寸应立即或尽快发送。
- 组件卸载时释放 xterm、插件、Observer、事件订阅、计时器和会话。
- 切换标签是否保持会话必须由页面策略明确，不能由组件偶然的挂载行为决定。

### 7.4 推荐终端配置

初始建议：

```ts
{
  cursorBlink: true,
  cursorStyle: 'block',
  convertEol: false,
  disableStdin: false,
  scrollback: 10_000,
  screenReaderMode: false,
  minimumContrastRatio: 4.5,
  allowProposedApi: false,
}
```

说明：

- `convertEol` 保持关闭，由远端 PTY 决定换行语义。
- 默认不启用 proposed API，避免依赖不稳定接口。
- 屏幕阅读器模式应作为可访问性设置或按检测结果开启，并进行性能测试。
- 字体使用清晰的等宽字体回退链，不从不可信终端输出加载字体。

## 8. 页面与交互设计

### 8.1 设备工作台接入

修改设备工作台渲染逻辑：

- `activeTab === "terminal"` 时渲染 `TerminalPanel`。
- 从概览页“远程终端”按钮进入终端标签。
- 设备离线时显示离线状态，不发起中继连接。
- 无权限时显示无权限状态，不仅隐藏连接按钮。
- 网关未连接时显示网关断开和重试入口。
- 页面离开或设备 ID 改变时结束当前终端会话。

设备列表和远程管理菜单增加终端入口时，应导航到设备工作台并选择终端标签。建议将当前标签同步到 URL，例如：

```text
/devices/:deviceId?tab=terminal
```

这样可以支持刷新、复制链接和浏览器前进后退，同时不能在 URL 中包含认证信息或中继 Cookie。

### 8.2 连接状态

页面至少展示：

| 状态           | UI 行为                           |
| -------------- | --------------------------------- |
| 未连接         | 显示“连接终端”按钮                |
| 正在授权       | 禁止重复连接，允许取消            |
| 正在通知 Agent | 显示具体阶段                      |
| 正在连接       | 显示中继连接状态和超时进度        |
| 等待中继配对   | 等待 `c/cr`，禁止输入             |
| 正在配置终端   | 发送 `options` 和协议号，禁止输入 |
| 已连接         | 启用输入、尺寸同步和工具栏        |
| 主动断开       | 保留缓冲，允许新建会话            |
| 意外断开       | 保留缓冲，显示原因和重连按钮      |
| 权限不足       | 不自动重试，提示联系管理员        |
| 会话过期       | 立即禁止输入并触发现有退出流程    |

终端缓冲保留只发生在当前页面内存中。新建会话时可以选择清空或插入明显分隔线，但不得将旧输出发送给新会话。

### 8.3 重连策略

第一阶段优先提供手动重连。自动重连只在协议和产品语义确认后增加：

- 只对临时网络错误自动重连。
- 权限拒绝、认证失败、会话过期和用户主动断开不自动重连。
- 最多尝试有限次数，例如 3 次。
- 使用指数退避和随机抖动。
- 页面隐藏或浏览器离线时暂停重连。
- 重连成功后插入“已建立新的终端会话”分隔提示。
- 不重放断线期间输入、尺寸之外的命令或剪贴板内容。

### 8.4 复制、粘贴和快捷键

复制规则：

- 有选区时 `Ctrl+C` 复制选中文本。
- 无选区时 `Ctrl+C` 发送终止字符给远端。
- `Ctrl+Shift+C` 始终执行复制。
- 提供工具栏复制按钮，Clipboard API 失败时显示明确错误。

粘贴规则：

- `Ctrl+V`、`Ctrl+Shift+V` 和工具栏按钮使用统一粘贴流程。
- 多行文本、长度超过阈值或包含不可见控制字符时要求确认。
- 确认弹窗显示字符数、行数和经过截断或脱敏的预览。
- 不把粘贴内容写入操作日志、错误日志或最近命令历史。
- 保留 xterm.js bracketed paste 行为，避免破坏支持该模式的 Shell。
- Clipboard API 因 HTTPS 或权限失败时给出浏览器能力提示。

其他快捷键：

- `Ctrl+Shift+F`：打开终端搜索。
- `Escape`：关闭搜索面板，不发送到远端；搜索关闭后再发送普通 Escape。
- `Ctrl+L`：默认发送给远端，不将其实现为本地清屏。
- 工具栏“清屏”只清除本地显示，不向远端执行命令。
- 浏览器保留的 `Ctrl+W`、`Ctrl+T` 和 `Ctrl+N` 不承诺完全拦截。

### 8.5 全屏与移动端

- 使用 Fullscreen API 将终端容器进入全屏，而不是仅放大 CSS。
- 全屏进入和退出后重新 `fit()` 并同步尺寸。
- 移动端工具栏使用图标和溢出菜单，避免压缩终端宽度。
- 提供可收起的辅助键栏：`Ctrl`、`Alt`、`Esc`、`Tab`、方向键和常用组合键。
- 处理软键盘弹出导致的可视区域变化，并重新计算终端高度。
- 验证中文、日文等输入法组合事件，组合完成前不得发送半成品文本。

## 9. 权限与安全

### 9.1 有效权限计算

终端入口必须同时考虑：

- 用户对设备或设备分组拥有终端允许权限 `MESHRIGHT_AGENTCONSOLE = 0x00000010`。
- 最终权限没有“禁用终端”限制 `MESHRIGHT_NOTERMINAL = 0x00000200`。
- 全站管理员 `0xffffffff` 的语义需要特殊处理，不能因为所有位均为 1 而误判为受所有限制。
- 用户直接授权、用户组继承授权、设备分组授权和单设备直接授权的最终合并规则。

在权限模块中新增能力级函数，而不是让页面直接进行位运算，例如：

```ts
canUseTerminal(effectiveRights: number): boolean;
```

在最终权限数据尚未接入设备工作台前：

- 不将前端判断描述为可信授权。
- 仍允许服务端返回权限拒绝并正确展示。
- 不通过隐藏标签掩盖服务端权限模型缺失。

### 9.2 服务端安全要求

- 服务端必须验证当前会话、目标设备和终端权限。
- 中继 Cookie 必须短期有效并绑定适当上下文。
- 浏览器不得持久化 `cookie`、`rcookie` 或中继 URL。
- 错误消息、分析事件和前端日志不得包含认证 Cookie。
- 会话过期或退出登录时关闭所有活动中继。
- 限制每用户、每设备和系统全局终端会话数量。
- 对重复连接、快速重连和异常输入速率进行限制。
- 使用 `wss://`；生产环境不得允许终端凭据通过不安全传输。

### 9.3 终端内容安全

- 终端输出只能交给 xterm.js 渲染，不使用 `dangerouslySetInnerHTML`。
- Web 链接默认不自动打开，必须由用户点击并经过协议和目标确认。
- 链接只允许经过验证的 `http:` 和 `https:` 等协议，禁止 `javascript:`。
- 不从终端输出解析或执行 HTML、脚本、图片地址和下载指令。
- 多行粘贴必须避免误操作，但前端不尝试充当 Shell 安全分析器。
- 前端监控只记录错误类别和性能指标，不记录终端内容。

## 10. 审计与录制提示

### 10.1 审计字段

会话审计至少包含：

- 当前用户 ID。
- 设备 ID 和设备分组 ID。
- 中继会话 ID 或服务端可关联 ID。
- 协议号 `1`。
- 开始时间和结束时间。
- 结束原因和最终状态。
- 输入、输出字节数。
- 服务端看到的客户端地址。
- 是否由服务端录制。

默认不记录：

- 完整按键。
- 命令文本。
- 终端输出。
- 剪贴板内容。
- 认证 Cookie 和中继 URL。

如果未来业务要求内容审计或录像，必须单独设计访问控制、加密、保留周期、检索审计和用户告知，不能作为本期终端功能的隐式副作用。

### 10.2 录制状态

- 收到握手 `cr` 时，在连接建立前后持续显示“此会话正在由服务端录制”。
- 录制提示不能只是短暂 toast，应在状态栏保持可见。
- 客户端不能提供关闭服务端录制的伪按钮。
- 如果录制状态在连接期间变化，只依据已确认控制消息更新。

### 10.3 事件页面接入

验证 `relaylog` 是否为终端会话提供：

- `protocol: 1`
- `nodeid`
- 开始或结束时间
- `bytesin`
- `bytesout`
- 结束原因或持续时间

实时事件页面可以展示已确认字段，但不能根据字节数推断命令内容或执行结果。

## 11. 错误模型

建议将底层错误映射为稳定的应用错误：

| 错误     | 用户提示                       | 是否可重试       |
| -------- | ------------------------------ | ---------------- |
| 认证失败 | 登录状态无效或无法申请中继授权 | 重新登录后可重试 |
| 权限不足 | 当前账户没有终端权限           | 否               |
| 设备离线 | 设备当前离线                   | 设备上线后可重试 |
| 网关断开 | 控制通道不可用                 | 网关恢复后可重试 |
| 连接超时 | 无法建立终端中继               | 是               |
| 握手失败 | Agent 或服务端终端协议不兼容   | 谨慎重试         |
| 输出过载 | 终端输出过快，会话已结束       | 手动重试         |
| 用户取消 | 已取消连接或结束会话           | 是               |
| 会话过期 | 登录会话已过期                 | 重新登录         |
| 意外断开 | 终端连接已中断                 | 是               |

错误详情用于诊断时必须脱敏，不显示认证 Cookie、完整 WebSocket URL 或原始服务端堆栈。

## 12. 测试计划

### 12.1 `@meshcentral/relay` 单元测试

覆盖：

1. 非 `p=1` 中继拒绝创建 `TerminalSession`。
2. 非 `ready` 中继拒绝创建会话。
3. `c/cr` 后按顺序发送 `options` 和 Shell 协议号。
4. `options` 包含 Shell 协议和初始 `cols/rows`。
5. `ArrayBuffer` 和各种 `ArrayBufferView` 正确转换为 `Uint8Array`，并保留视图边界。
6. `Blob` 异步转换保持消息顺序。
7. 二进制输出直接交给 xterm.js 时不会被错误转换为文本。
8. 字符串终端输出作为兼容路径原样发布。
9. 如果使用文本解码兼容路径，一个中文字符跨两个帧时不会产生替换字符。
10. 普通 JSON 文本不会被错误过滤。
11. 已确认控制消息被识别且不进入终端输出。
12. 数字和字符串形式的 `ctrlChannel` 均能识别。
13. RTT 请求、匹配响应、超时和未知时间戳处理正确。
14. 未知控制类型采用明确的兼容策略。
15. `termsize` 字段、去重和边界校验正确。
16. 输入按目标版本确认的帧类型发送且不自动附加换行。
17. 关闭后禁止输入和尺寸同步。
18. 中继错误和关闭转换为终端会话终态。
19. `dispose()` 不关闭中继，`close()` 会关闭中继。
20. 待处理输出超过上限时按设计结束会话。

### 12.2 Web 组件测试

覆盖：

- 设备离线、网关断开、无权限和连接超时状态。
- 点击连接只创建一个会话。
- 连接中可以取消，已连接可以主动断开。
- xterm 输入转发到 `TerminalSession.write()`。
- 输出直接写入 xterm，不进入 React state。
- 容器变化后调用 `fit()` 并防抖发送最终尺寸。
- 多行粘贴触发确认，取消后不发送。
- 有选区和无选区时 `Ctrl+C` 行为不同。
- 搜索、清屏和全屏按钮具备可访问名称。
- 录制状态持续可见。
- 页面卸载、设备切换和退出登录释放会话。
- 手动重连创建新会话且不重放输入。

测试中可将 xterm.js 包装在薄适配器后进行 mock，避免测试依赖真实 Canvas 布局。

### 12.3 浏览器端端到端测试

使用真实浏览器和可控中继夹具覆盖：

1. 从设备列表进入终端。
2. 连接后显示 Shell 提示符。
3. 输入命令并验证键盘数据使用目标版本要求的文本或二进制帧。
4. 显示来自二进制帧的 ANSI 彩色输出。
5. 运行全屏程序并发送方向键、Escape 和 `Ctrl+C`。
6. 调整窗口尺寸并验证远端收到新行列数。
7. 复制选区和粘贴单行文本。
8. 粘贴多行文本时出现确认。
9. 中文输入和跨帧中文输出无乱码。
10. 远端断开后保留缓冲并允许新建会话。
11. `cr` 握手显示录制提示。
12. 无权限用户不能建立终端，但仍收到可信服务端拒绝。
13. 桌面、平板和移动尺寸下工具栏、终端和软键盘区域不重叠。

### 12.4 真实设备兼容矩阵

至少验证：

| 平台    | Shell             | 场景                             |
| ------- | ----------------- | -------------------------------- |
| Windows | CMD               | 中文、方向键、`Ctrl+C`、窗口调整 |
| Windows | PowerShell        | ANSI 色彩、长输出、复制粘贴      |
| Linux   | bash 或默认 Shell | `vim`、`top`、`less`、`tmux`     |
| macOS   | zsh 或默认 Shell  | Unicode、全屏程序、窗口调整      |

如果 Agent 仅提供默认 Shell 而不支持选择 Shell，UI 不展示无效的 Shell 选择器。

## 13. 分阶段实施

### 阶段 0：协议采样

- 将已采集的 Windows `c → options → 协议号 → 二进制输出` 序列整理为脱敏夹具。
- 复核单字符协议号的真实帧方向。
- 采集键盘输入帧类型、后续 `termsize`、主动关闭和 `cr`。
- 继续确认 Linux、macOS、PowerShell、权限失败和断线行为。

完成标准：协议夹具和兼容结论进入仓库，所有未知字段均有明确处理策略。

### 阶段 1：最小协议层

- 实现 `TerminalSession`。
- 实现流式 UTF-8 解码和控制消息过滤。
- 实现输入、尺寸、关闭和错误事件。
- 完成协议层单元测试。

完成标准：使用 fake relay 可以稳定完成输入、输出、尺寸和断线测试。

### 阶段 2：最小可用终端 UI

- 安装 xterm.js、FitAddon 和 SearchAddon。
- 实现终端 React 组件和基本工具栏。
- 接入设备工作台终端标签。
- 支持连接、输入、输出、尺寸同步和主动断开。
- 支持加载、错误、离线和网关断开状态。

完成标准：可在目标 Windows 和 Linux 设备上执行交互式命令，并运行至少一个全屏程序。

### 阶段 3：生产交互完善

- 增加复制、粘贴确认、搜索、清屏和全屏。
- 增加状态栏、延迟、会话时长和录制提示。
- 增加移动辅助键和响应式布局。
- 增加输出上限、滚动缓冲上限和输入保护。

完成标准：桌面和移动端核心操作可用，中文、IME 和大量输出测试通过。

### 阶段 4：权限、审计和重连

- 接入最终有效权限计算。
- 验证服务端权限拒绝和 `relaylog`。
- 退出登录和会话过期时统一关闭中继。
- 增加手动重连；确认需求后增加有限自动重连。
- 增加会话并发限制和审计展示。

完成标准：权限、审计、结束原因和重连语义均由真实服务端行为验证。

### 阶段 5：端到端和兼容性验收

- 完成浏览器端端到端测试。
- 完成平台和 Shell 兼容矩阵。
- 完成性能、长连接、断网和安全测试。
- 更新用户文档、运维文档和未完成功能清单。

完成标准：满足第 15 节的功能完成定义。

## 14. 建议变更文件

协议层：

```text
packages/relay/src/protocols/terminal/TerminalSession.ts
packages/relay/src/protocols/terminal/TerminalSession.test.ts
packages/relay/src/protocols/terminal/controlMessages.ts
packages/relay/src/protocols/terminal/controlMessages.test.ts
packages/relay/src/protocols/terminal/types.ts
packages/relay/src/protocols/terminal/index.ts
packages/relay/src/index.ts
packages/relay/README.md
```

Web 层：

```text
apps/web/src/components/device-workspace/terminal/TerminalPanel.tsx
apps/web/src/components/device-workspace/terminal/XtermTerminal.tsx
apps/web/src/components/device-workspace/terminal/TerminalToolbar.tsx
apps/web/src/components/device-workspace/terminal/TerminalStatusBar.tsx
apps/web/src/components/device-workspace/terminal/TerminalPasteConfirmModal.tsx
apps/web/src/components/device-workspace/terminal/MobileTerminalKeys.tsx
apps/web/src/features/terminal/useTerminalSession.ts
apps/web/src/features/terminal/terminalErrors.ts
apps/web/src/features/terminal/terminalShortcuts.ts
apps/web/src/pages/DeviceWorkspacePage.tsx
apps/web/src/assets/styles/device-workspace.css
apps/web/src/assets/styles/responsive.css
apps/web/package.json
```

权限、路由和文档的最终文件位置应在实现时依照现有模块归属确定，不为了匹配本计划强行新增重复抽象。

## 15. 功能完成定义

远程终端标记为完成前，至少满足：

- 已保存目标 MeshCentral 版本的脱敏协议夹具。
- 已确认并实现 `c/cr → options → Shell 协议号` 的启动顺序。
- 已确认目标版本键盘输入帧类型和二进制输出格式。
- `TerminalSession` 已实现并具有稳定错误模型。
- 字符串、二进制、Blob 和跨帧 UTF-8 输出均正确处理。
- 控制消息不会显示为终端文本，普通 JSON 输出不会被误过滤。
- xterm.js 已完成 ANSI、滚动缓冲、输入、搜索和尺寸同步。
- 复制、粘贴、多行确认、快捷键和全屏可用。
- 中文、宽字符、IME 和至少一个全屏程序通过真实设备测试。
- 设备离线、网关断开、无权限、超时、断线和主动断开均有明确状态。
- `cr` 或其他已确认录制信号会产生持续可见提示。
- 前端有效权限判断和 MeshCentral 服务端权限校验均已验证。
- 会话开始、结束、字节数和结束原因具有可查询审计依据。
- 退出登录和会话过期会关闭全部终端中继。
- 输出缓冲、重连次数和并发会话均有上限。
- 已覆盖协议层单元测试、Web 组件测试和核心端到端测试。
- 已通过 `pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm build`。
- `docs/03-remote-control.md`、`packages/relay/README.md` 和 `todo/README.md` 已同步更新。

## 16. 风险与决策记录

### 16.1 协议启动顺序风险

Windows 样本和 MeshCentral 上游实现均要求在协议号前发送包含初始尺寸的 `options`。通用中继当前自动发送协议号，因此必须调整握手扩展点。重复发送协议号、在协议号后补发 `options` 或过早进入 `ready` 都属于协议实现错误，不能通过 UI 重试掩盖。

### 16.2 UTF-8 和消息顺序风险

终端输出可能被拆成任意帧，并混合字符串、二进制和 Blob。优先将有序 `Uint8Array` 直接交给 xterm.js；如果兼容路径必须转成字符串，每条消息独立 `TextDecoder.decode()` 会导致中文乱码。异步 Blob 转换也会导致输出乱序，因此必须使用串行处理队列。

### 16.3 重连语义风险

MeshCentral 中继断开后通常无法重新附着原 Shell。产品文案和代码状态都应使用“新建会话”，除非未来获得真实的可恢复会话协议。

### 16.4 权限位风险

全站管理员 `0xffffffff` 同时包含普通允许位和限制位。直接使用通用 `hasMeshRight()` 检查限制位会把管理员误判为禁止终端，必须通过能力级权限函数表达最终语义。

### 16.5 浏览器剪贴板风险

Clipboard API 依赖安全上下文和用户授权。实现必须提供错误反馈，并将多行粘贴确认作为防误操作措施，而不是承诺阻止所有危险命令。

### 16.6 审计隐私风险

完整终端内容很容易包含密码、访问令牌和个人数据。本期只记录会话元数据；任何内容级审计必须经过独立安全和隐私设计。

## 17. 待办清单映射

本计划完成后，`todo/README.md` 中远程终端条目按以下标准更新：

| 待办项                             | 完成依据                                    |
| ---------------------------------- | ------------------------------------------- |
| 终端中继会话协议处理               | `TerminalSession`、真实夹具和协议测试       |
| 终端 UI、输入输出、ANSI 和滚动缓冲 | xterm.js 组件和真实 Shell 验收              |
| 终端尺寸同步                       | FitAddon、ResizeObserver 和 `termsize` 测试 |
| 复制、粘贴和快捷键                 | 组件测试及浏览器端端到端测试                |
| 状态、重连、断开和超时             | 生命周期状态机、错误映射和重连测试          |
| 权限检查和审计                     | 有效权限函数、服务端拒绝和 `relaylog` 验证  |
| 设备列表和远程管理入口             | URL 可恢复的设备工作台终端标签              |

任何一项只有 UI 演示、未经确认的协议实现或仅前端权限隐藏时，状态最多标记为 `[~]`，不能标记为 `[x]`。
