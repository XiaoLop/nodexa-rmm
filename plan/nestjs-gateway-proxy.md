# NestJS MeshCentral Gateway 代理实施计划

## 1. 目标与约束

在现有 pnpm + Turborepo 工作区的 `apps` 目录中新增 NestJS Gateway，统一代理 Web 当前依赖的四类 MeshCentral 入口：

1. `POST /api/login`：转发账号密码登录，并将 MeshCentral 登录结果转换为稳定的 JSON 语义。
2. `WS /api/control.ashx`：透明代理控制 WebSocket。
3. `WS /api/meshrelay.ashx`：透明代理终端、文件和远程桌面 Relay WebSocket。
4. `GET/HEAD /api/meshagents`：流式代理 Agent 安装包和安装脚本下载。

本期采用“透明 MeshCentral Cookie”模式：浏览器继续持有 MeshCentral 返回的 `HttpOnly` Cookie，Gateway 负责 Cookie 属性重写和后续请求转发，不引入 Redis、自建用户会话或业务数据库。

必须遵守以下约束：

- 浏览器只访问同源 `/api` 地址，不直接访问 MeshCentral。
- MeshCentral 继续负责最终认证、授权、设备状态和 Relay 会话。
- Gateway 不保存用户名、密码、MFA 令牌或 MeshCentral Cookie。
- 控制和 Relay WebSocket 必须透明转发文本帧、二进制帧、关闭码和查询参数。
- Agent 下载必须使用流式转发，不将完整文件读入 Node.js 内存。
- 不解析或修改 `control.ashx` 与 `meshrelay.ashx` 的业务消息。
- 未验证的 MeshCentral HTML 文案不得作为唯一的登录成功或失败依据。
- 日志不得记录密码、完整 Cookie、`auth`、`rauth`、登录令牌或下载 URL 中的敏感参数。

## 2. 非目标与能力边界

本期不实现：

- Redis 或数据库会话存储。
- Gateway 自有账号、密码、角色或权限体系。
- MeshCentral Cookie 的服务端托管和换发。
- OIDC、SAML、LDAP、MFA 挑战页面和忘记密码流程。
- 告警规则、通知、审计归档或历史数据持久化。
- 对控制消息、Relay 帧或 Agent 安装包进行内容转换。
- MeshAgent 接入流量代理；MeshAgent 仍直接连接 MeshCentral。
- 多个 MeshCentral 实例的租户路由和故障切换。

透明 Cookie 模式可以改善同源部署和登录错误语义，但浏览器会继续依赖 MeshCentral Cookie 的生命周期。后续若需要独立会话撤销、Cookie 隔离或多实例 Gateway，再单独规划“Gateway 托管上游 Cookie + Redis 会话”。

## 3. 当前基础与缺口

### 3.1 已有基础

当前 Web 已统一使用以下同源地址：

```text
POST /api/login
WS   /api/control.ashx
WS   /api/meshrelay.ashx
GET  /api/meshagents
```

相关实现：

- `apps/web/src/config/gateway.ts` 集中生成登录、控制、Relay 和 Agent 下载地址。
- `GatewayProvider` 登录时发送 `application/x-www-form-urlencoded`，随后连接控制 WebSocket 验证会话。
- `GatewayClient` 已处理认证拒绝、连接超时、心跳和重连。
- `@meshcentral/relay` 已通过 `meshrelay.ashx` 承载文件、终端和远程桌面协议。
- Vite 开发服务器当前通过 `/api` 代理目标 MeshCentral，并启用了 WebSocket 和 Cookie 域重写。

### 3.2 当前缺口

- 生产环境没有正式的 `/api` 代理服务。
- `/login` 返回 HTML，前端只能先看 HTTP 状态，再依赖控制 WebSocket 判断认证是否成功。
- Vite 代理配置中存在开发目标地址，不适合作为生产配置来源。
- 没有统一的上游连接超时、代理错误码、Origin 检查和日志脱敏。
- 没有覆盖 Cookie 重写、WebSocket Upgrade、二进制帧和 Range 下载的自动化测试。
- 没有 Gateway 的健康检查、优雅关闭和生产部署说明。

