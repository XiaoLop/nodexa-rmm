# 原始 request/send 消息指南

当 MeshCentral action 尚未被资源 API 封装时，可以通过 `client.request()` 或 `client.send()` 调用。原始入口是兼容和探索工具，不等于对任意服务端 action 提供稳定支持。

## 选择 `request()` 还是 `send()`

| 入口 | 行为 | 适合场景 |
| --- | --- | --- |
| `request(payload, timeoutMs?)` | 添加或复用 `responseid`，等待匹配响应，处理超时与服务端错误 | 查询、需要确认的修改、获取授权材料 |
| `send(payload)` | 立即 JSON 序列化并写入已连接的 WebSocket，不等待响应 | 协议定义为单向，或确认必须通过后续事件完成 |

优先顺序是：已有资源方法、`request()`、最后才是裸 `send()`。

## request 示例

```ts
interface AuthCookieResponse {
  cookie: string;
  rcookie: string;
}

const response = await client.request<AuthCookieResponse>(
  { action: 'authcookie' },
  10_000,
);
```

泛型 `AuthCookieResponse` 只约束调用方代码，不检查服务端数据。对于安全或版本差异较大的响应，应使用运行时 schema：

```ts
const response = await client.request<unknown>({ action: 'custom-action' });

if (
  !response ||
  typeof response !== 'object' ||
  !('value' in response) ||
  typeof response.value !== 'string'
) {
  throw new Error('Unexpected custom-action response.');
}
```

## 响应如何关联

`request()` 默认生成 `req-*` ID，并发送：

```json
{
  "action": "custom-action",
  "responseid": "req-..."
}
```

收到响应后，客户端按以下顺序尝试关联：

1. `responseid` 精确匹配。
2. `tag` 与请求 ID 或请求 `tag` 匹配。
3. action 匹配；若包含设备 ID，还会辅助匹配 `nodeid`。

如果同一 action 有多个候选请求且服务端没有返回足够标识，客户端不会猜测，而是产生 `unmatched-response` 诊断。

为兼容不返回 `responseid` 的服务端版本，以下 action 会分别串行执行：

- `authcookie`
- `events`
- `meshes`
- `usergroups`
- `users`
- `wssessioncount`

这表示同一 action 的后续请求要等待前一个完成，但不同 action 仍可并行。

## send 示例

```ts
client.send({
  action: 'msg',
  type: 'console',
  nodeid: 'node//device-id',
  value: 'help',
});
```

`send()` 只在客户端已连接时可用，否则抛出 `GatewayConnectionError`。调用成功只表示数据已交给 WebSocket，不表示服务端接受，也不表示设备执行完成。

如果操作通过事件确认，应在发送前注册监听器，避免快速响应先于监听器到达。`groups` 和 `users` 资源已经实现了这种模式，并处理了超时与断线，类似功能应优先扩展资源层而不是在页面中重复实现。

## 监听原始响应或推送

```ts
const unsubscribe = client.on('message', (message) => {
  if (!message || typeof message !== 'object') return;
  if (!('action' in message) || message.action !== 'custom-push') return;

  // 在这里继续验证字段，再交给业务层。
});
```

`message` 在内部请求消费和事件标准化之前触发，因此会看到所有有效 JSON 消息。不要修改收到的对象，也不要把完整原始消息直接写入生产日志。

## 添加新消息的推荐流程

1. 确认目标 action、必填字段、权限和适用 MeshCentral/网关版本。
2. 从测试或脱敏抓包中保存至少一个成功响应、一个失败响应；若有推送，再保存推送样例。
3. 判断完成语义：响应即完成、事件确认、还是需要后续查询验证。
4. 在合适的资源类中添加方法和参数校验，不让页面直接拼协议字段。
5. 稳定字段转换为公开类型，不稳定字段保留在 `raw`。
6. 为响应关联、错误、超时和版本差异添加测试。
7. 更新 [messages-and-resources.md](messages-and-resources.md) 和包根 README。

## 设计资源方法时的约定

- 查询方法通常返回标准化结构，并保留必要的 `raw`。
- 修改方法必须写清返回代表“响应”“事件确认”还是“远端完成”。
- 必填 ID 和名称在发送前进行非空校验。
- 数字枚举、权限掩码、分页范围和超时值应在客户端验证。
- 不返回 `responseid` 的 action 应避免同 action 并发，或建立可靠的事件匹配策略。
- 断线时应拒绝所有等待中的操作，不让 Promise 永久悬挂。

## 安全要求

- 不在 URL、日志、异常文本或分析事件中暴露密码、令牌、Cookie 和邀请凭据。
- `getAccessToken()` 应返回短期令牌；不要把长期秘密放进公共前端环境变量。
- 命令文本和命令输出可能包含敏感信息，展示和存储前应按产品权限模型处理。
- 用户、IP、邮箱和设备信息属于敏感运维数据，原始抓包必须脱敏。
- 不要把服务端返回的 `error` 直接渲染为 HTML。
- 原始 action 仍受服务端权限控制；客户端参数校验不能替代服务端授权。

## 常见失败

| 错误 | 原因 | 处理建议 |
| --- | --- | --- |
| `GatewayConnectionError` | 尚未连接或 WebSocket 失败 | 等待 `connect()`，根据 `retryable` 决定是否重试 |
| `GatewayConnectionClosedError` | 等待响应期间断线 | 重连后重新同步状态，再决定是否重放幂等请求 |
| `GatewayRequestTimeoutError` | 超时内没有可匹配响应 | 检查 action、服务端版本、并发和响应标识 |
| `GatewayServerError` | 响应包含 `error` 或 `err` | 展示安全提示，记录脱敏上下文 |
| `GatewayValidationError` | 参数不满足资源方法要求 | 在调用前修正输入，不应自动重试 |
| `GatewayProtocolError` | 收到无效 JSON 等协议问题 | 记录版本和诊断，检查网关代理或协议兼容性 |

重试修改操作前要先判断幂等性。断线可能发生在服务端已经执行、客户端尚未收到确认的时刻，盲目重试可能重复创建或重复执行。
