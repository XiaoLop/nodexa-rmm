import type { RelayProtocol, RelayUrlOptions } from './types';

function normalizeRelayUrl(baseUrl: string): URL {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'http:' ? 'ws:' : url.protocol === 'https:' ? 'wss:' : url.protocol;
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new TypeError('Relay base URL must use http, https, ws or wss.');
  }

  if (!url.pathname.endsWith('/meshrelay.ashx')) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/meshrelay.ashx`;
  }
  url.search = '';
  url.hash = '';
  return url;
}

export function buildRelayUrl(options: RelayUrlOptions): string {
  const url = normalizeRelayUrl(options.baseUrl);
  url.searchParams.set('browser', '1');
  url.searchParams.set('p', String(options.protocol));
  url.searchParams.set('nodeid', options.deviceId);
  url.searchParams.set('id', options.relayId);
  url.searchParams.set('auth', options.authCookie);
  return url.toString();
}

export function buildAgentRelayPath(
  deviceId: string,
  protocol: RelayProtocol,
  relayId: string,
  relayCookie: string,
): string {
  const params = new URLSearchParams({
    p: String(protocol),
    nodeid: deviceId,
    id: relayId,
    rauth: relayCookie,
  });
  return `*/meshrelay.ashx?${params.toString()}`;
}
