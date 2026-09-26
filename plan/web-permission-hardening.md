# Web 权限门控与授权契约整改计划

## 一、背景

当前项目已经在 `@meshcentral/control-client` 中封装了站点权限、设备组/设备权限、有效权限计算和部分 UI Capability，并在 Web 管理端接入了用户管理、用户组管理、远程桌面、终端、设备文件、命令、电源和设备删除等权限判断。

现有实现仍存在以下问题：

1. 部分写操作只检查网关连接状态，没有检查当前用户的有效权限。
2. 单设备授权弹窗展示的权限范围与 control-client 允许发送的权限掩码不一致。
3. 部分已经定义的权限码没有被 Web 功能消费，界面展示与真实授权语义可能不一致。
4. 页面、按钮、批量操作和请求提交前的权限判断尚未完全共用同一套能力模型。
5. 客户端权限门控缺少覆盖主要角色和限制位组合的自动化测试。

客户端门控只用于改善界面行为和减少无效请求，MeshCentral 服务端仍是最终安全边界。任何前端判断都不能替代服务端鉴权。

## 二、目标

- 所有可写操作在显示入口、打开弹窗和提交请求三个阶段使用一致的权限判定。
- 页面和页签只展示当前用户可访问的功能；权限未知时默认禁用，不乐观放行。
- 单设备授权编辑器只能生成 control-client 和目标 MeshCentral 服务端共同支持的权限组合。
- 设备组、单设备、用户组继承和 `removeRights` 统一通过有效权限模型计算。
- 服务端拒绝权限时提供明确错误反馈，并重新读取相关资源，避免界面保留错误状态。
- 为权限常量、能力派生、组件门控和关键用户流程建立自动化测试。

## 三、非目标

- 不在浏览器中重新实现 MeshCentral 服务端授权逻辑。
- 不将不可见资源加入客户端快照，也不通过本地缓存扩大资源可见范围。
- 未经目标 MeshCentral 版本的协议验证，不擅自扩大单设备授权掩码。
- 本计划不直接实现服务器备份、恢复、录制、Server Files、Web Relay 等尚未完成的产品页面。

## 四、现状与缺口

### 4.1 缺少权限门控

| 功能 | 当前行为 | 应使用的权限 | 风险 | 优先级 |
| --- | --- | --- | --- | --- |
| 编辑设备组 | 只检查客户端存在且网关已连接 | 当前用户对该组的 `MeshRight.EditMesh` | 无权用户仍可打开编辑器并发起请求 | P0 |
| 删除设备组 | 只检查客户端存在且网关已连接 | `MeshRight.EditMesh`，并保留服务端附加规则 | 无权用户可发起危险操作 | P0 |
| 批量移动设备 | 对所有选中设备直接执行 | 每台设备源组和目标组的 `MeshRight.ManageComputers` | 部分目标失败，批量结果不可预测 | P0 |
| 编辑设备时移动分组 | 只使用当前设备的 `edit` 能力 | 源组和目标组都应允许管理设备 | 可选择无权写入的目标组 | P0 |
| 设备详情 | 工作台加载后直接展示详情 | `MeshRight.DeviceDetails` 或经协议确认的基础可见权限 | 可能展示超出授权范围的硬件和系统信息 | P1 |
| 设备日志 | 页签默认可见并请求历史事件 | `MeshRight.LimitEvents` 对应的事件范围策略 | 前端没有表达限制语义 | P1 |
| 进程和服务列表 | 仅以 `RemoteControl` 作为入口条件 | 需要确认 `DeviceDetails`、`RemoteCommand` 或服务端独立规则 | 权限语义不明确 | P1 |
| 实时事件页面 | 所有已登录用户均可进入 | 普通事件仅限可见资产；全站事件要求 `SiteRight.AllEvents` | 页面级语义和审计页不一致 | P1 |

### 4.2 单设备授权契约不一致

