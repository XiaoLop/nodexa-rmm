# MeshCentral Plugins

本包使用 TypeScript 开发本地 MeshCentral 插件，并将 CommonJS 产物部署到：

```text
apps/meshcentral/runtime/data/plugins/<shortName>/
```

完整的目录约定、插件类型、通信方式、构建流程和调试方法参见 [插件开发指南](docs/plugin-development.md)。

## 源码结构

```text
src/
  common/       # 公共方法、适配器和工厂
  decorators/   # 公共装饰器，文件名使用 <功能>.drcorator.ts
  types/        # 跨插件共享类型
  plugins/      # 构建并发布的插件
```

## 新增插件

在 `src/plugins` 下创建与 `shortName` 同名的目录：

```text
src/plugins/example/
  example.module.ts
  example.plugin.ts
  index.ts
  config.json
```

`example.plugin.ts` 使用公共装饰器声明 Hook：

```typescript
import { MeshPlugin, PluginHook } from '../../decorators/plugin.drcorator.js';

@MeshPlugin()
export class ExamplePlugin {
  @PluginHook('server_startup')
  serverStartup(): void {
    console.log('[example] Plugin started');
  }
}
```

`example.module.ts` 显式装配插件实例：

```typescript
import type { MeshCentralPluginHandler } from '../../types/meshcentral.types.js';
import { ExamplePlugin } from './example.plugin.js';

export function createExampleModule(_pluginHandler: MeshCentralPluginHandler) {
  return { plugin: new ExamplePlugin() };
}
```

`index.ts` 必须导出与目录同名的插件工厂：

```typescript
import { createPluginFactory } from '../../common/plugin-factory.js';
import { createExampleModule } from './example.module.js';
import { ExamplePlugin } from './example.plugin.js';

export const example = createPluginFactory(
  ExamplePlugin,
  (pluginHandler) => createExampleModule(pluginHandler).plugin,
);
```

同时将插件名加入 MeshCentral 配置的 `settings.plugins.list`。

## 常用命令

```powershell
pnpm --filter @meshcentral/plugins test
pnpm --filter @meshcentral/plugins lint
pnpm plugins:build
pnpm plugins:typecheck
pnpm dev:meshcentral:restart-with-plugins
```

构建脚本会将每个插件打包为单个 CommonJS 文件，并复制对应的 `config.json`。MeshCentral 重启时会从数据目录自动加载白名单内的插件。
