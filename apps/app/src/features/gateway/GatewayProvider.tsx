import { GatewayAuthenticationError, GatewayClient } from '@meshcentral/control-client';
import {
  bindGatewayClient,
  createGatewayStore,
  type GatewayClientBinding,
  type GatewayStore,
} from '@meshcentral/shared-state';
import { AppState, type AppStateStatus } from 'react-native';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { encode as btoa } from 'base-64';
import { router, useSegments } from 'expo-router';

const AUTH_STORAGE_KEY = '@mesh_auth';
const DEFAULT_GATEWAY_URL = 'wss://mesh.xiaonext.com/control';

interface GatewayCredentials {
  authParam: string;
  username?: string;
}

interface GatewayContextValue {
  store: GatewayStore;
  client?: GatewayClient;
  configured: boolean;
  username?: string;
  login: (username: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
  reconnect: () => Promise<void>;
}

const GatewayContext = createContext<GatewayContextValue | null>(null);

export function GatewayProvider({ children }: PropsWithChildren) {
  const store = useMemo(() => createGatewayStore(), []);
  const [client, setClient] = useState<GatewayClient | undefined>();
  const [configured, setConfigured] = useState(false);
  const [username, setUsername] = useState<string | undefined>();
  const segments = useSegments();
  const clientRef = useRef<GatewayClient | undefined>(undefined);
  const bindingRef = useRef<GatewayClientBinding | undefined>(undefined);
  const credentialsRef = useRef<GatewayCredentials | undefined>(undefined);
  const segmentsRef = useRef(segments);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const destroyClient = useCallback(() => {
    bindingRef.current?.dispose();
    bindingRef.current = undefined;
    clientRef.current?.destroy();
    clientRef.current = undefined;
    setClient(undefined);
  }, []);

  const connectClient = useCallback(
    async (credentials: GatewayCredentials, validateLogin = false) => {
      const url = process.env.EXPO_PUBLIC_GATEWAY_WS_URL?.trim() || DEFAULT_GATEWAY_URL;
      setConfigured(Boolean(url));
      credentialsRef.current = credentials;
      setUsername(credentials.username);
      destroyClient();
      store.getState().reset();

      const separator = url.includes('?') ? '&' : '?';
      const wsUrl = `${url}${separator}x-meshauth=${credentials.authParam}`;

      const newClient = new GatewayClient({
        url: wsUrl,
        getAccessToken: () => process.env.EXPO_PUBLIC_GATEWAY_ACCESS_TOKEN?.trim() || undefined,
      });
      const binding = bindGatewayClient(store, newClient);
      const unsubscribeAuthenticationError = newClient.on('error', (error) => {
        if (!(error instanceof GatewayAuthenticationError)) return;
        credentialsRef.current = undefined;
        void AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        if (segmentsRef.current[0] !== 'login') router.replace('/login');
      });
      bindingRef.current = {
        sync: () => binding.sync(),
        dispose: () => {
          unsubscribeAuthenticationError();
          binding.dispose();
        },
      };

      clientRef.current = newClient;
      setClient(newClient);

      await newClient.connect().catch((error) => {
        destroyClient();
        if (validateLogin && error instanceof GatewayAuthenticationError) {
          throw new Error(error.message === 'tokenrequired' ? '需要二次验证' : '账号或密码错误');
        }
        throw error;
      });
    },
    [destroyClient, store],
  );

  const login = useCallback(
    async (username: string, password: string, remember: boolean) => {
      const authParam = encodeURIComponent(`${btoa(username)},${btoa(password)}`);
      const credentials: GatewayCredentials = { authParam, username };
      await connectClient(credentials, true);
      if (remember) {
        await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(credentials));
      } else {
        await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
      }
    },
    [connectClient],
  );

  const logout = useCallback(async () => {
    credentialsRef.current = undefined;
    setUsername(undefined);
    destroyClient();
    store.getState().reset();
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    router.replace('/login');
  }, [destroyClient, store]);

  const reconnect = useCallback(async () => {
    const credentials = credentialsRef.current;
    if (!credentials) {
      router.replace('/login');
      return;
    }
    await connectClient(credentials);
  }, [connectClient]);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(AUTH_STORAGE_KEY).then((storedAuth) => {
      if (cancelled) return;
      if (!storedAuth) {
        if (segmentsRef.current[0] !== 'login') router.replace('/login');
        return;
      }

      try {
        const parsed = JSON.parse(storedAuth) as Partial<GatewayCredentials> & {
          username?: string;
          password?: string;
        };
        let authParam = parsed.authParam;
        let uname = parsed.username;
        if (!authParam && parsed.username && parsed.password) {
          authParam = encodeURIComponent(`${btoa(parsed.username)},${btoa(parsed.password)}`);
        }
        if (!uname && authParam) {
          try {
            const decoded = decodeURIComponent(authParam);
            const firstPart = decoded.split(',')[0];
            if (firstPart && typeof atob === 'function') {
              uname = atob(firstPart);
            }
          } catch {
            // 保留服务端返回的认证参数，用户名仅用于界面展示。
          }
        }
        if (!authParam) throw new Error('Invalid auth');

        const credentials: GatewayCredentials = { authParam, username: uname };
        void connectClient(credentials).catch(() => undefined);
      } catch {
        void AsyncStorage.removeItem(AUTH_STORAGE_KEY);
        router.replace('/login');
      }
    });

    return () => {
      cancelled = true;
      destroyClient();
    };
  }, [connectClient, destroyClient]);

  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      const currentClient = clientRef.current;
      if (nextState === 'active' && currentClient && store.getState().status !== 'connected') {
        void currentClient.connect().catch(() => undefined);
      }
    };
    const subscription = AppState.addEventListener('change', handleAppState);
    return () => subscription.remove();
  }, [store]);

  const value = useMemo(
    () => ({
      store,
      client,
      configured,
      username,
      login,
      logout,
      reconnect,
    }),
    [store, client, configured, username, login, logout, reconnect],
  );

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway() {
  const value = useContext(GatewayContext);
  if (!value) throw new Error('useGateway must be used inside GatewayProvider.');
  return value;
}
