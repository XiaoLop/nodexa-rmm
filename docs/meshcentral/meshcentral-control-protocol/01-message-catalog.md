# 01 - 完整控制消息目录 (Message Catalog)

本文档系统梳理 MeshCentral WebSocket 控制通道（`/control.ashx`）所支持的全部顶层 action、二级分发类型（`action: "event"` 的 `event.action`、`action: "msg"` 的 `type`）及关键判别参数。

所有定义均对应机器可读的 `catalog.json`，并标明了方向、交付语义、所属域、请求关联方式、权限等级与源码证据位置。

---

## 一、目录统计概览

- **顶层 Action 发现总数**：95 个（含服务端 `processWebSocketData` 独立分支 42 个、`serverCommands` 注册表 53 个、双向复用 18 个）。
- **`action: "event"` 下属 `event.action` 动作数**：34 个核心业务事件。
- **`action: "msg"` 下属 `type` 动作数**：11 个核心子类型。
- **双向对等或请求/响应同名 Action**：`nodes`, `meshes`, `users`, `usergroups`, `events`, `files`, `recordings`, `serverversion`, `serverstats`, `servertimelinestats`, `serverconsole`, `runcommands`, `poweraction`, `wakedevices`, `toast`, `adduser`, `edituser`, `deleteuser`, `createmesh`, `editmesh`, `deletemesh`, `deviceShares`, `createDeviceShareLink`, `removeDeviceShare`, `webrelay`, `ping`, `pong` 等。

---

## 二、消息分类详细列表

### 1. 连接初始化与服务器状态 (Server & Connection)

| Action | 方向 | 交付语义 | 领域 | 请求关联 | 权限要求 | 源码证据位置 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `serverinfo` | S -> C | push | server | none | 无 (连接即推) | `meshuser.js:661`, `views/default.handlebars:2682` | 连接建立后服务端主动推送首包，包含域标识、公网 FQDN、TLS 指纹、端口、功能特性位 |
| `userinfo` | S -> C | push | user | none | 无 (连接即推) | `meshuser.js:664`, `views/default.handlebars:2716` | 连接建立后紧随 `serverinfo` 推送，包含当前用户 ID、姓名、站点权限位、组关联与订阅 |
| `traceinfo` | C -> S / S -> C | 全局设置 / 初始化快照 | server | none | `SITERIGHT_ADMIN` | `meshuser.js:648, 4566-4574`（1.1.54） | `traceSources: string[] / null` 是当前启用来源，不是全部可用来源；修改完整替换实例全局设置，另通过 `event/traceinfo` 广播变更 |
| `trace` | S -> C | stream | server | none | `SITERIGHT_ADMIN` | `meshcentral.js:3952-3963`（1.1.54） | `source: string`、`args: unknown[]`、`time: number`（毫秒）；本地取消监听不修改全局设置 |
| `servererrors` | C -> S / S -> C | request / response | server | action（串行） | 站点更新权限及域错误日志开关 | `meshuser.js:6811-6814`（1.1.54） | `data?: string`；缺失无法区分文件不存在和读取失败，权限拒绝可静默 |
| `serverclearerrorlog` | C -> S | fire-and-forget | server | none | 站点更新权限 | `meshuser.js:6782-6785`（1.1.54） | 异步删除 `mesherrors.txt`，无 ACK；回读不构成删除成功证明 |
| `serverwarnings` | S -> C | push | server | none | `SITERIGHT_ADMIN` | `meshuser.js:675`, `views/default.handlebars:2625` | 管理员连线时若存在配置风险或告警，推送完整快照数组 |
| `serverstats` | S -> C | push / response | server | responseid | `user.siteadmin & 21` | `meshuser.js:545, 5819`, `views/default.handlebars:2621` | 定时或按需拉取服务器运行时状态（CPU/内存、连接客户端数、Agent 错误计数器） |
| `servertimelinestats` | C -> S / S -> C | request / response | server | action | `user.siteadmin & 21` | `meshuser.js:7136`, `views/default.handlebars:2672` | 拉取服务器历史时间线统计数据，**不返回 responseid 或 tag** |
| `serverversion` | C -> S / S -> C | request / response | server | responseid | `SITERIGHT_SERVERUPDATE` | `meshuser.js:7153`, `views/default.handlebars:3089`, `meshctrl.js:1398` | 检查 MeshCentral 最新版本与稳定版本号，原样回传 `responseid` |
| `serverconsole` | C -> S / S -> C | command / output stream | server | 可选 tag，无通用完成标记 | `SITERIGHT_ADMIN` | `meshuser.js:6787-6808`（1.1.54） | `value` 为命令或输出；不回传 responseid，部分异步输出不保留 tag；禁止 loginToken 会话调用 |
| `ping` / `pong` | 双向 | stream / push | connection | none | 无 | `meshuser.js:145-150`, `meshuser.js:5806-5807` | 控制通道心跳维持与双向保活检测 |
| `close` | 双向 | request / push | connection | none | 无 | `meshuser.js:5791`, `webserver.js:7442-9365` | 主动断开连接，服务端推流时附带 `cause` 与 `msg` |
| `stopped` | S -> C | push | connection | none | 无 | `meshuser.js:398, 8028`, `meshcentral.js:2403` | 服务端关闭、管理员强制踢出或并发会话超限时发送的阻断性消息 |