## 4. 总体架构

```text
Browser
  ├── POST /api/login
  ├── WS   /api/control.ashx
  ├── WS   /api/meshrelay.ashx
  └── GET  /api/meshagents?...
          │
          ▼
NestJS Gateway
  ├── Login adapter
  ├── HTTP streaming proxy
  └── WebSocket upgrade proxy
          │
          ▼
MeshCentral
  ├── /login
  ├── /control.ashx
  ├── /meshrelay.ashx
  └── /meshagents
```

生产环境中 React 静态资源和 Gateway 应由同一个公网 Origin 提供：

```text
https://console.example.com/                  -> React 静态资源
https://console.example.com/api/login         -> NestJS Gateway
wss://console.example.com/api/control.ashx    -> NestJS Gateway
wss://console.example.com/api/meshrelay.ashx  -> NestJS Gateway
https://console.example.com/api/meshagents    -> NestJS Gateway
```

Gateway 到 MeshCentral 使用服务端配置的固定 HTTPS/WSS 地址，不接受客户端传入任意上游地址。

## 5. 项目脚手架

### 5.1 目录结构

新增应用：

```text
apps/gateway/
  package.json
  tsconfig.json
  tsconfig.build.json
  nest-cli.json
  src/
    main.ts
    app.module.ts
    config/
      gateway-config.ts
      gateway-config.spec.ts
    health/
      health.controller.ts
    login/
      login.controller.ts
      login.service.ts
      login.types.ts
      login.service.spec.ts
    proxy/
      meshcentral-proxy.service.ts
      proxy-errors.ts
      proxy-logging.ts
      proxy-logging.spec.ts
  test/
    fake-meshcentral.ts
    gateway.e2e-spec.ts
```

`apps/gateway` 使用仓库根部的 TypeScript、ESLint、Prettier 和 Turbo 约定，不生成独立锁文件。

### 5.2 依赖建议

运行依赖：

```text
@nestjs/common
@nestjs/core
@nestjs/platform-express
http-proxy
reflect-metadata
rxjs
ws
```

开发依赖：

```text
@nestjs/cli
@nestjs/testing
@types/express
@types/http-proxy
supertest
```

选择 `http-proxy` 的原因：HTTP 请求保持流式传输，并能直接处理 Node.js HTTP Server 的 `upgrade` 事件。NestJS `@WebSocketGateway()` 不用于透明代理，因为它更适合终止并处理应用自己的 WebSocket 协议。

### 5.3 Workspace 脚本

`apps/gateway/package.json` 至少提供：

```json
{
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "lint": "eslint src test",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

根脚本新增便捷命令：

```text
pnpm dev:gateway
```

现有 `turbo dev/build/lint/typecheck/test` 自动纳入新应用。

## 6. 配置设计

Gateway 只从服务端环境变量读取上游配置：

```text
PORT=3000
MESH_CENTRAL_BASE_URL=https://mesh.example.com
MESH_CENTRAL_DOMAIN_PATH=/
GATEWAY_PUBLIC_ORIGIN=https://console.example.com
GATEWAY_TRUST_PROXY=1
GATEWAY_UPSTREAM_TIMEOUT_MS=10000
GATEWAY_LOGIN_VALIDATION_TIMEOUT_MS=5000
GATEWAY_WS_IDLE_TIMEOUT_MS=0
GATEWAY_TLS_REJECT_UNAUTHORIZED=true
```

要求：

- `MESH_CENTRAL_BASE_URL` 必须为 `https:`，仅本地测试可显式允许 `http:`。
- `MESH_CENTRAL_DOMAIN_PATH` 规范化为以 `/` 开头、以 `/` 结尾的路径。
- 禁止上游 URL 包含用户名、密码、查询参数或片段。
- 生产环境缺少上游地址或公网 Origin 时启动失败。
- `GATEWAY_TLS_REJECT_UNAUTHORIZED=false` 只允许开发环境使用，并在启动日志中输出明确警告。
- 启动日志只能输出脱敏后的 Origin、域路径和超时，不输出 Cookie 或凭据。

上游地址拼接必须使用 `URL` API，不能通过字符串替换构造：

```text
<base>/<domain>/login
<base>/<domain>/control.ashx
<base>/<domain>/meshrelay.ashx
<base>/<domain>/meshagents
```

## 7. `/api/login` 登录代理

### 7.1 输入契约

第一阶段继续兼容当前 Web 表单请求：

```http
POST /api/login
Content-Type: application/x-www-form-urlencoded

