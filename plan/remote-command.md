# 远程命令执行功能实施计划

## 1. 目标与约束

基于现有 `GatewayClient` 控制 WebSocket 和 MeshCentral `runcommands` 消息实现远程命令执行，不新增 HTTP、SSE、第二条控制 WebSocket 或独立任务服务。

本计划覆盖：

1. 单设备命令执行窗口。
2. 自动、Shell 和 PowerShell 执行方式。
3. 接收并展示当前 WebSocket 返回的命令输出、错误、退出码和执行时长。
4. 停止本地等待，以及在协议明确支持时取消远端命令。
5. 批量设备命令执行和逐设备结果汇总。
6. 会话内命令历史和可复用命令模板。
7. 危险命令确认、权限状态和审计事件展示。
8. 控制客户端、Web 页面和协议兼容测试。

所有命令提交、结果接收、连接状态和审计事件都复用当前 `GatewayClient` 实例。命令执行不得创建 Relay `p=1` 会话；该协议保留给后续交互式远程终端。

## 2. 非目标与能力边界

本期不实现：

- 交互式终端、ANSI 转义序列、终端尺寸同步和持续键盘输入。
- 新增业务网关 REST API、SSE 流或持久化任务数据库。
- 浏览器断开或关闭后继续恢复命令输出。
- 在没有服务端协议支持时伪造 stdout/stderr 分离、退出码或远端取消结果。
- 自动重发状态不明的命令。
- 在浏览器长期保存完整命令输出、密码、令牌或其他敏感参数。

当前协议能否提供流式输出、标准错误、退出码和远端进程取消，必须以真实 WebSocket 消息为准。缺失的字段应显示“网关未提供”，不得通过文本内容或请求成功状态推断。

## 3. 已有基础

当前仓库已具备以下基础：

- `CommandsResource.run()` 能通过当前控制 WebSocket 发送 `action: "runcommands"`。
- 请求包含唯一 `responseid`，并支持多个 `nodeids`、Shell 类型、运行身份和结果回复开关。
- `GatewayClient` 在处理请求匹配前发布每个原始包到 `message` 通道。
- `GatewayClient` 发布连接状态，可以识别连接、断线和重连。
- `runcommands` 审计消息已能标准化为 `commandExecution` 事件。
- 设备页面已有“执行指令”入口和批量设备选择状态。
- 现有批量设备操作弹窗已经形成逐设备状态、部分失败和失败项保留模式。

当前缺口：

- `CommandSubmission` 只有 `requestId` 和原始响应，没有执行状态模型。
- `RequestManager` 在第一条匹配响应到达后完成请求，不适合持续接收多条输出。
- 没有专用的 `runcommands` 消息解析器和批量结果归并器。
- 没有真实消息样本证明输出是流式还是一次性返回。
- 没有远端取消 action、命令进程 ID 或取消确认模型。
- 设备和用户权限尚未形成可直接用于命令入口的前端授权模型。

## 4. 阶段 0：确认真实 WebSocket 协议

实现 UI 前，使用测试环境记录以下 `runcommands` 场景的原始 WebSocket 消息：

1. Linux 或 macOS Shell 命令成功。
2. Windows PowerShell 命令成功。
3. 命令返回非零退出码。
4. 命令产生较长输出。
5. 命令同时产生标准输出和标准错误。
6. 单设备命令超时或 Agent 无响应。
7. 多设备命令部分成功、部分失败或离线。
8. 命令运行期间控制 WebSocket 断开。
9. 当前服务端可能支持的命令取消消息。

样本保存为脱敏测试夹具，不保存设备密钥、用户名、访问令牌、命令中的凭据或敏感输出。建议放在：

```text
packages/control-client/src/testing/fixtures/commands/
  single-success.json
  single-failure.json
  batch-mixed.json
  streamed-output.json
```

需要从样本确认：

