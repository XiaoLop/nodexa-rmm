# 06 - 权限模型、作用域与分发过滤矩阵 (Permissions & Scopes)

MeshCentral 采用了严格的分层授权与域隔离模型。服务端在通过控制通道分发报文之前，必须在主会话与事件总线两层执行多重权限校验。

---

## 一、权限过滤与订阅机制问答

### 1. 哪些用户会收到特定事件？
- 仅当用户的会话满足以下条件之一时才会接收到事件：
  - 用户订阅了事件的广播标识（`user.subscriptions` 包含该 target）；
  - 事件直接定向给该用户（`targets` 包含 `user._id`）；
  - 事件关联的设备组被该用户拥有，且用户未设置 `MESHRIGHT_LIMITEVENTS`（限制事件权限）；
  - 用户为全局 Site Admin。

### 2. 服务端在哪个位置检查权限？
- **入站请求鉴权**：在 `meshuser.js:processWebSocketData` 和各个 `serverCommands` 函数开头（如 `user.siteadmin & SITERIGHT_MANAGEUSERS`、`parent.GetMeshRights(user, id)`）。
- **出站事件过滤**：在 `meshuser.js:428-489` 的 `ws.HandleEvent` 函数中进行最后的拦截与域隔离检查。

### 3. 消息是如何定向分发的？
- `DispatchEvent(targets, source, event)` 中的 `targets` 可以是：
  - `'*'`: 广播到所有已连接的 WebSocket；
  - `'server-users'`: 仅定向至拥有用户管理权限的管理端会话；
  - `'recording'`: 仅定向至正在查看录制面板的会话；
  - `mesh//<domain>/<id>`: 定向至对该设备组拥有读权限的会话；
  - `node//<domain>/<id>`: 定向至对该单台设备拥有读权限的会话；
  - `user//<domain>/<id>`: 仅定向至该具体用户的在线会话。

### 4. 权限被撤销后是否立即停止推送？
- **是**：当用户的权限发生变更时，服务端会发出 `resubscribe` 内部信号（`meshuser.js:440`），调用 `parent.subscribe(user._id, ws)` 动态重新计算会话的订阅列表；同时在 `ws.HandleEvent` 中实时通过 `parent.GetMeshRights(user, id)` 再次确认，撤权后下一次推送立即被切断。

### 5. 当前用户的 `accountchange` 是否会导致重新计算订阅？
- **是**：`accountchange` 会促发 `resubscribe`，更新 `user.subscriptions`。

### 6. 是否可能收到已经无权打开的目标通知？
- **极罕见竞态下可能**：如果权限刚刚在数据库撤销，但内存缓存与订阅尚未完成刷新的一瞬间，可能收到一条遗留事件；因此**客户端在打开详情页或执行写操作前，服务端在入口处仍会强制二次鉴权**。

### 7. 多个用户组授权如何合并？
- **按位或 (Bitwise OR) 累加**：如果用户直接链接赋予了一组权限，同时所属的两个用户组也分别链接了该设备组，最终有效权限为：
  `effectiveRights = directRights | userGroup1Rights | userGroup2Rights`。
  但只要其中任何一条给定了 `MESHRIGHT_ADMIN` (`0xFFFFFFFF`)，即拥有对该资源的完全控制权。

### 8. 管理员是否会无条件收到所有事件？
- **否**：跨 Domain 情况下，即便域 A 的管理员也是绝对隔离的；只有配置在 `config.settings.managecrossdomain` 列表中的超级管理员才能跨域收听选定系统事件（`accountcreate`, `accountremove`, `createusergroup`, `deleteusergroup` 等，见 `meshuser.js:28`）。

---

## 二、消息权限与作用域过滤矩阵

| 消息 (Action / Event) | 接收者范围 | 必需权限位 / 角色 | 作用域限定 | 服务端检查位置 | 客户端是否需二次校验 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `serverinfo` | 本连接用户 | 登录即送 | 本连接 | `meshuser.js:661` | 否 |
| `userinfo` | 本连接用户 | 登录即送 | 本连接 | `meshuser.js:664` | 否 |
| `traceinfo` | 管理员 | `SITERIGHT_ADMIN` (0xFFFFFFFF) | 当前域 | `meshuser.js:668` | 否 |
| `serverwarnings` | 管理员 | `SITERIGHT_ADMIN` (0xFFFFFFFF) | 当前域 | `meshuser.js:674` | 否 |
| `users` (列表) | 用户管理员 | `user.siteadmin & 2` (`MANAGEUSERS`) | 当前域 | `meshuser.js:7280` | 建议校验 |
| `serverconsole` | 超级管理员 | `user.siteadmin === 0xFFFFFFFF` | 当前域 | `meshuser.js:7175` | 是 |
| `runcommands` | 运维人员 | `MESHRIGHT_REMOTECOMMAND` (131072) | 目标设备 | `meshuser.js:287` | 是 |
| `poweraction` | 运维人员 | `MESHRIGHT_RESETOFF` (262144) | 目标设备 | `meshuser.js:287` | 是 |
| `wakedevices` | 运维人员 | `MESHRIGHT_WAKEDEVICE` (64) | 目标设备 | `meshuser.js:2955` | 否 |
| `event:nodeconnect` | 组授权用户 | `MESHRIGHT_REMOTECONTROL` 或可读 | 目标设备组 | `meshuser.js:463` | 否 |
| `event:agentlog` (求助) | 管理端用户 | 拥有该设备的任意查看权限 (`> 0`) | 目标设备 | `meshuser.js:463`, `default.handlebars:3443` | 是 (确保权限有效) |
| `event:recording` | 审计管理员 | `SITERIGHT_RECORDINGS` (512) | 录制所在组 | `meshuser.js:463` | 是 |
| `event:accountcreate` | 用户管理员 | `SITERIGHT_MANAGEUSERS` (2) | 当前域 | `meshuser.js:437` | 否 |
| `msg:notify` | 目标用户/设备 | 登录会话 | 用户/节点 | `meshuser.js:2113` | 否 |