action=login&username=<username>&password=<password>
```

Gateway 必须限制：

- 只允许 `POST`。
- 只接受 `application/x-www-form-urlencoded`。
- 用户名和密码必须为字符串并设置合理长度上限。
- 请求体设置较小上限，例如 16 KiB。
- 不在 ValidationPipe、异常详情或访问日志中输出请求体。

### 7.2 上游转发

`LoginService` 使用 Node.js `fetch`/Undici 向 MeshCentral `/login` 发起请求：

- 原样发送 MeshCentral 需要的表单字段。
- 设置连接和总响应超时。
- 禁止自动跟随到任意外部 Origin。
- 收集上游全部 `Set-Cookie`，不得用逗号错误合并多个 Cookie。
- HTML 响应只用于有限的兼容诊断，不能把某段文案作为唯一判据。

### 7.3 登录结果判定

推荐按两个阶段实现。

阶段一保持当前可靠链路：

1. `/api/login` 转发上游状态和重写后的 `Set-Cookie`。
2. 前端收到成功候选后连接 `/api/control.ashx`。
3. 只有控制通道完成认证后，前端才进入受保护页面。
4. 控制通道返回 `noauth` 或关闭时显示认证失败。

阶段二增加结构化登录结果：

1. Gateway 收到上游 Cookie 后，使用这些 Cookie 创建一次短期 `control.ashx` 验证连接。
2. 收到目标版本已确认的 `serverinfo`、`userinfo` 或认证成功消息后返回成功 JSON。
3. 收到 `action: close/cause: noauth`、`tokenrequired` 或明确认证错误时返回对应错误码。
4. 验证连接在得出结论后立即关闭，不进入资源同步。
5. 超时或未知响应返回网关/协议错误，不猜测为密码错误。

稳定响应建议：

```ts
interface LoginSuccessResponse {
  authenticated: true;
  username?: string;
}

