import { randomUUID } from 'node:crypto';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MeshCentralAgentConnection,
  MeshCentralServer,
} from '../../types/meshcentral.types.js';
import { buildCommand, readResult } from './execution.js';
import { RmmPlugin } from './rmm.plugin.js';
import { parseScript, parseValues } from './script.js';
import { RmmStore } from './store.js';

type Detail = {
  id: string;
  counts: Record<string, number>;
  version: number;
  results: {
    id: string;
    executionId: string;
    status: string;
    occupiedBy?: string;
    canRelease?: boolean;
    waitingReason?: string;
    output: string | null;
  }[];
};
type Internals = { store: RmmStore; tick(): Promise<void> };
const draft = { name: 'Test', description: '', body: "Write-Output 'ok'", parameters: [] };
let dir: string;
let plugin: RmmPlugin;
let core: Internals;
let actor: string;
let admin: boolean;
let allowed: Set<string>;
let agents: Record<string, MeshCentralAgentConnection>;
let sent: { node: string; command: Record<string, unknown> }[];
let platforms: Record<string, number>;
const node = (n: number) => 'node//test' + n;

async function rpc<T = Record<string, unknown>>(
  subAction: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  let response: Record<string, unknown> = {};
  await plugin.onRequest(
    { action: 'plugin', plugin: 'rmm', subAction, ...args },
    {
      user: { _id: actor },
      domain: { id: '', url: '/' },
      send: (message) => {
        response = message as Record<string, unknown>;
      },
    },
  );
  if (response.error) throw new Error(String(response.error));
  return response.data as T;
}