| 能力          | 需确认字段                             | 无字段时的降级行为                     |
| ------------- | -------------------------------------- | -------------------------------------- |
| 请求关联      | `responseid`、`tag`                    | 无法稳定关联时只支持串行命令           |
| 设备关联      | `nodeid` 或等价字段                    | 批量结果不可可靠实现                   |
| 输出          | `output`、`result`、`value` 或等价字段 | 仅显示网关返回的最终原始结果摘要       |
| 流式输出      | 序号、分块标志、完成标志               | 命令结束后一次性展示                   |
| stdout/stderr | 流类型字段                             | 统一显示为“命令输出”                   |
| 退出码        | 数值退出码字段                         | 显示“未提供”                           |
| 完成状态      | 完成标志或最终消息类型                 | 以协议确认的最终响应为准，否则等待超时 |
| 远端取消      | 命令 ID、取消 action、确认响应         | 只允许停止本地等待                     |

阶段 0 的完成标准是形成一份消息字段映射，并将至少单设备成功、失败和批量混合结果固化为自动化测试夹具。

## 5. 控制客户端设计

### 5.1 执行状态模型

在 `packages/control-client/src/types.ts` 增加：

```ts
export type CommandShell = 'auto' | 'shell' | 'powershell';

export type CommandExecutionStatus =
  'submitting' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timedOut' | 'unknown';

export interface CommandOutputChunk {
  sequence: number;
  stream: 'stdout' | 'stderr' | 'output' | 'system';
  content: string;
  receivedAt: number;
}

export interface CommandDeviceResult {
  deviceId: string;
  status: CommandExecutionStatus;
  output: CommandOutputChunk[];
  exitCode?: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
  durationMs?: number;
}

export interface CommandBatchSnapshot {
  requestId: string;
  status: CommandExecutionStatus;
  results: CommandDeviceResult[];
}
```

`cancelled` 只能用于服务端已确认远端取消的情况。仅停止浏览器等待时使用独立的本地状态或结果原因，例如 `trackingStopped: true`，避免误导用户。

### 5.2 命令消息解析器

新增 `packages/control-client/src/protocol/commandMessages.ts`，职责保持纯函数化：

- 识别顶层消息以及 `data`、`payload`、`message`、`event` 包裹。
- 识别 `runcommands` 类型或阶段 0 确认的等价消息。
- 提取 `responseid`、`nodeid`、输出、流类型、退出码、错误和完成状态。
- 对未知字段保留 `raw`，但不直接暴露给默认 UI。
- 不根据输出文本猜测执行成功、stderr 或退出码。
- 为缺少服务端序号的消息按接收顺序生成本地序号。

解析器建议输出统一结构：

```ts
export interface NormalizedCommandMessage {
  requestId?: string;
  deviceId?: string;
  kind: 'accepted' | 'output' | 'completed' | 'failed' | 'cancelled' | 'unknown';
  stream?: 'stdout' | 'stderr' | 'output' | 'system';
  content?: string;
  exitCode?: number;
  error?: string;
  raw: unknown;
}
```

### 5.3 CommandExecution 跟踪器

新增 `packages/control-client/src/resources/CommandExecution.ts`，由它维护单次提交的生命周期：

1. 创建唯一 `responseid`。
2. 在发送前订阅 `client.on('message')` 和 `client.on('connection')`。
3. 发送 `runcommands` 请求。
4. 按 `responseid + nodeid` 归并结果。
5. 为每台目标设备维护独立状态和输出。
6. 在所有设备结束、用户停止跟踪、超时或对象释放时清理监听器和计时器。
7. 通过订阅接口发布不可变快照。

公开接口建议为：

```ts
export interface CommandExecutionHandle {
  readonly requestId: string;
  getSnapshot(): CommandBatchSnapshot;
  subscribe(listener: (snapshot: CommandBatchSnapshot) => void): () => void;
  stopTracking(): void;
  cancelRemote(): Promise<void>;
  completed: Promise<CommandBatchSnapshot>;
}
```

`stopTracking()` 只停止本地监听和等待。`cancelRemote()` 仅在阶段 0 确认服务端支持后开放；否则抛出明确的“不支持远端取消”错误。

### 5.4 CommandsResource API

保留现有 `run()`，避免破坏调用方；新增面向 UI 的高级接口：

