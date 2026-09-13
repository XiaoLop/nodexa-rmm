# 远程桌面协议数据采集计划

## 1. 目标

本计划只解决两个问题：

1. 当前 Web 客户端应如何通过现有控制通道和中继层建立 MeshCentral 远程桌面连接。
2. 如何在 `test` 目录内采集并验证远程桌面的连接、画面、输入和控制协议。

本阶段不讨论 MeshCentral、Agent、操作系统或浏览器版本矩阵，也不实现正式的远程桌面 UI。采集结果用于后续实现 `DesktopSession`、Canvas 渲染、键鼠控制和桌面设置，不直接作为生产日志格式。

## 2. 已知协议基线

当前源码证据支持以下基线：

- 桌面中继协议为 `p=2`，Agent tunnel 的 `usage=2`。
- 通过控制通道请求 `authcookie`，取得浏览器 relay cookie 和 Agent relay cookie。
- 通过控制通道发送 `action=msg`、`type=tunnel`、`nodeid`、`usage=2` 和 Agent relay URL。
- 浏览器连接 `meshrelay.ashx`，等待文本握手 `c` 或 `cr`。
- `cr` 表示中继正在录制，不表示用户已经同意，也不表示桌面首帧已经到达。
- 握手完成后发送文本协议号 `"2"`，然后接收桌面协议消息。
- 桌面二进制普通命令使用大端头：`command:u16`、`size:u16`。
- 命令 `27`、头长度 `8` 表示 jumbo 外包消息，采集阶段必须保留完整原始应用消息。
- 文本控制通道使用 `ctrlChannel="102938"`，可能包含 RTT、metadata、ping/pong、close 等消息。
- 第一轮采集只覆盖 WebSocket，不启用 WebRTC/DataChannel，避免同一会话的数据分散到两个传输通道。

源码推断只能用于生成测试假设。只有采集结果中出现的字段、顺序和负载才能进入后续稳定协议实现。

## 3. 建立远程桌面连接

测试程序复用现有 `GatewayClient`、`RelayClient` 和 `RelaySession`，不另建认证或中继实现。

预期连接流程：

```text
GatewayClient.connect()
  -> 获取目标设备并确认在线
  -> control.request({ action: "authcookie" })
  -> control.request({
       action: "msg",
       type: "tunnel",
       nodeid,
       usage: 2,
       value: agentRelayPath,
       responseid
     })
  -> 等待 tunnel result=OK
  -> 打开 meshrelay.ashx?p=2 WebSocket
  -> 等待 relay 文本握手 c 或 cr
  -> 发送文本协议号 "2"
  -> 等待屏幕尺寸命令 7
  -> 按实测顺序发送必要的编码参数、恢复传输和输入锁查询
  -> 收到并拼合图块命令 3
  -> 第一幅完整可见桌面形成后标记 desktop-ready
```

注意事项：

- tunnel `result=OK` 只表示路由请求被接受，不代表桌面已可用。
- Relay 进入 `ready` 只表示握手和协议选择完成，不代表已经收到屏幕尺寸或画面。
- 不预先写死握手后必须发送哪些 KVM 二进制命令。第一次连接采集先发送协议号 `"2"`，记录 Agent 的实际回包，再根据屏幕尺寸后的真实消息确定正式启动序列。
- 如果没有收到首屏，允许按单变量方式分别试验刷新命令 `6`、恢复命令 `8/0`、编码参数命令 `5`，每次试验必须建立新会话并单独保存。
- 正常结束时先记录客户端结束意图；若实测需要发送控制通道 close，则保存该文本消息，最后使用 WebSocket close code `1000` 关闭。

## 4. 测试目录规划

在 `test` 下增加以下结构：

```text
test/
  manual/
    desktop-data.capture.test.ts
    desktopCaptureHelpers.ts
    desktopCaptureHelpers.test.ts
  desktop/
    protocolParser.test.ts
    captureManifest.test.ts
  captures/
    desktop/
      <case-id>/
        manifest.json
        messages.jsonl
        actions.jsonl
        closes.jsonl
        payloads/
          000001.bin
        screenshots/
          reference-000001.png
```

