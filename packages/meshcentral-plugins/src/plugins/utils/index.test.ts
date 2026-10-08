import { describe, expect, it, vi } from 'vitest';
import type {
  MeshCentralAgentServer,
  MeshCentralConnection,
  MeshCentralDomain,
  MeshCentralPluginHandler,
  MeshCentralServer,
  MeshCentralUser,
} from '../../types/meshcentral.types.js';
import { utils } from './index.js';
import { UtilsPlugin } from './utils.plugin.js';
import type { GeoIpLocationLookup } from './utils.types.js';

const user: MeshCentralUser = {
  _id: 'user//alice',
  domain: '',
  siteadmin: 0,
  email: 'alice@example.com',
  emailVerified: true,
  phone: '+15550100',
  msghandle: 'alice',
  otpsecret: 'SECRET',
  otpekey: true,
  otpkeys: { keys: [{ p: 12345678, u: true }] },
};

function createDomain(
  overrides: Partial<MeshCentralDomain> = {},
): MeshCentralDomain {
  return {
    id: '',
    url: '/',
    mailserver: {},
    duo2factor: {
      integrationkey: 'integration-key',
      secretkey: 'secret-key',
      apihostname: 'api.example.com',
    },
    passwordrequirements: {
      force2factor: true,
      maxfidokeys: 2,
    },
    ...overrides,
  };
}

function createPlugin(meshServerOverrides: Partial<MeshCentralServer> = {}) {
  const meshServer: MeshCentralServer = {
    config: { settings: {} },
    certificates: { CommonName: 'mesh.example.com' },
    smsserver: {},
    msgserver: { providers: 3 },
    firebase: {},
    ...meshServerOverrides,
  };
  return utils({ parent: meshServer } as MeshCentralPluginHandler);
}

function query(
  connectionOverrides: Partial<MeshCentralConnection> = {},
  meshServerOverrides: Partial<MeshCentralServer> = {},
) {
  const send = vi.fn();
  const connection: MeshCentralConnection = {
    send,
    user,
    domain: createDomain(),
    ...connectionOverrides,
  };
  createPlugin(meshServerOverrides).serveraction?.(
    {
      action: 'plugin',
      plugin: 'utils',
      subAction: 'getTwoFactorCapabilities',
      requestId: 'request-1',
    },
    connection,
    {},
  );
  return send;
}

describe('utils two-factor capabilities', () => {
  it('returns the 2FA methods available to the current user', () => {
    const send = query();

    expect(send).toHaveBeenCalledWith({
      action: 'plugin',
      plugin: 'utils',
      subAction: 'getTwoFactorCapabilities',
      requestId: 'request-1',
      success: true,
      capabilities: expect.objectContaining({
        supported: true,
        locked: false,
        forced: true,
        domainId: '',
        maxFidoKeys: 2,
        messagingProviders: 3,
        methods: {
          totp: { enabled: true, canConfigure: true, configured: true },
          webauthn: { enabled: true, canConfigure: true, configured: false },
          email: { enabled: true, canConfigure: true, configured: true },
          sms: { enabled: true, canConfigure: true, configured: false },
          messaging: { enabled: true, canConfigure: true, configured: false },
          duo: { enabled: true, canConfigure: true, configured: false },
          devicePush: { enabled: true, canConfigure: true, configured: false },
          backupCodes: { enabled: true, canConfigure: true, configured: true },
        },
      }),
    });
  });

  it('marks methods read-only when the domain locks 2FA changes', () => {
    const send = query({
      domain: createDomain({
        passwordrequirements: { lock2factor: true },
      }),
    });

    const response = send.mock.calls[0]?.[0] as {
      capabilities: { locked: boolean; methods: Record<string, { canConfigure: boolean }> };
    };
    expect(response.capabilities.locked).toBe(true);
    expect(
      Object.values(response.capabilities.methods).every(
        (method) => method.canConfigure === false,
      ),
    ).toBe(true);
  });

  it('keeps configured WebAuthn keys manageable at the hardware-key limit', () => {
    const send = query({
      user: {
        ...user,
        otphkeys: [
          { type: 2, keyId: 'yubikey' },
          { type: 3, keyId: 'webauthn' },
        ],
      },
    });

    const response = send.mock.calls[0]?.[0] as {
      capabilities: {
        methods: { webauthn: { canConfigure: boolean; configured: boolean } };
      };
    };
    expect(response.capabilities.methods.webauthn).toEqual({
      enabled: true,
      canConfigure: true,
      configured: true,
    });
  });

  it('disables all methods when 2FA is globally disabled', () => {
    const send = query({}, { config: { settings: { no2factorauth: true } } });

    const response = send.mock.calls[0]?.[0] as {
      capabilities: { supported: boolean; methods: Record<string, { enabled: boolean }> };
    };
    expect(response.capabilities.supported).toBe(false);
    expect(
      Object.values(response.capabilities.methods).every(
        (method) => method.enabled === false,
      ),
    ).toBe(true);
  });

  it('rejects a query without an authenticated user context', () => {
    const send = query({ user: undefined, domain: undefined });

    expect(send).toHaveBeenCalledWith({
      action: 'plugin',
      plugin: 'utils',
      subAction: 'getTwoFactorCapabilities',
      requestId: 'request-1',
      success: false,
      error: 'AUTHENTICATED_USER_REQUIRED',
    });
  });
});

describe('utils GeoIP location', () => {
  it('writes the public IP location and broadcasts a safe node change', async () => {
    const node = { _id: 'node//one', domain: '', meshid: 'mesh//one', publicip: '8.8.8.8' };
    const set = vi.fn();
    const dispatchEvent = vi.fn();
    const meshServer: MeshCentralServer = {
      db: { Get: (_id, callback) => callback(undefined, [{ ...node }]), Set: set },
      DispatchEvent: dispatchEvent,
    };
    const geoIpLocation: GeoIpLocationLookup = {
      databaseVersion: '2026-10',
      initialize: vi.fn(async () => undefined),
      lookup: vi.fn((lookupIp) => ({
        lookupIp, countryCode: 'US', source: 'geoip-mmdb' as const,
        databaseVersion: '2026-10', resolvedAt: 1_791_468_682,
      })),
    };
    const plugin = new UtilsPlugin(meshServer, geoIpLocation);
    const agentServer: MeshCentralAgentServer = {
      CloneSafeNode: (value) => ({ ...value }),
      CreateMeshDispatchTargets: () => ['*', 'mesh//one'],
    };

    plugin.agentCoreIsStable({ dbNodeKey: 'node//one', send: vi.fn() }, agentServer);

    await vi.waitFor(() => expect(set).toHaveBeenCalledOnce());
    expect(geoIpLocation.lookup).toHaveBeenCalledWith('8.8.8.8');
    expect(dispatchEvent).toHaveBeenCalledWith(
      ['*', 'mesh//one'], plugin,
      expect.objectContaining({ action: 'changenode', nodeid: 'node//one', nolog: 1 }),
    );
  });
});