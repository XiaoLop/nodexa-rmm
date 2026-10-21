# 资源 API 与消息清单

资源 API 是调用控制通道的首选入口。除特别说明外，资源方法会通过 `request()` 自动添加 `responseid`，等待匹配响应，并把超时、断线和服务端 `error/err` 转换为公开错误类型。

## 返回值约定

- `Device[]`、`DeviceGroup[]`、`ManagedUser[]`、`MeshCentralEvent[]` 等是客户端标准化结构。
- `Promise<unknown>` 表示操作已收到一个匹配响应，但服务端字段尚未形成稳定公开契约。
- 带 `raw` 的结果同时提供便于消费的字段和原始响应。
- `submitted` 表示请求已提交，不保证设备已经执行完成。
- `request<T>()` 的 `T` 只在编译期生效，不会验证运行时数据。

## 设备 `client.devices`

| 方法                                  | 发送的 action/关键字段                                          | 返回                     | 可以用来做什么                      |
| ------------------------------------- | --------------------------------------------------------------- | ------------------------ | ----------------------------------- |
| `list()`                              | `nodes`                                                         | `Device[]`               | 加载全部可见设备                    |
| `listByGroup(groupId)`                | `nodes`, `meshid`                                               | `Device[]`               | 加载指定设备组成员                  |
| `systemInfo(id)`                      | `getsysinfo`, `nodeid`, `nodeinfo: true`                        | 泛型原始响应             | 查看操作系统、硬件和 Agent 系统信息 |
| `networkInfo(id)`                     | `getnetworkinfo`, `nodeid`                                      | 泛型原始响应             | 查看网卡、地址等网络信息            |
| `lastConnect(id)`                     | `lastconnect`, `nodeid`                                         | 泛型原始响应             | 查看单个设备最后连接信息            |
| `lastConnects()`                      | `lastconnects`                                                  | `Record<string, string>` | 批量补充设备最后在线时间            |
| `details(id)`                         | 并行发送 `nodes`、`getnetworkinfo`、`lastconnect`、`getsysinfo` | `DeviceDetails`          | 一次组装设备详情页所需数据          |
| `update(id, patch)`                   | `changedevice`                                                  | 原始确认响应             | 修改名称、描述、设备组或标签        |
| `remove(id)`                          | `removedevices`, `nodeids`                                      | 原始确认响应             | 删除设备                            |
| `setUserRights(id, username, rights)` | `adddeviceuser`, `nodeid`, `usernames`, `rights`                | 原始确认响应             | 设置用户对单台设备的直接权限        |
| `removeUser(id, username)`            | `adddeviceuser`, `rights: 0`, `remove: true`                    | 原始确认响应             | 移除用户对单台设备的直接权限        |
| `powerAction(id, action)`             | `wakenode` 或单元素 `poweraction.nodeids`                       | 原始确认响应             | 唤醒、重启、关机或休眠              |
| `updateManyGroup(ids, groupId)`       | 每台设备发送 `changedevice`，并发上限 4                         | `BatchOperationResult`   | 批量迁移设备并得到逐设备提交结果    |
| `powerMany(ids, 'wake')`              | 单次 `wakedevices`, `nodeids`                                   | `BatchOperationResult`   | 批量唤醒设备                        |
| `powerMany(ids, other)`               | 单次 `poweraction`，包含 `nodeids` 和 `actiontype`              | `BatchOperationResult`   | 批量重启、关机或休眠                |
| `inviteByEmail(options)`              | `inviteAgent`                                                   | `{ raw }`                | 通过邮件邀请安装 Agent              |
| `createInviteLink(options)`           | `createInviteLink`                                              | `{ url?, raw }`          | 生成 Agent 安装邀请链接             |
| `normalize(value)`                    | 不发送消息                                                      | `Device \| undefined`    | 复用包内设备标准化逻辑              |

`details()` 使用并行 fail-fast 策略，任一请求失败时整个调用失败。`raw` 保留四项原始响应。