async function submit(
  nodes = [node(0)],
  script?: { id: string; version: number },
  key = randomUUID(),
) {
  script ??= await rpc<{ id: string; version: number }>('saveScript', { script: draft });
  const preview = await rpc<{ id: string }>('preview', {
    scriptId: script.id,
    version: script.version,
    nodeIds: nodes,
    groupIds: [],
  });
  return rpc<{ id: string }>('submit', { previewId: preview.id, key, params: {} });
}
const detail = (id: string) => rpc<Detail>('getTask', { taskId: id });
function receipt(index: number, code = 0, output = 'ok') {
  const entry = sent[index]!;
  plugin.onAgentData(
    {
      action: 'msg',
      type: 'runcommands',
      responseid: entry.command.responseid,
      result: `RMM-RESULT ${entry.command.responseid} ${code} 0 ${Buffer.from(output).toString('base64')}`,
    },
    agents[entry.node]!,
  );
}
const occupancy = () => core.store.db.prepare('SELECT * FROM device_occupancy').all();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-08T00:00:00Z'));
  dir = mkdtempSync(join(tmpdir(), 'rmm-test-'));
  actor = 'user//admin';
  admin = true;
  allowed = new Set(Array.from({ length: 110 }, (_, i) => node(i)));
  sent = [];
  agents = {};
  platforms = {};
  for (const id of allowed)
    agents[id] = {
      authenticated: 2,
      agentInfo: {},
      dbNodeKey: id,
      send: (data) => {
        sent.push({ node: id, command: JSON.parse(String(data)) as Record<string, unknown> });
      },
    };
  const server = {
    datapath: dir,
    config: { domains: { '': { id: '' } } },
    webserver: {
      users: {
        'user//admin': {
          get siteadmin() {
            return admin ? 0xffffffff : 0;
          },
        },
      },
      wsagents: agents,
      GetMeshRights: () => 1,
      GetNodeWithRights: (
        _domain: unknown,
        _actor: string,
        id: string,
        cb: (node: object, rights: number, visible: boolean) => void,
      ) =>
        cb(
          { name: id, agent: { id: platforms[id] ?? 2 } },
          allowed.has(id) ? 0x20000 : 0,
          allowed.has(id),
        ),
    },
    db: {
      GetAllTypeNoTypeField: (
        _type: string,
        _domain: string,
        cb: (error: null, nodes: object[]) => void,
      ) =>
        cb(
          null,
          [0, 1].map((n) => ({ _id: node(n), meshid: 'mesh//test' })),
        ),
    },
  } as unknown as MeshCentralServer;
  plugin = new RmmPlugin(server);
  plugin.start();
  core = plugin as unknown as Internals;
});
afterEach(() => {
  core.store.db.close();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe('script history and task search', () => {
  it('preserves versioned tags, limits input, and keeps historical bodies admin-only', async () => {
    const script = await rpc<{ id: string; version: number }>('saveScript', {
      script: { ...draft, tags: [' ops ', '生产'] },
    });
    await rpc('saveScript', {
      scriptId: script.id,
      version: 1,
      script: { ...draft, body: 'new body', tags: ['new'] },
    });
    expect(await rpc('listScriptVersions', { scriptId: script.id })).toMatchObject({
      versions: [
        { version: 2, actor },
        { version: 1, actor },
      ],
    });
    expect(await rpc('getScriptVersion', { scriptId: script.id, version: 1 })).toMatchObject({
      body: draft.body,
      tags: ['ops', '生产'],
    });
    expect(await rpc('getScriptVersion', { scriptId: script.id, version: 2 })).toMatchObject({
      body: 'new body',
      tags: ['new'],
    });
    await expect(
      rpc('saveScript', { script: { ...draft, tags: ['ops', ' OPS '] } }),
    ).rejects.toThrow('INVALID_SCRIPT');
    await expect(
      rpc('saveScript', { script: { ...draft, tags: Array(11).fill('x') } }),
    ).rejects.toThrow('INVALID_SCRIPT');
    admin = false;
    expect(await rpc('getScriptVersion', { scriptId: script.id, version: 1 })).not.toHaveProperty(
      'body',
    );
    admin = true;
    await rpc('archiveScript', { scriptId: script.id });
    expect(await rpc('getScriptVersion', { scriptId: script.id, version: 1 })).toHaveProperty(
      'body',
    );
    admin = false;
    await expect(rpc('listScriptVersions', { scriptId: script.id })).rejects.toThrow(
      'SCRIPT_UNAVAILABLE',
    );
    await expect(rpc('getScriptVersion', { scriptId: script.id, version: 1 })).rejects.toThrow(
      'SCRIPT_UNAVAILABLE',
    );
    await expect(rpc('listScriptVersions', { scriptId: 'missing' })).rejects.toThrow(
      'SCRIPT_UNAVAILABLE',
    );
    expect(await rpc('listScriptVersions', { scriptId: 'service-status' })).toEqual({
      versions: [{ version: 1 }],
    });
  });

  it('searches older pages and filters statuses using only visible devices', async () => {
    const script = await rpc<{ id: string; version: number }>('saveScript', { script: draft });
    const first = await submit([node(0), node(1)], script);
    core.store.db.prepare('UPDATE tasks SET name = ? WHERE id = ?').run('Older Match', first.id);
    core.store.db
      .prepare('UPDATE executions SET status = ? WHERE task_id = ? AND node_id = ?')
      .run('failed', first.id, node(1));
    for (let i = 0; i < 30; i++) await submit([node(0)], script);
    const firstPage = await rpc<{ tasks: { id: string }[]; before?: number }>('searchTasks');
    expect(firstPage.tasks).toHaveLength(25);
    const nextPage = await rpc<{ tasks: { id: string }[] }>('searchTasks', {
      before: firstPage.before,
    });
    expect(nextPage.tasks.some((task) => task.id === first.id)).toBe(true);
    expect(
      (await rpc<{ tasks: { id: string }[] }>('searchTasks', { query: 'older match' })).tasks,
    ).toEqual([expect.objectContaining({ id: first.id })]);
    allowed.delete(node(1));
    expect(
      (await rpc<{ tasks: unknown[] }>('searchTasks', { query: 'Older Match', status: 'failed' }))
        .tasks,
    ).toEqual([]);
    expect(
      (await rpc<{ tasks: unknown[] }>('searchTasks', { query: 'Older Match', status: 'queued' }))
        .tasks,
    ).toHaveLength(1);
    core.store.db
      .prepare('UPDATE executions SET status = ? WHERE task_id = ? AND node_id = ?')
      .run('failed', first.id, node(0));
    const emptyPage = await rpc<{ tasks: unknown[]; before?: number }>('searchTasks', {
      status: 'failed',
    });
    expect(emptyPage.tasks).toEqual([]);
    expect(emptyPage.before).toBeDefined();
    expect(
      (
        await rpc<{ tasks: { id: string }[] }>('searchTasks', {
          status: 'failed',
          before: emptyPage.before,
        })
      ).tasks,
    ).toEqual([expect.objectContaining({ id: first.id })]);
    await expect(rpc('searchTasks', { status: 'bogus' })).rejects.toThrow('INVALID_INPUT');
    await expect(rpc('searchTasks', { query: 'x'.repeat(201) })).rejects.toThrow('INVALID_INPUT');
    await expect(rpc('searchTasks', { before: 0 })).rejects.toThrow('INVALID_INPUT');
  });

  it('paginates version history and never returns another domain’s versions or tasks', async () => {
    const script = await rpc<{ id: string; version: number }>('saveScript', { script: draft });
    for (let version = 1; version <= 25; version++) {
      await rpc('saveScript', { scriptId: script.id, version, script: draft });
    }
    const page = await rpc<{ versions: { version: number }[]; before?: number }>(
      'listScriptVersions',
      { scriptId: script.id },
    );
    expect(page.versions).toHaveLength(25);
    expect(page.versions[0]?.version).toBe(26);
    expect(page.before).toBe(2);
    expect(
      await rpc('listScriptVersions', { scriptId: script.id, before: page.before }),
    ).toMatchObject({ versions: [{ version: 1 }] });
    core.store.db.prepare('INSERT INTO scripts(domain, id) VALUES (?, ?)').run('other', 'foreign');
    core.store.db
      .prepare('INSERT INTO versions VALUES (?, ?, ?, ?, ?, ?)')
      .run('other', 'foreign', 1, actor, Date.now(), JSON.stringify(draft));
    core.store.db
      .prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        'foreign-task',
        'other',
        actor,
        randomUUID(),
        'foreign',
        1,
        'Foreign task',
        Date.now(),
        '{}',
      );
    await expect(rpc('getScriptVersion', { scriptId: 'foreign', version: 1 })).rejects.toThrow(
      'SCRIPT_UNAVAILABLE',
    );
    await expect(rpc('listScriptVersions', { scriptId: 'foreign' })).rejects.toThrow(
      'SCRIPT_UNAVAILABLE',
    );
    expect(
      (await rpc<{ tasks: unknown[] }>('searchTasks', { query: 'Foreign task' })).tasks,
    ).toEqual([]);
  });
});

describe('persistent device occupancy', () => {
  it('only shows a busy waiting reason for queued work, retaining occupancy on running work', async () => {
    const first = await submit();
    await core.tick();
    const next = await submit();
    const running = (await detail(first.id)).results[0]!;
    expect(running).toMatchObject({
      status: 'running',
      occupiedBy: sent[0]!.command.responseid,
      canRelease: false,
    });
    expect(running).not.toHaveProperty('waitingReason');
    expect((await detail(next.id)).results[0]).toMatchObject({
      status: 'queued',
      occupiedBy: running.executionId,
      waitingReason: 'DEVICE_BUSY',
      canRelease: false,
    });
    receipt(0);
    await core.tick();
    const dispatched = (await detail(next.id)).results[0]!;
    expect(dispatched).toMatchObject({ status: 'running', occupiedBy: dispatched.executionId });
    expect(dispatched).not.toHaveProperty('waitingReason');
  });

  it('dispatches five different devices, serializes same-device work and fills freed slots', async () => {
    await submit([node(0)]);
    await submit([node(0)]);
    await submit([node(1), node(2), node(3), node(4), node(5)]);
    await core.tick();
    expect(sent).toHaveLength(5);
    expect(new Set(sent.map((e) => e.node)).size).toBe(5);
    receipt(0);
    await core.tick();
    expect(sent).toHaveLength(6);
    expect(sent[5]?.node).toBe(node(0));
    expect(occupancy()).toHaveLength(5);
  });

  it('keeps timed-out work occupied, accepts late completion only to unlock, then dispatches queued work', async () => {
    const first = await submit();
    await core.tick();
    const next = await submit();
    vi.setSystemTime(Date.now() + 300_001);
    await core.tick();
    expect(sent).toHaveLength(1);
    expect((await detail(first.id)).results[0]).toMatchObject({
      status: 'timeout',
      canRelease: true,
      waitingReason: 'REMOTE_STATE_UNKNOWN',
    });
    expect((await detail(next.id)).results[0]).toMatchObject({
      status: 'queued',
      occupiedBy: sent[0]!.command.responseid,
    });
    receipt(0);
    expect(occupancy()).toHaveLength(0);
    expect((await detail(first.id)).results[0]).toMatchObject({ status: 'timeout', output: null });
    await core.tick();
    expect(sent).toHaveLength(2);
    receipt(1);
    expect((await detail(next.id)).results[0]).toMatchObject({ status: 'succeeded', output: 'ok' });
  });

  it('counts unresolved work toward all five slots; unrelated devices use remaining slots', async () => {
    await submit([node(0), node(1), node(2), node(3), node(4)]);
    await core.tick();
    vi.setSystemTime(Date.now() + 300_001);
    await core.tick();
    await submit([node(5)]);
    await core.tick();
    expect(sent).toHaveLength(5);
    receipt(0);
    await core.tick();
    expect(sent[5]?.node).toBe(node(5));
  });

  it('ignores ordinary console, wrong-device, unauthenticated and mismatched receipts', async () => {
    await submit();
    await core.tick();
    const id = sent[0]!.command.responseid;
    const message = {
      action: 'msg',
      type: 'runcommands',
      responseid: id,
      result: `RMM-RESULT ${id} 0 0 b2s=`,
    };
    plugin.onAgentData({ ...message, type: 'console' }, agents[node(0)]!);
    plugin.onAgentData(message, agents[node(1)]!);
    plugin.onAgentData(message, { ...agents[node(0)]!, authenticated: 1 });
    plugin.onAgentData({ ...message, responseid: randomUUID() }, agents[node(0)]!);
    expect(occupancy()).toHaveLength(1);
    receipt(0);
    expect(occupancy()).toHaveLength(0);
  });

  it('expires a running task when a late receipt arrives before the scheduler tick', async () => {
    const task = await submit();
    await core.tick();
    vi.setSystemTime(Date.now() + 300_001);
    receipt(0);
    expect((await detail(task.id)).results[0]?.status).toBe('timeout');
    expect(occupancy()).toHaveLength(0);
  });

  it('does not unlock when an Agent disconnects and reconnects', async () => {
    await submit();
    await core.tick();
    await submit();
    agents[node(0)]!.authenticated = 1;
    vi.setSystemTime(Date.now() + 300_001);
    await core.tick();
    agents[node(0)]!.authenticated = 2;
    await core.tick();
    expect(sent).toHaveLength(1);
    expect(occupancy()).toHaveLength(1);
  });

  it('retains occupancy on uncertain send and server restart without replay', async () => {
    agents[node(0)]!.send = () => {
      throw new Error('network');
    };
    const task = await submit();
    await core.tick();
    expect((await detail(task.id)).results[0]?.status).toBe('unknown');
    expect(occupancy()).toHaveLength(1);
    const running = await submit([node(1)]);
    await core.tick();
    core.store.db.close();
    core.store = new RmmStore(join(dir, 'rmm.sqlite'));
    expect((await detail(running.id)).results[0]?.status).toBe('unknown');
    await submit([node(1)]);
    await core.tick();
    expect(sent).toHaveLength(1);
    expect(occupancy()).toHaveLength(2);
  });

  it('requires admin, current device rights, expected execution and reason; audits idempotent release', async () => {
    await submit();
    await core.tick();
    const executionId = sent[0]!.command.responseid;
    const args = { nodeId: node(0), executionId, reason: 'Verified process ended' };
    await expect(rpc('releaseDevice', args)).rejects.toThrow('EXECUTION_RUNNING');
    vi.setSystemTime(Date.now() + 300_001);
    await core.tick();
    admin = false;
    await expect(rpc('releaseDevice', args)).rejects.toThrow('ACCESS_DENIED');
    admin = true;
    allowed.delete(node(0));
    await expect(rpc('releaseDevice', args)).rejects.toThrow('ACCESS_DENIED');
    allowed.add(node(0));
    await expect(rpc('releaseDevice', { ...args, nodeId: 'node/other/test' })).rejects.toThrow(
      'ACCESS_DENIED',
    );
    await expect(rpc('releaseDevice', { ...args, reason: ' ' })).rejects.toThrow('INVALID_INPUT');
    await expect(rpc('releaseDevice', { ...args, executionId: randomUUID() })).rejects.toThrow(
      'OCCUPANCY_CONFLICT',
    );
    await rpc('releaseDevice', args);
    await rpc('releaseDevice', args);
    const audit = core.store.db.prepare("SELECT * FROM audit WHERE action = 'releaseDevice'").all();
    expect(audit).toHaveLength(1);
    expect(JSON.parse(String(audit[0]?.target))).toEqual(args);
    expect(audit[0]?.actor).toBe(actor);
    expect(audit[0]?.created).toBe(Date.now());
    await submit();
    await core.tick();
    await expect(rpc('releaseDevice', args)).rejects.toThrow('OCCUPANCY_CONFLICT');
    receipt(0);
    expect(occupancy()).toHaveLength(1);
  });

  it('migrates running records without reconstructing old timeout occupancy; retention never unlocks', async () => {
    const first = await submit();
    await core.tick();
    const second = await submit([node(1)]);
    await core.tick();
    core.store.db
      .prepare("UPDATE executions SET status = 'timeout' WHERE task_id = ?")
      .run(second.id);
    core.store.db.exec('DROP TABLE device_occupancy');
    core.store.db.close();
    core.store = new RmmStore(join(dir, 'rmm.sqlite'));
    expect(occupancy()).toHaveLength(1);
    expect((await detail(first.id)).results[0]?.status).toBe('unknown');
    vi.setSystemTime(Date.now() + 91 * 86_400_000);
    core.store.maintain();
    expect(core.store.db.prepare('SELECT * FROM tasks').all()).toHaveLength(0);
    expect(occupancy()).toHaveLength(1);
    await rpc('releaseDevice', {
      nodeId: node(0),
      executionId: sent[0]!.command.responseid,
      reason: 'Checked',
    });
    expect(occupancy()).toHaveLength(0);
  });
});

describe('admission, authorization and persistence', () => {
  it('previews and dispatches Linux only to matching devices, using the admitted script version', async () => {
    platforms[node(0)] = 6;
    platforms[node(2)] = 32;
    const script = await rpc<{ id: string; version: number }>('saveScript', {
      script: { ...draft, platform: 'linux', body: 'printf ok' },
    });
    const preview = await rpc<{ id: string; targets: { id: string; reason?: string }[] }>(
      'preview',
      { scriptId: script.id, version: 1, nodeIds: [node(0), node(1), node(2)], groupIds: [] },
    );
    expect(preview.targets.map((target) => target.reason)).toEqual([
      undefined,
      'UNSUPPORTED_AGENT',
      undefined,
    ]);
    const task = await rpc<{ id: string }>('submit', {
      previewId: preview.id,
      key: randomUUID(),
      params: {},
    });
    await rpc('saveScript', { scriptId: script.id, version: 1, script: draft });
    await core.tick();
    expect(sent).toHaveLength(2);
    expect(sent.map((entry) => entry.command.type)).toEqual([3, 3]);
    receipt(0);
    receipt(1);
    expect((await detail(task.id)).counts).toEqual({ succeeded: 2, skipped: 1 });
    expect(await detail(task.id)).toMatchObject({ platform: 'linux', version: 1 });
    const windows = await submit([node(0)]);
    await core.tick();
    expect((await detail(windows.id)).results[0]?.status).toBe('skipped');
    expect(sent).toHaveLength(2);
  });
  it('deduplicates group targets, rejects expired previews and repeated confirmation creates one task', async () => {
    const script = await rpc<{ id: string; version: number }>('saveScript', { script: draft });
    const preview = await rpc<{ id: string; targets: object[] }>('preview', {
      scriptId: script.id,
      version: 1,
      nodeIds: [node(0)],
      groupIds: ['mesh//test'],
    });
    expect(preview.targets).toHaveLength(2);
    const args = { previewId: preview.id, key: randomUUID(), params: {} };
    const task = await rpc('submit', args);
    expect(await rpc('submit', args)).toEqual(task);
    const expired = await rpc<{ id: string }>('preview', {
      scriptId: script.id,
      version: 1,
      nodeIds: [node(0)],
      groupIds: [],
    });
    vi.setSystemTime(Date.now() + 300_001);
    await expect(
      rpc('submit', { ...args, key: randomUUID(), previewId: expired.id }),
    ).rejects.toThrow('PREVIEW_EXPIRED');
    await expect(
      submit(
        Array.from({ length: 101 }, (_, i) => node(i)),
        script,
      ),
    ).rejects.toThrow();
    allowed.delete(node(1));
    await expect(submit([node(0), node(1)], script)).rejects.toThrow('ACCESS_DENIED');
    await expect(submit(['node/foreign/test'], script)).rejects.toThrow('ACCESS_DENIED');
  });

  it('filters detail and counts after revocation and rechecks rights before dispatch', async () => {
    const task = await submit([node(0), node(1)]);
    allowed.delete(node(0));
    await core.tick();
    const result = await detail(task.id);
    expect(result.results.map((r) => r.id)).toEqual([node(1)]);
    expect(result.counts).toEqual({ running: 1 });
    expect(sent.map((s) => s.node)).toEqual([node(1)]);
    allowed.delete(node(1));
    await expect(detail(task.id)).rejects.toThrow('TASK_UNAVAILABLE');
    admin = false;
    await expect(submit()).rejects.toThrow('ACCESS_DENIED');
  });

  it('rejects an operator without command rights even when bypassing the UI', async () => {
    const script = await rpc<{ id: string; version: number }>('saveScript', { script: draft });
    const preview = await rpc<{ id: string }>('preview', {
      scriptId: script.id,
      version: 1,
      nodeIds: [node(0)],
      groupIds: [],
    });
    admin = false;
    allowed.delete(node(0));
    await expect(
      rpc('submit', { previewId: preview.id, key: randomUUID(), params: {} }),
    ).rejects.toThrow('ACCESS_DENIED');
    expect(core.store.db.prepare('SELECT * FROM tasks').all()).toHaveLength(0);
  });

  it('preserves versions and archived task history; skips offline devices without replay', async () => {
    const script = await rpc<{ id: string; version: number }>('saveScript', { script: draft });
    delete agents[node(0)];
    const task = await submit([node(0)], script);
    expect((await detail(task.id)).results[0]?.status).toBe('skipped');
    await rpc('saveScript', {
      scriptId: script.id,
      version: 1,
      script: { ...draft, body: 'exit 7' },
    });
    await rpc('archiveScript', { scriptId: script.id });
    expect((await detail(task.id)).version).toBe(1);
    expect(core.store.db.prepare('SELECT * FROM versions').all()).toHaveLength(2);
    await expect(submit([node(1)], script)).rejects.toThrow('SCRIPT_UNAVAILABLE');
    await core.tick();
    expect(sent).toHaveLength(0);
  });

  it('pauses admission and dispatch, clears output at 30 days, and restores a stopped database backup', async () => {
    const task = await submit();
    vi.stubEnv('MESHCENTRAL_RMM_PAUSED', '1');
    await core.tick();
    expect(sent).toHaveLength(0);
    await expect(submit()).rejects.toThrow('RMM_PAUSED');
    vi.stubEnv('MESHCENTRAL_RMM_PAUSED', '0');
    await core.tick();
    receipt(0);
    vi.setSystemTime(Date.now() + 31 * 86_400_000);
    core.store.maintain();
    expect((await detail(task.id)).results[0]?.output).toBeNull();
    core.store.db.close();
    const backup = join(dir, 'backup.sqlite');
    copyFileSync(join(dir, 'rmm.sqlite'), backup);
    core.store = new RmmStore(backup);
    expect((await detail(task.id)).results[0]?.status).toBe('succeeded');
    vi.setSystemTime(Date.now() + 60 * 86_400_000);
    core.store.maintain();
    expect(core.store.db.prepare('SELECT * FROM audit').all()).toHaveLength(0);
  });
});

describe('script values and receipts', () => {
  it('keeps literal parameters in the encoded payload and validates types', () => {
    const script = parseScript({ ...draft, parameters: [{ name: 'Value', type: 'string' }] });
    const values = parseValues(script, { Value: '"; $() & | 中文' });
    const command = buildCommand(randomUUID(), actor, script, values);
    expect(command.cmds).not.toContain(String(values.Value));
    expect(command.cmds).toContain(Buffer.from(JSON.stringify({ values })).toString('base64'));
    expect(() => parseValues(script, { Value: 1 })).toThrow('INVALID_PARAMETER');
  });
  it('clips UTF-8 without partial characters and rejects malformed result markers', () => {
    const id = randomUUID();
    const output = Buffer.from('验'.repeat(40000)).toString('base64');
    const message = {
      action: 'msg',
      type: 'runcommands',
      responseid: id,
      result: `RMM-RESULT ${id} 0 0 ${output}`,
    };
    const result = readResult(message);
    expect(result?.truncated).toBe(true);
    expect(result?.output).toBe('验'.repeat(10922));
    expect(
      readResult({ ...message, result: message.result + '\n' + message.result }),
    ).toBeUndefined();
    expect(readResult({ ...message, result: `RMM-RESULT ${id} 0 0 !!!!` })).toBeUndefined();
  });
});
