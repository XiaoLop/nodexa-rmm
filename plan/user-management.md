# 用户管理功能实施计划

## 1. 目标与约束

基于现有 `GatewayClient` 控制 WebSocket 和 MeshCentral 原生用户接口，实现完整的用户管理功能。

本计划覆盖：

1. 用户列表、搜索、筛选、本地分页和详情。
2. 用户创建、基本资料编辑、启用、禁用和删除。
3. 创建用户时要求首次登录修改密码。
4. 在协议确认后重置已有用户密码，并强制用户下次登录修改密码。
5. 展示创建时间、最近登录时间、上次登录时间和最近访问时间。
6. 在协议确认后查询活动 WebSocket 会话并强制注销会话。
7. 当前用户自删除、自禁用和最后一个全站管理员保护。
8. 控制客户端、Web 页面和协议兼容测试。

必须遵守以下约束：

- 不新增业务网关 HTTP API或第二条管理 WebSocket。
- 所有用户数据和操作结果均以 MeshCentral WebSocket 返回内容为准。
- 不在本计划中实现用户组、角色、设备分组授权、单设备授权或权限管理页面。
- 不在浏览器中持久化密码、临时密码或其他可还原凭据。
- 未经真实消息确认的 action、字段和响应不得作为稳定接口实现。
- 前端保护只用于避免误操作，最终认证、授权和输入校验由 MeshCentral 服务端执行。

## 2. 非目标与能力边界

本期不实现：

- 用户组列表、用户组 CRUD 和成员管理。
- 独立角色、角色模板、角色继承和用户角色分配。
- `siteadmin` 全局权限编辑器。
- 设备分组或单设备权限查看与编辑。
- 全局菜单、路由和设备操作权限体系。
- LDAP、OIDC、SAML 等外部身份源配置与同步。
- 跨多个 MeshCentral 实例的统一用户目录。
- 在没有服务端会话查询能力时，根据最近登录时间推断当前在线。
- 在没有服务端确认时，将请求已受理显示为操作已经生效。

用户启用和禁用仍需读取 `siteadmin`，因为 MeshCentral 使用其中的 `SITERIGHT_LOCKED` 标志表达账户锁定状态。本计划只允许保留或切换该标志，不提供其他全局权限位的编辑能力。

## 3. 已有基础与当前缺口

### 3.1 已有基础

当前仓库已经具备：

- `GatewayClient.request()` 可以通过唯一 `responseid` 发送并匹配 WebSocket 请求。
- `GatewayClient` 已发布 `userInfo`、原始 `message`、连接状态和错误事件。
- `normalizeUserInfo()` 已读取当前用户 ID、名称、邮箱、`siteadmin` 和部分登录时间字段。
- 文档已记录 `users`、`adduser`、`edituser` 和 `deleteuser` 请求示例。
- Web 端已有 `/admin/users` 菜单入口，但目前仍进入管理模块占位页。
- 当前共享状态已经保存当前登录用户信息，可用于判断自删除和自禁用。

### 3.2 当前缺口

- `control-client` 没有 `UsersResource`。
- 用户列表缺少标准化类型和解析器。
- 当前 `UserInfo` 未显式提供密码变更时间和账户锁定状态。
- 没有用户列表、用户详情和用户编辑页面。
- 已有用户密码重置、强制下次登录修改密码、活动会话查询和强制注销协议尚未确认。
- `wssessioncount` 只能证明存在会话计数事件，不能证明可以查询或终止任意用户的会话。
- 当前用户菜单使用 `Boolean(siteadmin)` 判断“站点管理员”，任意非零标志都可能被误判，包括账户锁定标志。

## 4. 阶段 0：确认真实 WebSocket 协议

### 4.0 当前目标网关采样结论（2026-09-08）

