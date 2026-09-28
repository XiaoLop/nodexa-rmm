# MeshCentral 插件开发规范

本文定义本仓库 MeshCentral 插件的工程结构、职责边界、装饰器用法、编码约束、安全要求、测试标准和交付流程。

适用范围：

- `packages/meshcentral-plugins/src/plugins/<shortName>/` 下的 TypeScript 插件。
- 随本仓库构建并部署到 MeshCentral 数据目录的可信插件。
- 使用 MeshCentral `1.1.54` 内部 Hook、HTTP、Session、数据库和事件接口的代码。

本文是团队级开发规范。插件系统原理参见 [plugins.md](plugins.md)，构建、部署和调试命令参见 [包内开发指南](../../packages/meshcentral-plugins/docs/plugin-development.md)。

## 1. 设计原则

### 1.1 保持 MeshCentral 协议兼容

MeshCentral 最终加载的是 CommonJS 模块中的同名工厂函数：

```javascript
const pluginModule = require('./audit.js');
const plugin = pluginModule.audit(pluginHandler);
```

无论源码如何分层，最终导出必须满足 `MeshCentralPluginFactory`，并同步返回 `MeshCentralPlugin`。不得在入口中启动独立 HTTP 服务，也不得把插件初始化改为异步工厂。

### 1.2 采用轻量 Nest 风格

插件采用 Module、Plugin、Controller、Service 分层和装饰器声明，但不启动完整 NestJS 容器：

- 不依赖 `@nestjs/core`。
- 不依赖 `reflect-metadata`。
- 不使用运行时构造函数类型反射。
- 依赖关系在 Module 中显式创建和装配。
- 装饰器只负责把类方法映射为 MeshCentral Hook。

这套结构保留 Nest 风格的职责划分，同时适配 MeshCentral 的同步插件工厂和单文件打包模式。

### 1.3 业务逻辑与 MeshCentral 内部 API 隔离

Controller 和 Plugin 只处理协议适配。可测试的业务判断应放入 Service。对 MeshCentral 内部对象的访问应限制在最小范围，不得把整个 `meshServer`、`webServer` 或数据库实例无边界地传入所有业务类。

## 2. 标准目录

源码顶层目录统一为：

```text
packages/meshcentral-plugins/src/
  common/       # 公共方法、适配器和工厂
  decorators/   # 公共装饰器
  types/        # 公共类型
  plugins/      # 需要构建发布的插件
```

公共装饰器文件使用 `<功能>.drcorator.ts` 命名，例如 `plugin.drcorator.ts`。插件私有类型可以使用 `<shortName>.types.ts` 保留在插件目录；只有跨插件复用的类型才放入 `src/types`。

复杂插件使用以下结构：

```text
packages/meshcentral-plugins/src/plugins/<shortName>/
  config.json
  index.ts
  index.test.ts
  <shortName>.module.ts
  <shortName>.plugin.ts
  <shortName>.controller.ts
  <shortName>.types.ts
  services/
    <feature>.service.ts
```

允许按复杂度增加子目录：

```text
<shortName>/
  application/       # 用例编排
  domain/            # 纯业务规则和值对象
  infrastructure/    # MeshCentral、数据库和外部系统适配
  test/              # 大型插件的测试辅助与分层测试
```

小型插件可以省略 Controller 或拆分 Service，但必须保留清晰的入口和 Hook 边界。不得为了形式创建只有转发代码的空层。

## 3. 文件职责

| 文件 | 必要性 | 职责 |
| --- | --- | --- |
| `config.json` | 必须 | 插件名称、版本、兼容范围和发布元数据 |
| `index.ts` | 必须 | 导出与 `shortName` 同名的 MeshCentral 工厂 |
| `*.module.ts` | 复杂插件必须 | 创建依赖、装配对象图、提供测试替换点 |
| `*.plugin.ts` | 推荐 | 声明 MeshCentral Hook，不承载复杂业务 |
| `*.controller.ts` | 有 HTTP 接口时必须 | 注册路由、读取请求、调用 Service、输出响应 |
| `services/*.service.ts` | 按职责拆分 | 实现认证、授权、会话、事件等业务逻辑；所有 Service 统一放入 `services` 目录 |
| `*.types.ts` | 推荐 | 插件内部 DTO、状态和依赖接口 |
| `*.test.ts` | 必须 | 覆盖主要成功、失败和安全边界 |

