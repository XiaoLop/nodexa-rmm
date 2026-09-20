# 权限体系改造实施计划

## 1. 背景与已确认事实

当前服务端不会在 `nodes` 响应中返回 `meshrights` 或其他已经计算完成的设备有效权限字段。前端必须根据当前会话收到的授权关系计算当前用户对设备组和设备的操作权限。

已经确认以下协议边界：

1. `meshes` 和 `nodes` 只返回当前用户能够查看的设备组与设备。
2. 资产可见性由 MeshCentral 服务端决定，前端不通过权限位推导或扩大可见范围。
3. `userinfo.links` 的 key 前缀决定关联类型：
   - `mesh/...`：当前用户对设备组的直接授权。
   - `node/...`：当前用户对单设备的直接授权。
   - `ugrp/...`：当前用户属于该用户组；其中的 `rights` 是成员关系标记，不是设备操作权限。
4. 用户组授予的设备权限需要从 `mesh.links[ugrpId]` 和 `node.links[ugrpId]` 读取。
5. 设备最终权限由设备组授权、单设备授权和用户组授权按位合并，再应用 `userinfo.removeRights`。
6. `userinfo.siteadmin` 是站点权限，不应直接等同于设备完全权限。
7. 前端权限只控制展示和交互体验，所有实际操作仍由服务端执行最终鉴权。

## 2. 改造目标

本次改造需要完成：

1. 在没有 `meshrights` 的前提下，稳定计算当前用户对每个可见设备的有效权限。
2. 正确处理 `userinfo.links`、`mesh.links`、`node.links` 和用户组授权。
3. 按 MeshCentral 规则应用 `userinfo.removeRights`，同时处理正向能力位和负向限制位。
4. 将权限、服务器功能、设备能力和运行状态统一转换成 UI capability。
5. 修正权限管理页面中 `AgentConsole`、`ServerFiles` 等权限的错误名称。
6. 对数据缺失、不一致和未知协议状态采用保守降级，不推导额外权限。
7. 为权限解析、能力生成和典型授权场景补齐自动化测试。

## 3. 非目标与安全边界

本次不实现：

- 在前端决定设备组或设备是否对用户可见。
- 绕过 `meshes`、`nodes` 响应构造用户不可见的资产。
- 使用 `siteadmin === 0xFFFFFFFF` 无条件授予全部设备权限。
- 将 `userinfo.links["ugrp/..."].rights` 当作设备权限。
- 仅依靠前端隐藏按钮作为安全鉴权。
- 猜测未经当前 MeshCentral 版本确认的 `features/features2/features3` 位含义。

服务端仍是唯一安全边界。前端即使计算为允许，服务端也必须在执行命令时重新检查当前用户权限。

## 4. 权限数据模型

### 4.1 当前用户信息

扩展 `UserInfo`，把权限计算需要的字段从 `raw` 中标准化出来：

```ts
export interface UserInfo {
  id: string;
  name?: string;
  siteadmin?: number;
  removeRights: number;
  links: Record<string, UserInfoLink>;
  raw?: unknown;
}

export interface UserInfoLink {
  id: string;
  type: 'device-group' | 'device' | 'user-group' | 'unknown';
  rights: number;
  name?: string;
}
```

标准化规则：

- `mesh/` 映射为 `device-group`。
- `node/` 映射为 `device`。
- `ugrp/` 映射为 `user-group`。
- 所有权限值通过 `normalizeRights()` 转成无符号 32 位整数。
- 缺失的 `removeRights` 标准化为 `0`。
- 保留 `raw` 仅用于诊断和协议兼容，不作为业务组件的主要数据源。

### 4.2 设备组与设备授权关系

为 `DeviceGroup` 和 `Device` 增加标准化后的关联权限：

```ts
export interface PrincipalGrant {
  principalId: string;
  rights: number;
  name?: string;
}

export interface DeviceGroup {
  id: string;
  name: string;
  type?: number;
  grants?: Record<string, PrincipalGrant>;
  raw?: unknown;
}

export interface Device {
  id: string;
  groupId?: string;
  grants?: Record<string, PrincipalGrant>;
  effectiveRights?: number;
  raw?: unknown;
}
```

