# MeshCentral 高级配置说明

本文档根据同目录下的 `sample-config-advanced.json` 整理，用于说明 MeshCentral 服务端配置文件的结构、启用方式和常见选项。当前工作区使用的 MeshCentral 版本以 `apps/meshcentral/package.json` 和锁文件为准；不同版本支持的字段可能略有差异，升级后应同时核对上游配置 Schema 和发行说明。

> 示例文件是“配置选项目录”，不是可直接用于生产环境的完整配置。示例中的域名、账号、密码、密钥、证书路径和第三方服务凭据均为占位值。

## 1. 配置文件位置

MeshCentral 默认从数据目录读取 `config.json`。常见位置如下：

- 默认安装：`meshcentral-data/config.json`
- Docker 部署：容器内通常为 `/opt/meshcentral/meshcentral-data/config.json`，具体取决于镜像和卷挂载方式
- 自定义数据目录：以启动参数或部署脚本指定的位置为准

修改配置后通常需要重启 MeshCentral 才会生效。正式使用前建议先备份原配置，并确认 JSON 语法有效。

## 2. 最重要的启用规则

示例文件大量使用以下划线开头的属性名：

```json
{
  "settings": {
    "_WANonly": true,
    "_sessionTime": 60,
    "port": 443
  }
}
```

MeshCentral 会忽略以下划线 `_` 开头的配置项。因此：

- `"port": 443` 已启用。
- `"_WANonly": true` 只是示例，当前不生效。
- 要启用某项，应删除属性名开头的下划线，例如将 `_sessionTime` 改为 `sessionTime`。
- `__comment__`、`___hide__` 等字段只是说明文字，也会被忽略。
- 不要一次性删除所有下划线。很多选项互斥，部分选项还需要外部服务、证书或有效凭据。

JSON 属性名大小写在语法上敏感。MeshCentral 的部分历史配置名使用了混合大小写，建议保持示例中的拼写，仅删除用于禁用选项的前导下划线。

## 3. 顶层结构

| 区块 | 用途 |
| --- | --- |
| `$schema` | 指向上游 JSON Schema，供编辑器补全和校验 |
| `settings` | 服务器进程、端口、数据库、代理、日志和 Agent 全局设置 |
| `domaindefaults` | 所有域的默认值 |
| `domains` | 默认域及多租户域的界面、认证、权限和远程访问设置 |
| `letsencrypt` | Let's Encrypt/ACME 自动证书申请 |
| `peers` | 多台 MeshCentral 服务器的对等集群配置 |
| `smtp`、`sendgrid`、`sendmail` | 邮件发送方式 |
| `sms` | 短信验证码或通知服务 |
| `messaging` | Telegram、Discord、ntfy 等消息服务 |

## 4. `settings`：全局服务器设置

### 4.1 服务器名称和监听端口

| 配置项 | 说明 |
| --- | --- |
| `cert` | 服务器对外使用的主机名，应与 TLS 证书和访问域名一致 |
| `port` | HTTPS 主端口，默认常用值为 `443` |
| `portBind` | HTTPS 监听地址；设为 `127.0.0.1` 时仅接受本机连接 |
| `aliasPort` | 对外公布的 HTTPS 端口，适用于反向代理或端口映射 |
| `redirPort` | HTTP 重定向监听端口，通常为 `80` |
| `redirPortBind` | HTTP 重定向服务的监听地址 |
| `redirAliasPort` | HTTP 服务对外公布的端口 |
| `relayPort`、`relayAliasPort`、`relayDNS` | 独立中继服务的监听端口、外部端口和域名 |
| `agentPort`、`agentAliasPort`、`agentAliasDNS` | Agent 使用独立入口时的监听与外部地址 |
| `exactPorts` | 要求客户端严格使用配置的端口，不自动推断其他端口 |

`WANonly` 和 `LANonly` 用于限制运行模式，通常不应同时启用。公网部署一般使用 `WANonly`；仅局域网发现和管理时才考虑 `LANonly`。

### 4.2 数据库

MeshCentral 可使用内置数据库，也可根据版本和部署需求启用 SQLite、MongoDB 或 AceBase：