- 已确认 `users` 返回 `{ action: "users", users: [...] }`，且不返回 `responseid`。
- 已确认用户字段包含 `_id`、`name`、`email`、`creation`、`login`、`access`、`pastlogin`、`passchange`、`siteadmin`、`llang` 和 `links`；普通用户可能缺少 `siteadmin`。
- 已确认 `wssessioncount` 返回 `{ action: "wssessioncount", wssessions: { [userId]: count } }`，且不返回 `responseid`。
- 会话快照只包含每个用户的活动会话数量，不包含会话 ID、来源地址、客户端标识或活动时间。因此本期可以展示在线、离线和会话数量，不能实现会话详情或强制注销。
- MeshCentral 上游客户端确认 `adduser` 支持 `realname`、`phone` 和 `resetNextLogin`，`edituser` 支持资料字段和 `resetNextLogin`。
- 已确认用户写操作不依赖可匹配的 `responseid/result`：`adduser` 通过 `accountcreate`、`edituser` 通过 `accountchange`、`deleteuser` 通过 `accountremove` 用户事件确认，事件超时后再通过 `users` 回读验证最终状态。
- 已确认目标环境 `edituser` 使用 `id` 指定完整用户 ID，`deleteuser` 同时发送 `userid` 和 `username`。
- 尚未确认管理员重置其他用户密码、指定会话注销或用户全部会话注销协议，不实现猜测 action。

脱敏夹具已保存到 `packages/control-client/src/testing/fixtures/users/` 和 `packages/control-client/src/testing/fixtures/user-sessions/`。

在实现未确认能力前，使用目标 MeshCentral 版本的原生 Web 管理界面执行对应操作，并记录 `/control.ashx` 收发消息。

### 4.1 必须采集的场景

1. 管理员请求用户列表。
2. 无用户管理权限的账号请求用户列表。
3. 创建普通用户。
4. 创建要求首次登录修改密码的用户。
5. 编辑邮箱、真实姓名和电话。
6. 锁定和解除锁定用户。
7. 管理员修改其他用户密码。
8. 强制已有用户下次登录修改密码。
9. 删除普通用户。
10. 删除不存在的用户或当前用户。
11. 查询指定用户的活动会话。
12. 终止指定会话和指定用户的全部会话。

### 4.2 样本存放

脱敏夹具建议保存到：

```text
packages/control-client/src/testing/fixtures/users/
  list.json
  add-success.json
  add-validation-error.json
  edit-success.json
  lock-success.json
  delete-success.json
  permission-denied.json
  password-reset.json

packages/control-client/src/testing/fixtures/user-sessions/
  list.json
  revoke.json
```

夹具不得包含真实用户名、邮箱、电话、IP、密码、令牌、会话密钥或设备密钥。

### 4.3 协议确认表

| 能力         | 已知或候选 action | 必须确认                                    | 无协议时的处理     |
| ------------ | ----------------- | ------------------------------------------- | ------------------ |
| 用户列表     | `users`           | 响应结构、错误结构、字段完整度              | 不实现管理页面     |
| 创建用户     | `adduser`         | 已确认通过 `accountcreate` 事件与回读确认   | 只实现已确认字段   |
| 编辑用户     | `edituser`        | 已确认使用 `id` 并通过 `accountchange` 确认 | 不猜测字段名       |
| 锁定用户     | `edituser`        | `siteadmin` 更新及锁定位语义                | 不开放启用/禁用    |
| 删除用户     | `deleteuser`      | 已确认通过 `accountremove` 事件与回读确认   | 保持未完成         |
| 密码重置     | 待确认            | 当前用户与其他用户是否使用不同 action       | 不开放重置         |
| 强制修改密码 | 待确认            | action、字段及清除方式                      | 仅支持创建时设置   |
| 活动会话     | 待确认            | 会话列表字段、权限和初始化快照              | 只展示历史登录时间 |
| 强制注销     | 待确认            | 单会话和全部会话 action、确认响应           | 不开放注销         |

阶段 0 完成标准：形成消息字段映射，保存脱敏夹具，并为每项未确认能力明确“支持、降级或不实现”的结论。

## 5. 控制客户端类型设计

### 5.1 用户类型

当前用户与管理员查询到的用户列表用途不同，保留 `UserInfo` 表示当前会话用户，并新增：

```ts
export interface ManagedUser {
  id: string;
  name: string;
  realName?: string;
  email?: string;
  phone?: string;
  siteRights: number;
  locked: boolean;
  resetNextLogin?: boolean;
  createdAt?: string;
  lastLoginAt?: string;
  previousLoginAt?: string;
  lastAccessAt?: string;
  passwordChangedAt?: string;
  raw: unknown;
}
```

