# Web 国际化逐模块迁移计划

## 1. 背景与当前状态

`apps/web` 已完成国际化基础接入：

1. 已安装 `i18next` 和 `react-i18next`。
2. 已支持 `zh-CN` 和 `en-US`。
3. 已根据浏览器语言选择初始语言，并使用 `localStorage` 保存用户选择。
4. 已同步切换 Ant Design locale 和 `document.documentElement.lang`。
5. 登录页、启动屏、应用导航、页面标题、账户菜单和 403 页面已迁移。
6. 登录页和登录后的应用顶栏均提供语言切换入口。

当前业务页面仍以中文硬编码为主。`apps/web/src` 中的中文分布在页面、弹窗、设备工作台、权限定义、批量任务和领域格式化函数中，不能只通过批量替换 JSX 文案完成迁移。

本计划目标是在保持现有功能和协议行为不变的前提下，按模块逐步完成中英文覆盖，并消除业务逻辑对中文字符串的依赖。

## 2. 目标与约束

### 2.1 目标

1. 完成 Web 端所有用户可见文案的 `zh-CN` 和 `en-US` 翻译。
2. 日期、时间、数字、排序和复数规则跟随当前语言。
3. Ant Design 内置组件文案与业务文案使用同一语言状态。
4. 领域层、状态机、Worker 和协议层不依赖具体语言。
5. 支持按模块独立迁移、验证和回滚，避免一次性修改全部页面。
6. 建立翻译资源完整性和语言切换自动化测试。
7. 为后续增加其他语言保留稳定的资源组织方式。

### 2.2 约束

- 不修改 MeshCentral 协议字段、action 或服务端错误语义。
- 不在控制客户端、共享状态或 Worker 中调用 React Hook。
- 不将翻译后的文本作为状态判断、排序键、错误类型或测试契约。
- 不因国际化迁移重构无关业务逻辑。
- 每个阶段必须同时提交中文资源、英文资源、代码改造和相关测试。
- 迁移过程中中文仍为默认和 fallback 语言。
- 服务端原始错误在无法识别时可以作为诊断详情保留，但 UI 应提供可翻译的通用错误标题。

## 3. 国际化架构约定

### 3.1 资源组织

当前翻译资源位于：

```text
apps/web/src/i18n/
  index.ts
  language.ts
  locales/
    zh-CN.ts
    en-US.ts
```

迁移初期继续使用每种语言一个 TypeScript 资源文件，按顶层模块分组：

```ts
{
  common: {},
  navigation: {},
  header: {},
  login: {},
  dashboard: {},
  devices: {},
  deviceGroups: {},
  events: {},
  users: {},
  userGroups: {},
  permissions: {},
  commands: {},
  batchUpload: {},
  workspace: {},
  files: {},
  terminal: {},
  remoteDesktop: {},
  errors: {},
}
```

当单个语言文件明显影响审阅或频繁产生合并冲突时，再按 namespace 拆分目录。拆分前后翻译 key 不应改变。

### 3.2 Key 命名

使用“模块 + 语义”的稳定 key，不使用中文或完整英文句子作为 key：

```text
devices.title
devices.filters.allGroups
devices.actions.restart
devices.confirm.restartTitle
devices.messages.restartSuccess
workspace.status.justNow
errors.gatewayDisconnected
```

约定：

- 通用按钮使用 `common.actions.*`。
- 通用状态使用 `common.status.*`。
- 页面专有文案保留在对应模块下。
- 表格列使用 `<module>.columns.*`。
- 表单字段、占位和校验分别使用 `fields`、`placeholders`、`validation`。
- 确认弹窗使用 `confirm.*`，通知消息使用 `messages.*`。
- 不为了减少 key 数量而复用语义不同但当前中文相同的文案。

### 3.3 插值、复数与格式化

动态文案必须使用插值：

```ts
t('devices.selection.count', { count: selectedDeviceIds.length })
```

不得使用以下拼接方式：

```ts
`${count} 台设备`
label + device.name
```

数量文案使用 i18next 的 `count` 规则，为英文保留单复数形式。设备名称、用户名、路径和命令等外部值只作为插值参数传入。

新增统一 locale 工具或 Hook，集中提供：

- 当前 `AppLanguage`。
- `Intl.DateTimeFormat`。
- `Intl.NumberFormat`。
- `Intl.RelativeTimeFormat`。
- `Intl.Collator`。

页面和组件不得继续直接固定使用 `'zh-CN'`。

### 3.4 领域层与展示层边界

React 页面和组件负责调用 `t()`。纯函数、共享状态、Worker、管理器和协议适配层返回结构化结果：

```ts
interface LocalizedIssue {
  code: 'file-too-large' | 'gateway-disconnected' | 'permission-denied';
  params?: Record<string, string | number>;
  detail?: string;
}
```