| 配置项 | 说明 |
| --- | --- |
| `SQLite3` | 使用 SQLite 数据库 |
| `acebase` | 使用 AceBase；示例中的 `sponsor` 是相关附加选项 |
| `mongoDb` | MongoDB 连接字符串 |
| `mongoDbName` | MongoDB 数据库名称 |
| `mongoDbChangeStream` | 使用 MongoDB Change Stream，同步或集群场景可能需要 |
| `mongoDbBulkOperations` | 启用 MongoDB 批量操作 |
| `dbEncryptKey` | 数据库级加密密钥 |
| `dbRecordsEncryptKey` | 新写入敏感记录使用的加密密钥 |
| `dbRecordsDecryptKey` | 解密已有记录使用的密钥，常用于密钥轮换 |
| `dbExpire` | 各类历史数据的保留时间，单位为秒 |

`dbExpire` 示例中的 `events`、`powerevents`、`statsevents` 分别控制普通事件、电源事件和统计事件的保留时间。缩短时间可降低数据库增长速度，但会减少可查询历史。

加密密钥一旦投入使用，应通过密码管理系统妥善备份。丢失密钥可能导致已有数据无法解密，随意更换也可能造成服务不可用。

### 4.3 会话、Cookie 和浏览器连接

| 配置项 | 说明 |
| --- | --- |
| `sessionTime` | Web 登录会话有效时间，示例值为 `60` 分钟 |
| `sessionKey` | 会话签名或加密使用的服务端密钥 |
| `sessionSameSite` | Cookie 的 `SameSite` 策略，如 `strict` |
| `cookieIpCheck` | 是否将登录 Cookie 与客户端 IP 绑定；代理和移动网络环境需谨慎启用 |
| `cookieEncoding` | Cookie 编码方式 |
| `browserPing`、`browserPong` | 浏览器 WebSocket 心跳相关时间 |
| `allowLoginToken` | 是否允许登录令牌 |
| `allowFraming` | 是否允许页面被 iframe 嵌入 |
| `allowedFramingOrigins` | 允许嵌入页面的来源白名单 |
| `StrictTransportSecurity` | 是否发送 HSTS 相关响应头 |
| `nice404` | 是否显示友好的 404 页面 |

除非确有 iframe 集成需求，不建议启用 `allowFraming`。需要启用时，应同时配置严格的 `allowedFramingOrigins`，不要使用不受控的通配来源。

### 4.4 Agent 连接和更新

| 配置项 | 说明 |
| --- | --- |
| `agentPortTls` | Agent 独立端口是否使用 TLS |
| `agentPing`、`agentPong` | Agent 连接心跳时间 |
| `agentIdleTimeout` | Agent 空闲连接超时时间 |
| `agentsInRam` | 是否将 Agent 相关内容保存在内存中 |
| `noAgentUpdate` | 控制 Agent 自动更新行为 |
| `agentUpdateSystem` | 选择 Agent 更新机制 |
| `temporaryAgentUpdate` | 是否使用临时 Agent 更新模式 |
| `ignoreAgentHashCheck` | 忽略 Agent 文件哈希检查，生产环境不建议启用 |
| `agentSignLock` | 限制 Agent 签名行为 |
| `agentTimeStampServer` | Agent 签名使用的时间戳服务 |
| `agentTimeStampProxy` | 访问时间戳服务使用的代理 |
| `agentLogDump`、`agentCoreDump` | 启用 Agent 日志或核心转储 |
| `agentCoreDumpUsers` | 允许获取核心转储的用户列表 |
| `orphanAgentUser` | 孤立 Agent 归属的用户 |
| `lockAgentDownload` | 限制 Agent 下载 |

`ignoreAgentHashCheck` 会削弱完整性校验，只适合明确了解影响的开发或故障排查场景。

### 4.5 压缩、远程桌面和 WebRTC

| 配置项 | 说明 |
| --- | --- |
| `compression` | 启用 HTTP 内容压缩 |
| `wsCompression` | 启用浏览器 WebSocket 压缩 |
| `agentWsCompression` | 启用 Agent WebSocket 压缩 |
| `allowHighQualityDesktop` | 允许高质量远程桌面模式 |
| `desktopMultiplex` | 启用远程桌面复用能力 |
| `webRTC` | 启用 WebRTC 相关能力 |
| `webrtcConfig` | WebRTC ICE/STUN/TURN 服务器配置 |

