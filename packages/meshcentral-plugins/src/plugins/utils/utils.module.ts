import type { MeshCentralPluginHandler } from '../../types/meshcentral.types.js';
import { GeoIpLocationService } from './services/geo-ip-location.service.js';
import { UtilsPlugin } from './utils.plugin.js';

export function createUtilsModule(pluginHandler: MeshCentralPluginHandler) {
  const geoIpLocationService = new GeoIpLocationService();
  return {
    geoIpLocationService,
    plugin: new UtilsPlugin(pluginHandler.parent, geoIpLocationService),
  };
}