interface LoginErrorResponse {
  authenticated: false;
  code:
    | 'INVALID_CREDENTIALS'
    | 'MFA_REQUIRED'
    | 'RATE_LIMITED'
    | 'UPSTREAM_UNAVAILABLE'
    | 'UPSTREAM_TIMEOUT'
    | 'UPSTREAM_PROTOCOL_ERROR';
  message: string;
  retryable: boolean;
}
```

在阶段二协议样本完成前，不把“存在 `Set-Cookie`”等同于认证成功。

### 7.4 Cookie 重写

Gateway 将 MeshCentral Cookie 返回浏览器时：

- 移除上游内部 `Domain`，生成当前公网域的 Host-only Cookie。
- 将 `Path` 重写为 `/api`，确保登录、控制和 Relay 路径均可携带 Cookie。
- 生产环境强制保留或增加 `HttpOnly` 和 `Secure`。
- 默认使用 `SameSite=Lax`；若实际 SSO 流程要求跨站回调，必须单独验证后调整。
- 保留 Cookie 的值、签名、有效期和 MeshCentral 使用的其他必要属性。
- 不在应用日志或错误响应中输出重写前后的 Cookie。

应使用可靠的 Set-Cookie 解析/序列化方式，不通过简单的 `split(',')` 处理，因为 `Expires` 属性本身包含逗号。

## 8. `/api/control.ashx` WebSocket 代理

Gateway 在底层 HTTP Server 上监听 `upgrade`：

```text
/api/control.ashx?... -> <meshcentral-domain-path>/control.ashx?...
```

升级前执行：

1. 精确匹配 pathname，拒绝利用前缀构造的其他路径。
2. 校验 `Origin` 等于配置的 Web Origin；非浏览器测试通过显式测试配置处理。
3. 验证请求中存在预期会话 Cookie，但不在 Gateway 中解析 Cookie 内容。
4. 保留完整查询参数。
5. 将上游 `Host` 改为 MeshCentral Host。
6. 转发 Cookie，并根据上游要求设置或重写 `Origin`。
7. 代理握手失败时返回可诊断的 HTTP 状态或 WebSocket 关闭码。

连接建立后必须保持透明：

- 不解析 JSON 消息。
- 不修改文本帧或二进制帧。
- 不合并、拆分或重新编码消息。
- 客户端或上游任意一端关闭时关闭另一端。
- 保留正常关闭码；异常代理错误使用内部统一关闭码。
- 应用退出时停止接收新 Upgrade，并在排空期限后关闭剩余连接。

## 9. `/api/meshrelay.ashx` WebSocket 代理

Relay 使用与控制通道相同的底层 Upgrade 代理，但配置和观测必须独立。

必须原样保留：

- `p`
- `auth`
- `rauth`
- `nodeid`
- `id`
- 其他目标 MeshCentral 版本使用的查询参数
- 文本帧、JSON 文本和二进制帧
- WebSocket 关闭码和关闭原因

特别要求：

- 禁止把查询字符串写入普通访问日志，因为其中可能包含 `auth` 或 `rauth`。
- 不设置普通 HTTP API 的短响应超时。
- 不启用消息级压缩，除非经过远程桌面和大文件传输压测。
- 不使用 NestJS Socket.IO 或 `@WebSocketGateway()` 终止 Relay 协议。
- 验证文件上传、下载、终端和远程桌面均能通过同一代理工作。
- 对连接数、持续时间和字节数做指标聚合，但不采集帧内容。

## 10. `/api/meshagents` 下载代理

路由映射：

```text
GET|HEAD /api/meshagents?<query>
  -> GET|HEAD <meshcentral-domain-path>/meshagents?<query>
```

实现要求：

- 只允许 `GET` 和 `HEAD`。
- 原样保留查询参数，不自行解释平台编号或 `meshid`。
- 使用 HTTP 流式代理，不缓冲完整响应。
- 客户端取消时立即销毁上游请求。
- 转发 `Range`、`If-None-Match`、`If-Modified-Since` 等下载请求头。
- 保留 `Content-Type`、`Content-Length`、`Content-Disposition`、`ETag`、`Last-Modified`、`Accept-Ranges`、`Content-Range` 和 `Cache-Control`。
- 保留上游 `200`、`206`、`304`、`404` 等真实状态。
- 不对安装包执行 JSON 序列化、压缩或字符集转换。
- 访问日志只记录路由、状态、耗时和响应字节数，对查询参数整体脱敏。

若 MeshCentral 返回的安装脚本内嵌其自身公网地址，需要在真实环境确认脚本是否仍指向可访问的 Agent 服务地址。本期不通过脆弱的文本替换修改安装脚本。

## 11. 代理服务组织

`MeshCentralProxyService` 负责创建并持有单个 `http-proxy` 实例：

```ts
interface ProxyRoute {
  publicPath: '/api/control.ashx' | '/api/meshrelay.ashx' | '/api/meshagents';
  upstreamPath: '/control.ashx' | '/meshrelay.ashx' | '/meshagents';
  websocket: boolean;
}
```

职责划分：

| 模块                      | 职责                                | 不应承担的职责                 |
| ------------------------- | ----------------------------------- | ------------------------------ |
| `LoginController`         | 输入校验、稳定 HTTP 响应            | 保存凭据、解析控制业务数据     |
| `LoginService`            | 上游登录、Cookie 提取与可选控制验证 | 管理 MeshCentral 用户          |
| `MeshCentralProxyService` | HTTP 流和 Upgrade 转发              | 解释 Relay/控制协议            |
| `gateway-config`          | 环境变量解析、URL 规范化            | 动态接受客户端上游地址         |
| `proxy-logging`           | 脱敏日志和连接指标                  | 记录消息帧和凭据               |
| `HealthController`        | 进程存活与配置就绪状态              | 使用管理员凭据探测 MeshCentral |

在 `main.ts` 中取得 Nest HTTP Server，并把 `upgrade` 事件交给代理服务。路由判断应集中在一个函数中，未知 Upgrade 路径直接销毁连接或返回 `404`。

## 12. Web 项目调整

### 12.1 地址保持不变

以下前端常量保持同源设计：

```text
/api/login
/api/control.ashx
/api/meshrelay.ashx
/api/meshagents
```

生产构建不需要暴露 MeshCentral 地址。`VITE_MESH_AGENTS_URL` 只保留为明确的特殊部署覆盖项，默认继续使用同源 `/api/meshagents`。

### 12.2 登录错误映射

当 Gateway 提供结构化 JSON 后，`GatewayProvider.login()`：

1. 根据 HTTP 状态和 `code` 创建稳定客户端错误。
2. 不直接向 UI 暴露上游 HTML 或底层异常文本。
3. 登录成功后仍连接控制 WebSocket，防止 Cookie 在登录响应后被删除、拒绝或过期。
4. 控制连接失败时清理前端会话并显示准确错误。

### 12.3 开发环境

推荐开发链路：

```text
React Vite :5173
  /api -> NestJS Gateway :3000
