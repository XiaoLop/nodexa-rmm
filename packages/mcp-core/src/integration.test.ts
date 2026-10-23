import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';

import { loadMcpConfig } from './config/mcp-config';
import { createToolRuntime, type ToolRuntime } from './runtime';
import { writeStoredSession } from './session/session-store';

const nodes = {
  'node//alpha': {
    _id: 'node//alpha',
    name: 'Alpha',
    meshid: 'mesh//one',
    meshname: 'One',
    conn: 1,
    osdesc: 'Windows 11',
    agent: { ver: 1234 },
  },
  'node//beta': {
    _id: 'node//beta',
    name: 'Beta',
    meshid: 'mesh//two',
    meshname: 'Two',
    conn: 0,
    osdesc: 'Ubuntu 24.04',
    agent: { ver: 1200 },
  },
};

let server: WebSocketServer;
let runtime: ToolRuntime;
let directory: string;
const seenCookies: Array<string | undefined> = [];
const seenActions: string[] = [];

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'mcp-integration-'));

  server = new WebSocketServer({ port: 0 });
  if (!server.address()) {
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  }
  const port = (server.address() as { port: number }).port;

  server.on('connection', (socket, request) => {
    seenCookies.push(request.headers.cookie);
    socket.send(JSON.stringify({ action: 'serverinfo', features: 7 }));
    socket.send(
      JSON.stringify({
        action: 'userinfo',
        userid: 'user//1/alice',
        name: 'alice',
        siteadmin: 0,
      }),
    );
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as { action?: string };
      if (message.action) seenActions.push(message.action);
      if (message.action === 'nodes') {
        socket.send(JSON.stringify({ action: 'nodes', nodes }));
      } else if (message.action === 'meshes') {
        socket.send(
          JSON.stringify({
            action: 'meshes',
            meshes: { 'mesh//one': { _id: 'mesh//one', name: 'One' } },
          }),
        );
      } else if (message.action === 'ping') {
        socket.send(JSON.stringify({ action: 'pong' }));
      }
    });
  });

  const config = loadMcpConfig({
    MESHCENTRAL_URL: `ws://127.0.0.1:${port}/control.ashx`,
    MESHCENTRAL_MCP_SESSION_FILE: path.join(directory, 'session.json'),
    MESHCENTRAL_MCP_AUDIT_FILE: path.join(directory, 'audit.ndjson'),
    MESHCENTRAL_MCP_KEEPALIVE_MS: '0',
  });

  await writeStoredSession(
    { file: config.sessionFile },
    {
      version: 1,
      serverUrl: config.serverUrl,
      cookieHeader: 'xid=smoke; xid.sig=signature',
      userName: 'alice',
      issuedAt: new Date().toISOString(),
    },
  );

  runtime = createToolRuntime({ config });
});

afterAll(async () => {
  await runtime?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});

describe('stdin-free integration', () => {
  it('connects with the stored cookie and lists devices', async () => {
    const result = await runtime.callTool('devices_list', {});
    const data = result.data as { items: Array<{ id: string; name: string; online: boolean }>; total: number };

    expect(data.total).toBe(2);
    expect(data.items).toEqual([
      { id: 'node//alpha', name: 'Alpha', online: true, groupId: 'mesh//one', groupName: 'One', platform: 'Windows 11', agentVersion: '1234' },
      { id: 'node//beta', name: 'Beta', online: false, groupId: 'mesh//two', groupName: 'Two', platform: 'Ubuntu 24.04', agentVersion: '1200' },
    ]);
    expect(seenCookies[0]).toContain('xid=smoke');
    expect(seenActions).toContain('nodes');
  });

  it('reports the signed-in account', async () => {
    const result = await runtime.callTool('server_status', {});
    const data = result.data as {
      connection: { status: string };
      account: { userName?: string; userId?: string; siteAdmin?: boolean };
    };

    expect(data.connection.status).toBe('connected');
    expect(data.account.userName).toBe('alice');
    expect(data.account.userId).toBe('user//1/alice');
    expect(data.account.siteAdmin).toBe(false);
  });

  it('lists groups', async () => {
    const result = await runtime.callTool('groups_list', {});
    const data = result.data as { items: Array<{ id: string; name: string }> };
    expect(data.items).toEqual([{ id: 'mesh//one', name: 'One' }]);
  });
});
