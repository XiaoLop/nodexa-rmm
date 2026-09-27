# MeshCentral Plugins

本包使用 TypeScript 开发本地 MeshCentral 插件，并将 CommonJS 产物部署到：

```text
apps/meshcentral/runtime/data/plugins/<shortName>/
```

完整的目录约定、插件类型、通信方式、构建流程和调试方法参见 [插件开发指南](docs/plugin-development.md)。

## 新增插件

在 `src` 下创建与 `shortName` 同名的目录：

```text
src/example/
  index.ts
  config.json
```

`index.ts` 必须导出与目录同名的插件工厂：

```typescript
import type { MeshCentralPluginFactory } from '../types.js';

export const example: MeshCentralPluginFactory = () => ({
  exports: [],
});
```

同时将插件名加入 MeshCentral 配置的 `settings.plugins.list`。

## 常用命令

```powershell
pnpm plugins:build
pnpm plugins:typecheck
pnpm dev:meshcentral:restart-with-plugins
```

构建脚本会将每个插件打包为单个 CommonJS 文件，并复制对应的 `config.json`。MeshCentral 重启时会从数据目录自动加载白名单内的插件。