NestJS Gateway :3000
  -> MeshCentral
```

Vite 不再直接代理 MeshCentral，而是代理本地 Gateway。这样开发与生产使用相同的登录、Cookie 和 WebSocket 代码路径。

## 13. 安全要求

### 13.1 请求边界

- 只暴露四个明确代理入口和健康检查，不提供任意 catch-all 上游代理。
- 禁止客户端通过 Header、Query 或 Body 指定目标 Host。
- 登录请求设置 Body 大小、字段长度、请求频率和总超时限制。
- Upgrade 请求必须校验 pathname 和 Origin。
- 正确配置 `trust proxy`，只信任已知反向代理层。
- 外层 Nginx/Ingress 和 NestJS 同时设置合理的 Header 大小限制。

### 13.2 日志脱敏

统一隐藏：

```text
password
passwd
Cookie
Set-Cookie
Authorization
x-meshauth
auth
rauth
token
meshid（按部署敏感级别决定哈希或隐藏）
```

禁止记录：

- 登录请求体。
- 完整 URL Query。
- WebSocket 消息帧。
- Agent 安装脚本内容。
- 上游 HTML 登录响应全文。

允许记录：

- 本地请求 ID。
- 路由名称。
- HTTP 状态或 WebSocket 关闭码。
- 上游耗时。
- 连接持续时间。
- 汇总字节数。
- 已脱敏的错误分类。

### 13.3 TLS

- 公网入口只提供 HTTPS/WSS。
- Gateway 到 MeshCentral 默认验证证书链和主机名。
- 禁止在生产环境使用 `NODE_TLS_REJECT_UNAUTHORIZED=0`。
- 若使用内部 CA，应把 CA 证书注入 Gateway 信任链，而不是关闭验证。

## 14. 错误模型

HTTP 登录与下载代理使用稳定错误响应：

| 场景               |      HTTP 状态 | 错误码                    |
| ------------------ | -------------: | ------------------------- |
| 登录字段无效       |          `400` | `VALIDATION_ERROR`        |
| 用户名或密码错误   |          `401` | `INVALID_CREDENTIALS`     |
| 需要 MFA           |          `401` | `MFA_REQUIRED`            |
| Origin 不允许      |          `403` | `ORIGIN_NOT_ALLOWED`      |
| 方法不允许         |          `405` | `METHOD_NOT_ALLOWED`      |
| 登录限流           |          `429` | `RATE_LIMITED`            |
| MeshCentral 超时   |          `504` | `UPSTREAM_TIMEOUT`        |
| MeshCentral 不可用 | `502` 或 `503` | `UPSTREAM_UNAVAILABLE`    |
| 未识别上游登录响应 |          `502` | `UPSTREAM_PROTOCOL_ERROR` |

WebSocket 错误区分：

- Upgrade 前失败：返回 HTTP `401/403/502/504`。
- Upgrade 后上游断开：尽量转发上游关闭码和原因。
- Gateway 内部代理错误：使用统一应用关闭码，并向日志写入本地请求 ID。
- 不将网络失败映射为密码错误或权限不足。

## 15. 测试计划

### 15.1 配置单元测试

- 正确拼接默认域和非默认域路径。
- 拒绝缺少协议、包含凭据或包含 Query 的上游 URL。
- 生产环境缺少必要配置时启动失败。
- 开发环境允许显式 HTTP 上游。

### 15.2 登录测试

使用本地假 MeshCentral HTTP/WS 服务覆盖：

1. 正确转发表单字段。
2. 多个 `Set-Cookie` 不被错误合并。
3. Cookie 的 Domain、Path、Secure 和 SameSite 正确重写。
4. 密码错误映射为 `INVALID_CREDENTIALS`。
5. `tokenrequired` 映射为 `MFA_REQUIRED`。
6. 上游连接拒绝映射为 `UPSTREAM_UNAVAILABLE`。
7. 上游超时映射为 `UPSTREAM_TIMEOUT`。
8. 未知 HTML 不被误判为登录成功。
9. 日志和错误响应中不出现密码或 Cookie。

### 15.3 控制 WebSocket 测试

- `/api/control.ashx` 正确 Upgrade。
- Cookie、Query 和必要 Header 被转发。
- 文本消息双向透明传输。
- 上游认证拒绝和关闭码传回客户端。
- 非法 Origin 在 Upgrade 前被拒绝。
- 未知 WebSocket 路径不被代理。

### 15.4 Relay WebSocket 测试

- `auth`、`rauth`、`p` 等 Query 原样到达上游。
- 文本帧和二进制帧内容及顺序不变。
- 大二进制消息不转成字符串。
- 客户端取消会关闭上游连接。
- 上游关闭会关闭浏览器侧连接。
- 日志中不出现 Relay Query 和帧内容。

### 15.5 Agent 下载测试

- 普通 `GET` 返回内容、状态和响应头一致。
- `HEAD` 不返回响应体。
- `Range` 请求返回 `206` 和正确 `Content-Range`。
- 大文件以流式方式传输，Gateway 内存不随文件大小线性增长。
- 客户端中断后上游请求被取消。
- `404` 和 `500` 保留明确上游语义。
- Query 未出现在访问日志中。

### 15.6 真实环境手工验证

在目标 MeshCentral 和 Agent 上验证：

1. 正确密码登录并恢复页面刷新后的 Cookie 会话。
2. 错误密码显示认证失败，不进入受保护页面。
3. 控制通道设备、分组、用户和事件同步正常。
4. 文件目录读取、上传和下载正常。
5. 远程终端输入输出正常。
6. 远程桌面画面、输入和剪贴板正常。
7. Windows/Linux/macOS 对应 Agent 包或脚本可以下载。
8. 登出后旧控制连接和新建连接均无法继续使用已失效会话。

## 16. 实施阶段

### 阶段 0：协议与部署确认

- 确认目标 MeshCentral 域路径。
- 采集成功登录、密码错误和 MFA 要求的脱敏响应特征。
- 确认登录 Cookie 名称、Path、Domain、SameSite 和 Secure 属性。
- 确认控制 WebSocket 成功与失败的首批消息。
- 确认 Agent 下载的 GET、HEAD、Range 和脚本响应。

完成标准：形成可提交的脱敏 HTTP/WS 夹具，不能确认的登录错误保持通用错误，不猜测细分类别。

### 阶段 1：NestJS 项目与配置

- 创建 `apps/gateway`。
- 接入根 TypeScript、ESLint、Prettier 和 Turbo。
- 实现环境变量校验和 URL 规范化。
- 增加 `/health/live` 和 `/health/ready`。
- 增加统一请求 ID 与脱敏日志。

完成标准：Gateway 可独立启动、构建、类型检查和测试，错误配置会立即失败。

### 阶段 2：透明代理链路

- 实现 `/api/meshagents` HTTP 流代理。
- 实现 `control.ashx` Upgrade 代理。
- 实现 `meshrelay.ashx` Upgrade 代理。
- 完成 Origin、路径白名单、超时和优雅关闭。
- 使用假 MeshCentral 完成 HTTP/WS 集成测试。

完成标准：四种 Relay/控制数据类型不被修改，Agent 下载支持 Range 和取消。

### 阶段 3：登录适配

- 实现表单输入校验和上游 `/login` 请求。
- 实现多 Cookie 提取与属性重写。
- 首先保持“登录候选 + 前端控制 WS 最终确认”。
- 采集协议后增加服务端短期控制连接验证和结构化错误码。
- 增加登录限流和敏感字段脱敏测试。

完成标准：错误密码、上游超时、上游不可用和已确认的 MFA 场景能稳定区分，未知响应不会被宣称成功。

### 阶段 4：Web 接入

- 将 Vite `/api` 目标改为本地 Gateway。
- 前端解析 Gateway 登录 JSON 和稳定错误码。
- 保留控制 WebSocket 的二次认证确认。
- 删除生产环境对 MeshCentral 地址的直接依赖。
- 更新开发与生产环境变量示例。

完成标准：Web 在开发和生产均只访问同源 `/api`，浏览器网络面板中不出现内部 MeshCentral 地址。

### 阶段 5：生产化验证

- 增加 Docker 镜像和非 root 运行用户。
- 配置 Nginx/Ingress WebSocket Upgrade、长连接超时和下载流式转发。
- 验证 SIGTERM 优雅排空。
- 增加连接数、错误率、上游延迟和流量指标。
- 完成真实 MeshCentral/Agent 回归清单。

完成标准：滚动发布不会立即切断全部现有连接；代理错误可通过请求 ID 和指标定位，但日志不泄漏认证信息。

## 17. CI 与验收命令

Gateway 合入后至少执行：

```text
pnpm --filter @meshcentral/gateway lint
pnpm --filter @meshcentral/gateway typecheck
pnpm --filter @meshcentral/gateway test
pnpm --filter @meshcentral/gateway build
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

