# 文档编写指南

`docs` 目录用于保存比 README 更详细、可独立阅读的专题文档。README 负责包定位、最短接入示例和文档导航；具体行为、完整 API 表格和边界条件应写在这里。

## 何时新增文档

以下情况应新增或更新 `docs` 中的 Markdown：

- 新增公开 API、状态字段、selector 或事件类型；
- 修改绑定、同步、事件处理或生命周期行为；
- 增加新的客户端资源能力，需要解释如何与 Store 配合；
- 存在无法从类型签名直接看出的超时、缓存、一致性或清理规则；
- 某个主题已经使 README 过长。

## 文件命名

- 使用小写英文和连字符，例如 `store-and-binding.md`；
- 一个文件只讲一个明确主题；
- 避免 `misc.md`、`notes.md`、`new.md` 等无法表达内容的名称；
- 文件放在 `packages/shared-state/docs/` 下；
- 新增文件后必须在 README 的“详细文档”中添加链接。

## 推荐结构

```md
# 文档标题

用一段话说明本文解决什么问题，以及目标读者是谁。

## 核心概念

说明术语、职责边界和前置条件。

## 使用方式

给出可以运行的最小示例。

## API 或行为参考

用表格说明输入、输出、副作用和用途。

## 错误与边界

说明超时、连接断开、空数据、权限和清理规则。

## 相关文档

链接到 README、源码或其他专题文档。
```

不是所有文档都必须机械套用这些标题，但应覆盖读者完成任务所需的信息。

## 内容要求

### 从公开 API 出发

文档应优先描述包使用者能导入的内容：

- `src/index.ts` 导出的函数、类型和常量；
- `GatewayStore` 的公开状态与 action；
- `GatewayClient` 的公开资源方法；
- 实际可观察的同步和事件行为。

不要把内部辅助函数写成公共能力，也不要仅根据服务端协议猜测尚未实现的功能。

### 明确职责归属

涉及通信时，要说明能力属于哪一层：

| 层 | 负责内容 |
| --- | --- |
| `@meshcentral/control-client` | WebSocket、鉴权、心跳、重连、请求匹配、资源 API、结果归一化 |
| `@meshcentral/shared-state` | UI 共享状态、selector、React Hook、客户端到 Store 的绑定 |
| 应用功能层 | 页面查询状态、命令输出、表单状态、用户管理列表等特定业务状态 |

避免使用“shared-state 发送某消息”这种含糊表述。更准确的写法是“通过 `client.devices.list()` 请求设备列表，绑定器把结果同步到 Store”。

### API 表格包含四类信息

描述操作时建议至少写清楚：

1. 调用哪个方法；
2. 内部对应什么 action；
3. 返回或推送什么数据；
4. 业务上可以用来做什么。

如果返回值是 `unknown`，必须说明原因，并提示调用方做运行时校验。

### 区分实时状态与查询结果

文档要明确结果是否自动进入 Store。例如：

- 设备快照会进入 `devices`；
- 实时事件会进入 `events`；
- 历史事件查询不会进入 `events`；
- 命令执行结果不会进入 Store；
- 用户列表不等于当前用户 `userInfo`。

### 示例必须可复制

- 使用真实导出名称，不写不存在的伪 API；
- 包导入使用 `@meshcentral/shared-state` 或 `@meshcentral/control-client`；
- 对可选字段先检查再使用；
- 示例中创建了监听器，就展示对应的取消订阅；
- 示例中创建了绑定和客户端，就展示正确的释放顺序；
- 不在示例中记录 Token、密码或完整原始用户数据。

## 事件文档要求

新增或修改事件时，应同步检查：

- `@meshcentral/control-client` 的 `GatewayEventType`；
- `normalizeEvent()` 的 action 到领域事件映射；
- `bindGatewayClient` 的 Store 更新规则；
- `appendEvent` 是否保存、忽略或增强该事件；
- `src/types/events.type.ts` 是否提供对应原始 payload 类型；
- `docs/events.md` 的事件表格和示例。

原始事件类型与归一化领域事件必须分开说明。二者字段、稳定性和使用场景不同。

## 消息文档要求

新增客户端资源方法后，应在 `docs/messages-and-resources.md` 中记录：

- 资源入口和方法签名；
- 内部 action；
- 参数限制和默认值；
- 返回类型；
- 是否等待事件确认或执行二次验证；
- 返回结果是否自动进入 `GatewayStore`；
- 推荐的 UI 使用场景。

优先记录资源方法，而不是鼓励调用方直接使用 `client.send()`。

## 链接与源码引用

包内文档使用相对链接：

```md
[返回 README](../README.md)
[事件参考](events.md)
```

链接源码时也使用相对路径，并确保重命名文件时同步更新链接。不要链接本机绝对路径。

## 格式与校验

修改完成后，从仓库根目录运行：

```bash
pnpm exec prettier --write packages/shared-state/README.md packages/shared-state/docs/*.md
pnpm --filter @meshcentral/shared-state typecheck
pnpm --filter @meshcentral/shared-state test
```

文档本身不会被 TypeScript 编译，但类型检查和测试可以防止示例所描述的 API 与当前实现发生明显偏差。还应人工检查：

- README 中的每个文档链接都存在；
- 方法名、事件名和字段名与源码一致；
- 示例没有使用未导出的符号；
- 行为描述没有超出当前实现；
- 新增能力同时更新了 README 导航和对应专题文档。

## 维护原则

文档应描述当前代码，而不是未来计划。尚未实现的能力应放在 plan 或 todo 中，不要写成已支持功能。

当代码与文档冲突时，应先确认代码的预期行为，再在同一个变更中修正二者。对于协议版本差异，应明确标注返回值可能变化，并保留 `raw` 或 `unknown` 的运行时校验要求。
