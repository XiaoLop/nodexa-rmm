import {
  MESH_AUTH_CAN_REGISTER_URL,
  MESH_AUTH_REGISTER_URL,
} from '../../config/gateway';

export interface RegistrationAvailability {
  allowed: boolean;
  isFirstUser: boolean;
  domain?: string;
  userCount?: number;
  requiresToken?: boolean;
  requiresCaptcha?: boolean;
  reason?: string;
}

export async function requestRegistrationAvailability(
  fetcher: typeof fetch = fetch,
): Promise<RegistrationAvailability> {
  const response = await fetcher(MESH_AUTH_CAN_REGISTER_URL, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  const result = (await response.json()) as Partial<RegistrationAvailability>;
  if (!response.ok || typeof result.allowed !== 'boolean') {
    throw new Error('registration-availability-unavailable');
  }
  return result as RegistrationAvailability;
}

export interface RegistrationRequest {
  username: string;
  email: string;
  password: string;
  token?: string;
}

interface RegistrationResponse {
  status?: unknown;
  message?: unknown;
  data?: {
    id?: unknown;
    username?: unknown;
    email?: unknown;
    isAdmin?: unknown;
  };
}

export class RegistrationError extends Error {
  constructor(readonly status: string, message: string) {
    super(message);
    this.name = 'RegistrationError';
  }
}

export async function registerMeshUser(
  registration: RegistrationRequest,
  fetcher: typeof fetch = fetch,
): Promise<{ id: string; username: string; email: string; isAdmin: boolean }> {
  const response = await fetcher(MESH_AUTH_REGISTER_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registration),
  });
  let result: RegistrationResponse;
  try {
    result = (await response.json()) as RegistrationResponse;
  } catch {
    throw new RegistrationError('SERVER_UNAVAILABLE', 'registration-service-unavailable');
  }
  if (result.status !== 'SUCCESS') {
    throw new RegistrationError(
      typeof result.status === 'string' ? result.status : 'SERVER_UNAVAILABLE',
      typeof result.message === 'string' ? result.message : 'registration-service-unavailable',
    );
  }
  const data = result.data;
  if (
    !response.ok ||
    typeof data?.id !== 'string' ||
    typeof data.username !== 'string' ||
    typeof data.email !== 'string' ||
    typeof data.isAdmin !== 'boolean'
  ) {
    throw new RegistrationError('SERVER_UNAVAILABLE', 'registration-service-unavailable');
  }
  return {
    id: data.id,
    username: data.username,
    email: data.email,
    isAdmin: data.isAdmin,
  };
}