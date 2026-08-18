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
