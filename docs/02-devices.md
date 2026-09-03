# 设备分组、设备列表、设备详情

设备相关接口都走 `control.ashx` 控制通道，发送 JSON 消息并用 `responseid` 关联响应。

## 获取设备分组

请求：

```json
{
  "action": "meshes",
  "responseid": "req-groups"
}
```

响应：

```json
{
  "action": "meshes",
  "responseid": "req-groups",
  "meshes": [
    {
      "_id": "mesh//xxxxxxxx",
      "name": "My Computers",
      "mtype": 2,
      "desc": "group description",
      "links": {}
    }
  ]
}
```

常见字段说明：

- `_id`：设备分组 ID，通常是 `mesh/<domain>/<id>` 或 `mesh//<id>`。
- `type`：资源类型标识，固定为 `"mesh"`。
- `name`：分组名称。
- `mtype`：分组类型，`1` 表示 Intel AMT only，`2` 表示 Mesh Agent 设备组，`3` 表示 agentless/local。
- `desc`：分组描述信息。
- `domain`：所属域/租户标识符。
- `links`：用户或用户组关联关系与权限掩码对象（映射结构，包含 `name` 和 `rights`）。
- `creation`：分组创建时间戳。
- `creatorid`：创建者的用户 ID。
- `creatorname`：创建者的显示名称。

## 获取设备列表

获取全部设备：

```json
{
  "action": "nodes",
  "responseid": "req-nodes"
}
```

按分组 ID 过滤：

```json
{
  "action": "nodes",
  "meshid": "mesh//xxxxxxxx",
  "responseid": "req-nodes-by-group"
}
```

按分组名称过滤：

```json
{
  "action": "nodes",
  "meshname": "My Computers",
  "responseid": "req-nodes-by-name"
}
```

响应结构通常按分组归类：

```json
{
  "action": "nodes",
  "responseid": "req-nodes",
  "nodes": {
    "mesh//xxxxxxxx": [
      {
        "_id": "node//yyyyyyyy",
        "meshid": "mesh//xxxxxxxx",
        "name": "PC-01",
        "rname": "PC-01",
        "host": "pc-01.local",
        "ip": "192.168.1.20",
        "conn": 1,
        "agent": { "id": 4, "ver": 1234 },
        "osdesc": "Windows 11"
      }
    ]
  }
}
```

常见字段说明（对应 `Device` 结构）：

- `_id`：设备 ID（Node ID），后续远控、命令、文件操作等均使用它。
- `type`：节点类型标识，固定为 `"node"`。
- `mtype`：设备接入类型，`1` 为 Intel AMT，`2` 为 Mesh Agent，`3` 为 Agentless。
- `icon`：设备图标类型编号，用于 UI 渲染操作系统/设备图标。
- `name`：MeshCentral 中显示的设备名称/别名。
- `rname`：设备首次注册时上报的真实/原始主机名（Real Name）。
- `domain`：所属域/租户标识符。
- `host`：设备主机名或域名（FQDN）。
- `ip`：设备 IP 地址。
- `osdesc`：操作系统详细描述（如 `"Windows 11"`、`"Ubuntu 22.04 LTS"`）。
- `firstconnect`：首次连接时间戳。
- `lastbootuptime`：系统上一次开机/启动的时间戳。
- `conn`：连接状态掩码。通常 `(conn & 1) !== 0` 表示 Agent 当前在线。
- `pwr`：电源状态代码。
- `agct`：Agent 连接建立的时间戳。
- `users`：拥有该设备管理权限的用户 ID 数组。
- `lusers`：当前设备上已登录的本地操作系统用户列表。
- `av`：已安装的防病毒软件列表。
- `defender`：Windows Defender 状态与配置数据。
- `agent`：Agent 客户端详细配置对象：
  - `ver`：Agent 版本号。
  - `id`：Agent 平台/架构 ID（如 `1`: Win32, `2`: Win64, `3`: Linux, `4`: macOS 等）。
  - `caps`：Agent 能力特性掩码（Capabilities）。
  - `core`：正在运行的 Agent 核心组件标识。
  - `root`：Agent 是否以 Root/管理员权限运行。
- `wsc`：Windows 安全中心（Windows Security Center）状态对象：
  - `antiVirus`：杀毒软件开启状态。
  - `autoUpdate`：自动更新功能状态。
  - `firewall`：防火墙启用状态。

## 获取设备详情

`meshctrl DeviceInfo` 实际会并行发送 4 个请求：

```json
{ "action": "nodes" }
```

```json
{
  "action": "getnetworkinfo",
  "nodeid": "node//yyyyyyyy",
  "responseid": "req-network"
}
```

```json
{
  "action": "lastconnect",
  "nodeid": "node//yyyyyyyy",
  "responseid": "req-lastconnect"
}
```

```json
{
  "action": "getsysinfo",
  "nodeid": "node//yyyyyyyy",
  "nodeinfo": true,
  "responseid": "req-sysinfo"
}
```

封装建议：