公网或 NAT 环境启用 WebRTC 时，通常需要根据实际网络配置 STUN/TURN 服务。示例只包含公共 STUN，不保证所有网络都能建立点对点连接。

### 4.6 网络访问控制和反向代理

| 配置项 | 说明 |
| --- | --- |
| `userAllowedIP`、`userBlockedIP` | 限制 Web 用户来源 IP，可使用逗号分隔地址或 CIDR |
| `agentAllowedIP`、`agentBlockedIP` | 限制 Agent 来源 IP |
| `tlsOffload` | 声明由指定上游代理终止 TLS |
| `trustedProxy` | 受信任的反向代理地址 |
| `webRTC` | 是否允许 WebRTC 连接 |
| `npmProxy` | MeshCentral 使用 npm 时的 HTTP 代理 |
| `npmPath` | 自定义 npm 可执行文件路径 |

使用 Nginx、Traefik、Caddy 或云负载均衡器时，应准确设置 `trustedProxy`。范围过宽可能允许客户端伪造转发头，范围过窄则可能导致真实客户端 IP、审计日志和访问控制失效。

### 4.7 Intel AMT/MPS 和网络扫描

| 配置项 | 说明 |
| --- | --- |
| `mpsPort`、`mpsPortBind` | Intel AMT MPS 服务监听端口和地址 |
| `mpsAliasPort`、`mpsAliasHost` | MPS 对外端口和主机名 |
| `mpsTlsOffload` | MPS 是否由前置设备卸载 TLS |
| `mpsHighSecurity` | MPS 高安全模式 |
| `amtScanner` | 启用 Intel AMT 扫描 |
| `meshScanner` | 启用 Mesh 扫描 |
| `AmtProvisioningServer` | AMT 配置服务器参数 |

此类功能只应在确实管理 Intel AMT 设备且网络边界清晰时启用，并限制监听地址和防火墙入口。

### 4.8 日志、维护和生命周期脚本

| 配置项 | 说明 |
| --- | --- |
| `maintenanceMode` | 启用维护模式 |
| `log`、`debug` | 指定普通日志和调试日志类别 |
| `authLog` | 独立认证日志文件路径 |
| `syslog`、`syslogauth`、`syslogjson` | Syslog 日志标识或输出设置 |
| `syslogtcp` | Syslog TCP 服务地址 |
| `meshErrorLogPath` | Mesh 错误日志目录 |
| `runOnServerStarted` | 服务启动后执行的脚本 |
| `runOnServerUpdated` | 服务更新后执行的脚本 |
| `runOnServerError` | 服务发生错误时执行的脚本 |
| `watchDog` | 看门狗检查间隔和超时时间 |
| `selfUpdate` | 是否允许服务自更新 |
| `cleanNpmCacheOnUpdate` | 更新时清理 npm 缓存 |

生命周期脚本以服务账号权限运行，必须限制文件写权限，避免普通用户替换脚本后获得服务端执行权限。

### 4.9 登录保护和管理权限

| 配置项 | 说明 |
| --- | --- |
| `maxInvalidLogin` | 登录失败计数窗口、最大次数和冷却时间 |
| `maxInvalid2fa` | 双因素认证失败限制 |
| `no2FactorAuth` | 全局关闭双因素认证，公网生产环境不建议启用 |
| `InterUserMessaging` | 允许跨用户消息的账号列表 |
| `manageAllDeviceGroups` | 可管理全部设备组的账号列表 |
| `manageCrossDomain` | 可跨域管理的账号列表 |
| `userAllowedIP`、`userBlockedIP` | 全局用户访问 IP 规则 |

账号标识可能包含完整内部路径，例如 `user//admin`。配置特权账号时应以实际数据库中的用户标识为准。

### 4.10 自动备份

`autoBackup` 控制数据库备份、保留周期和外部存储：

- `backupIntervalHours`：备份间隔小时数。
- `keepLastDaysBackup`：本地备份保留天数。
- `backupPath`：本地备份目录。
- `zipPassword`：备份压缩包密码。
- `mongoDumpPath`：使用 MongoDB 时的 `mongodump` 路径。
- `googleDrive`：上传到 Google Drive，并限制最大文件数。
- `webdav`：上传到 WebDAV 服务。
- `s3`：上传到 S3 兼容对象存储。