UI 将 `code` 映射为翻译 key。未知服务端错误使用通用本地化文案，并可在详情中展示经过安全处理的原始消息。

禁止以下模式：

- 通过 `value === '刚刚'` 判断时间状态。
- 通过 `value === '未提供'` 判断字段是否缺失。
- Worker 直接返回拼好的中文进度信息。
- 权限常量直接保存中文 `label` 和 `description`。
- 测试以完整中文句子作为领域函数的唯一输出契约。

## 4. 阶段 0：完善基础设施和测试护栏

### 4.1 工作内容

1. 增加翻译资源结构一致性测试，确保 `zh-CN` 和 `en-US` 的 key 集合一致。
2. 为 `resolveLanguage()` 增加测试，覆盖完整 locale、区域变体、未知语言和空值。
3. 新增统一的 locale/Intl 工具，替代页面中的固定 `zh-CN`。
4. 增加测试用 i18n 初始化函数，允许组件测试显式指定语言。
5. 明确领域错误码到翻译 key 的映射方式。
6. 增加至少一个登录页或应用壳的中英文渲染测试。

建议新增：

```text
apps/web/src/i18n/
  formatters.ts
  testI18n.ts
  i18n.test.ts
```

### 4.2 完成标准

- 两种语言资源缺少或多出 key 时测试失败。
- 测试可以独立以 `zh-CN` 或 `en-US` 渲染组件。
- 新代码不再新增固定的 `Intl.*('zh-CN')`。
- `localStorage` 不可用时，语言初始化仍有明确降级行为。

### 4.3 验证

```powershell
pnpm --filter @meshcentral/web typecheck
pnpm --filter @meshcentral/web lint
pnpm --filter @meshcentral/web test
```

## 5. 阶段 1：通用页面与仪表盘

### 5.1 范围

```text
apps/web/src/pages/NotFoundPage.tsx
apps/web/src/pages/ComingSoonPage.tsx
apps/web/src/pages/DashboardPage.tsx
apps/web/src/components/ConsoleUi.tsx
apps/web/src/components/BrandLogo.tsx
```

### 5.2 工作内容

1. 迁移静态标题、描述、按钮、卡片标题和统计标签。
2. 仪表盘设备数量、在线率、事件数量使用数字格式化器。
3. 最近事件时间和趋势区间使用当前 locale。
4. 将可复用的在线、离线、异常等状态放入 `common.status`。
5. 保持品牌名 `MeshCentral` 不翻译。

### 5.3 完成标准

- 仪表盘切换语言后所有静态文案立即更新。
- 数字和时间格式与当前语言一致。
- 错误页和占位页不再包含用户可见的硬编码中文。

## 6. 阶段 2：设备列表、设备分组与实时事件

### 6.1 范围

```text
apps/web/src/pages/DevicesPage.tsx
apps/web/src/pages/DeviceGroupsPage.tsx
apps/web/src/pages/RealtimeEventsPage.tsx
apps/web/src/components/DeviceEditModal.tsx
apps/web/src/components/DeviceInviteModal.tsx
```

### 6.2 工作内容

1. 迁移页面标题、筛选器、表格列、分页摘要和空状态。
2. 迁移设备电源、编辑、删除、邀请和刷新等操作文案。
3. 迁移确认弹窗、成功通知、失败通知和权限不足提示。
4. 将 `powerActionLabels` 等展示字典改为翻译 key。
5. 设备数量和选中数量使用 `count` 插值及复数规则。
6. 日期时间格式、设备名称排序和搜索归一化跟随当前 locale。
7. 将实时事件类型、严重级别和来源类型整理为共享展示 key。
8. 保留平台名、设备名、IP 和 ID 等原始数据，不翻译用户数据。

### 6.3 风险控制

- 搜索行为不得因切换语言而遗漏原始设备名。
- URL 查询参数值保持稳定，不使用翻译文本作为参数值。
- Select、Table、Dropdown 的 `value/key` 保持语言无关。
- 后端返回的设备组名称和设备名称不得送入 `t()`。

### 6.4 完成标准

- 设备列表、分组和实时事件的主要操作可在两种语言下完成。
- 切换语言不清空筛选条件、选择状态或当前页码。
- 固定 `zh-CN` 的日期和排序逻辑已移除。
- 所有确认弹窗在英文下无中文按钮或正文残留。

## 7. 阶段 3：用户、用户组与权限编辑

### 7.1 范围

```text
apps/web/src/pages/UsersPage.tsx
apps/web/src/pages/UserDetailsPage.tsx
apps/web/src/pages/UserGroupsPage.tsx
apps/web/src/pages/UserGroupDetailsPage.tsx
apps/web/src/components/users/
apps/web/src/features/users/sitePermissions.ts
apps/web/src/features/users/meshPermissions.ts
apps/web/src/features/users/userFilters.ts
```

