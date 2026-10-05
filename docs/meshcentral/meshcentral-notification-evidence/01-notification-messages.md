# 01 - 显式通知消息协议分析 (`event.notify` 与 `msg/notify`)

## 消息概述

在 MeshCentral WebSocket 通道（`/control.ashx`）中，存在两类主流的显式通知消息：

1. **事件派发包装通知 (`event.notify`)**：
   通过 `parent.DispatchEvent(...)` 广播或单播触发，在客户端表现为：
   ```json
   {
     "action": "event",
     "event": {
       "action": "notify",
       "title": "Email verified",
       "value": "user@example.com",
       "nolog": 1,
       "id": 0.5481748291
     }
   }
   ```
2. **会话级直接消息通知 (`msg/notify`)**：
   通过 `ws.send(...)` 直接发送或经由 `routeAgentCommand` / `parent.wssessions` 路由：
   ```json
   {
     "action": "msg",
     "type": "notify",
     "id": 0.8123912384,
     "title": "Security Warning",
     "value": "There has been 3 failed login attempts on this account since the last login.",
     "tag": "ServerNotify",
     "titleid": 3,
     "msgid": 12,
     "args": [3]
   }
   ```

---

## 一、关键问题逐项解答

### 1. 两种通知分别用于什么场景？

| 通知模式 | 适用场景 | 触发源 | 典型业务范例 |
| --- | --- | --- | --- |
| **`event.notify`** | 系统内部异步状态变更、全局/用户级生命周期事件广播或非请求即时回复的后台任务回执 | `DispatchEvent([user._id], ...)` | 邮箱激活完成（`Email verified`）、用户个人网盘超额（`Disk quota exceed`） |
| **`msg/notify`** | 1. 用户操作后会话级同步错误或提示提示回执<br>2. 用户间即时消息/群发广播<br>3. 跨端聊天邀请（Messenger）<br>4. 设备终端 Agent 执行 `notify "msg"` 命令行反馈<br>5. 登录初始化时的安全告警 | `meshuser.js` 内的 `displayNotificationMessage`、`serverCommandNotifyUser`、`serverCommandMeshMessenger`、`agent notify` | 密码修改成功/失败、邀请码冲突、聊天邀请（`msgid: 11`）、登录失败次数安全警告（`msgid: 12`）、多端通知清除同步 |

### 2. 完整字段结构与定义

#### 2.1 `event.notify` 字段表

| 字段路径 | 类型 | 必填 | 含义 | 格式/取值示例 | 置信度 |
| --- | --- | --- | --- | --- | --- |
| `action` | string | 是 | 顶层消息指令类型，固定为 `"event"` | `"event"` | `confirmed` |
| `event.action` | string | 是 | 内部事件指令类型，固定为 `"notify"` | `"notify"` | `confirmed` |
| `event.title` | string | 否 | 通知标题 | `"Email verified"`, `"Disk quota exceed"` | `confirmed` |
| `event.value` | string | 否 | 通知正文主干（若无模板时直接显示） | `"user@domain.com"`, `"filename.txt"` | `confirmed` |
| `event.icon` | number | 否 | 图标索引 | `0` (默认系统), `8` (用户), 或设备类型图标 | `confirmed` |
| `event.tag` | string | 否 | 去重/归类标签 | `"ServerNotify"`, `"desktop"` 等 | `confirmed` |
| `event.id` | number | 否 | 随机消息 ID（用于多端去重与清除） | `Math.random()` 浮点数 | `confirmed` |
| `event.nolog` | number | 否 | 是否禁止记录事件数据库 | `1` | `confirmed` |
| `event.maxtime` | number | 否 | 自动消失倒计时（单位：秒） | `10` | `high` |

#### 2.2 `msg/notify` 字段表