备份成功不等于可恢复。应定期在隔离环境执行恢复演练，并避免在配置文件中长期保存明文云存储密钥；如部署平台支持，应改用密钥注入或受限服务账号。

### 4.11 其他全局能力

| 配置项 | 说明 |
| --- | --- |
| `webPush` | Web Push 联系邮箱等参数 |
| `publicPushNotifications` | 是否允许公共推送通知 |
| `localDiscovery` | 局域网发现中显示的服务器名称和信息 |
| `redirects` | 内置功能名称到外部 URL 的重定向 |
| `crowdsec` | CrowdSec 服务地址和 Bouncer API Key |
| `plugins` | 插件系统开关 |
| `ipBlockedUserRedirect` | 被 IP 规则阻止后的跳转地址 |
| `webPageLengthRandomization` | Web 页面长度随机化相关防护 |

## 5. `domaindefaults`：域默认值

`domaindefaults` 中的配置会作为所有域的默认值，再由 `domains` 中各域的设置覆盖。适合统一设置标题、页脚、注册策略等公共选项。

示例中该区块以下划线禁用。启用时应将顶层 `_domaindefaults` 改为 `domaindefaults`，并对内部需要生效的字段同样删除前导下划线。

## 6. `domains`：默认域和多租户域

`domains` 是 MeshCentral 最重要的业务配置区。空字符串键 `""` 表示默认域；其他键表示独立域或租户。

```json
{
  "domains": {
    "": {
      "title": "MyServer"
    },
    "customer1": {
      "dns": "customer1.example.com",
      "title": "Customer 1"
    }
  }
}
```

示例里的 `_customer1` 以下划线开头，因此该租户未启用。

### 6.1 品牌、界面和导航

| 配置项 | 说明 |
| --- | --- |
| `title`、`title2` | 页面主标题和副标题 |
| `titlePicture`、`loginPicture` | 标题区和登录页图片 |
| `pwaLogo` | PWA 图标或 Logo |
| `footer`、`loginfooter` | 主页面和登录页页脚内容 |
| `welcomeText`、`welcomePicture` | 登录页欢迎文字和图片 |
| `welcomePictureFullScreen` | 欢迎图片是否全屏显示 |
| `siteStyle` | 站点界面样式 |
| `showModernUIToggle` | 是否显示现代 UI 切换项 |
| `nightMode` | 夜间模式策略 |
| `mobileSite` | 移动站点相关开关 |
| `hide` | 使用位掩码隐藏页头、标签栏、页脚、标题、侧栏或返回按钮 |
| `scrollToTop` | 页面切换时是否滚动到顶部 |
| `collapseGroups` | 是否默认折叠设备组 |
| `showNotesPanel` | 是否显示备注面板 |
| `hidePowerTimeline` | 是否隐藏电源时间线 |
| `maxDeviceView` | 单次设备视图允许显示的最大设备数 |

`footer` 等字段可能包含 HTML。仅应由受信任管理员维护，避免注入不受控脚本或外部内容。

### 6.2 注册、账号和登录策略

| 配置项 | 说明 |
| --- | --- |
| `newAccounts` | 是否允许创建新账号 |
| `newAccountsUserGroups` | 新账号自动加入的用户组 |
| `newAccountsRights` | 新账号默认限制，如禁止建组或禁止工具功能 |
| `userNameIsEmail` | 是否要求用户名为邮箱格式 |
| `newAccountEmailDomains` | 允许注册的邮箱域名 |
| `loginKey` | 登录入口密钥，启用后访问登录页需要匹配密钥 |
| `agentKey` | Agent 接入密钥 |
| `unknownUserRootRedirect` | 未登录或未知用户访问根路径时的跳转地址 |
| `rootRedirect` | 根路径重定向地址 |
| `agentInviteCodes` | 是否启用 Agent 邀请码 |
| `twoFactorCookieDurationDays` | 记住双因素认证设备的 Cookie 有效天数 |

`loginKey` 和 `agentKey` 不是普通用户密码。启用后应使用高熵随机值，并通过受控渠道分发。

### 6.3 密码和双因素认证

`passwordRequirements` 可设置：

