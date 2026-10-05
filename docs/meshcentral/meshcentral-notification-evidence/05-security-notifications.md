# 05 - 账户与安全相关通知协议分析 (`Security Notifications`)

## 一、安全事件四级响应矩阵

在 MeshCentral 中，安全事件根据其严重程度被严格分流为四类响应行为：

| 安全事件类型 | 服务端触发源 | 客户端响应等级 | 原生处理链路 |
| --- | --- | --- | --- |
| **登录失败次数警告** | `meshuser.js:682` | **需要显示安全通知** | `msg/notify` (`titleid: 3`, `msgid: 12`)，进入通知中心并触发警报 |
| **2FA 恢复码未备份** | `default.handlebars:2524` | **需要显示安全通知** | 前端根据 `userinfo` 派生 `addNotification` (`tag: 'backupcodes'`) |
| **密码修改成功 / 失败** | `meshuser.js:1946~1995` | **需要显示安全通知** | `msg/notify` (`titleid: 4`, `msgid: 17~21`) |
| **邮箱验证完成** | `webserver.js:2168` | **需要显示安全通知** | `event.notify` (`title: 'Email verified'`) |
| **网盘存储超额** | `webserver.js:5072` | **需要显示安全通知** | `event.notify` (`title: 'Disk quota exceed'`) |
| **当前账户被锁定** | `meshuser.js:1562` | **需要强制退出** | 服务端下发 `'close'` 事件，连接物理断开，销毁会话 |
| **当前账户被删除** | `meshuser.js:1368` | **需要强制退出** | 服务端下发 `'close'` 事件，连接物理断开，重置鉴权 |
| **登录 Token 被撤销** | `meshuser.js:430` | **需要强制退出** | `ws.HandleEvent` 拦截匹配当前 `loginToken`，立即 `obj.close()` |
| **权限变更 / 用户组变更** | `meshuser.js:1558` | **静默更新账户状态** | `accountchange` 事件，热更新内存中 `userinfo`，重构 UI 树 |
| **其他用户登录/退出** | `webserver.js:946, 1558` | **仅更新界面在线状态** | 更新 `users[id].login`，不弹出通知扰民 |

---

## 二、典型安全通知报文深度解析

### 1. 登录失败告警 (`msgid: 12`)

当用户成功登录后，服务端在创建 WebSocket 会话时查询历史失败次数并下发：

```json
{
  "action": "msg",
  "type": "notify",
  "title": "Security Warning",
  "tag": "ServerNotify",
  "id": 0.9023418291,
  "value": "There has been 3 failed login attempts on this account since the last login.",
  "titleid": 3,
  "msgid": 12,
  "args": [
    3
  ]
}
```

- **生命周期**：单次下推。客户端接收后作为常规通知存入通知中心，用户可手动清除或随 `maxtime` 销毁。

### 2. 2FA 恢复码未备份警告（前端派生）

当管理员登录后，如果检测到已启用单因子（如仅绑定了 Authenticator App）但未生成备用码：
- 客户端执行：
  ```javascript
  addNotification({
      text: "Please add two-factor backup codes. If the current factor is lost, there is no way to recover this account.",
      title: "Two factor authentication",
      tag: "backupcodes"
  });
  ```
- **点击交互**：点击直接调用 `account_manageOtp(0)` 呼出备用验证码生成对话框。

### 3. 当前账户被管理员锁定 (`SITERIGHT_LOCKED`)

在 `meshuser.js` 第 1560~1563 行：
```javascript
if ((chguser.siteadmin) && (chguser.siteadmin !== SITERIGHT_ADMIN) && (chguser.siteadmin & 32)) {
    // If the user is locked out of this account, disconnect now
    parent.parent.DispatchEvent([chguser._id], obj, 'close');
}
```
- **服务端行为**：向该用户所有的活跃 WebSocket 派发 `'close'` 事件；
- **传输层响应**：`ws.HandleEvent` 执行 `delete req.session; obj.close(); return;`；
- **前端表现**：WebSocket 触发 `onStateChanged(0)`，显示断开面板，`autoReconnect` 无法恢复。

### 4. 登录 Token 被撤销 (`loginTokenChanged`)

在 `meshuser.js` 第 429~430 行：
```javascript
if ((req.session.loginToken != null) && (typeof event == 'object') && (event.action == 'loginTokenChanged') && (event.removed != null) && (event.removed.indexOf(req.session.loginToken) >= 0)) {
    delete req.session;
    obj.close();
    return;
}
```
- **机制**：通过特定 Login Token 登录的浏览器会话，一旦该 Token 在账户设置中被删除，服务端内部事件监听器即刻切断该会话，实现精准的安全吊销。

### 5. 权限变动更新 (`accountchange`)

当用户站点权限、设备配额或所属用户组被管理员调整时，服务端广播：

```json
{
  "action": "event",
  "event": {
    "etype": "user",
    "action": "accountchange",
    "domain": "",
    "userid": "user//admin",
    "username": "Administrator",
    "msgid": 66,
    "msgArgs": [
      "TargetUser"
    ],
    "msg": "Account changed: TargetUser",
    "account": {
      "_id": "user//targetuser",
      "name": "TargetUser",
      "siteadmin": 1024,
      "groups": [
        "ugrp//group1"
      ]
    }
  }
}
```

- **前端消费**（`views/default.handlebars:3505`）：
  若 `account._id == userinfo._id`：
  1. 更新内存 `userinfo`；
  2. 触发 `updateSiteAdmin()` 与 `updateSelf()`，界面按钮动态置灰或解锁；
  3. 若用户组改变，自动向服务端补发 `{ action: 'users' }` 与 `{ action: 'wssessioncount' }`；
  4. **该事件不生成通知卡片，保障界面的静默平滑过渡**。
