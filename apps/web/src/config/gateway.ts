const DEFAULT_GATEWAY_BASE_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
const API_PREFIX = '/api';

function buildGatewayEndpoint(path: string): string {
  const baseUrl = import.meta.env.VITE_GATEWAY_WS_URL?.trim() || DEFAULT_GATEWAY_BASE_URL;
  return `${baseUrl.replace(/\/+$/, '')}${API_PREFIX}/${path.replace(/^\/+/, '')}`;
}

export const GATEWAY_LOGIN_URL = `${API_PREFIX}/login`;
export const GATEWAY_LOGOUT_URL = `${API_PREFIX}/logout`;
export const GATEWAY_CONTROL_URL = buildGatewayEndpoint('/control.ashx');
export const GATEWAY_RELAY_URL = buildGatewayEndpoint('/meshrelay.ashx');

function buildMeshAgentsUrl(): string {
  const configuredUrl = import.meta.env.VITE_MESH_AGENTS_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');

  const controlUrl = new URL(GATEWAY_CONTROL_URL);
  controlUrl.protocol = controlUrl.protocol === 'wss:' ? 'https:' : 'http:';
  controlUrl.pathname = `${API_PREFIX}/meshagents`;
  controlUrl.search = '';
  controlUrl.hash = '';
  return controlUrl.toString().replace(/\/$/, '');
}

export const MESH_AGENTS_URL = buildMeshAgentsUrl();
