# 资源 API 与消息清单

资源 API 是调用控制通道的首选入口。除特别说明外，资源方法会通过 `request()` 自动添加 `responseid`，等待匹配响应，并把超时、断线和服务端 `error/err` 转换为公开错误类型。

## 返回值约定

- `Device[]`、`DeviceGroup[]`、`ManagedUser[]`、`GatewayEvent[]` 等是客户端标准化结构。
- `Promise<unknown>` 表示操作已收到一个匹配响应，但服务端字段尚未形成稳定公开契约。
- 带 `raw` 的结果同时提供便于消费的字段和原始响应。
- `submitted` 表示请求已提交，不保证设备已经执行完成。
- `request<T>()` 的 `T` 只在编译期生效，不会验证运行时数据。

## 设备 `client.devices`

| 方法 | 发送的 action/关键字段 | 返回 | 可以用来做什么 |
| --- | --- | --- | --- |
| `list()` | `nodes` | `Device[]` | 加载全部可见设备 |
| `listByGroup(groupId)` | `nodes`, `meshid` | `Device[]` | 加载指定设备组成员 |
| `systemInfo(id)` | `getsysinfo`, `nodeid`, `nodeinfo: true` | 泛型原始响应 | 查看操作系统、硬件和 Agent 系统信息 |
| `networkInfo(id)` | `getnetworkinfo`, `nodeid` | 泛型原始响应 | 查看网卡、地址等网络信息 |
| `lastConnect(id)` | `lastconnect`, `nodeid` | 泛型原始响应 | 查看单个设备最后连接信息 |
| `lastConnects()` | `lastconnects` | `Record<string, string>` | 批量补充设备最后在线时间 |
| `details(id)` | 并行发送 `nodes`、`getnetworkinfo`、`lastconnect`、`getsysinfo` | `DeviceDetails` | 一次组装设备详情页所需数据 |
| `update(id, patch)` | `changedevice` | 原始确认响应 | 修改名称、描述、设备组或标签 |
| `remove(id)` | `removedevices`, `nodeids` | 原始确认响应 | 删除设备 |
| `setUserRights(id, username, rights)` | `adddeviceuser`, `nodeid`, `usernames`, `rights` | 原始确认响应 | 设置用户对单台设备的直接权限 |
| `removeUser(id, username)` | `adddeviceuser`, `rights: 0`, `remove: true` | 原始确认响应 | 移除用户对单台设备的直接权限 |
| `powerAction(id, action)` | `wakenode` 或 `poweraction` | 原始确认响应 | 唤醒、重启、关机或休眠 |
| `updateManyGroup(ids, groupId)` | 每台设备发送 `changedevice`，并发上限 4 | `BatchOperationResult` | 批量迁移设备并得到逐设备提交结果 |
| `powerMany(ids, 'wake')` | 单次 `wakedevices`, `nodeids` | `BatchOperationResult` | 批量唤醒设备 |
| `powerMany(ids, other)` | 每台设备发送 `poweraction`，并发上限 4 | `BatchOperationResult` | 批量重启、关机或休眠 |
| `inviteByEmail(options)` | `inviteAgent` | `{ raw }` | 通过邮件邀请安装 Agent |
| `createInviteLink(options)` | `createInviteLink` | `{ url?, raw }` | 生成 Agent 安装邀请链接 |
| `normalize(value)` | 不发送消息 | `Device \| undefined` | 复用包内设备标准化逻辑 |

`details()` 使用并行 fail-fast 策略，任一请求失败时整个调用失败。`raw` 保留四项原始响应。

单设备直接授权只接受远程控制、Agent 控制台、服务器文件、唤醒、设置备注、聊天通知和卸载 Agent 权限，全部单设备权限的组合值为 `49400`。不要向 `adddeviceuser` 发送设备组管理权限、限制位或 `0xffffffff`，服务端会返回 `result: "Invalid rights"`。

电源 action 支持 `wake`、`reset`、`poweroff` 和 `sleep`。电源请求得到响应只表示网关处理了请求；设备是否真正完成操作应结合后续事件或状态刷新判断。

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
- `cancelRemote()`：当前协议不支持，会拒绝并抛出 `GatewayValidationError`。

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

