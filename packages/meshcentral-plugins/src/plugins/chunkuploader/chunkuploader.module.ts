import type { MeshCentralPluginHandler } from '../../types/meshcentral.types.js';
import { ChunkUploadController } from './chunkuploader.controller.js';
import { ChunkUploaderPlugin } from './chunkuploader.plugin.js';
import { ChunkUploadService } from './services/chunk-upload.service.js';

export function createChunkUploaderModule(pluginHandler: MeshCentralPluginHandler) {
  const service = new ChunkUploadService(pluginHandler.parent);
  const controller = new ChunkUploadController(service, pluginHandler.parent);
  const plugin = new ChunkUploaderPlugin(controller, service);

  return {
    service,
    controller,
    plugin,
  };
}