- `min`、`max`：密码最小和最大长度。
- `upper`、`lower`、`numeric`、`nonalpha`：大写、小写、数字和非字母字符要求。
- `reset`：密码重置周期。
- `force2factor`：强制双因素认证。
- `skip2factor`：可跳过双因素认证的可信 IP 或网段。
- `oldPasswordBan`：禁止重复使用的历史密码数量。
- `banCommonPasswords`：禁止常见弱密码。
- `twoFactorTimeout`：双因素验证超时。
- `duo2factor`：允许 Duo 双因素认证。

公网环境建议启用 `force2factor` 和 `banCommonPasswords`。`skip2factor` 应只包含严格控制的管理网络，不要填写过宽的网段。

### 6.4 权限、配额和会话限制

| 配置项 | 说明 |
| --- | --- |
| `userQuota` | 单个用户的文件存储配额，单位通常为字节 |
| `meshQuota` | 单个设备组的文件存储配额 |
| `manageAllDeviceGroups` | 可管理全部设备组的域内用户 |
| `limits.maxDevices` | 域内最大设备数 |
| `limits.maxUserAccounts` | 最大用户账号数 |
| `limits.maxUserSessions` | 最大用户会话数 |
| `limits.maxAgentSessions` | 最大 Agent 会话数 |
| `limits.maxSingleUserSessions` | 单个用户最大并发会话数 |
| `userSessionIdleTimeout` | 用户空闲多少分钟后断开 |
| `logoutOnIdleSessionTimeout` | 空闲超时后是退出登录，还是只断开远程会话 |
| `userSessionsSort` | 用户会话列表排序字段 |

### 6.5 远程桌面、终端、文件和用户同意

| 配置项 | 说明 |
| --- | --- |
| `novnc` | 是否允许 noVNC 功能 |
| `mstsc` | 是否允许 MSTSC/RDP 相关功能 |
| `ssh` | 是否允许 SSH 功能 |
| `guestDeviceSharing` | 是否允许访客设备共享 |
| `agentSelfGuestSharing` | Agent 自助访客共享及默认过期时间 |
| `allowSavingDeviceCredentials` | 是否允许保存设备凭据 |
| `userConsentFlags` | 对桌面、终端和文件会话启用通知、确认和隐私条 |
| `consentMessages` | 用户确认弹窗的标题、文案、超时和自动接受策略 |
| `notificationMessages` | 远程会话开始时显示的通知文案 |
| `desktopPrivacyBarText` | 远程桌面隐私条文字 |
| `terminal` | 远程终端 Shell 和各操作系统启动命令 |

`consentMessages.autoAcceptIfNoUser` 和 `autoAcceptOnTimeout` 会直接影响无人值守访问策略。启用前应确认组织的授权、审计和隐私要求。

### 6.6 会话录制

`sessionRecording` 用于记录远程会话：

| 配置项 | 说明 |
| --- | --- |
| `onlySelectedUsers` | 仅录制明确选中的用户 |
| `onlySelectedUserGroups` | 仅录制选中的用户组 |
| `onlySelectedDeviceGroups` | 仅录制选中的设备组 |
| `filepath` | 录制文件目录 |
| `index` | 是否为录制生成索引 |
| `maxRecordings` | 最大录制数量 |
| `maxRecordingDays` | 最大保留天数 |
| `maxRecordingSizeMegabytes` | 最大录制总大小或单项限制，具体语义以当前版本 Schema 为准 |
| `protocols` | 要录制的协议编号数组 |

示例说明的协议编号包括：`1` 终端、`2` 桌面、`5` 文件、`100` Intel AMT WSMAN、`101` Intel AMT Redirection、`200` Messenger。

录制内容可能包含屏幕、命令、文件名和敏感业务数据。应设置访问权限、保留周期、磁盘容量告警，并满足所在地的数据保护和员工告知要求。

### 6.7 Agent、助手和 Android 定制

| 配置项 | 说明 |
| --- | --- |
| `agentCustomization` | Agent 显示名称、说明、公司名、服务名、图片和安装文件名 |
| `agentFileInfo` | Windows Agent 文件图标和版本资源信息 |
| `assistantCustomization` | MeshCentral Assistant 的标题、图片和文件名 |
| `androidCustomization` | Android 客户端标题、副标题和图片 |
| `agentConfig` | 传给 Agent 的配置项数组 |
| `assistantConfig` | 传给 Assistant 的配置项数组 |
| `agentNoProxy` | Agent 是否绕过代理 |
| `lockAgentDownload` | 是否限制 Agent 下载 |

