# 08 - 连接生命周期与异常关闭语义 (Lifecycle)

本模块系统分析 `/control.ashx` WebSocket 连接从握手建立、鉴权交互、保活心跳到异常中断的完整生命周期，并对所有关闭原因建立确凿的处置凭证。

---

## 一、连接全阶段生命周期流转

```text
[HTTP GET Upgrade /control.ashx]
              │
              ├── [Origin 检查失败] ──> { action:"close", cause:"invalidorigin" } ──> ws.close()
              ├── [3FA 密钥不符]   ──> { action:"close", cause:"noauth", msg:"nokey" } ──> ws.close()
              │
      (Cookie 鉴权)
              │
              ├── [未鉴权且携带 X-MeshAuth:*] ──> 启动内部握手 (serverAuth / userAuth)
              │                                      │
              │                                      ├── [密码错误] ──> { action:"close", cause:"noauth" }
              │                                      └── [需 2FA]  ──> { action:"close", cause:"noauth", msg:"tokenrequired" }
              │
      (用户鉴权成功)
              │
              ├── [并发会话超限] ──> { action:"stopped", msg:"Session count exceed" } ──> ws.close()
              │
      (进入就绪态 Session)
              │
              ├── [S -> C 首推] ──> serverinfo ──> userinfo ──> [traceinfo] ──> [serverwarnings]
              ├── [双向保活]   ──> ping <──> pong (默认由 args.browserping / pongtimer 驱动)
              │
      (业务运行中事件)
              │
              ├── [管理员强制注销] ──> { action:"stopped", msg:"Administrator forced disconnection" }
              ├── [服务端关机维护] ──> { action:"event", event:{ action:"stopped", msg:"Server stopped" } }
              └── [客户端主动登出] ──> { action:"close" } ──> ws.close()
```

---

## 二、生命周期事件处置证据矩阵 (Lifecycle Evidence Matrix)

| 触发场景 (Trigger) | WS Close Code | WS Close Reason | 最终控制通道报文 Action | 报文特征样本 | 是否允许自动重连 | 是否需要重新登录 | 清理授权凭证 | 证据来源 |
| :--- | :---: | :---: | :---: | :--- | :---: | :---: | :---: | :--- |
| **Origin 跨域校验失败** | 1000 / 1006 | 空 | `close` | `{ action: 'close', cause: 'invalidorigin', msg: 'invalidorigin' }` | **否** | 是 | 否 | `webserver.js:7442` |
| **无鉴权凭据 / 凭据失效** | 1000 / 1006 | 空 | `close` | `{ action: 'close', cause: 'noauth', msg: 'noauth' }` | **否** | **是** | **是** | `webserver.js:7454` |
| **需要双因素验证码 (2FA)** | 1000 | 空 | `close` | `{ action: 'close', cause: 'noauth', msg: 'tokenrequired', email2fa: true, ... }` | **否 (需等待输入Token)** | 是 | 保留用户名和中间状态 | `webserver.js:8950` |
| **邮箱验证待确认** | 1000 | 空 | `close` | `{ action: 'close', cause: 'emailvalidation', msg: 'emailvalidationrequired' }` | **否** | 是 | 否 | `webserver.js:8994` |
| **Cookie 会话过期** | 1000 | 空 | `close` | `{ action: 'close', cause: 'expired', msg: 'expired-1' }` | **否** | **是** | **是** | `webserver.js:9052` |
| **客户端 IP 被封禁** | 1000 | 空 | `close` | `{ action: 'close', cause: 'banned', msg: 'banned-1' }` | **否** | 是 | 否 | `webserver.js:9058` |
| **账户被锁定** | 1000 | 空 | `close` | `{ action: 'close', cause: 'locked', msg: 'locked-1' }` | **否** | 是 | **是** | `webserver.js:9073` |
| **并发会话数超限** | 1000 | 空 | `stopped` | `{ action: 'stopped', msg: 'Session count exceed' }` | **否 (重试间隔 30s+)** | 否 | 否 | `meshuser.js:398` |
| **管理员强制踢出** | 1000 | 空 | `stopped` | `{ action: 'stopped', msg: 'Administrator forced disconnection' }` | **否** | **是** | **是** | `meshuser.js:8028` |
| **服务端停机 / 重启** | 1000 | 空 | `event:stopped` | `{ action: 'event', event: { etype: 'server', action: 'stopped', msg: 'Server stopped' } }` | **允许 (退避重试)** | 否 (凭有效Cookie) | 否 | `meshcentral.js:2403` |
| **临时网络掉线 (Socket Drop)** | 1006 | 空 | 无 (底层 TCP RST) | 无 | **允许 (指数退避)** | 否 | 否 | 原生网络中断 |
| **客户端主动退出** | 1000 | "Normal Closure" | `close` | `{ action: 'close' }` | **否** | 是 | **是** | `meshuser.js:5791` |

---

## 三、`close` 与 `stopped` 的语义边界判定规则

在开发客户端 SDK 或自动化状态机时，必须严格区分以下三种关闭模式：

1. **`action: "close"`**：
   - 属于**认证协商与环境合规层**的消息。
   - 通常发生在连接刚刚建立或鉴权尚未完成的阶段。
   - 当 `cause` 为 `'noauth'`、`'expired'`、`'locked'`、`'banned'` 时，**绝对禁止自动无限重连**，必须立即终止重试并通知用户重新鉴权。
2. **`action: "stopped"`**：
   - 属于**业务运行态严重阻断**消息。
   - 原生前端会进入 `setDialogMode(40)` 阻断界面，锁定全部操作。
   - 严禁盲目静默重连，防止服务端因同一用户会话数超限（`maxusersessions`）陷入死循环踢出。
3. **原生 WebSocket `onclose`**：
   - 若在没有任何前置业务 `close`/`stopped` 报文的情况下触发了 `onclose`（且状态码通常为 `1006`），判定为纯网络闪断，应启用带抖动的指数退避重连算法（如 1s, 2s, 4s, 8s... 最多 30s）。
