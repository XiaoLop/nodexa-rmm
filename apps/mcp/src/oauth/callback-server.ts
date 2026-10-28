import { createServer, type Server } from 'node:http';

export interface OAuthCallback {
  readonly code: string;
  readonly state: string;
}

export async function waitForOAuthCallback(
  expectedState: string,
): Promise<{ redirectUri: string; callback: Promise<OAuthCallback> }> {
  let resolveCallback: (value: OAuthCallback) => void = () => undefined;
  let rejectCallback: (error: Error) => void = () => undefined;
  const callback = new Promise<OAuthCallback>((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });
  const server: Server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname !== '/oauth/callback') {
        response.statusCode = 404;
        response.end('Not found');
        return;
      }
      const error = url.searchParams.get('error');
      if (error) {
        response.statusCode = 400;
        response.end('Authorization failed. You may close this window.');
        rejectCallback(new Error(error));
        void closeServer(server);
        return;
      }
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (!code || !state || state !== expectedState) {
        response.statusCode = 400;
        response.end('Invalid OAuth callback. You may close this window.');
        rejectCallback(new Error('Invalid OAuth callback state.'));
        void closeServer(server);
        return;
      }
      response.end('Authorization complete. You may close this window.');
      resolveCallback({ code, state });
      void closeServer(server);
    } catch (error) {
      rejectCallback(error instanceof Error ? error : new Error(String(error)));
      void closeServer(server);
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('Could not start OAuth callback server.');
  return { redirectUri: `http://127.0.0.1:${address.port}/oauth/callback`, callback };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
