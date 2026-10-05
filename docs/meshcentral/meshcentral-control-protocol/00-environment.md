# 00 - 目标环境与基准配置

本协议证据包针对本地 MeshCentral 源码仓库与运行环境进行全量静态逆向与代码追踪分析，所有代码引用位置均对应本地实际文件与行号。

## 1. 目标系统基础信息

| 配置项 | 实测值 | 验证依据 |
| :--- | :--- | :--- |
| **MeshCentral 精确版本** | `1.2.5` | `package.json:3` (`"version": "1.2.5"`) |
| **Git Commit SHA** | `02eb8f71d2ce48bdbd59e4e4d4844b7edaf0e69d` | `git log -1` (`Fix: keyboard stops working after desktop reconnect (#8135)`) |
| **Git 分支** | `master` | `git status` |
| **Node.js 运行环境** | `v24.9.0` | `node -v` |
| **调查分析基准日期** | `2026-10-05` | 现场逆向时间 |

## 2. 架构配置与特性支持矩阵

| 架构特性 | 支持状态 | 源码位置 / 机制说明 |
| :--- | :--- | :--- |
| **根域 (Root Domain)** | 支持 (`""` 空字符串) | `meshuser.js:564`，默认域 `domain.id` 为空字符串，所有资源以 `mesh//...`、`node//...`、`user//...` 命名 |
| **多租户 / 多 Domain** | 完整支持 | `webserver.js:7440`，URL 前缀与 Cookie 识别 domain。资源标识包含域分段：`mesh/<domain>/<id>`、`node/<domain>/<id>`、`user/<domain>/<id>` |
| **插件系统 (Plugins)** | 完整支持 | `pluginHandler.js`，控制通道通过 `action: 'plugins'`、`pluginLatestCheck`、`installplugin` 等管理 |
| **外部身份认证 (LDAP/SSPI/OIDC)** | 完整支持 | `webserver.js:570`，`domain.auth` 支持 `'ldap'`、`'sspi'`；`serverinfo.domainauth` 与 `serverinfo.emailcheck` 动态下发 |
| **双因素认证 (2FA / MFA)** | 完整支持 | 支持 Email 验证码、SMS、Messaging、Duo、Authenticator (TOTP)、FIDO2/WebAuthn 及 YubiKey 硬件密钥 |
| **会话录制 (Session Recording)** | 完整支持 | `meshrelay.js:832`，支持 MCREC 格式与 WebM 视频转码录制，服务端索引及权限隔离 |
| **控制通道 WebSocket 路由** | `/control.ashx` | `webserver.js:7438` 挂载，由 `meshuser.js:CreateMeshUser` 实例化管理 |
| **辅助传输通道** | 支持 | `/meshrelay.ashx` (数据重定向)、`/devicefile.ashx`、`/agenttransfer.ashx` 等 |
| **扩展服务 (MQTT/AMT/Messenger)** | 完整支持 | `mqttbroker.js`、`amtmanager.js`、`meshmessaging.js`、`views/messenger.handlebars` |

## 3. 证据优先级与置信度规则

本证据包严格遵循五级置信度划分标准：

1. **`confirmed`（已证实）**：源码实现逻辑清晰明确，且与客户端处理分支或实际抓包报文完全一致。
2. **`high`（高置信度）**：服务端或原生 Web 客户端源码实现明确，字段与逻辑有代码断言，但尚未进行交互式黑盒流量抓包。
3. **`medium`（中置信度）**：已在客户端运行或报文中观察到，但在服务端分发链中存在多层动态回调或间接转发。
4. **`low`（低置信度 / 待验证）**：跨版本推断或仅见于历史代码注释，此类项全部记录于 `11-open-questions.md`。