```ts
client.commands.execute(deviceIds, command, {
  shell: 'powershell',
  runAsUser: 0,
  timeoutMs: 60_000,
});
```

执行顺序必须是先注册监听器，再发送消息。不能先 `await run()` 再开始监听，因为提交响应或结果消息可能立即到达。

如果现有 `request()` 会把首条命令结果当作提交确认，则 `execute()` 应直接使用受控发送流程，或者扩展请求管理器以支持“持续响应”；不得让同一条消息被两个不一致的状态机分别解释。

### 5.5 连接中断规则

- 发送前断线：标记为 `failed`，允许用户重新执行。
- 消息已经发出但尚未收到确认时断线：标记为 `unknown`。
- 执行中断线：所有未结束设备标记为 `unknown`。
- 重连后不自动重发命令。
- 已收到的输出和完成结果继续保留在当前页面内存中。
- 用户可手动创建新的执行，不复用旧 `responseid`。

命令执行不是幂等操作，状态未知时自动重发可能造成重复关机、重复修改配置或重复删除数据。

### 5.6 内存和输出限制

为防止长输出拖慢浏览器：

- 每台设备默认最多保留 1 MiB 或 10,000 个输出块，以先达到者为准。
- 超出限制后丢弃最早内容，并插入一次“输出已截断”系统消息。
- 单次渲染只拼接当前查看设备的输出。
- 批量列表只展示输出摘要，不在表格中渲染完整输出。
- 执行结束或弹窗关闭后释放监听器，历史记录只保存命令元数据和结果摘要。

## 6. 单设备命令窗口

新增 `apps/web/src/components/CommandExecutionModal.tsx`，从设备操作菜单打开。

### 6.1 输入区

- 展示设备名称、平台、在线状态和设备 ID 摘要。
- 执行方式使用分段选择：自动、Shell、PowerShell。
- 自动模式根据设备平台解析：Windows 使用 PowerShell，其他桌面平台使用 Shell。
- 无法识别平台时保留自动模式，但提交前明确展示最终执行方式。
- 使用多行命令输入框，支持 `Ctrl+Enter` 或 `Cmd+Enter` 提交。
- 提供运行身份和超时时间；选项必须与服务端实际支持的 `runAsUser` 一致。
- 连接断开、设备离线、命令为空或正在提交时禁用执行按钮。

移动平台或不支持远程命令的平台应禁用入口，并显示明确原因。

### 6.2 输出区

- 使用等宽字体和稳定高度的滚动区域。
- 按接收顺序追加 stdout、stderr、普通输出和系统消息。
- stdout/stderr 只有协议明确区分时才使用不同标识。
- 默认自动滚动到底部；用户向上滚动后暂停自动跟随，并提供“回到底部”。
- 支持复制当前输出和清空本地显示；清空不影响远端执行。
- 输出不得通过 `dangerouslySetInnerHTML` 渲染。

状态栏展示：

- 提交中、执行中、成功、失败、超时、状态未知或已停止跟踪。
- 开始时间和浏览器测得的执行时长。
- 网关提供的退出码；没有则显示“未提供”。
- 输出截断提示和当前连接状态。

### 6.3 关闭与停止

执行中关闭弹窗时显示确认：

- “继续在当前页面后台等待”。
- “停止等待结果”。
- 只有服务端支持远端取消时才显示“终止远端命令”。

第一阶段若不实现页面级后台管理器，则执行中只能阻止直接关闭，或者明确停止跟踪。不得在弹窗卸载后遗留 WS 监听器。

## 7. 批量命令执行

在设备页面批量操作菜单增加“执行命令”，打开 `BatchCommandExecutionModal`。

### 7.1 提交规则

- 基于提交时最新设备快照重新解析选择项。
- 默认跳过离线、已删除、平台不支持或无权限设备。
- Shell 模式必须适用于所有目标设备。
- 选择“自动”时按设备平台分组，分别发送 Shell 和 PowerShell 请求；每组使用独立 `responseid`，UI 汇总为一个本地批次。
- 用户强制选择 PowerShell 或 Shell 时，提交前提示混合平台风险。
- 同一批次不得因为单台设备失败而提前结束其他设备跟踪。