## 4. 命名规范

同一插件的以下名称必须一致：

| 项目 | 示例 |
| --- | --- |
| 源码目录 | `audit/` |
| `config.json.shortName` | `audit` |
| TypeScript 导出 | `export const audit` |
| 构建文件 | `audit.js` |
| 运行时目录 | `plugins/audit/` |
| 插件白名单 | `"audit"` |

约束：

- `shortName` 仅使用小写英文字母和数字。
- 类使用 PascalCase，例如 `AuditPlugin`、`AuditController`。
- 文件使用 kebab-case 或 `<shortName>.<role>.ts`，同一插件内保持一致。
- Service 名称表达单一职责，例如 `TwoFactorService`，避免 `CommonService`、`UtilsService`。
- MeshCentral Hook 名称必须使用共享类型中已声明的原始名称。

## 5. 入口规范

`index.ts` 必须保持精简，仅负责兼容导出和必要的测试入口：

```typescript
import { AuditPlugin } from './audit.plugin.js';
import { createAuditModule } from './audit.module.js';
import { createPluginFactory } from '../../common/plugin-factory.js';

export const audit = createPluginFactory(
  AuditPlugin,
  (pluginHandler) => createAuditModule(pluginHandler).plugin,
);
```

入口中禁止：

- 实现大段业务流程。
- 直接解析复杂请求。
- 创建后台定时任务但不提供清理策略。
- 使用默认导出。
- 在模块加载时访问尚未初始化的 MeshCentral 运行时对象。

## 6. Module 与依赖装配

Module 使用显式构造函数装配，不使用隐式反射 DI：

```typescript
export function createAuditModule(
  pluginHandler: MeshCentralPluginHandler,
): AuditModuleRef {
  const repository = new AuditRepository(pluginHandler.parent.db);
  const auditService = new AuditService(repository);
  const controller = new AuditController(auditService);

  return {
    auditService,
    plugin: new AuditPlugin(controller),
  };
}
```

规范：

- 构造函数依赖必须显式、只读。
- 时间、随机数、延迟、网络客户端等不可控依赖应通过接口注入。
- Module 可以返回测试需要的 Service，但不得暴露无关内部对象。
- 不得使用全局可变单例保存用户、Domain 或 Session 状态。
- 插件实例的生命周期默认为 MeshCentral 每次加载创建一次。

## 7. 装饰器与 Plugin 规范

插件类使用 `@MeshPlugin()` 声明插件元数据，使用 `@PluginHook()` 映射 MeshCentral Hook：

```typescript
@MeshPlugin({ exports: [] })
export class AuditPlugin {
  constructor(private readonly controller: AuditController) {}

  @PluginHook('hook_setupHttpHandlers')
  setupHttpHandlers(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
  ): void {
    this.controller.register(webServer, meshServer);
  }
}
```

约束：

- `@PluginHook()` 参数必须是 `MeshCentralPlugin` 已声明的成员。
- 一个方法只映射一个 Hook。
- Hook 方法应尽快委托给 Controller 或 Service。
- 不得在装饰器中执行 I/O、读取配置或修改全局状态。
- 浏览器函数仍需列入 `@MeshPlugin({ exports: [...] })`，并遵守浏览器注入限制。

## 8. Controller 规范

Controller 负责 MeshCentral HTTP 层，不负责核心业务判断：

```typescript
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  register(webServer: MeshCentralWebServer): void {
    webServer.app.post(
      '/api/audit/events',
      webServer.bodyParser!.json({ limit: '16kb' }),
      (request, response) => this.auditService.handle(request, response),
    );
  }
}
```

Controller 必须：

