# MeshCentral 控制通道协议 (`/control.ashx`) 逆向证据包总结报告

针对当前目标 MeshCentral 版本（**v1.2.5**，Git Commit `02eb8f71d2ce48bdbd59e4e4d4844b7edaf0e69d`，运行于 Node.js `v24.9.0`），本调查对服务端核心控制通道实现（`meshuser.js`, `webserver.js`, `meshcentral.js`）、原生前端视图（`views/default.handlebars`, `views/default3.handlebars`）以及官方 CLI（`meshctrl.js`）进行了全面的静态代码剖析与时序数据流追踪。

所有生成的成果物均已规范保存在 `meshcentral-control-protocol/` 目录下，包含完整的机器可读目录、核心 JSON Schema 契约、典型场景夹具报文与深度专题文档。

---

## 一、十二项核心关键问题明确答复

### 1. `/control.ashx` 共发现多少个顶层 action？

共确认 **95 个独立顶层 Action**（在 `meshuser.js` 中分为两大调度区域：行 720 至 5700 的主 `switch (command.action)` 语句包含 42 个分支；行 5781 至 5835 的 `serverCommands` 函数映射表注册了 53 个重构命令）。

### 2. 共发现多少个 `event.action`？

在 `{ action: "event", event: { action: ... } }` 外层信封下，共确认 **34 个核心业务事件动作**（在 `views/default.handlebars:3428-4050` 及服务端各模块 `DispatchEvent` 调用中完整捕获），涵盖 `nodeconnect`, `addnode`, `removenode`, `changenode`, `agentlog` (包含求助请求), `devicesessions`, `sysinfohash`, `ifchange`, `createmesh`, `meshchange`, `deletemesh`, `createusergroup`, `usergroupchange`, `deleteusergroup`, `accountcreate`, `accountchange`, `accountremove`, `login`, `userWebState`, `recording`, `notify`, `stopped` 等。

### 3. 共发现多少个 `msg.type`？

在 `{ action: "msg", type: ... }` 二级通道中，共确认 **11 个核心分发子类型**（`views/default.handlebars:2882-2998`），涵盖：
`notify`（系统弹窗）、`console`（远程终端输出流）、`cpuinfo`（实时性能流）、`getclip`（剪贴板读取）、`setclip`（剪贴板设置与回执）、`ps`（进程快照）、`psinfo`（单进程性能明细）、`services`（系统服务列表）、`service`（单服务属性）、`userSessions`（多用户桌面会话选择）、`deskBackground`（壁纸切换状态）。

### 4. 哪些 action 同时用于请求和响应？

共有 **26 个常用 Action 存在双向同名对等复用**：

- **数据快照类**：`nodes`, `meshes`, `users`, `usergroups`, `events`, `recordings`, `files`, `previousLogins`, `wssessioncount`
- **状态与控制类**：`serverstats`, `servertimelinestats`, `serverversion`, `serverconsole`, `runcommands`, `poweraction`, `wakedevices`, `toast`, `getDeviceDetails`
- **管理变更类**：`adduser`, `edituser`, `deleteuser`, `createmesh`, `editmesh`, `deletemesh`, `deviceShares`, `createDeviceShareLink`, `removeDeviceShare`, `webrelay`
- **保活与连接**：`ping`, `pong`, `close`

### 5. 哪些响应不返回 `responseid`？

经过对重点核实的 11 种候选 Action 进行逐行代码核验，权威裁决如下：

