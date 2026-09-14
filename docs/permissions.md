# MeshCentral 权限体系完整技术手册

本文档系统性梳理 MeshCentral 的权限模型，涵盖权限分类、继承与优先级判定规则、全量权限码（掩码值）及典型场景配置方案。

---

## 一、 四种核心权限的定位与关系

MeshCentral 的权限模型围绕 **“主体（谁）”** 对 **“对象（什么资产）”** 拥有 **“何种操作权限”** 进行设计，主要包含以下四种权限维度：

```text
                    ┌─────────────────────────┐
                    │      1. 用户权限         │
                    │ (Site Admin & 账号限制) │
                    └───────────┬─────────────┘
                                │ 决定全局系统特权与最终强制约束
                                ▼
  ┌─────────────────┐       继承 / 叠加       ┌─────────────────┐
  │   3. 用户组权限   │ ───────────────────►  │   2. 设备组权限   │
  │ (User Group)    │                       │ (Mesh Rights)   │
  └────────┬────────┘                       └────────┬────────┘
           │                                         │
           │ 独立授予单机                             │ 基线继承
           ▼                                         ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                        4. 单设备权限                         │
  │                     (Node / Device Rights)                  │
  └─────────────────────────────────────────────────────────────┘
```

### 1. 用户权限（User / Site Rights）

- **定位**：绑定在用户账号（User Account）本体上的全局属性。
- **组成**：
  - **站点管理权限（`siteadmin`）**：决定用户在整个服务器/域系统层级的管理权（如备份还原、全局用户管理、日志审计、超管特权等）。
  - **全局剥夺限制（`removeRights`）**：由超管为该账号附加的强制性“安全缰绳”，无论该用户在任何设备组或单设备获得多高权限，该限制都拥有终审一票否决权。

### 2. 设备组权限（Device Group / Mesh Rights）

- **定位**：用户或用户组在特定“设备组（Mesh）”范围内的控制基线。
- **作用**：
  - **组级管理权**：如重命名组、管理组内用户及授权、跨组移动/添加设备等。
  - **组内设备的基线权限**：作为该组下所有纳管计算机的**默认继承权限**。

### 3. 用户组权限（User Group Rights）

- **定位**：用户组本身是一个**权限承载与传递容器（Principal）**，并非独立的权限位。
- **作用**：
  - 将多个用户组织成组（如运维组、客服部）。
  - 用户组可被直接授予某个“设备组”或某台“单设备”的权限。
  - 组内成员自动继承该用户组所获得的所有设备组及设备操作权限。

### 4. 单设备权限（Device / Node Rights）

- **定位**：针对某台具体计算机（Node）的特化授权。
- **作用**：
  - 针对具体设备进行权限**微调与增补**（如某技术员对全组只读，但对特定开发机拥有完全控制权）。
  - 实现**点对点授权**（用户不加入任何设备组，仅单独授权访问某几台特定设备）。

---

## 二、 权限判定与优先级计算规则

在 MeshCentral 核心代码（`webserver.js` 中的 `GetMeshRights` 与 `GetNodeRights`）中，权限解析采用 **“超管特权 ➔ 组级基线 ➔ 单机增量并集 ➔ 负向强制过滤”** 的计算链路：

### 1. 计算流程图

```text
[发起请求：用户试图操作某台设备]
                   │
                   ▼
       ┌──────────────────────┐
       │ 用户是站点超管?       │──(是)──► 直接获得完全控制权 (0xFFFFFFFF)
       │ (siteadmin==全F且有域权)│
       └──────────────────────┘
                   │(否)
                   ▼
       ┌──────────────────────┐
       │ 计算设备组基线权限    │
       │ (GetMeshRights)      │
       └──────────────────────┘
          │  ├─ 用户直连设备组权限
          │  └─ 用户所属所有用户组在设备组上的权限
          │  (多路按位取并集: rights |= groupRights)
          ▼
       ┌──────────────────────┐
       │ 叠加单设备单独权限    │
       │ (GetNodeRights)      │
       └──────────────────────┘
          │  ├─ 继承上方设备组基线权限
          │  ├─ 叠加用户对该设备的直接授权 (node.links[userid])
          │  └─ 叠加所属用户组对该设备的单独授权 (node.links[ugrpid])
          │  (增量并集: effectiveRights |= nodeRights)
          ▼
       ┌──────────────────────┐
       │ 终审负向过滤拦截     │
       │ (removeUserRights)   │
       └──────────────────────┘
          │  根据 user.removeRights 强制扣除禁止项、注入限制位
          ▼
   [最终生效的设备操作权限]
```