`effectiveRights` 保留为客户端派生字段，不再假设它来自服务端。派生结果应在设备、设备组和用户快照变化时重新计算。

## 5. 有效权限计算

### 5.1 可见性前置条件

只为 `nodes` 已返回的设备计算权限。若设备不在当前 `nodes` 快照中，则前端视为不可见，不创建 capability，也不允许通过缓存继续操作。

设备必须能够通过 `groupId` 找到当前 `meshes` 快照中的设备组。若找不到：

- 权限结果标记为 `unknown`。
- 所有需要设备权限的操作保持禁用。
- 记录诊断信息，但不将该设备推断为无权限或完全权限。

### 5.2 用户组成员集合

只从 `userinfo.links` 的 key 前缀识别用户组：

```ts
const userGroupIds = Object.keys(userInfo.links)
  .filter((id) => id.startsWith('ugrp/'));
```

`userinfo.links[ugrpId].rights` 不参与设备权限按位合并。

### 5.3 设备组基线权限

设备组权限按以下来源合并：

```text
userinfo.links[mesh.id].rights
| mesh.links[userinfo.id].rights
| mesh.links[userGroupId1].rights
| mesh.links[userGroupId2].rights
| ...
```

其中前两项是同一条直接授权的两个可能镜像来源。实现要求：

- 任一来源存在即可参与计算。
- 两边都存在时按位或，避免因快照暂时不一致丢失授权。
- 两边数值不一致时发送诊断事件，便于检查服务端快照时序。
- 不使用覆盖策略静默选择其中一边。

### 5.4 单设备增量权限

在设备组基线权限上继续合并：

```text
userinfo.links[node.id].rights
| node.links[userinfo.id].rights
| node.links[userGroupId1].rights
| node.links[userGroupId2].rights
| ...
```

设备组权限与单设备权限是累加关系，不互相覆盖。

### 5.5 完全权限

任一有效授权来源为 `0xFFFFFFFF` 时，合并阶段结果为 `FULL_RIGHTS`，但仍必须继续应用 `removeRights`。

不得仅因为 `userinfo.siteadmin === 0xFFFFFFFF` 就返回设备 `FULL_RIGHTS`。只有当前 MeshCentral 版本明确提供并确认了 `managealldevicegroups` 规则后，才能将该配置纳入设备权限计算。

### 5.6 应用 `removeRights`

新增独立函数：

```ts
applyUserDeviceRestrictions(
  rights: number,
  removeRights: number,
): number
```

处理分为两类。

需要从结果中删除的正向能力位：

| 权限 | 值 |
| --- | ---: |
| `RemoteControl` | `0x00000008` |
| `AgentConsole` | `0x00000010` |
| `WakeDevice` | `0x00000040` |
| `Uninstall` | `0x00008000` |
| `RemoteCommand` | `0x00020000` |
| `ResetOff` | `0x00040000` |

需要向结果中添加的负向限制位：

| 权限 | 值 |
| --- | ---: |
| `RemoteViewOnly` | `0x00000100` |
| `NoTerminal` | `0x00000200` |
| `NoFiles` | `0x00000400` |
| `NoDesktop` | `0x00010000` |
| `NoRegistry` | `0x00400000` |
| `NoSoftware` | `0x00800000` |

禁止使用统一的 `rights &= ~removeRights`，因为 `NoTerminal`、`NoFiles`、`NoDesktop` 等限制需要被添加到最终权限中。

`FULL_RIGHTS` 应先按照当前服务端 `removeUserRights()` 的实际规则展开，再应用删除和添加操作。实现前保存当前目标 MeshCentral 版本的源码证据或协议夹具，避免依赖可能变化的上游常量集合。

### 5.7 结果类型

权限解析应返回可诊断结果，而不是只返回数字：

