# @meshcentral/mcp-core

MeshCentral MCP 的**能力层**。包含配置、会话、连接生命周期、查询投影、权限收窄、审计和全部只读工具定义。

## 边界

```text
apps/mcp（传输层）  →  packages/mcp-core（能力层）  →  @meshcentral/control-client（协议层）
```

三条硬约束，由根 `eslint.config.mjs` 强制：

1. 本包**不得**依赖 `@modelcontextprotocol/sdk`。工具定义使用 zod 描述，由 `apps/mcp` 转换成 MCP 工具。
2. 本包**不得**依赖 React、Expo、`@meshcentral/shared-state`、`@meshcentral/relay`。
3. 本包不包含中文 UI 文案（`LANGUAGE_NEUTRAL_PACKAGE_SOURCES` 规则），错误信息与工具描述统一使用英文。

## 模块

| 目录 | 职责 |
| --- | --- |
| `config/` | 环境变量解析、URL 归一化、平台默认路径 |
| `session/` | jsonauth 登录、Cookie 提取、会话文件读写与权限校验 |
| `connection/` | `ws` + Cookie 握手、延迟连接、空闲断开、并发限制、错误映射 |
| `query/` | 递归剔除 `raw`、字段投影、字节预算裁剪、键集分页、快照缓存 |
| `authz/` | 设备/分组白名单收窄 |
| `audit/` | NDJSON 审计与敏感字段脱敏 |
| `tools/` | 5 个只读工具与统一的 `ToolDefinition` 契约 |
| `runtime.ts` | 组合根：配置 → 审计 → 会话 → 连接 → 工具执行 |

## 关键契约

```ts
export interface ToolDefinition {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: z.ZodType;
  readonly annotations: { readOnlyHint: true; idempotentHint: true; openWorldHint: false };
  readonly scope: 'devices:read' | 'groups:read' | 'events:read' | 'server:read';
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}
```

`ToolDefinition` 不出现任何 MCP 类型，因此同一个工具集可以被 CLI、未来的 HTTP 传输或其他宿主复用。

执行约定：

1. `runtime.callTool()` 先做 zod 校验，失败返回 `INVALID_ARGUMENT` 并附带字段路径。
2. 工具内部只调用 `control-client` 的既有资源方法，不直接拼装协议报文。
3. 结果统一经过 `fitToBudget()`，超限时裁剪并设置 `truncated`。
4. 成功与失败都会写审计；`UNKNOWN_TOOL` 也会记录。

## 鉴权模式

| 模式 | 凭据来源 | 说明 |
| --- | --- | --- |
| `session`（默认） | `POST /auth/login` 返回的 `xid` / `xid.sig` | 只保存 Cookie，不保存密码；会话文件 0600 |
| `meshauth` | `MESHCENTRAL_USERNAME` / `MESHCENTRAL_PASSWORD` | 兼容未部署 jsonauth 的环境，凭据常驻环境变量 |

`session` 模式连接 `control.ashx` 时通过 WebSocket 握手头携带 Cookie；`meshauth` 模式同时设置 `x-meshauth` 请求头与同名查询参数。

不使用 `getAccessToken`：`control-client` 的 `{ type: 'authenticate', token }` 是网关场景的私有消息，MeshCentral 原生控制通道不识别它。

## 测试

```bash
pnpm --filter @meshcentral/mcp-core test
```

覆盖：URL 归一化、环境变量边界、键集分页、`raw` 剔除、字节预算、作用域过滤、脱敏、会话文件权限、工具执行与审计。