Web 的 `DEVICE_PERMISSIONS` 当前允许用户选择大量 Mesh 权限，包括远程命令、电源、访客分享、设备详情、Relay 和多个限制位。

control-client 的 `devices.setUserRights()` 与 `devices.setUserGroupRights()` 当前只允许以下掩码：

```text
RemoteControl | AgentConsole | ServerFiles | WakeDevice |
SetNotes | ChatNotify | Uninstall
```

即：

```text
0x0000C0F8
```

当弹窗选择掩码之外的权限时，客户端会在发送请求前抛出 `GatewayValidationError`。当前 UI 所定义的 `DEVICE_RIGHT_FULL` 因此不能作为单设备授权接口的有效“全部权限”值。

该问题必须先通过目标 MeshCentral 版本验证真实协议能力，再选择以下方案之一：

1. **收窄 UI**：单设备授权弹窗仅展示服务端确认支持的权限。
2. **扩展契约**：若服务端确实支持更多权限，则扩大 control-client 掩码并增加协议测试。
3. **按主体区分**：如果用户直授和用户组直授的允许范围不同，分别定义两个显式掩码，禁止继续共用模糊的 `DEVICE_PERMISSIONS`。

### 4.3 已定义但未被 Web 功能消费的权限

| 权限 | 当前 Web 状态 | 处理策略 |
| --- | --- | --- |
| `MeshRight.EditMesh` | 有编辑设备组功能，但未门控 | 纳入设备组能力模型 |
| `MeshRight.ManageUsers` | 缺少设备组成员管理页面 | 保留授权项，功能实现时接入 |
| `MeshRight.ServerFiles` | 没有服务器侧文件空间页面 | 暂不作为设备文件权限使用 |
| `MeshRight.SetNotes` | 没有设备备注编辑入口 | 实现功能前保留但标记未使用 |
| `MeshRight.ChatNotify` | 没有通知和聊天入口 | 实现功能前保留但标记未使用 |
| `MeshRight.AgentConsole` | 已有能力判定，没有工作台页签 | 后续功能接入时复用现有能力 |
| `MeshRight.GuestSharing` | 已有能力判定，没有操作入口 | 后续功能接入时复用现有能力 |
| `MeshRight.DeviceDetails` | 详情已展示，但未门控 | 本计划接入 |
| `MeshRight.LimitEvents` | 没有前端范围表达 | 以服务端返回范围为准并增加 UI 提示 |
| `MeshRight.Relay` | 没有 Web Relay 功能 | 暂不实现 |
| `MeshRight.NoAmt` | 没有独立 AMT 门控 | AMT 功能接入时处理 |
| `MeshRight.NoRegistry` | 能力层已处理，没有注册表页面 | 保留现有能力 |
| `MeshRight.NoSoftware` | 能力层已处理，没有软件页面 | 保留现有能力 |

以下站点权限目前可以分配，但 Web 没有对应功能页面或完整门控：

- `SiteRight.ServerBackup`
- `SiteRight.ServerRestore`
- `SiteRight.FileAccess`
- `SiteRight.ServerUpdate`
- `SiteRight.Recordings`
- `SiteRight.LockSettings`
- `SiteRight.NoMeshCommand`

这些权限不应被删除。授权编辑器需要明确说明“权限已保存，但当前 Web 尚无对应功能”，或者在产品决定前暂时隐藏尚无消费方的权限项。

## 五、目标设计

### 5.1 单一能力模型

在 `@meshcentral/control-client` 中扩展能力派生，Web 页面不直接拼接权限位。

建议新增：

```ts
interface DeviceGroupUiCapabilities {
  edit: UiPermission;
  remove: UiPermission;
  manageUsers: UiPermission;
  manageComputers: UiPermission;
}

interface DeviceUiCapabilities {
  // 保留现有能力
  details: UiPermission;
  events: UiPermission;
  processes: UiPermission;
  services: UiPermission;
}
```

设计原则：