```ts
export interface EffectiveDeviceRightsResult {
  status: 'resolved' | 'unknown';
  rights?: number;
  sources: {
    directMesh?: number;
    userGroupMesh: number;
    directNode?: number;
    userGroupNode: number;
    removeRights: number;
  };
  reason?: 'missing-user' | 'missing-group' | 'missing-links' | 'unsupported-admin-rule';
}
```

生产 UI 默认只消费 `status` 和 `rights`；详细来源用于测试、诊断日志和开发工具，不向普通用户暴露内部授权结构。

## 6. 服务器信息改造

当前 `GatewayClient` 只把 `serverinfo` 当作连接握手信号，没有解析和保存其内容。需要增加：

```ts
export interface ServerInfo {
  features?: number;
  features2?: number;
  features3?: number;
  guestDeviceSharing?: boolean;
  manageAllDeviceGroups?: boolean;
  raw?: unknown;
}
```

改造内容：

1. `decodePush()` 解析 `serverinfo`。
2. `GatewayClient` 发布 `serverInfo` 事件。
3. `shared-state` 保存 `serverInfo` 并提供 selector。
4. capability 仅使用已经确认语义的字段。
5. 未确认的 feature 位保留原始值，不在 UI 中猜测功能开关。

如果当前服务端实际字段为 `managealldevicegroups`，标准化时映射成 `manageAllDeviceGroups`。在没有验证其精确授权条件前，不使用它自动授予设备权限。

## 7. UI Capability 分层

统一使用以下四层输入：

```text
当前资产已由服务端返回
&& 当前用户权限允许
&& 服务端功能已启用
&& 设备能力与状态允许
```

`UiPermission` 扩展为明确区分授权和即时可用性：

```ts
export interface UiPermission {
  visible: boolean;
  enabled: boolean;
  reason?:
    | 'permission-denied'
    | 'permission-unknown'
    | 'gateway-disconnected'
    | 'device-offline'
    | 'feature-disabled'
    | 'agent-unsupported';
}
```

展示策略：

- 权限明确不允许：隐藏。
- 权限无法确认：显示为禁用，并提示“正在确认设备权限”。
- 权限允许但网关断开、设备离线或 Agent 不支持：显示但禁用。
- 服务器明确关闭功能：隐藏或禁用，由具体功能的产品行为决定并在测试中固定。

核心能力规则：

```text
桌面：RemoteControl 且非 NoDesktop；RemoteViewOnly/DeskLimitedInput 决定输入模式
终端：RemoteControl 且非 NoTerminal
设备文件：RemoteControl 且非 NoFiles
Agent 控制台：AgentConsole
服务器文件：ServerFiles
远程命令：RemoteCommand
电源操作：ResetOff
唤醒：WakeDevice
```

设备运行条件继续结合：

- `node.conn`：Agent/AMT 在线状态。
- `node.agent.caps`：Desktop、Terminal、Files、Console 能力位。
- `node.intelamt`：AMT 可用状态。
- `mesh.mtype`：设备组类型。
- `NoAmt`：禁止使用 AMT 通道。

`agent.caps` 缺失与值为 `0` 的兼容语义必须通过当前服务端和 Agent 样本确认。在确认前保持现有兼容行为，并增加测试锁定，避免无意改变老版本设备体验。

## 8. 权限管理 UI 修正

当前权限编辑器中的以下名称必须修正：

| 权限位 | 当前错误名称 | 正确名称 |
| --- | --- | --- |
| `0x00000010` | 终端控制台 | Mesh Agent 控制台 |
| `0x00000020` | 远程文件管理 | 服务器文件空间 |

同时在权限编辑器中表达组合关系：

- 普通远程终端不是独立正向位，而是 `RemoteControl` 未被 `NoTerminal` 限制时可用。
- 设备文件管理不是 `ServerFiles`，而是 `RemoteControl` 未被 `NoFiles` 限制时可用。
- 限制项选中表示禁止功能，不能与正向授权使用相同文案语气。

推荐增加预设，而不是增加虚假的新权限位：

