# MeshCentral 二次开发项目

本项目以 [MeshCentral](https://github.com/Ylianst/MeshCentral) 为基础进行二次开发，目标是在保留其远程设备管理能力的基础上，重新设计客户端界面，并逐步完善适合实际业务场景的管理与远程控制功能。

目前项目仍处于持续开发阶段，已基于 MeshCentral 原生控制通道实现 Web 管理页面重设计。控制客户端、共享状态及 Relay 包已有实现与测试，Web 已接入远程桌面、终端和文件相关能力；这不代表所有场景均已完成真实设备验收。React Native 移动端仍待完善。

## 当前进度

- 已搭建 Web、React Native 和共享包的 Monorepo 工程结构
- 已接入 MeshCentral 原生认证、控制和 Relay 通道，并开始重新设计 Web 管理页面
- Web 页面及业务功能仍在持续完善
- 控制、共享状态和远程会话 SDK 已有实现；移动端与其他扩展能力仍待完善

## 设备工作台远程桌面

- 常规与全屏模式均采用左侧画面、右侧固定工具栏，工具栏可独立滚动，不覆盖远程画面。
- 左侧画面容器保持 16:9；默认等比适应窗口，远端比例不同时留黑边，不裁切或修改远端分辨率。
- 鼠标位于远程画面（含黑边）内时，滚轮不滚动外层页面；连接且启用鼠标输入时仍向远端发送滚轮操作。移至工具栏或页面其他区域后正常滚动。
- 常规模式可用宽度不足 700px 时，工具栏移至画面下方；全屏模式保持左右布局。

## 项目结构

```text
apps/
  web/                  Vite + React + React Router + Ant Design
  app/                  React Native + Expo + Expo Router
  site/                 Next.js 官网（独立于 Web 管理端）
  meshcentral/          上游 MeshCentral 启动器与 YAML 配置合并
  mcp/                  stdio MCP Server（只读工具、CLI 子命令）
packages/
  mcp-core/             MCP 能力层：会话、连接、查询投影、审计与只读工具
  control-client/       无框架依赖的控制 WebSocket SDK 与资源 API
  shared-state/         Zustand store、React Hook 与 Client-Store Binding
  relay/                远程会话中继 SDK
  meshcentral-plugins/  jsonauth、chunkuploader、mcp、utils 等服务端插件
test/                   跨包集成测试与真实环境手动采集
deploy/                 容器、配置、品牌资源与部署说明
docs/                   开发规范、协议证据与阶段计划
```

## 环境要求

- Node.js 22+
- pnpm 10.33.4（以根 package.json 的 packageManager 为准）
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
pnpm mcp:login
pnpm dev:mcp
pnpm build:mcp
```

## 配置 MeshCentral 连接

复制相应环境变量示例：

- Web：复制 `apps/web/.env.example` 为 `apps/web/.env.local`
- APP：复制 `apps/app/.env.example` 为 `apps/app/.env.local`

Web 使用同源 `/api/auth/*` 接口登录，由 MeshCentral 内的 `jsonauth` 插件建立原生 Session Cookie；随后通过同源 `/api/control.ashx` 连接 MeshCentral 控制 WebSocket，浏览器会在握手中自动携带 Cookie。现有 `VITE_GATEWAY_WS_URL` 和 `EXPO_PUBLIC_GATEWAY_WS_URL` 名称仅作为历史兼容配置。Android 模拟器访问宿主机时通常使用 `10.0.2.2`，真机需要使用开发机的局域网地址。

Cookie 会话应由服务端设置 `HttpOnly`、`Secure` 和适当的 `SameSite` 属性。服务端通过 Cookie 验证会话，`MeshCentralClient` 客户端无需读取 Cookie，也无需在 WebSocket URL 中添加凭据。浏览器端不会把用户名、密码或认证 Cookie 写入 Web Storage。

## 控制客户端与状态

`@meshcentral/control-client` 已承载 WebSocket、鉴权、心跳、退避重连、请求响应关联、协议标准化以及 `devices`、`groups`、`events` 等资源 API。它不依赖 React 或 Zustand。

`@meshcentral/shared-state` 用于承载缓存、selector、React Hook 和客户端状态绑定。相关能力仍会随 Web 页面和业务功能的开发持续调整与完善。

## 安全边界

客户端通过同源 Nginx 入口连接 MeshCentral 的 `jsonauth`、控制和 Relay 路径，依赖原生 HttpOnly Session Cookie，不携带管理账号或长期管理凭据。不要在 Vite 或 Expo 公共环境变量中放置 MeshCentral 用户名、密码、登录密钥或长期管理令牌。

Nest Gateway 保留为未来业务聚合层，当前不参与浏览器认证、控制或 Relay 主链路。[docs/](docs/) 中的 MeshCentral 文档用于 SDK、协议验证和未来服务端聚合能力，不表示客户端应直接使用管理接口或长期令牌。

## Expo Monorepo

Expo SDK 57 会自动识别 pnpm workspace 并配置 Metro，因此没有手动添加旧式 `watchFolders` 或 `nodeModulesPaths`。如果第三方原生包在 pnpm isolated 安装下出现解析问题，再考虑将 `nodeLinker: hoisted` 加入根 `pnpm-workspace.yaml`。

## 文档入口

- [AI 协作指引](AGENTS.md)与[开发规范](docs/development.md)
- [阶段计划](docs/plan/README.md)与[架构护栏](docs/plan/architecture-guardrails.md)
- [MeshCentral 协议资料](docs/meshcentral/README.md)
- [控制客户端](packages/control-client/README.md)、[共享状态](packages/shared-state/README.md)、[Relay](packages/relay/README.md)
- [插件开发](packages/meshcentral-plugins/docs/plugin-development.md)、[MCP](apps/mcp/README.md)
- [部署说明](deploy/README.md)与[集成测试](test/README.md)

阶段计划描述目标与历史进度，实际能力需结合源码、测试及目标服务端验证；已发现的资料差异见开发规范的待确认事项。

### 流畅度与性能诊断

工具栏提供流畅、均衡、清晰及自定义预设；默认仍沿用 WebP/58/100，真实设备验收前不切换默认。显示缩放仅改变本地画面呈现，传输比例暂保持 100%。性能详情每秒显示链路、RTT、接收和绘制统计，并支持导出最近最多 300 次采样；图块数、绘制批次不代表远端 FPS。

绘制队列最多三路并发解码，保持增量图块顺序，通过 requestAnimationFrame 批量绘制；待处理压缩图像负载超过 8 MiB 时结束会话并提示重新连接。真实设备的对照采集及尚未完成的验收见 [远程桌面流畅度验收](test/desktop-performance.md)。
