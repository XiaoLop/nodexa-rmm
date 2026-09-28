import { MESH_AUTH_LOGOUT_URL } from '../../config/gateway';

interface LogoutResponse {
  status?: unknown;
}

export async function requestMeshLogout(
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(MESH_AUTH_LOGOUT_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const result = (await response.json()) as LogoutResponse;
  if (!response.ok || result.status !== 'SUCCESS') {
    throw new Error('mesh-logout-failed');
  }
}