### 2. 核心优先级特征

1. **站点管理员具有最高站点权限**：设备组跨组访问还会受服务端 `managealldevicegroups` 配置、域范围及 `removeRights` 约束，客户端不应仅凭 `siteadmin === 0xFFFFFFFF` 推断任意设备操作权限。
2. **正向权限累加并集（Additive / Bitwise OR）**：
   - 单设备权限与设备组权限是**叠加关系**，而非“就近覆盖”。
   - 普通终端能力以 `MESHRIGHT_REMOTECONTROL` 为基础，并受 `MESHRIGHT_NOTERMINAL` 限制；`MESHRIGHT_AGENTCONSOLE` 是独立的 Agent 后台控制台权限；
   - 如果设备组只有“查看”，单设备单独勾选了“控制输入”，合并后用户即拥有控制输入能力。
3. **用户组属于中继容器**：用户加入多个用户组时，各组获得的设备/设备组权限会直接**并集累加**。
4. **全局剥夺限制（`removeRights`）具有终审否决权**：
   - 即使设备组和单设备均赋予完全管理员权限（`0xFFFFFFFF`），若用户账号配置了剥夺项（如禁止文件传输），最终结算时文件管理权限依然会被强行剔除。
   - 服务端会清除部分正向能力位，并注入 `NoDesktop`、`NoTerminal`、`NoFiles` 等限制位，不能简化为统一的 `rights &= ~removeRights`。

---

## 三、 全量权限码与功能对照表

### 1. 设备组 / 单设备权限码（Mesh & Node Rights）

设备组和单设备共用同一套 32 位位掩码：

| 权限常量名 | 十六进制值 | 十进制值 | UI 显示名称 | 类别 | 详细作用与说明 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `MESHRIGHT_EDITMESH` | `0x00000001` | 1 | Edit Device Group | 组管理 | 允许修改设备组名称、图标、说明等元数据（仅设备组有效） |
| `MESHRIGHT_MANAGEUSERS` | `0x00000002` | 2 | Manage Device Group Users | 组管理 | 允许在设备组内增删其他成员及分配组权限 |
| `MESHRIGHT_MANAGECOMPUTERS` | `0x00000004` | 4 | Manage Device Group Computers | 组管理 | 允许向组内添加新设备、或在设备组之间移动设备 |
| `MESHRIGHT_REMOTECONTROL` | `0x00000008` | 8 | Remote Control & Relay | 控制基石 | **远程控制总开关**（桌面、终端、文件操作的基础前提） |
| `MESHRIGHT_AGENTCONSOLE` | `0x00000010` | 16 | Mesh Agent Console | 运维控制 | 允许连接和操作 Agent 后台控制台命令行 |
| `MESHRIGHT_SERVERFILES` | `0x00000020` | 32 | Server Files | 数据管理 | 允许访问服务器端为该组/设备存放的云端文件目录 |
| `MESHRIGHT_WAKEDEVICE` | `0x00000040` | 64 | Wake Devices | 电源网络 | 允许发送 Wake-on-LAN 网络唤醒魔术包开机 |
| `MESHRIGHT_SETNOTES` | `0x00000080` | 128 | Edit Device Notes | 协同标注 | 允许查看和编辑设备/设备组的备注说明（Markdown 格式） |
| `MESHRIGHT_REMOTEVIEWONLY` | `0x00000100` | 256 | Remote View Only | **限制位** | 桌面仅可监视，禁止键鼠控制输入 |
| `MESHRIGHT_NOTERMINAL` | `0x00000200` | 512 | No Terminal Access | **限制位** | 禁止打开并使用终端（Shell / CMD / Bash） |
| `MESHRIGHT_NOFILES` | `0x00000400` | 1024 | No File Access | **限制位** | 禁止通过 Web 界面浏览、上传或下载目标机文件 |
| `MESHRIGHT_NOAMT` | `0x00000800` | 2048 | No Intel® AMT | **限制位** | 禁止使用 Intel AMT 硬件级带外远程管理功能 |
| `MESHRIGHT_DESKLIMITEDINPUT` | `0x00001000` | 4096 | Limited Input Only | **限制位** | 限制桌面输入模式（仅限特定白名单键鼠指令） |
| `MESHRIGHT_LIMITEVENTS` | `0x00002000` | 8192 | Show Only Own Events | **限制位** | 限制事件日志审计，仅允许查看自身触发的操作日志 |
| `MESHRIGHT_CHATNOTIFY` | `0x00004000` | 16384 | Chat & Notify | 互动通知 | 允许向被控端设备发送桌面消息弹窗或建立即时聊天 |
| `MESHRIGHT_UNINSTALL` | `0x00008000` | 32768 | Uninstall Agent / Delete Device | 危险操作 | 允许远程卸载 Mesh Agent 或直接从控制台删除设备 |
| `MESHRIGHT_NODESKTOP` | `0x00010000` | 65536 | No Desktop Access | **限制位** | 完全禁用远程桌面选项卡（Desktop Tab 不可见） |
| `MESHRIGHT_REMOTECOMMAND` | `0x00020000` | 131072 | Remote Commands | 运维控制 | 允许通过 Web 界面后台批量执行 Shell 命令或运维脚本 |
| `MESHRIGHT_RESETOFF` | `0x00040000` | 262144 | Reset / Power Off | 电源网络 | 允许执行远程重启、关机、睡眠、重置等电源操作 |
| `MESHRIGHT_GUESTSHARING` | `0x00080000` | 524288 | Guest Sharing | 协同共享 | 允许生成临时远程协助 Web 链接邀请访客控制 |
| `MESHRIGHT_DEVICEDETAILS` | `0x00100000` | 1048576 | Device Details | 资产盘点 | 允许查看底层硬件、BIOS、网卡及系统详细指标 |
| `MESHRIGHT_RELAY` | `0x00200000` | 2097152 | Use as Relay | 网络通道 | 允许作为 TCP 端口转发与 MeshCentral Router 中继目标 |
| `MESHRIGHT_NOREGISTRY` | `0x00400000` | 4194304 | No Registry Access | **限制位** | 禁止远程查看或修改 Windows 注册表 |
| `MESHRIGHT_NOSOFTWARE` | `0x00800000` | 8388608 | No Software | **限制位** | 禁止查看目标机器已安装软件列表或执行软件卸载 |
| `MESHRIGHT_ADMIN` | `0xFFFFFFFF` | 4294967295 | Full Administrator | 完全控制 | 设备组/单设备完全控制权（享有上述所有功能） |

