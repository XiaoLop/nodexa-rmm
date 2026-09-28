import type { MeshCentralPluginHandler } from '../../types/meshcentral.types.js';
import { UtilsPlugin } from './utils.plugin.js';

export function createUtilsModule(pluginHandler: MeshCentralPluginHandler) {
  return { plugin: new UtilsPlugin(pluginHandler.parent) };
}