### 7.2 前置改造

权限定义从直接保存中文改为保存稳定 key：

```ts
interface PermissionDefinition {
  value: number;
  labelKey: string;
  descriptionKey: string;
}
```

权限摘要函数不得返回完整中文句子。优先返回结构化结果：

```ts
interface PermissionSummary {
  kind: 'none' | 'full' | 'custom';
  permissionKeys: string[];
}
```

### 7.3 工作内容

1. 迁移用户和用户组列表、详情、标签页、表格及空状态。
2. 迁移创建、编辑、删除、启用、禁用和重置密码流程。
3. 迁移站点权限、设备组权限和设备权限的名称及描述。
4. 用户状态、会话状态和登录时间使用统一格式化器。
5. 表单校验信息使用翻译 key，不依赖字段 label 自动拼接。
6. 动态确认文案使用用户名、用户组名和设备名插值。
7. 更新对中文输出有强耦合的权限测试。

### 7.4 风险控制

- 用户名、真实姓名、用户组名和备注均为用户数据，不翻译。
- 权限位值、权限 key 和 API 写入字段不随语言变化。
- 切换语言不得重置正在编辑的表单。
- 危险操作按钮的视觉级别和二次确认行为不得改变。

### 7.5 完成标准

- 用户和用户组所有已实现流程均可在英文下完成。
- 权限领域测试不再断言中文摘要。
- 页面中不再通过翻译文本推导权限或账户状态。

## 8. 阶段 4：命令、批量操作与文件上传

### 8.1 范围

```text
apps/web/src/components/CommandExecutionModal.tsx
apps/web/src/components/BatchDeviceOperationsModal.tsx
apps/web/src/components/BatchFileUploadModal.tsx
apps/web/src/features/commands/
apps/web/src/features/batch-upload/
```

### 8.2 工作内容

1. 迁移命令类型、Shell 类型、风险提示、确认信息和输出状态。
2. 迁移批量操作进度、成功数、失败数、取消状态和耗时。
3. 迁移文件校验、带宽限制、冲突处理和上传结果文案。
4. 将 Worker 和 `BatchUploadManager` 返回的中文详情改为错误码、状态码和参数。
5. 命令输出本身按原样展示，不进行翻译。
6. 文件名、远程路径、命令和服务端原始结果不得作为翻译 key。

### 8.3 完成标准

- Worker 和管理器代码不导入 i18n 单例。
- 批量任务切换语言后，后续状态信息使用新语言，任务状态本身不丢失。
- 命令与批量上传测试断言稳定 code 和结构，而不是完整中文句子。
- 中英文下长文案不遮挡进度、操作按钮和表格内容。

## 9. 阶段 5：设备工作台领域模型

设备工作台是最高风险阶段，应先移除领域模型中的中文哨兵值，再迁移 UI。

### 9.1 范围

```text
apps/web/src/features/device-workspace/deviceWorkspaceModel.ts
apps/web/src/features/device-workspace/systemManagement.ts
apps/web/src/features/device-workspace/types.ts
apps/web/src/features/device-workspace/mockWorkspaceData.ts
```

### 9.2 结构化改造

将以下文本状态改为结构化值：

- `未提供` 改为 `undefined` 或明确的 availability 状态。
- `未分组` 改为缺失的 `groupName`，由 UI 提供 fallback。
- `刚刚` 改为时间戳或 `relativeTimeSeconds`。
- 中文时长改为数值秒数或毫秒数。
- 在线、离线、运行中、已停止等状态改为稳定枚举。

示例：

```ts
interface DeviceHeartbeat {
  lastSeenAt?: string;
  ageSeconds?: number;
  status: 'online' | 'stale' | 'offline' | 'unknown';
}
```

### 9.3 完成标准

- 领域模型不再输出用户可见中文。
- 组件不再比较中文字符串判断字段存在性或状态。
- `deviceWorkspaceModel.test.ts` 断言结构化数据。
- 现有设备数据缺失时仍保持保守、明确的 UI 降级。

## 10. 阶段 6：设备工作台 UI

### 10.1 推荐顺序

1. `WorkspaceTabs.tsx` 和 `DeviceWorkspaceHeader.tsx`。
2. `DeviceOverviewPanel.tsx` 和 `WorkspaceSettings.tsx`。
3. `DeviceLogsPanel.tsx` 和 `SystemManagementPanels.tsx`。
4. `DeviceFilesPanel.tsx` 及文件子组件。
5. `TerminalPanel.tsx` 及终端子组件。
6. `RemoteDesktopPanel.tsx` 及远程桌面子组件。

### 10.2 工作内容

