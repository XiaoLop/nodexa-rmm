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

### RMM 设备占用扩展

以下为本仓库插件协议，不是上游原生接口。控制帧沿用 `action: plugin`、`plugin: rmm`、`subAction`、`requestId`，响应回显关联字段并返回 `data` 或 `error`。

- `getTask` 的逐设备结果新增可选字段：`executionId`（本条执行）、`occupiedBy`（当前占用执行）、`waitingReason`（`DEVICE_BUSY` 或 `REMOTE_STATE_UNKNOWN`）、`canRelease`（当前用户能否解除）。新 Web 可兼容未返回这些字段的旧插件；解除功能须同步部署新插件。
- `releaseDevice` 请求携带 `nodeId`、`executionId`、`reason`。仅站点管理员且当前仍有该域设备远程命令权限可调用；原因须为非空字符串，最多 1,000 字符。返回 `data: {}`。
- 预期执行与当前占用不符返回 `OCCUPANCY_CONFLICT`；运行中返回 `EXECUTION_RUNNING`；权限或输入不合规则返回 `ACCESS_DENIED` / `INVALID_INPUT`。占用已消失时重复解除不产生第二条审计。解除不终止进程、不重试脚本。
- 占用在 SQLite 独立保存，未解除占用计入全局五个名额。超时、发送不确定、重启、Agent 重连均不会释放。可信迟到回执只释放对应占用，不覆盖已保存的终态。任务清理不级联删除占用。

实现依据：`packages/meshcentral-plugins/src/plugins/rmm/` 与 `packages/control-client/src/resources/rmm.ts`；本地模拟覆盖不等同于真实 Agent 验收。

### RMM 历史搜索与版本扩展

以下均为本仓库插件接口，Web 和插件须同版部署。`searchTasks` 接受可选 `query`（最多 200 字符，匹配任务名称、发起人或 ID）和 `status`（设备结果状态），以及 `before` 行游标；每页最多检查 25 条候选任务。状态仅根据当前用户有权查看的设备结果判断，因此可出现空页但仍有下一页；不得根据隐藏设备状态推断结果。任务按原保留策略清理，搜索不覆盖已删除记录。大小写匹配遵循 SQLite `lower`，对非 ASCII 不保证大小写折叠。原 `listTasks` 接口保持可用。

`listScriptVersions` 按版本倒序返回版本号、保存者和时间（内置脚本只有版本号），可用 `before` 版本号翻页，每页最多 25 条。`getScriptVersion` 返回指定版本元数据；正文仍仅站点管理员可获取，归档脚本仅管理员可查询。跨域或不可见脚本不可查询。Web 对比两个版本的元数据和可见正文，不提供执行旧版本入口。

脚本草稿的 `tags` 为版本化字符串数组，最多 10 个，每个输入不超过 30 字符，去除首尾空格后非空且忽略大小写不得重复；旧版本缺省为空。保存标签创建新版本，不改变历史任务。旧插件不识别标签且会丢弃它们，回退前应备份数据库并停止编辑脚本；新 Web 遇到旧插件不支持历史接口会显示错误。

### RMM Linux 执行扩展

脚本草稿及版本支持可选 `platform: 'windows' | 'linux'`，缺省按 Windows 解释。脚本列表返回版本平台，任务查询返回实际保存版本的平台；无需改写既有数据库版本数据。Linux 只匹配固定上游版本中已核实的 Linux Agent 架构，不将 Android、macOS 或 BSD 视为 Linux。

插件对 Linux Agent 下发原生 `runcommands type: 3`，以 Agent 服务身份启动 `/bin/sh`；Windows 仍为 `type: 2`。依据为已安装的 MeshCentral 1.1.54 `agents/meshcore.js` 的 `runcommands` 分支，以及 `meshcentral.js` 的 `meshAgentsArchitectureNumbers`。Agent 忙时只发普通控制台消息，不产生结构化完成回执，因此两平台都必须保留占用直到可信结束或管理员解除。

Linux 包装器在权限受限的临时目录保存正文，参数通过 Base64 解码成 `RMM_PARAM_<原参数名>` 环境变量，不拼接为可执行表达式。字符串保留末尾换行，布尔值为 `true` / `false`，整数为十进制，NUL 字节被拒绝；源文件的 CRLF 规范化为 LF。脚本无交互输入。所需 Linux 工具及验收例子见 [部署与验收](../../test/rmm-005.md#linux-验收本轮新增)。

标准输出与错误输出合并，经有界捕获后继续排空超限输出，防止管道提前关闭改变脚本退出结果。仍使用同一结构化回执与 32 KiB 截断、五分钟超时、独立占用规则；脚本退出不等于其自行启动的后台进程也已退出。

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
