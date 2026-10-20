# MeshCentral 二次开发功能实施计划与演进路线

## 一、尚未实现的功能

### P0：影响可用性或安全闭环

| 功能 | 现状 | 影响 |
| --- | --- | --- |
| WebAuthn / 邮箱 2FA 登录 | 个人中心允许注册安全密钥、开启邮箱 2FA（`twoFactorManagement.ts`），但 `jsonauth` 只验证 TOTP 和备份码（`two-factor.service.ts`），登录页也只接受这两种（`LoginForm.tsx`） | 只绑定 WebAuthn 或只开启邮箱 2FA 的账号会收到“2FA 方式不支持”，**可能直接无法登录** |
| 密码过期 / 强制改密 | 服务端能返回 `PASSWORD_EXPIRED`，但前端只显示“请先通过 Nodexa 修改密码”（`LoginForm.tsx`），登录态尚未建立，没有可执行的改密入口 | 密码过期用户被卡在登录页；也没有“忘记密码 / 邮件重置”流程 |
| 密码策略前端校验 | 修改密码弹窗只有必填和两次一致校验（`PasswordChangeModal.tsx`），没有长度、大小写、弱口令提示 | 用户要到服务端才收到失败结果，体验差 |
| 登录会话管理 | 只能读取在线会话数（`users.ts`），没有会话列表、吊销、强制下线 | 账号泄露时缺少应急处置手段 |

### P1：阶段二（知情同意 / 分享 / 录像）

- **Consent 与隐私提示条未实现**：Web 与 `packages/relay` 中没有 `consent` 处理，桌面连接状态只有授权、通知、连接、握手中（`RemoteDesktopPanel.tsx`）。用户拒绝、超时、无人值守放行都没有界面状态。
- **访客共享未接入**：SDK 已计算 `guestShare` 能力（`uiCapabilities.ts`），但 Web 端没有任何调用，也没有 `/sharing/:token` 极简访客页面。
- **录像只有采集标记，没有管理中心**：协议层能识别 `recordingReady`（`normalizers.ts`），桌面/终端也显示“录制中”，但没有录像列表、筛选、下载和 `.mcrec` Web 播放器。
- **桌面增强能力缺失**：多显示器切换、隐私条、会话录制播放等尚未接入；当前主要是画面、键鼠、剪贴板和 WebRTC。

### P1：阶段一剩余（服务器运维中心）

- 没有 `/admin/server/console`、`/admin/server/trace`、`/admin/server/logs` 页面；`/admin/*` 仍落到 ComingSoon（`AppRouter.tsx`）。
- `ServerResource` 只有时间线统计和服务器统计订阅（`server.ts`），没有 console、trace、errorLog、运行配置等封装。

### P2：设备工作区本身的缺口

- 权限层已经计算 `console`、`registry`、`software`（`uiCapabilities.ts`），但工作区只有总览、桌面、终端、文件、进程、服务、日志、在线统计 8 个页签（`WorkspaceTabs.tsx`）。
- 缺少 Agent 控制台、注册表编辑、软件清单/卸载、设备消息/Toast、MessageBox 等运维入口。

### P2：阶段三（部署与端点治理）

- 没有统一部署中心 `/devices/deploy`；SDK 已有 `createInviteLink`（`devices.ts`），但 UI 未使用，也没有过期/次数限制邀请码。
- 没有 Agent 白标设计器（`agentFileInfo` / `agentCustomization`）。
- 没有 BitLocker 恢复密钥保险箱。
- 没有 `meshagent.tag` 动态标签同步、预置脚本库、Agent Core Dump 查看、非活跃设备自动清理配置。

### P2：阶段四（企业集成与高可用）

- SSO：`jsonauth` 明确不包装 LDAP / OIDC / SAML（`README.md`），也没有 SSO 配置页面。
- 通知网关：没有 SMTP / SendGrid / Twilio / Telegram / Discord / Slack / Web Push 配置界面，也没有 Service Worker；只有客户端通知中心。
- Intel AMT：只展示在线状态和能力位，没有带外开关机、BIOS、KVM、ACM 零接触激活。
- 没有 ACME、Peers 集群、CrowdSec、Prometheus/Watchdog 治理页面。
- 没有多 Domain 切换入口，认证和控制地址都固定为默认域。

### P3：移动端与 Gateway

- 移动端远程桌面、终端、文件入口点击后提示“将在后续功能中接入”（`device/[id].tsx`）。
- 添加设备页、设备组编辑页、批量操作页基本是静态原型：复制、创建设备组、执行批量操作没有真实 API 调用。
- 移动端没有 i18n，界面文案全部硬编码中文。
- Gateway 只有 health 和实验性 login，未参与正式认证、控制、Relay 主链路。

## 二、可以优化的地方

### 1. 正确性与体验

