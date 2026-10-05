# 05 - 国际化本地化机制与模板目录 (Localization)

MeshCentral 采用了一套高效的“模板 ID + 动态参数数组”机制来实现双端与多语言的本地化解耦。

---

## 一、本地化机制问答

### 1. `titleid` 与 `msgid` 对应的模板定义在哪里？
- **事件日志（Audit Events）**：定义在 `views/default.handlebars:16678` 的 `eventsMessageId` 字典中（覆盖 ID 1 ~ 166）。
- **弹窗通知（Notification Dialogs）**：定义在 `views/default.handlebars:19601` 的 `translatedTitles`（ID 1 ~ 6）与 `translatedMessages`（ID 1 ~ 34）。
- **Agent 控制台消息**：定义在 `views/default.handlebars:9628` 的 `agentConsoleMessages`（ID 1 ~ 14）。

### 2. 模板 ID 在不同版本间是否保持稳定？
- **非常稳定**：MeshCentral 绝不重写或移动既有 ID 的数字索引（废弃的 ID 会在注释中标明，例如 ID 4, 5, 6 废弃后标记保留，新功能依次追加至 166）。这使得客户端以数字 ID 建立枚举字典具备长效向后兼容性。

### 3. `args` 与 `msgArgs` 的顺序和类型？
- 均为纯数组（`Array`）。
- `args`：用于 `action: "msg", type: "notify"` 消息。
- `msgArgs`：用于 `action: "event"` 结构。
- 占位符 `{0}`, `{1}`, `{2}` 严格与数组索引 `args[0]`, `args[1]`, `args[2]` 一一对应。

### 4. 动态参数是否需要 HTML 转义？
- **必须转义**：参数多包含用户输入（如计算机名、用户名、路径、自定备注）。原生客户端在渲染前通过 `EscapeHtml(...)` 清洗参数，以防御 XSS 攻击。在桌面通知或移动端系统通知中，还必须剔除 `<b>`, `<br />`, `&reg;` 等标记。

### 5. `msg` 是可信回退文本还是仅用于日志？
- **可信回退文本（Fallback）**：当客户端尚未收录某个新版本追加的 `msgid` 时，`msg` 字段是服务端生成的默认英文描述文本，可直接用于展示。

### 6. 服务端是否已经按用户语言本地化？
- **否**：服务端的控制通道 WebSocket 传递的是**中立的纯英文字符串与原始数值 ID**，实际多语言翻译是由客户端前端在接收到报文后，依据当前用户的语言环境动态查找本地语言包渲染的。

### 7. 前端切换语言后能否重新渲染历史通知？
- **可以**：因为历史事件保留了原始的 `msgid` 与 `msgArgs`，只要重新调用格式化函数 `format(eventsMessageId[event.msgid], ...event.msgArgs)` 即可实现无刷新全量切语言。

### 8. 未识别 ID 时应回退到哪个字段？
- 若 `event.msgid` 在本地映射表中缺失，**直接回退显示 `event.msg`**。

### 9. 哪些消息正文可能包含用户输入？
- 求助消息 (`msgid: 98`) 的 `msgArgs[0]`（发起人姓名）和 `msgArgs[1]`（求助详情说明）；
- 设备与组重命名 (`msgid: 59, 142`)；
- 文件与路径 (`msgid: 44, 48, 50, 105`)；
- 命令内容 (`msgid: 17, 24`)。

---

## 二、审计事件模板目录 (`eventsMessageId`, 1 ~ 166 核心节选)

源码依据：`views/default.handlebars:16678-16847`

