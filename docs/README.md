# MeshCentral API 封装文档

> 本目录作为服务端业务网关或 Node.js SDK 的实现参考。当前 `apps/web` 与 `apps/app` 客户端不应携带 MeshCentral 管理凭据直连这些内部接口，而应连接具备鉴权、授权和审计能力的业务网关。

本文档基于当前项目依赖的 MeshCentral `1.1.54`，主要参考 `meshctrl.js`、浏览器端 `meshcentral.js`、`agent-redir-ws-0.1.1.js` 以及服务端 `meshuser.js`、`webserver.js` 中使用的协议。

MeshCentral 的管理能力主要不是标准 REST API，而是通过 WebSocket 内部协议暴露：

- 管理控制通道：`wss://<server>/<domain>/control.ashx`
- 设备中继通道：`wss://<server>/<domain>/meshrelay.ashx?...`
- Agent 下载接口：`https://<server>/<domain>/meshagents?...`

这些接口与 MeshCentral Web UI 和 `meshctrl` CLI 共用，适合封装为 Node.js SDK。由于属于内部协议，升级 MeshCentral 后需要做回归测试。

## 文档目录

- [01-authentication.md](01-authentication.md)：鉴权方式、登录令牌、登录密钥、二次验证
- [02-devices.md](02-devices.md)：设备分组、设备列表、设备详情
- [03-remote-control.md](03-remote-control.md)：远程桌面、终端、文件隧道
- [04-batch-operations.md](04-batch-operations.md)：批量命令、文件、消息、电源操作
- [05-events.md](05-events.md)：实时事件、设备在线/离线消息、断线重连
- [06-other-apis.md](06-other-apis.md)：用户、权限、邀请、共享、报表等补充接口
- [07-nodejs-wrapper-design.md](07-nodejs-wrapper-design.md)：推荐 SDK 结构、请求关联、示例代码
- [08-permissions.md](08-permissions.md)：用户全局权限、设备组权限、单设备权限与位掩码计算
- [../packages/shared-state/README.md](../packages/shared-state/README.md)：前端共享状态与网关客户端 (@meshcentral/shared-state) 架构与使用说明

## 推荐封装层级

建议把 SDK 分成三层：

1. `MeshCentralClient`：维护 `control.ashx` WebSocket 连接、鉴权、心跳、重连、请求/响应关联。
2. 资源模块：`devices`、`groups`、`users`、`commands`、`events` 等，封装具体 `action`。
3. 隧道模块：`remoteDesktop`、`terminal`、`files`，单独处理 `meshrelay.ashx` 的二进制/流式协议。

## 通用请求格式

控制通道发送 JSON：

```json
{
  "action": "nodes",
}
```

服务端返回 JSON：

```json
{
  "action": "nodes",
  "nodes": {}
}
```

## 常用连接地址

默认域：

```text
wss://example.com/control.ashx
wss://example.com/meshrelay.ashx
```

非默认域：

```text
wss://example.com/<domain>/control.ashx
wss://example.com/<domain>/meshrelay.ashx
```

带服务器登录 key：

```text
wss://example.com/control.ashx?key=<server-login-key>
```

## 注意事项

- 默认 MeshCentral WebSocket 使用自签名证书时，Node.js 客户端可能需要 `rejectUnauthorized: false` 或配置 CA。
- `x-meshauth` 中的密码、令牌、登录密钥都应仅保存在服务端，不要暴露给浏览器前端。
- `meshrelay.ashx` 是实时中继通道，不适合用普通 HTTP 客户端封装。
- 远程桌面协议包含画面、鼠标、键盘、剪贴板等二进制消息，建议优先复用 MeshCentral 前端脚本或做较薄的适配层。
