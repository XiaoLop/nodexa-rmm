# @meshcentral/mcp

MeshCentral 的只读 MCP Server。外部 AI 客户端（Claude Desktop、Cursor、VS Code 等）通过 stdio 调用 MeshCentral 的查询能力。

协议访问由 [`@meshcentral/mcp-core`](../../packages/mcp-core/README.md) 与 [`@meshcentral/control-client`](../../packages/control-client/README.md) 完成，本包只负责 MCP 传输与命令行。

## 架构位置

```text
AI 客户端 --stdio(JSON-RPC)--> apps/mcp --mcp-core--> control-client --wss--> MeshCentral /control.ashx
                                    |
                                    +--> 会话文件 / 审计日志
```

- 不引入业务网关，MCP 进程直接建立控制通道 WebSocket。
- 不使用 MeshCentral 服务器登录密钥，也不使用固定的服务账号。
- 身份是当前用户在 jsonauth `/auth/login` 取得的**原生 MeshCentral Session**。

## 快速开始

```bash
# 1. 配置服务器地址
export MESHCENTRAL_URL=https://mesh.example.com

# 2. 登录并把原生 Session 保存到本地（0600）
pnpm mcp:login

# 3. 确认会话状态
pnpm --filter @meshcentral/mcp exec meshcentral-mcp whoami

# 4. 启动 MCP Server（AI 客户端会自己拉起，无需手动执行）
pnpm dev:mcp
```

生产形态使用打包产物：

```bash
pnpm build:mcp
node apps/mcp/dist/main.js serve
```

## 命令

| 命令 | 说明 |
| --- | --- |
| `serve` | 以 stdio 运行 MCP Server，默认命令 |
| `login` | 交互式登录，保存 MeshCentral Session Cookie |
| `logout` | 调用 `/auth/logout` 并删除本地会话文件 |
| `whoami` | 显示会话所属服务器、用户与会话文件位置 |
| `tools` | 列出可用的只读工具 |
| `call <tool>` | 在命令行直接调用某个工具 |

`call` 支持 `--input '<json>'`、`--input-file <path>`，或在非 TTY 环境下从 stdin 读取 JSON。

## 工具

| 工具 | 权限域 | 说明 |
| --- | --- | --- |
| `devices_list` | `devices:read` | 设备摘要列表，支持本地过滤与游标分页 |
| `devices_get` | `devices:read` | 单设备详情，仅返回白名单字段 |
| `groups_list` | `groups:read` | 设备组列表，可选统计设备数 |
| `events_query` | `events:read` | 历史事件查询，支持按设备/用户过滤 |
| `server_status` | `server:read` | 连接状态、账号、缓存能力位与设备计数 |

全部工具标记为 `readOnlyHint: true`。不暴露 `request()` / `send()` 原始协议透传，也不提供远程桌面、终端或文件传输能力。

## 已知限制

