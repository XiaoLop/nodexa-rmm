import type { MeshCentralPluginFactory } from '../types.js';

export const testplugin: MeshCentralPluginFactory = () => {
  return {
    exports: [],
    server_startup() {
      console.log('[testplugin] Plugin started');
    },
    serveraction(command, connection) {
      if (command.subAction !== 'ping') return;

      connection.send({
        action: 'plugin',
        plugin: 'testplugin',
        response: 'pong',
      });
    },
  };
};