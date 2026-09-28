import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type {
  MeshCentralDomain,
  MeshCentralHttpRequest,
  MeshCentralHttpResponse,
  MeshCentralServer,
  MeshCentralUser,
  MeshCentralWebServer,
} from '../../types/meshcentral.types.js';
import type { MeshCentralHttpHandler } from '../../types/meshcentral.types.js';
import {
  createCanRegisterHandler,
  createJsonAuthHandler,
  createJsonAuthHandlers,
  createRegisterHandler,
  jsonauth,
} from './index.js';

const domain: MeshCentralDomain = { id: '', url: '/' };
const now = Date.UTC(2026, 0, 1);

function createResponse() {
  const state: { code?: number; body?: unknown } = {};
  const response: MeshCentralHttpResponse = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    set: vi.fn(() => response),
    status: vi.fn((code: number) => {
      state.code = code;
      return response;
    }),
    json: vi.fn((body: unknown) => {
      state.body = body;
      return response;
    }),
  };
  return { response, state };
}

function createRequest(body: unknown): MeshCentralHttpRequest {
  return {
    body,
    clientIp: '192.0.2.10',
    connection: { remotePort: 12345 },
    headers: { 'user-agent': 'vitest' },
    query: {},
    session: {},
    xdomain: domain,
  };
}

function createRuntime(
  user: MeshCentralUser = {
    _id: 'user//alice',
    name: 'Alice',
    domain: '',
    siteadmin: 0xffffffff,
  },
) {
  const webServer: MeshCentralWebServer = {
    app: {
      get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), use: vi.fn(),
    },
    users: { 'user//alice': user },
    destroyedSessions: {},
    authenticate: vi.fn((_username, _password, _domain, callback) => {
      callback(null, 'user//alice');
    }),
    checkAllowLogin: vi.fn(() => true),
    setbadLogin: vi.fn(),
    checkAllow2Fa: vi.fn(() => true),
    setbad2Fa: vi.fn(),
    CloneSafeUser: vi.fn(() => ({ name: 'Alice' })),
    getUserAgentInfo: vi.fn(() => ({ browserStr: 'Test', osStr: 'TestOS' })),
  };
  const meshServer: MeshCentralServer = {
    config: { settings: {}, domains: { '': domain } },
    common: {
      validateUsername: vi.fn((value) => /^[a-z0-9._-]{1,64}$/i.test(value)),
      validateEmail: vi.fn((value) => /^[^@]+@[^@]+$/.test(value)),
      checkPasswordRequirements: vi.fn(() => true),
    },
    certificates: { CommonName: 'mesh.example.com' },
    db: {
      SetUser: vi.fn(),
      isMaxType: vi.fn((_maximum, _type, _domainId, callback) => callback(false)),
    },
    authLog: vi.fn(),
    DispatchEvent: vi.fn(),
  };
  return { webServer, meshServer, user };
}

function execute(
  body: unknown,
  runtime = createRuntime(),
  request = createRequest(body),
) {
  const { response, state } = createResponse();
  createJsonAuthHandler(runtime.webServer, runtime.meshServer, domain, {
    delay(callback) { callback(); },
    randomDelay() { return 0; },
    randomToken() { return 'transaction-token-00000000000000000000000000000001'; },
    now() { return now; },
  })(request, response);
  return { ...runtime, request, response, state };
}

function createFlow(runtime = createRuntime(), currentTime = now) {
  let transactionNumber = 0;
  let clock = currentTime;
  const handlers = createJsonAuthHandlers(runtime.webServer, runtime.meshServer, domain, {
    delay(callback) { callback(); },
    randomDelay() { return 0; },
    randomToken() {
      transactionNumber += 1;
      return `transaction-token-${transactionNumber.toString().padStart(32, '0')}`;
    },
    now() { return clock; },
  });

  const invoke = (handler: MeshCentralHttpHandler, body: unknown) => {
    const request = createRequest(body);
    const { response, state } = createResponse();
    handler(request, response);
    return { request, response, state };
  };

  return {
    ...runtime,
    advanceTime(milliseconds: number) { clock += milliseconds; },
    login(body: unknown) { return invoke(handlers.login, body); },
    verify(body: unknown) { return invoke(handlers.verifyTwoFactor, body); },
  };
}