- 为 JSON 请求设置明确的 body 大小限制。
- 校验 body、query、header 和 path 参数的类型及长度。
- 返回稳定的 HTTP 状态码和结构化错误码。
- 避免在错误响应中泄露账号是否存在、内部路径或异常堆栈。
- 对敏感响应设置适当的缓存策略。
- 按 Domain URL 和 DNS Domain 规则正确注册路由并去重。

## 9. Service 规范

Service 应围绕单一业务能力设计：

- 方法输入和输出使用明确类型。
- 纯判断逻辑不直接依赖 HTTP 请求和响应对象。
- 外部副作用集中在少量方法中。
- 不通过 `any` 绕过未知 MeshCentral 接口。
- 不吞掉无法恢复的异常；可预期的业务失败应转换为明确结果。
- 时间和随机行为必须可替换，确保测试稳定。

当 Service 同时负责校验、持久化、事件分发和响应输出时，应继续拆分职责。

## 10. 类型规范

共享 MeshCentral 类型位于 `packages/meshcentral-plugins/src/types/meshcentral.types.ts`。

- 新 Hook 应先确认目标 MeshCentral 版本的真实签名，再补充共享类型。
- 只声明插件实际使用的最小接口。
- 未验证的字段使用 `unknown`，使用前执行类型收窄。
- DTO 不得直接继承完整的 MeshCentral 用户或配置对象。
- 对外状态码使用字符串联合类型，避免散落的任意字符串。
- 类型导入使用 `import type`。

MeshCentral 内部 API 不保证版本稳定。升级 MeshCentral 后必须重新核对类型、Hook 参数和行为测试。

## 11. 安全规范

插件与 MeshCentral 服务运行在同一进程，具有同等权限，必须按高权限服务端代码审查。

### 11.1 认证与授权

- 不信任浏览器提交的用户 ID、Domain ID、设备 ID 和权限字段。
- 从经过认证的 Session 或服务端连接上下文获取用户身份。
- 执行设备、用户、分组操作前检查对应权限位。
- 登录失败响应不得区分账号不存在和密码错误。
- 保留 MeshCentral 原生登录和 2FA 限流机制。
- 不得通过修改 `node_modules` 暴露 MeshCentral 内部闭包函数。

### 11.2 敏感数据

- 日志中不得记录密码、Cookie、完整 Token、TOTP Secret 或恢复码。
- 配置文件不得提交真实密钥和生产凭据。
- Session Cookie 必须使用 `httpOnly`、`secure` 和项目配置的 `sameSite`。
- 错误响应不得包含完整用户对象、数据库文档或内部异常。

### 11.3 输入与资源限制

- 为字符串、数组、请求体和上传文件设置长度上限。
- 不拼接未校验的文件路径、数据库键或命令行参数。
- 不对用户输入使用动态代码执行。
- 后台任务必须限制并发、超时和重试次数。
- 所有外部连接必须有超时和失败处理。

## 12. Session 与登录规范

自定义认证成功后，必须遵循 MeshCentral 原生 Session 约定：

1. 完成密码、2FA、账号状态、密码有效期和邮箱验证检查。
2. 清理登录过程遗留的临时 Session 字段。
3. 设置 `request.session.userid` 和 `request.session.ip`。
4. 调用 `webServer.setSessionRandom()`；兼容实现必须生成不可预测值并检查销毁列表。
5. 更新用户登录时间并持久化。
6. 分发登录事件并写入脱敏认证日志。

不得仅设置 `session.userid` 就返回成功，这会绕过 MeshCentral 的部分会话安全约束。

## 13. 前后端通信规范

通过 `serveraction` 处理浏览器消息时：

- 必须校验 `action`、`plugin`、`subAction` 和业务字段。
- 每个 `subAction` 使用独立处理方法或明确分支。
- 响应包含稳定的请求标识、状态和错误码。
- 不广播只属于当前用户的数据。
- `DispatchEvent` 的目标列表必须按用户和用户组权限构造。

浏览器导出函数必须自包含，不得引用服务端闭包、Node.js API 或 esbuild 模块辅助变量。