| 预设 | 权限组合 |
| --- | --- |
| 远程桌面、终端和文件 | `RemoteControl` |
| 仅远程桌面 | `RemoteControl \| NoTerminal \| NoFiles` |
| 仅设备文件管理 | `RemoteControl \| NoTerminal \| NoDesktop`，即 `0x10208`、`66056` |
| 桌面只读 | `RemoteControl \| RemoteViewOnly \| NoTerminal \| NoFiles` |

预设只负责选择现有位，保存时仍发送标准 `rights` 数值。

## 9. 实施阶段

### 阶段 0：保存协议证据

采集并脱敏保存：

```text
userinfo.json
serverinfo.json
meshes.json
nodes.json
```

样本至少覆盖：

- 用户直接获得设备组权限。
- 用户直接获得单设备权限。
- 用户通过一个用户组获得设备组权限。
- 用户通过一个用户组获得单设备权限。
- 用户属于多个用户组。
- 用户带有 `removeRights`。
- 完全设备组权限叠加 `removeRights`。
- 管理员账号在 `managealldevicegroups` 开启和关闭时的差异。

完成标准：确认 `mesh.links`、`node.links` 对当前可见资产包含计算所需的用户组授权项，并记录字段缺失行为。

### 阶段 1：协议与类型标准化

修改：

- `packages/control-client/src/types.ts`
- `packages/control-client/src/protocol/normalizers.ts`
- `packages/control-client/src/protocol/codec.ts`
- `packages/control-client/src/client/GatewayClient.ts`
- `packages/shared-state/src/types.ts`
- `packages/shared-state/src/store.ts`
- `packages/shared-state/src/binding.ts`

完成标准：业务代码无需读取 `raw.links` 即可获得标准化用户、设备组、设备授权关系和服务器信息。

### 阶段 2：有效权限解析器

重构：

```text
packages/control-client/src/permissions/deviceRights.ts
```

新增：

- `applyUserDeviceRestrictions()`。
- `resolveDeviceGroupRights()`。
- `resolveEffectiveDeviceRights()` 的可诊断结果。
- 直接授权镜像不一致诊断。

完成标准：所有典型权限组合均可在不依赖 `meshrights` 的情况下得到稳定结果。

### 阶段 3：Capability 生成

调整：

- `packages/control-client/src/permissions/capabilities.ts`
- `packages/control-client/src/permissions/uiCapabilities.ts`
- `apps/web/src/features/permissions/useUiCapabilities.ts`

完成标准：权限、功能开关、设备能力和在线状态分别参与判断；UI 能区分无权限、权限未知和暂时不可用。

### 阶段 4：权限编辑器

调整：

- `apps/web/src/features/users/meshPermissions.ts`
- `apps/web/src/components/users/DeviceGroupPermissionModal.tsx`
- `apps/web/src/components/users/DevicePermissionModal.tsx`

完成标准：权限名称与 MeshCentral 语义一致，“仅设备文件管理”等常见组合能够被正确配置和回显。

### 阶段 5：文档与迁移

更新：

- `packages/control-client/docs/permissions.md`
- `docs/meshcentral/07-permissions.md`
- `docs/meshcentral/permissions.md`

删除或修正所有“`Device.effectiveRights` 由服务端下发”的描述，明确它是当前项目前端根据服务端可见快照派生的结果。

## 10. 测试计划

### 10.1 权限解析单元测试

至少覆盖：

1. 仅 `userinfo.links[meshId]` 存在直接设备组授权。
2. 仅 `mesh.links[userId]` 存在直接设备组授权。
3. 两个镜像来源同时存在且一致。
4. 两个镜像来源不一致时按位合并并产生诊断。
5. `userinfo.links[nodeId]` 的单设备授权。
6. 用户组设备组授权。
7. 用户组单设备授权。
8. 多用户组权限累加。
9. `userinfo.links[ugrpId].rights` 不被并入设备权限。
10. 单设备权限与设备组权限累加。
11. `FULL_RIGHTS` 应用 `removeRights`。
12. 正向能力被 `removeRights` 删除。
13. `NoDesktop/NoTerminal/NoFiles` 被 `removeRights` 添加。
14. 缺少用户、设备组或关联信息时返回 `unknown`。
15. `siteadmin` 不自动转换成设备 `FULL_RIGHTS`。