自定义 Agent 品牌或二进制文件信息后，通常需要重新生成或签名相关安装包。名称、服务名和文件名应避免特殊字符，并在目标操作系统上验证安装、升级和卸载流程。

### 6.8 预配置脚本和远程输入

`PreconfiguredScripts` 定义管理员可选择执行的脚本：

- `name`：界面显示名称。
- `file`：服务器上的脚本文件路径。
- `cmd`：直接执行的命令内容。
- `type`：如 `bat`、`sh` 或 `agent`。
- `runas`：以登录用户或 Agent 服务身份运行。

`PreconfiguredRemoteInput` 定义可快速发送到远程设备的固定文本。此类配置可能带来命令执行风险，只应向受信任角色开放，并避免在脚本或固定文本中写入密码、令牌等秘密。

### 6.9 MeshRouter 和外部链接

`deviceMeshRouterLinks` 控制设备页面上的快捷入口：

- `rdp`、`ssh`、`scp`：启用相应协议入口。
- `extralinks`：添加 HTTP/HTTPS 等自定义链接。
- `protocol`、`port`、`ip`：定义目标协议、端口和可选地址。
- `filter`：限制链接适用的设备组或节点。

不要把内网管理地址直接暴露给无权限用户。外部链接的权限过滤应和设备访问权限保持一致。

### 6.10 自定义静态文件和邮件模板

| 配置项 | 说明 |
| --- | --- |
| `customFiles` | 按作用域加载自定义 CSS 和 JavaScript |
| `WebEmailsPath` | 自定义邮件模板目录 |
| `urlSwitching` | URL 切换相关行为 |

自定义 JavaScript 在 MeshCentral 页面上下文中运行，应像服务端代码一样进行审查和版本控制。错误或被篡改的脚本可能影响所有登录用户。

### 6.11 Intel AMT 域级配置

| 配置项 | 说明 |
| --- | --- |
| `amtScanOptions` | 预定义的 AMT 扫描网段 |
| `amtAcmActivation` | ACM 激活日志、可信域名、证书链和私钥 |
| `amtManager.adminAccounts` | AMT 管理账号 |
| `amtManager.environmentDetection` | 环境检测域名列表 |
| `amtManager.wifiProfiles` | 下发给设备的 Wi-Fi 配置 |

AMT 管理密码、Wi-Fi 密码和私钥均属于高敏感信息。应限制配置文件读取权限，并优先使用独立、最小权限的凭据。

### 6.12 HTTP 响应头

`httpHeaders` 可添加自定义响应头，例如：

```json
{
  "httpHeaders": {
    "Strict-Transport-Security": "max-age=360000",
    "x-frame-options": "SAMEORIGIN"
  }
}
```

如果前方已有反向代理负责设置安全响应头，应避免重复或冲突。启用 HSTS 前必须确认站点可长期稳定通过 HTTPS 访问。

## 7. 外部身份认证 `authStrategies`

`authStrategies` 用于接入第三方身份提供方。示例包含 Twitter、Google、GitHub、Azure、JumpCloud、SAML 和 OIDC。

常见字段包括：

| 配置项 | 说明 |
| --- | --- |
| `callbackurl` | 身份提供方认证完成后的回调地址 |
| `clientid`、`clientsecret` | OAuth/OIDC 客户端凭据 |
| `newAccounts` | 是否允许首次登录自动创建账号 |
| `newAccountsUserGroups` | 自动创建账号加入的用户组 |
| `newAccountsRights` | 自动创建账号的默认限制 |
| `entityid`、`idpurl`、`cert` | SAML 服务提供方和身份提供方参数 |
| `tenantid` | Azure 租户 ID |

OIDC 配置分为：

- `issuer`：颁发者地址及可选登出端点。
- `client`：客户端 ID 和客户端密钥。
- `custom`：登录按钮文字和图标。
- `groups.required`：用户必须属于的外部组。
- `groups.siteadmin`：映射为站点管理员的外部组。
- `groups.sync`：外部组同步设置。
- `options.params`：传给认证请求的额外参数。