由于一次 `runcommands` 请求只有一个 `type`，混合平台的自动模式不能在同一请求中为每台设备选择不同 Shell，必须拆成最多两个请求。

### 7.2 结果表格

建议列：

| 列       | 内容                                           |
| -------- | ---------------------------------------------- |
| 设备     | 名称和在线状态                                 |
| 平台     | 当前设备平台                                   |
| 执行方式 | Shell 或 PowerShell                            |
| 状态     | 等待、执行中、成功、失败、超时、状态未知、跳过 |
| 退出码   | 网关未提供时显示“—”                            |
| 耗时     | 本地开始至结束时间                             |
| 输出摘要 | 第一行或截断摘要                               |
| 操作     | 查看完整输出、复制、重新执行单台               |

顶部展示总数、运行中、成功、失败、跳过和状态未知数量。批量执行期间保留设备选择；结束后不自动清空失败和未知项。

## 8. 命令模板与历史记录

### 8.1 第一阶段：会话内历史

先使用 React 上层状态或独立的内存管理器保存最近 20 条记录：

```ts
interface CommandHistoryEntry {
  id: string;
  command: string;
  shell: CommandShell;
  targetCount: number;
  createdAt: number;
  summary: 'succeeded' | 'failed' | 'mixed' | 'unknown';
}
```

- 不保存完整输出。
- 页面刷新或退出登录后清除。
- 相同命令连续执行时合并或将最新记录置顶。
- 提供再次填入编辑器，不直接自动执行。

### 8.2 模板

模板至少包含名称、命令、Shell 类型、说明和危险等级提示。第一阶段使用代码内置模板或会话内自定义模板，待认证和安全存储方案完成后再考虑持久化。

内置模板应为只读、低风险诊断命令，例如主机名、当前用户、网络信息和磁盘空间。不要内置关机、删除、格式化磁盘、账户修改或下载后执行脚本等高风险模板。

### 8.3 敏感信息处理

命令可能包含密码、令牌、连接字符串和私钥。历史与模板功能应：

- 对明显敏感参数提示“不建议保存”。
- 默认不自动保存包含常见密钥标记的命令。
- 退出登录时清空会话历史和自定义模板。
- 不把完整命令写入前端日志、诊断消息或错误上报。

## 9. 危险命令确认

前端危险命令检测只用于提示，不能代替服务端授权或策略判断。

### 9.1 风险分类

建立纯函数 `classifyCommandRisk(command, shell)`，返回：

```ts
type CommandRisk = 'normal' | 'sensitive' | 'dangerous';
```

检测规则覆盖常见高风险意图：

- 关机、重启和强制结束关键进程。
- 删除、格式化、分区和递归修改权限。
- 用户、组、密码和远程访问配置修改。
- 防火墙、网络和安全策略修改。
- 下载后直接执行、编码脚本执行和绕过执行策略。

规则不得宣称完整，也不得仅依赖简单子串阻止提交。应避免将 `echo "rm -rf"` 一类纯文本示例误判为必然执行，但宁可要求额外确认，也不能把前端判定当作授权结论。

### 9.2 确认交互

- `normal`：正常提交。
- `sensitive`：展示命令、设备数量和执行方式，要求二次确认。
- `dangerous`：要求输入目标设备名称或固定确认短语，并说明操作不可自动撤销。
- 批量危险命令必须突出目标数量和混合平台情况。
- 确认后仍由当前 WebSocket 将原始命令提交给服务端，服务端可继续拒绝。

## 10. 权限与审计

命令执行对应 `MESHRIGHT_REMOTECOMMAND`。前端权限状态用于改善体验，最终授权必须由当前 WebSocket 后端执行。

在权限模型尚未接入前：

- 不能把“设备在线”视为“有权执行命令”。
- 服务端拒绝必须显示为权限失败，不应归类为网络错误。
- Todo 中“权限校验完成”只能在服务端通过当前 WS 对每次请求完成校验后标记为完成。