职责划分：

| 文件                            | 职责                                               |
| ------------------------------- | -------------------------------------------------- |
| `desktop-data.capture.test.ts`  | 建立真实 `p=2` 会话、执行一个采集场景、关闭会话    |
| `desktopCaptureHelpers.ts`      | 原始消息落盘、序号、哈希、动作标记和关闭事件记录   |
| `desktopCaptureHelpers.test.ts` | 验证二进制不丢失、凭据脱敏、序号和哈希稳定         |
| `protocolParser.test.ts`        | 对采集产物执行命令头、jumbo、长度和已知字段解析    |
| `captureManifest.test.ts`       | 检查每个 case 的必需文件、消息引用和动作关联完整性 |

现有 `captureHelpers.ts` 继续服务终端采集。桌面采集先使用独立 helper，因为桌面必须保存完整二进制负载，而终端采集有意只保存帧长度。

## 5. 采集产物格式

### 5.1 `manifest.json`

只保存场景和协议相关信息：

```json
{
  "schemaVersion": 1,
  "caseId": "connection-basic",
  "scenario": "connection",
  "protocol": 2,
  "transport": "websocket",
  "expectedActions": [],
  "expectedObservations": ["relay-handshake", "screen-size", "desktop-ready"]
}
```

不把版本、操作系统和浏览器信息设为当前阶段的必填项。

### 5.2 `messages.jsonl`

每行记录一个浏览器可见的 WebSocket 应用消息：

```json
{
  "seq": 12,
  "elapsedMs": 438,
  "channel": "relay",
  "direction": "relay-to-browser",
  "kind": "binary",
  "byteLength": 8216,
  "sha256": "...",
  "payloadFile": "payloads/000012.bin"
}
```

要求：

- 二进制消息逐条原样写入 `payloads`，不截断、不去填充、不拆 jumbo。
- 文本消息保存脱敏后的文本和原始 UTF-8 字节长度。
- `seq` 在单个 case 内严格递增。
- 使用单调相对时间描述顺序，不把不同机器的时间戳当作全局严格顺序。
- Gateway 消息只保存建立连接和剪贴板控制所需内容；Cookie、auth、rauth 和 token 必须遮蔽。
- 这里记录的是浏览器 WebSocket API 已重组的应用消息，不称为 RFC6455 wire frame。

### 5.3 `actions.jsonl`

每个测试动作必须先记录意图，再发送协议消息：

```json
{
  "actionId": "mouse-left-click-01",
  "kind": "mouse",
  "startedAtMs": 2200,
  "parameters": {
    "desktopX": 320,
    "desktopY": 240,
    "button": "left"
  },
  "firstMessageSeq": 38,
  "lastMessageSeq": 39
}
```

一个 case 只测试一个动作或一个不可拆分的动作序列，例如拖动由按下、移动、释放组成。禁止在同一采集窗口内混合点击、滚轮和键盘输入。

### 5.4 截图

- 画面 case 必须提供合成测试桌面的参考截图。
- 截图文件名与动作或消息序号关联。
- 截图只作为像素结果证据，不代替二进制消息。
- 首屏 case 要明确“完整可见桌面”由哪些图块消息共同形成，不能把第一条图块消息当作完整帧。

## 6. 场景一：成功连接的完整帧序列

### 6.1 `connection-basic`

目标：从 Gateway 已连接开始，采集到第一幅完整桌面并正常退出。

步骤：

1. 查询设备，确认目标设备在线。
2. 开始记录 Gateway 和 Relay 消息。
3. 创建 `protocol=2`、`usage=2` 的 Relay 会话。
4. 记录 tunnel 请求、路由结果、WebSocket 状态和 `c/cr`。
5. 握手后发送文本 `"2"`。
6. 记录握手后的所有文本和二进制消息。
7. 收到命令 `7` 时记录桌面宽高。
8. 按实测需要发送启动控制消息，并逐条记录。
9. 收集命令 `3` 图块，直到测试桌面完整可见。
10. 记录 `desktop-ready` 及其最后一个消息序号。
11. 主动正常结束，记录双方 close 事件。