发布验收条件：

- `/api/login` 不泄漏上游 HTML、密码或 Cookie。
- 登录成功最终由控制通道认证结果确认。
- 两个 WebSocket 代理可承载文本和二进制消息。
- Relay 查询参数被转发但不进入日志。
- Agent 下载支持大文件、HEAD、Range 和客户端取消。
- 上游证书默认严格验证。
- 非允许 Origin、未知路径和任意上游代理请求被拒绝。
- Gateway 停止时能够排空或明确关闭活动连接。
- Web 不再直接连接 MeshCentral 公网或内网地址。

## 18. 风险与后续演进

### 18.1 已知风险

- MeshCentral 登录 HTML、Cookie 和认证消息可能随版本变化，必须固定目标版本并保存脱敏夹具。
- 透明 Cookie 模式下，Gateway 无法独立撤销浏览器持有的上游会话。
- Relay 长连接和大文件会增加 Gateway 的文件描述符、带宽和内存压力。
- 某些 Agent 安装脚本可能内嵌 MeshCentral 原始地址，需要单独确认部署可达性。
- SSO/MFA 可能要求跨站重定向和不同 SameSite 策略，不能仅按账号密码流程推断。

### 18.2 后续演进触发条件

出现以下需求时，再规划 Redis 会话模式：

- 不希望浏览器持有 MeshCentral Cookie。
- 需要 Gateway 独立强制注销和会话列表。
- 需要多个 Gateway 实例共享登录状态。
- 需要多 MeshCentral 实例路由。
- 需要统一 SSO/MFA 状态机。
- 需要服务端审计、告警或持久后台任务。

演进时保持现有浏览器路径不变，只替换 Gateway 内部的 Cookie 与会话实现，避免再次改动 `control-client`、`relay` 和 Web 路由。
