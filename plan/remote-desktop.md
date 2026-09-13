# 远程桌面功能实施计划

## 1. 目标与边界

基于现有 `GatewayClient`、`@meshcentral/relay` 和设备工作台，实现 MeshCentral `p=2` 远程桌面。

本计划分为两个交付层级：

1. **已确认基线**：连接、桌面协议解析、首屏和增量图块渲染、连接状态、主动断开。
2. **逐项验证后开放**：鼠标、键盘、滚轮、剪贴板、画质、暂停、显示器、输入锁、录制和重连。

实现必须遵守以下原则：

- 复用 `RelayClient` 和 `RelaySession`，不绕过现有认证、Agent tunnel 和 Relay 握手流程。
- 桌面协议语义放在独立 `DesktopSession`，不写入通用 `RelaySession`。
- 二进制命令按字节流解析，不能假设一条 WebSocket 应用消息只包含一个完整命令。
- 图块按接收顺序解码和绘制，不能因图片异步解码而重排。
- 前端权限只控制交互入口，MeshCentral 服务端仍负责最终授权。
- 未经真实样本确认的命令只保留为未知消息，不为其建立稳定业务 API。
- 自动重连创建新的桌面会话，不宣称恢复原会话。
- 不记录桌面图像、键盘输入或剪贴板内容到普通应用日志。

首期不实现：

- WebRTC/DataChannel 桌面传输。
- RDP、Intel AMT KVM 或其他非 Mesh Agent `p=2` 路径。
- 多人共享控制和会话回放。
- 在浏览器中自行实现 JPEG、PNG 或 WebP 解码器。
- 未采集确认的命令 `18`、`88` 业务功能。

## 2. 已确认的协议事实

以下事实来自 `connection-basic` 实际采集，可以作为首期实现依据。

### 2.1 建链顺序

```text
Gateway WebSocket 认证
  -> 查询并确认设备在线
  -> authcookie
  -> Agent tunnel: action=msg, type=tunnel, usage=2
  -> tunnel result=OK
  -> Relay WebSocket p=2
  -> Relay 文本握手 c
  -> Browser 发送文本 "2"
  -> metadata
  -> 屏幕尺寸和显示器信息
  -> JPEG 图块
  -> desktop-ready
```

当前环境只发送文本协议号 `"2"` 即可获得首屏，不需要额外发送刷新命令 `6`、恢复命令 `8` 或编码参数命令 `5`。

状态语义必须区分：

| 状态             | 含义                         |
| ---------------- | ---------------------------- |
| `route-accepted` | Agent tunnel 请求返回 `OK`   |
| `relay-ready`    | 收到 `c/cr` 并完成协议号发送 |
| `screen-known`   | 已收到有效命令 `7`           |
| `desktop-ready`  | 已绘制足以覆盖当前桌面的图块 |

`c` 表示 Relay 已连接且本次未录制；`cr` 仅表示 Relay 录制开启。两者都不表示用户同意或首屏形成。

### 2.2 二进制命令

普通命令头：

```text
command: u16 big-endian
size:    u16 big-endian
```

已确认命令：

| 命令 | 已确认结构                                                 | 首期处理                         |
| ---: | ---------------------------------------------------------- | -------------------------------- |
|  `3` | `x:u16@4`、`y:u16@6`、图像负载 `@8`                        | 解码并按坐标绘制图块             |
|  `7` | `width:u16@4`、`height:u16@6`，总长 `8`                    | 设置远端屏幕和 Canvas 尺寸       |
| `11` | 本次收到总长 `8` 的显示器响应                              | 保存原始字段，完整语义待多屏样本 |
| `27` | 总长 `8` 的 jumbo 外包头，内部长度取偏移 `5..7` 的低 24 位 | 解包后交回普通命令处理           |
| `82` | 单屏样本为 `id/x/y/width/height`，总长 `14`                | 发布显示器几何信息               |

本次还收到命令 `18` 和 `88`，但语义未确认。实现只能通过 `onUnknownCommand` 或诊断事件报告命令号、长度和值摘要，不执行状态变更。

### 2.3 首屏样本

已确认首屏：

- 协议屏幕尺寸：`1920 x 1200`。
- 首屏由一个命令 `27` jumbo 外包的命令 `3` JPEG 图块形成。
- 图块坐标为 `(0, 0)`。
- JPEG 编码尺寸为 `1920 x 1216`。
- 超出协议屏幕高度的 `16` 像素由 Canvas 自然裁剪。