---

### 2. 核心实体快照拉取 (Snapshots)

| Action | 方向 | 交付语义 | 领域 | 关联字段 | 权限要求 | 源码证据位置 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `nodes` | C -> S / S -> C | request / response | device | `responseid`, `tag` | 组可读权限 | `meshuser.js:720, 855`, `views/default.handlebars:2762` | 获取受管设备列表，支持按 `meshname`/`meshid` 过滤及分页 |
| `meshes` | C -> S / S -> C | request / response | device-group | **仅 `tag`** | 登录用户 | `meshuser.js:5805, 6480`, `views/default.handlebars:2735` | 获取用户有权访问的所有设备组，**不回显 responseid** |
| `users` | C -> S / S -> C | request / response | user | **成功仅 `tag`** | `user.siteadmin & 2` | `meshuser.js:5831, 7280`, `views/default.handlebars:2722` | 获取全量用户列表。**成功时仅返回 tag，只有 Access denied 时才返回 responseid** |
| `usergroups` | C -> S / S -> C | request / response | user-group | **仅 `tag`** | 登录用户 | `meshuser.js:1570, 1577`, `views/default.handlebars:2742` | 获取当前管理域下的用户组列表，**不回显 responseid** |
| `events` | C -> S / S -> C | request / response | audit | **仅 `tag`** | 组或全局审计权 | `meshuser.js:1094, 1114`, `views/default.handlebars:3145` | 获取历史审计事件记录，**不回显 responseid** |
| `recordings` | C -> S / S -> C | request / response | recording | `responseid`, `tag` | `SITERIGHT_RECORDINGS` | `meshuser.js:1191, 1215`, `views/default.handlebars:3158` | 获取服务器端已完成的会话录制文件列表 |
| `files` | C -> S / S -> C | request / response | file | **仅 `tag`** | 登录用户 | `meshuser.js:5795, 6440`, `views/default.handlebars:2756` | 获取用户或组的文件列表，**不回显 responseid** |
| `previousLogins` | C -> S / S -> C | request / response | audit | **无标识 (Action)** | 查看本人或管理员 | `meshuser.js:5109, 5121`, `views/default.handlebars:4192` | 获取指定用户或本人的历史登录 IP/UA 记录，**不回显 responseid/tag** |
| `wssessioncount` | C -> S / S -> C | request / response | session | **仅 `tag`** | `user.siteadmin & 2` | `meshuser.js:1222, 1260`, `views/default.handlebars:2730` | 统计所有在线用户的 WebSocket 会话数量，**不回显 responseid** |
| `authcookie` | C -> S / S -> C | request / response | auth | **无标识 (Action)** | 登录用户 | `meshuser.js:5788, 6473`, `views/default.handlebars:2676` | 获取中继/终端/桌面所需的临时令牌，**不回显 responseid/tag** |

---

### 3. 设备管理与远程控制命令 (Device Operations & Remote Control)

