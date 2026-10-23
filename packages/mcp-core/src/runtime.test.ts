import { describe, expect, it } from 'vitest';

import type { Device, DeviceGroup, MeshCentralClient } from '@meshcentral/control-client';

import type { AuditWriter, ToolCallAudit } from './audit/audit-log';
import { loadMcpConfig } from './config/mcp-config';
import type { ClientProvider, ConnectionInfo } from './connection/connection-manager';
import { McpToolError } from './errors';
import { createToolRuntime } from './runtime';

const devices: Device[] = [
  { id: 'node//a', name: 'Alpha', online: true, groupId: 'mesh//one', groupName: 'One', platform: 'windows' },
  { id: 'node//b', name: 'Beta', online: false, groupId: 'mesh//two', groupName: 'Two', platform: 'linux' },
  { id: 'node//c', name: 'Gamma', online: true, groupId: 'mesh//one', groupName: 'One', platform: 'linux' },
];

const groups: DeviceGroup[] = [
  { id: 'mesh//one', name: 'One', description: 'first' },
  { id: 'mesh//two', name: 'Two' },
];

interface Harness {
  readonly provider: ClientProvider;
  readonly audits: ToolCallAudit[];
  readonly config: ReturnType<typeof loadMcpConfig>;
}

function createHarness(options: { scope?: { devices: string[]; deviceGroups: string[] } } = {}): Harness {
  const client = {
    devices: {
      list: async () => devices,
      details: async (deviceId: string) => ({
        device: devices.find((device) => device.id === deviceId),
        systemInfo: { hostname: 'alpha', osdesc: 'Windows', disks: [{ name: '/', size: 1 }] },
        networkInfo: { addresses: ['10.0.0.1'], extra: 'ignored' },
        lastConnect: { time: '2026-01-01T00:00:00Z', addr: '10.0.0.1' },
        raw: { detail: 'x'.repeat(5000) },
      }),
    },
    groups: { list: async () => groups },
    events: {
      list: async () => [
        {
          id: 'e1',
          type: 'agent',
          occurredAt: '2026-01-02T00:00:00.000Z',
          deviceId: 'node//a',
          raw: { big: true },
        },
        {
          id: 'e2',
          type: 'agent',
          occurredAt: '2025-01-01T00:00:00.000Z',
          deviceId: 'node//b',
        },
      ],
      listByDevice: async () => [],
      listByUser: async () => [],
    },
  } as unknown as MeshCentralClient;

  const info: ConnectionInfo = {
    status: 'connected',
    reconnectAttempt: 0,
    userName: 'alice',
    userId: 'user//1/alice',
    siteAdmin: false,
  };

  const audits: ToolCallAudit[] = [];
  const provider: ClientProvider = {
    info,
    withClient: async (action) => action(client),
  };

  const config = loadMcpConfig(
    { MESHCENTRAL_URL: 'https://mesh.example.com' },
    { ...(options.scope ? { scope: options.scope } : {}) },
  );

  return { provider, audits, config };
}

const audit: AuditWriter = {
  toolCall: () => undefined,
  connection: () => undefined,
  event: () => undefined,
  close: async () => undefined,
};

function createRuntime(harness: Harness, recorder?: ToolCallAudit[]) {
  return createToolRuntime({
    config: harness.config,
    provider: harness.provider,
    audit: {
      ...audit,
      toolCall: (entry) => {
        recorder?.push(entry);
      },
    },
  });
}