因此：

- 图块尺寸必须从实际图像解码结果取得，协议不单独携带图块宽高。
- 图像格式必须按负载魔数检测，不能只依赖画质设置或固定 MIME。
- 图块可以超出屏幕边界，绘制时裁剪，不能把它视为协议错误。
- `desktop-ready` 不能简单等于“收到第一条命令 `3`”。

### 2.4 文本控制消息

已确认桌面会话会收到：

```json
{
  "ctrlChannel": "102938",
  "type": "metadata"
}
```

metadata 中的用户信息只用于录制状态或会话提示，不进入普通日志。RTT、ping/pong、close 等类型在桌面会话中尚未实测，首期按未知文本控制消息保留并上报，不影响画面数据流。

## 3. 总体架构

```text
RemoteDesktopPanel
  -> useDesktopSession
       -> DesktopRenderer
       -> DesktopSession
            -> DesktopProtocolParser
            -> RelaySession / RelayConnection
                 -> GatewayClient + MeshCentral Agent
```

| 层级                    | 主要职责                                         | 不承担的职责              |
| ----------------------- | ------------------------------------------------ | ------------------------- |
| `RelayClient`           | authcookie、tunnel、Relay WebSocket、`c/cr` 握手 | 桌面命令解析和图像渲染    |
| `DesktopProtocolParser` | 字节流、普通头、jumbo、命令边界                  | React 状态和图片解码      |
| `DesktopSession`        | 桌面状态、命令分发、输入和控制编码               | Canvas 尺寸适配和页面交互 |
| `DesktopRenderer`       | 图像解码、顺序绘制、裁剪和首屏覆盖判断           | 建立 Relay 连接           |
| `useDesktopSession`     | 生命周期、错误映射、连接阶段和重连策略           | 协议字段解析              |
| React 组件              | 工具栏、状态、缩放、全屏和用户交互               | 推断未知协议命令          |

## 4. Relay 桌面协议层

新增目录：

```text
packages/relay/src/protocols/desktop/
  DesktopSession.ts
  DesktopSession.test.ts
  DesktopProtocolParser.ts
  DesktopProtocolParser.test.ts
  commands.ts
  commands.test.ts
  controlMessages.ts
  controlMessages.test.ts
  imageFormat.ts
  types.ts
  index.ts
  fixtures/
    connection-basic.json
    screen-size.bin
    display-geometry.bin
    full-screen-jumbo.bin
```

测试夹具应从真实采集产物生成最小副本，不直接依赖 `test/captures` 中包含桌面画面的受限文件。公开夹具只保留协议验证所需的最小合成或脱敏数据。

### 4.1 `DesktopProtocolParser`

将 `test/desktop/protocolParser.ts` 中已验证的扫描逻辑迁入 `@meshcentral/relay`，并补齐生产约束：

- 接收 `Uint8Array` 流式分块。
- 保留 TypedArray 的 `byteOffset` 和 `byteLength`。
- 支持一块数据包含半条命令、一条命令或多条命令。
- 支持普通命令头和命令 `27` jumbo 外包。
- jumbo 内部长度按已确认的低 24 位解析。
- 只忽略已确认的尾部零填充；非零短尾保留等待下一块。
- 拒绝小于最小头长度、超过上限或递归 jumbo 的畸形命令。
- 限制单命令大小和累计待解析字节，防止异常数据耗尽内存。
- 发布 `DesktopProtocolCommand`，包含命令号、声明长度、负载和是否经过 jumbo。

建议默认限制：

```text
最大普通待解析缓冲：8 MiB
最大 jumbo 命令：32 MiB
最大连续未知命令数：可配置，仅用于诊断节流
```

限制值需要允许调用方覆盖，并通过大图块测试验证不会拒绝正常桌面。

### 4.2 消息顺序和 Blob

`DesktopSession` 采用与 `TerminalSession` 相同的串行入站队列：

1. 文本消息直接进入控制消息分类。
2. `ArrayBuffer` 和 TypedArray 转为无偏移错误的 `Uint8Array`。
3. `Blob.arrayBuffer()` 在队列中等待，后续消息不得越过它。
4. 每个二进制块交给同一个流式解析器。
5. 解析出的命令按顺序发布。

需要限制“正在转换但尚未处理”的入站字节数；超过上限时关闭会话并返回明确的 `output-overflow` 错误。

### 4.3 `DesktopSession` 状态

```ts
type DesktopSessionState = 'ready' | 'screen-known' | 'desktop-ready' | 'closed' | 'error';
```

