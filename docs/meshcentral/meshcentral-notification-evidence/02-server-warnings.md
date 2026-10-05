# 02 - 服务端系统告警与配置变更分析 (`serverwarnings` 与 `serverinfochange`)

## 一、`serverwarnings` 协议规范

### 1. 判别方式与触发机制

- **顶层 action**：`"serverwarnings"`
- **是否主动推送**：是（仅在 WebSocket 连接建立初始阶段推送一次）
- **触发逻辑**（`meshuser.js` 第 673~676 行）：
  ```javascript
  if (user.siteadmin === SITERIGHT_ADMIN) {
      ...
      // Send any server warnings if any
      var serverWarnings = parent.parent.getServerWarnings();
      if (serverWarnings.length > 0) {
          try { ws.send(JSON.stringify({ action: 'serverwarnings', warnings: serverWarnings })); } catch (ex) { }
      }
  }
  ```

### 2. 完整脱敏样本

```json
{
  "action": "serverwarnings",
  "warnings": [
    {
      "msg": "Agent hash checking is being skipped, this is unsafe.",
      "id": 9
    },
    {
      "msg": "Invalid Let's Encrypt names, unable to resolve: example.com",
      "id": 14,
      "args": [
        "example.com"
      ]
    }
  ]
}
```

### 3. 字段表

| 字段路径 | 类型 | 必填 | 含义 | 单位/格式 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `action` | string | 是 | 指令名称 | 固定为 `"serverwarnings"` | `confirmed` |
| `warnings` | Array | 是 | 告警对象列表（全量快照） | 数组 | `confirmed` |
| `warnings[].id` | number | 否 | 告警枚举编号 (1~27) | 整数 | 绝大多数为整数 ID，极个别动态注入可能无 ID |
| `warnings[].msg` | string | 是 | 默认英文告警描述 | 纯文本 | 后备文本，前端字典无法匹配时展示该内容 |
| `warnings[].args` | Array | 否 | 格式化占位符实参 | 字符串/数值数组 | 替换 `{0}`, `{1}` 等 |

---

## 二、关键问题核心回答

### 1. `warnings` 是完整快照还是增量？

- **全量快照 (Full Snapshot)**。
- 服务端内存中由 `const serverWarnings = [];` 统一收集启动期与环境配置产生的全部告警。当下推时，将整个数组完整下发。

### 2. `warnings[].id` 的真实类型是什么？

- **真实类型为 `number`（整数）**。
- 取值范围对应服务端 `meshcentral.js` 中定义的常量枚举值（当前主干涵盖 1 ~ 27）。在特殊历史代码中如果直接 `push("string")`，前端也有容错逻辑 `if (typeof y == 'string')`，但标准生成器 `addServerWarning` 始终注入 `{ msg: msg, id: id, args: args }`。

### 3. 每个 warning 是否有严重级别、标题或修复地址？

- **严重级别**：无服务端字段。在前端一律以红色粗体呈现（`<div style=color:red><b>WARNING: ...</b></div>`），语义等价于 `warning` 或 `error`。
- **标题**：无独立标题，标题在客户端硬编码为 `"WARNING: "`。
- **修复地址**：无直接跳转 URL。

### 4. 空数组是否代表清除全部告警？

- **否**。
- 服务端发送逻辑判断为：`if (serverWarnings.length > 0)`。
- **若不存在告警，服务端完全不发送 `serverwarnings` 消息**，因此网络中不会出现 `{ "action": "serverwarnings", "warnings": [] }`。

### 5. 只在登录初始化时发送，还是配置变化后也会重新发送？

- **仅在会话建立初始阶段单次发送**。
- 服务端运行时修改并不会动态二次广播 `serverwarnings`。若管理员需要查看最新状态，可通过控制台指令 `info` 获取（其中 `info.warnings` 携带同样的数据），或刷新页面重新建立连接。

### 6. 哪些权限的用户会收到？

- **仅限超级站点管理员（Site Administrator）**：
  校验条件严格为：`user.siteadmin === SITERIGHT_ADMIN`（即 `0xFFFFFFFF`）。普通用户及设备组管理员绝对不会收到此消息。

### 7. 原生前端如何展示、关闭和重新显示？

- **展示位置**：
  原生 Web 前端**并不将 `serverwarnings` 放入右上角通知中心（Notification Center）**，也不会弹出 Toast。
  它直接渲染在 **"My Server"（我的服务器）面板中的专用卡片 `#serverWarningsDiv` 下的 `#serverWarnings` 容器中**。
- **关闭与重新显示**：
  原生 UI 没有提供针对单个 warning 的关闭/隐藏按钮。只要容器被填充，进入 My Server 页面即可持续看到。

### 8. 全部 27 种告警类型清单与触发条件

源码依据：`meshcentral.js` 第 4272~4300 行与 `views/default.handlebars` 第 2627~2655 行：