说明：

- `siteRights` 保留完整无符号 `siteadmin` 值，但用户管理页面不编辑锁定位以外的权限。
- `locked` 从 `SITERIGHT_LOCKED` 计算，避免页面重复位运算。
- `resetNextLogin` 只有在真实响应字段确认后才进行标准化。
- 原始对象保存在 `raw` 中，但默认 UI 不直接展示完整原始数据。

### 5.2 写入参数

```ts
export interface UserCreateOptions {
  username: string;
  password: string;
  email?: string;
  realName?: string;
  phone?: string;
  resetNextLogin?: boolean;
}

export interface UserUpdate {
  email?: string;
  realName?: string;
  phone?: string;
}

export interface PasswordResetOptions {
  password: string;
  resetNextLogin?: boolean;
}
```

写入接口只包含真实消息已经确认支持的字段。密码不得进入用户列表对象、共享 store、诊断信息、错误详情或前端日志。

### 5.3 会话类型

只有在阶段 0 确认会话协议后增加：

```ts
export interface UserSession {
  id: string;
  userId: string;
  remoteAddress?: string;
  userAgent?: string;
  createdAt?: string;
  lastActiveAt?: string;
  current: boolean;
  raw: unknown;
}
```

如果服务端只提供会话数量而不提供会话列表，则不构造虚假的会话详情对象。

## 6. 用户标准化与账户状态

新增用户列表标准化函数：

```text
packages/control-client/src/protocol/userNormalizers.ts
```

提供：

- `normalizeManagedUser(value)`。
- `normalizeManagedUsers(value)`。
- 阶段 0 确认后增加 `normalizeUserSession(value)` 和 `normalizeUserSessions(value)`。

### 6.1 时间字段

统一复用现有 `timestampValue()` 解析：

- `creation`：创建时间。
- `login`：最近登录时间。
- `pastlogin`：上次登录时间。
- `access`：最近访问时间。
- `passchange`：密码最近修改时间。

字段缺失时保留 `undefined`，页面显示“未提供”或“从未登录”，不能使用当前时间填充。

### 6.2 锁定状态

MeshCentral 的 `siteadmin` 是 32 位位掩码，JavaScript 位运算会将 `0xFFFFFFFF` 表示为 `-1`。新增最小账户状态工具：

```ts
export const SITE_RIGHT_LOCKED = 0x00000020;

export function normalizeSiteRights(value: number): number {
  return value >>> 0;
}

export function isUserLocked(value: number): boolean {
  return (normalizeSiteRights(value) & SITE_RIGHT_LOCKED) === SITE_RIGHT_LOCKED;
}

export function setUserLocked(value: number, locked: boolean): number {
  const rights = normalizeSiteRights(value);
  return locked ? (rights | SITE_RIGHT_LOCKED) >>> 0 : (rights & ~SITE_RIGHT_LOCKED) >>> 0;
}

export function isFullAdministrator(value: number): boolean {
  return normalizeSiteRights(value) === 0xffffffff;
}
```

`setUserLocked()` 必须保留所有其他位。不得在禁用时直接写入 `32`，也不得在启用时直接写入 `0`。

## 7. UsersResource 设计

新增：

```text
packages/control-client/src/resources/users.ts
```

建议公开接口：

```ts
export class UsersResource {
  list(): Promise<ManagedUser[]>;
  create(options: UserCreateOptions): Promise<unknown>;
  update(userId: string, updates: UserUpdate): Promise<unknown>;
  setLocked(userId: string, locked: boolean, currentSiteRights: number): Promise<unknown>;
  remove(userId: string): Promise<unknown>;
}
```

阶段 0 确认协议后再增加：

```ts
resetPassword(userId: string, options: PasswordResetOptions): Promise<unknown>;
setResetNextLogin(userId: string, required: boolean): Promise<unknown>;
listSessions(userId: string): Promise<UserSession[]>;
revokeSession(userId: string, sessionId: string): Promise<unknown>;
revokeAllSessions(userId: string): Promise<unknown>;
```

### 7.1 请求规则

