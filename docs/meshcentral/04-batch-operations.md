# 批量发送文件、命令、消息和电源操作

批量操作分两类：

- 控制通道批量：命令、消息、Toast、电源操作，可以一次传多个 `nodeid` 或循环发送。
- 中继通道批量：上传、下载、交互式终端，需要为每台设备建立独立 `meshrelay.ashx` 隧道。

## 批量执行命令

控制通道 action：`runcommands`。

单台设备：

```json
{
  "action": "runcommands",
  "nodeids": ["node//yyyyyyyy"],
  "type": 0,
  "cmds": "whoami",
  "runAsUser": 0,
  "reply": true,
  "responseid": "req-run-001"
}
```

多台设备：

```json
{
  "action": "runcommands",
  "nodeids": ["node//a", "node//b", "node//c"],
  "type": 0,
  "cmds": "hostname",
  "runAsUser": 0,
  "reply": true,
  "responseid": "req-run-batch"
}
```

字段说明：

- `nodeids`：设备 ID 数组。
- `type`：`0` 表示普通 Shell，`2` 表示 PowerShell。
- `cmds`：命令文本。
- `runAsUser`：`0` 默认，`1` 以当前登录用户执行，`2` 仅当前登录用户。
- `reply`：为 `true` 时要求返回执行结果。

响应可能是普通结果，也可能通过 `msg type=runcommands` 返回。封装时需要按 `responseid` 和 `nodeid` 聚合结果。

RMM 插件使用 Windows PowerShell 包装器发送结构化结果。MeshCentral 1.1.54 的原生 Agent 最终消息只有合并输出和关联标识，插件据已认证的 Agent 设备身份和执行 ID 匹配记录，并用包装器提供的退出码判定成功或失败。真实设备验证见 [RMM-005 部署与验收](../../test/rmm-005.md)。

## 批量发送 Toast

```json
{
  "action": "toast",
  "nodeids": ["node//a", "node//b"],
  "title": "通知",
  "msg": "维护即将开始",
  "responseid": "req-toast-batch"
}
```

## 批量发送消息框

MeshCtrl 的组消息实现是先获取分组下的设备，再逐台发送：

```json
{
  "action": "nodes",
  "meshid": "mesh//xxxxxxxx",
  "responseid": "req-group-nodes"
}
```

然后对每个设备发送：

```json
{
  "action": "msg",
  "type": "messagebox",
  "nodeid": "node//yyyyyyyy",
  "title": "MeshCentral",
  "msg": "维护通知",
  "timeout": 120000
}
```

## 批量电源操作

唤醒设备：

```json
{
  "action": "wakedevices",
  "nodeids": ["node//a", "node//b"]
}
```

关机、重启、睡眠通常使用 `poweraction`：

```json
{
  "action": "poweraction",
  "nodeids": ["node//a", "node//b"],
  "actiontype": 2
}
```

当前网关使用以下 `actiontype` 数值：

- `wake`：使用 `wakedevices`。
- `poweroff`：`2`，关机。
- `reset`：`3`，重启。
- `sleep`：`4`，睡眠。

已验证的确认响应格式如下。响应不一定包含 `responseid` 或设备 ID，只表示网关已接收请求：

```json
{ "action": "poweraction" }
```

## 批量上传文件

MeshCentral 文件上传基于 `meshrelay.ashx?p=5`，每台设备都要独立建立文件隧道。因此批量上传不是单个控制消息，而是调度多个上传任务。

推荐流程：

1. 通过 `nodes` 获取目标设备。
2. 过滤在线设备：`(node.conn & 1) != 0`。
3. 每台设备创建文件隧道。
4. 发送 `upload` 请求并按 `uploadack` 流式写入。
5. 控制并发，例如一次 3 到 10 台。
6. 记录每台设备成功、失败、超时、取消状态。

伪代码：

```js
async function batchUpload(client, nodeids, localFile, remotePath, options = {}) {
  const concurrency = options.concurrency ?? 5;
  return runWithConcurrency(nodeids, concurrency, async (nodeid) => {
    const tunnel = await client.files.open(nodeid);
    try {
      await tunnel.upload({ localFile, remotePath });
      return { nodeid, ok: true };
    } catch (error) {
      return { nodeid, ok: false, error: error.message };
    } finally {
      tunnel.close();
    }
  });
}
```

## 批量下载文件

批量下载也需要每台设备独立文件隧道。建议为每台设备生成单独目标路径，避免文件覆盖：

```text
downloads/<safe-node-name>/demo.txt
```

## 批量操作错误处理

SDK 返回结果建议统一为：

```json
{
  "total": 3,
  "success": 2,
  "failed": 1,
  "results": [
    { "nodeid": "node//a", "ok": true },
    { "nodeid": "node//b", "ok": false, "error": "Device offline" },
    { "nodeid": "node//c", "ok": true }
  ]
}
```

## 离线设备处理

控制通道命令对离线设备通常无法实时执行。批量任务应先检查 `conn` 状态，并提供策略：

- `skipOffline`：跳过离线设备。
- `failOffline`：离线立即失败。
- `queueOffline`：写入业务队列，等设备在线事件后再执行。

MeshCentral 自身的控制通道事件可以用于唤醒离线队列，见 [05-events.md](05-events.md)。
