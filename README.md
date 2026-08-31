# MeshCentral Client Monorepo

跨 Web 与 React Native 的客户端工程骨架。Web 端用于后台管理，移动端基于 Expo；两端通过共享 Zustand 状态包消费业务 WebSocket 网关。

## 项目结构

```text
apps/
  web/                  Vite + React + React Router + Ant Design
  app/                  React Native + Expo + Expo Router
packages/
  control-client/       无框架依赖的控制 WebSocket SDK 与资源 API
  shared-state/         Zustand store、React Hook 与 Client-Store Binding
  relay/                远程会话中继 SDK
docs/                   MeshCentral 内部协议与未来服务端网关参考
```

## 环境要求

- Node.js 22+
- pnpm 10.33+
- Android 开发需要 Android Studio、模拟器或 Expo Go 真机

## 安装与运行

```sh
pnpm install
pnpm dev:web
pnpm dev:app
```

其他常用命令：

```sh
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format
```

## 配置业务网关

复制相应环境变量示例：

- Web：复制 `apps/web/.env.example` 为 `apps/web/.env.local`
- APP：复制 `apps/app/.env.example` 为 `apps/app/.env.local`

Web 使用 `VITE_GATEWAY_AUTH_URL` 与 `VITE_GATEWAY_WS_URL`。认证接口接收 `{ username, password }`，成功时返回 `{ accessToken, username?, wsUrl? }`；Web 随后使用短期 `accessToken` 建立业务 WebSocket。APP 使用 `EXPO_PUBLIC_GATEWAY_WS_URL`。Android 模拟器访问宿主机时通常使用 `10.0.2.2`，真机需要使用开发机的局域网地址。

`VITE_GATEWAY_ACCESS_TOKEN` 仅用于本地开发时绕过登录页。生产环境应由登录层提供可刷新、短期令牌，并优先使用安全 Cookie 承载刷新会话，避免将长期密钥打包进客户端。浏览器端不会把原始用户名或密码写入存储。

## 控制客户端与状态

`@meshcentral/control-client` 负责 WebSocket、鉴权、心跳、退避重连、请求响应关联、协议标准化和 `devices`、`groups`、`events` 资源 API。它不依赖 React 或 Zustand。

`@meshcentral/shared-state` 只负责缓存、selector、React Hook 和 `bindGatewayClient()`。Binding 在首次连接与重连成功后同步设备、分组和最后连接时间，并将实时领域事件映射到 Store。

## 安全边界

客户端连接的是安全业务网关，而不是携带管理账号直接连接 MeshCentral。不要在 Vite 或 Expo 公共环境变量中放置 MeshCentral 用户名、密码、登录密钥或长期管理令牌。

[docs/](docs/) 中的 MeshCentral 文档用于实现未来的服务端代理或 SDK，不表示客户端应直接使用这些管理接口。

## Expo Monorepo

Expo SDK 57 会自动识别 pnpm workspace 并配置 Metro，因此没有手动添加旧式 `watchFolders` 或 `nodeModulesPaths`。如果第三方原生包在 pnpm isolated 安装下出现解析问题，再考虑将 `nodeLinker: hoisted` 加入根 `pnpm-workspace.yaml`。