对外事件：

```ts
onStateChange(listener);
onScreenSize(listener);
onDisplayGeometry(listener);
onTile(listener);
onControlMessage(listener);
onUnknownCommand(listener);
onError(listener);
```

首期 `DesktopSession` 只解释命令 `3`、`7`、`82` 和已确认的 metadata。命令 `11` 保留原始字段，直到多显示器采集确认完整结构。

### 4.4 错误模型

新增 `DesktopSessionError`，至少区分：

- `protocol`
- `connection-lost`
- `invalid-command-size`
- `command-too-large`
- `output-overflow`
- `unsupported-image`
- `image-decode-failed`
- `invalid-screen-size`
- `input-not-allowed`

图块单次解码失败默认报告错误并请求一次刷新，不立即关闭整个会话；连续解码失败达到阈值后再结束会话，避免无限错误循环。

## 5. 图像解码与 Canvas 渲染

新增 Web 端组件：

```text
apps/web/src/components/device-workspace/desktop/
  DesktopCanvas.tsx
  RemoteDesktopPanel.tsx
  DesktopToolbar.tsx
  DesktopStatusBar.tsx
  useDesktopSession.ts
  desktopCoordinates.ts
  desktopCoordinates.test.ts
```

### 5.1 解码策略

- 根据图像魔数确定 JPEG、PNG 或 WebP。
- 使用 `Blob` 和 `createImageBitmap()` 解码；不可用时回退到 `HTMLImageElement` 和 object URL。
- 所有图块进入单一绘制队列，等待上一块解码并绘制后再处理下一块。
- 解码完成后立即释放 `ImageBitmap` 或撤销 object URL。
- Canvas 内部尺寸始终等于命令 `7` 报告的远端尺寸。
- 图块通过 `drawImage(image, x, y)` 绘制，超出 Canvas 的部分自然裁剪。
- 收到新的有效屏幕尺寸时调整 Canvas，清空旧像素并重新进入 `screen-known`，等待新首屏。

### 5.2 首屏覆盖判断

维护当前屏幕的覆盖区域，而不是按图块数量判断：

1. 每次成功绘制图块后，将图块与屏幕相交后的矩形加入覆盖集合。
2. 合并重叠区域，计算已覆盖面积。
3. 覆盖当前屏幕全部像素后进入 `desktop-ready`。
4. 如果首个图块从 `(0,0)` 开始且解码尺寸覆盖整个屏幕，可直接 ready。
5. 分辨率变化时清空覆盖状态。

覆盖计算不参与每一帧的持续统计，只用于连接首屏和分辨率变化后的就绪判断，避免长期增加渲染开销。

### 5.3 本地缩放

支持：

- 适应窗口。
- `100%`。
- 固定百分比。
- 全屏后重新计算显示尺寸。

缩放只改变 CSS 显示尺寸，不改变 Canvas 内部像素和远端分辨率。禁止因容器缩放自动发送远端显示设置。

## 6. Web 端会话生命周期

`useDesktopSession` 负责：

1. 检查设备在线、Gateway 已连接和桌面权限。
2. 创建 `RelayClient`，使用 `protocol=2`、`usage=2` 和启动消息 `['2']`。
3. 记录握手是否为 `cr`。
4. Relay ready 后创建 `DesktopSession`。
5. 将协议事件映射为 React 状态。
6. 设备变化、标签卸载、Gateway 断开或用户结束时释放会话。
7. 忽略已释放会话的晚到事件，避免旧连接覆盖新连接状态。

页面连接状态：

```text
idle
authorizing
notifying
connecting
handshaking
waiting-screen
waiting-first-frame
connected
reconnecting
closed
error
```

错误提示沿用终端面板的错误分类：认证失败、Agent 路由失败、连接超时、握手错误、连接丢失和协议错误分别展示。不得把 `Unable to route` 显示为权限不足。

### 6.1 主动断开

- 用户点击结束会话后立即禁用输入和控制按钮。
- 调用 `DesktopSession.close(1000, reason)`。
- 清空当前会话引用，但保留最后一帧并覆盖“会话已结束”状态，避免界面突然空白。
- 页面卸载或设备切换直接释放资源，不弹确认框。

### 6.2 重连

首期先提供手动“重新连接”。自动重连在基础连接稳定后增加：