- `visible` 决定入口是否展示。
- `enabled` 同时考虑权限、网关、设备在线状态和 Agent 能力。
- `reason` 使用稳定错误码，不在业务页面重复推导原因。
- 权限数据缺失时返回 `permission-unknown`，禁止执行写操作。
- 完全管理员也通过同一能力函数展开，不在页面中散落特殊判断。

### 5.2 设备组有效权限

新增设备组权限解析函数，输入至少包括：

- 当前用户 `UserInfo`；
- 当前设备组的直接授权；
- 当前用户所属用户组；
- 用户组对设备组的授权；
- `removeRights` 中与组操作相关的限制；
- 服务端管理全部设备组的特殊配置（如果当前快照可可靠获得）。

若无法可靠计算服务端特殊管理员规则，应返回 `unknown`，而不是推断为允许。

### 5.3 写操作双重检查

所有写操作至少执行两次客户端检查：

1. 渲染阶段隐藏或禁用入口。
2. 事件处理器或提交函数中重新读取最新权限并检查。

弹窗打开后权限可能因快照刷新而变化，因此不能只依赖打开弹窗前的判断。服务端拒绝后应显示标准权限错误，并刷新相关资源。

### 5.4 授权范围显式化

在 control-client 中导出明确常量，避免 Web 自行维护接口允许范围：

```ts
DEVICE_USER_ASSIGNABLE_RIGHTS_MASK
DEVICE_USER_GROUP_ASSIGNABLE_RIGHTS_MASK
DEVICE_GROUP_ASSIGNABLE_RIGHTS_MASK
```

同时导出可用于 UI 的权限描述或过滤函数：

```ts
isAssignableDeviceUserRight(flag)
isAssignableDeviceUserGroupRight(flag)
```

Web 的设备权限弹窗根据接口类型过滤权限，不再使用一个全局 `DEVICE_PERMISSIONS` 处理所有授权场景。

## 六、实施阶段

### 阶段 0：协议证据与契约确认（P0）

- 固定目标 MeshCentral 版本和测试环境。
- 使用普通用户和用户组分别调用 `adddeviceuser`，验证每个候选权限位。
- 记录服务端接受、拒绝和实际生效结果，不能只依据请求成功判断。
- 验证设备组移动对源组、目标组的权限要求。
- 验证 `DeviceDetails`、进程、服务、设备事件的服务端权限要求。
- 将证据写入 `docs/meshcentral/`，作为掩码调整依据。

交付物：

- 单设备用户直授允许掩码。
- 单设备用户组直授允许掩码。
- 设备组移动权限矩阵。
- 设备详情、事件和系统管理接口权限矩阵。

### 阶段 1：统一 control-client 权限契约（P0）

- 将 `DEVICE_USER_RIGHTS_MASK` 改为导出的、带语义名称的契约常量。
- 根据阶段 0 结果决定是否扩展单设备允许掩码。
- 新增设备组有效权限和 `DeviceGroupUiCapabilities`。
- 扩展 `DeviceUiCapabilities`，加入详情、事件、进程和服务能力。
- 为未知权限、限制位和管理员展开增加单元测试。
- 保持所有保存值为无符号 32 位整数。

涉及文件：

- `packages/control-client/src/permissions/`
- `packages/control-client/src/resources/devices.ts`
- `packages/control-client/src/resources/groups.ts`
- `packages/control-client/src/index.ts`
- `packages/control-client/docs/permissions.md`

### 阶段 2：修复 Web 授权编辑器（P0）

- 将设备组授权、用户单设备授权、用户组单设备授权拆分为明确的权限集合。
- 单设备弹窗只展示当前接口允许保存的权限。
- “全部权限”按钮使用对应接口的可授予掩码，不再使用概念不清的 `DEVICE_RIGHT_FULL`。
- 编辑已有授权时保留未知权限位，除非用户明确移除，避免旧版本权限被静默清空。
- 不支持的权限显示只读提示，禁止提交无效组合。
- 错误信息区分无效权限组合、服务端拒绝和资源已变化。

