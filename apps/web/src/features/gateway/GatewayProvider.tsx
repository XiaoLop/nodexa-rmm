import { MeshCentralAuthenticationError, MeshCentralClient } from '@meshcentral/control-client';
import {
  bindMeshCentralClient,
  createMeshCentralControlStore,
  type MeshCentralClientBinding,
  type MeshCentralControlStore,
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
  MESH_CENTRAL_CONTROL_URL,
  MESH_AUTH_LOGIN_URL,
  MESH_AUTH_VERIFY_TWO_FACTOR_URL,
} from '../../config/gateway';
import { requestMeshLogout } from './logout';

interface MeshCentralSession {
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

export class MeshCentralLoginError extends Error {
  constructor(readonly status: string, message: string) {
    super(message);
    this.name = 'MeshCentralLoginError';
  }
}

interface MeshCentralControlContextValue {
  store: MeshCentralControlStore;
  client?: MeshCentralClient;
  configured: boolean;
  authenticated: boolean;
  initializing: boolean;
  username?: string;
  controlUrl?: string;
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

const MeshCentralControlContext = createContext<MeshCentralControlContextValue | null>(null);

export function MeshCentralControlProvider({ children }: PropsWithChildren) {
  const store = useMemo(() => createMeshCentralControlStore(), []);
  const clientRef = useRef<MeshCentralClient | undefined>(undefined);
  const bindingRef = useRef<MeshCentralClientBinding | undefined>(undefined);
  const sessionRef = useRef<MeshCentralSession | undefined>(undefined);
  const [client, setClient] = useState<MeshCentralClient | undefined>();
  const [session, setSession] = useState<MeshCentralSession | undefined>();
  const [initializing, setInitializing] = useState(true);
  const controlUrl = MESH_CENTRAL_CONTROL_URL;

  const destroyClient = useCallback(() => {
    bindingRef.current?.dispose();
    bindingRef.current = undefined;
    clientRef.current?.destroy();
    clientRef.current = undefined;
    setClient(undefined);
  }, []);

  const connectClient = useCallback(
    async (nextSession: MeshCentralSession = {}) => {
      destroyClient();
      store.getState().reset();

      const nextClient = new MeshCentralClient({
        url: controlUrl,
      });
      const binding = bindMeshCentralClient(store, nextClient);
      const unsubscribeAuthenticationError = nextClient.on('error', (error) => {
        if (!(error instanceof MeshCentralAuthenticationError)) return;
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
    [destroyClient, controlUrl, store],
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
      throw new MeshCentralLoginError('SERVER_UNAVAILABLE', 'authentication-service-unavailable');
    }
    if (typeof result.status !== 'string' || typeof result.message !== 'string') {
      throw new MeshCentralLoginError('SERVER_UNAVAILABLE', 'authentication-service-unavailable');
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
          throw new MeshCentralLoginError('SERVER_UNAVAILABLE', 'authentication-service-unavailable');
        }
        return { status: 'REQUIRE_2FA' as const, transactionId, expiresIn, methods };
      }
      if (result.status !== 'SUCCESS') throw new MeshCentralLoginError(result.status, result.message);

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
      if (result.status !== 'SUCCESS') throw new MeshCentralLoginError(result.status, result.message);
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

  const value = useMemo<MeshCentralControlContextValue>(
    () => ({
      store,
      client,
      configured: Boolean(controlUrl),
      authenticated: Boolean(session),
      initializing,
      username: session?.username,
      controlUrl,
      login,
      verifyTwoFactor,
      logout,
      reconnect,
      refreshSnapshot,
    }),
    [
      store,
      client,
      controlUrl,
      session,
      initializing,
      login,
      verifyTwoFactor,
      logout,
      reconnect,
      refreshSnapshot,
    ],
  );

  return <MeshCentralControlContext.Provider value={value}>{children}</MeshCentralControlContext.Provider>;
}

export function useMeshCentralControl() {
  const value = useContext(MeshCentralControlContext);
  if (!value) throw new Error('useMeshCentralControl must be used inside MeshCentralControlProvider.');
  return value;
}