- 只对网络中断、Relay 异常关闭和可重试 Agent 路由失败生效。
- 权限拒绝、协议错误和用户主动结束不自动重连。
- 使用有限退避次数。
- 每次重连创建新的 Relay 和 `DesktopSession`，清空 Canvas 和首屏覆盖状态。
- UI 明确显示“正在建立新会话”。

## 7. 权限和只读模式

在权限模块增加：

```ts
type DesktopAccess = 'denied' | 'view-only' | 'control';

function getDesktopAccess(rights: number): DesktopAccess;
```

判定依据：

- 桌面控制允许位：`0x00000008`。
- 仅查看：`0x00000100`。
- 限制桌面输入：`0x00001000`。
- 禁用远程桌面：`0x00010000`。
- 管理员权限维持当前无符号位语义。

建议规则：

1. 禁用远程桌面或没有桌面允许位：`denied`。
2. 有桌面权限，但存在仅查看或限制输入：`view-only`。
3. 其余：`control`。

在独立权限样本确认前，该结果只用于前端交互控制。`DesktopSession` 仍应接受 `inputAllowed` 参数，并在所有输入编码入口统一拒绝只读会话发送输入，避免仅靠按钮禁用。

设备工作台模型增加：

```ts
desktopAccess?: DesktopAccess;
```

当设备快照没有有效权限字段时，UI 显示权限状态未知，允许发起连接并由服务端最终裁决，但不得默认展示为“已授权控制”。

## 8. 输入协议实施

输入功能必须在对应采集 case 确认后逐项开放。当前 `desktopCaptureScenarios.ts` 中的编码只能作为待验证候选。

### 8.1 鼠标

确认后在 `commands.ts` 提供：

```ts
createMouseMoveMessage(point);
createMouseButtonMessage(button, pressed, point);
createMouseDoubleClickMessage(point);
createMouseWheelMessage(delta, point);
```

坐标转换：

$$
x_d = \operatorname{clamp}\left(\operatorname{round}\left(\frac{x_c}{w_c}w_d\right), 0, w_d - 1\right)
$$

$$
y_d = \operatorname{clamp}\left(\operatorname{round}\left(\frac{y_c}{h_c}h_d\right), 0, h_d - 1\right)
$$

其中 $(x_c,y_c)$ 是 Canvas 显示区域内坐标，$(w_c,h_c)$ 是实际显示尺寸，$(w_d,h_d)$ 是远端桌面尺寸。必须扣除 `object-fit` 或居中缩放产生的留白。

实现要求：

- 鼠标移动按 animation frame 或固定频率合并，按下和释放不得丢弃。
- 指针离开 Canvas 或窗口失焦时释放本地记录的按钮状态。
- 拖动严格保留按下、移动、释放顺序。
- 滚轮负值编码必须以实际样本为准。
- 只读状态不注册输入监听器。

### 8.2 键盘

确认后提供：

```ts
createKeyMessage(keyCode, phase, extended);
createUnicodeMessage(codeUnit, phase);
createCadMessage();
```

实现要求：

- 使用 `KeyboardEvent.code` 和显式映射表，不直接把浏览器平台差异暴露给协议层。
- 跟踪已按下按键，窗口失焦、会话结束和重连前发送释放序列。
- `Ctrl+Alt+Del` 使用专用命令 `10`，不模拟普通三键。
- Unicode 按 UTF-16 code unit 发送；代理对行为在样本确认后实现。
- 输入法 composition 期间不重复发送 `keydown` 和 Unicode 注入。
- 浏览器保留快捷键不能承诺一定可转发。

## 9. 控制功能实施

控制功能按采集证据分批开放。

### 9.1 第一批

- 本地缩放和全屏：不依赖远端协议，可与画面基线同时完成。
- 截图：从当前 Canvas 导出 PNG，仅由用户主动触发，不自动上传。
- 主动结束：使用现有 Relay close。
- 录制提示：握手为 `cr` 时显示，不提供客户端录制开关。

### 9.2 第二批

对应样本确认后实现：

- 命令 `6`：请求刷新。
- 命令 `8`：暂停和恢复。
- 命令 `5`：编码格式、quality、scaling 和 frameTimer。
- 命令 `11`：请求或解析显示器列表。
- 命令 `12`：切换显示器和全部显示器。
- 命令 `82`：显示器几何。
- 命令 `87`：输入锁查询或设置。

每次设置变更必须等待协议响应或可观察效果。工具栏不能因为二进制消息已发送就直接显示操作成功。

### 9.3 剪贴板

剪贴板走 Gateway 控制通道，不进入 `DesktopSession` 二进制命令流：