| ID | 国际化模板文案 | 服务端触发条件 |
| --- | --- | --- |
| `1` | `""` (保留) | 保留位 |
| `2` | `Missing WebDAV parameters.` | 配置了 WebDAV 但缺失必要认证或路径参数 |
| `3` | `Unrecognized configuration option "{0}".` | `config.json` 中配置了无法识别的键名 |
| `4` | `WebSocket compression is disabled, this feature is broken in NodeJS v11.11 to v12.15 and v13.2` | 运行在特定存在缺陷的 Node.js 版本上导致 WS 压缩被迫关闭 |
| `5` | `Unable to load Intel AMT TLS root certificate for default domain.` | 默认域的 Intel AMT TLS 根证书加载失败 |
| `6` | `Unable to load Intel AMT TLS root certificate for domain {0}.` | 指定域 `{0}` 的 Intel AMT TLS 根证书加载失败 |
| `7` | `CIRA local FQDN's ignored when server in LAN-only or WAN-only mode.` | 服务器配置为 LAN/WAN-only 模式，配置的 CIRA 局部 FQDN 被忽略 |
| `8` | `Can't have more than 4 CIRA local FQDN's. Ignoring value.` | CIRA 局部 FQDN 配置超过 4 个限制 |
| `9` | `Agent hash checking is being skipped, this is unsafe.` | 配置中开启了 `ignoreAgentHashCheck` 跳过终端 Hash 校验 |
| `10` | `Missing Let's Encrypt email address.` | 开启 Let's Encrypt 证书申请但未提供邮箱 |
| `11` | `Invalid Let's Encrypt host names.` | Let's Encrypt 绑定的域名格式非法 |
| `12` | `Invalid Let's Encrypt names, can't contain a *.` | Let's Encrypt 域名中含有通配符 `*` |
| `13` | `Unable to setup Let's Encrypt module.` | `greenlock` 模块加载或初始化异常 |
| `14` | `Invalid Let's Encrypt names, unable to resolve: {0}` | 域名 `{0}` 无法通过公共 DNS 解析 |
| `15` | `Invalid Let's Encrypt email address, unable to resolve: {0}` | 注册邮箱 MX/域名无法解析 |
| `16` | `Unable to load CloudFlare trusted proxy IPv6 address list.` | 启用了 Cloudflare 反代但拉取其 IPv6 白名单失败 |
| `17` | `SendGrid server has limited use in LAN mode.` | 局域网模式下配置 SendGrid |
| `18` | `SMTP server has limited use in LAN mode.` | 局域网模式下配置 SMTP |
| `19` | `SMS gateway has limited use in LAN mode.` | 局域网模式下配置短信网关 |
| `20` | `Invalid "LoginCookieEncryptionKey" in config.json.` | Cookie 加密私钥长度不符合规范要求 |
| `21` | `Backup path can't be set within meshcentral-data folder, backup settings ignored.` | 备份输出目录设在数据目录内部，导致死循环风险 |
| `22` | `Failed to sign agent {0}: {1}` | 终端二进制签名或代码签名失败 |
| `23` | `Unable to load agent icon file: {0}.` | 自定义终端图标文件丢失或损坏 |
| `24` | `Unable to load agent logo file: {0}.` | 自定义终端 Logo 文件丢失或损坏 |
| `25` | `This NodeJS version does not support OpenID.` | Node 版本不支持 OpenID 鉴权模块 |
| `26` | `This NodeJS version does not support Discord.js.` | Node 版本不支持 Discord 模块 |
| `27` | `Firebase now requires a service account JSON file, Firebase disabled.` | Firebase 推送未提供服务账号 JSON 密钥文件 |

---

## 三、`serverinfochange` 协议分析

### 1. 判别方式与完整脱敏样本

- **顶层 action**：`"event"`
- **event.action**：`"serverinfochange"`
- **完整脱敏样本**：
  ```json
  {
    "action": "event",
    "event": {
      "action": "serverinfochange",
      "lock2factor": true,
      "nolog": 1,
      "domain": ""
    }
  }
  ```

### 2. 字段定义表

| 字段路径 | 类型 | 必填 | 含义 | 格式/示例 |
| --- | --- | --- | --- | --- |
| `action` | string | 是 | 顶层指令 | `"event"` |
| `event.action` | string | 是 | 事件类型 | `"serverinfochange"` |
| `event.lock2factor` | boolean | 是 | 是否全局锁定/强制启用双因子认证 | `true` / `false` |
| `event.nolog` | number | 否 | 是否不入库事件日志 | `1` |
| `event.domain` | string | 否 | 所属域 | `""` |

### 3. 触发场景与业务影响

- **触发场景**：
  管理员在控制台执行 `2falock set` 或 `2falock clear` 时触发（`meshuser.js` 第 7721、7726 行）：
  ```javascript
  parent.parent.DispatchEvent(['server-allusers'], obj, { action: 'serverinfochange', lock2factor: true, nolog: 1, domain: domain.id });
  ```
- **是否会导致重新发送 `serverwarnings`**：**否**。
- **是否生成通知中心通知**：**否**。
- **前端处理行为**（`views/default.handlebars` 第 3429 行）：
  ```javascript
  case 'serverinfochange': {
      if (message.event.lock2factor != null) {
          serverinfo.lock2factor = message.event.lock2factor;
          updateSelf();
          updateSiteAdmin();
      }
      break;
  }
  ```
- **对登录态与会话的影响**：
  不中断当前会话，但前端立刻更新账户设置界面中 2FA 相关按钮的可编辑状态（例如禁用删除双因子认证等操作）。

---

## 四、服务端 TLS 证书过期通知（隐式告警）

在 `serverinfo` 消息中携带了 `serverinfo.certExpire`（时间戳）：
原生前端逻辑（`views/default.handlebars` 第 2688~2694 行）：

```javascript
if (serverinfo.certExpire != null) {
    var days = Math.floor((serverinfo.certExpire - Date.now()) / 86400000);
    if ((days >= 0) && (days < 20)) {
        QH('serverCertWarnings', '<div style=color:red;padding-bottom:6px><b>' + "WARNING: " + format("Certificate expires in {0} day(s)", days) + '</b></div>');
        QV('serverWarningsDiv', true);
        addNotification({ text: format("Certificate expires in {0} day(s)", days) });
    }
}
```

- **结论**：当服务端证书剩余有效期不足 20 天时，前端**不仅在 My Server 告警栏显示，还会显式调用 `addNotification` 将其送入通知中心，触发右上角未读数与桌面通知**。