- `list()` 发送 `action: "users"` 并标准化响应。
- `create()` 发送 `action: "adduser"`，只包含已确认字段。
- `update()` 发送 `action: "edituser"`，至少包含一个实际变化字段。
- `setLocked()` 使用最新 `siteadmin` 计算锁定值后发送 `edituser`。
- `remove()` 发送 `action: "deleteuser"`。
- 所有用户 ID、用户名、密码和非空更新在发送前进行客户端校验。
- 所有写操作等待匹配响应，不以 `send()` 成功代替服务端操作成功。

### 7.2 GatewayClient 集成

在 `GatewayClient` 增加：

```ts
readonly users: UsersResource;
```

并从 `packages/control-client/src/index.ts` 导出资源、类型、标准化函数和账户状态工具。新增资源继续使用当前 `request()`，保持超时、断线拒绝和 `responseid` 匹配行为一致。

## 8. 用户管理页面

将 `/admin/users` 映射到新的 `UsersPage`，不再进入统一占位页。

建议新增：

```text
apps/web/src/pages/UsersPage.tsx
apps/web/src/components/users/UserCreateModal.tsx
apps/web/src/components/users/UserEditDrawer.tsx
apps/web/src/components/users/UserDetailsDrawer.tsx
apps/web/src/components/users/UserSessionsPanel.tsx
apps/web/src/features/users/userFilters.ts
apps/web/src/features/users/userProtection.ts
```

`UserSessionsPanel` 仅在会话协议确认后实现。

### 8.1 列表、搜索和分页

如果 `users` 返回全量用户，第一阶段采用本地搜索、筛选和分页：

- 默认按用户名排序。
- 搜索用户名、真实姓名和邮箱。
- 筛选全部、正常、锁定、全站管理员和要求修改密码。
- 支持每页 20、50 和 100 条。
- 写操作完成后重新请求用户列表。
- 快速连续刷新时只接受最后一次请求结果。
- WebSocket 重连后重新加载当前页面数据。

建议列：

| 列       | 内容                            |
| -------- | ------------------------------- |
| 用户     | 用户名、真实姓名和邮箱          |
| 状态     | 正常、锁定、首次登录待修改密码  |
| 账户类型 | 全站管理员或普通用户，只读展示  |
| 最近登录 | `login`，不存在时显示“从未登录” |
| 最近访问 | `access`，不存在时显示“未提供”  |
| 操作     | 查看、编辑、启用/禁用、删除     |

不要根据 `lastLoginAt` 推断在线。只有活动会话协议确认后，才能增加“在线”和会话数量列。

### 8.2 加载、空数据和错误状态

- 初次进入显示表格加载状态。
- 用户列表为空时显示明确空状态，并在有权限时提供创建入口。
- 加载失败时保留已有列表，并提供重新加载按钮。
- WebSocket 断开时保留缓存数据，提示内容可能过期，并禁用写操作。
- 服务端权限拒绝与连接错误分开显示。

## 9. 创建用户

创建弹窗包含：

- 用户名。
- 初始密码和确认密码。
- 邮箱。
- 真实姓名。
- 电话。
- 要求首次登录修改密码。

实现规则：

- 用户名提交前去除首尾空白，并按服务端规则校验允许字符和长度。
- 密码规则以服务端返回为最终依据，前端只做已确认的最小校验。
- 初始密码和确认密码只保存在表单内存中。
- 提交成功、失败或关闭弹窗时清空密码字段。
- 不提供浏览器自动保存临时密码的功能。
- 创建成功后重新加载用户列表并定位新用户。
- 创建请求成功但刷新失败时，提示“用户可能已创建，列表刷新失败”，避免重复提交。

`resetNextLogin` 只在阶段 0 确认目标版本字段后发送。若服务端不支持，则隐藏该选项并在能力说明中记录限制。

## 10. 编辑用户

编辑抽屉只包含本计划内的用户资料：

- 邮箱。
- 真实姓名。
- 电话。
- 账户锁定状态使用独立启用/禁用操作，不混入普通资料保存。

用户名创建后默认不可修改，除非阶段 0 明确确认 MeshCentral 支持安全重命名及关联数据迁移。

编辑规则：

- 打开编辑器时保存原始快照。
- 仅提交发生变化的字段。
- 没有变化时不发送请求。
- 提交前重新获取最新用户列表，检查目标仍存在。
- 写入后重新读取服务端状态，不以本地表单值作为最终结果。
- 如果目标已被删除或状态发生冲突，关闭保存状态并要求重新加载。