- 读取：`action=msg`、`type=getclip`。
- 写入：`action=msg`、`type=setclip`、`data`。
- 使用独立请求状态和超时。
- 区分空剪贴板、无响应、权限拒绝和网络失败。
- 粘贴到远端前展示确认和字符数。
- 不缓存剪贴板正文，不写入日志或事件详情。

## 10. 设备工作台改造

替换当前静态远程桌面预览：

- `RemoteDesktopPanel` 接收真实设备、Gateway client、Gateway 状态和 `desktopAccess`。
- 中心区域使用 `DesktopCanvas`。
- 状态栏展示连接阶段、远端尺寸、缩放、录制状态和错误。
- 工具栏只展示已实现且当前可用的操作。
- 只读模式隐藏或禁用键鼠、CAD、输入锁等控制功能，并显示明确状态。
- 未连接时显示连接按钮；连接中支持取消；错误时提供重试；已连接时提供结束会话。
- 移除“静态演示”消息、模拟 FPS、模拟桌面、固定时间和伪造连接质量。

右侧设置面板按能力拆分：

- 已实现的本地缩放保留在显示设置。
- 未验证的远端分辨率、色深、画质和屏幕用户输入不显示为可操作控件。
- 画质命令确认后再增加真实选择和发送状态。
- 延迟只在桌面 RTT 样本确认后展示，不能沿用 mock latency。

设备列表和概览入口：

- 设备离线时入口可见但禁用，并说明原因。
- `desktopAccess='denied'` 时隐藏或禁用入口。
- 入口跳转到 `/devices/:deviceId?tab=desktop`。
- 页面刷新后能从 URL 恢复桌面标签，但不自动建立控制会话，避免意外远程连接。

## 11. 性能与资源控制

桌面数据可能持续高速到达，必须设置以下边界：

- 入站 Blob/二进制待处理字节上限。
- 协议解析缓冲上限。
- 图像解码和绘制队列上限。
- Canvas 最大宽高和最大像素数。
- 连续图像解码失败阈值。
- 未知命令诊断节流。

当绘制队列积压时：

1. 不重排图块。
2. 不直接丢弃可能影响最终画面的局部图块。
3. 优先尝试发送已确认的暂停/恢复或降低画质命令。
4. 在控制命令尚未确认前，达到硬上限后明确结束会话，避免浏览器内存失控。

页面隐藏时可以在暂停命令确认后暂停远端传输；在此之前仅停止非必要 UI 指标刷新，不能停止协议消费。

## 12. 测试计划

### 12.1 Relay 单元测试

覆盖：

- 普通命令单块和跨块解析。
- 一块中包含多个命令。
- jumbo 首屏样本。
- 零填充和非零短尾。
- TypedArray 偏移。
- Blob 顺序。
- 命令长度过小、超限和截断。
- 命令 `7`、`3`、`82` 解析。
- JPEG、PNG、WebP 魔数检测。
- 命令 `18`、`88` 作为未知命令交付。
- Relay 错误、关闭和主动释放。
- 入站队列和解析缓冲上限。

### 12.2 渲染测试

覆盖：

- Canvas 尺寸跟随命令 `7`。
- `1920 x 1216` 图块绘制到 `1920 x 1200` 时正确裁剪。
- 多图块按顺序覆盖。
- 局部更新不清空其他区域。
- 分辨率变化清空旧画面和覆盖状态。
- 首屏覆盖判断。
- 图片解码失败和资源释放。
- 本地适应窗口与固定缩放。

浏览器 API 在 jsdom 中不足的部分使用适配器注入，图片解码和 Canvas 像素结果通过真实浏览器测试验证。

### 12.3 Web 组件测试

覆盖：

- 连接阶段文案和按钮状态。
- 连接取消、主动结束和卸载清理。
- Gateway 断开后会话释放。
- 只读模式不发送输入。
- 设备切换后旧事件不更新新页面。
- 错误分类和手动重试。
- URL 恢复桌面标签但不自动连接。

### 12.4 手动协议验证

继续使用 `test/manual/desktop-data.capture.test.ts`，优先完成：

1. `screen-small-region`。
2. `screen-checkerboard` 和 `screen-text`。
3. `screen-resolution-change`。
4. 鼠标移动、点击、拖动和滚轮。
5. 普通键、扩展键、Unicode 和 CAD。
6. 刷新、暂停、画质、显示器和输入锁。
7. 剪贴板。
8. `cr`、只读和异常断开。

