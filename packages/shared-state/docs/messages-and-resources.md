# 消息与资源 API

shared-state 不直接发送 WebSocket 协议消息。发送请求时应使用 `@meshcentral/control-client` 的资源 API，再通过 `GatewayStore` 展示连接和实时状态。

本文中的“消息”指资源方法在内部发送的 MeshCentral action。调用方通常不需要手写这些 payload。

## 推荐调用方式

```ts
const devices = await client.devices.list();
await client.devices.update(deviceId, { name: 'Build server' });
await binding.sync();
```

资源方法提供：

- 必填参数和取值范围校验；
- 自动生成和匹配 `responseid`；
- 请求超时、连接关闭和服务端错误处理；
- 设备、分组、事件、用户等结果归一化；
- 部分无直接响应操作的事件确认和结果复查。

## 设备资源

入口：`client.devices`

| 方法 | 内部 action | 获得什么 | 可以用来做什么 |
| --- | --- | --- | --- |
| `list()` | `nodes` | `Device[]` | 设备列表、在线状态和基础资产信息 |
| `listByGroup(groupId)` | `nodes` | 指定组的 `Device[]` | 分组设备页、组内批量操作 |
| `systemInfo(deviceId)` | `getsysinfo` | 服务端原始系统信息 | 硬件、操作系统和 Agent 详情页 |
| `networkInfo(deviceId)` | `getnetworkinfo` | 服务端原始网络信息 | 网卡、IP 和网络诊断 |
| `lastConnect(deviceId)` | `lastconnect` | 单设备原始最后连接数据 | 离线设备详情和审计 |
| `lastConnects()` | `lastconnects` | `Record<deviceId, ISO time>` | 批量补全设备最后在线时间 |
| `details(deviceId)` | `nodes` + 三个详情请求 | `DeviceDetails` | 一次加载设备、网络、系统和连接详情 |
| `update(deviceId, updates)` | `changedevice` | 服务端响应 | 修改名称、描述、设备组或标签 |
| `remove(deviceId)` | `removedevices` | 服务端响应 | 删除设备 |
| `powerAction(deviceId, action)` | `wakenode` 或 `poweraction` | 服务端响应 | 唤醒、重启、关机或休眠 |
| `updateManyGroup(deviceIds, groupId)` | 多个 `changedevice` | `BatchOperationResult` | 批量移动设备并展示逐设备提交结果 |
| `powerMany(deviceIds, action)` | `wakedevices` 或多个 `poweraction` | `BatchOperationResult` | 批量电源操作并展示逐设备结果 |
| `inviteByEmail(options)` | `inviteAgent` | `AgentInviteResult` | 向用户发送 Agent 安装邀请 |
| `createInviteLink(options)` | `createInviteLink` | URL 和原始响应 | 生成可分享的 Agent 安装链接 |

`PowerAction` 可取 `wake`、`reset`、`poweroff`、`sleep`。

`systemInfo`、`networkInfo` 和 `lastConnect` 默认返回 `unknown` 或调用方指定的泛型，因为不同服务端版本的原始结构可能不同。

设备写操作完成后，服务端可能推送设备变更事件。需要立即确认最终状态时仍建议调用 `binding.sync()`。

## 设备组资源

入口：`client.groups`

| 方法 | 内部 action | 获得什么 | 可以用来做什么 |
| --- | --- | --- | --- |
| `list()` | `meshes` | `DeviceGroup[]` | 设备组导航、筛选和选择器 |
| `create(name, options)` | `createmesh` | 服务端响应 | 创建设备组 |
| `update(groupId, updates)` | `editmesh` | 服务端响应 | 修改组名称或描述 |
| `remove(groupId)` | `deletemesh` | 服务端响应 | 删除设备组 |
| `setUserRights(groupId, groupName, userId, rights)` | `addmeshuser` | 用户变更确认事件 | 设置用户在设备组中的权限位 |
| `removeUser(groupId, userId)` | `removemeshuser` | 用户变更确认事件 | 移除用户的设备组访问权 |

成员权限操作会等待服务端 `accountchange` 确认，连接关闭、服务端报错或超时会拒绝 Promise。

设备组写操作后可调用 `binding.sync()` 更新 `GatewayStore.groups`。

## 历史事件资源

入口：`client.events`

| 方法 | 内部 action | 获得什么 | 可以用来做什么 |
| --- | --- | --- | --- |
| `list(options)` | `events` | `GatewayEvent[]` | 全局审计和最近活动 |
| `listByDevice(deviceId, options)` | `events` | 指定设备的 `GatewayEvent[]` | 设备时间线和故障排查 |
| `listByUser(userId, options)` | `events` | 指定用户的 `GatewayEvent[]` | 用户操作审计 |