涉及文件：

- `apps/web/src/features/users/meshPermissions.ts`
- `apps/web/src/components/users/DevicePermissionModal.tsx`
- `apps/web/src/components/users/DeviceGroupPermissionModal.tsx`
- `apps/web/src/pages/UserDetailsPage.tsx`
- `apps/web/src/pages/UserGroupDetailsPage.tsx`

### 阶段 3：补齐设备组与批量操作门控（P0）

- 设备组编辑按钮使用 `EditMesh` 能力。
- 设备组删除按钮使用明确的删除能力，并保留服务端最终校验。
- 批量移动前逐设备计算源组权限。
- 目标组下拉列表仅展示当前用户可管理的设备组。
- 批量操作预览中列出允许、跳过和权限未知的设备。
- 设备编辑弹窗移动分组时应用同样规则。
- 提交前再次读取最新快照并重新计算权限。

涉及文件：

- `apps/web/src/pages/DeviceGroupsPage.tsx`
- `apps/web/src/pages/DevicesPage.tsx`
- `apps/web/src/components/BatchDeviceOperationsModal.tsx`
- `apps/web/src/components/DeviceEditModal.tsx`
- `apps/web/src/features/permissions/useUiCapabilities.ts`

### 阶段 4：补齐工作台读取权限（P1）

- `DeviceDetails` 不满足时不请求或不展示硬件、网络和系统详情。
- 详情权限未知时展示加载/权限确认状态，而不是空数据冒充无信息。
- 日志页签遵循服务端返回范围，并在 `LimitEvents` 生效时显示“仅显示本人事件”。
- 进程和服务页签按阶段 0 确认的权限门控。
- 工作台从 URL 直接进入无权页签时回退到概览，并展示一次可理解的提示。
- 概览页跳转到日志等页签前检查目标能力。

涉及文件：

- `apps/web/src/pages/DeviceWorkspacePage.tsx`
- `apps/web/src/components/device-workspace/WorkspaceTabs.tsx`
- `apps/web/src/components/device-workspace/DeviceOverviewPanel.tsx`
- `apps/web/src/components/device-workspace/DeviceLogsPanel.tsx`
- `apps/web/src/components/device-workspace/SystemManagementPanels.tsx`

### 阶段 5：统一应用级路由与导航（P1）

- 实时事件页明确区分“当前可见资产事件”和“全站事件”。
- 全站审计路由继续要求 `SiteRight.AllEvents`。
- 设置页不要长期以“仅管理员”代替细粒度权限；待设置功能明确后建立对应能力。
- 导航隐藏、路由保护和页面内部按钮使用相同的 `ApplicationUiCapabilities`。
- 对尚未实现消费方的站点权限决定隐藏、只读提示或继续开放配置。

涉及文件：

- `apps/web/src/app/AppRouter.tsx`
- `apps/web/src/app/AppLayout.tsx`
- `apps/web/src/pages/RealtimeEventsPage.tsx`
- `packages/control-client/src/permissions/uiCapabilities.ts`

### 阶段 6：错误处理与审计（P1）

- 将服务端权限拒绝标准化为统一错误码，例如 `permission-denied`。
- 权限拒绝后刷新用户、设备组或设备授权快照。
- 批量操作逐项保留权限拒绝结果，不把跳过项计为请求失败。
- 客户端日志不得记录 Cookie、Token 或完整授权请求中的敏感数据。
- 关键写操作记录操作目标、权限来源和服务端结果，供调试和审计使用。

## 七、测试计划

### 7.1 单元测试

