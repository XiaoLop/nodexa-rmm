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
import { GATEWAY_CONTROL_URL } from '../../config/gateway';

const AUTH_STORAGE_KEY = 'meshcentral.web.auth';

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
  const bindingRef = useRef<GatewayClientBinding | undefined>(undefined);
  const credentialsRef = useRef<GatewayCredentials | undefined>(undefined);
  const [client, setClient] = useState<GatewayClient | undefined>();
  const [credentials, setCredentials] = useState<GatewayCredentials | undefined>();
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
    async (nextCredentials: GatewayCredentials) => {
      destroyClient();
      store.getState().reset();
      credentialsRef.current = nextCredentials;
      setCredentials(nextCredentials);

      const separator = gatewayUrl.includes('?') ? '&' : '?';
      const nextClient = new GatewayClient({
        url: `${gatewayUrl}${separator}x-meshauth=${nextCredentials.authParam}`,
        getAccessToken: () => import.meta.env.VITE_GATEWAY_ACCESS_TOKEN?.trim() || undefined,
      });
      const binding = bindGatewayClient(store, nextClient);
      const unsubscribeAuthenticationError = nextClient.on('error', (error) => {
        if (!(error instanceof GatewayAuthenticationError)) return;
        localStorage.removeItem(AUTH_STORAGE_KEY);
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
        credentialsRef.current = undefined;
        setCredentials(undefined);
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
    },
    [destroyClient, gatewayUrl, store],
  );

  const login = useCallback(
    async (username: string, password: string, remember: boolean) => {
      const authParam = encodeURIComponent(`${btoa(username)},${btoa(password)}`);
      const nextCredentials: GatewayCredentials = { authParam, username };

      try {
        await connectClient(nextCredentials);
      } catch (error) {
        destroyClient();
        throw error;
      }

      if (remember) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextCredentials));
        sessionStorage.removeItem(AUTH_STORAGE_KEY);
      } else {
        sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextCredentials));
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    },
    [connectClient, destroyClient],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
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

    let mounted = true;

    void connectClient(storedCredentials)
      .catch((error) => {
        if (!mounted) return;
        if (error instanceof GatewayAuthenticationError) {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          sessionStorage.removeItem(AUTH_STORAGE_KEY);
          credentialsRef.current = undefined;
          setCredentials(undefined);
        }
      })
      .finally(() => {
        if (mounted) setInitializing(false);
      });

    return () => {
      mounted = false;
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