验收：

- 能还原 `authcookie -> tunnel -> relay -> c/cr -> "2" -> screen-size -> tiles -> close` 的顺序。
- 所有 relay 二进制消息都存在对应负载文件和 SHA-256。
- 能区分 route accepted、relay ready、screen known 和 desktop ready 四个阶段。
- 未出现无法解释的消息丢失或负载引用断裂。

### 6.2 启动序列探测

如果 `connection-basic` 在只发送 `"2"` 后不能出图，依次建立独立 case：

1. `connection-with-refresh`：额外发送命令 `6`。
2. `connection-with-unpause`：额外发送命令 `8`，值为 `0`。
3. `connection-with-compression`：额外发送命令 `5`，使用一个保守参数组合。
4. `connection-with-full-startup`：只在前三项数据表明需要组合时测试确定顺序。

每个 case 只能比前一个增加一个变量，以便判断哪条命令真正触发画面或恢复传输。

## 7. 场景二：画面协议样本

### 7.1 必采 case

| Case                       | 测试桌面动作               | 主要验证                                 |
| -------------------------- | -------------------------- | ---------------------------------------- |
| `screen-initial`           | 显示固定测试图             | 命令 `7`、首屏图块范围、完整桌面形成条件 |
| `screen-small-region`      | 只改变已知小矩形           | 图块坐标、局部覆盖、未变化区域是否保留   |
| `screen-solid-colors`      | 依次显示黑、白、红、绿、蓝 | 图像解码、颜色和通道是否正确             |
| `screen-checkerboard`      | 显示固定棋盘格             | 图块边界、拼接缝和坐标精度               |
| `screen-text`              | 显示固定大号文字           | 压缩质量、绘制顺序和清晰度               |
| `screen-window-move`       | 将固定窗口移动一次         | 连续增量图块、旧区域重绘                 |
| `screen-dynamic`           | 播放短时可重复动画         | 消息速率、积压和绘制顺序                 |
| `screen-resolution-change` | 切换一次分辨率             | 新命令 `7`、画布清理和后续坐标范围       |

### 7.2 解析与验证

测试解析器至少完成：

- 普通命令头 `command:u16`、`size:u16` 的大端读取。
- 一条应用消息中包含完整命令、多个命令或不完整命令时的处理验证。
- 8 字节对齐填充保留与有效命令长度区分。
- jumbo 命令 `27` 的外包识别和内部负载提取。
- 命令 `7` 的 width/height 解析。
- 命令 `3` 的 X/Y 和图像负载提取。
- 根据图像魔数识别实际 JPEG、PNG、WebP 或其他格式，不按请求参数猜测。
- 图块异步解码后仍严格按协议消息顺序绘制。

每个画面 case 的验收结果包含：

1. 解析出的命令序列。
2. 图块坐标、解码尺寸和图像格式。
3. 重放到离屏 Canvas 后生成的结果截图。
4. 与参考截图的尺寸一致性和像素差异统计。

## 8. 场景三：输入协议样本

所有输入 case 在固定分辨率和固定测试页面上执行。测试页面实时显示最后收到的鼠标坐标、按钮、滚轮和键盘事件，便于将发送消息与远端结果对应。

### 8.1 鼠标

| Case                 | 单一动作             | 预期候选命令                |
| -------------------- | -------------------- | --------------------------- |
| `mouse-move`         | 移动到固定桌面坐标   | `2`，flags `0`              |
| `mouse-left`         | 左键按下并释放       | `2`，flags `2/4`            |
| `mouse-right`        | 右键按下并释放       | `2`，flags `8/16`           |
| `mouse-middle`       | 中键按下并释放       | `2`，flags `32/64`          |
| `mouse-double-click` | 固定位置双击         | `2`，验证 `0x88` 或实际序列 |
| `mouse-drag`         | 从 A 拖到 B          | 按下、多个移动、释放        |
| `mouse-wheel-up`     | 向上滚动一个标准单位 | `2`，总长候选 `12`          |
| `mouse-wheel-down`   | 向下滚动一个标准单位 | `2`，确认负值编码           |