### 10.2 Capability 测试

至少覆盖：

| 场景 | 最终权限 | 预期 |
| --- | ---: | --- |
| 普通远控 | `8` | 桌面、终端、文件可见 |
| 仅设备文件 | `66056` | 只显示文件 |
| 仅桌面 | `1544` | 只显示桌面 |
| 桌面只读 | `1800` | 桌面可见，输入隐藏 |
| 禁止全部远控 | `0` | 桌面、终端、文件隐藏 |
| Agent 离线 | `8` | 有权限入口可见但禁用 |
| Agent 不支持文件 | `8` | 文件可见但禁用 |
| 权限未知 | `undefined` | 入口禁用并显示确认中 |

说明：表中的组合值必须由常量计算生成，测试代码中不要重复手写魔法数字。

### 10.3 协议与状态测试

- `normalizeUserInfo()` 正确解析 links 和 `removeRights`。
- `normalizeGroups()`、`normalizeDevices()` 保留授权关系和父设备组 ID。
- `decodePush()` 发布 `serverInfo`。
- 重新连接后旧的用户、设备组、设备和服务器权限快照被替换，不能沿用上一个会话的数据。
- 设备从 `nodes` 快照消失后，相关 capability 和工作台缓存同步失效。

### 10.4 回归验证命令

```bash
pnpm --filter @meshcentral/control-client exec vitest run src/permissions src/protocol
pnpm --filter @meshcentral/control-client build
pnpm --filter @meshcentral/shared-state test
pnpm --filter @meshcentral/shared-state build
pnpm --filter web test
pnpm --filter web build
```

## 11. 验收标准

改造完成后必须满足：

1. 不依赖服务端 `meshrights` 字段。
2. 只对服务端已返回的设备组和设备生成 capability。
3. 用户直接授权、用户组授权、设备组授权和单设备授权均正确累加。
4. `userinfo.links[ugrpId].rights` 不被误当作设备权限。
5. `removeRights` 能正确删除正向位并添加限制位。
6. 站点管理员不会在缺少设备授权依据时被前端自动视为设备完全管理员。
7. “仅设备文件管理”权限 `0x10208` 只显示文件管理入口。
8. `0x10` 显示为 Mesh Agent 控制台，`0x20` 显示为服务器文件空间。
9. 无权限时隐藏，有权限但离线或不支持时禁用，权限数据不完整时保守禁用。
10. 所有实际操作仍由服务端进行最终鉴权，前端 capability 不作为安全边界。

## 12. 风险与回滚

### 风险

- `mesh.links` 或 `node.links` 对普通用户被裁剪，导致用户组授权无法完整计算。
- 当前 MeshCentral 版本的 `removeUserRights()` 与文档记录存在差异。
- `serverinfo` 字段名或 feature 位在不同版本间变化。
- 老版本 Agent 对 `agent.caps` 缺失或为 `0` 的语义不同。
- 快照更新顺序造成 `userinfo`、`meshes`、`nodes` 暂时不一致。

### 缓解措施

- 权限数据不完整时返回 `unknown`，不猜测允许。
- 保存当前目标版本的脱敏协议夹具和上游源码证据。
- 对镜像授权不一致发送诊断，不阻断正常按位合并。
- 快照更新后统一重新计算，不在组件中零散缓存权限数字。
- 保留旧 capability API 的兼容适配层，按阶段迁移页面。

### 回滚策略

如果上线后发现权限计算与服务端行为不一致：

1. 关闭新的本地权限解析开关。
2. 将设备敏感操作入口统一降级为禁用并提示权限待确认。
3. 保留资产列表可见性，因为它仍由服务端 `meshes/nodes` 响应控制。
4. 根据诊断样本修正规则后再恢复 capability。