- **Vite 代理地址写死**：已从 `MESHCENTRAL_PROXY_TARGET` 环境变量读取，未配置时保留 `https://mesh.xiaonext.com` 作为默认值。
- **SDK 返回本地化中文**：权限能力对象仅保留 `reason`，Web UI 按当前语言翻译，覆盖工作区、设备列表及设备组的权限提示。
- **仍有硬编码文案**：工作区占位和加载提示已纳入中英文词条。
- **顶栏搜索和帮助按钮没有行为**：搜索已支持按设备名称/ID查询并跳转设备列表；无目标文档的帮助按钮已移除。
- **事件查询超时被吞掉**：超时错误现在向上抛出，实时事件页展示错误状态并提供重试，与空结果区分。
- **报表、事件缺少导出**：报表没有 CSV/打印，实时事件没有暂停、清空、导出；对审计场景不够用。

### 2. 架构与可维护性

- **超大页面文件**：`UserGroupDetailsPage` 约 1300 行，`DevicesPage`、`UserDetailsPage` 也都超过千行。建议按“数据 Hook + 子组件 + 弹窗”拆分，降低回归风险。
- **SDK 字符串和 UI 耦合**：`control-client`/`shared-state` 中出现中文错误信息和事件格式化逻辑，建议把展示层文案全部上移到 `apps/web`。
- **资源 API 覆盖不均**：部分操作仍靠 `client.request()` / `send()` 原始消息，建议按“服务器运维、录像、共享、部署、AMT”逐步补齐强类型资源。
- **Monorepo 版本漂移**：`apps/site` 的 React、TypeScript、ESLint 版本与 Web 不一致，且 `apps/site/pnpm-workspace.yaml` 形成了嵌套 workspace 配置。建议用 pnpm catalog 统一版本，并把 `ignoredBuiltDependencies` 收敛到根配置。
- **MeshCentral 版本**：`package.json` 使用 `^1.1.54`，Dockerfile 却按精确版本断言，建议改为精确版本，避免依赖漂移；Dockerfile 从远程 URL 拉取 `exeHandler.js`，建议增加校验或本地归档。

### 3. 性能

- 路由级懒加载和 ECharts 按需引入已经做得不错；可继续增加 `manualChunks`（antd、echarts、xterm、relay）和 bundle analyzer，避免主包过大。
- i18n 两份字典全部静态打包，可考虑按语言动态加载。
- 设备列表是全量加载后在客户端过滤排序；设备量很大时建议做增量更新、索引或服务端筛选，`onlineDeviceCount` 这类全量遍历也应改为维护计数。
- 实时事件只保留 60/100 条（`store.ts`），没有分页加载和持久化；审计场景需要“加载更多 / 时间范围查询 / 导出”。
- `FilesSession` 同时只允许一个文件操作，且不支持断点续传；大文件和弱网场景可增加操作队列、重试和续传。

### 4. 工程化与质量

- 仓库没有 `.github/workflows`，建议至少增加 `lint + typecheck + test + build` 的 CI。
- Web 端约 198 个源文件只有 46 个测试文件，页面级测试只有 2 个；建议补充 Playwright E2E：登录、2FA、设备工作区、文件上传、用户权限。
- 没有全局 React ErrorBoundary，也没有前端错误上报；建议增加错误边界、Sentry/OpenTelemetry。
- 安全方面建议补充：认证接口的 Origin/Referer 校验、CSP/安全响应头、依赖审计，以及 cookie 安全属性的部署校验。
- 可访问性与响应式：部分自定义按钮/可点击区域缺少键盘和 ARIA 处理，建议引入 `eslint-plugin-jsx-a11y`。

### 5. 文档

- `docs/meshcentral/README.md` 链接的 `07-nodejs-wrapper-design.md` 不存在。
- `apps/meshcentral/README.md` 仍引用旧的 `deploy/config/meshcentral.example.json` 和 `deploy/compose.meshcentral.yaml`，与实际文件名不一致。
- `docs/meshcentral/README.md` 开头仍要求客户端通过业务网关访问，而实际架构是浏览器同源 Cookie 直连 MeshCentral，建议统一架构说明。
- 若干 i18n key（如会话管理说明）和 ComingSoon 路由已无实际用途，可清理。

## 三、建议的推进顺序

1. **先修 2FA 登录断链**：要么让 `jsonauth` 支持 WebAuthn/邮箱验证，要么让安全设置只暴露登录可验证的方式。
2. 补齐密码过期改密、忘记密码、会话管理。
3. 阶段二：Consent → 访客共享 → 录像管理与播放器。
4. 阶段一剩余：服务器 Console / Trace / ErrorLog。
5. 阶段三：部署中心、BitLocker、脚本库、动态标签。
6. 阶段四：SSO、通知网关、AMT、ACME/集群。
7. 最后再做移动端远控和 Gateway 业务聚合。
