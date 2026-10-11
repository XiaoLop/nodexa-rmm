import {
  MeshPlugin,
  PluginHook,
} from '../../decorators/plugin.drcorator.js';
import type {
  MeshCentralServer,
  MeshCentralWebServer,
} from '../../types/meshcentral.types.js';
import type { ChunkUploadController } from './chunkuploader.controller.js';
import type { ChunkUploadService } from './services/chunk-upload.service.js';

@MeshPlugin()
export class ChunkUploaderPlugin {
  constructor(
    private readonly controller: ChunkUploadController,
    private readonly service: ChunkUploadService,
  ) {}

  @PluginHook('server_startup')
  serverStartup(): void {
    console.log('[chunkuploader] Chunk Uploader Plugin started');
    void this.service.cleanExpiredTempChunks().catch((err: unknown) => {
      console.warn('[chunkuploader] Failed to clean expired temp chunks:', err);
    });
  }

  @PluginHook('hook_setupHttpHandlers')
  setupHttpHandlers(
    webServer: MeshCentralWebServer,
    _meshServer: MeshCentralServer,
  ): void {
    void _meshServer;
    this.controller.register(webServer);
  }
}