function getTransactionId(body: unknown): string {
  const result = body as { data?: { transactionId?: unknown } };
  expect(typeof result.data?.transactionId).toBe('string');
  return result.data!.transactionId as string;
}

function totp(secret: Buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of secret) bits += byte.toString(2).padStart(8, '0');
  let base32 = '';
  for (let offset = 0; offset < bits.length; offset += 5) {
    base32 += alphabet[Number.parseInt(bits.slice(offset, offset + 5).padEnd(5, '0'), 2)];
  }
  const counter = Math.floor(now / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(buffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code =
    (((digest[offset]! & 0x7f) << 24) |
      ((digest[offset + 1]! & 0xff) << 16) |
      ((digest[offset + 2]! & 0xff) << 8) |
      (digest[offset + 3]! & 0xff)) %
    1_000_000;
  return { base32, token: code.toString().padStart(6, '0') };
}

describe('jsonauth handler', () => {
  it('rejects malformed parameters', () => {
    const result = execute({ username: '', password: '' });
    expect(result.state).toMatchObject({ code: 400 });
    expect(result.state.body).toMatchObject({ status: 'PARAM_ERROR' });
  });

  it('records a failed password and keeps the response generic', () => {
    const runtime = createRuntime();
    runtime.webServer.authenticate = vi.fn((_u, _p, _d, callback) => {
      callback(new Error('cannot find user'));
    });
    const result = execute({ username: 'missing', password: 'bad' }, runtime);
    expect(result.state.body).toMatchObject({ status: 'BAD_PASSWORD' });
    expect(runtime.webServer.setbadLogin).toHaveBeenCalledWith(result.request);
  });

  it('returns account locked when login throttling blocks the IP', () => {
    const runtime = createRuntime();
    runtime.webServer.checkAllowLogin = vi.fn(() => false);
    const result = execute({ username: 'alice', password: 'secret' }, runtime);
    expect(result.state).toMatchObject({ code: 423 });
    expect(result.webServer.authenticate).not.toHaveBeenCalled();
  });

  it('requests 2FA without exposing contact details', () => {
    const runtime = createRuntime({
      _id: 'user//alice', name: 'Alice', domain: '', otpsecret: 'JBSWY3DPEHPK3PXP',
      email: 'alice@example.com', emailVerified: true, otpekey: {},
    });
    domain.mailserver = {};
    const flow = createFlow(runtime);
    const result = flow.login({ username: 'alice', password: 'secret' });
    expect(result.state.body).toMatchObject({
      status: 'REQUIRE_2FA',
      data: {
        transactionId: expect.any(String),
        expiresIn: 300,
        methods: [
          { type: 'totp', supported: true },
          { type: 'email', supported: false },
        ],
      },
    });
    expect(JSON.stringify(result.state.body)).not.toContain('alice@example.com');
    delete domain.mailserver;
  });

  it('accepts a valid TOTP and creates a native session', () => {
    const value = totp(Buffer.from('12345678901234567890'));
    const runtime = createRuntime({
      _id: 'user//alice', name: 'Alice', domain: '', siteadmin: 0xffffffff,
      otpsecret: value.base32, groups: ['ops'], login: 10,
    });
    runtime.meshServer.encodeCookie = vi.fn(() => 'trusted-cookie');
    const flow = createFlow(runtime);
    const login = flow.login({ username: 'alice', password: 'secret' });
    const result = flow.verify({
      transactionId: getTransactionId(login.state.body),
      type: 'totp',
      code: value.token,
      rememberToken: true,
    });
    expect(result.state.body).toMatchObject({ status: 'SUCCESS' });
    expect(result.request.session).toMatchObject({
      userid: 'user//alice', ip: '192.0.2.10',
    });
    expect(result.request.session.x).toHaveLength(8);
    expect(runtime.meshServer.db?.SetUser).toHaveBeenCalledWith(runtime.user);
    expect(runtime.meshServer.DispatchEvent).toHaveBeenCalledWith(
      ['*', 'server-users', 'user//alice', 'server-users:ops'],
      runtime.webServer,
      expect.objectContaining({ action: 'login', twoFactorType: 'otp' }),
    );
    expect(result.response.cookie).toHaveBeenCalledWith(
      'twofactor',
      'trusted-cookie',
      expect.objectContaining({ httpOnly: true, secure: true }),
    );
    expect(runtime.webServer.authenticate).toHaveBeenCalledTimes(1);
  });

  it('records an invalid 2FA token', () => {
    const runtime = createRuntime({
      _id: 'user//alice', name: 'Alice', domain: '', otpsecret: 'JBSWY3DPEHPK3PXP',
    });
    const flow = createFlow(runtime);
    const login = flow.login({ username: 'alice', password: 'secret' });
    const result = flow.verify({
      transactionId: getTransactionId(login.state.body),
      type: 'totp',
      code: '000000',
    });
    expect(result.state.body).toMatchObject({ status: 'INVALID_2FA_TOKEN' });
    expect(runtime.webServer.setbad2Fa).toHaveBeenCalledWith(result.request);
  });

  it('rejects accounts that only have interactive 2FA methods', () => {
    const runtime = createRuntime({
      _id: 'user//alice', name: 'Alice', domain: '', otphkeys: [{ type: 3 }],
    });
    const flow = createFlow(runtime);
    const login = flow.login({ username: 'alice', password: 'secret' });
    const result = flow.verify({
      transactionId: getTransactionId(login.state.body),
      type: 'webauthn',
    });
    expect(result.state).toMatchObject({ code: 501 });
    expect(result.state.body).toMatchObject({
      status: 'UNSUPPORTED_2FA_METHOD',
      data: { method: 'webauthn' },
    });
    expect(result.request.session.userid).toBeUndefined();
  });

  it('returns password expired before creating a session', () => {
    const runtime = createRuntime({
      _id: 'user//alice', name: 'Alice', domain: '', passchange: -1,
    });
    const result = execute({ username: 'alice', password: 'secret' }, runtime);
    expect(result.state.body).toMatchObject({ status: 'PASSWORD_EXPIRED' });
    expect(result.request.session.userid).toBeUndefined();
  });

  it('requires email verification under native MeshCentral conditions', () => {
    const runtime = createRuntime({
      _id: 'user//alice', name: 'Alice', domain: '', emailVerified: false,
    });
    domain.mailserver = {};
    const result = execute({ username: 'alice', password: 'secret' }, runtime);
    expect(result.state.body).toMatchObject({ status: 'EMAIL_NOT_VERIFIED' });
    delete domain.mailserver;
  });

  it('registers default and path-domain routes once', () => {
    const runtime = createRuntime();
    runtime.webServer.bodyParser = {
      json: vi.fn(() => 'json-parser'),
      urlencoded: vi.fn(() => 'urlencoded-parser'),
    };
    runtime.meshServer.config = {
      settings: {},
      domains: {
        '': domain,
        tenant: { id: 'tenant', url: '/tenant/' },
        dns: { id: 'dns', url: '/', dns: 'tenant.example.com' },
      },
    };
    jsonauth({} as never).hook_setupHttpHandlers?.(
      runtime.webServer,
      runtime.meshServer,
    );
    expect(runtime.webServer.app.post).toHaveBeenCalledTimes(8);
    expect(runtime.webServer.app.get).toHaveBeenCalledTimes(2);
    expect(runtime.webServer.app.get).toHaveBeenCalledWith(
      '/api/auth/can-register',
      expect.any(Function),
    );
    expect(runtime.webServer.app.get).toHaveBeenCalledWith(
      '/tenant/api/auth/can-register',
      expect.any(Function),
    );
    expect(runtime.webServer.app.post).toHaveBeenCalledWith(
      '/api/auth/register',
      'json-parser',
      'urlencoded-parser',
      expect.any(Function),
    );
    expect(runtime.webServer.app.post).toHaveBeenCalledWith(
      '/tenant/api/auth/register',
      'json-parser',
      'urlencoded-parser',
      expect.any(Function),
    );
    expect(runtime.webServer.app.post).toHaveBeenCalledWith(
      '/api/auth/login',
      'json-parser',
      expect.any(Function),
    );
    expect(runtime.webServer.app.post).toHaveBeenCalledWith(
      '/tenant/api/auth/login',
      'json-parser',
      expect.any(Function),
    );
    expect(runtime.webServer.app.post).toHaveBeenCalledWith(
      '/api/auth/login/verify-2fa',
      'json-parser',
      expect.any(Function),
    );
    expect(runtime.webServer.app.post).toHaveBeenCalledWith(
      '/tenant/api/auth/login/verify-2fa',
      'json-parser',
      expect.any(Function),
    );
    expect(runtime.webServer.app.post).toHaveBeenCalledWith(
      '/api/auth/logout',
      'json-parser',
      expect.any(Function),
    );
    expect(runtime.webServer.app.post).toHaveBeenCalledWith(
      '/tenant/api/auth/logout',
      'json-parser',
      expect.any(Function),
    );
  });

  it('allows the first user to register without enabling new accounts', () => {
    const runtime = createRuntime();
    runtime.webServer.users = {};
    const { response, state } = createResponse();

    createCanRegisterHandler(runtime.webServer, runtime.meshServer, domain)(
      createRequest(undefined),
      response,
    );

    expect(state.body).toEqual({
      allowed: true,
      isFirstUser: true,
      domain: '',
      userCount: 0,
      requiresToken: false,
      requiresCaptcha: false,
    });
    expect(response.set).toHaveBeenCalledWith({ 'Cache-Control': 'no-store' });
  });

  it('uses domain registration settings after the first user exists', () => {
    const registrationDomain: MeshCentralDomain = {
      id: '',
      url: '/',
      newaccounts: 1,
      newaccountspass: 'invite-only',
      newaccountscaptcha: true,
    };
    const runtime = createRuntime();
    const { response, state } = createResponse();

    createCanRegisterHandler(
      runtime.webServer,
      runtime.meshServer,
      registrationDomain,
    )(createRequest(undefined), response);

    expect(state.body).toEqual({
      allowed: true,
      isFirstUser: false,
      domain: '',
      userCount: 1,
      requiresToken: true,
      requiresCaptcha: true,
    });
  });

  it('denies registration when new accounts are disabled', () => {
    const runtime = createRuntime();
    const { response, state } = createResponse();

    createCanRegisterHandler(runtime.webServer, runtime.meshServer, domain)(
      createRequest(undefined),
      response,
    );

    expect(state.body).toMatchObject({
      allowed: false,
      isFirstUser: false,
      userCount: 1,
    });
  });

  it('denies registration during maintenance or external authentication', () => {
    const maintenanceRuntime = createRuntime();
    maintenanceRuntime.meshServer.config!.settings!.maintenancemode = true;
    maintenanceRuntime.webServer.users = {};
    const maintenanceResponse = createResponse();
    createCanRegisterHandler(
      maintenanceRuntime.webServer,
      maintenanceRuntime.meshServer,
      domain,
    )(createRequest(undefined), maintenanceResponse.response);
    expect(maintenanceResponse.state.body).toEqual({
      allowed: false,
      isFirstUser: false,
      reason: 'Server is in maintenance mode.',
    });

    const ldapRuntime = createRuntime();
    const ldapResponse = createResponse();
    createCanRegisterHandler(
      ldapRuntime.webServer,
      ldapRuntime.meshServer,
      { id: '', url: '/', auth: 'ldap' },
    )(createRequest(undefined), ldapResponse.response);
    expect(ldapResponse.state.body).toEqual({
      allowed: false,
      isFirstUser: false,
      reason: 'External authentication is in use or local users are disabled.',
    });
  });

  it('registers the first user as an administrator', () => {
    const runtime = createRuntime();
    runtime.webServer.users = {};
    const { response, state } = createResponse();
    const request = createRequest({
      username: 'owner',
      password: 'correct horse battery staple',
      email: 'owner@example.com',
    });

    createRegisterHandler(runtime.webServer, runtime.meshServer, domain, {
      hashPassword(_password, callback) { callback(null, 'test-salt', 'test-hash'); },
      now() { return now; },
    })(request, response);

    expect(state).toMatchObject({
      code: 201,
      body: {
        status: 'SUCCESS',
        data: {
          id: 'user//owner',
          username: 'owner',
          email: 'owner@example.com',
          isAdmin: true,
        },
      },
    });
    expect(runtime.meshServer.db?.SetUser).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'user//owner',
        siteadmin: 0xffffffff,
        salt: 'test-salt',
        hash: 'test-hash',
      }),
    );
    expect(runtime.webServer.users?.['user//owner']).toBeDefined();
    expect(runtime.meshServer.DispatchEvent).toHaveBeenCalledWith(
      ['*', 'server-users'],
      runtime.webServer,
      expect.objectContaining({ action: 'accountcreate', userid: 'user//owner' }),
    );
  });

  it('enforces registration settings, tokens and unique usernames', () => {
    const closedRuntime = createRuntime();
    const closedResponse = createResponse();
    createRegisterHandler(closedRuntime.webServer, closedRuntime.meshServer, domain)(
      createRequest({ username: 'bob', password: 'secret', email: 'bob@example.com' }),
      closedResponse.response,
    );
    expect(closedResponse.state).toMatchObject({
      code: 403,
      body: { status: 'REGISTRATION_CLOSED' },
    });

    const tokenDomain: MeshCentralDomain = {
      id: '', url: '/', newaccounts: true, newaccountspass: 'invite-only',
    };
    const tokenRuntime = createRuntime();
    const tokenResponse = createResponse();
    createRegisterHandler(tokenRuntime.webServer, tokenRuntime.meshServer, tokenDomain)(
      createRequest({ username: 'bob', password: 'secret', email: 'bob@example.com' }),
      tokenResponse.response,
    );
    expect(tokenResponse.state).toMatchObject({
      code: 400,
      body: { status: 'INVALID_REGISTRATION_TOKEN' },
    });

    const duplicateDomain: MeshCentralDomain = { id: '', url: '/', newaccounts: true };
    const duplicateRuntime = createRuntime();
    const duplicateResponse = createResponse();
    createRegisterHandler(
      duplicateRuntime.webServer,
      duplicateRuntime.meshServer,
      duplicateDomain,
    )(
      createRequest({ username: 'alice', password: 'secret', email: 'alice@example.com' }),
      duplicateResponse.response,
    );
    expect(duplicateResponse.state).toMatchObject({
      code: 409,
      body: { status: 'USERNAME_EXISTS' },
    });
  });

  it('invalidates the active session and returns JSON on logout', () => {
    const runtime = createRuntime();
    runtime.webServer.clearDestroyedSessions = vi.fn();
    const request = createRequest({});
    request.session = { userid: 'user//alice', x: 'session-token' };
    const { response, state } = createResponse();

    createJsonAuthHandlers(runtime.webServer, runtime.meshServer, domain).logout(
      request,
      response,
    );

    expect(state).toMatchObject({
      code: 200,
      body: {
        code: 200,
        status: 'SUCCESS',
        message: '退出登录成功',
        data: { redirectUrl: '/login' },
      },
    });
    expect(request.session).toBeNull();
    expect(runtime.webServer.clearDestroyedSessions).toHaveBeenCalledOnce();
    expect(runtime.webServer.destroyedSessions).toMatchObject({
      'user//alice/session-token': expect.any(Number),
    });
    expect(runtime.meshServer.authLog).toHaveBeenCalledWith(
      'https',
      'User Alice JSON logout from 192.0.2.10',
      { sessionid: 'session-token', useragent: 'vitest' },
    );
    expect(runtime.meshServer.DispatchEvent).toHaveBeenCalledWith(
      ['*'],
      runtime.webServer,
      expect.objectContaining({
        action: 'logout',
        userid: 'user//alice',
        domain: '',
      }),
    );
    expect(response.set).toHaveBeenCalledWith({ 'Cache-Control': 'no-store' });
    expect(response.clearCookie).toHaveBeenCalledWith('connect.sid', { path: '/' });
  });

  it('treats logout without an active session as successful', () => {
    const runtime = createRuntime();
    const request = createRequest({});
    const { response, state } = createResponse();

    createJsonAuthHandlers(runtime.webServer, runtime.meshServer, domain).logout(
      request,
      response,
    );

    expect(state.body).toMatchObject({
      code: 200,
      status: 'SUCCESS',
      message: '当前未处于登录状态',
    });
    expect(runtime.meshServer.authLog).not.toHaveBeenCalled();
    expect(runtime.meshServer.DispatchEvent).not.toHaveBeenCalled();
    expect(response.clearCookie).toHaveBeenCalledWith('connect.sid', { path: '/' });
  });

  it('consumes a successful authentication transaction once', () => {
    const value = totp(Buffer.from('12345678901234567890'));
    const flow = createFlow(createRuntime({
      _id: 'user//alice', name: 'Alice', domain: '', otpsecret: value.base32,
    }));
    const login = flow.login({ username: 'alice', password: 'secret' });
    const transactionId = getTransactionId(login.state.body);
    const first = flow.verify({ transactionId, type: 'totp', code: value.token });
    const replay = flow.verify({ transactionId, type: 'totp', code: value.token });
    expect(first.state.body).toMatchObject({ status: 'SUCCESS' });
    expect(replay.state.body).toMatchObject({ status: 'INVALID_AUTH_TRANSACTION' });
  });

  it('rejects an expired authentication transaction', () => {
    const flow = createFlow(createRuntime({
      _id: 'user//alice', name: 'Alice', domain: '', otpsecret: 'JBSWY3DPEHPK3PXP',
    }));
    const login = flow.login({ username: 'alice', password: 'secret' });
    flow.advanceTime(5 * 60 * 1000);
    const result = flow.verify({
      transactionId: getTransactionId(login.state.body),
      type: 'totp',
      code: '000000',
    });
    expect(result.state.body).toMatchObject({ status: 'AUTH_TRANSACTION_EXPIRED' });
    expect(flow.webServer.setbad2Fa).not.toHaveBeenCalled();
  });

  it('invalidates a transaction after five failed 2FA attempts', () => {
    const flow = createFlow(createRuntime({
      _id: 'user//alice', name: 'Alice', domain: '', otpsecret: 'JBSWY3DPEHPK3PXP',
    }));
    const login = flow.login({ username: 'alice', password: 'secret' });
    const transactionId = getTransactionId(login.state.body);
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect(flow.verify({ transactionId, type: 'totp', code: '000000' }).state.body)
        .toMatchObject({ status: 'INVALID_2FA_TOKEN' });
    }
    expect(flow.verify({ transactionId, type: 'totp', code: '000000' }).state.body)
      .toMatchObject({ status: 'ACCOUNT_LOCKED' });
    expect(flow.verify({ transactionId, type: 'totp', code: '000000' }).state.body)
      .toMatchObject({ status: 'INVALID_AUTH_TRANSACTION' });
  });
});