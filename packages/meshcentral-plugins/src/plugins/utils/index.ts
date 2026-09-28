import { createPluginFactory } from '../../common/plugin-factory.js';
import { createUtilsModule } from './utils.module.js';
import { UtilsPlugin } from './utils.plugin.js';

export const utils = createPluginFactory(
  UtilsPlugin,
  (pluginHandler) => createUtilsModule(pluginHandler).plugin,
);