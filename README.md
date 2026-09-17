# MeshCentral 二次开发项目

本项目以 [MeshCentral](https://github.com/Ylianst/MeshCentral) 为基础进行二次开发，目标是在保留其远程设备管理能力的基础上，重新设计客户端界面，并逐步完善适合实际业务场景的管理与远程控制功能。

目前项目仍处于早期开发阶段，仅实现了基于 MeshCentral 网关的 Web 管理页面重设计，现有页面和功能尚未完善。React Native 移动端、共享状态包及相关 SDK 目前主要作为后续开发的工程骨架，不代表已经具备完整可用的业务能力。

## 当前进度

- 已搭建 Web、React Native 和共享包的 Monorepo 工程结构
- 已接入 MeshCentral 网关，并开始重新设计 Web 管理页面
- Web 页面及业务功能仍在持续完善
- 移动端、远程会话及其他扩展能力尚处于规划或基础建设阶段

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

Web 使用同源反向代理接口 `/api/login` 登录。该接口接收 `application/x-www-form-urlencoded` 格式的 `action=login`、`username` 和 `password`，并通过 `Set-Cookie` 建立会话；Web 随后通过 `VITE_GATEWAY_WS_URL` 或同源 `/api/control.ashx` 建立控制连接，由浏览器在 WebSocket 握手中自动携带 Cookie。APP 使用 `EXPO_PUBLIC_GATEWAY_WS_URL`。Android 模拟器访问宿主机时通常使用 `10.0.2.2`，真机需要使用开发机的局域网地址。

Cookie 会话应由服务端设置 `HttpOnly`、`Secure` 和适当的 `SameSite` 属性。浏览器端不会把用户名、密码或认证 Cookie 写入 Web Storage，也不会把认证信息拼接到 WebSocket URL。

## 控制客户端与状态

规划中，`@meshcentral/control-client` 用于承载 WebSocket、鉴权、心跳、退避重连、请求响应关联、协议标准化以及 `devices`、`groups`、`events` 等资源 API。它不依赖 React 或 Zustand。

`@meshcentral/shared-state` 用于承载缓存、selector、React Hook 和客户端状态绑定。相关能力仍会随 Web 页面和业务功能的开发持续调整与完善。

## 安全边界

客户端连接的是安全业务网关，而不是携带管理账号直接连接 MeshCentral。不要在 Vite 或 Expo 公共环境变量中放置 MeshCentral 用户名、密码、登录密钥或长期管理令牌。

[docs/](docs/) 中的 MeshCentral 文档用于实现未来的服务端代理或 SDK，不表示客户端应直接使用这些管理接口。

## Expo Monorepo

Expo SDK 57 会自动识别 pnpm workspace 并配置 Metro，因此没有手动添加旧式 `watchFolders` 或 `nodeModulesPaths`。如果第三方原生包在 pnpm isolated 安装下出现解析问题，再考虑将 `nodeLinker: hoisted` 加入根 `pnpm-workspace.yaml`。