describe('tool runtime', () => {
  it('lists the read-only tools', () => {
    const runtime = createRuntime(createHarness());
    expect(runtime.listTools().map((tool) => tool.name)).toEqual([
      'devices_list',
      'devices_get',
      'groups_list',
      'events_query',
      'server_status',
    ]);
  });

  it('projects devices and paginates', async () => {
    const runtime = createRuntime(createHarness());
    const result = await runtime.callTool('devices_list', { limit: 2 });
    const data = result.data as { items: unknown[]; total: number; nextCursor?: string };

    expect(data.items).toEqual([
      { id: 'node//a', name: 'Alpha', online: true, groupId: 'mesh//one', groupName: 'One', platform: 'windows' },
      { id: 'node//b', name: 'Beta', online: false, groupId: 'mesh//two', groupName: 'Two', platform: 'linux' },
    ]);
    expect(data.total).toBe(3);
    expect(data.nextCursor).toBeDefined();

    const next = await runtime.callTool('devices_list', { limit: 2, cursor: data.nextCursor });
    expect((next.data as { items: unknown[] }).items).toHaveLength(1);
  });

  it('applies the configured scope', async () => {
    const runtime = createRuntime(
      createHarness({ scope: { devices: [], deviceGroups: ['mesh//two'] } }),
    );
    const result = await runtime.callTool('devices_list', {});
    const data = result.data as { items: Array<{ id: string }>; total: number };
    expect(data.items.map((item) => item.id)).toEqual(['node//b']);
    expect(data.total).toBe(1);
  });

  it('filters devices locally', async () => {
    const runtime = createRuntime(createHarness());
    const result = await runtime.callTool('devices_list', { online: true, platform: 'linux' });
    const data = result.data as { items: Array<{ id: string }> };
    expect(data.items.map((item) => item.id)).toEqual(['node//c']);
  });

  it('returns device details without raw payloads', async () => {
    const runtime = createRuntime(createHarness());
    const result = await runtime.callTool('devices_get', { deviceId: 'node//a' });
    const data = result.data as Record<string, unknown>;

    expect(data.device).toMatchObject({ id: 'node//a', name: 'Alpha' });
    expect(data.system).toEqual({ hostname: 'alpha', osdesc: 'Windows', disks: [{ name: '/', size: 1 }] });
    expect(data.network).toEqual({ addresses: ['10.0.0.1'] });
    expect(JSON.stringify(data)).not.toContain('raw');
  });

  it('counts devices per group on request', async () => {
    const runtime = createRuntime(createHarness());
    const result = await runtime.callTool('groups_list', { includeDeviceCount: true });
    const data = result.data as { items: Array<{ id: string; deviceCount?: number; onlineCount?: number }> };
    expect(data.items).toEqual([
      { id: 'mesh//one', name: 'One', description: 'first', deviceCount: 2, onlineCount: 2 },
      { id: 'mesh//two', name: 'Two', deviceCount: 1, onlineCount: 0 },
    ]);
  });

  it('applies the since filter locally and explains truncation', async () => {
    const runtime = createRuntime(createHarness());
    const result = await runtime.callTool('events_query', { since: '2026-01-01T00:00:00Z' });
    const data = result.data as { items: Array<{ id: string }> };

    expect(data.items.map((item) => item.id)).toEqual(['e1']);
    expect(result.truncated).toBe(true);
    expect(result.note).toContain('locally');
  });

  it('rejects invalid arguments', async () => {
    const runtime = createRuntime(createHarness());
    await expect(runtime.callTool('devices_list', { limit: 0 })).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
  });

  it('rejects unknown tools', async () => {
    const runtime = createRuntime(createHarness());
    await expect(runtime.callTool('devices_remove', {})).rejects.toMatchObject({
      code: 'UNKNOWN_TOOL',
    });
  });

  it('records every call in the audit log', async () => {
    const harness = createHarness();
    const recorder: ToolCallAudit[] = [];
    const runtime = createRuntime(harness, recorder);

    await runtime.callTool('devices_list', { limit: 1 });
    await expect(runtime.callTool('nope', {})).rejects.toBeInstanceOf(McpToolError);
    await expect(runtime.callTool('devices_list', { limit: 0 })).rejects.toBeInstanceOf(McpToolError);

    expect(recorder).toHaveLength(3);
    expect(recorder[0]).toMatchObject({ tool: 'devices_list', ok: true, user: 'alice' });
    expect(recorder[1]).toMatchObject({ tool: 'nope', ok: false, errorCode: 'UNKNOWN_TOOL' });
    expect(recorder[2]).toMatchObject({
      tool: 'devices_list',
      ok: false,
      errorCode: 'INVALID_ARGUMENT',
    });
  });

  it('reports connection information', async () => {
    const runtime = createRuntime(createHarness());
    const result = await runtime.callTool('server_status', { includeDeviceCounts: true });
    const data = result.data as {
      connection: { status: string };
      account: { userName: string };
      devices: { total: number; online: number };
    };

    expect(data.connection.status).toBe('connected');
    expect(data.account.userName).toBe('alice');
    expect(data.devices).toEqual({ total: 3, online: 2 });
  });
});
