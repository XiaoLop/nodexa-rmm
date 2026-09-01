const DEFAULT_GATEWAY_BASE_URL = 'wss://mesh.xiaonext.com';

function buildGatewayEndpoint(path: string): string {
  const baseUrl = import.meta.env.VITE_GATEWAY_WS_URL?.trim() || DEFAULT_GATEWAY_BASE_URL;
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export const GATEWAY_CONTROL_URL = buildGatewayEndpoint('/control');
export const GATEWAY_RELAY_URL = buildGatewayEndpoint('/meshrelay.ashx');
