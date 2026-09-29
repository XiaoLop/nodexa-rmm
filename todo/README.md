# MeshCentral 控制台发布路线图与 TODO

> 本文以当前 Monorepo、生产部署契约和已实现代码为准，覆盖 `apps/web`、`apps/gateway`、`apps/meshcentral`、`packages/meshcentral-plugins`、`packages/control-client`、`packages/relay`、`packages/shared-state` 与 `deploy`。
>
> 当前生产目标不是由 Nest Gateway 代理全部 MeshCentral 协议。Web 通过同源 Nginx 入口访问认证、控制、Relay 和 Agent 资源；认证由运行在 MeshCentral 内的 `jsonauth` 插件提供，控制与 Relay 直接进入 MeshCentral。Nest Gateway 已存在，但尚未接入当前浏览器主链路。

## 状态约定

- `[ ]` 尚未开始或没有可验证实现
- `[~]` 已有代码或部署契约，但缺少集成、真实环境验证、测试或发布闭环
- `[x]` 已实现，并有足够代码或测试证据作为后续工作的稳定基础
- `[!]` 受目标 MeshCentral/Agent 协议、上游版本或当前架构限制

功能状态按以下层级分别评估：

| 层级    | 判断标准                                                     |
| ------- | ------------------------------------------------------------ |
| UI      | 页面、交互、加载、空数据、错误、断线和无权限状态完整         |
| Client  | `control-client`、`relay` 和 `shared-state` 已封装稳定接口   |
| Plugin  | `jsonauth` 等插件已复用 MeshCentral 原生认证、授权和事件能力 |
| Server  | MeshCentral、MongoDB、配置和持久卷行为明确                   |
| Proxy   | Nginx/Vite 路由、Cookie、WebSocket、Agent 和访问日志规则明确 |
| Tests   | 单元、集成、E2E 或真实 Agent 验证覆盖关键成功与失败流程      |
| Release | 镜像、配置生成、Secret、健康检查、升级和回滚形成闭环         |

---

## 当前架构基线

```mermaid
flowchart LR
  web[React Web]
  app[Expo App]
  proxy[Nginx / Vite 同源代理]
  auth[jsonauth 插件]
  mc[MeshCentral 1.1.54]
  mongo[(MongoDB)]
  agent[MeshAgent]
  gateway[Nest Gateway]

  web -->|HTTPS / WSS| proxy
  app -->|HTTPS / WSS| proxy
  proxy -->|/api/auth/*| auth
  proxy -->|/api/control.ashx| mc
  proxy -->|/api/meshrelay.ashx| mc
  proxy -->|/api/meshagents 与 /agent.ashx| mc
  auth --> mc
  mc --> mongo
  mc --> agent
  proxy -. 当前未接入主链路 .-> gateway
```

### 组件职责

- `apps/web`：浏览器控制台、登录与 MFA 页面、权限门控、设备和用户管理、远程桌面、终端与文件 UI。
- `apps/app`：Expo 移动端工程。当前仍以工程骨架和共享能力接入为主，不按 Web 完成度计算。
- `apps/gateway`：NestJS 服务，已实现候选登录代理、Swagger 和健康检查，但当前 Web `/api/auth/*`、控制与 Relay 流量不经过它。
- `apps/meshcentral`：固定并运行 MeshCentral `1.1.54`，构建镜像时安装仓库插件并修复上游运行文件。
- `packages/meshcentral-plugins`：提供 `jsonauth` 等 MeshCentral 插件；认证 API 复用原生账号、Session、限流、事件和认证日志。
- `packages/control-client`：无框架依赖的控制 WebSocket SDK、请求关联、重连、协议标准化和资源 API。
- `packages/relay`：`p=1` 终端、`p=2` 桌面和 `p=5` 文件 Relay SDK。
- `packages/shared-state`：Zustand 状态、选择器、React Hook 和控制客户端绑定。
- `deploy`：全局 YAML 配置契约、Compose、Secret 和生成配置的部署输入。

### 认证与数据边界

- Web 调用同源 `/api/auth/*`，由 MeshCentral 内的 `jsonauth` 插件处理，不经过 Nest Gateway。
- 登录成功后使用 MeshCentral 原生 HttpOnly Session Cookie 建立控制和 Relay 连接。
- 浏览器不把密码、认证 Cookie、登录 key 或长期管理 token 写入 Web Storage 或 WebSocket URL。
- MeshCentral 使用 MongoDB 持久化账号、设备、事件和配置。
- 当前没有独立于 MeshCentral 的控制台业务数据库；通知偏好、自定义规则和扩展审计没有额外持久化层。
- Nginx 是生产环境唯一公网入口，负责 TLS、静态 Web、HTTP/WSS、Relay、Agent 和下载流量分发。