| Action | 方向 | 交付语义 | 领域 | 关联字段 | 权限要求 | 源码证据位置 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `getDeviceDetails` | C -> S / S -> C | request / response | device | **无标识 (Action)** | `MESHRIGHT_DEVICEDETAILS` | `meshuser.js:5266, 5611`, `views/default.handlebars:4215` | 导出硬件/BIOS/TPM/杀软等设备软硬件全量明细，**不回显 responseid** |
| `poweraction` | C -> S / S -> C | request / response | device | `responseid` (可选) | `MESHRIGHT_RESETOFF` | `meshuser.js:3267, 3319` | 电源操作（关机、重启、休眠、AMT 开机等） |
| `wakedevices` | C -> S / S -> C | request / response | device | 异常回显 / 成功事件 | `MESHRIGHT_WAKEDEVICE` | `meshuser.js:2955, 2971` | 发送网络唤醒包 (WOL)。**成功时不回传直接响应，仅通过广播事件确认** |
| `runcommands` | C -> S / S -> C | request / response | command | `responseid` | `MESHRIGHT_REMOTECOMMAND` | `meshuser.js:3087, 3230`, `meshctrl.js:1779` | 异步下发系统命令，标准输出通过 `action: "msg", type: "console"` 回流 |
| `toast` | C -> S / S -> C | request / response | notification | `responseid` | `MESHRIGHT_CHATNOTIFY` | `meshuser.js:3326, 3365`, `meshctrl.js:1989` | 向目标设备桌面弹送气泡提示通知 |
| `webrelay` | C -> S / S -> C | request / response | remote-control | `responseid` | 远程权限 | `meshuser.js:3045`, `meshctrl.js:1883` | 建立 Web 端口转发代理链接 |
| `changedevice` | C -> S / S -> C | request / response | device | `responseid` | `MESHRIGHT_MANAGECOMPUTERS` | `meshuser.js:3374`, `meshctrl.js:1763` | 修改设备名称、图标、备注等元数据 |
| `removedevices` | C -> S / S -> C | request / response | device | `responseid` | `MESHRIGHT_MANAGECOMPUTERS` | `meshuser.js:2860`, `meshctrl.js:1753` | 批量删除设备 |
| `changeDeviceMesh` | C -> S / S -> C | request / response | device | `responseid` | 两端设备组管理权限 | `meshuser.js:2742`, `meshctrl.js:1655` | 将设备转移至另一个设备组 |
| `createInviteLink` | C -> S / S -> C | request / response | device | `responseid` | `MESHRIGHT_MANAGECOMPUTERS` | `meshuser.js:4232`, `meshctrl.js:1728` | 生成 Agent 安装邀请链接 |
| `inviteAgent` | C -> S / S -> C | request / response | device | `responseid` | `MESHRIGHT_MANAGECOMPUTERS` | `meshuser.js:3575`, `meshctrl.js:1720` | 发送 Agent 安装邀请邮件 |

---

### 4. 实体变更与通知设置 (CRUD & Settings)