```js
async function getDeviceDetails(client, nodeid) {
  const [nodes, network, lastconnect, sysinfo] = await Promise.all([
    client.send({ action: 'nodes' }),
    client.send({ action: 'getnetworkinfo', nodeid }),
    client.send({ action: 'lastconnect', nodeid }),
    client.send({ action: 'getsysinfo', nodeid, nodeinfo: true })
  ]);

  return { nodes, network, lastconnect, sysinfo };
}
```

## 获取 Agent 安装包与安装脚本

Agent 下载走 HTTPS 的 `meshagents` 路由，不经过 `control.ashx` WebSocket 控制通道。请求地址需要保留域路径；默认域可省略，非默认域通常为：

```text
https://<server>/<domain>/meshagents?<参数列表>
```

其中 `meshid` 使用设备组的完整 `_id`（例如 `mesh//xxxxxxxx`），并应在构造 URL 时进行 URL 编码。不要把设备组 ID 当作普通可公开分发的密钥；是否允许匿名下载取决于 MeshCentral 的版本、域配置和服务器安全策略。

### 下载预配置 Agent

下载的 Agent 会内嵌目标设备组配置，首次运行后会注册到该设备组：

```text
https://mesh.example.com/meshagents?id=<agenttype>&meshid=<encoded-meshid>&installflags=<flags>
```

示例（`id=6` 的 Windows x64 Agent）：

```bash
curl -fL -o MeshAgent.exe "https://mesh.example.com/meshagents?id=6&meshid=mesh%2F%2Fxxxxxxxx&installflags=0"
```

常用参数：

- `id`：目标 Agent 平台/架构编号。编号随 MeshCentral 版本变化，应以目标服务器 Agent 下载页或实际响应为准；不要在 SDK 中硬编码完整编号表。
- `meshid`：目标设备组 ID。
- `installflags`：安装模式标志。常见值为 `0`；具体位含义和可用取值应以服务器版本为准。
- `tag`：可选，给自动注册的设备附加标签；应进行 URL 编码。

### 获取平台安装脚本

支持该能力的服务器可通过 `script` 返回预配置的一键安装脚本：

```bash
# Linux、macOS 或 BSD Shell 脚本
curl -fL "https://mesh.example.com/meshagents?script=1&meshid=mesh%2F%2Fxxxxxxxx"

# Windows PowerShell 脚本
curl -fL "https://mesh.example.com/meshagents?script=2&meshid=mesh%2F%2Fxxxxxxxx"
```

脚本参数和可用的 Agent 架构由服务端版本决定。自动化执行前应先获取并审查脚本内容，并使用受信任的 HTTPS 服务器地址。

### 按操作系统安装

以下命令中的 `<agent-script-url>` 应替换为控制台或 `meshagents` 为目标设备组生成的脚本地址。例如：

```text
https://mesh.example.com/meshagents?script=1&meshid=mesh%2F%2Fxxxxxxxx
```

不要在文档、镜像或源代码中固化可用于注册设备的下载 URL；应由受控的服务端配置或部署系统在运行时提供。

#### Windows

- **单机安装**：从控制台下载与架构相符的预配置 EXE，使用管理员权限启动后选择安装为服务；临时协助时可选择仅连接模式，进程退出后连接会断开。
- **脚本化安装**：以管理员身份执行控制台生成的 PowerShell 脚本。可先下载到文件、完成审查后再执行：

```powershell
Invoke-WebRequest -UseBasicParsing '<agent-script-url-for-windows>' -OutFile .\install-meshagent.ps1
& .\install-meshagent.ps1
```

- **批量部署**：如果目标服务器/控制台提供预配置 MSI，可使用 GPO、Intune 等软件分发工具部署；静默安装通常使用：

```cmd
msiexec /i MeshAgent.msi /qn /norestart
```

安装、卸载和服务管理均需要管理员权限。服务显示名、程序目录与卸载参数会因 Agent 版本及安装方式而不同，应以下载包内说明和实际服务管理器为准。

#### Linux

使用 `root` 或具备 `sudo` 权限的账户。建议先下载、审查后运行脚本：

```bash
curl -fL '<agent-script-url>' -o /tmp/install-meshagent.sh
sudo sh /tmp/install-meshagent.sh
```

无 `curl` 的系统可改用：

```bash
wget -qO /tmp/install-meshagent.sh '<agent-script-url>'
sudo sh /tmp/install-meshagent.sh
```

脚本通常会选择适合的 CPU 架构并注册系统服务。对于离线、受限网络或自定义目录部署，下载与架构匹配的预配置二进制及其配置文件后，使用该二进制支持的安装参数注册服务；不要只下载裸二进制而遗漏设备组配置。服务单元名称、路径和启动方式取决于发行版、init 系统与 Agent 版本，可通过 `systemctl list-units --type=service | grep -i mesh` 或实际安装输出确认。

#### macOS

使用 macOS 终端以管理员权限运行经审查的 Shell 脚本：