---

### 2. 站点系统管理权限码（Site Admin Rights）

控制用户在站点/服务器范围内的系统特权（存储在 `user.siteadmin`）：

| 权限常量名 | 十六进制值 | 十进制值 | UI 显示名称 | 详细说明 |
| :--- | :--- | :--- | :--- | :--- |
| `SITERIGHT_SERVERBACKUP` | `0x00000001` | 1 | Server Backup | 允许在“我的服务器”页面创建并下载服务器数据备份 |
| `SITERIGHT_MANAGEUSERS` | `0x00000002` | 2 | Manage Users | 允许查看全站用户列表、新建用户及编辑其他用户账号 |
| `SITERIGHT_SERVERRESTORE` | `0x00000004` | 4 | Server Restore | 允许上传并还原服务器备份归档数据 |
| `SITERIGHT_FILEACCESS` | `0x00000008` | 8 | File Access | 允许访问服务器公共网盘存储空间（“我的文件”菜单） |
| `SITERIGHT_SERVERUPDATE` | `0x00000010` | 16 | Server Update | 允许更新服务器版本、查看运行时配置与错误追踪日志 |
| `SITERIGHT_LOCKED` | `0x00000020` | 32 | Locked Account | **锁定账号**：用户无法登录，所有会话被阻断 |
| `SITERIGHT_NONEWGROUPS` | `0x00000040` | 64 | No New Groups | 禁止该用户自行创建新的设备组 |
| `SITERIGHT_NOMESHCMD` | `0x00000080` | 128 | No Mesh Commands | 禁止使用 MeshCmd / MeshCentral Router 命令行工具接入 |
| `SITERIGHT_USERGROUPS` | `0x00000100` | 256 | Manage User Groups | 允许在管理后台创建、维护和删除“用户组” |
| `SITERIGHT_RECORDINGS` | `0x00000200` | 512 | Manage Recordings | 允许在用户管理界面审查和回放所有人的远程会话录像 |
| `SITERIGHT_LOCKSETTINGS` | `0x00000400` | 1024 | Lock Settings | 锁定个人设置（禁止修改个人密码、2FA 绑定、个人偏好） |
| `SITERIGHT_ALLEVENTS` | `0x00000800` | 2048 | All Events | 允许在日志界面查看全服所有设备和用户的审计事件 |
| `SITERIGHT_NONEWDEVICES` | `0x00001000` | 4096 | No New Devices | 禁止该用户下载安装包向平台新增绑定设备 |
| `SITERIGHT_ADMIN` | `0xFFFFFFFF` | 4294967295 | Full Administrator | **服务器完全超级管理员**（拥有全服所有菜单与调试控制台） |