| Action | 方向 | 交付语义 | 领域 | 关联字段 | 权限要求 | 源码证据位置 | 说明 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `adduser` | C -> S / S -> C | request / response | user | `responseid` | `SITERIGHT_MANAGEUSERS` | `meshuser.js:5784, 6280`, `meshctrl.js:1452` | 创建用户，成功后引发全局 `accountcreate` 事件 |
| `edituser` | C -> S / S -> C | request / response | user | `responseid` | `SITERIGHT_MANAGEUSERS` (或本人) | `meshuser.js:1422, 1560`, `meshctrl.js:1467` | 修改用户，引发 `accountchange` 事件 |
| `deleteuser` | C -> S / S -> C | request / response | user | `responseid` | `SITERIGHT_MANAGEUSERS` | `meshuser.js:1263, 1370`, `meshctrl.js:1482` | 删除用户，引发 `accountremove` 事件 |
| `createmesh` | C -> S / S -> C | request / response | device-group | `responseid` | `!SITERIGHT_NONEWGROUPS` | `meshuser.js:2155, 2240`, `meshctrl.js:1591` | 创建设备组，引发 `createmesh` 事件 |
| `editmesh` | C -> S / S -> C | request / response | device-group | `responseid` | `MESHRIGHT_EDITMESH` | `meshuser.js:2363, 2470`, `meshctrl.js:1630` | 编辑设备组，引发 `meshchange` 事件 |
| `deletemesh` | C -> S / S -> C | request / response | device-group | `responseid` | `MESHRIGHT_EDITMESH` | `meshuser.js:2257, 2355`, `meshctrl.js:1601` | 删除设备组，引发 `deletemesh` 事件 |
| `createusergroup` | C -> S / S -> C | request / response | user-group | `responseid` | `SITERIGHT_USERGROUPS` | `meshuser.js:1586, 1695`, `meshctrl.js:1486` | 创建用户组，引发 `createusergroup` 事件 |
| `deleteusergroup` | C -> S / S -> C | request / response | user-group | `responseid` | `SITERIGHT_USERGROUPS` | `meshuser.js:1703, 1780`, `meshctrl.js:1494` | 删除用户组，引发 `deleteusergroup` 事件 |
| `changemeshnotify` | C -> S / S -> C | request / response | notification | `responseid` | 拥有该组权限且未锁定设置 | `meshuser.js:1823, 1847` | 设置设备组级事件提醒掩码（WebPage / 邮件 / 消息网关） |
| `changeusernotify` | C -> S / S -> C | request / response | notification | `responseid` | 拥有该设备权限且未锁定设置 | `meshuser.js:1876, 1900` | 设置单设备级事件提醒掩码覆盖 |
| `meshmessenger` | C -> S | request | chat | none | `SITERIGHT_MANAGEUSERS` 或 `MESHRIGHT_CHATNOTIFY` | `meshuser.js:2094-2154` | 发起用户间或用户对设备的聊天邀请 |

---

### 5. `action: "event"` 核心二级动作表 (`event.action`)

所有该类消息均包装在外层 `{ action: "event", event: { action: "<event.action>", ... } }` 中推送：

| `event.action` | 业务实体类型 (`etype`) | 核心承载字段 | 客户端状态处理建议 | 源码证据位置 |
| :--- | :--- | :--- | :--- | :--- |
| `nodeconnect` | `node` | `nodeid`, `meshid`, `conn`, `pwr`, `time` | 更新设备在线状态、连接类型与电源状态，视通知位弹 Toast | `meshcentral.js:2581`, `views/default.handlebars:3847` |
| `addnode` | `node` | `node`, `nodeid`, `meshid`, `msgid: 57` | 插入新设备至设备树，更新组统计 | `meshagent.js:880`, `views/default.handlebars:3668` |
| `removenode` | `node` | `nodeid`, `meshid`, `msgid: 87` | 从状态树中移除设备，关闭对应视图 | `db.js:290`, `views/default.handlebars:3689` |
| `changenode` | `node` | `node`, `nodeid`, `meshid` | 更新设备属性（名称、IP、操作系统、图标等） | `meshagent.js:2035`, `views/default.handlebars:3709` |
| `nodemeshchange` | `node` | `nodeids`, `oldmeshid`, `newmeshid` | 跨组移动设备节点，重新分配父节点 | `meshuser.js:2852`, `views/default.handlebars:3808` |
| `devicesessions` | `node` | `nodeid`, `sessions` | 更新设备的活动远程桌面/终端/文件传输会话标记 | `meshagent.js:1863`, `views/default.handlebars:3993` |
| `sysinfohash` | `node` | `nodeid`, `hash` | 触发设备详细软硬件信息的后台差量刷新 | `meshagent.js:1432`, `views/default.handlebars:3981` |
| `ifchange` | `node` | `nodeid`, `netif` | 更新设备网卡列表与 IP 地址 | `meshagent.js:1308`, `views/default.handlebars:3988` |
| `agentlog` | `node` | `nodeid`, `msgid`, `msgArgs`, `msg` | **`msgid: 98` 为求助请求，必须高亮显示通知并支持点击跳转** | `meshagent.js:1338`, `views/default.handlebars:3440` |
| `recording` | `relay` | `filename`, `size`, `nodeid`, `meshid` | 录制完成事件，追加到录制列表 | `meshrelay.js:845`, `views/default.handlebars:3450` |
| `createmesh` | `mesh` | `mesh`, `meshid`, `name`, `links` | 状态树新增设备组 | `meshuser.js:2236`, `views/default.handlebars:3588` |
| `meshchange` | `mesh` | `meshid`, `name`, `desc`, `links` | 更新设备组属性与用户组授权 | `meshuser.js:2447`, `views/default.handlebars:3597` |
| `deletemesh` | `mesh` | `meshid`, `name` | 移除设备组并级联清理组内设备 | `meshuser.js:2294`, `views/default.handlebars:3648` |
| `createusergroup` | `ugrp` | `ugrpid`, `name`, `desc`, `links` | 新增用户组 | `meshuser.js:1690`, `views/default.handlebars:3554` |
| `usergroupchange` | `ugrp` | `ugrpid`, `name`, `links` | 更新用户组及成员关联 | `meshuser.js:1338`, `views/default.handlebars:3555` |
| `deleteusergroup` | `ugrp` | `ugrpid`, `name` | 删除用户组 | `meshuser.js:1766`, `views/default.handlebars:3577` |
| `accountcreate` | `user` | `account`, `userid`, `username` | 新增用户账号记录 | `meshuser.js:6282`, `views/default.handlebars:3501` |
| `accountchange` | `user` | `account`, `userid`, `username` | 更新用户属性、密码、2FA 状态及个人设置 | `meshuser.js:1556`, `views/default.handlebars:3502` |
| `accountremove` | `user` | `userid`, `username` | 移除用户账号 | `meshuser.js:1367`, `views/default.handlebars:3547` |
| `login` | `user` | `userid`, `username`, `ip`, `userAgent` | 用户登入审计记录 | `webserver.js:1553`, `views/default.handlebars:3926` |
| `userWebState` | `user` | `state` | 跨页面同步用户的 UI 偏好设置 (夜间模式/排序等) | `meshuser.js:4172`, `views/default.handlebars:3454` |
| `notify` | `notification` | `value`, `title`, `icon`, `maxtime` | 显式通知推流，弹窗显示并按 `maxtime` 自动消失 | `views/default.handlebars:3961` |