`limit` 必须是 1 到 200 的整数，默认 100。可用 `filter`：

| filter | 用途 |
| --- | --- |
| `agentlog` | Agent 操作日志 |
| `relaylog` | 中继和远程会话日志 |
| `manual` | 手动操作 |
| `runcommands` | 命令执行 |
| `batchupload` | 批量上传 |
| `changenode` | 设备变更 |
| `removenode` | 设备删除 |

历史事件不会自动写入 shared-state 的实时 `events` 数组。

## 命令资源

入口：`client.commands`

### 跟踪执行

```ts
const execution = client.commands.execute(deviceIds, 'whoami', {
  shell: 'powershell',
  timeoutMs: 60_000,
});

const unsubscribe = execution.subscribe((snapshot) => {
  console.log(snapshot.status, snapshot.results);
});

const finalSnapshot = await execution.completed;
unsubscribe();
```

`execute()` 返回 `CommandExecutionHandle`，可获得：

- 整批任务状态；
- 每台设备的状态、stdout/stderr 输出、退出码和耗时；
- `subscribe()` 实时订阅；
- `completed` 等待最终结果；
- `stopTracking()` 停止本地跟踪；
- `cancelRemote()` 请求远端取消。

它适合终端式输出、批量命令进度和需要等待最终结果的任务。

### 仅提交

```ts
const submission = await client.commands.run(deviceIds, 'hostname', {
  shell: 'shell',
  runAsUser: 0,
  reply: true,
});

console.log(submission.requestId);
```

`run()` 内部发送 `runcommands`，返回 `CommandSubmission`，适合只关心提交成功或由其他事件流处理结果的场景。

命令结果不保存在 `GatewayStore` 中，应由命令功能自己的状态管理。

## 用户资源

入口：`client.users`

| 方法 | 内部 action | 获得什么 | 可以用来做什么 |
| --- | --- | --- | --- |
| `list()` | `users` | `ManagedUser[]` | 用户管理列表和权限展示 |
| `listSessionCounts()` | `wssessioncount` | `Record<userId, count>` | 在线用户和多会话提示 |
| `create(options)` | `adduser` | 创建确认事件或复查结果 | 创建本地用户 |
| `update(userId, updates)` | `edituser` | 修改确认事件或复查结果 | 修改邮箱、姓名和电话 |
| `setLocked(userId, locked, currentSiteRights)` | `edituser` | 修改确认事件或复查结果 | 锁定或解锁账号 |
| `remove(userId, username?)` | `deleteuser` | 删除确认事件或复查结果 | 删除用户 |

用户写操作会串行执行，并等待服务端账户事件；如果事件未及时到达，客户端会重新查询用户列表验证结果。

用户列表不会自动进入 `GatewayStore.userInfo`。`userInfo` 只代表当前登录用户。

## 用户组资源

入口：`client.userGroups`

| 方法 | 内部 action | 获得什么 | 可以用来做什么 |
| --- | --- | --- | --- |
| `list()` | `usergroups` | `UserGroup[]` | 用户组筛选、权限配置和成员管理页面 |

用户组列表不保存在当前 `GatewayStore` 中。

## 连接与通用消息

| API | 作用 |
| --- | --- |
| `client.connect()` | 建立连接、鉴权并启动心跳 |
| `client.disconnect()` | 主动断开并停止自动重连 |
| `client.destroy()` | 永久销毁客户端并清理监听器 |
| `client.on(channel, listener)` | 监听连接、消息、事件、用户信息、错误或诊断 |
| `client.request(payload, timeoutMs?)` | 发送带请求关联和超时控制的自定义请求 |
| `client.send(payload)` | 直接发送原始消息，不等待响应 |

`request()` 和 `send()` 是底层扩展入口。只有资源 API 尚未覆盖服务端能力时才应使用，并优先在 `@meshcentral/control-client` 中新增经过测试的资源方法。

使用 `request()` 时不要自行复用 `responseid`；请求管理器会生成关联 ID。使用 `send()` 时，调用方必须自行处理响应、事件确认、超时和连接中断。

## 如何选择返回值的归属

| 数据 | 推荐状态位置 |
| --- | --- |
| 设备、设备组、当前用户、实时事件、连接状态 | `GatewayStore` |
| 历史事件查询 | 事件页面的查询状态 |
| 命令输出与进度 | 命令执行功能状态 |
| 用户和用户组列表 | 用户管理功能状态 |
| 设备详情、系统和网络信息 | 设备详情页面状态 |
| 邀请结果 | 邀请流程的临时状态 |

shared-state 是共享基础快照，不应成为所有服务器响应的无限缓存。