每个 case 同时记录：浏览器显示坐标、桌面目标坐标、画布显示尺寸、桌面原始尺寸、发送消息序号和远端测试页显示结果。

### 8.2 键盘

| Case                    | 单一动作                     | 验证内容                     |
| ----------------------- | ---------------------------- | ---------------------------- |
| `keyboard-letter`       | 按下并释放 `A`               | 普通键按下/释放              |
| `keyboard-shift-letter` | 输入 `Shift+A`               | 修饰键顺序和释放             |
| `keyboard-arrows`       | 单独测试一个方向键           | 扩展键标志                   |
| `keyboard-function`     | 单独测试 `F2`                | 功能键映射                   |
| `keyboard-control`      | 输入无副作用的 `Ctrl` 组合键 | Ctrl 按下、目标键、全部释放  |
| `keyboard-unicode`      | 注入一个 BMP 中文字符        | 命令 `85` 与 UTF-16 代码单元 |
| `keyboard-surrogate`    | 注入一个代理对字符           | 是否按两个 UTF-16 单元发送   |
| `keyboard-cad`          | 触发专用 CAD 操作            | 命令 `10`，不得模拟普通三键  |

采集器不得记录用户自由输入。所有字符和按键必须来自脚本内固定、无敏感数据的测试动作。

### 8.3 输入验收

- 每个动作能定位到明确的客户端到 Relay 二进制消息序列。
- 字段解析与远端测试页观察结果一致。
- 鼠标坐标转换使用桌面原始坐标，而不是直接发送 CSS 像素。
- 所有按下事件都有对应释放事件；case 结束前发送修饰键释放保护序列。
- 仅查看采集不复用这些成功结果，后续必须单独验证服务端确实拒绝输入。

## 9. 场景四：控制功能样本

### 9.1 中继内控制

| Case                       | 操作               | 主要观察                               |
| -------------------------- | ------------------ | -------------------------------------- |
| `control-refresh`          | 发送刷新           | 命令 `6` 后的画面更新                  |
| `control-pause-resume`     | 暂停后恢复         | 命令 `8`、暂停期间图块和恢复行为       |
| `control-compression`      | 修改一次画质参数   | 命令 `5` 的字段及后续图像格式/大小变化 |
| `control-display-list`     | 请求显示器列表     | 命令 `11` 请求和回复结构               |
| `control-display-select`   | 切换到指定显示器   | 命令 `12`、新尺寸和画面                |
| `control-display-all`      | 选择全部显示器     | display ID `65535` 的实际行为          |
| `control-display-geometry` | 获取或等待几何信息 | 命令 `82` 的多显示器条目               |
| `control-input-lock-query` | 查询远端输入锁     | 命令 `87` 值 `2` 及响应                |

画质测试每个 case 只改变一个字段：编码类型、quality、scaling 或 frameTimer。不得一次修改多个参数后再猜测是哪一个字段产生效果。

### 9.2 文本控制通道

采集并分类 `ctrlChannel="102938"` 的消息：

- RTT 请求与响应。
- ping 与 pong。
- metadata。
- console 状态或错误。
- close 或 disconnect。

未知控制类型原样保存，不在采集阶段过滤。后续只有被真实样本确认的类型才能从桌面数据流中剥离。

### 9.3 剪贴板

剪贴板通过 Gateway/Agent 消息采集，不作为 KVM 二进制命令：

- `clipboard-get-text`：发送 `type=getclip`，记录响应形状和文本。
- `clipboard-get-empty`：远端剪贴板为空，区分空值、无响应和失败。
- `clipboard-set-text`：发送固定测试字符串，远端人工或脚本确认。
- `clipboard-set-concurrent`：第二次写入是否等待、拒绝或覆盖。
- `clipboard-denied`：记录无权限时是否无响应、返回错误或关闭。

共享采集产物中的剪贴板内容只允许固定测试字符串，并在 manifest 中声明期望值。

## 10. 测试脚本接口

为避免一个脚本包含大量人工分支，使用场景驱动入口：