| 字段路径 | 类型 | 必填 | 含义 | 格式/取值示例 | 置信度 |
| --- | --- | --- | --- | --- | --- |
| `action` | string | 是 | 顶层消息指令类型，固定为 `"msg"` | `"msg"` | `confirmed` |
| `type` | string | 是 | 消息子类型，固定为 `"notify"` | `"notify"` | `confirmed` |
| `id` | number | 否 | 随机消息 ID | `0.4578129034` (`Math.random()`) | `confirmed` |
| `value` | string | 否 | 通知正文内容（后备非本地化文本） | `"Password changed."` | `confirmed` |
| `title` | string | 否 | 通知标题（后备非本地化文本） | `"Account Settings"`, 发送人名称 | `confirmed` |
| `titleid` | number | 否 | 国际化标题模板索引 (1~6) | `3` (Security Warning) | `confirmed` |
| `msgid` | number | 否 | 国际化正文模板索引 (1~34) | `12` (Failed login attempts) | `confirmed` |
| `args` | array | 否 | 国际化模板格式化参数列表 | `[3]`, `["user@example.com"]` | `confirmed` |
| `tag` | string | 否 | 标签/路由行为指示符 | `"ServerNotify"`, `"meshmessenger/user1/user2"` | `confirmed` |
| `icon` | number | 否 | 显示图标编号 | `0` (默认), `8` (用户) | `confirmed` |
| `userid` | string | 否 | 关联发起人或目标用户 ID | `"user//admin"` | `confirmed` |
| `username` | string | 否 | 发起人显示名称 | `"Administrator"` | `confirmed` |
| `domain` | string | 否 | 域标识 | `""` 或 `"domain2"` | `confirmed` |
| `url` | string | 否 | 点击外部重定向链接 | `"https://..."` | `confirmed` |
| `nodeid` | string | 否 | 关联设备 ID（Agent 转发来时附带） | `"node//..."` | `confirmed` |
| `maxtime` | number | 否 | 通知存活时间（单位：秒） | `5` | `confirmed` |
| `amtMessage` | boolean | 否 | 是否为 Intel AMT 远程重定向消息 | `true` | `confirmed` |

### 3. 哪些字段是必填、可选或版本相关？

- **必填字段**：
  - `event.notify`：顶层 `action: "event"`，`event.action: "notify"`。
  - `msg/notify`：顶层 `action: "msg"`，`type: "notify"`。
- **可选字段**：
  - `title`, `value`, `titleid`, `msgid`, `args`, `tag`, `icon`, `maxtime`, `id`, `url`, `userid`, `nodeid` 均为可选。
  - 若 `titleid` / `msgid` 缺省，则纯依赖 `title` / `value`；反之若提供 `titleid` / `msgid`，原生前端优先使用国际化模板解析并覆盖 `title` / `value`。
- **版本特征**：
  - MeshCentral 1.x 引入了 `titleid` (1~6) 和 `msgid` (1~34) 体系；早于 0.9.x 的旧版多使用纯字符串 `value`。

### 4. `title`、`value`、`msg` 分别有什么用途？

- **`title`**：通知卡片顶部的标题（粗体展示）。
- **`value`**：通知消息的主体正文（在未提供 `msgid` 时作为默认显示文案）。
- **`msg`**：
  - 在客户端发送给服务端的控制指令（如 `command.msg`）中，代表待发消息正文；
  - 服务端在组装下发给前端的通知包时，将其赋值给通知包的 `value` 字段：
    `var notification = { action: 'msg', type: 'notify', value: command.msg, ... }`；
  - 因此在下推给浏览器的通知包中，**正文字段统一为 `value`**，而不是 `msg`。

### 5. `titleid`、`msgid`、`args`、`msgArgs` 本地化完整映射

源码位置：`views/default.handlebars` 第 19601~19648 行 `addNotification(n)`。

#### 标题本地化表 (`translatedTitles`)

| `titleid` | 英文模板 | 含义 |
| --- | --- | --- |
| `1` | `New Account` | 新建账户 |
| `2` | `Server Limit` | 服务器限制 |
| `3` | `Security Warning` | 安全警告 |
| `4` | `Account Settings` | 账户设置 |
| `5` | `Device Group` | 设备分组 |
| `6` | `Invite Codes` | 邀请码 |

#### 消息正文本地化表 (`translatedMessages`)

