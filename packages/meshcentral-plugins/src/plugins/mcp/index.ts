import { createPluginFactory } from '../../common/plugin-factory.js';
import { createMcpModule } from './mcp.module.js';
import { McpPlugin } from './mcp.plugin.js';
import type { McpOAuthConfig } from './mcp.types.js';

export function createMcpPlugin(config: McpOAuthConfig = {}) {
  return createPluginFactory(
    McpPlugin,
    (handler) => new McpPlugin(createMcpModule(handler, config).service),
  );
}

export const mcp = createMcpPlugin();
export { McpOAuthService } from './mcp.module.js';
export type * from './mcp.types.js';