### 必须尽快确定的架构决策

- [x] 生产登录由 MeshCentral `jsonauth` 插件承担，Nest Gateway 不参与浏览器认证主链路。
- [x] `config.example.yaml` 与 `deploy/config/production.example.yaml` 的 `proxy.routes.login` 均指向 MeshCentral。
- [x] Nest Gateway 保留为未来业务聚合层，不代理当前认证、控制或 Relay 主链路。
- [x] Gateway README、部署说明和 Compose 主链路依赖已按上述职责调整。
- [x] 控制 SDK、共享状态、Web/App Provider 与界面文案已统一为 MeshCentral 控制连接术语；旧环境变量名仅作为兼容回退。

---

## 当前实现基线

以下项目表示已有可复用实现，不等于已经满足生产发布定义。

### 服务端与部署

- [x] MeshCentral 上游版本固定为 `1.1.54`，升级可以显式执行和回归。
- [x] MeshCentral Docker 镜像构建和插件同步机制已经实现。
- [x] `jsonauth` 插件已提供登录、MFA 验证、退出、注册能力查询和注册 API。
- [x] 开发环境可通过 Vite 同源代理访问认证、控制、Relay 和 Agent 路径。
- [x] 生产 YAML Schema、Compose 服务边界、Secret 和持久卷契约已经定义。
- [x] MongoDB 基础设施 Compose 已可用于开发环境。
- [~] Nest Gateway 已实现登录候选接口、Swagger、存活和就绪检查，但未接入当前 Web 主链路。
- [~] 生产 Compose 已定义 `config-init`、MongoDB、MeshCentral、Gateway 和 Nginx，但缺少全部可运行镜像和配置生成器。

### Web、Client 与 Relay

- [x] Cookie 登录、TOTP、备用码、可信设备 Cookie、退出和注册流程已有实现。
- [x] 控制 SDK 已具备请求超时、心跳、退避重连、请求关联和主要资源 API。
- [x] 设备列表、设备组、用户、用户组及授权编辑已有实质页面和控制 API。
- [x] 实时与历史事件页面已支持筛选、合并、去重和脱敏原始数据查看。
- [x] 命令窗口支持单设备与批量目标、Shell、输出流和危险命令确认。
- [x] 远程终端、远程桌面和文件 Relay 的核心协议与 UI 已接入。
- [x] 文件浏览、上传、下载、新建、重命名、复制、移动、删除、ZIP 与多选操作已有实现。
- [x] 个人资料已支持头像、邮箱、密码、TOTP、邮件二次验证、备份码和 WebAuthn 管理。
- [~] Dashboard 已使用服务器统计和真实时间线数据，并区分加载、失败、断线、空数据和单采样状态；仍缺目标环境历史完整性验证。
- [~] 设备工作台概览已合并真实历史与实时设备事件，不再包含静态模拟事件；监控与安全等标签仍有占位内容。
- [~] 全局搜索、通知和帮助仅有界面入口或占位交互。

---

## 阶段 0：架构收敛与文档校准

**优先级：P0。目标：确保代码、配置、部署文档和路线图描述同一条生产链路。**

- [~] 按 UI、Client、Plugin、Server、Proxy、Tests、Release 七层重新盘点现有能力。Web 层已开始校准，服务端和部署层仍需逐项关联证据。
- [ ] 为复杂任务补充负责人、前置依赖、代码位置、协议依据、自动化测试和手工验证环境。
- [ ] 将“页面已实现”“SDK 已实现”“真实 MeshCentral/Agent 已验证”“生产可发布”拆分记录。
- [ ] 为认证、控制、Relay 和 Agent 协议关联脱敏夹具、测试文件或验证文档。
- [ ] 修正根 README、Gateway README、部署 README 和环境变量示例中的过时架构描述。
- [ ] 每次功能或架构变更同步更新本文，不再集中补写完成状态。

**阶段完成标准：** 登录、控制、Relay、Agent、配置和持久化流量均能定位到唯一生产路径，不存在互相冲突的配置示例。

---