1. 迁移标签页、连接状态、设备信息和设置项。
2. 迁移日志级别、事件类型、搜索、时间和空状态。
3. 迁移进程、服务和系统管理操作的确认与结果文案。
4. 迁移文件操作、冲突弹窗、下载、压缩和路径提示。
5. 迁移终端连接、重连、编码、会话和错误提示。
6. 迁移远程桌面连接阶段、画质、输入控制和安全提示。
7. 将协议/中继错误映射为稳定错误码；未知错误保留通用 fallback。

### 10.3 风险控制

- 终端输出、日志正文、远程路径和设备返回数据不翻译。
- 文件路径处理不得受当前语言或数字格式影响。
- 远程桌面和终端的连接状态机不得保存翻译后的文本。
- 切换语言不得断开正在进行的桌面、终端或文件会话。
- 状态栏尺寸应能容纳较长英文，避免布局位移和按钮遮挡。

### 10.4 完成标准

- 设备工作台所有标签页在两种语言下可用。
- 切换语言不会重建远程会话或丢失当前标签页。
- 文件、终端和远程桌面错误均有本地化标题和可诊断详情。
- 工作台领域层和状态机不存在用户可见中文硬编码。

## 11. 阶段 7：残留清理与全量验收

### 11.1 静态扫描

排除中文资源、测试夹具和必要注释后，检查残留中文：

```powershell
rg -n "[\p{Han}]" apps/web/src --glob "!i18n/locales/zh-CN.ts" --glob "!*.test.ts"
```

检查固定 locale 和分散格式化：

```powershell
rg -n "Intl\.|toLocale(String|DateString|TimeString)|localeCompare|toLocaleLowerCase" apps/web/src
rg -n "'zh-CN'|\"zh-CN\"" apps/web/src --glob "!i18n/**"
```

扫描结果必须人工分类：

- 用户可见文案：必须迁移。
- 注释：允许保留中文。
- 测试数据：根据测试目的决定是否保留。
- 用户或服务端数据：不得翻译。
- 协议常量：不得因国际化修改。

### 11.2 自动化验证

```powershell
pnpm --filter @meshcentral/web typecheck
pnpm --filter @meshcentral/web lint
pnpm --filter @meshcentral/web test
pnpm --filter @meshcentral/web build
```

### 11.3 浏览器验收矩阵

分别以 `zh-CN` 和 `en-US` 检查：

| 区域 | 必查流程 |
| --- | --- |
| 登录 | 表单校验、密码显示、登录失败、语言持久化 |
| 导航 | 菜单、页标题、账户菜单、403、404 |
| 仪表盘 | 卡片、图表、数字、时间、事件列表 |
| 设备 | 筛选、分页、编辑、邀请、电源操作、批量操作 |
| 事件 | 筛选、严重级别、事件详情、时间显示 |
| 用户 | 创建、编辑、启禁用、权限、用户组、删除确认 |
| 工作台 | 概览、日志、进程、服务、文件、终端、远程桌面 |

同时检查：

- 刷新后保持选择的语言。
- 切换语言不改变路由、筛选、表单和正在运行的会话。
- 英文文案不溢出按钮、表格列、标签页和弹窗。
- Ant Design 分页、空状态、确认按钮和表单提示使用当前语言。
- 浏览器控制台无缺失 key、React key 或 hydration 警告。

## 12. 模块交付清单

每个阶段的合并请求必须包含：

1. 对应模块的中文和英文资源。
2. 页面、组件及领域层改造。
3. 固定 locale 的清理。
4. 受影响测试的更新或新增测试。
5. `typecheck`、`lint`、`test` 和必要的 `build` 结果。
6. 中英文关键页面截图或手工验收记录。
7. 尚未迁移或明确保留的中文清单。

不接受仅添加翻译资源但未接入 UI，或仅将中文替换为英文而没有语言切换能力的提交。

## 13. 建议实施节奏

建议每个阶段独立提交，阶段 2、3、4、6 可继续拆成页面级提交，但必须遵循以下顺序：

```text
基础设施和测试
→ 低风险通用页面
→ 设备列表与事件
→ 用户与权限
→ 命令和批量任务
→ 工作台领域模型
→ 工作台 UI
→ 全量清理与验收
```

每次迁移优先完成一个完整用户流程，而不是在所有文件中只替换标题。例如设备模块应一次覆盖列表、筛选、操作确认和结果通知，避免出现同一流程中中英文混杂的中间状态。

## 14. 最终完成定义

国际化迁移完成需要同时满足：

1. 所有已实现路由和弹窗均支持 `zh-CN` 与 `en-US`。
2. 用户可见文案不再散落于业务组件和领域逻辑中。
3. 领域模型、Worker、状态机和测试契约不依赖中文字符串。
4. 日期、时间、数字、复数和排序跟随当前语言。
5. 中英文资源 key 完全一致且受自动化测试保护。
6. 语言切换不会丢失业务状态或中断远程会话。
7. 全量类型检查、代码检查、测试和生产构建通过。
8. 两种语言的浏览器验收矩阵全部通过。