- 每个 `SiteRight` 和 `MeshRight` 的能力映射。
- 用户直授、用户组继承、设备组授权、单设备授权的按位合并。
- `removeRights` 对正向能力位和限制位的不同处理。
- 管理员、普通用户、权限未知三种状态。
- 单设备可授予掩码拒绝未支持位，并保留已知范围之外的已有位。
- 批量移动对源组、目标组和混合权限目标的分类。
- `DeviceDetails`、`LimitEvents`、`NoDesktop`、`NoTerminal`、`NoFiles` 等限制组合。

### 7.2 组件测试

- 无 `EditMesh` 时设备组编辑和删除按钮不可用。
- 无 `ManageComputers` 时不能移动设备，目标组不出现在下拉列表。
- 单设备授权弹窗不会生成接口拒绝的掩码。
- 权限在弹窗打开后被撤销时，提交被阻止。
- 权限未知时写操作禁用并显示原因。
- 工作台无详情权限时不展示敏感详情区块。
- `LimitEvents` 生效时显示范围提示。

### 7.3 集成与 E2E

至少准备以下账户：

| 角色 | 权限组合 | 验证重点 |
| --- | --- | --- |
| 站点管理员 | `0xFFFFFFFF` | 全部入口与回归 |
| 用户管理员 | `ManageUsers` | 用户页面可用，设备管理不越权 |
| 用户组管理员 | `ManageUserGroups` | 用户组页面可用，其他管理入口受限 |
| 设备组管理员 | `EditMesh + ManageUsers + ManageComputers` | 组编辑、成员管理、设备移动 |
| 一线支持 | `RemoteControl + ChatNotify` | 桌面可用，危险操作不可用 |
| 只读观察员 | `RemoteControl + RemoteViewOnly + NoTerminal + NoFiles` | 桌面只读，终端和文件隐藏 |
| 详情受限用户 | 不含 `DeviceDetails` | 硬件和系统详情不可见 |
| 全局受限用户 | 组权限较高并设置 `removeRights` | 全局限制最终生效 |

关键流程：

1. 直接访问无权路由。
2. 从列表按钮进入无权操作。
3. 通过 URL 打开无权工作台页签。
4. 弹窗打开后撤销权限再提交。
5. 混合权限设备执行批量移动、命令、电源和文件上传。
6. 服务端返回权限拒绝后检查错误提示和状态回读。
7. 用户加入或移出用户组后检查有效权限刷新。

## 八、验收标准

- Web 中不存在只检查连接状态、不检查权限的写操作入口。
- 同一操作的导航、按钮、弹窗和提交函数使用同一个能力来源。
- 单设备授权弹窗生成的所有权限组合都能通过 control-client 校验。
- control-client 允许的单设备掩码有目标 MeshCentral 版本的协议证据和测试。
- 无权限和权限未知状态不会发起写请求。
- 批量操作明确区分成功、失败、跳过和权限未知。
- `DeviceDetails` 与事件范围限制在工作台中有可观察行为。
- 权限拒绝不会只显示底层 `Error.message`。
- 权限模块单元测试、Web 组件测试、类型检查和构建全部通过。
- 人工使用各类测试账户完成权限矩阵验收。

## 九、建议执行顺序

1. 完成单设备授权和设备移动协议验证。
2. 固化 control-client 的可授予掩码与设备组能力模型。
3. 修复单设备授权弹窗契约不一致。
4. 补齐设备组编辑、删除和批量移动门控。
5. 接入 `DeviceDetails`、`LimitEvents`、进程和服务权限。
6. 统一应用路由、错误处理和权限拒绝回读。
7. 完成角色矩阵 E2E 与真实 MeshCentral 环境验收。

## 十、完成定义

只有同时满足以下条件，本计划才视为完成：

- 代码中的权限契约、Web 展示和目标服务端行为一致。
- 所有新增权限判断都有自动化测试。
- 所有 P0 项完成真实服务端验证。
- 文档记录已确认的权限掩码、继承规则和限制位行为。
- 不再依靠页面局部硬编码判断同一项权限。
- 服务端仍保留最终鉴权，前端不会把 UI Capability 描述为安全边界。