| `msgid` | 英文模板（支持 `{0}`, `{1}` 参数占位符） | 含义 |
| --- | --- | --- |
| `1` | `Permission denied` | 权限不足 |
| `2` | `Invalid username` | 用户名非法 |
| `3` | `Invalid password` | 密码非法 |
| `4` | `Invalid email` | 邮箱非法 |
| `5` | `Invalid domain` | 域非法 |
| `6` | `Invalid site permissions` | 站点权限非法 |
| `7` | `User already exists` | 用户已存在 |
| `8` | `Unable to add user in this mode` | 当前模式下无法添加用户 |
| `9` | `Validation exception` | 校验异常 |
| `10` | `Account limit reached.` | 已达账户数量上限 |
| `11` | `Chat Request, Click here to accept.` | 收到聊天请求，点击接受 |
| `12` | `There has been {0} failed login attempts on this account since the last login.` | 自上次登录以来，存在 {0} 次失败的登录尝试 |
| `13` | `Failed to change email address, another account already using: {0}.` | 修改邮箱失败，已有其他账户使用：{0} |
| `14` | `Email sent.` | 邮件已发送 |
| `15` | `User {0} not found.` | 未找到用户 {0} |
| `16` | `Users {0} not found.` | 未找到用户列表 {0} |
| `17` | `Error, unable to change to previously used password.` | 错误，无法使用曾用过的密码 |
| `18` | `Error, unable to change to commonly used password.` | 错误，无法使用弱密码/常见密码 |
| `19` | `Error, password not changed.` | 错误，密码未修改 |
| `20` | `Password changed.` | 密码修改成功 |
| `21` | `Current password not correct.` | 当前密码不正确 |
| `22` | `Error, invite code "{0}" already in use.` | 错误，邀请码 "{0}" 已被占用 |
| `23` | `SMS gateway not enabled` | 未启用短信网关 |
| `24` | `No user management rights` | 无用户管理权限 |
| `25` | `Invalid SMS message` | 非法短信内容 |
| `26` | `No phone number for this user` | 该用户未绑定手机号 |
| `27` | `SMS succesfully sent.` | 短信发送成功 |
| `28` | `SMS error` | 短信发送错误 |
| `29` | `SMS error: {0}` | 短信发送错误：{0} |
| `30` | `Email domain "{0}" is not allowed. Only ({1}) are allowed` | 不允许邮箱域名 "{0}"，仅限 ({1}) |
| `31` | `Invalid message` | 非法消息 |
| `32` | `Message succesfully sent.` | 即时消息发送成功 |
| `33` | `Message error` | 即时消息发送错误 |
| `34` | `Message error: {0}` | 即时消息发送错误：{0} |

- **参数注入规则**：
  若存在 `args` 数组（如 `args: [count]`），前端调用 `format(template, args[0], args[1], ...)` 完成占位符替换；
  对于事件日志（如 `agentlog`），其参数数组位于 `message.event.msgArgs`。

### 6. `icon` 的取值和含义

- `icon === 0` 或 `null`：默认通知图标（系统级）。
- `icon === 8`：用户头像图标（`images/notify/icons128-8.png`）。
- `icon === 1 ~ 7 / 9+`：设备类型图标（与 MeshCentral 设备类型一致，如服务器、笔记本、路由器等）。在 Web 页面内使用 CSS 类 `class="j" + icon` 渲染对应小图标，在桌面通知中读取 `/images/notify/icons128-[icon].png`。

### 7. `tag` 是去重键、替换键还是普通标签？

`tag` 承担三重语义：

1. **HTML5 Notification 替换键（OS 级去重/替换）**：
   传递给浏览器的 `new Notification(title, { tag: n.tag, ... })`。相同 `tag` 的新通知会直接**覆盖**操作系统的旧弹出浮窗，而不会层叠弹出。
2. **点击路由分发键**：
   - `"desktop"`：跳转至设备桌面控制台 (`gotoDevice(nodeid, 12)`)
   - `"terminal"`：跳转至终端控制台 (`gotoDevice(nodeid, 11)`)
   - `"files"`：跳转至文件管理器 (`gotoDevice(nodeid, 13)`)
   - `"intelamt"`：跳转至 Intel AMT 设置 (`gotoDevice(nodeid, 14)`)
   - `"console"`：跳转至设备控制台 (`gotoDevice(nodeid, 15)`)
   - `"backupcodes"`：打开 2FA 备用验证码管理弹窗 (`account_manageOtp(0)`)
   - `"meshmessenger/..."`：呼出新窗口弹出独立 Messenger 界面 (`/messenger?id=...`)
3. **Web 内部通知列表（不进行列表去重）**：
   前端内部 `notifications.unshift(n)` 不对 `tag` 做剔除，同一标签的消息会按时间依次存留于下拉通知列表，直到被点击或超时删除。

### 8. `maxtime` 的单位和真实语义

- **单位**：**秒 (Seconds)**（源码明确：`setTimeout(trigger, n.maxtime * 1000)`）。
- **真实语义**：定时器触发后，调用 `notificationDelete(id)`：
  1. 从 DOM 列表中移除；
  2. 释放并关闭关联的桌面 HTML5 Notification 实例；
  3. 广播跨端跨标签页销毁消息 `{ action: 'intersession', subaction: 'removeNotify', id: id }`。

### 9. 是否存在严重级别字段？