## 11. 启用与禁用

“禁用”通过添加 `SITERIGHT_LOCKED` 实现，“启用”通过移除该位实现。

提交步骤：

1. 从最新用户列表读取完整 `siteadmin`。
2. 检查目标不是当前登录用户。
3. 如果目标是全站管理员，执行最后一个管理员保护检查。
4. 通过 `setUserLocked()` 计算新值。
5. 使用 `edituser` 提交完整的新 `siteadmin`。
6. 重新查询用户列表确认结果。

禁用操作必须二次确认。确认内容展示用户名，并说明禁用是否会立即终止已有会话；在会话协议未确认前，不承诺自动强制注销。

如果禁用成功但已有会话仍然存在，页面必须分别展示“账户已禁用”和“活动会话尚未确认终止”，不能合并成一个成功状态。

## 12. 删除用户与保护规则

删除用户必须：

- 二次确认并要求核对用户名。
- 禁止删除当前登录用户。
- 检查并保护最后一个未锁定的全站管理员。
- 展示用户的账户状态和最近登录信息。
- 明确说明删除不可通过前端撤销。
- 等待 `deleteuser` 的匹配响应。
- 删除成功后重新请求列表。
- 服务端拒绝时保留当前列表并显示安全的错误摘要。

### 12.1 最后一个全站管理员

前端保护函数建议为纯函数：

```ts
export function isLastActiveAdministrator(target: ManagedUser, users: ManagedUser[]): boolean {
  if (!isFullAdministrator(target.siteRights) || target.locked) return false;
  return users.filter((user) => isFullAdministrator(user.siteRights) && !user.locked).length <= 1;
}
```

该检查用于阻止删除或禁用最后一个可登录的全站管理员。由于多个管理员可能并发操作，前端检查不能代替 MeshCentral 服务端最终校验。

## 13. 密码重置与首次登录修改密码

### 13.1 创建时要求修改密码

阶段 0 确认 `adduser` 的真实字段后，在创建用户表单提供“首次登录必须修改密码”。创建结果必须以服务端响应和后续用户列表字段为准。

### 13.2 已有用户密码重置

协议确认后实现独立密码重置弹窗：

- 输入新临时密码和确认密码。
- 可选要求下次登录修改密码。
- 不回显原密码。
- 不在操作结果中再次展示临时密码。
- 提交结束后立即清空所有密码字段。
- 失败时仅展示密码策略的安全摘要，不记录提交值。

如果修改当前用户密码和管理员重置其他用户密码使用不同 action，应在 `UsersResource` 中使用两个明确方法，不能用参数分支隐藏协议差异。

### 13.3 强制下次登录修改密码

必须确认：

- 设置和清除该状态的 action 与字段。
- 用户列表是否返回可验证状态。
- 用户已有活动会话是否受影响。
- 外部身份源用户是否允许使用该能力。

任一关键点无法确认时，该能力保持未完成。

## 14. 登录信息与活动会话

### 14.1 基础登录信息

在没有会话查询协议时，用户详情只展示：

- 创建时间。
- 最近登录时间。
- 上次登录时间。
- 最近访问时间。
- 密码最近修改时间。

字段缺失时显示“未提供”或“从未登录”，不能由前端猜测。

### 14.2 活动会话

协议确认后增加：

- 活动会话数量。
- 会话来源 IP。
- 浏览器或客户端标识。
- 创建时间和最近活动时间。
- 当前管理会话标识。
- 终止单个会话。
- 强制注销该用户全部会话。

当前用户的当前会话不得在没有额外确认的情况下被误操作终止。

### 14.3 在线状态语义

- `在线`：服务端会话快照确认存在活动会话。
- `离线`：服务端会话快照确认没有活动会话。
- `未知`：只有历史登录字段或会话数据尚未加载。
- `从未登录`：服务端没有登录时间记录。

`wssessioncount` 事件可用于更新已加载会话数量，但不能独立作为所有用户在线状态的初始化来源。

### 14.4 强制注销