启用自动建号时，应同时配置最小权限的 `newAccountsRights`。将外部组映射为 `siteadmin` 前，必须确认身份提供方中的组管理权限和审计机制足够严格。

## 8. LDAP/SSPI 域配置

示例租户 `customer1` 展示了 LDAP/SSPI 相关字段：

| 配置项 | 说明 |
| --- | --- |
| `auth` | 域认证方式，如 `sspi` 或 `ldap` |
| `LDAPUserName` | LDAP 中用作显示名称的属性 |
| `LDAPUserKey` | LDAP 用户唯一键属性 |
| `LDAPUserEmail` | LDAP 邮箱属性 |
| `LDAPUserGroups` | LDAP 组成员属性 |
| `LDAPSiteAdminGroups` | 映射为站点管理员的 LDAP 组 |
| `LDAPUserRequiredGroupMembership` | 允许登录必须具备的组成员资格 |
| `LDAPSyncWithUserGroups` | LDAP 组与 MeshCentral 用户组同步规则 |
| `LDAPOptions.URL` | LDAP 服务地址 |
| `LDAPOptions.BindDN` | 查询目录使用的绑定账号 DN |
| `LDAPOptions.BindCredentials` | 绑定账号密码 |
| `LDAPOptions.SearchBase` | 用户搜索根 DN |
| `LDAPOptions.SearchFilter` | 用户搜索过滤器，可包含 `{{username}}` |

生产环境优先使用 LDAPS 或受保护的内部网络，并为绑定账号授予只读、最小范围权限。不要使用域管理员账号作为 LDAP 绑定账号。

## 9. Let's Encrypt/ACME

将顶层 `_letsencrypt` 改为 `letsencrypt` 后可启用自动证书申请。

| 配置项 | 说明 |
| --- | --- |
| `email` | ACME 账号联系邮箱 |
| `names` | 要申请证书的域名列表 |
| `skipChallengeVerification` | 是否跳过本地挑战预检 |
| `production` | `false` 通常表示测试环境，验证成功后再切换生产环境 |
| `rsaKeySize` | RSA 密钥长度 |
| `custom` | 自定义 ACME 服务地址及 EAB 凭据 |
| `zerossl` | ZeroSSL EAB 凭据 |

申请前应确保域名解析正确，公网能够访问挑战所需端口。建议先使用测试环境，避免因反复失败触发证书颁发机构的频率限制。

## 10. 多服务器集群 `peers`

`peers` 用于连接多台 MeshCentral 服务器：

```json
{
  "peers": {
    "serverId": "server1",
    "servers": {
      "server1": { "url": "wss://server1.example.com/" },
      "server2": { "url": "wss://server2.example.com/" }
    }
  }
}
```

每台服务器必须使用唯一的 `serverId`，并在 `servers` 中维护一致的节点列表。集群还依赖共享或可同步的数据层、证书信任、网络连通性和一致的关键配置，不能只添加该区块就视为完成高可用部署。

## 11. 邮件配置

MeshCentral 可选择一种适合部署环境的邮件发送方式。

### 11.1 SMTP

| 配置项 | 说明 |
| --- | --- |
| `host`、`port` | SMTP 服务器和端口 |
| `from` | 发件人地址 |
| `tls` | 是否连接后立即使用 TLS；STARTTLS 场景通常设置为 `false` |
| `tlscertcheck` | 是否校验 SMTP 服务器证书，生产环境不建议关闭 |
| `tlsstrict` | 是否使用更严格的 TLS 设置 |
| `emailDelaySeconds` | 邮件发送延迟或聚合时间 |

如 SMTP 服务器需要认证，还应根据当前版本 Schema 添加对应账号字段。

### 11.2 SendGrid

`sendgrid` 使用 `from`、`apikey` 和可选的 `emailDelaySeconds`。API Key 应限制为发送邮件所需的最小权限。

### 11.3 Sendmail

`sendmail` 使用本地 `sendmail` 程序：

- `newline`：换行格式。
- `path`：可执行文件路径。
- `args`：附加启动参数。
- `emailDelaySeconds`：发送延迟。

## 12. 短信配置 `sms`

示例展示了四种短信提供方，实际只能使用与 `provider` 匹配的一组参数：