---

### 6. `action: "msg"` 核心二级子类型表 (`msg.type`)

所有此类消息通过 Agent 与管理端 WebSocket 间的桥接通道传递：

| `msg.type` | 方向 | 业务领域 | 核心字段 | 场景说明 | 源码证据位置 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `notify` | S -> C | notification | `title`, `value`, `titleid`, `msgid`, `args`, `icon`, `maxtime` | 系统级或 Agent 触发的直接弹窗通知 | `meshuser.js:682`, `views/default.handlebars:2889` |
| `console` | S -> C | remote-control | `nodeid`, `value`, `source` | Agent 控制台输出、命令执行输出流 | `meshagent.js:1210`, `views/default.handlebars:2888` |
| `cpuinfo` | S -> C | device | `nodeid`, `cpu`, `memory` | 设备详情页 CPU 与内存实时利用率流 | `views/default.handlebars:2882` |
| `getclip` | 双向 | remote-control | `nodeid`, `data`, `tag` | 剪贴板读取（tag: 1=对话框, 2=手动, 3=自动同步） | `meshuser.js:1024`, `views/default.handlebars:2906` |
| `setclip` | 双向 | remote-control | `nodeid`, `data`, `success` | 远程设备剪贴板注入及完成确认 | `meshuser.js:1025`, `views/default.handlebars:2917` |
| `ps` | S -> C | device | `nodeid`, `data` | Agent 进程列表报文 | `views/default.handlebars:2900` |
| `psinfo` | S -> C | device | `nodeid`, `pid`, `value` | 单进程详细性能指标（句柄数、内存细项、时间） | `views/default.handlebars:2954` |
| `services` | S -> C | device | `nodeid`, `data` | Agent 系统服务状态列表 | `views/default.handlebars:2902` |
| `service` | S -> C | device | `nodeid`, `name`, `value` | 单服务属性明细与控制响应 | `views/default.handlebars:2904` |
| `userSessions` | S -> C | remote-control | `nodeid`, `data`, `tag` | 远端存在的活跃桌面会话（物理控制台/RDP多用户会话） | `views/default.handlebars:2921` |
| `tunnel` | C -> S | remote-control | `nodeid`, `value`, `servertlshash`, `soptions` | 驱动 Agent 建立反向中继通道以供控制端连接 | `meshuser.js:1029` |
