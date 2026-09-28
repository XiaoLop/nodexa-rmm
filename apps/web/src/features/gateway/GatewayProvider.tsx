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
  MESH_AUTH_LOGIN_URL,
  MESH_AUTH_VERIFY_TWO_FACTOR_URL,
} from '../../config/gateway';
import { requestMeshLogout } from './logout';

interface GatewaySession {
  username?: string;
}

export interface TwoFactorMethod {
  type: string;
  supported: boolean;
}

export interface TwoFactorChallenge {
  status: 'REQUIRE_2FA';
  transactionId: string;
  expiresIn: number;
  methods: TwoFactorMethod[];
}

interface AuthenticationResponse {
  code: number;
  status: string;
  message: string;
  data?: {
    transactionId?: string;
    expiresIn?: number;
    methods?: TwoFactorMethod[];
    username?: string;
  };
}

export class GatewayLoginError extends Error {
  constructor(readonly status: string, message: string) {
    super(message);
    this.name = 'GatewayLoginError';
  }
}

interface GatewayContextValue {
  store: GatewayStore;
  client?: GatewayClient;
  configured: boolean;
  authenticated: boolean;
  initializing: boolean;
  username?: string;
  gatewayUrl?: string;
  login: (
    username: string,
    password: string,
    rememberToken: boolean,
  ) => Promise<TwoFactorChallenge | undefined>;
  verifyTwoFactor: (
    challenge: TwoFactorChallenge,
    type: 'totp' | 'backup',
    code: string,
    rememberToken: boolean,
    username: string,
  ) => Promise<void>;
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

  const authenticate = useCallback(async (url: string, body: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let result: AuthenticationResponse;
    try {
      result = (await response.json()) as AuthenticationResponse;
    } catch {
      throw new GatewayLoginError('SERVER_UNAVAILABLE', 'authentication-service-unavailable');
    }
    if (typeof result.status !== 'string' || typeof result.message !== 'string') {
      throw new GatewayLoginError('SERVER_UNAVAILABLE', 'authentication-service-unavailable');
    }
    return result;
  }, []);

  const login = useCallback(
    async (username: string, password: string, rememberToken: boolean) => {
      const result = await authenticate(MESH_AUTH_LOGIN_URL, {
        username,
        password,
        rememberToken,
      });
      if (result.status === 'REQUIRE_2FA') {
        const transactionId = result.data?.transactionId;
        const expiresIn = result.data?.expiresIn;
        const methods = result.data?.methods;
        if (
          typeof transactionId !== 'string' ||
          typeof expiresIn !== 'number' ||
          !Array.isArray(methods)
        ) {
          throw new GatewayLoginError('SERVER_UNAVAILABLE', 'authentication-service-unavailable');
        }
        return { status: 'REQUIRE_2FA' as const, transactionId, expiresIn, methods };
      }
      if (result.status !== 'SUCCESS') throw new GatewayLoginError(result.status, result.message);

      try {
        await connectClient({ username: result.data?.username ?? username });
      } catch (error) {
        destroyClient();
        throw error;
      }
    },
    [authenticate, connectClient, destroyClient],
  );

  const verifyTwoFactor = useCallback(
    async (
      challenge: TwoFactorChallenge,
      type: 'totp' | 'backup',
      code: string,
      rememberToken: boolean,
      username: string,
    ) => {
      const result = await authenticate(MESH_AUTH_VERIFY_TWO_FACTOR_URL, {
        transactionId: challenge.transactionId,
        type,
        code,
        rememberToken,
      });
      if (result.status !== 'SUCCESS') throw new GatewayLoginError(result.status, result.message);
      try {
        await connectClient({ username: result.data?.username ?? username });
      } catch (error) {
        destroyClient();
        throw error;
      }
    },
    [authenticate, connectClient, destroyClient],
  );

  const logout = useCallback(async () => {
    sessionRef.current = undefined;
    setSession(undefined);
    destroyClient();
    store.getState().reset();
    try {
      await requestMeshLogout();
    } catch {
      // The local session is already closed; a failed remote logout must not keep the UI signed in.
    }
  }, [destroyClient, store]);

  const reconnect = useCallback(async () => {
    if (!sessionRef.current) throw new Error('no-active-session');
    await connectClient(sessionRef.current);
  }, [connectClient]);

  const refreshSnapshot = useCallback(async () => {
    if (!bindingRef.current) throw new Error('gateway-not-connected');
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
      verifyTwoFactor,
      logout,
      reconnect,
      refreshSnapshot,
    }),
    [
      store,
      client,
      gatewayUrl,
      session,
      initializing,
      login,
      verifyTwoFactor,
      logout,
      reconnect,
      refreshSnapshot,
    ],
  );

  return <GatewayContext.Provider value={value}>{children}</GatewayContext.Provider>;
}

export function useGateway() {
  const value = useContext(GatewayContext);
  if (!value) throw new Error('useGateway must be used inside GatewayProvider.');
  return value;
}