- 终止单个会话前展示来源和最近活动信息。
- 终止全部会话前展示影响数量并二次确认。
- 操作成功必须以服务端确认或后续会话快照为准。
- 强制注销不等于禁用账户，用户仍可再次登录。
- 需要阻止再次登录时，应单独执行禁用操作。

## 15. 状态组织与刷新规则

用户管理数据第一阶段由页面级状态维护：

- `users`：最近一次用户列表。
- `loading`：列表加载状态。
- `error`：最近一次列表错误。
- `selectedUserId`：当前详情用户 ID。
- `requestSequence`：防止过期请求覆盖新结果。
- `mutationState`：当前写操作及其结果。

当前登录用户继续由共享网关状态提供，用于自删除、自禁用和当前会话保护。

刷新规则：

- 用户写操作后刷新用户列表和当前详情。
- 修改当前登录用户资料后重新请求 `userinfo`；若目标版本不支持主动刷新，则等待推送或重新连接。
- WebSocket 重连后重新加载当前页面数据。
- 断线前缓存仅供阅读，不允许执行写操作。
- 快速切换搜索和分页只处理本地数据，不重复请求全量用户列表。

## 16. 错误、安全与并发

### 16.1 错误分类

页面至少区分：

- 参数校验失败。
- 权限不足。
- 用户不存在。
- 用户名重复。
- 密码策略不满足。
- 不允许修改或删除当前用户。
- 最后一个管理员保护。
- 当前连接断开。
- 请求超时。
- 服务端协议不支持。
- 状态已被其他管理员修改。

不得把所有失败统一显示为“网络错误”。

### 16.2 敏感信息

- 密码不进入标准化响应、共享状态、诊断日志和错误上报。
- 默认 UI 不展示用户对象的完整原始 JSON。
- 调试视图如需展示原始数据，必须复用脱敏工具。
- 会话 ID 默认显示摘要，执行注销时使用内存中的完整值。
- 邮箱、电话和来源 IP 根据页面用途进行最小化展示。

### 16.3 并发修改

MeshCentral WebSocket 操作通常没有前端可见的版本号。为降低覆盖风险：

- 打开编辑器时保存原始用户快照。
- 提交前重新获取用户列表。
- 只提交实际变化字段。
- 锁定和解锁始终基于最新 `siteadmin` 计算。
- 写入后重新读取服务端状态。
- 创建成功但刷新失败时阻止原表单直接重复提交。

### 16.4 高风险确认

以下操作需要二次确认：

- 禁用用户。
- 删除用户。
- 重置密码。
- 强制用户下次登录修改密码。
- 强制注销全部会话。

## 17. 测试计划

### 17.1 账户状态纯函数

- `0`、普通权限组合、最高位和 `0xFFFFFFFF` 的无符号转换。
- 添加或移除锁定位时保留其他 `siteadmin` 位。
- 严格区分全站管理员和任意非零 `siteadmin`。
- 最后一个未锁定全站管理员判断。

### 17.2 用户标准化

- 用户列表的不同包裹结构和可选字段。
- 时间戳、负数位掩码和缺失字段兼容。
- 锁定状态计算。
- 无效用户对象被忽略或返回明确解析失败。
- 原始对象保留，但密码和令牌不进入标准化字段。

### 17.3 UsersResource

- `users`、`adduser`、`edituser` 和 `deleteuser` 请求结构。
- 用户 ID、用户名、密码和空更新校验。
- 锁定与解锁只改变 `SITERIGHT_LOCKED`。
- 权限不足、重复用户名、密码策略、超时和断线错误。
- 未确认协议的方法不以猜测 action 对外暴露。

### 17.4 Web 页面

- 用户列表加载、搜索、筛选、本地分页和空数据。
- 列表失败后保留已有数据并允许重试。
- 创建、编辑、锁定、解锁和删除用户。
- 当前用户自删除和自禁用保护。
- 最后一个全站管理员保护。
- WebSocket 断线时禁止写操作，重连后刷新数据。
- 创建成功但刷新失败时不会误导用户重复创建。
- 登录时间缺失时正确显示“从未登录”或“未提供”。

### 17.5 密码与会话

协议确认后补充：

- 创建时要求首次登录修改密码。
- 重置密码成功、密码策略失败和连接中断。
- 密码字段在关闭和提交后被清空。
- 活动会话列表、空会话和加载失败。
- 单会话注销、全部注销和当前会话保护。
- 会话数量事件与会话快照同步。