```bash
curl -fL '<agent-script-url>' -o /tmp/install-meshagent.sh
sudo sh /tmp/install-meshagent.sh
```

安装后，在“系统设置 → 隐私与安全性”中为 Agent 授权：

- **辅助功能**：允许远程键盘与鼠标控制。
- **屏幕录制**：允许远程查看屏幕。
- **完全磁盘访问权限**：按需授予，以支持更广泛的文件管理。

在较新的 macOS 上，用户批准的 MDM、隐私偏好策略或本地交互可能是完成这些权限授予的必要条件；仅安装 Agent 并不能绕过系统权限模型。Apple Silicon 与 Intel 的可用二进制由目标服务器版本决定。

#### FreeBSD 和其他 BSD

优先使用控制台为目标平台提供的安装包或脚本。若服务器返回兼容的 Shell 脚本，可先下载并检查后以 `root` 运行：

```sh
fetch -o /tmp/install-meshagent.sh '<agent-script-url>'
sh /tmp/install-meshagent.sh
```

不同 BSD 发行版的服务注册目录、服务管理命令和受支持架构不同，应以脚本输出及服务器版本支持矩阵为准。

#### 容器环境

将 Agent 放入容器会使该容器成为独立受管节点，但不应把长期有效的设备组注册链接烘焙进镜像层。应在运行时通过 Docker Secret、受限环境变量或短期邀请链接注入配置，并使用专用的设备组和最小权限。容器应以其主进程前台方式运行 Agent；不要假定传统服务管理器（如 `systemd`）在容器中可用。

#### Android

Android 设备接入能力、可用应用来源及所需权限由 MeshCentral 服务器版本、所使用的 Android 客户端和设备管理策略决定。若控制台提供 Android 安装或配对流程，请使用该流程，并仅授予远程支持所需的权限（例如无障碍、屏幕捕获或电池优化豁免）。不要假设所有 MeshCentral 部署都提供可由 `meshagents` 下载、可作为后台 Agent 运行的 Android APK。

### 生成限时邀请链接

需要限制分发范围时，通过控制通道生成邀请链接，而不是自行拼接公开下载地址。本项目的客户端封装使用 `createInviteLink`：

```json
{
  "action": "createInviteLink",
  "meshid": "mesh//xxxxxxxx",
  "expire": 24,
  "flags": 0,
  "responseid": "req-invite-link"
}
```

- `expire`：有效期，单位为小时；`0` 表示不过期。
- `flags`：安装方式限制。当前封装约定 `0` 为不限制、`1` 为仅交互式、`2` 为仅后台安装。
- 响应中的链接字段会因服务端版本而异，常见为 `url`、`link` 或 `inviteLink`；客户端应兼容读取这些字段。
- `maxuse`、PIN 和邀请代码字段并非本项目控制客户端当前封装的稳定接口；如目标 MeshCentral 版本提供这些扩展，应以其实际响应与权限模型为准。

TypeScript 调用示例：

```ts
const { url } = await client.devices.createInviteLink({
  groupId: 'mesh//xxxxxxxx',
  expireHours: 24,
  flags: 0,
});

if (!url) throw new Error('服务器未返回邀请链接');
```

## 设备搜索与过滤

MeshCtrl 的 `ListDevices --filter` 是客户端过滤逻辑，不是独立服务端搜索接口。常见过滤条件：

- 普通文本：匹配设备名。
- `user:x` 或 `u:x`：当前登录用户名包含 `x`。
- `ip:x`：IP 地址包含 `x`。
- `group:x` 或 `g:x`：设备组名包含 `x`。
- `tag:x` 或 `t:x`：设备标签包含 `x`。
- `atag:x` 或 `a:x`：Agent 标签包含 `x`。
- `os:x`：系统描述包含 `x`。
- `desc:x`：描述包含 `x`。
- `a and b`、`a or b`：客户端组合过滤。

SDK 中建议先获取 `meshes` 和 `nodes`，再在本地实现过滤，以保持和 MeshCtrl 行为一致。

## 创建设备分组

```json
{
  "action": "createmesh",
  "meshname": "New Group",
  "meshtype": 2,
  "desc": "optional description",
  "responseid": "req-create-group"
}
```

## 编辑设备分组

```json
{
  "action": "editmesh",
  "meshid": "mesh//xxxxxxxx",
  "meshname": "Renamed Group",
  "desc": "new description",
  "responseid": "req-edit-group"
}
```

## 删除设备分组

```json
{
  "action": "deletemesh",
  "meshid": "mesh//xxxxxxxx",
  "responseid": "req-delete-group"
}
```

## 编辑设备

```json
{
  "action": "changedevice",
  "nodeid": "node//yyyyyyyy",
  "name": "New Device Name",
  "desc": "device description",
  "tags": ["tag1", "tag2"],
  "responseid": "req-edit-node"
}
```

## 删除设备

```json
{
  "action": "removedevices",
  "nodeids": ["node//yyyyyyyy"],
  "responseid": "req-remove-node"
}
```
