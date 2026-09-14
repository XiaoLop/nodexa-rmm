# MeshCentral 权限获取与接口调用指南

MeshCentral 采用基于 **32 位整型位掩码（Bitmask）** 的权限体系。本文档说明如何通过 **WebSocket 控制接口（`/control.ashx`）** 和 **MeshCtrl 命令行工具** 获取用户的全局管理权限、设备组权限以及单设备权限。

---

## 目录

- [一、权限体系与层级关系](#一权限体系与层级关系)
- [二、接口认证方式](#二接口认证方式)
- [三、获取用户全局权限（Site Admin Rights）](#三获取用户全局权限site-admin-rights)
- [四、获取设备组权限（Device Group / Mesh Rights）](#四获取设备组权限device-group--mesh-rights)
- [五、获取单设备权限（Device / Node Rights）](#五获取单设备权限device--node-rights)
- [六、权限码位掩码（Bitmask）对照表](#六权限码位掩码bitmask对照表)
- [七、control-client 权限封装与调用](#七control-client-权限封装与调用)

---

## 一、权限体系与层级关系

MeshCentral 的权限分为两个维度、三种具体粒度：

```text
                    ┌──────────────────────────────────────────────┐
                    │ 1. 用户全局权限 (user.siteadmin)             │
                    │    控制平台管理、备份、全局用户管理等          │
                    └──────────────────────┬───────────────────────┘
                                           │ 若为 0xFFFFFFFF (超管)
                                           ▼ 可直通所有资源
                    ┌──────────────────────────────────────────────┐
                    │ 2. 设备组权限 (Mesh Rights, user.links)      │
                    │    控制设备组内所有机器的默认操作权限          │
                    └──────────────────────┬───────────────────────┘
                                           │ 按位或 (OR) 叠加
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │ 3. 单设备权限 (Node Rights, user.links)      │
                    │    控制对某一具体机器的特定操作权限            │
                    └──────────────────────────────────────────────┘
```

> **叠加规则**：用户对某台具体设备的最终有效权限 = `设备组权限` $\mid$ `单设备直接权限` $\mid$ `用户组继承权限`。

---

## 二、接口认证方式

MeshCentral 的管理交互统一使用 **WebSocket** 协议：

- **接口 URL**：`wss://<server-host>:<port>/control.ashx`
- **请求头认证（Basic Auth）**：

  ```http
  x-meshauth: <Base64(用户名)>,<Base64(密码)>[,<Base64(2FA_Token)>]
  ```

- **Token 认证（Cookie/Token）**：

  ```http
  wss://<server-host>:<port>/control.ashx?auth=<LoginTokenOrCookie>
  ```

---

## 三、获取用户全局权限（Site Admin Rights）

全局权限字段为 `siteadmin`，代表用户在整个 MeshCentral 服务端的管理职权。

### 1. 获取当前登录用户的权限

WebSocket 连接建立后，服务端会自动推送 `userInfo`，也可主动请求：

- **请求消息**：

  ```json
  {
    "action": "userinfo"
  }
  ```

- **响应消息**：

  ```json
  {
    "action": "userInfo",
    "userInfo": {
      "_id": "user//admin",
      "name": "admin",
      "email": "admin@example.com",
      "siteadmin": 4294967295,
      "domain": ""
    }
  }
  ```

### 2. 获取系统中所有用户的全局权限码（需管理员权限）

- **请求消息**：

  ```json
  {
    "action": "users",
    "responseid": "req_users_001"
  }
  ```

- **响应消息**：

  ```json
  {
    "action": "users",
    "responseid": "req_users_001",
    "users": [
      {
        "_id": "user//operator1",
        "name": "operator1",
        "email": "op1@example.com",
        "siteadmin": 2,
        "creation": 1700000000
      }
    ]
  }
  ```
  
## 四、获取设备组权限（Device Group / Mesh Rights）

设备组权限保存在设备组对象的 `links` 中，或者保存在用户对象的 `links` 中。

### 1. 获取所有设备组及各组内用户的权限

- **请求消息**：

  ```json
  {
    "action": "meshes",
    "responseid": "req_meshes_001"
  }
  ```

- **响应消息**：

  ```json
  {
    "action": "meshes",
    "responseid": "req_meshes_001",
    "meshes": [
      {
        "_id": "mesh//AbCdEf123456...",
        "name": "研发部设备组",
        "desc": "研发中心电脑",
        "mtype": 2,
        "links": {
          "user//admin": { "rights": 4294967295, "name": "admin" },
          "user//dev_user": { "rights": 56, "name": "dev_user" }
        }
      }
    ]
  }
  ```

### 2. 获取指定设备组下的用户及权限

- **MeshCtrl 命令行**：

  ```bash
  node meshctrl.js ListUsersOfDeviceGroup --id "AbCdEf123456..." --url wss://127.0.0.1 --loginuser admin --loginpass "password" --json
  ```

---

## 五、获取单设备权限（Device / Node Rights）

单设备权限通常出现在以下两种场景：

1. **直接赋予单设备的权限**：存储在 `user.links["node//..."]` 或设备自身的授权关系中。
2. **继承计算后的有效权限**：通过请求设备列表获取当前用户对每台设备的实际操作权。

### 1. 获取用户可见的设备列表及权限

- **请求消息**：

  ```json
  {
    "action": "nodes",
    "responseid": "req_nodes_001"
  }
  ```

- **响应消息**：

  ```json
  {
    "action": "nodes",
    "responseid": "req_nodes_001",
    "nodes": {
      "mesh//AbCdEf123456...": [
        {
          "_id": "node//xYz98765...",
          "meshid": "mesh//AbCdEf123456...",
          "name": "DEV-DESKTOP-01",
          "links": { "user//special_user": { "rights": 8 } }
        }
      ]
    }
  }
  ```

### 2. 获取单台设备详情与网络信息

- **请求消息**：

  ```json
  {
    "action": "getsysinfo",
    "nodeid": "node//xYz98765...",
    "nodeinfo": true,
    "responseid": "req_sysinfo_001"
  }
  ```

### 3. MeshCtrl 命令行调用（设备）

```bash
# 获取设备列表及基本信息
node meshctrl.js ListDevices --url wss://127.0.0.1 --loginuser admin --loginpass "password" --json

# 获取特定设备的详细信息
node meshctrl.js DeviceInfo --id "node//xYz98765..." --url wss://127.0.0.1 --loginuser admin --loginpass "password" --json
```

---

## 六、权限码位掩码（Bitmask）对照表

### 1. 全局用户权限码（`siteadmin`）

| 常量名称 | 十六进制（Hex） | 十进制 | 权限说明 |
| :--- | :--- | :--- | :--- |
| `SITERIGHT_ADMIN` | `0xFFFFFFFF` | `4294967295` | **全站超级管理员** |
| `SITERIGHT_SERVERBACKUP` | `0x00000001` | `1` | 允许备份服务器 |
| `SITERIGHT_MANAGEUSERS` | `0x00000002` | `2` | 允许管理用户账户 |
| `SITERIGHT_SERVERRESTORE` | `0x00000004` | `4` | 允许恢复服务器 |
| `SITERIGHT_FILEACCESS` | `0x00000008` | `8` | 允许服务器文件系统访问 |
| `SITERIGHT_SERVERUPDATE` | `0x00000010` | `16` | 允许更新服务器版本 |
| `SITERIGHT_LOCKED` | `0x00000020` | `32` | 账户被锁定 |
| `SITERIGHT_NONEWGROUPS` | `0x00000040` | `64` | 禁止创建新的设备组 |
| `SITERIGHT_NOMESHCMD` | `0x00000080` | `128` | 禁止使用 MeshCmd / 工具集 |
| `SITERIGHT_USERGROUPS` | `0x00000100` | `256` | 允许管理用户组 |
| `SITERIGHT_RECORDINGS` | `0x00000200` | `512` | 允许管理与查看会话录像 |
| `SITERIGHT_LOCKSETTINGS` | `0x00000400` | `1024` | 锁定个人设置修改 |
| `SITERIGHT_ALLEVENTS` | `0x00000800` | `2048` | 允许查看全局事件日志 |
| `SITERIGHT_NONEWDEVICES` | `0x00001000` | `4096` | 禁止添加新设备 |

### 2. 设备组 / 单设备权限码（`MESHRIGHT_*`）

设备组与单设备使用同一套权限位定义：

| 常量名称 | 十六进制（Hex） | 十进制 | 权限说明 |
| :--- | :--- | :--- | :--- |
| `MESHRIGHT_ADMIN` | `0xFFFFFFFF` | `4294967295` | **完全管理员权限** |
| `MESHRIGHT_EDITMESH` | `0x00000001` | `1` | 编辑设备组信息 |
| `MESHRIGHT_MANAGEUSERS` | `0x00000002` | `2` | 管理组内用户及其权限 |
| `MESHRIGHT_MANAGECOMPUTERS` | `0x00000004` | `4` | 管理设备（编辑/删除/移动） |
| `MESHRIGHT_REMOTECONTROL` | `0x00000008` | `8` | 远程桌面控制 |
| `MESHRIGHT_AGENTCONSOLE` | `0x00000010` | `16` | Mesh Agent 后台控制台，不是普通设备终端 |
| `MESHRIGHT_SERVERFILES` | `0x00000020` | `32` | MeshCentral 服务器端设备组文件空间，不是目标设备文件传输 |
| `MESHRIGHT_WAKEDEVICE` | `0x00000040` | `64` | 唤醒设备（Wake-on-LAN） |
| `MESHRIGHT_SETNOTES` | `0x00000080` | `128` | 修改设备备注 |
| `MESHRIGHT_REMOTEVIEWONLY` | `0x00000100` | `256` | 仅远程查看（只读桌面） |
| `MESHRIGHT_NOTERMINAL` | `0x00000200` | `512` | 禁用终端访问 |
| `MESHRIGHT_NOFILES` | `0x00000400` | `1024` | 禁用文件访问 |
| `MESHRIGHT_NOAMT` | `0x00000800` | `2048` | 禁用 Intel AMT |
| `MESHRIGHT_DESKLIMITEDINPUT` | `0x00001000` | `4096` | 限制桌面输入 |
| `MESHRIGHT_LIMITEVENTS` | `0x00002000` | `8192` | 限制事件日志查看 |
| `MESHRIGHT_CHATNOTIFY` | `0x00004000` | `16384` | 发送桌面通知与文本消息 |
| `MESHRIGHT_UNINSTALL` | `0x00008000` | `32768` | 卸载 Agent 代理 |
| `MESHRIGHT_NODESKTOP` | `0x00010000` | `65536` | 禁用远程桌面 |
| `MESHRIGHT_REMOTECOMMAND` | `0x00020000` | `131072` | 后台执行单次命令 |
| `MESHRIGHT_RESETOFF` | `0x00040000` | `262144` | 设备重启与关机操作 |
| `MESHRIGHT_GUESTSHARING` | `0x00080000` | `524288` | 创建临时访客分享链接 |
| `MESHRIGHT_DEVICEDETAILS` | `0x00100000` | `1048576` | 查看硬件与系统详情 |
| `MESHRIGHT_RELAY` | `0x00200000` | `2097152` | Web Relay 端口中继映射 |
| `MESHRIGHT_NOREGISTRY` | `0x00400000` | `4194304` | 禁用注册表编辑器 |
| `MESHRIGHT_NOSOFTWARE` | `0x00800000` | `8388608` | 禁用已安装软件管理 |

---

## 七、control-client 权限封装与调用

项目已在 `@meshcentral/control-client` 中封装权限常量、无符号 32 位处理和常用设备能力判断：

```typescript
import {
  MeshRight,
  SiteRight,
  canUseDeviceFiles,
  canUseTerminal,
  composeMeshRights,
  getDesktopAccess,
  hasMeshRight,
  hasSiteRight,
  normalizeRights,
} from '@meshcentral/control-client';

const groupRights = composeMeshRights([
  MeshRight.RemoteControl,
  MeshRight.WakeDevice,
  MeshRight.DeviceDetails,
]);

hasMeshRight(groupRights, MeshRight.WakeDevice); // true
hasSiteRight(currentUser.siteadmin ?? 0, SiteRight.ManageUsers);
normalizeRights(-1); // 4294967295

const devices = await client.devices.list();
const rights = devices[0]?.effectiveRights;

if (rights !== undefined) {
  getDesktopAccess(rights); // denied | view-only | limited-input | control
  canUseTerminal(rights);
  canUseDeviceFiles(rights);
}
```

### 能力位与限制位

- 普通设备终端要求 `MESHRIGHT_REMOTECONTROL`，并且不能包含 `MESHRIGHT_NOTERMINAL`。
- 目标设备文件浏览和传输要求 `MESHRIGHT_REMOTECONTROL`，并且不能包含 `MESHRIGHT_NOFILES`。
- `MESHRIGHT_AGENTCONSOLE` 只控制 Mesh Agent 后台控制台。
- `MESHRIGHT_SERVERFILES` 只控制 MeshCentral 服务器端设备组文件空间。
- 桌面访问还需要处理 `NODESKTOP`、`REMOTEVIEWONLY` 和 `DESKLIMITEDINPUT` 的优先级。

### 不在客户端重算完整有效权限

客户端不应通过 `user.links` 自行实现完整的 `GetMeshRights()` 或 `GetNodeRights()`。服务端计算还涉及用户组授权、单设备授权、域范围、`managealldevicegroups`、可见性以及 `user.removeRights`。

尤其不能使用以下简化逻辑：

```typescript
effectiveRights &= ~user.removeRights;
```

MeshCentral 的 `removeRights` 会清除部分正向能力位，同时注入 `NoDesktop`、`NoTerminal`、`NoFiles` 等限制位；对管理员权限还会先展开明确能力。因此界面应优先使用设备列表标准化后的 `Device.effectiveRights`，所有实际操作仍由服务端执行最终鉴权。

完整 API 说明见 [`packages/control-client/docs/permissions.md`](../packages/control-client/docs/permissions.md)。