1. **`events`**：**不返回 `responseid`**；原样回显 `tag: command.tag`（`meshuser.js:1114`）。
2. **`getDeviceDetails`**：**既不返回 `responseid` 也不返回 `tag`**；直接回送 `{ action: 'getDeviceDetails', data: output, type: type }`（`meshuser.js:5611`）。
3. **`meshes`**：**不返回 `responseid`**；原样回显 `tag: command.tag`（`meshuser.js:6480`）。
4. **`poweraction`**：**条件回显**；请求包含 `responseid` 时返回，未包含时仅返回 `{ action: 'poweraction' }`（`meshuser.js:3319`）。
5. **`previousLogins`**：**既不返回 `responseid` 也不返回 `tag`**；直接回送 `{ action: 'previousLogins', events: e }`（`meshuser.js:5121`）。
6. **`servertimelinestats`**：**既不返回 `responseid` 也不返回 `tag`**；仅返回 `{ action: 'servertimelinestats', events: docs }`（`meshuser.js:7136`）。
7. **`usergroups`**：**不返回 `responseid`**；原样回显 `tag: command.tag`（`meshuser.js:1577`）。
8. **`users`**：**成功态仅返回 `tag`**（`meshuser.js:7290`）；**仅当权限不足（Access denied）时才会回显 `responseid`**（`meshuser.js:7280`）。
9. **`wakedevices`**：**成功时不返回任何直接响应**；仅在单设备目标出现无效节点等错误时回显 `responseid`（`meshuser.js:2971`）。
10. **`wssessioncount`**：**不返回 `responseid`**；原样回显 `tag: command.tag`（`meshuser.js:1260`）。
11. **`authcookie`**：**既不返回 `responseid` 也不返回 `tag`**；仅返回 `{ action: 'authcookie', cookie: '...', rcookie: '...' }`（`meshuser.js:6473`）。

### 6. 哪些写操作依赖后续 event 或快照回读确认？

- **`wakedevices`**：发送 WOL 唤醒成功后没有任何直接 RPC 响应，客户端必须依赖广播的 `event:turnon`（`msgid: 132`）和 `event:wakedevices` 事件作为成功确认。
- **所有 CRUD 实体写操作**（`adduser`, `createmesh`, `createusergroup`, `editmesh` 等）：虽然会返回一次性 `{ action: '...', result: 'OK' }`，但真实的状态更新（如列表中出现新条目）依赖随后的 `accountcreate`、`createmesh`、`usergroupchange` 等广播事件。

### 7. 哪些消息属于通知系统必须处理？

1. **终端用户求助**：`event.action == "agentlog"` 且 `event.msgid == 98`（携带 `msgArgs[0]` 请求人姓名和 `msgArgs[1]` 求助描述，必须高亮并支持一键发起远程桌面）。
2. **显式系统通知**：`action == "msg", type == "notify"` 与 `event.action == "notify"`（需按 `titleid` / `msgid` 查字典本地化，遵守 `maxtime` 自动销毁倒计时，并检查音效位）。
3. **设备连线/断开通知**：`event.action == "nodeconnect"`（根据用户的 `user.links[meshid].notify` 或覆盖规则判断是否显示 Toast 与声音）。
4. **即时通讯邀请**：`action == "msg", type == "notify"` 携带 `tag: "meshmessenger/..."`（聊天请求弹窗）。
5. **服务器健康警报**：`action == "serverwarnings"`（仅管理员可见的全量警报，需渲染于顶部告警栏）。

### 8. 哪些消息只应更新状态，不应显示通知？

- 设备属性变化：`changenode`, `nodemeshchange`, `sysinfohash`, `ifchange`
- 会话状态变化：`devicesessions`, `wssessioncount`
- 遥测与诊断流：`cpuinfo`, `console`, `ps`, `services`, `userWebState`
- 快照查询响应：`nodes`, `meshes`, `users`, `usergroups`, `events`, `recordings`, `files`, `getDeviceDetails`

### 9. 哪些消息必须触发重新登录或禁止自动重连？

1. **`action: "close"`**：当其 `cause` 为以下枚举值时，**必须清除本地 Token 并重置鉴权状态，严禁自动静默重连**：
   - `'noauth'`（凭证失效、密码错误或需进行 2FA 校验）
   - `'expired'`（Session Cookie 过期）
   - `'locked'`（账号被锁定）
   - `'banned'`（IP 遭服务器安全拉黑）
   - `'invalidorigin'`（Origin 跨域校验失败）