---

### 3. 用户账号全局剥夺限制码（`user.removeRights`）

由管理员在“用户详情 -> 功能特征（Features）”中设置。用于针对特定人员设立全局防线：

| 剥夺项目 | 掩码值（十六进制/十进制） | 最终生效效果（无论设备组/设备如何授权） |
| :--- | :--- | :--- |
| **No Remote Control** | `0x00000008` (8) | 强行剥夺一切远程控制行为（无法使用桌面、终端、文件等） |
| **No Desktop Access** | `0x00010000` (65536) | 全局禁止进入远程桌面 |
| **Remote View Only** | `0x00000100` (256) | 全局桌面锁定为仅观察模式，禁止键鼠控制输入 |
| **No Terminal Access** | `0x00000200` (512) | 全局禁止使用远程命令行终端 |
| **No File Access** | `0x00000400` (1024) | 全局禁止文件上传、下载与浏览 |
| **No Registry Access** | `0x00400000` (4194304) | 全局禁止修改或浏览 Windows 注册表 |
| **No Software** | `0x00800000` (8388608) | 全局禁止查看或变更安装软件列表 |
| **No Agent Console** | `0x00000010` (16) | 全局禁止访问 Agent 控制台 |
| **No Uninstall** | `0x00008000` (32768) | 全局禁止远程卸载客户端或删除节点 |
| **No Remote Command** | `0x00020000` (131072) | 全局禁止通过控制台批量执行远程 Shell 命令 |
| **No Wake** | `0x00000040` (64) | 全局禁止唤醒远程机器 |
| **No Reset/Off** | `0x00040000` (262144) | 全局禁止触发重启或关机 |

---

## 四、 常见业务场景配置实践

| 角色类型 | 推荐配置方案 | 包含的权限码组合 |
| :--- | :--- | :--- |
| **一线技术支持（Helpdesk）** | 允许桌面协助、文字沟通，禁止危险操作。 | `0x00000008` (Control) + `0x00004000` (Chat) + `0x00000080` (Notes)；不给 32768 卸载、262144 关机重启、131072 执行命令 |
| **合规审计员（Auditor）** | 允许实时查看监视屏幕，无任何干预能力。 | `0x00000008` (Control) + 限制位：`0x00000100` (View Only) + `0x00000200` (No Terminal) + `0x00000400` (No Files) |
| **外包运维人员（Vendor）** | 通过用户组统一纳管，并在其个人账号设置全局兜底约束。 | 组赋予特定设备组操作权限；用户账号附加 `removeRights`: `0x00000400` (禁止文件外发) 与 `0x00008000` (禁止卸载 Agent) |
| **部门分权管理（RBAC）** | 避免对个人逐一授权。 | 建立“运维部”、“质检组”等**用户组**，将设备组授权给用户组。人员流动仅需调整用户组人员归属。 |

---

## 五、项目中的权限封装

本项目将权限常量和通用判定集中在 `@meshcentral/control-client`：

```typescript
import {
   MeshRight,
   SiteRight,
   canUseDeviceFiles,
   canUseTerminal,
   getDesktopAccess,
   hasMeshRight,
   hasSiteRight,
} from '@meshcentral/control-client';

hasSiteRight(user.siteRights, SiteRight.ManageUsers);
hasMeshRight(groupRights, MeshRight.ManageComputers);

if (device.effectiveRights !== undefined) {
   getDesktopAccess(device.effectiveRights);
   canUseTerminal(device.effectiveRights);
   canUseDeviceFiles(device.effectiveRights);
}
```

封装边界如下：

- `SiteRight`、`MeshRight`：权限常量；
- `normalizeRights()`、`composeRights()`、`hasAllRights()`：无符号 32 位基础运算；
- `getDesktopAccess()`、`canUseTerminal()`、`canUseDeviceFiles()`：同时考虑能力位和限制位的业务判断；
- `Device.effectiveRights`：服务端下发并由客户端标准化后的当前用户设备有效权限；
- `ManagedUser.links`：权限管理界面的原始授权关系，不等同于最终有效权限。

客户端判断用于界面显示、按钮禁用和授权编辑，不能替代服务端鉴权。完整使用说明见 [`packages/control-client/docs/permissions.md`](../packages/control-client/docs/permissions.md)。
