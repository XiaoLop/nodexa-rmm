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

常见字段：

- `_id`：设备分组 ID，通常是 `mesh/<domain>/<id>` 或 `mesh//<id>`。
- `name`：分组名称。
- `mtype`：分组类型，`2` 通常是 Mesh Agent 设备组，`1` 是 AMT only，`3` 是 agentless/local。
- `links`：用户或用户组权限关系。

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

常见字段：

- `_id`：设备 ID，后续远控、命令、文件操作都使用它。
- `meshid`：所属分组 ID。
- `name`：MeshCentral 中显示的设备名。
- `rname`：设备真实主机名。
- `conn`：连接状态位。通常 `(conn & 1) != 0` 表示 Agent 在线。
- `agent.id`：Agent 类型。
- `agent.ver`：Agent 版本。
- `osdesc`：操作系统描述。

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