2. **`action: "stopped"`**：
   - 服务端被管理员强制停止或同一账号并发连接数超限（`Session count exceed`）。原生客户端进入 `setDialogMode(40)` 冻结界面，**禁止无退避自动重连**。

### 10. 哪些字段或语义仍未确认？

已完整整理于 `meshcentral-control-protocol/11-open-questions.md`：

- `meshagent.js:1358` 明确标注的代码竞态：当同一台被控机短时间内频繁触发求助（`msgid: 98`）时，服务端数据库读写未加锁，高并发下存在丢失单次说明的问题。
- 多服务器（MultiServer）集群模式下，部分 `meshuser.js:2116` 的用户间直接会话广播标记为 `// TODO: Add multi-server support`。
- `serverwarnings` 目前无差量推送机制，仅在连线初始化时全量发送一次。

### 11. 不同 MeshCentral 版本之间有哪些协议差异？

已完整整理于 `meshcentral-control-protocol/10-version-differences.md`：

- **调度层重构**：v1.2.5 引入了 `serverCommands` 注册表，将高频命令由单一大 `switch` 剥离为扁平字典调度。
- **模板 ID 废弃与演进**：`eventsMessageId` 历史上的多路复用桌面会话 ID 4 ~ 8 废弃，由 143 ~ 147 规范替代；`meshtype` 历史上接受字符串，当前版本强化为数字 2。
- **前端双版本**：经典 UI (`default.handlebars`) 与现代 UI (`default3.handlebars`) 共享完全一致的控制通道 WebSocket 协议层。

### 12. 当前 TypeScript 客户端最优先需要补齐哪些消息？

针对生产级 TypeScript SDK 与通知平台，最优先必须实现**互斥排队锁（Mutex Queue）**以处理既不返回 `responseid` 也不回显 `tag` 的 4 类操作（`authcookie`, `getDeviceDetails`, `servertimelinestats`, `previousLogins`），并提供统一的信封多路分发解包器（`action: "event"` 与 `action: "msg"`）。

---

## 二、三份分级实施优先级清单 (Implementation Roadmaps)

### P0：连接、鉴权、权限和数据一致性必需

- [x] **鉴权与连接握手状态机**：处理 WebSocket Upgrade、`x-meshauth` 内部协商、双因素校验拦截（`tokenrequired`）。
- [x] **生命周期断路器**：严格实现 `action: "close"` 的 `cause` 枚举判定（`noauth`, `expired`, `locked` 时禁止静默重连，防止死循环轰炸）。
- [x] **首推状态初始化器**：必须支持 `serverinfo` 与 `userinfo` 解析，提取 `features` 位掩码与当前域上下文。
- [x] **四项基础快照与标签关联**：
  - `meshes`（通过 `tag` 关联）
  - `nodes`（通过 `responseid` 或 `tag` 关联）
  - `users`（成功态依赖 `tag`，失败态依赖 `responseid`）
  - `usergroups`（通过 `tag` 关联）
- [x] **排队互斥锁机制**：对 `authcookie` 进行串行化调度，确保获取远程桌面/终端中继 Cookie 时无竞态覆盖。
- [x] **重连自愈全量补偿流水线**：检测到网络掉线重连后，自动挂起增量并重新拉取快照。

### P1：通知 MVP 和核心管理功能必需

- [x] **终端用户求助拦截器 (Help Request)**：精确匹配 `action: "event"` 且 `event.action == "agentlog"` 且 `event.msgid == 98`，提取求助人与正文，提供高亮 UI。
- [x] **系统弹窗通知通道**：全量实现 `action: "msg", type: "notify"` 与 `event.action: "notify"`，包含 `titleid` / `msgid` 本地字典查表、HTML 转义及 `maxtime` 自动倒计时销毁。
- [x] **双层通知位掩码过滤器**：
  - 客户端本地展示层掩码（音效 1、上线 2、下线 4、AMT 8、组名 16）；
  - 严格区分数值 `16` 的 7 种语义（设备组名 vs 邮件连线通知 vs 终端提示 vs 控制台权限等）。