单设备直接授权只接受远程控制、Agent 控制台、服务器文件、唤醒、设置备注、聊天通知和卸载 Agent 权限，全部单设备权限的组合值为 `49400`。不要向 `adddeviceuser` 发送设备组管理权限、限制位或 `0xffffffff`，服务端会返回 `result: "Invalid rights"`。

电源 action 支持 `wake`、`reset`、`poweroff` 和 `sleep`。`poweraction.actiontype` 映射为：关机 `2`、重启 `3`、睡眠 `4`。电源请求得到响应只表示网关处理了请求；设备是否真正完成操作应结合后续事件或状态刷新判断。`poweraction` 确认响应可能只有 `{ "action": "poweraction" }`，不包含 `responseid` 或设备 ID，因此同类请求必须顺序匹配。

```ts
const result = await client.devices.powerMany(
  [
    { id: 'node//a', name: 'API-01' },
    { id: 'node//b', name: 'API-02' },
  ],
  'reset',
);

for (const item of result.results) {
  console.log(item.deviceName, item.status, item.message);
}
```

## 命令 `client.commands`

### `run(deviceIds, command, options)`

发送 `runcommands`，关键字段包括：

- `nodeids`：去重后的目标设备 ID。
- `cmds`：命令文本。
- `type`：shell 为 `0`，PowerShell 为 `2`。
- `runAsUser`：`0 | 1 | 2`，默认 `0`。
- `reply`：是否要求回复，默认 `true`。
- `responseid`：自动生成的 `command-*` ID。

返回 `CommandSubmission { requestId, raw }`。它适合只关心提交响应的场景，不代表每台设备都执行成功。

### `execute(deviceIds, command, options)`

同样发送 `runcommands`，但通过 `message` 通道持续归一化每台设备的输出和完成消息，返回 `CommandExecutionHandle`：

- `requestId`：本次命令的关联 ID。
- `getSnapshot()`：读取当前批次和逐设备状态。
- `subscribe(listener)`：订阅快照，注册后会立即收到一次当前值。
- `completed`：所有目标进入终态或跟踪结束时完成。
- `stopTracking()`：停止本地跟踪，未完成设备标记为 `unknown`。
- `cancelRemote()`：当前协议不支持，会拒绝并抛出 `MeshCentralValidationError`。

```ts
const execution = client.commands.execute(['node//a'], 'Get-Service', {
  shell: 'powershell',
  timeoutMs: 90_000,
});

const unsubscribe = execution.subscribe(({ results }) => {
  for (const result of results) {
    const output = result.output.map((chunk) => chunk.content).join('');
    console.log(result.deviceId, result.status, output);
  }
});

const completed = await execution.completed;
unsubscribe();
```

逐设备状态包括 `submitting`、`running`、`succeeded`、`failed`、`cancelled`、`timedOut` 和 `unknown`。同一个客户端不能同时对同一设备启动两个被跟踪的命令。每台设备最多保留 10,000 个输出块或约 1 MiB 文本，超出后较早输出会被截断。

## 设备组 `client.groups`

| 方法                                                | 发送的 action             | 返回/确认方式                 | 用途                             |
| --------------------------------------------------- | ------------------------- | ----------------------------- | -------------------------------- |
| `list()`                                            | `meshes`                  | `DeviceGroup[]`               | 加载设备组                       |
| `create(name, options)`                             | `createmesh`              | 原始响应                      | 创建设备组，默认 `meshtype: 2`   |
| `update(groupId, patch)`                            | `editmesh`                | 原始响应                      | 修改组名或描述                   |
| `remove(groupId)`                                   | `deletemesh`              | 原始响应                      | 删除设备组                       |
| `setUserRights(groupId, groupName, userId, rights)` | 单向发送 `addmeshuser`    | 等待对应 `accountchange` 事件 | 设置用户对设备组的 32 位权限掩码 |
| `removeUser(groupId, userId)`                       | 单向发送 `removemeshuser` | 等待对应 `accountchange` 事件 | 移除用户与设备组的关联           |

成员关系变更最多等待 5 秒确认。期间断线会失败；收到服务端错误时抛出 `MeshCentralServerError`。

