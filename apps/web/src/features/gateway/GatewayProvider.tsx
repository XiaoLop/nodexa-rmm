import { GatewayClient, createGatewayStore, type GatewayStore } from '@meshcentral/shared-state';
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

const AUTH_STORAGE_KEY = 'meshcentral.web.auth';
const DEFAULT_GATEWAY_URL = 'wss://mesh.xiaonext.com/control';

interface GatewayCredentials {
  authParam: string;
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
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
  reconnect: () => Promise<void>;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

function readStoredCredentials(): GatewayCredentials | undefined {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Partial<GatewayCredentials>;
    if (typeof parsed.authParam !== 'string' || !parsed.authParam) throw new Error('Invalid auth');
    return {
      authParam: parsed.authParam,
      username: typeof parsed.username === 'string' ? parsed.username : undefined,
    };
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return undefined;
  }
}

export function GatewayProvider({ children }: PropsWithChildren) {
  const store = useMemo(() => createGatewayStore(), []);
  const clientRef = useRef<GatewayClient | undefined>(undefined);
  const credentialsRef = useRef<GatewayCredentials | undefined>(undefined);
  const [client, setClient] = useState<GatewayClient | undefined>();
  const [credentials, setCredentials] = useState<GatewayCredentials | undefined>();
  const [initializing, setInitializing] = useState(true);
  const gatewayUrl = import.meta.env.VITE_GATEWAY_WS_URL?.trim() || DEFAULT_GATEWAY_URL;

  const destroyClient = useCallback(() => {
    clientRef.current?.destroy();
    clientRef.current = undefined;
    setClient(undefined);
  }, []);

  const connectClient = useCallback(
    async (nextCredentials: GatewayCredentials) => {
      destroyClient();
      store.getState().reset();
      credentialsRef.current = nextCredentials;
      setCredentials(nextCredentials);

      const separator = gatewayUrl.includes('?') ? '&' : '?';
      const nextClient = new GatewayClient({
        url: `${gatewayUrl}${separator}x-meshauth=${nextCredentials.authParam}`,
        store,
        getAccessToken: () => import.meta.env.VITE_GATEWAY_ACCESS_TOKEN?.trim() || undefined,
      });
      clientRef.current = nextClient;
      setClient(nextClient);

      try {
        await nextClient.connect();
      } catch (error) {
        nextClient.destroy();
        clientRef.current = undefined;
        setClient(undefined);
        throw error;
      }
    },
    [destroyClient, gatewayUrl, store],
  );

  const login = useCallback(
    async (username: string, password: string, remember: boolean) => {
      const authParam = encodeURIComponent(`${btoa(username)},${btoa(password)}`);
      const nextCredentials: GatewayCredentials = { authParam, username };
      await connectClient(nextCredentials);

      if (remember) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextCredentials));
      else localStorage.removeItem(AUTH_STORAGE_KEY);
    },
    [connectClient],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    credentialsRef.current = undefined;
    setCredentials(undefined);
    destroyClient();
    store.getState().reset();
  }, [destroyClient, store]);

  const reconnect = useCallback(async () => {
    if (!credentialsRef.current) throw new Error('当前没有可用的登录凭据。');
    await connectClient(credentialsRef.current);
  }, [connectClient]);

  useEffect(() => {
    const storedCredentials = readStoredCredentials();
    if (!storedCredentials) {
      setInitializing(false);
      return;
    }

    void connectClient(storedCredentials)
      .catch(() => {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        credentialsRef.current = undefined;
        setCredentials(undefined);
      })
      .finally(() => setInitializing(false));

    return destroyClient;
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
      authenticated: Boolean(credentials),
      initializing,
      username: credentials?.username,
      gatewayUrl,
      login,
      logout,
      reconnect,
    }),
    [store, client, gatewayUrl, credentials, initializing, login, logout, reconnect],
  );

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway() {
  const value = useContext(GatewayContext);
  if (!value) throw new Error('useGateway must be used inside GatewayProvider.');
  return value;
}