## 阶段 1：生产部署闭环

**优先级：P0，当前最主要的发布阻塞项。**

### 1.1 配置生成器

- [ ] 实现 `config` CLI，读取全局 YAML、环境变量和 Docker secrets。
- [ ] 生成 `gateway.json`、`meshcentral.json`、`nginx.conf`、`web-runtime-config.json` 和 `manifest.json`。
- [ ] 使用 Schema 校验端口、Origin、路由、Cookie、MongoDB、Secret 路径、TLS 和持久卷配置。
- [ ] 全部生成成功后原子发布，禁止服务读取部分更新的配置。
- [ ] 在 manifest 中记录 Schema 版本、源配置哈希、目标 MeshCentral 版本和构建版本。
- [ ] 为开发、测试、预发布和生产配置准备可执行示例及错误示例测试。

### 1.2 生产镜像与编排

- [x] MeshCentral 镜像已经实现，并固定上游版本和插件构建输入。
- [ ] 实现 Web/Nginx 生产镜像，包含静态资源、运行时配置和代理配置加载。
- [ ] 实现 Gateway 生产镜像，并让 Gateway 实际读取生成的 `gateway.json`。
- [ ] 实现配置初始化器镜像和启动命令。
- [ ] 验证 `compose.production.yaml` 可从空环境完成启动、健康检查和登录。
- [ ] 验证 MongoDB、MeshCentral 数据、文件、备份和录制持久卷的升级与恢复。
- [ ] 增加镜像版本固定、SBOM、漏洞扫描和发布签名策略。

### 1.3 Nginx、TLS 与网络

- [ ] 生成并验证登录、控制、Relay、Agent 下载和 Agent WebSocket 路由。
- [ ] 验证 WebSocket Upgrade、长连接超时、上传体积、缓存和压缩规则。
- [ ] 验证证书链、HSTS、TLS 版本、反向代理信任层数和来源限制。
- [ ] 对 `/api/meshrelay.ashx`、`/agent.ashx` 和其他敏感查询参数执行访问日志脱敏。
- [ ] 验证控制台 Origin 与 MeshCentral/Agent Origin 分离时的 Cookie、下载和 Agent 注册行为。
- [ ] 为错误路由、插件未加载、上游不可用和证书错误提供明确健康诊断。

### 1.4 运维与恢复

- [ ] 定义 liveness、readiness 和依赖健康检查，并验证失败传播行为。
- [ ] 建立 MongoDB 与 MeshCentral 文件、配置和录制数据的备份恢复演练。
- [ ] 建立 MeshCentral、插件、MongoDB 和 Nginx 的升级及回滚流程。
- [ ] 固定目标 MeshCentral/Agent 兼容矩阵，并记录上游安全更新策略。
- [ ] 增加部署后冒烟测试和版本清单输出。

**阶段完成标准：** 使用受控 YAML 与 Secret 可重复生成配置、构建镜像、启动完整生产 Compose，并通过登录、控制、Relay、Agent 和持久化冒烟测试。

---

## 阶段 2：认证、会话与安全基线

**优先级：P0。**

### 2.1 `jsonauth` 与会话

- [x] 登录、TOTP、备用码、可信设备 Cookie、退出和注册 API 已接入 MeshCentral 原生 Session。
- [x] 浏览器不持久化可还原密码或认证 Cookie。
- [x] 登录页已按稳定状态码映射提示，不直接展示底层 `Error.message`。
- [~] 页面刷新后已尝试使用 Cookie 恢复控制连接，尚缺过期、撤销和服务端重启测试。
- [~] 控制连接认证失败时已有本地清理路径，尚缺连接成功后 Session 被撤销的完整自动退出验证。
- [ ] 验证账户锁定、登录限流、二次验证限流、密码过期和维护模式。
- [ ] 验证 Session Cookie 的 `HttpOnly`、`Secure`、`SameSite`、Path、Domain、IP 检查和有效期。
- [ ] 验证最后一个管理员、自操作限制和并发修改的 MeshCentral 拒绝行为。

### 2.2 Relay 生命周期

- [~] 桌面、终端和文件面板会在卸载或控制连接断开时清理各自会话。
- [ ] 建立全局 Relay 会话注册表，退出、Session 失效和应用关闭时统一取消全部会话。
- [ ] 区分用户主动关闭、控制断线、Agent 断线、认证失效、超时和协议错误。
- [ ] 限制自动重连次数和退避窗口，避免无限重连或重复 Agent tunnel。