- **结论**：**不存在服务端字段**。
- 服务端没有任何 `severity`、`level`、`alertType` 字段。
- 原生前端所有通知卡片统一使用黄色/橙色边缘装饰（`border-top: 1px solid orange`）。
- **客户端派生建议**：
  - `titleid === 3` 或 `msgid in [12, 17, 18, 19, 21, 28, 29, 33, 34]` $\rightarrow$ `severity: 'warning'` 或 `'error'`
  - `tag === 'backupcodes'` $\rightarrow$ `severity: 'warning'`
  - 其余常规提示 $\rightarrow$ `severity: 'info'`

### 10. 是否包含设备、设备组、用户或会话 ID？

- `nodeid`：包含于终端转发的 `msg/notify`、`nodeconnect`、`agentlog`，格式如 `"node//..."`。
- `meshid`：包含于组级通知或从 `node.meshid` 中反查。
- `userid` / `username`：包含于用户间操作、求助、聊天请求。
- `sessionId`：控制层通知通常在会话内部直接消费，多端同步通过 `intersession` 同步。

### 11. 点击后的目标页面与交互链路

源码位置：`views/default.handlebars:19557` `notificationSelectedEx(n, id)`：

```javascript
function notificationSelectedEx(n, id) {
    if (n.nodeid != null) {
        if (n.tag == 'desktop') gotoDevice(n.nodeid, 12);
        else if (n.tag == 'terminal') gotoDevice(n.nodeid, 11);
        else if (n.tag == 'files') gotoDevice(n.nodeid, 13);
        else if (n.tag == 'intelamt') gotoDevice(n.nodeid, 14);
        else if (n.tag == 'console') gotoDevice(n.nodeid, 15);
        else gotoDevice(n.nodeid, 10); // 默认打开 General (基本信息) 页面
    } else {
        if ((n.tag == 'backupcodes') && !xxdialogMode) {
            go(2); account_manageOtp(0); notificationDelete(id);
        } else if ((n.tag != null) && n.tag.startsWith('meshmessenger/')) {
            safeNewWindow('/messenger?id=' + n.tag + '&title=' + encodeURIComponentEx(n.username), n.tag.split('/')[2]);
            notificationDelete(id);
        } else if (n.url != null) {
            safeNewWindow(n.url);
            notificationDelete(id);
        }
    }
}
```

### 12. 哪些用户会收到？服务端权限检查位于何处？

1. **`event.notify`**：
   由 `parent.DispatchEvent(targets, obj, event)` 触发，`targets` 显式限定为 `[user._id]` 或特定组。进入 `ws.HandleEvent`（`meshuser.js:437`）校验域隔离与 `MESHRIGHT_LIMITEVENTS`。
2. **`msg/notify`**：
   - 跨用户通知 (`notifyuser`)：检查 `(user.siteadmin & 2) != 0`（用户管理权限），并检查是否属于同一用户组（`findOne(chguser.groups, user.groups)`）。
   - 跨用户聊天邀请 (`meshmessenger`)：同上，检查 `(user.siteadmin & 2) != 0`。
   - 设备聊天邀请：检查设备权限 `(rights & MESHRIGHT_CHATNOTIFY) != 0`（即 bitmask `0x00004000 = 16384`）。
   - 登录失败提示：仅针对当前登录成功的会话单播下发。

### 13. 原生 Web 前端完整表现行为

当 `addNotification(n)` 执行时：

1. **未读数徽标**：`setNotificationCount(notifications.length)`，右上角小红点/小黄点更新数字，背景变为 `orange`。
2. **通知卡片容器**：`clickNotificationIcon(true)` 自动展开右上角通知浮层（`#notifiyBox`），插入列表最顶部（`unshift`）。
3. **声音提示**：读取本地存储 `var notifySettings = getstore('notifications', 0);`，如果 `notifySettings & 1` 为真，执行 `Q('chimes').play()` 播放钟声提示音。
4. **HTML5 桌面通知**：
   若浏览器支持且已授权（`Notification.permission == 'granted'`），构造 `new Notification(...)`。
   - 标题：包含站点标题（`extitle`）、设备组名（若设置了 `notifySettings & 16`）及设备/通知标题。
   - 图标：读取对应的设备图标或类型大图。
   - 点击绑定：点击系统桌面通知浮窗触发 `notificationSelected(id, true)`。
5. **多端同步销毁**：
   当用户点击任意端右上角的 **X** 或 "Clear all" 时，向服务端发送：
   `{ action: 'intersession', subaction: 'removeNotify', id: id }`，服务端不落库、不广播他人，仅向该用户的其他活跃 WebSocket 转发，各端静默移除同一条通知。