- [x] **设备上下线事件响应**：订阅 `event.action == "nodeconnect"`，原子刷新内存节点的 `conn` 与 `pwr`。
- [x] **服务器健康告警面板**：支持 `action: "serverwarnings"` 数组的解析与 27 个稳定告警 ID 的本土化展示。
- [x] **基础设备控制**：支持带 `responseid` 的 `poweraction`, `toast`, `runcommands`。

### P2：高级功能、调试和插件扩展

- [x] **会话录制审计流**：捕获 `event.action == "recording"` 与 `action: "recordings"` 快照，解析 MCREC 录制文件元数据。
- [x] **Agent 实时控制台与硬件遥测**：接收 `msg.type == "console"`、`cpuinfo`、`ps`、`services` 实时流。
- [x] **双向剪贴板同步器**：实现基于 `tag` 区分的 `msg.type == "getclip"` 与 `setclip`。
- [x] **WebRTC / 即时聊天协商**：支持 `meshmessenger` 邀请发送与 `/meshrelay.ashx?p=200` 独立中继调度。
- [x] **服务器运维控制台**：面向 Site Admin 的 `serverconsole` 远程交互。
- [x] **插件系统扩展管道**：`action: "plugin"` 消息转发与扩展生命周期钩子支持。

---

## 三、生成的协议工程文件全景索引

所有产出文件均可直接用于测试套件驱动、JSON Schema 契约校验及 SDK 类型生成：

```text
meshcentral-control-protocol/
  ├── 00-environment.md             # 目标版本（v1.2.5）、Git SHA、Node.js 与环境特征
  ├── 01-message-catalog.md          # 95 个 Action、34 个 Event、11 个 Msg 完整目录表
  ├── 02-request-correlation.md      # 12 项问答、11 个特殊 Action 裁决与串行化清单
  ├── 03-field-schemas.md            # 字段属性字典、数据来源、脱敏真实报文样本
  ├── 04-time-and-ordering.md        # 秒/毫秒度量衡矩阵、时序保证与快照竞态策略
  ├── 05-localization.md             # msgid 1~166 字典、弹窗 1~34 模板、格式化转义
  ├── 06-permissions-and-scopes.md   # Site/Mesh 权限位、作用域定向与服务端拦截位置
  ├── 07-notification-bitmasks.md    # 本地/服务端通知位掩码、数值 16 深度语义审计
  ├── 08-lifecycle.md                # 连接握手、2FA、Close/Stopped 判定与重连矩阵
  ├── 09-notification-semantics.md   # 求助 (msgid:98)、聊天、ServerWarnings、录制专题
  ├── 10-version-differences.md      # serverCommands 重构、UI v2 vs v3、历史废弃对照
  ├── 11-open-questions.md           # 数据库并发竞态、集群路由与已知缺陷清单
  ├── catalog.json                   # 96 条符合 ControlMessageCatalogEntry 的机器可读定义
  ├── schemas/                       # 12 份标准 JSON Schema 模式定义
  │     ├── serverinfo.schema.json
  │     ├── userinfo.schema.json
  │     ├── event.schema.json
  │     ├── msg-notify.schema.json
  │     ├── nodes.schema.json
  │     ├── meshes.schema.json
  │     ├── users.schema.json
  │     ├── usergroups.schema.json
  │     ├── serverwarnings.schema.json
  │     ├── close.schema.json
  │     ├── stopped.schema.json
  │     └── agentlog-help.schema.json
  └── fixtures/                      # 真实交互测试夹具
        ├── inbound/                 # 17 个服务端入站 JSON 测试用例
        ├── outbound/                # 17 个客户端出站请求 JSON 用例
        └── conversations/           # 8 条完整长链路交互交互用例
              ├── login-handshake.json
              ├── user-list-and-details.json
              ├── add-user-and-event.json
              ├── help-request-lifecycle.json
              ├── server-warnings-update.json
              ├── ws-stop-and-close.json
              ├── command-execution-flow.json
              └── clipboard-get-set.json
```