### 2.3 SSO 与认证扩展

- [!] 当前 Web 登录流程仅支持 `jsonauth` 已封装的本地认证能力；OIDC、SAML、LDAP、SSPI、邮件和短信验证尚未接入。
- [ ] 调研目标 MeshCentral 版本的 OIDC/SAML 原生跳转和回调流程。
- [ ] 根据 MeshCentral 域配置动态展示可用登录方式。
- [ ] 实现忘记密码或明确交由管理员重置，并避免伪造本地流程。

**阶段完成标准：** 登录、MFA、恢复、撤销、退出、锁定、限流和全部 Relay 清理均有自动化测试及目标版本验证。

---

## 阶段 3：权限、错误与前端稳定性

**优先级：P0。**

### 3.1 有效权限模型

- [x] 已区分站点权限、设备组权限、单设备直接授权、用户组继承和 `removeRights`。
- [~] 菜单、管理路由、设备列表和工作台页签已接入统一能力模型，仍有页面使用局部布尔判断。
- [ ] 细分文件查看、上传、覆盖、移动、删除和压缩操作权限。
- [ ] 细分桌面查看、控制、剪贴板和录制权限。
- [ ] 完成终端、命令、批量操作、用户、用户组和授权页面内部按钮门控。
- [ ] 为 URL 直达、批量目标过滤和 MeshCentral 服务端拒绝建立权限矩阵测试。

### 3.2 错误模型

- [~] Control 和 Relay 已有认证、连接、路由、握手、协议、超时和取消等错误，分类仍未统一。
- [ ] 统一认证、授权、校验、冲突、会话过期、网关、Agent 路由、超时、取消和未知结果错误码。
- [ ] 为错误提供稳定用户提示、`retryable`、关联 ID 和安全的诊断详情。
- [ ] 删除页面直接拼接底层 `Error.message` 的路径。
- [ ] 对仅确认“请求已发送”的操作显示等待确认或结果未知，不宣称远端成功。
- [ ] 统一 Toast 去重、同类错误聚合和重试入口。

### 3.3 稳定性与可观测性

- [ ] 增加全局 React 错误边界和路由/页面级降级状态。
- [ ] 建立本地操作 ID，关联页面操作、`responseid`、设备 ID 和 Relay 会话 ID。
- [ ] 注入 Web 构建版本、Git 版本、MeshCentral 版本、插件版本和 Agent 版本。
- [ ] 接入前端异常、性能和关键流程监控，并执行统一脱敏。
- [ ] 统一密码、token、Cookie、认证查询、命令参数和文件路径的日志脱敏规则。

**阶段完成标准：** 同一权限和错误语义可被路由、页面、Control、Relay 与诊断信息复用，服务端拒绝或无响应不会被 UI 误报成功。

---

## 阶段 4：自动化测试与发布门禁

**优先级：P0。**

### 4.1 测试基础设施

- [~] 已有 Vitest、Testing Library 以及 Control、Relay、权限、文件和 MFA 的单元测试。
- [ ] 引入 Playwright 浏览器 E2E。
- [ ] 建设可控的假 MeshCentral WebSocket、Relay 和 Agent 协议回放服务。
- [ ] 准备认证、权限、设备、用户、事件、文件、终端和桌面稳定测试数据。
- [ ] 将真实 MeshCentral/Agent 验证与普通 CI 分离，避免 CI 依赖生产环境。

### 4.2 关键流程

- [~] 受保护路由、登录、Cookie 恢复和退出已有运行时代码，缺少完整集成与 E2E。
- [ ] 覆盖登录成功、密码错误、账户锁定、限流、MFA、Cookie 过期和插件不可用。
- [ ] 覆盖 Session 撤销、控制断开、离线恢复、重复登录和全部 Relay 清理。
- [ ] 覆盖不同权限用户的菜单、路由、按钮、URL 直达和 MeshCentral 拒绝。
- [ ] 覆盖设备、设备组、用户、用户组和授权核心 CRUD。
- [ ] 覆盖批量移动、电源、命令和文件上传结果汇总。
- [ ] 覆盖桌面、终端和文件的建立、断开、超时、权限拒绝和有限重连。

### 4.3 CI 门禁

