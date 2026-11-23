# Nodexa RMM

Nodexa RMM 是基于 [MeshCentral](https://github.com/Ylianst/MeshCentral) 的远程设备管理项目，提供独立的 Web 管理端，复用 MeshCentral 的认证、设备控制与远程会话能力。仓库也包含服务端启动器、配套插件、共享 SDK、移动端和 MCP 服务。

## 功能与进度

- Web 管理端支持设备和设备组管理，并在设备工作台中提供远程桌面、终端和文件操作。
- 服务端工作区固定使用 MeshCentral 1.3.1，并提供 YAML 配置覆盖和内置插件。
- 控制客户端、共享状态和 Relay 有自动化测试。远程会话在不同设备和部署环境下的验收仍在进行。
- React Native 移动端仍在开发。MCP 服务当前提供只读工具，使用方式见 [MCP 文档](apps/mcp/README.md)。

## Web 本地开发

需要 Node.js 22 或更高版本，以及 pnpm 10.33.4。先准备一个你有权使用的 MeshCentral 实例，确保已加载 [jsonauth 插件](packages/meshcentral-plugins/src/plugins/jsonauth/README.md)，且它的入口提供 `/api/auth/`、控制 WebSocket 和 Relay 路径。

```sh
git clone https://github.com/XiaoLop/nodexa-rmm.git
cd nodexa-rmm
pnpm install --frozen-lockfile
```

将 `apps/web/.env.example` 复制为 `apps/web/.env.local`，添加以下配置，并替换为你自己的服务端地址。请先设置此项再启动 Web，以启用开发代理。

```dotenv
MESHCENTRAL_PROXY_TARGET=https://mesh.example.com
```

```sh
pnpm dev:web
```

打开 [本地 Web 管理端](http://localhost:5173)。服务端配置和镜像构建见 [部署说明](deploy/README.md)和 [MeshCentral 服务端文档](apps/meshcentral/README.md)。

## 设备工作台远程桌面

- 常规与全屏模式均采用左侧画面、右侧固定工具栏，工具栏可独立滚动，不覆盖远程画面。
- 左侧画面容器保持 16:9；默认等比适应窗口，远端比例不同时留黑边，不裁切或修改远端分辨率。
- 鼠标位于远程画面（含黑边）内时，滚轮不滚动外层页面；连接且启用鼠标输入时仍向远端发送滚轮操作。移至工具栏或页面其他区域后正常滚动。
- 常规模式可用宽度不足 700px 时，工具栏移至画面下方；全屏模式保持左右布局。

### 流畅度与性能诊断

工具栏提供流畅、均衡、清晰及自定义预设；默认仍沿用 WebP/58/100，真实设备验收前不切换默认。显示缩放仅改变本地画面呈现，传输比例暂保持 100%。性能详情每秒显示链路、RTT、接收和绘制统计，并支持导出最近最多 300 次采样；图块数、绘制批次不代表远端 FPS。

绘制队列最多三路并发解码，保持增量图块顺序，通过 requestAnimationFrame 批量绘制；待处理压缩图像负载超过 8 MiB 时结束会话并提示重新连接。真实设备的对照采集及尚未完成的验收见 [远程桌面流畅度验收](test/desktop-performance.md)。

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

## 其他开发入口

- `pnpm dev:app` 启动 Expo 移动端。先将 `apps/app/.env.example` 复制为 `apps/app/.env.local`，设置 `EXPO_PUBLIC_GATEWAY_WS_URL` 为自己的控制通道地址，并准备 Android 模拟器或 Expo Go 真机环境。EAS 构建也需要在所用环境中显式提供此变量。
- `pnpm dev:site` 启动项目官网。见 [官网文档](apps/site/README.md)。
- `pnpm build:web` 构建 Web 管理端。开发检查见 [开发规范](docs/development.md)。

## MeshCentral 连接与会话

Web 使用同源 `/api/auth/*` 接口登录，由 MeshCentral 内的 `jsonauth` 插件建立原生 Session Cookie；随后通过同源 `/api/control.ashx` 连接 MeshCentral 控制 WebSocket，浏览器会在握手中自动携带 Cookie。移动端通过 `EXPO_PUBLIC_GATEWAY_WS_URL` 配置控制通道。Android 模拟器访问宿主机时通常使用 `10.0.2.2`，真机需要使用开发机的局域网地址。

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
- [MeshCentral 协议资料](docs/meshcentral/README.md)
- [控制客户端](packages/control-client/README.md)、[共享状态](packages/shared-state/README.md)、[Relay](packages/relay/README.md)
- [插件开发](packages/meshcentral-plugins/docs/plugin-development.md)、[MCP](apps/mcp/README.md)
- [部署说明](deploy/README.md)与[集成测试](test/README.md)

## 参与贡献

欢迎提交问题、功能建议和 Pull Request。提交前请阅读 [贡献指南](CONTRIBUTING.md)。

## 许可证与上游项目

Nodexa RMM 采用 [Apache License 2.0](LICENSE)。上游 [MeshCentral](https://github.com/Ylianst/MeshCentral) 也采用 [Apache License 2.0](https://github.com/Ylianst/MeshCentral/blob/master/LICENSE)。
