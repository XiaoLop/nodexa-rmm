import { createPluginFactory } from '../../common/plugin-factory.js';
import { RmmPlugin } from './rmm.plugin.js';

export const rmm = createPluginFactory(RmmPlugin, (handler) => new RmmPlugin(handler.parent));