## 历史事件 `client.events`

| 方法                        | 发送消息                         | 返回             | 用途               |
| --------------------------- | -------------------------------- | ---------------- | ------------------ |
| `list(options)`             | `events`, `limit`, 可选 `filter` | `MeshCentralEvent[]` | 全局活动或审计列表 |
| `listByDevice(id, options)` | 增加 `nodeid`                    | `MeshCentralEvent[]` | 设备时间线         |
| `listByUser(id, options)`   | 增加 `userid`                    | `MeshCentralEvent[]` | 用户操作记录       |

`limit` 默认 100，范围 1 到 200。历史请求超时为 30 秒。过滤器见 [events.md](events.md)。

## 用户组 `client.userGroups`

`list()` 发送 `usergroups`，把 `ugroups` 或 `usergroups` 标准化为 `UserGroup[]`。当前只提供查询，可用于用户权限编辑器中的用户组选项。

## 用户 `client.users`

| 方法                                | 发送的 action                         | 返回/确认方式                               | 用途                                 |
| ----------------------------------- | ------------------------------------- | ------------------------------------------- | ------------------------------------ |
| `list()`                            | `users`                               | `ManagedUser[]`                             | 加载可管理用户及权限、锁定状态和关联 |
| `listSessionCounts()`               | `wssessioncount`                      | `Record<string, number>`                    | 显示每个用户的在线 WebSocket 会话数  |
| `create(options)`                   | 先 `users` 去重，再单向发送 `adduser` | 等待 `accountcreate`，超时后用 `users` 验证 | 创建账号，可使用随机密码             |
| `update(userId, patch)`             | 单向发送 `edituser`                   | 等待 `accountchange`，超时后查询验证        | 修改邮箱、真实姓名或电话             |
| `setLocked(userId, locked, rights)` | 单向发送 `edituser`                   | 等待事件，超时后查询验证                    | 修改 `siteadmin` 中的锁定位          |
| `setSiteRights(userId, siteRights)` | 单向发送 `edituser`                   | 等待 `accountchange`，超时后查询验证        | 替换用户的完整站点权限掩码           |
| `remove(userId, username?)`         | 单向发送 `deleteuser`                 | 等待 `accountremove`，超时后查询验证        | 删除账号                             |

`setSiteRights()` 要求 `siteRights` 是无符号 32 位整数，发送的字段为 `siteadmin`。例如：

```ts
await client.users.setSiteRights('user//test', 4);
// { action: 'edituser', id: 'user//test', siteadmin: 4 }
```

服务端成功后通常通过 `event` 消息广播 `etype: 'user'`、`action: 'accountchange'`，客户端会用用户 ID 匹配该事件并完成操作确认。

用户变更按客户端串行执行，避免多个无 `responseid` 的确认事件相互匹配。确认等待时间为 5 秒；查询验证成功时方法也会正常完成。

创建用户时，`randomPassword: false` 必须提供密码。不要记录或展示服务端返回的随机密码，除非产品流程明确要求并采用安全的一次性展示。

## 服务器 `client.server`

### 管理控制台、全局跟踪与错误日志（MC 1.1.54）

| 方法 | 协议 / 返回值 |
| --- | --- |
| `sendConsoleCommand(value: string, tag?: string): Promise<void>` | 单向发送 `{ action: 'serverconsole', value, tag? }`；Promise 只表示已发送，不代表执行完成 |
| `subscribeConsole(listener): () => void` | 输出 `ServerConsoleOutput { text: string, tag?: string, receivedAt: number }`；接收时间为本地 Unix 毫秒 |
| `getTraceSources(): readonly string[] \| undefined` | 读取缓存；未知为 `undefined`，服务端 `null` 归一化为 `[]` |
| `setTraceSources(categories: readonly string[]): Promise<void>` | 单向发送 `{ action: 'traceinfo', traceSources: [...categories] }`，修改服务器全局设置 |
| `subscribeTraceSources(listener): () => void` | 后续有效设置更新通过 `readonly string[]` 通知；初始状态使用 getter 读取 |
| `subscribeTrace(listener): () => void` | 输出 `ServerTrace { source: string, args: unknown[], time: number }`，保留服务端时间 |
| `fetchErrorLog(): Promise<ServerErrorLog>` | 请求 `servererrors`；响应没有 `data` 时返回 `{}`，空字符串返回 `{ content: '' }`，非字符串拒绝为协议错误 |
| `clearErrorLog(): Promise<void>` | 仅发送 `{ action: 'serverclearerrorlog' }`，不等待 ACK |

