import { createPluginFactory } from '../../common/plugin-factory.js';
import { createChunkUploaderModule } from './chunkuploader.module.js';
import { ChunkUploaderPlugin } from './chunkuploader.plugin.js';

export const chunkuploader = createPluginFactory(
  ChunkUploaderPlugin,
  (pluginHandler) => createChunkUploaderModule(pluginHandler).plugin,
);
