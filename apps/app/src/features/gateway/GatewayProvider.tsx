import { GatewayClient, createGatewayStore, type GatewayStore } from '@meshcentral/shared-state';
import { AppState, type AppStateStatus } from 'react-native';
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
    const url = process.env.EXPO_PUBLIC_GATEWAY_WS_URL?.trim();
    if (!url) return { store, configured: false };

    return {
      store,
      configured: true,
      client: new GatewayClient({
        url,
        store,
        getAccessToken: () => process.env.EXPO_PUBLIC_GATEWAY_ACCESS_TOKEN?.trim() || undefined,
      }),
    };
  }, []);

  useEffect(() => {
    const client = value.client;
    if (!client) return;
    void client.connect().catch(() => undefined);

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'active' && value.store.getState().status !== 'connected') {
        void client.connect().catch(() => undefined);
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      subscription.remove();
      client.destroy();
    };
  }, [value]);

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway() {
  const value = useContext(GatewayContext);
  if (!value) throw new Error('useGateway must be used inside GatewayProvider.');
  return value;
}