审计优先复用 MeshCentral 通过当前 WS 推送的 `runcommands`、`agentlog` 或等价事件。前端负责：

- 将命令执行事件显示在实时事件页面。
- 用 `responseid` 或服务端关联字段关联当前执行与审计事件。
- 不把“收到审计事件”当作命令执行成功。
- 默认只展示命令摘要，原始数据继续经过现有脱敏逻辑。

若当前服务端不产生包含操作者、目标、时间和结果的审计事件，则前端无法单独补齐可信审计记录，该项保持未完成并记录为服务端协议缺口。

## 11. Web 状态组织

单设备窗口状态保留在组件内；批量执行和需要在弹窗关闭后继续跟踪的任务使用页面级 `CommandExecutionManager`。

建议新增：

```text
apps/web/src/features/commands/
  CommandExecutionManager.ts
  commandHistory.ts
  commandRisk.ts
  commandShell.ts
  types.ts
```

职责划分：

- `control-client`：协议解析、消息关联、执行状态机、连接中断和资源释放。
- `features/commands`：设备平台分组、会话历史、危险等级和多个执行句柄的页面级汇总。
- React 组件：输入、确认、渲染、复制和用户操作。
- 共享状态：继续提供设备、连接和事件，不保存完整命令输出。

完整输出不进入 `packages/shared-state`，避免所有页面订阅大文本并造成不必要的渲染。

## 12. 详细实施步骤

### 阶段 1：协议解析和状态机

1. 收集并脱敏真实 `runcommands` WS 消息。
2. 新增命令消息标准化类型和解析器。
3. 为单设备成功、失败、未知字段和批量混合消息补测试。
4. 实现 `CommandExecution` 跟踪器。
5. 验证监听器先于发送注册，且首条响应不会丢失。
6. 验证完成、超时、断线和停止跟踪都会释放监听器。

### 阶段 2：单设备 MVP

1. 新增 `CommandExecutionModal`。
2. 接入设备菜单“执行指令”。
3. 实现平台自动选择 Shell。
4. 展示输出、状态、退出码和本地耗时。
5. 实现断线未知状态、输出截断和停止等待提示。
6. 增加危险命令二次确认。

### 阶段 3：批量命令

1. 在批量操作菜单增加命令入口。
2. 自动模式按平台拆分请求。
3. 实现本地批次汇总和逐设备结果表格。
4. 支持查看完整输出和失败项单独重试。
5. 覆盖离线跳过、部分成功、请求超时和连接中断。

### 阶段 4：历史、模板、权限和审计

1. 增加会话内最近命令。
2. 增加低风险内置模板和会话内自定义模板。
3. 接入设备命令权限状态；服务端继续做最终校验。
4. 将命令执行和审计事件通过关联字段联系起来。
5. 根据真实协议决定是否开放远端取消。

## 13. 测试计划

### 13.1 控制客户端单元测试

- `runcommands` 请求包含正确的 `nodeids`、`cmds`、`type`、`runAsUser`、`reply` 和 `responseid`。
- 消息解析器兼容真实样本中的包裹层和字段名称。
- 无关 `responseid` 或 `nodeid` 的消息不会污染当前执行。
- 提交确认、输出和完成消息按顺序更新状态。
- 多设备结果按设备 ID 独立归并。
- 缺少 stdout/stderr、退出码或完成字段时正确降级。
- 超时将未结束设备标记为 `timedOut`。
- 连接断开将已发送但未结束设备标记为 `unknown`。
- 停止跟踪、完成和异常路径均移除监听器和计时器。
- 输出上限生效且只插入一次截断提示。
- 不支持取消时 `cancelRemote()` 返回明确错误。

### 13.2 Web 功能测试

- 单设备菜单能打开正确设备的命令窗口。
- Windows 自动选择 PowerShell，其他支持平台自动选择 Shell。
- 离线、断线、命令为空和执行中状态正确禁用提交。
- 输出内容按纯文本渲染，不执行 HTML。
- 危险命令触发相应确认，取消确认不会发送请求。
- 执行中关闭弹窗不会静默遗留监听器。
- 批量自动模式按平台拆分请求并正确汇总。
- 单台失败不影响其他设备完成。
- 状态未知的命令不会自动重试。
- 历史只保存在会话内，重新填入命令不会自动执行。