| ID | 模板字符串 (Template) | 占位符含义 | 关联事件动作 |
| :---: | :--- | :--- | :--- |
| **1** | `Account login` | 无 | `login` |
| **2** | `Account logout` | 无 | `logout` |
| **3** | `Changed language from {1} to {2}` | `{0}`: 旧语言, `{1}`: 新语言 | `accountchange` |
| **9** | `Ended relay session "{0}" from {1} to {2}, {3} second(s)` | `{0}`: SessionID, `{1}`: 源IP, `{2}`: 目标IP, `{3}`: 秒数 | `relaylog` |
| **10** | `Ended terminal session "{0}" from {1} to {2}, {3} second(s)` | 同上 | `relaylog` |
| **11** | `Ended desktop session "{0}" from {1} to {2}, {3} second(s)` | 同上 | `relaylog` |
| **12** | `Ended file management session "{0}" from {1} to {2}, {3} second(s)` | 同上 | `relaylog` |
| **14** | `Started terminal session "{0}" from {1} to {2}` | `{0}`: SessionID, `{1}`: 源IP, `{2}`: 目标IP | `relaylog` |
| **15** | `Started desktop session "{0}" from {1} to {2}` | 同上 | `relaylog` |
| **16** | `Started file management session "{0}" from {1} to {2}` | 同上 | `relaylog` |
| **24** | `Running commands` | 无 | `runcommands` |
| **25** | `Performing power action={0}, forced={1}` | `{0}`: 动作编号, `{1}`: 是否强制 | `poweraction` |
| **26** | `Displaying toast message, title="{0}", message="{1}"` | `{0}`: 标题, `{1}`: 消息 | `toast` |
| **44** | `Create folder: "{0}"` | `{0}`: 路径 | `agentlog` |
| **45** | `Delete: "{0}"` | `{0}`: 路径 | `agentlog` |
| **48** | `Rename: "{0}" to "{1}"` | `{0}`: 原名, `{1}`: 新名 | `agentlog` |
| **49** | `Download: "{0}"` | `{0}`: 路径 | `agentlog` |
| **50** | `Upload: "{0}"` | `{0}`: 路径 | `agentlog` |
| **55** | `Created device group: {0}` | `{0}`: 组名 | `createmesh` |
| **57** | `Added device {0} to device group {1}` | `{0}`: 设备名, `{1}`: 组名 | `addnode` |
| **59** | `Changed device {0} from group {1}: {2}` | `{0}`: 设备名, `{1}`: 组名, `{2}`: 变更项 | `changenode` |
| **60** | `Removed user device rights for {0}` | `{0}`: 用户名 | `changenode` |
| **63** | `Account removed` | 无 | `accountremove` |
| **64** | `Account created, username is {0}` | `{0}`: 用户名 | `accountcreate` |
| **66** | `Account changed: {0}` | `{0}`: 用户名 | `accountchange` |
| **76** | `Device group created: {0}` | `{0}`: 组名 | `createmesh` |
| **77** | `Device group deleted: {0}` | `{0}`: 组名 | `deletemesh` |
| **87** | `Removed device {0} from device group {1}` | `{0}`: 设备名, `{1}`: 组名 | `removenode` |
| **98** | `Help Requested, user: {0}, details: {1}` | `{0}`: 求助人姓名, `{1}`: 说明详情 | `agentlog` |
| **105** | `Upload: "{0}", Size: {1}` | `{0}`: 路径, `{1}`: 字节大小 | `agentlog` |
| **106** | `Download: "{0}", Size: {1}` | `{0}`: 路径, `{1}`: 字节大小 | `agentlog` |
| **107** | `Account login from {0}, {1}, {2}` | `{0}`: IP, `{1}`: 浏览器, `{2}`: 操作系统 | `login` |
| **108** | `User login attempt with incorrect 2nd factor from {0}, {1}, {2}` | 同上 | `authfail` |
| **109** | `User login attempt on locked account from {0}, {1}, {2}` | 同上 | `authfail` |
| **110** | `Invalid user login attempt from {0}, {1}, {2}` | 同上 | `authfail` |
| **142** | `Device group {0} was changed: {1}` | `{0}`: 组名, `{1}`: 变更项目列表 | `meshchange` |
| **146** | `Finished recording session "{0}", {1} second(s)` | `{0}`: 录制文件名, `{1}`: 时长秒数 | `recording` |

---

## 三、通知弹窗模板目录 (`translatedTitles` 与 `translatedMessages`)

源码依据：`views/default.handlebars:19601-19646`

### 1. 标题模板 (`titleid`)
- `1`: `New Account`
- `2`: `Server Limit`
- `3`: `Security Warning`
- `4`: `Account Settings`
- `5`: `Device Group`
- `6`: `Invite Codes`

### 2. 消息内容模板 (`msgid`)
- `1`: `Permission denied`
- `2`: `Invalid username`
- `3`: `Invalid password`
- `7`: `User already exists`
- `10`: `Account limit reached.`
- `11`: `Chat Request, Click here to accept.`
- `12`: `There has been {0} failed login attempts on this account since the last login.`
- `14`: `Email sent.`
- `15`: `User {0} not found.`
- `20`: `Password changed.`
- `21`: `Current password not correct.`
- `27`: `SMS succesfully sent.`
- `33`: `Message succesfully sent.`