- `twilio`：使用 `sid`、`auth` 和 `from`。
- `plivo`：使用 `id`、`token` 和 `from`。
- `telnyx`：使用 `apikey` 和 `from`。
- `url`：请求自定义 URL，并用 `{{phone}}`、`{{message}}` 替换手机号和消息。

短信接口凭据必须视为秘密。使用自定义 URL 时应采用 HTTPS，确认参数经过正确编码，并防止日志记录完整验证码或认证信息。

## 13. 消息服务 `messaging`

| 子区块 | 主要字段 | 用途 |
| --- | --- | --- |
| `telegram` | `apiid`、`apihash`、`session`、`useWSS`、`connectionRetries` | Telegram 集成 |
| `discord` | `serverurl`、`token` | Discord 集成 |
| `ntfy` | `host`、`userurl`、`authorization` | ntfy 通知服务 |

示例中的 `useWSS` 写成字符串 `"false"`。实际配置时应以当前版本 Schema 为准，确认该字段要求字符串还是布尔值，避免仅凭字面含义修改类型。

## 14. 最小配置示例

下面是便于本地验证配置结构的最小示例。域名、端口和安全策略应按实际部署调整：

```json
{
  "$schema": "https://raw.githubusercontent.com/Ylianst/MeshCentral/master/meshcentral-config-schema.json",
  "settings": {
    "cert": "mesh.example.com",
    "port": 443,
    "redirPort": 80,
    "sessionTime": 60,
    "sessionKey": "请替换为高熵随机密钥"
  },
  "domains": {
    "": {
      "title": "MeshCentral",
      "newAccounts": false,
      "passwordRequirements": {
        "min": 12,
        "force2factor": true,
        "banCommonPasswords": true
      }
    }
  }
}
```

如果 TLS 在反向代理终止，监听地址、端口、`tlsOffload`、`trustedProxy` 和外部域名需要按代理拓扑统一配置，不能直接照抄上述示例。

## 15. 生产环境检查清单

1. 使用正式域名和可信 TLS 证书，确认 `cert` 与外部访问地址一致。
2. 禁止公开数据库、MPS、Agent 独立端口和管理端口，使用防火墙限制来源。
3. 为 `sessionKey`、数据库加密密钥和第三方凭据生成独立的高熵随机值。
4. 不启用 `no2FactorAuth`，管理员账号强制双因素认证。
5. 保持 `newAccounts` 关闭，或严格限制注册邮箱域和新账号默认权限。
6. 正确配置 `trustedProxy`，只信任实际反向代理地址。
7. 保持证书校验、Agent 哈希校验开启，不使用 `ignoreAgentHashCheck`。
8. 为配置文件和数据目录设置最小文件系统权限。
9. 启用认证日志、登录失败限制和必要的集中日志告警。
10. 配置自动备份，并定期执行恢复演练。
11. 为录屏、日志和事件设置合理保留周期，监控磁盘与数据库容量。
12. 对自定义脚本、CSS、JavaScript、插件和生命周期脚本执行代码审查。
13. 不把真实密码、API Key、私钥或令牌提交到 Git 仓库。
14. 修改后先进行 JSON/Schema 校验，再在测试环境启动并检查日志。

## 16. 修改流程建议

1. 从 `sample-config-advanced.json` 中只复制需要的配置项。
2. 删除目标属性名开头用于禁用的下划线。
3. 替换所有示例域名、路径、账号和凭据。
4. 检查是否存在互斥设置，例如数据库类型、邮件提供方和运行模式。
5. 使用支持 JSON Schema 的编辑器校验字段名和类型。
6. 备份现有 `config.json`。
7. 在测试环境重启 MeshCentral，并检查启动日志、登录、Agent 上线和远程会话。
8. 验证通过后再部署到生产环境。

## 17. 参考资料

- 示例配置：`apps/meshcentral/docs/sample-config-advanced.json`
- 上游配置 Schema：<https://raw.githubusercontent.com/Ylianst/MeshCentral/master/meshcentral-config-schema.json>
- MeshCentral 上游项目：<https://github.com/Ylianst/MeshCentral>

上游 Schema 的 `master` 分支可能比当前安装版本更新。若字段校验结果与运行时行为不一致，应优先核对当前实际安装版本对应的源码、Schema 或官方文档。
