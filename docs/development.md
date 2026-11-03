# 开发规范

## 适用范围与依据

本文记录已有仓库约定，依据根 `package.json`、`pnpm-workspace.yaml`、`turbo.json`、`tsconfig.base.json`、`eslint.config.mjs`、`prettier.config.mjs` 及各模块源码与测试。阶段目标沿用 [docs/plan](plan/README.md)，不另建平行计划目录。以下命令已核对脚本定义，不表示本次文档初始化已运行所有检查。

## 模块职责与数据流

| 模块                             | 职责                                                          |
| -------------------------------- | ------------------------------------------------------------- |
| `apps/web`                       | React 管理端；路由、权限展示、设备工作台、国际化              |
| `apps/app`                       | Expo 移动端；复用控制客户端与状态包，能力仍待完善             |
| `apps/site`                      | Next.js 官网，使用独立的 Next 依赖 catalog 与子目录协作指引   |
| `apps/meshcentral`               | 固定上游服务端版本，合并 YAML 配置并启动 MeshCentral          |
| `apps/mcp` / `packages/mcp-core` | stdio MCP 与 CLI 入口 / 会话、查询、审计和工具能力            |
| `packages/control-client`        | 控制 WebSocket 生命周期、请求关联、协议归一化、资源及权限 API |
| `packages/shared-state`          | Zustand 缓存、事件绑定、selector 与 React Hook                |
| `packages/relay`                 | 独立远程桌面、终端、文件会话与 Relay 协议                     |
| `packages/meshcentral-plugins`   | 服务端认证、上传及其他扩展插件                                |
| `test` / `deploy`                | 跨包验证与手动采集 / 容器及部署配置                           |

Web 通过同源 `/api/auth/` 下的接口建立 Session Cookie，再连接 `/api/control.ashx`；浏览器自动携带 Cookie，服务端通过 Cookie 验证会话。MeshCentralClient 无需读取 Cookie 或在 WebSocket URL 中添加凭据。控制消息经 control-client 标准化，由 shared-state 绑定到应用。远程桌面、终端与文件数据通过 relay 管理。开发代理配置见 `apps/web/vite.config.ts`，生产入口见 [部署说明](../deploy/README.md)。未来 Gateway 设计不代表当前认证主链路。

control-client 不依赖 React、Zustand 或 relay；relay 不依赖控制客户端或应用状态；shared-state 可提供 React 绑定，但不承载 DOM UI 或 relay。准确的导入限制与 SDK 文案规则以根 ESLint 为准，详见 [架构护栏](plan/architecture-guardrails.md)。

## 编码与接口

- TypeScript 沿用各模块 tsconfig；根配置启用 strict、noUncheckedIndexedAccess 等检查。沿用 Prettier 单引号、尾逗号与 100 字符行宽，类型导入遵循 ESLint。
- 页面作为装配入口，数据逻辑、纯函数和视图分别放入 features、components；遵循现有拆分规范，不把历史目标行数误作已启用的门禁。
- 新增控制能力先封装资源 API、校验参数并归一化响应，再由 UI 调用。更新控制客户端消息清单与相关测试，避免在页面散布裸协议请求。
- SDK 返回结构化数据，用户文案放在应用 i18n；修改 Web 字典时检查 `apps/web/src/i18n/localeParity.test.ts`。
- 错误通过现有类型与诊断通道传播；保留无值、空值和失败的语义差异，不猜测未知协议字段。组件或会话结束时清理订阅与连接，遵循各包生命周期 API。
- 权限组件用于交互守卫，服务端仍负责最终授权。不要自行重算服务端完整有效权限。

## 依赖与配置

- Node.js 要求及 pnpm 精确版本以根 package.json 为准；在仓库根目录执行 pnpm，内部包通过 `workspace:*` 引用。
- 共享版本使用根 workspace 的 `catalog:`；官网使用 `catalog:next`。保留合理的模块专用版本，不强制把所有依赖收进 catalog。版本变更同步锁文件。
- MeshCentral 当前精确固定为 1.1.54；升级需核对插件、控制及 Relay 协议兼容性。
- Web 与 APP 从各自 `.env.example` 建立本地配置；Web 开发时核对 `MESHCENTRAL_PROXY_TARGET`，不能假定默认代理就是自己的测试服务端。
- 不提交真实环境变量、Cookie、Token、账号或采集中的业务数据；公共前端变量仅承载非秘密配置。日志和错误输出脱敏。非浏览器运行环境的会话传递需单独配置。
- 插件修改遵循 [插件开发指南](../packages/meshcentral-plugins/docs/plugin-development.md)。运行数据和构建产物不作为源码手工维护。

## 验证与交付

在仓库根目录按影响范围选择已有脚本：

| 场景           | 命令与条件                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------- |
| 目标包静态检查 | `pnpm --filter <包名> typecheck`、`pnpm --filter <包名> lint`                                 |
| 目标包测试     | `pnpm --filter <包名> test`；具体脚本以包清单为准                                             |
| Web 构建       | `pnpm build:web`                                                                              |
| 跨包集成测试   | `pnpm --filter @meshcentral/test test`                                                        |
| 全仓检查与构建 | `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`                                      |
| 文档格式检查   | `pnpm exec prettier --check README.md AGENTS.md docs/development.md --ignore-path .gitignore` |

Turbo 的 test 依赖上游 build；部分工作区允许无测试通过，官网 test 实际运行 typecheck，不能将脚本成功等同于功能覆盖。根 `.prettierignore` 排除 docs，检查文档时需显式覆盖忽略文件。

真实环境采集需独立准备 `test/.env`，并启用 `RUN_MANUAL_INTEGRATION=1`；详见 [测试说明](../test/README.md)。单元测试不能替代真实 Agent、设备权限和会话验收。当前 [官网 CI](../.github/workflows/deploy-site.yml) 包含官网 typecheck 与 lint，不能据此声称已有全仓 CI 门禁。

交付说明包含改动目的、可观察行为、实际验证结果与限制。接口、配置或使用方式变化时同步相关 README 和协议文档；复用既有计划和稳定编号，只有验证后才标记完成。

## 已确认事项与验证范围

- 用户已检查镜像包含 `exeHandler.js`；Dockerfile 检查安装包内该文件可解析，无需单独下载或恢复。服务端 README 已统一说明，本次未重新构建镜像。
- 已移除废弃的 `apps/site/pnpm-workspace.yaml`，统一使用根 workspace 配置。
- Web 鉴权按 `/api/auth/` 登录与服务端 Cookie 会话验证说明，控制客户端快速开始已采用无凭据的同源 WebSocket URL。
- 既有阶段计划的完成度、移动端验收范围与下次开发优先级需由后续具体任务确认；本次不调整计划状态，也不创建空计划。
