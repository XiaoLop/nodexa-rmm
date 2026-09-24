# 事件、订阅通道与诊断

`GatewayClient.on(channel, listener)` 用于订阅连接生命周期、领域事件、原始消息、错误和诊断。它返回一个取消订阅函数；监听器之间相互隔离，一个监听器抛错不会阻止其他监听器执行。

## 基本用法

```ts
const unsubscribe = client.on('event', (event) => {
  console.log(event.type, event.deviceId, event.occurredAt);
});

// 页面卸载、客户端切换或不再需要时取消。
unsubscribe();
```

调用 `client.destroy()` 会清除全部监听器。

## 订阅通道

### `connection`

载荷类型为 `ConnectionStateChange`：

```ts
interface ConnectionStateChange {
  previous: ConnectionStatus;
  current: ConnectionStatus;
  reconnectAttempt: number;
  error?: Error;
}
```

用于更新连接指示器、暂停依赖网关的按钮、记录重连状态。异常断线后会进入 `reconnecting`；主动 `disconnect()` 后不会自动重连。

### `event`

载荷类型为标准化的 `GatewayEvent`，适合业务逻辑消费。它只包含当前已识别的领域事件；无法识别的消息进入 `diagnostic` 的 `unknown-message`，不会以 `type: 'unknown'` 的形式发布到该通道。

### `userInfo`

载荷类型为 `UserInfo`。连接初始化收到 `userinfo` 时触发，可用于取得当前用户 ID、名称、邮箱、站点权限和登录时间。

### `message`

载荷是 JSON 解析后的原始消息，并且在请求关联、连接检查和事件标准化之前触发。它可能是响应、推送或未知协议消息。

这个通道适合：

- 调试不同 MeshCentral/网关版本的消息形态。
- 跟踪 `commands.execute()` 的输出消息。
- 为尚未标准化的服务端推送编写实验性处理。

业务代码必须先检查载荷类型和字段。不要假设每条消息都有 `action`、`responseid` 或 `event`。

### `error`

载荷是 `Error`。连接、鉴权、JSON 解析和部分兼容方法中的异步错误会进入此通道。直接调用并 `await` 的资源方法仍应使用 `try/catch` 处理 Promise 拒绝，不能只依赖全局 `error` 监听器。

### `diagnostic`

载荷类型为 `GatewayDiagnostic`，用于报告非致命协议问题：

| 类型 | 含义 | 建议处理 |
| --- | --- | --- |
| `invalid-message` | 收到的 WebSocket 数据不是有效 JSON | 记录脱敏后的数据类型和服务端版本 |
| `unmatched-response` | 响应无法唯一关联到等待中的请求 | 检查并发调用及服务端是否返回 `responseid` |
| `listener-error` | 某个订阅监听器抛出异常 | 修复监听器；其他监听器仍会继续执行 |
| `unknown-message` | 消息不是已知连接信号、响应或领域事件 | 抓取脱敏样例，评估是否需要新增标准化逻辑 |

诊断回调本身抛错时不会递归产生新的 `listener-error`。

## GatewayEvent 字段

```ts
interface GatewayEvent {
  id: string;
  type: GatewayEventType;
  action?: string;
  deviceId?: string;
  deviceName?: string;
  user?: string;
  ip?: string;
  message?: string;
  occurredAt: string;
  raw?: unknown;
}
```

- `id`：优先使用服务端事件 ID；缺失时由稳定字段生成，适合列表去重，不应当作服务端永久主键。
- `type`：客户端归一化后的事件类型。
- `action`：服务端原始 action，有助于进一步区分同类事件。
- `occurredAt`：ISO 时间字符串；服务端未给时间时使用客户端接收时间。
- `raw`：原始事件对象，用于兼容未标准化字段。使用前必须检查结构。

## 领域事件类型

| `type` | 识别来源 | 表示什么 | 常见用途 |
| --- | --- | --- | --- |
| `deviceOnline` | `nodeconnect`、`connect`、`connected`，且 `conn & 1` 不为 `0`（事件未携带 `conn` 时按连接事件处理） | 设备 Agent 建立连接或恢复在线 | 更新在线状态、触发轻量刷新 |
| `deviceOffline` | `nodedisconnect`、`disconnect`、`disconnected`，或连接事件的 `conn & 1` 为 `0` | 设备 Agent 断开或变为离线 | 标记离线、停止需要在线设备的操作 |
| `deviceChanged` | `changenode` | 设备属性发生变化 | 刷新名称、分组、标签等设备数据 |
| `deviceRemoved` | `removenode`、`deletenode` | 设备被删除 | 从列表和选择集中移除设备 |
| `relayLog` | `relaylog` 或 `etype: relay` | Relay 会话日志 | 审计远程访问和会话活动 |
| `agentLog` | `agentlog` | Agent 日志事件 | 展示 Agent 操作和状态记录 |
| `manualOperation` | `manual` | 人工操作记录 | 审计管理员手动行为 |
| `commandExecution` | `runcommands` | 命令执行相关历史或推送事件 | 更新命令历史；实时输出仍由 `message` 跟踪 |
| `batchUpload` | `batchupload` | 批量上传相关事件 | 构建批量任务记录或审计视图 |
| `userSessionCount` | `wssessioncount` | 用户 WebSocket 会话数变化 | 更新在线用户/会话计数 |

公开类型还保留 `unknown`，便于直接调用 `normalizeEvent()` 的消费者表达未知结果；`GatewayClient` 不会把未知结果发布到 `event` 通道。

## 历史事件与实时事件

`client.events.list()`、`listByDevice()` 和 `listByUser()` 返回的历史记录与实时 `event` 通道都使用 `GatewayEvent`。这使活动时间线可以先加载历史数据，再合并实时数据。

```ts
const history = await client.events.listByDevice(deviceId, { limit: 100 });
const byId = new Map(history.map((event) => [event.id, event]));

const unsubscribe = client.on('event', (event) => {
  if (event.deviceId === deviceId) byId.set(event.id, event);
});
```

历史事件过滤器包括 `agentlog`、`relaylog`、`manual`、`runcommands`、`batchupload`、`changenode` 和 `removenode`，每次最多请求 200 条。

## 状态同步建议

- `deviceOnline` 和 `deviceOffline` 可以直接更新已存在设备的在线状态。
- `deviceChanged` 通常只表示“发生变化”，若 `raw` 中字段不完整，应重新调用 `devices.list()` 或 `details()`。
- `deviceRemoved` 应同时清理页面选择、缓存详情和进行中的 UI 操作。
- 重连完成后不要假设离线期间事件会补发，应重新同步关键资源。
- 对未知 action 先通过 `message`/`diagnostic` 收集证据，再扩展 `normalizeEvent()` 和对应测试。