```text
DESKTOP_CAPTURE_SCENARIO=connection-basic
DESKTOP_CAPTURE_SCENARIO=screen-small-region
DESKTOP_CAPTURE_SCENARIO=mouse-left
DESKTOP_CAPTURE_SCENARIO=control-refresh
```

建议为 `test/package.json` 增加：

```json
{
  "scripts": {
    "capture:terminal": "node --env-file=.env ./node_modules/vitest/vitest.mjs run manual/terminal-data.capture.test.ts --reporter=verbose",
    "capture:desktop": "node --env-file=.env ./node_modules/vitest/vitest.mjs run manual/desktop-data.capture.test.ts --reporter=verbose",
    "test:desktop-captures": "vitest run desktop"
  }
}
```

真实连接脚本继续要求 `RUN_MANUAL_INTEGRATION=1`；默认 `pnpm test` 不连接设备。场景名称、目标设备 ID、超时和固定动作参数从 `.env` 读取，凭据只存在被 Git 忽略的 `test/.env`。

## 11. 实施顺序

### 阶段 A：无损采集基础

1. 新增 `desktopCaptureHelpers.ts`。
2. 为每条二进制应用消息写入独立 `.bin` 文件。
3. 记录方向、序号、相对时间、长度和 SHA-256。
4. 实现文本凭据脱敏，但不改写桌面二进制内容。
5. 增加 helper 单元测试，确认 TypedArray 的 `byteOffset`/`byteLength` 不会导致多写数据。
6. 增加 manifest 完整性测试。

完成条件：使用合成输入可以生成结构完整、可重复读取、哈希一致的 case 目录。

### 阶段 B：连接基线

1. 实现 `desktop-data.capture.test.ts`。
2. 完成 `connection-basic`。
3. 如未出图，执行单变量启动序列探测。
4. 固化成功连接的最小脱敏夹具。

完成条件：能够从产物中重建连接阶段，并确定从 `c/cr` 到首屏所需的真实消息顺序。

### 阶段 C：画面协议

1. 实现命令流扫描器，仅用于采集结果分析。
2. 完成首屏、局部变化、颜色、棋盘格、文字和分辨率 case。
3. 实现离屏 Canvas 重放工具。
4. 输出参考截图与重放截图的像素差异。

完成条件：能够稳定解析并重放命令 `7` 和命令 `3`，局部更新不会破坏未变化区域。

### 阶段 D：输入协议

1. 实现候选命令编码器。
2. 按单动作 case 发送鼠标、滚轮、键盘、Unicode 和 CAD。
3. 使用远端事件测试页确认实际结果。
4. 将确认后的消息固化为输入协议夹具。

完成条件：每种输入都有客户端消息、字段解析和远端结果三方一致的证据。

### 阶段 E：控制功能

1. 采集刷新、暂停、压缩、显示器和输入锁。
2. 分类文本控制通道消息。
3. 通过 Gateway 采集剪贴板读写。
4. 为每类控制功能建立成功和明确失败结果。

完成条件：控制命令的请求、响应或可观察效果均有独立 case，不依赖 UI 状态推测成功。

## 12. 完成定义

采集阶段完成需同时满足：

- 四组场景均有实际测试脚本：成功连接、画面、输入、控制。
- 成功连接能形成完整可见桌面并正常关闭。
- 所有 Relay 二进制应用消息均可从产物无损恢复。
- 至少确认命令 `3`、`7`、`1`、`2`、`5`、`6`、`8`、`10`、`11`、`12`、`85` 和 `87` 中实际使用的消息结构。
- 画面样本可以离线重放到 Canvas，并与参考截图比较。
- 输入样本使用固定动作，且远端观察结果与消息字段一致。
- 控制功能按单变量 case 验证，不以“发送成功”代替远端生效。
- 测试产物不包含 Cookie、Token、认证参数、真实密码或非测试剪贴板数据。
- `pnpm --filter @meshcentral/test lint`、`typecheck` 和非手动测试通过。

完成以上采集后，再以确认夹具为依据设计 `packages/relay/src/protocols/desktop/DesktopSession.ts`。在此之前不把源码推断直接固化为正式桌面协议 API。