## 14. 数据访问规范

- 插件数据 ID 使用稳定前缀，例如 `plugin/audit/<id>`。
- 数据库访问封装在 Repository 或 Infrastructure 层。
- 写入前执行权限检查和字段白名单处理。
- 不直接修改不属于插件的 MeshCentral 文档，除非已有明确契约和回归测试。
- 批量操作应考虑部分成功、幂等性和重试行为。
- 数据结构变化必须设计兼容读取或迁移策略。

## 15. 测试规范

每个插件至少覆盖：

1. 工厂可返回有效 `MeshCentralPlugin`。
2. Hook 能正确注册，并且重复 Domain 路径不会重复注册。
3. 主要成功流程。
4. 参数为空、类型错误和超长输入。
5. 身份认证失败与权限不足。
6. MeshCentral 必需 API 缺失时的降级行为。
7. Session、数据库和事件等关键副作用。
8. 时间、随机延迟、2FA 等边界行为。
9. 响应和日志不泄露敏感信息。

测试优先调用 Service 或公开 handler 工厂。时间、延迟和随机数必须注入测试替身，不得依赖真实等待。

## 16. 构建与质量门禁

提交前必须运行：

```powershell
pnpm --filter @meshcentral/plugins test
pnpm --filter @meshcentral/plugins typecheck
pnpm --filter @meshcentral/plugins lint
pnpm --filter @meshcentral/plugins build
```

构建产物必须包含：

```text
apps/meshcentral/runtime/data/plugins/<shortName>/
  <shortName>.js
  <shortName>.js.map
  config.json
```

构建成功不等于运行兼容。涉及 MeshCentral 内部 API、Hook、Session 或认证流程时，还必须在目标 MeshCentral 版本上完成集成验证。

## 17. 配置与部署规范

- 新插件必须显式加入 `settings.plugins.list` 白名单。
- 不允许扫描目录后自动加载全部插件。
- `config.json.meshCentralCompat` 必须反映实际验证版本。
- 示例配置与生产配置分离，不提交生产凭据。
- 修改插件后需要重新构建并重启 MeshCentral。
- 发布前核对运行时挂载目录与构建输出一致。

本地开发常用命令：

```powershell
pnpm plugins:build
pnpm dev:meshcentral:restart
pnpm dev:meshcentral:status
```

## 18. 代码审查清单

提交插件代码前确认：

- 目录名、导出名、`shortName`、构建名和白名单一致。
- `index.ts` 仅承担入口适配。
- Hook 使用装饰器声明并委托到明确职责层。
- Module 使用显式依赖装配。
- 输入校验、鉴权、授权和限流未被绕过。
- 日志与响应不包含敏感信息。
- MeshCentral 内部 API 已有最小准确类型。
- 成功、失败、安全边界和副作用均有测试。
- 测试、类型检查、lint 和构建全部通过。
- 目标 MeshCentral 版本已完成必要的集成验证。

## 19. 参考实现

`jsonauth` 是当前轻量 Nest 风格参考实现：

- [入口](../../packages/meshcentral-plugins/src/plugins/jsonauth/index.ts)
- [模块装配](../../packages/meshcentral-plugins/src/plugins/jsonauth/jsonauth.module.ts)
- [插件 Hook](../../packages/meshcentral-plugins/src/plugins/jsonauth/jsonauth.plugin.ts)
- [HTTP Controller](../../packages/meshcentral-plugins/src/plugins/jsonauth/jsonauth.controller.ts)
- [登录 Service](../../packages/meshcentral-plugins/src/plugins/jsonauth/services/login.service.ts)
- [公共装饰器](../../packages/meshcentral-plugins/src/decorators/plugin.drcorator.ts)
- [公共插件工厂](../../packages/meshcentral-plugins/src/common/plugin-factory.ts)
- [行为测试](../../packages/meshcentral-plugins/src/plugins/jsonauth/index.test.ts)

新插件应优先复用这套职责划分，但应根据复杂度裁剪，不要求机械复制全部文件。
