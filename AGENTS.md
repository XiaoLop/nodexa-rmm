# AI 协作指引

## 阅读顺序

1. 阅读 [README.md](README.md) 与 [开发规范](docs/development.md)。
2. 阅读目标模块的 README、相关源码和测试；子目录有 AGENTS.md 时同时遵循，例如 `apps/site/AGENTS.md`。
3. 涉及功能或重构时阅读 [既有计划](docs/plan/README.md) 和 [架构护栏](docs/plan/architecture-guardrails.md)，沿用原有路径与编号。

## 常用命令

均在仓库根目录执行，来源为根目录及各工作区的 package.json：

| 用途                     | 命令                                               |
| ------------------------ | -------------------------------------------------- |
| 安装锁定依赖             | `pnpm install --frozen-lockfile`                   |
| 启动 Web / 移动端 / 官网 | `pnpm dev:web` / `pnpm dev:app` / `pnpm dev:site`  |
| 检查目标包               | `pnpm --filter <包名> typecheck` / `lint` / `test` |
| 构建 Web                 | `pnpm build:web`                                   |
| 全仓检查                 | `pnpm lint` / `pnpm typecheck` / `pnpm test`       |
| 格式检查                 | `pnpm format:check`                                |

目标包名以其 package.json 为准，例如 `@meshcentral/control-client`。执行前区分本地测试与真实环境采集；前置条件见开发规范。

## 项目边界

- 协议与资源 API 放在 control-client；状态绑定放在 shared-state；远程数据通道放在 relay；页面负责呈现与交互。遵循根 ESLint 的依赖限制。
- 浏览器通过同源 `/api/auth/` 接口建立会话，服务端通过 Cookie 验证；MeshCentralClient 无需读取 Cookie 或在 WebSocket URL 中添加凭据。
- 变更协议先核实 `docs/meshcentral/` 的版本、证据及目标模块测试，不将规划或示例当作已实现接口。
- 依赖与版本遵循根 workspace catalog 和锁文件；MeshCentral 当前精确固定为 1.3.1。
- 不手工修改 node_modules、构建产物或运行数据。插件产物由构建脚本生成，修改插件源码与构建配置。
- 保留人工文档与既有决策；发现冲突记录证据，未经验证不将计划阶段标为完成。

## 交付

说明行为变化、验证命令与结果、未验证条件；同步受影响的文档。仅文档任务不安装依赖或实施业务功能。提交信息使用简体中文，格式为 `<type>(<scope>): <主题>`，主题不超过 30 字、不加句号，不以“更新/修改/优化”开头。
