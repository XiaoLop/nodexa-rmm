import type {
  MeshCentralServer,
  MeshCentralWebServer,
} from '../../types/meshcentral.types.js';
import {
  MeshPlugin,
  PluginHook,
} from '../../decorators/plugin.drcorator.js';
import type { JsonAuthController } from './jsonauth.controller.js';

@MeshPlugin()
export class JsonAuthPlugin {
  constructor(private readonly controller: JsonAuthController) {}

  @PluginHook('hook_setupHttpHandlers')
  setupHttpHandlers(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
  ): void {
    this.controller.register(webServer, meshServer);
  }
}