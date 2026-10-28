import { MeshPlugin, PluginHook } from '../../decorators/plugin.drcorator.js';
import type {
  MeshCentralHttpRequest,
  MeshCentralHttpResponse,
  MeshCentralServer,
  MeshCentralWebServer,
} from '../../types/meshcentral.types.js';
import type { McpOAuthService } from './mcp.module.js';

@MeshPlugin()
export class McpPlugin {
  constructor(private readonly oauth: McpOAuthService) {}
  @PluginHook('hook_setupHttpHandlers')
  setupHttpHandlers(webServer: MeshCentralWebServer, meshServer: MeshCentralServer): void {
    const base = this.oauth.config.basePath ?? '/mcp';
    const issuer = this.oauth.config.issuer ?? base;
    const json = webServer.bodyParser?.json?.({ limit: '16kb' });
    const form = webServer.bodyParser?.urlencoded?.({ extended: false, limit: '16kb' });
    webServer.app.get(
      `${base}/.well-known/oauth-authorization-server`,
      (_req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) =>
        res.json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          revocation_endpoint: `${issuer}/revoke`,
          response_types_supported: ['code'],
          grant_types_supported: ['authorization_code', 'refresh_token'],
          code_challenge_methods_supported: ['S256'],
          scopes_supported: this.oauth.config.scopes,
        }),
    );
    webServer.app.get(
      `${base}/.well-known/oauth-protected-resource`,
      (_req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) =>
        res.json({
          resource: issuer,
          authorization_servers: [issuer],
          scopes_supported: this.oauth.config.scopes,
        }),
    );
    webServer.app.get(
      `${base}/authorize`,
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => this.authorize(req, res),
    );
    webServer.app.post(
      `${base}/token`,
      ...(json ? [json] : []),
      ...(form ? [form] : []),
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => this.token(req, res),
    );
    webServer.app.post(
      `${base}/revoke`,
      ...(json ? [json] : []),
      ...(form ? [form] : []),
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => {
        this.oauth.revoke(String((req.body as Record<string, unknown>)?.token ?? ''));
        res.status(200).json({});
      },
    );
    // Attach the guard per business route: a prefix-level app.use would also match
    // unknown sub-paths and mask real routing mistakes behind a misleading 401.
    const requireAuth = (
      req: MeshCentralHttpRequest,
      res: MeshCentralHttpResponse,
      next?: () => void,
    ): void => {
      const raw = req.headers.authorization;
      const header = Array.isArray(raw) ? raw[0] : raw;
      if (!header?.startsWith('Bearer ') || !this.oauth.authenticate(header.slice(7))) {
        res.set({ 'WWW-Authenticate': 'Bearer' });
        res.status(401).json({ error: 'invalid_token' });
        return;
      }
      next?.();
    };
    // Keep the business API deliberately read-only and expose stable, curated shapes.
    webServer.app.get(
      `${base}/health`,
      requireAuth,
      (_req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => res.json({ ok: true }),
    );
    webServer.app.get(
      `${base}/capabilities`,
      requireAuth,
      (_req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) =>
        res.json({
          readOnly: true,
          resources: ['devices', 'groups', 'events', 'server-status'],
        }),
    );
    webServer.app.get(
      `${base}/devices`,
      requireAuth,
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) =>
        res.json({ devices: this.listDevices(meshServer, req) }),
    );
    webServer.app.get(
      `${base}/devices/:id`,
      requireAuth,
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => {
        const device = this.listDevices(meshServer, req).find((item) => item.id === req.params?.id);
        if (!device) return res.status(404).json({ error: 'not_found' });
        return res.json({ device });
      },
    );
    webServer.app.get(
      `${base}/groups`,
      requireAuth,
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) =>
        res.json({ groups: this.listGroups(meshServer, req) }),
    );
    webServer.app.get(
      `${base}/events`,
      requireAuth,
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) =>
        res.json({ events: this.listEvents(meshServer, req) }),
    );
    webServer.app.get(
      `${base}/server/status`,
      requireAuth,
      (_req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) =>
        res.json(this.serverStatus(meshServer)),
    );
  }

  private listDevices(
    meshServer: MeshCentralServer,
    request: MeshCentralHttpRequest,
  ): Array<Record<string, unknown>> {
    void request;
    const source = this.arrayValue(meshServer, ['nodes', 'devices']);
    return source
      .map((value) => {
        const item = this.record(value);
        return {
          id: this.stringValue(item, ['_id', 'id', 'nodeid']) ?? '',
          name: this.stringValue(item, ['name', 'computerName']) ?? null,
          groupId: this.stringValue(item, ['meshid', 'groupId']) ?? null,
          state: this.stringValue(item, ['state', 'status']) ?? null,
          connected: typeof item.connected === 'boolean' ? item.connected : null,
        };
      })
      .filter((item) => item.id !== '');
  }

  private listGroups(
    meshServer: MeshCentralServer,
    request: MeshCentralHttpRequest,
  ): Array<Record<string, unknown>> {
    void request;
    return this.arrayValue(meshServer, ['meshes', 'groups'])
      .map((value) => {
        const item = this.record(value);
        return {
          id: this.stringValue(item, ['_id', 'id', 'meshid', 'groupId']) ?? '',
          name: this.stringValue(item, ['name', 'meshname']) ?? null,
          deviceCount: typeof item.deviceCount === 'number' ? item.deviceCount : null,
        };
      })
      .filter((item) => item.id !== '');
  }

  private listEvents(
    meshServer: MeshCentralServer,
    req: MeshCentralHttpRequest,
  ): Array<Record<string, unknown>> {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    return this.arrayValue(meshServer, ['events', 'eventLog'])
      .map((value) => {
        const item = this.record(value);
        return {
          id: this.stringValue(item, ['id', '_id']) ?? null,
          type: this.stringValue(item, ['type', 'action']) ?? null,
          timestamp: this.stringValue(item, ['timestamp', 'time', 'date']) ?? null,
          deviceId: this.stringValue(item, ['nodeid', 'deviceId']) ?? null,
          message: this.stringValue(item, ['message', 'msg']) ?? null,
        };
      })
      .filter((item) => !type || item.type === type)
      .slice(0, 100);
  }

  private serverStatus(meshServer: MeshCentralServer): Record<string, unknown> {
    const settings = this.record(meshServer.config?.settings);
    return {
      status: 'ok',
      version: typeof settings.version === 'string' ? settings.version : null,
      domainCount: Object.keys(meshServer.config?.domains ?? {}).length,
      uptimeSeconds: typeof process.uptime === 'function' ? Math.floor(process.uptime()) : null,
    };
  }

  private arrayValue(source: object, keys: string[]): unknown[] {
    for (const key of keys) {
      const value = (source as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
      if (value && typeof value === 'object') return Object.values(value);
    }
    return [];
  }

  private record(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private stringValue(record: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) if (typeof record[key] === 'string') return record[key] as string;
    return undefined;
  }

  private authorize(req: MeshCentralHttpRequest, res: MeshCentralHttpResponse): void {
    const q = req.query;
    const userId = req.session?.userid;
    const redirectUri = String(q.redirect_uri ?? '');
    const client = this.oauth.config.clients?.find(
      (c) =>
        c.clientId === q.client_id &&
        c.redirectUris.some((uri) => isRedirectUriAllowed(uri, redirectUri)),
    );
    if (!userId) {
      res.set({ 'WWW-Authenticate': 'Session' });
      res.status(401).json({
        error: 'login_required',
        error_description: 'Sign in to MeshCentral in this browser before authorizing MCP.',
      });
      return;
    }
    if (!client) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'The OAuth client or redirect URI is not registered.',
      });
      return;
    }
    if (
      q.response_type !== 'code' ||
      q.code_challenge_method !== 'S256' ||
      typeof q.code_challenge !== 'string'
    ) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Authorization Code with PKCE S256 is required.',
      });
      return;
    }
    const code = this.oauth.registerCode({
      clientId: client.clientId,
      redirectUri: String(q.redirect_uri),
      userId,
      codeChallenge: q.code_challenge,
      scope: String(q.scope ?? 'mcp'),
    });
    const callback = new URL(redirectUri);
    callback.searchParams.set('code', code);
    if (q.state !== undefined) callback.searchParams.set('state', String(q.state));
    res.status(302);
    res.set({ Location: callback.toString() });
    res.end?.();
  }
  private token(req: MeshCentralHttpRequest, res: MeshCentralHttpResponse): void {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const result =
      b.grant_type === 'refresh_token'
        ? this.oauth.refresh(String(b.refresh_token ?? ''))
        : b.grant_type === 'authorization_code'
          ? this.oauth.exchangeCode(
              String(b.code ?? ''),
              String(b.client_id ?? ''),
              String(b.redirect_uri ?? ''),
              String(b.code_verifier ?? ''),
            )
          : null;
    if (!result) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }
    res.json(result);
  }
}

function isRedirectUriAllowed(configured: string, actual: string): boolean {
  if (configured === actual) return true;
  let base: URL;
  let target: URL;
  try {
    base = new URL(configured);
    target = new URL(actual);
  } catch {
    return false;
  }
  if (base.protocol !== target.protocol || base.hostname !== target.hostname) return false;
  // A loopback client registered without a port may use any ephemeral port.
  if (base.port === '') return true;
  return base.port === target.port && base.pathname === target.pathname;
}