| 方法 | 发送的 action | 返回/确认方式 | 用途 |
| --- | --- | --- | --- |
| `list()` | `meshes` | `DeviceGroup[]` | 加载设备组 |
| `create(name, options)` | `createmesh` | 原始响应 | 创建设备组，默认 `meshtype: 2` |
| `update(groupId, patch)` | `editmesh` | 原始响应 | 修改组名或描述 |
| `remove(groupId)` | `deletemesh` | 原始响应 | 删除设备组 |
| `setUserRights(groupId, groupName, userId, rights)` | 单向发送 `addmeshuser` | 等待对应 `accountchange` 事件 | 设置用户对设备组的 32 位权限掩码 |
| `removeUser(groupId, userId)` | 单向发送 `removemeshuser` | 等待对应 `accountchange` 事件 | 移除用户与设备组的关联 |

成员关系变更最多等待 5 秒确认。期间断线会失败；收到服务端错误时抛出 `GatewayServerError`。

## 历史事件 `client.events`

| 方法 | 发送消息 | 返回 | 用途 |
| --- | --- | --- | --- |
| `list(options)` | `events`, `limit`, 可选 `filter` | `GatewayEvent[]` | 全局活动或审计列表 |
| `listByDevice(id, options)` | 增加 `nodeid` | `GatewayEvent[]` | 设备时间线 |
| `listByUser(id, options)` | 增加 `userid` | `GatewayEvent[]` | 用户操作记录 |

`limit` 默认 100，范围 1 到 200。历史请求超时为 30 秒。过滤器见 [events.md](events.md)。

## 用户组 `client.userGroups`

`list()` 发送 `usergroups`，把 `ugroups` 或 `usergroups` 标准化为 `UserGroup[]`。当前只提供查询，可用于用户权限编辑器中的用户组选项。

## 用户 `client.users`

| 方法 | 发送的 action | 返回/确认方式 | 用途 |
| --- | --- | --- | --- |
| `list()` | `users` | `ManagedUser[]` | 加载可管理用户及权限、锁定状态和关联 |
| `listSessionCounts()` | `wssessioncount` | `Record<string, number>` | 显示每个用户的在线 WebSocket 会话数 |
| `create(options)` | 先 `users` 去重，再单向发送 `adduser` | 等待 `accountcreate`，超时后用 `users` 验证 | 创建账号，可使用随机密码 |
| `update(userId, patch)` | 单向发送 `edituser` | 等待 `accountchange`，超时后查询验证 | 修改邮箱、真实姓名或电话 |
| `setLocked(userId, locked, rights)` | 单向发送 `edituser` | 等待事件，超时后查询验证 | 修改 `siteadmin` 中的锁定位 |
| `setSiteRights(userId, siteRights)` | 单向发送 `edituser` | 等待 `accountchange`，超时后查询验证 | 替换用户的完整站点权限掩码 |
| `remove(userId, username?)` | 单向发送 `deleteuser` | 等待 `accountremove`，超时后查询验证 | 删除账号 |

`setSiteRights()` 要求 `siteRights` 是无符号 32 位整数，发送的字段为 `siteadmin`。例如：

```ts
await client.users.setSiteRights('user//test', 4);
// { action: 'edituser', id: 'user//test', siteadmin: 4 }
```

服务端成功后通常通过 `event` 消息广播 `etype: 'user'`、`action: 'accountchange'`，客户端会用用户 ID 匹配该事件并完成操作确认。

用户变更按客户端串行执行，避免多个无 `responseid` 的确认事件相互匹配。确认等待时间为 5 秒；查询验证成功时方法也会正常完成。

创建用户时，`randomPassword: false` 必须提供密码。不要记录或展示服务端返回的随机密码，除非产品流程明确要求并采用安全的一次性展示。

## 客户端内部消息

除了资源 action，客户端还会发送：

| 消息 | 何时发送 | 作用 |
| --- | --- | --- |
| `{ type: 'authenticate', token }` | WebSocket 打开后，且 `getAccessToken()` 返回令牌 | 完成访问令牌鉴权 |
| `{ type: 'ping' }` | 已连接时按心跳间隔发送 | 保持控制通道活跃 |

`connect()` 在收到 `authenticated`，或同时收到 `serverinfo` 与 `userinfo` 后才进入 `connected`。

## 兼容方法

`requestSystemInfo()`、`requestSnapshot()`、`refreshDevices()`、`updateDevice()` 和 `sendPowerAction()` 是为已有消费者保留的薄委托。新代码应使用对应资源 API，以便直接处理 Promise 和返回值。