### 17.6 真实环境验收

至少使用以下账号完成验收：

1. 全站管理员。
2. 具备用户管理能力但不是全站管理员的账号。
3. 不具备用户管理能力的普通账号。

验证成功路径和 MeshCentral 服务端拒绝路径，并确认用户操作是否产生目标版本可查询的事件或日志。

## 18. 分阶段实施

### 阶段 A：协议、类型与资源基础

1. 采集用户列表、CRUD、锁定、密码和会话消息样本。
2. 增加 `ManagedUser`、写入参数和账户状态工具。
3. 实现用户标准化解析器。
4. 实现 `UsersResource.list()`。
5. 为已确认的读写协议补充夹具测试。

完成标准：用户列表可稳定标准化，锁定位不会覆盖其他 `siteadmin` 位，公开写入方法都有真实协议依据。

### 阶段 B：只读用户列表与详情

1. 实现用户列表、本地搜索、筛选和分页。
2. 实现加载、空数据、错误和断线状态。
3. 实现用户详情和登录时间展示。
4. 注册 `/admin/users` 路由。

完成标准：管理员可以只读查看已确认的用户字段；最近登录和在线状态不会混淆。

### 阶段 C：用户 CRUD

1. 实现创建用户。
2. 实现基本资料编辑。
3. 实现启用和禁用。
4. 实现删除及保护规则。
5. 每次写入后重新读取服务端最终状态。

完成标准：用户 CRUD 具备参数校验、高风险确认、自操作保护、最后一个管理员保护和明确失败反馈。

### 阶段 D：密码生命周期

1. 实现创建时要求首次登录修改密码。
2. 协议确认后实现已有用户密码重置。
3. 协议确认后实现强制下次登录修改密码。
4. 补充密码策略错误和敏感数据清理测试。

完成标准：密码不会进入持久状态或日志，所有结果以服务端响应为准。

### 阶段 E：活动会话管理

1. 实现活动会话查询。
2. 增加在线、离线和未知状态。
3. 实现指定会话注销。
4. 实现用户全部会话强制注销。
5. 补充当前会话保护和会话刷新逻辑。

该阶段必须以目标 MeshCentral 版本确认支持为前提。若没有管理会话协议，保留历史登录信息并明确能力限制。

## 19. 质量门禁

每个阶段完成后执行：

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm format:check`

涉及真实服务端协议的阶段还必须：

- 使用目标 MeshCentral 版本完成手工验收。
- 将脱敏协议样本固化为自动化测试夹具。
- 验证管理员、受限管理员和普通用户的成功及拒绝路径。
- 检查密码、令牌、会话 ID 和个人信息没有进入前端日志。

## 20. 验收标准

- `/admin/users` 提供可用的用户列表、搜索、筛选、本地分页和详情。
- 用户创建、编辑、启用、禁用和删除全部通过当前 MeshCentral WebSocket 完成。
- 启用和禁用只修改 `SITERIGHT_LOCKED`，不会覆盖其他 `siteadmin` 位。
- 当前用户不能删除或禁用自己，最后一个未锁定全站管理员受到保护。
- 页面正确展示创建、最近登录、上次登录、最近访问和密码变更时间。
- 最近登录时间不会被误用为当前在线状态。
- 密码不会进入共享状态、持久存储、诊断日志或错误上报。
- 未经真实 WS 样本确认的密码重置或会话操作不会以猜测协议上线。
- 所有越权或无效请求仍由 MeshCentral 服务端最终拒绝。
- 相关测试和完整质量门禁通过。

## 21. 推荐实施顺序

1. 采集并确认用户列表、CRUD、账户锁定、密码和会话相关 WebSocket 协议。
2. 实现用户类型、标准化解析器、账户状态工具和单元测试。
3. 实现 `UsersResource` 和用户列表查询。
4. 实现只读用户列表、搜索、筛选、分页和详情。
5. 实现用户创建、编辑、启用、禁用和删除。
6. 在协议支持时实现密码重置和强制下次登录修改密码。
7. 在协议支持时实现活动会话查询和强制注销。
8. 完成真实环境验收、自动化测试和质量门禁。