- `devices_list` 的 `nameContains` / `platform` 是**本地过滤**：`control-client` 的 `devices.list()` 没有服务端查询参数，因此会先取全量快照。
- `events_query` 的 `since` 也是**本地过滤**：MeshCentral 的 `events` action 不支持时间范围，服务端只会返回最近 N 条（N ≤ 200）。使用 `since` 时结果可能不完整，响应会带 `truncated: true` 与说明。
- 未命中缓存时一次设备列表请求可能较大，默认每 30 秒缓存一次；可用 `MESHCENTRAL_MCP_PAGE_SIZE` 与 `MESHCENTRAL_MCP_MAX_RESPONSE_BYTES` 收窄。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MESHCENTRAL_URL` | 必填 | 服务器地址，如 `https://mesh.example.com`、`wss://mesh.example.com/control` |
| `MESHCENTRAL_AUTH` | `session` | `session`（推荐）或 `meshauth` |
| `MESHCENTRAL_USERNAME` | - | `meshauth` 模式必填；`login` 也可读取 |
| `MESHCENTRAL_PASSWORD` | - | `meshauth` 模式必填；`login` 也可读取（不推荐） |
| `MESHCENTRAL_TOKEN` | - | `meshauth` 模式的二次验证令牌 |
| `MESHCENTRAL_AUTH_PATH` | `/auth` | jsonauth 插件基路径 |
| `MESHCENTRAL_MCP_CA` | - | 额外 CA 证书路径 |
| `MESHCENTRAL_MCP_ALLOW_INSECURE_TLS` | `false` | 关闭 TLS 校验，仅限开发 |
| `MESHCENTRAL_MCP_SESSION_FILE` | 平台配置目录 | 会话文件路径 |
| `MESHCENTRAL_MCP_AUDIT_FILE` | 平台配置目录 | 审计日志路径（NDJSON） |
| `MESHCENTRAL_MCP_PAGE_SIZE` | `50` | 默认分页大小，上限 200 |
| `MESHCENTRAL_MCP_MAX_RESPONSE_BYTES` | `256000` | 单次结果字节上限 |
| `MESHCENTRAL_MCP_CONNECT_TIMEOUT_MS` | `15000` | 建连超时 |
| `MESHCENTRAL_MCP_REQUEST_TIMEOUT_MS` | `8000` | 单请求超时 |
| `MESHCENTRAL_MCP_IDLE_DISCONNECT_MS` | `600000` | 空闲断开时间 |
| `MESHCENTRAL_MCP_KEEPALIVE_MS` | `25000` | 原生 `{action:"ping"}` 保活间隔，`0` 关闭 |
| `MESHCENTRAL_MCP_MAX_CONCURRENT_CALLS` | `8` | 并发调用上限 |
| `MESHCENTRAL_MCP_SCOPE_DEVICE_GROUPS` | - | 允许访问的设备组 ID/名称，逗号分隔 |
| `MESHCENTRAL_MCP_SCOPE_DEVICES` | - | 允许访问的设备 ID，逗号分隔 |

会话文件默认位置：

- Windows：`%APPDATA%\meshcentral-mcp\session.json`
- 其他：`$XDG_CONFIG_HOME/meshcentral-mcp/session.json`（缺省为 `~/.config/meshcentral-mcp/session.json`）

## 接入 AI 客户端

打包后把 `dist/main.js` 作为 stdio 命令注册即可。示例（Claude Desktop 风格）：

```json
{
  "mcpServers": {
    "meshcentral": {
      "command": "node",
      "args": ["D:/web/project/meshcentral-web/apps/mcp/dist/main.js", "serve"],
      "env": {
        "MESHCENTRAL_URL": "https://mesh.example.com"
      }
    }
  }
}
```

VS Code / Cursor 使用相同的 `command` + `args` + `env` 结构。不要把用户名密码写进客户端配置，只配置 `MESHCENTRAL_URL`，身份来自 `login` 保存的会话。

## 安全边界

- 凭据：`login` 只保存会话 Cookie，不保存密码；`meshauth` 模式仅作为未部署 jsonauth 时的兜底。
- 权限：MCP 能看到的设备范围等于该用户的原生 MeshCentral 权限，`MESHCENTRAL_MCP_SCOPE_*` 只能收窄，不能放宽。
- 传输：仅 stdio，不监听任何端口。
- 输出：递归剔除 `raw` 字段、按工具白名单投影、超限自动裁剪并标记 `truncated`。
- 审计：每次调用写入 NDJSON，包含工具名、参数摘要、目标设备、耗时、结果字节数与连接状态；敏感键会被脱敏。
- 会话文件：写入后权限为 `0600`；在 POSIX 上若检测到其他用户可读，直接拒绝加载。

## 排错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `SESSION_MISSING` | 本地没有会话文件 | 运行 `pnpm mcp:login` |
| `SESSION_EXPIRED` | MeshCentral 拒绝了 Cookie | 重新登录 |
| `SESSION_SERVER_MISMATCH` | 会话属于另一台服务器 | 用当前 `MESHCENTRAL_URL` 重新登录 |
| `NOT_CONNECTED` | 控制通道不可达 | 检查地址、TLS、nginx 路由 |
| `UPSTREAM_TIMEOUT` | 请求超时 | 重试或提高 `MESHCENTRAL_MCP_REQUEST_TIMEOUT_MS` |
| `INVALID_ARGUMENT` | 参数不符合 schema | 对照 `tools/list` 的 `inputSchema` |

`serve` 模式下 stdout 只承载 JSON-RPC，诊断信息一律写 stderr。
