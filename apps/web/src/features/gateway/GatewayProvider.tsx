import { GatewayClient, createGatewayStore, type GatewayStore } from '@meshcentral/shared-state';
import { createContext, useContext, useEffect, useMemo, type PropsWithChildren } from 'react';

interface GatewayContextValue {
  store: GatewayStore;
  client?: GatewayClient;
  configured: boolean;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

export function GatewayProvider({ children }: PropsWithChildren) {
  const value = useMemo<GatewayContextValue>(() => {
    const store = createGatewayStore();
    const url = import.meta.env.VITE_GATEWAY_WS_URL?.trim();
    if (!url) return { store, configured: false };

    return {
      store,
      configured: true,
      client: new GatewayClient({
        url,
        store,
        getAccessToken: () => import.meta.env.VITE_GATEWAY_ACCESS_TOKEN?.trim() || undefined,
      }),
    };
  }, []);

  useEffect(() => {
    if (!value.client) return;
    void value.client.connect().catch(() => undefined);
    return () => value.client?.destroy();
  }, [value]);

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway() {
  const value = useContext(GatewayContext);
  if (!value) throw new Error('useGateway must be used inside GatewayProvider.');
  return value;
}