- [ ] 在 CI 中依次执行格式检查、Lint、类型检查、单测、构建和 E2E。
- [ ] 保存失败截图、Trace、协议摘要、服务日志和关联 ID。
- [ ] 构建并启动生产 Compose 执行部署冒烟测试。
- [ ] 禁止关键测试或安全扫描失败的版本发布。
- [ ] 为不稳定测试设置责任人和修复期限，不长期无条件重试。

建议门禁：

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
pnpm deploy:smoke
```

---

## 阶段 5：核心远程管理能力收尾

**优先级：P1。**

### 5.1 设备与设备组

- [ ] 接入真实网络、硬件、系统、运行时间、标签、指标和事件详情。
- [ ] 删除设备后回读资源或事件，确认最终成功、失败或未知。
- [ ] 完成设备组视角的成员维护、批量移动和授权管理。
- [ ] 在设备列表提供桌面、终端和文件独立入口。
- [~] 设备工作台静态模拟事件已删除；仍需清理无法追溯来源的推算指标。

### 5.2 命令

- [~] 已有实时输出、本地时长、超时和断线未知状态。
- [ ] 完善批量目标过滤、并发控制、失败项保留和结果导出。
- [ ] 将模板和历史记录迁移到可控、可脱敏、可审计的存储模型。
- [ ] 验证危险命令权限和 MeshCentral 原生事件。
- [!] 标准输出/错误输出分类、真实退出码和远端取消依赖目标 Agent 协议支持。

### 5.3 终端与桌面

- [ ] 在 Windows、Linux 和 macOS Agent 上验证终端建立、关闭和 resize。
- [ ] 验证 CMD、PowerShell、默认 Shell、ANSI 和 Unicode 输入。
- [ ] 验证桌面鼠标、滚轮负值、扩展键、组合键、输入法和失焦释放。
- [ ] 验证远端空剪贴板、权限拒绝和写入确认。
- [ ] 增加显示器选择和有限自动重连。
- [ ] 完成只读、控制、超时、断线和录制状态测试。
- [ ] 增加移动端终端辅助键和桌面触控输入。

### 5.4 文件

- [ ] 增加覆盖、跳过和自动重命名冲突策略。
- [ ] 增加失败任务重试、最终状态和传输历史。
- [ ] 验证大文件、零字节、特殊字符、深层目录和并发任务。
- [ ] 验证断线、取消、页面刷新和重复提交。
- [ ] 评估 Agent 是否支持上传 ID、分块校验和续传查询。
- [!] 未确认远端续传状态前，不得只依靠前端 offset 宣称支持断点续传。

---

## 阶段 6：事件、审计与历史数据

**优先级：P1。**

- [ ] 定义统一 `AuditEvent`，包含用户、动作、目标、结果、来源、时间和关联 ID。
- [ ] 归一化 MeshCentral 账户事件、设备事件、`relaylog`、Agent 日志和本地临时操作。
- [ ] 验证登录、退出、认证失败、设备、用户、权限、命令、文件和远程会话事件覆盖范围。
- [ ] 区分成功、失败和结果未知，不伪造远端成功状态。
- [ ] 对命令参数、文件路径、认证信息和原始事件执行脱敏。
- [ ] 实现独立审计页面，支持用户、动作、目标、结果、来源和时间筛选。
- [ ] 支持权限受控的详情查看和本地导出。
- [ ] 使用真实历史事件生成设备在线、离线和状态变化数据。
- [ ] 确保 24 小时、7 天和 30 天窗口完整，并展示更新时间、延迟和缺失提示。
- [x] 删除 Dashboard 使用当前状态复制生成的伪历史趋势，数据不足时显示明确状态。
- [!] MeshCentral 未产生或未保存的可信审计与离线历史，无法由浏览器可靠补齐。

---

## 阶段 7：产品完整性

**优先级：P2/P3，在生产、权限、测试和审计基线完成后推进。**

### 7.1 告警、通知与搜索

- [ ] 调研并验证 MeshCentral 原生通知、邮件、Webhook、MeshBot 或插件能力。
- [ ] 对原生支持的设备状态和事件规则提供配置 UI。
- [ ] 基于当前 Session 事件实现临时通知中心和详情跳转。
- [ ] 实现设备名称、设备 ID、IP、设备组和用户全局搜索。
- [ ] 增加搜索防抖、加载、空状态、错误、键盘导航和最近搜索。
- [!] 浏览器关闭后的持续规则、Webhook 重试和跨设备未读同步需要服务端持久化能力。

### 7.2 账户与系统设置

- [~] 个人资料、邮箱、密码和 MFA 管理已有实现，缺少页面集成测试和真实版本回读验证。
- [ ] 验证会话列表、指定会话注销和全部会话注销协议。
- [ ] 提供连接、构建、MeshCentral、插件和 Agent 版本诊断。
- [ ] 展示或配置心跳、超时、重连、上传并发和带宽参数。
- [ ] 展示 MeshCentral 安全、Session、通知和事件保留配置；仅在原生能力支持时允许修改。
- [ ] 支持语言、时区、日期格式和主题设置。
- [ ] 提供帮助、文档、问题反馈和版本信息入口。

### 7.3 响应式与可访问性

- [ ] 完整验证桌面、平板和移动尺寸。
- [ ] 将移动端侧栏改为抽屉，提供遮罩、外部关闭和导航后关闭。
- [ ] 检查按钮、菜单、弹窗、表格和远程工具的键盘操作。
- [ ] 补充语义标签、焦点管理和屏幕阅读器文本。
- [ ] 检查颜色对比度和非颜色状态提示。
- [ ] 实现全站 `prefers-reduced-motion`，而非仅关闭部分骨架动画。

---

## 移动端与站点边界

- [ ] 明确 `apps/app` 第一阶段功能范围，避免直接复制全部桌面 Web 工作台。
- [ ] 复用 `control-client`、`relay` 和 `shared-state` 时验证 React Native WebSocket、文件系统、剪贴板和安全存储差异。
- [ ] 定义移动端认证 Cookie 或其他安全 Session 传递方案。
- [ ] 为移动端设备列表、通知、审批和轻量远程操作建立独立路线图。
- [ ] 明确 `apps/site` 的产品与部署职责，避免与控制台 Web/Nginx 镜像混用。

---

## 推荐迭代顺序

### 迭代 A：架构与生产闭环

1. 确定 `jsonauth` 与 Nest Gateway 的最终认证职责。
2. 统一配置 Schema 和登录路由。
3. 实现配置生成器、Web/Nginx 镜像和 Gateway 镜像。
4. 跑通完整生产 Compose、健康检查和部署冒烟测试。
5. 建立升级、备份、恢复和回滚流程。

### 迭代 B：安全与测试门禁

1. 完成 Session 撤销、限流、锁定和 Relay 全局清理。
2. 统一权限、错误和关联 ID。
3. 引入 Playwright 和协议回放服务。
4. 覆盖认证、权限、设备、用户和远程会话关键流程。
5. 建立 CI、镜像扫描和生产 Compose 门禁。

### 迭代 C：核心体验收尾

1. 删除设备工作台模拟数据和 Dashboard 伪历史趋势。
2. 完成文件冲突、失败重试和最终结果。
3. 验证桌面输入、剪贴板、显示器与终端 resize。
4. 完成多平台 Agent 兼容矩阵。
5. 建立事件归一化和审计页面。

### 迭代 D：产品扩展

1. 完善真实历史仪表盘和全局搜索。
2. 接入可验证的 MeshCentral 告警与通知能力。
3. 完成系统设置、会话管理和诊断页面。
4. 完成响应式与可访问性验收。
5. 按独立范围推进 Expo App。

---

## 功能完成定义

功能只有满足与其风险相匹配的以下条件，才可标记为 `[x]`：

- UI 具备加载、空数据、错误、无权限、断线和恢复状态。
- Client、Plugin、Server 与 Proxy 的职责和接口稳定，不由页面拼装原始协议。
- 目标 MeshCentral/Agent 版本的真实协议样本已验证并脱敏保存。
- MeshCentral 执行最终认证、授权和输入校验，客户端门控不代替服务端安全。
- 操作成功、失败和结果未知均有准确反馈。
- 可审计操作产生可查询、可关联和可脱敏的原生事件；无法产生时明确标记架构限制。
- 核心逻辑具备单元或集成测试，关键用户流程具备 E2E。
- 配置、Secret、镜像、健康检查、部署、升级和回滚文档同步更新。
- 相关发布门禁全部通过。

若目标 MeshCentral/Agent 协议能力尚未确认，应标记为 `[!]` 或 `[~]`，不得通过前端推断或模拟结果标记完成。需要持续后台执行、跨浏览器同步、额外业务持久化或不可抵赖审计的能力，必须先明确由 MeshCentral、插件、Nest Gateway 或未来独立服务承担。