控制台可异步产生多条 `{ action: 'serverconsole', value: string, tag? }`，没有通用完成标记；请先订阅再发送，不要把第一条输出当作完成。

`traceinfo` 初始消息及 `{ action: 'event', event: { action: 'traceinfo', traceSources, ... } }` 更新缓存，独立于页面监听器。断线、重连会清空缓存；不会自动重新应用全局设置。所有取消订阅操作只移除本地监听器，绝不关闭全局跟踪。`trace` 数据来自 `{ action: 'trace', source, args, time }`。

`servererrors` 无可靠关联 ID，由 RequestManager 顺序发送同类请求；断线时拒绝排队请求，不跨连接重发。读取日志与控制台输出可能包含敏感信息，调用方应限制展示权限。`fetchServerConfig` 因原始配置含秘密信息而暂不提供。应用权限中的 `siteAdmin: boolean` 由 `isSiteAdministrator` 判断完整管理员权限，不能以某个管理权限位代替；服务端仍负责实际授权。

`getTimelineStats(hours)` 查询服务端保存的时间线快照，`hours` 必须是 `0` 到 `720` 的整数：

```ts
const snapshots = await client.server.getTimelineStats(24);
for (const snapshot of snapshots) {
  console.log(snapshot.time, snapshot.connections?.connectedAgents);
  console.log(snapshot.memory?.heapUsed, snapshot.traffic?.agentCtrlIn);
}
```

快照请求发送：

```json
{ "action": "servertimelinestats", "hours": 24 }
```

返回值是标准化后的 `ServerTimelineStats[]`。`time` 和 `expire` 使用 ISO 时间字符串；`conn`、`mem`、`traffic` 分别映射为 `connections`、`memory`、`traffic`，字段名也会转换为 camelCase。每个结果的 `raw` 以及各子对象的 `raw` 保留服务端原始数据。

`subscribeStats(listener, intervalMs = 10000)` 发送以下单向消息，并返回本地监听器的取消函数：

```json
{ "action": "serverstats", "interval": 10000 }
```

服务端按指定间隔推送 `serverstats`。客户端通过 `serverStats` 通道提供标准化的 `ServerStats`，包含 `totalMemory`、`freeMemory`、`availableMemory`、`cpuAverage`，以及可选的 `serverState`。`serverState` 包含账号、设备组、Agent 会话、在线用户、用户会话、中继和 Intel AMT 连接统计。

```ts
const unsubscribe = client.server.subscribeStats((stats) => {
  console.log(stats.cpuAverage);
  console.log(stats.serverState?.agentSessions);
});

unsubscribe();
```

`intervalMs` 必须是正整数。取消函数只移除当前客户端的本地监听器；原始推送仍可通过 `message` 通道观察。

## 客户端内部消息

除了资源 action，客户端还会发送：

| 消息                              | 何时发送                                         | 作用             |
| --------------------------------- | ------------------------------------------------ | ---------------- |
| `{ type: 'authenticate', token }` | WebSocket 打开后，且 `getAccessToken()` 返回令牌 | 完成访问令牌鉴权 |
| `{ type: 'ping' }`                | 已连接时按心跳间隔发送                           | 保持控制通道活跃 |

`connect()` 在收到 `authenticated`，或同时收到 `serverinfo` 与 `userinfo` 后才进入 `connected`。

## 兼容方法

`requestSystemInfo()`、`requestSnapshot()`、`refreshDevices()`、`updateDevice()` 和 `sendPowerAction()` 是为已有消费者保留的薄委托。新代码应使用对应资源 API，以便直接处理 Promise 和返回值。