每项生产 API 必须引用一个已确认的最小夹具和对应测试。

## 13. 实施阶段

### 阶段 1：协议解析基线

1. 将采集解析器迁入 `@meshcentral/relay`。
2. 增加普通命令、jumbo、流式分块和资源上限测试。
3. 固化命令 `3`、`7`、`82` 和图像格式类型。
4. 保留命令 `11`、`18`、`88` 的原始事件。

完成条件：真实 `connection-basic` 数据可以被完整消费，`pendingProtocolBytes=0`，首屏 jumbo 被解析为一个 JPEG 图块。

### 阶段 2：`DesktopSession`

1. 实现串行入站队列和状态机。
2. 发布屏幕尺寸、显示器几何、图块、metadata 和未知命令事件。
3. 实现关闭、释放和错误模型。
4. 更新 `@meshcentral/relay` 导出和 README。

完成条件：使用模拟 Relay 可以重放连接样本，并得到与采集报告一致的命令序列和桌面状态。

### 阶段 3：Canvas 只读桌面

1. 实现图片解码适配器和顺序绘制队列。
2. 实现 Canvas 尺寸、裁剪和首屏覆盖判断。
3. 将静态桌面面板替换为真实连接和只读画面。
4. 接入本地缩放、全屏、截图和主动结束。

完成条件：设备工作台可以连接真实设备、显示完整首屏和后续图块，并能正常结束会话。

### 阶段 4：权限和生命周期

1. 增加 `DesktopAccess` 权限计算。
2. 完成连接阶段、错误、取消和手动重连。
3. 完成 Gateway 断开、设备变化和页面卸载清理。
4. 增加录制提示和只读状态。

完成条件：无权限、离线、连接中、已连接、只读、错误和已关闭状态都有明确 UI，且不会残留 Relay 或图片资源。

### 阶段 5：输入控制

1. 完成对应真实样本采集。
2. 实现坐标转换和鼠标命令。
3. 实现键盘、修饰键释放、Unicode 和 CAD。
4. 增加只读双层保护和焦点管理。

完成条件：所有开放的输入动作都由已确认夹具测试，并在测试设备上得到正确远端结果。

### 阶段 6：显示与会话控制

1. 完成刷新、暂停、画质、显示器和输入锁样本。
2. 实现对应命令 API 和 UI。
3. 完成剪贴板读写。
4. 评估并实现有限自动重连。

完成条件：每个控制项都有远端确认或可观察效果，失败时不显示伪成功。

### 阶段 7：完整验证

1. 增加浏览器端端到端测试。
2. 验证长时间会话、动态画面和队列积压。
3. 验证移动端查看、桌面端控制和全屏退出。
4. 验证录制、权限拒绝、Agent 断线和网关断线。
5. 更新功能清单和协议证据文档。

## 14. 完成定义

远程桌面标记为完成前必须满足：

- `DesktopSession` 已实现并由真实脱敏协议夹具覆盖。
- 普通和 jumbo 命令可以流式解析，Blob 顺序和内存上限有测试。
- 首屏和局部图块可以按顺序渲染，分辨率变化不会保留错误旧像素。
- 鼠标、键盘、滚轮、组合键和 CAD 均由实际样本确认。
- 剪贴板、画质、缩放、全屏和显示器功能有明确成功与失败状态。
- 无权限、只读、连接失败、断线、手动重连和主动结束均有完整行为。
- 服务端继续执行最终权限校验，前端只提供交互门控。
- 会话图像、按键和剪贴板不会进入普通日志或未授权持久化。
- 核心 Relay、渲染、权限和 Web 组件测试通过。
- 关键用户流程有浏览器端端到端测试。
- `pnpm lint`、`pnpm typecheck`、`pnpm test` 和 `pnpm build` 通过。
- `todo/README.md` 和相关协议文档同步更新。

## 15. 当前可立即开始的工作

本次 `connection-basic` 已解除以下实现阻塞：

1. `p=2` 建链和最小启动顺序。
2. 普通命令头与 jumbo 解包。
3. 屏幕尺寸解析。
4. 单屏显示器几何解析。
5. JPEG 图块提取、裁剪和首屏 ready 判断。
6. metadata 分类。
7. 正常主动关闭。

因此可以立即实施阶段 1 至阶段 4，并交付真实的只读远程桌面。阶段 5 和阶段 6 中涉及远端输入或状态修改的 API，必须等待各自采集 case 确认后再进入生产实现。