### 13.3 WebSocket 集成测试

使用 `FakeWebSocket` 模拟：

1. 提交确认后返回单条最终结果。
2. 提交后返回多条输出和完成消息。
3. 多设备结果乱序到达。
4. 无关事件和其他命令结果穿插到达。
5. 提交前、提交后和执行中断线。
6. 重连成功但旧命令不被重发。
7. 服务端拒绝权限和无效 Shell 类型。

### 13.4 人工验证

- Windows PowerShell 和 Linux Shell 各执行一次低风险诊断命令。
- 验证长输出、非零退出、无输出和超时命令。
- 验证不同平台混合批量执行。
- 在执行期间手动断开网络，确认状态为未知且不自动重发。
- 验证实时事件页面能收到服务端产生的命令审计事件。

## 14. 验收标准

### 单设备执行

- 在线且有权限的设备可以从操作菜单打开命令窗口并提交命令。
- 自动、Shell 和 PowerShell 模式发送正确的 `type`。
- UI 展示当前 WS 实际提供的输出、错误和退出码；缺失字段不伪造。
- 执行时长从本地提交开始计算，并在结束后停止更新。
- 断线后未完成命令显示为状态未知，且不会自动重发。

### 批量执行

- 可对选中设备提交命令，并展示逐设备状态和结果。
- 自动模式能正确处理 Windows 与非 Windows 混合设备。
- 离线和不支持设备明确标记为跳过。
- 部分失败不会覆盖成功设备结果。

### 停止与取消

- 用户可以停止本地等待，UI 明确提示远端命令可能仍在运行。
- 只有收到服务端取消确认后才显示“远端命令已取消”。
- 若当前 WS 协议不支持远端取消，Todo 中“支持取消正在运行的命令”保持 `[~]`，并注明只支持停止跟踪。

### 安全与审计

- 敏感和危险命令具有相应确认流程。
- 前端不把权限按钮状态当作最终授权。
- 服务端拒绝能区分权限、参数、连接和超时错误。
- 当前 WS 推送的命令审计事件能够在实时事件页查看并保持脱敏。
- 若服务端缺少可信审计字段，Todo 中审计项不得标记完成。

### 工程质量

- 真实消息样本已脱敏并覆盖解析器测试。
- 控制客户端和 Web 测试覆盖成功、失败、批量、超时、断线和资源释放。
- 通过 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 和 `pnpm format:check`。

## 15. Todo 状态更新规则

建议按真实能力更新 `todo/README.md`：

- 单设备窗口可用并完成错误状态后，标记单设备执行为 `[x]`。
- Shell 自动选择和手动覆盖验证通过后，标记执行方式为 `[x]`。
- 只有协议实际提供相应数据时，实时输出、stderr 和退出码才标记为 `[x]`；部分支持使用 `[~]`。
- 停止本地等待但不能终止远端进程时，取消项标记为 `[~]`。
- 批量逐设备结果稳定归并后，批量执行标记为 `[x]`。
- 会话内历史和模板完成但尚未安全持久化时，模板与历史标记为 `[~]`。
- 前端确认完成但服务端权限或审计不完整时，安全项保持 `[~]` 或 `[ ]`。

## 16. 推荐实施顺序

1. 获取真实 `runcommands` WebSocket 样本并确认字段映射。
2. 实现纯函数命令消息解析器和夹具测试。
3. 实现命令执行跟踪器、连接中断状态和资源释放测试。
4. 实现单设备命令窗口及设备菜单接入。
5. 实现危险命令确认和会话内历史。
6. 实现批量平台分组、逐设备结果和失败重试。
7. 接入权限状态和审计事件关联。
8. 根据服务端实际能力实现远端取消，或保留停止跟踪降级方案。
9. 执行完整质量检查并同步 Todo 状态。
