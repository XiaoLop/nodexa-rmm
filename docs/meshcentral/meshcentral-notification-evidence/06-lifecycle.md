# 06 - 服务端停止与连接生命周期协议分析 (`Lifecycle & Disconnection`)

## 一、断开场景全景矩阵

| 场景分类 | 断开前 JSON 消息 | 消息关键字段 | WebSocket Close Code / Reason | 允许自动重连 | 必须重新登录 | 清理状态范围 | 前端原生提示文案 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **服务器正常停止** | `action: "event"`, `event.action: "stopped"` | `msg: "Server stopped"` | 1000 / 1006 | **禁止** (`autoReconnect = false`) | 否（等待恢复） | 清除全部通知与设备状态 | `"Server stopped"` |
| **会话总数超限** | `action: "stopped"` | `msg: "Session count exceed"` | 1000 / 1006 | **禁止** (`autoReconnect = false`) | 是 | 清除全部通知与设备状态 | `"Session count exceed"` |
| **管理员强制踢出** | `action: "stopped"` | `msg: "Administrator forced disconnection"` | 1000 / 1006 | **禁止** (`autoReconnect = false`) | 是 | 清除全部通知与设备状态 | `"Administrator forced disconnection"` |
| **来源不合法 (Origin)** | `action: "close"` | `cause: "invalidorigin"`, `msg: "invalidorigin"` | 1000 / 1006 | **禁止** | 是 | 清除全部数据 | `"Invalid origin in HTTP request"` |
| **鉴权失败 / 凭证无效** | `action: "close"` | `cause: "noauth"`, `msg: "noauth"` (或 `badargs`, `nokey`) | 1000 / 1006 | **禁止** | 是 | 清除全部授权 | `"Unable to perform authentication"` |
| **需要 2FA 认证** | `action: "close"` | `cause: "noauth"`, `msg: "tokenrequired"`, `email2fa`, `sms2fa` | 1000 / 1006 | **禁止** | 是（进入2FA） | 清除控制通道数据 | 弹出 2FA 验证码输入框 |
| **邮箱待激活** | `action: "close"` | `cause: "emailvalidation"`, `msg: "emailvalidationrequired"` | 1000 / 1006 | **禁止** | 是 | 清除控制通道数据 | 提示需前往邮箱完成验证 |
| **会话自然超时 (Expired)** | `action: "close"` | `cause: "expired"`, `msg: "expired-1"` | 1000 / 1006 | **禁止** | 是 | 清除全部会话 | 返回登录页 |
| **IP 被封禁 / 锁定** | `action: "close"` | `cause: "banned"` 或 `"locked"` | 1000 / 1006 | **禁止** | 是 | 清除全部状态 | 提示账户已被封禁或锁定 |
| **当前账户被锁定** | 无（服务端直接派发 `'close'` 事件） | 无 | 1000 (正常物理关闭) | **禁止** | 是 | 销毁 Session，清空本地状态 | `"Unable to connect web socket"` |
| **当前账户被删除** | 无（服务端直接派发 `'close'` 事件） | 无 | 1000 (正常物理关闭) | **禁止** | 是 | 销毁全部用户数据 | `"Unable to connect web socket"` |
| **Token 被销毁** | 无（服务端直接断开） | 无 | 1000 (正常物理关闭) | **禁止** | 是 | 销毁 Session | `"Unable to connect web socket"` |
| **网络意外中断** | 无 | 无 | 1006 (Abnormal Closure) | **允许** (5秒轮询重试) | 否 | 保留本地缓存，轮询存活 | 顶栏显示重连倒计时 |

---

## 二、消息结构与协议实现

### 1. `action: "stopped"` 报文规范

#### 1.1 服务端停止广播模式
```json
{
  "action": "event",
  "event": {
    "etype": "server",
    "action": "stopped",
    "msg": "Server stopped"
  }
}
```

#### 1.2 会话控制强制踢出模式
```json
{
  "action": "stopped",
  "msg": "Administrator forced disconnection"
}
```

#### 1.3 客户端切断逻辑（`views/default.handlebars:4140`）
```javascript
case 'stopped': { // Server is stopping.
    autoReconnect = false;
    QH('p0span', message.msg);
    break;
}
```
**关键点**：`autoReconnect = false;` 彻底切断了后续定时重连循环（`serverPoll`），避免浏览器持续轰炸已被关闭或拒绝的服务端。

### 2. `action: "close"` 报文规范

#### 2.1 完整样本（鉴权失败 / 需二次认证）
```json
{
  "action": "close",
  "cause": "noauth",
  "msg": "tokenrequired",
  "email2fa": true,
  "sms2fa": false,
  "msg2fa": false,
  "email2fasent": true,
  "twoFactorCookieDays": 30
}
```

#### 2.2 客户端拦截逻辑（`public/scripts/meshcentral.js:50`）
```javascript
if (message.action == 'close') {
    if (message.msg) { console.log(message.msg); }
    obj.Stop(message.cause);
    return;
}
```

#### 2.3 状态机转换逻辑（`views/default.handlebars:2356`）
```javascript
if (errorCode == 'noauth') {
    QH('p0span', "Unable to perform authentication");
    return;
}
if (errorCode == 'invalidorigin') {
    QH('p0span', "Invalid origin in HTTP request");
    return;
}
if (prevState == 2) {
    if (autoReconnect) {
        setTimeout(serverPoll, 5000);
    }
} else {
    QH('p0span', "Unable to connect web socket");
}
```

---

## 三、客户端状态清除与安全防御原则

当遇到生命周期中断（`state == 0`）时，客户端**必须无条件执行以下安全重置流程**（参考 `views/default.handlebars:2343~2355`）：

1. **关闭所有模态对话框**：`setDialogMode(0)`，防止过期上下文敏感数据泄露；
2. **清除通知中心**：`deleteAllNotifications()`，排空内存中的通知队列，关闭已弹出的 OS 桌面通知；
3. **重置鉴权 Cookie 续期器**：清理 `authCookieRenewTimer`；
4. **清除设备共享与时间线上下文**：释放 `powerTimeline`、`deviceShares` 等数据结构；
5. **重定向界面**：强制切入 Disconnection 提示层（`go(0)`）。
