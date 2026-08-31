export function relayBaseUrl(gatewayUrl: string): string {
  const configured = import.meta.env.VITE_RELAY_BASE_URL?.trim();
  if (configured) return configured;

  const url = new URL(gatewayUrl);
  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/(control|control\.ashx)\/?$/i, '') || '/';
  return url.toString();
}
