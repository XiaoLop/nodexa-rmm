# 权限 API

`@meshcentral/control-client` 提供 MeshCentral 站点权限、设备组/设备权限的常量、32 位位掩码工具和常用能力判定函数。

这些 API 用于标准化服务端权限值、控制界面状态和构建授权编辑器。客户端权限判断不能替代 MeshCentral 服务端鉴权。

## 权限数据来源

| 数据 | 标准化字段 | 说明 |
| --- | --- | --- |
| 当前用户站点权限 | `UserInfo.siteadmin` | 来自 `userinfo` 消息，目前保留服务端字段名 |
| 可管理用户站点权限 | `ManagedUser.siteRights` | 来自用户对象的 `siteadmin` |
| 用户关联权限 | `ManagedUser.links[].rights` | 设备组、用户组或单设备关联的原始授权掩码 |
| 当前用户设备有效权限 | `Device.effectiveRights` | 优先读取节点的 `effectiveRights`，兼容 `meshrights` |

`Device.effectiveRights` 应作为界面判断当前用户设备能力的首选输入。它表示服务端已经计算或下发的权限，不要求调用方遍历用户组和节点链接。

## 32 位位掩码

MeshCentral 权限是 32 位位掩码。JavaScript 位运算使用有符号 32 位整数，因此服务端或协议中的完全权限可能表现为 `-1` 或 `4294967295`。

```ts
import {
  FULL_RIGHTS,
  composeRights,
  hasAllRights,
  hasAnyRight,
  isFullRights,
  normalizeRights,
} from '@meshcentral/control-client';

normalizeRights(-1); // 4294967295
isFullRights(-1); // true

const rights = composeRights([0x8, 0x40]);
hasAllRights(rights, 0x8); // true
hasAnyRight(rights, 0x20 | 0x40); // true
```

对外保存或发送权限值前应调用 `normalizeRights()`，不要依赖位运算后的负数表现。

## 站点权限

`SiteRight` 包含全部已封装的 `SITERIGHT_*` 常量：

```ts
import {
  SiteRight,
  hasSiteRight,
  isSiteAccountLocked,
  isSiteAdministrator,
  setSiteAccountLocked,
} from '@meshcentral/control-client';

hasSiteRight(user.siteRights, SiteRight.ManageUsers);
isSiteAdministrator(user.siteRights);
isSiteAccountLocked(user.siteRights);

const nextRights = setSiteAccountLocked(user.siteRights, true);
```

为兼容已有调用，包仍导出 `normalizeSiteRights()`、`isFullAdministrator()`、`isUserLocked()` 和 `setUserLocked()`。新代码优先使用名称更明确的站点权限 API。

## 设备组与设备权限

`MeshRight` 包含 `MESHRIGHT_*` 常量。设备组和单设备授权使用同一套掩码。

```ts
import {
  MeshRight,
  composeMeshRights,
  hasMeshRight,
  normalizeMeshRights,
} from '@meshcentral/control-client';

const rights = composeMeshRights([
  MeshRight.RemoteControl,
  MeshRight.WakeDevice,
  MeshRight.DeviceDetails,
]);

hasMeshRight(rights, MeshRight.WakeDevice); // true
normalizeMeshRights(-1); // MeshRight.Administrator
```

`hasMeshRight()` 适合检查独立能力位，例如管理设备、唤醒或卸载。桌面、终端和设备文件同时受限制位影响，应使用能力判定函数。

## 能力判定

```ts
import {
  canUseAgentConsole,
  canUseDeviceFiles,
  canUseServerFiles,
  canUseTerminal,
  getDesktopAccess,
} from '@meshcentral/control-client';

const rights = device.effectiveRights;

if (rights !== undefined) {
  const desktop = getDesktopAccess(rights);
  const terminalAllowed = canUseTerminal(rights);
  const deviceFilesAllowed = canUseDeviceFiles(rights);
}
```

`getDesktopAccess()` 返回：

| 值 | 含义 |
| --- | --- |
| `denied` | 无远程控制基础权限，或包含 `NoDesktop` |
| `view-only` | 包含 `RemoteViewOnly`，允许查看但不允许输入 |
| `limited-input` | 包含 `DesktopLimitedInput`，输入受 MeshCentral 策略限制 |
| `control` | 允许正常桌面控制 |

需要特别区分以下概念：

| API / 权限 | 实际含义 |
| --- | --- |
| `canUseTerminal()` | 普通设备终端；要求 `RemoteControl` 且不能包含 `NoTerminal` |
| `canUseDeviceFiles()` | 目标设备文件浏览和传输；要求 `RemoteControl` 且不能包含 `NoFiles` |
| `canUseAgentConsole()` | Mesh Agent 后台控制台，对应 `AgentConsole` |
| `canUseServerFiles()` | MeshCentral 服务器端设备组文件空间，对应 `ServerFiles` |

## 有效权限边界

客户端不会完整复刻服务端的 `GetMeshRights()` 和 `GetNodeRights()`。真实有效权限还可能涉及：

- 用户对设备组的直接授权；
- 用户组对设备组的授权；
- 用户对单设备的直接授权；
- 用户组对单设备的授权；
- 站点管理员和 `managealldevicegroups` 配置；
- `user.removeRights` 全局限制；
- 域、设备可见性和服务端版本行为。

`removeRights` 也不能简单实现为 `rights &= ~removeRights`。MeshCentral 会清除部分正向能力位，并注入 `NoDesktop`、`NoTerminal`、`NoFiles` 等限制位；设备组管理员权限还会先展开为一组明确能力。

因此客户端遵循以下原则：

1. 服务端授权是唯一安全边界，所有操作仍由服务端最终拒绝或允许。
2. 当前用户的设备界面优先使用 `Device.effectiveRights`。
3. `ManagedUser.links` 适合权限管理界面展示原始授权，不应单独当作最终有效权限。
4. 客户端能力判断用于隐藏、禁用或标记界面状态，不用于建立安全保证。

## 验证

权限模块测试位于 `src/permissions/*.test.ts`，设备权限标准化测试位于 `src/protocol/normalizers.test.ts`。

```bash
pnpm --filter @meshcentral/control-client exec vitest run src/permissions src/protocol/normalizers.test.ts
pnpm --filter @meshcentral/control-client build
```
