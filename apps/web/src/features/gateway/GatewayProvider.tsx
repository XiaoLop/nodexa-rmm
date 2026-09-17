import { GatewayAuthenticationError, GatewayClient } from '@meshcentral/control-client';
import {
  bindGatewayClient,
  createGatewayStore,
  type GatewayClientBinding,
  type GatewayStore,
} from '@meshcentral/shared-state';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  GATEWAY_CONTROL_URL,
  GATEWAY_LOGIN_URL,
  GATEWAY_LOGOUT_URL,
} from '../../config/gateway';

interface GatewaySession {
  username?: string;
}

interface GatewayContextValue {
  store: GatewayStore;
  client?: GatewayClient;
  configured: boolean;
  authenticated: boolean;
  initializing: boolean;
  username?: string;
  gatewayUrl?: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reconnect: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

export function GatewayProvider({ children }: PropsWithChildren) {
  const store = useMemo(() => createGatewayStore(), []);
  const clientRef = useRef<GatewayClient | undefined>(undefined);
  const bindingRef = useRef<GatewayClientBinding | undefined>(undefined);
  const sessionRef = useRef<GatewaySession | undefined>(undefined);
  const [client, setClient] = useState<GatewayClient | undefined>();
  const [session, setSession] = useState<GatewaySession | undefined>();
  const [initializing, setInitializing] = useState(true);
  const gatewayUrl = GATEWAY_CONTROL_URL;

  const destroyClient = useCallback(() => {
    bindingRef.current?.dispose();
    bindingRef.current = undefined;
    clientRef.current?.destroy();
    clientRef.current = undefined;
    setClient(undefined);
  }, []);

  const connectClient = useCallback(
    async (nextSession: GatewaySession = {}) => {
      destroyClient();
      store.getState().reset();

      const nextClient = new GatewayClient({
        url: gatewayUrl,
      });
      const binding = bindGatewayClient(store, nextClient);
      const unsubscribeAuthenticationError = nextClient.on('error', (error) => {
        if (!(error instanceof GatewayAuthenticationError)) return;
        sessionRef.current = undefined;
        setSession(undefined);
      });
      bindingRef.current = {
        sync: () => binding.sync(),
        dispose: () => {
          unsubscribeAuthenticationError();
          binding.dispose();
        },
      };
      clientRef.current = nextClient;
      setClient(nextClient);

      await nextClient.connect();
      sessionRef.current = nextSession;
      setSession(nextSession);
    },
    [destroyClient, gatewayUrl, store],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      const response = await fetch(GATEWAY_LOGIN_URL, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ action: 'login', username, password }),
      });

      if (!response.ok) throw new GatewayAuthenticationError('登录失败，请检查用户名和密码。');

      try {
        await connectClient({ username });
      } catch (error) {
        destroyClient();
        throw error;
      }
    },
    [connectClient, destroyClient],
  );

  const logout = useCallback(async () => {
    sessionRef.current = undefined;
    setSession(undefined);
    destroyClient();
    store.getState().reset();
    try {
      await fetch(GATEWAY_LOGOUT_URL, { credentials: 'include' });
    } catch {
      // The local session is already closed; a failed remote logout must not keep the UI signed in.
    }
  }, [destroyClient, store]);

  const reconnect = useCallback(async () => {
    if (!sessionRef.current) throw new Error('当前没有可用的登录会话。');
    await connectClient(sessionRef.current);
  }, [connectClient]);

  const refreshSnapshot = useCallback(async () => {
    if (!bindingRef.current) throw new Error('网关未连接，无法刷新数据。');
    await bindingRef.current.sync();
  }, []);

useEffect(() => {
  let mounted = true;

  const timer = window.setTimeout(() => {
    void connectClient()
      .catch(() => {
        if (!mounted) return;

        sessionRef.current = undefined;
        setSession(undefined);
        destroyClient();
      })
      .finally(() => {
        if (mounted) setInitializing(false);
      });
  }, 0);

  return () => {
    mounted = false;
    window.clearTimeout(timer);
    destroyClient();
  };
}, [connectClient, destroyClient]);

  useEffect(() => {
    const handleOnline = () => {
      const currentClient = clientRef.current;
      if (currentClient && store.getState().status !== 'connected') {
        void currentClient.connect().catch(() => undefined);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [store]);

  const value = useMemo<GatewayContextValue>(
    () => ({
      store,
      client,
      configured: Boolean(gatewayUrl),
      authenticated: Boolean(session),
      initializing,
      username: session?.username,
      gatewayUrl,
      login,
      logout,
      reconnect,
      refreshSnapshot,
    }),
    [store, client, gatewayUrl, session, initializing, login, logout, reconnect, refreshSnapshot],
  );

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway() {
  const value = useContext(GatewayContext);
  if (!value) throw new Error('useGateway must be used inside GatewayProvider.');
  return value;
}
