import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { MeshPlugin, PluginHook } from '../../decorators/plugin.drcorator.js';
import type {
  MeshCentralAgentConnection,
  MeshCentralCommand,
  MeshCentralConnection,
  MeshCentralDomain,
  MeshCentralServer,
} from '../../types/meshcentral.types.js';
import { buildCommand, readResult, supportsAgent } from './execution.js';
import { examples, object, parseScript, parseValues, RmmError, type Script } from './script.js';
import { RmmStore } from './store.js';

type Context = { domain: MeshCentralDomain; actor: string };
type Target = { id: string; name: string; reason?: string };
type Preview = Context & { id: string; version: number; targets: Target[]; expires: number };
type Task = {
  id: string;
  actor: string;
  script_id: string;
  version: number;
  name: string;
  created: number;
  params: string;
  domain: string;
};
type Execution = {
  id: string;
  task_id: string;
  node_id: string;
  name: string;
  status: string;
  reason: string | null;
  exit_code: number | null;
  output: string | null;
  truncated: number;
};

const pending = (status: string) => status === 'queued' || status === 'running';

function stringList(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some((entry: unknown) => typeof entry !== 'string' || entry.length > 128)
  ) {
    throw new RmmError('INVALID_TARGET');
  }
  return value;
}

@MeshPlugin()
export class RmmPlugin {
  private store?: RmmStore;
  private readonly previews = new Map<string, Preview>();
  private ticking = false;
  private lastMaintenance = 0;

  constructor(private readonly server: MeshCentralServer) {}

  @PluginHook('server_startup')
  start(): void {
    if (this.store || !this.server.datapath) return;
    try {
      this.store = new RmmStore(join(this.server.datapath, 'rmm.sqlite'));
      setInterval(() => void this.tick(), 1000).unref();
    } catch {
      console.error('[rmm] Unable to initialize execution storage');
    }
  }

  @PluginHook('serveraction')
  async onRequest(command: MeshCentralCommand, connection: MeshCentralConnection): Promise<void> {
    if (command.action !== 'plugin' || command.plugin !== 'rmm') return;
    const reply = (value: Record<string, unknown>) =>
      connection.send({
        action: 'plugin',
        plugin: 'rmm',
        subAction: command.subAction,
        requestId: command.requestId,
        ...value,
      });
    const actor = connection.user?._id;
    const domain = connection.domain;
    try {
      if (!this.store) throw new RmmError('RMM_DISABLED');
      if (
        !domain ||
        !actor ||
        !actor.startsWith('user/' + domain.id + '/') ||
        !this.server.webserver?.users?.[actor]
      )
        throw new RmmError('ACCESS_DENIED');
      reply({ data: await this.request(command, { actor, domain }) });
    } catch (error) {
      reply({ error: error instanceof RmmError ? error.message : 'REQUEST_FAILED' });
    }
  }

  private async request(command: MeshCentralCommand, context: Context) {
    const store = this.store!;
    const db = store.db;
    const domain = context.domain.id;
    const { actor } = context;
    const admin = this.server.webserver?.users?.[actor]?.siteadmin === 0xffffffff;
    const { scriptId, version } = command;
    switch (command.subAction) {
      case 'listScripts': {
        const rows = db
          .prepare(
            'SELECT s.id, s.archived, v.version, v.data FROM scripts s JOIN versions v ON v.domain = s.domain AND v.script_id = s.id WHERE s.domain = ? AND v.version = (SELECT MAX(version) FROM versions WHERE domain = s.domain AND script_id = s.id) ORDER BY v.created DESC',
          )
          .all(domain);
        return [
          ...Object.entries(examples).map(([id, script]) =>
            this.scriptView(id, 1, false, script, admin, true),
          ),
          ...rows
            .filter((row) => admin || !row.archived)
            .map((row) =>
              this.scriptView(
                String(row.id),
                Number(row.version),
                Boolean(row.archived),
                JSON.parse(String(row.data)) as Script,
                admin,
                false,
              ),
            ),
        ];
      }
      case 'listScriptVersions':
      case 'getScriptVersion': {
        if (typeof scriptId !== 'string') throw new RmmError('INVALID_SCRIPT');
        const builtin = Object.hasOwn(examples, scriptId);
        const record = builtin
          ? undefined
          : db
              .prepare('SELECT archived FROM scripts WHERE domain = ? AND id = ?')
              .get(domain, scriptId);
        if (!builtin && (!record || (record.archived && !admin)))
          throw new RmmError('SCRIPT_UNAVAILABLE');
        const archived = Boolean(record?.archived);
        if (command.subAction === 'getScriptVersion') {
          const script = this.script(domain, scriptId, version, admin);
          return this.scriptView(scriptId, Number(version), archived, script, admin, builtin);
        }
        if (
          command.before !== undefined &&
          (typeof command.before !== 'number' ||
            !Number.isSafeInteger(command.before) ||
            command.before < 1)
        )
          throw new RmmError('INVALID_INPUT');
        const before =
          typeof command.before === 'number' ? command.before : Number.MAX_SAFE_INTEGER;
        if (builtin) {
          return { versions: before > 1 ? [{ version: 1 }] : [] };
        }
        const rows = db
          .prepare(
            'SELECT version, actor, created FROM versions WHERE domain = ? AND script_id = ? AND version < ? ORDER BY version DESC LIMIT 25',
          )
          .all(domain, scriptId, before);
        return {
          versions: rows,
          before: rows.length === 25 ? rows[24]?.version : undefined,
        };
      }
      case 'saveScript': {
        if (!admin) throw new RmmError('ACCESS_DENIED');
        const script = parseScript(command.script);
        if (scriptId !== undefined && typeof scriptId !== 'string')
          throw new RmmError('INVALID_SCRIPT');
        const id = scriptId ?? randomUUID();
        return store.transaction(() => {
          if (scriptId !== undefined) {
            this.script(domain, id, version);
            const latest = db
              .prepare(
                'SELECT MAX(version) AS version FROM versions WHERE domain = ? AND script_id = ?',
              )
              .get(domain, id);
            if (latest?.version !== version) throw new RmmError('VERSION_CONFLICT');
          } else {
            db.prepare('INSERT INTO scripts(domain, id) VALUES (?, ?)').run(domain, id);
          }
          const next = scriptId === undefined ? 1 : Number(version) + 1;
          db.prepare('INSERT INTO versions VALUES (?, ?, ?, ?, ?, ?)').run(
            domain,
            id,
            next,
            actor,
            Date.now(),
            JSON.stringify(script),
          );
          store.audit(domain, actor, 'saveScript', id + '/' + next);
          return { id, version: next };
        });
      }
      case 'archiveScript': {
        if (!admin || typeof scriptId !== 'string') throw new RmmError('ACCESS_DENIED');
        return store.transaction(() => {
          if (
            !db
              .prepare(
                'UPDATE scripts SET archived = 1 WHERE domain = ? AND id = ? AND archived = 0',
              )
              .run(domain, scriptId).changes
          ) {
            throw new RmmError('SCRIPT_UNAVAILABLE');
          }
          store.audit(domain, actor, 'archiveScript', scriptId);
          return {};
        });
      }
      case 'preview': {
        const script = this.script(domain, scriptId, version);
        const targets = await this.targets(
          context,
          stringList(command.nodeIds),
          stringList(command.groupIds),
          script,
        );
        const id = randomUUID();
        for (const [key, preview] of this.previews) {
          if (
            preview.expires < Date.now() ||
            (preview.actor === actor && preview.domain.id === domain)
          )
            this.previews.delete(key);
        }
        this.previews.set(id, {
          ...context,
          id: String(scriptId),
          version: Number(version),
          targets,
          expires: Date.now() + 300_000,
        });
        return { id, targets };
      }
      case 'submit': {
        const { key, previewId } = command;
        if (typeof key !== 'string' || !/^[\da-f-]{36}$/.test(key) || typeof previewId !== 'string')
          throw new RmmError('INVALID_INPUT');
        const previous = () =>
          db
            .prepare('SELECT id FROM tasks WHERE domain = ? AND actor = ? AND idem = ?')
            .get(domain, actor, key);
        const existing = previous();
        if (existing) return { id: existing.id };
        if (process.env.MESHCENTRAL_RMM_PAUSED === '1') throw new RmmError('RMM_PAUSED');
        const preview = this.previews.get(previewId);
        if (
          !preview ||
          preview.domain.id !== domain ||
          preview.actor !== actor ||
          preview.expires < Date.now()
        )
          throw new RmmError('PREVIEW_EXPIRED');
        const script = this.script(domain, preview.id, preview.version);
        const targets = await this.targets(
          context,
          preview.targets.map((target) => target.id),
          [],
          script,
        );
        const params = parseValues(script, command.params);
        return store.transaction(() => {
          const existing = previous();
          if (existing) return { id: existing.id };
          const id = randomUUID();
          db.prepare('INSERT INTO tasks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
            id,
            domain,
            actor,
            key,
            preview.id,
            preview.version,
            script.name,
            Date.now(),
            JSON.stringify(params),
          );
          const insert = db.prepare(
            'INSERT INTO executions(id, task_id, node_id, name, status, reason) VALUES (?, ?, ?, ?, ?, ?)',
          );
          for (const target of targets) {
            insert.run(
              randomUUID(),
              id,
              target.id,
              target.name,
              target.reason ? 'skipped' : 'queued',
              target.reason ?? null,
            );
          }
          store.audit(domain, actor, 'submit', id);
          this.previews.delete(previewId);
          return { id };
        });
      }
      case 'listTasks':
      case 'searchTasks':
      case 'getTask': {
        const detail = command.subAction === 'getTask';
        if (detail && typeof command.taskId !== 'string') throw new RmmError('INVALID_INPUT');
        if (
          command.query !== undefined &&
          (typeof command.query !== 'string' || command.query.length > 200)
        )
          throw new RmmError('INVALID_INPUT');
        const statuses = [
          'queued',
          'running',
          'succeeded',
          'failed',
          'skipped',
          'timeout',
          'unknown',
        ];
        if (
          command.status !== undefined &&
          (typeof command.status !== 'string' || !statuses.includes(command.status))
        )
          throw new RmmError('INVALID_INPUT');
        if (
          command.before !== undefined &&
          (typeof command.before !== 'number' ||
            !Number.isSafeInteger(command.before) ||
            command.before < 1)
        )
          throw new RmmError('INVALID_INPUT');
        const search = typeof command.query === 'string' ? command.query.trim() : '';
        const before =
          typeof command.before === 'number' && Number.isSafeInteger(command.before)
            ? command.before
            : Number.MAX_SAFE_INTEGER;
        const rows = (detail
          ? db
              .prepare('SELECT * FROM tasks WHERE domain = ? AND id = ?')
              .all(domain, String(command.taskId))
          : db
              .prepare(
                "SELECT *, rowid AS cursor FROM tasks WHERE domain = ? AND rowid < ? AND (? = '' OR instr(lower(name), lower(?)) > 0 OR instr(lower(actor), lower(?)) > 0 OR instr(lower(id), lower(?)) > 0) ORDER BY rowid DESC LIMIT 25",
              )
              .all(domain, before, search, search, search, search)) as unknown as (Task & {
          cursor?: number;
        })[];
        const rights = new Map<string, Promise<boolean>>();
        const views = await Promise.all(
          rows.map((row) => this.taskView(context, row, rights, detail)),
        );
        if (detail) {
          if (!views[0]) throw new RmmError('TASK_UNAVAILABLE');
          return views[0];
        }
        return {
          tasks: views.filter(
            (view) => view && (!command.status || (view.counts[String(command.status)] ?? 0) > 0),
          ),
          before: rows.length === 25 ? rows[24]?.cursor : undefined,
        };
      }
      case 'releaseDevice': {
        const { nodeId, executionId, reason } = command;
        if (!admin || typeof nodeId !== 'string' || !(await this.device(context, nodeId)))
          throw new RmmError('ACCESS_DENIED');
        if (
          typeof executionId !== 'string' ||
          typeof reason !== 'string' ||
          !reason.trim() ||
          reason.length > 1000
        )
          throw new RmmError('INVALID_INPUT');
        return store.transaction(() => {
          const occupied = db
            .prepare('SELECT * FROM device_occupancy WHERE node_id = ?')
            .get(nodeId);
          if (!occupied) return {};
          if (occupied.domain !== domain || occupied.execution_id !== executionId)
            throw new RmmError('OCCUPANCY_CONFLICT');
          const execution = db
            .prepare('SELECT status FROM executions WHERE id = ?')
            .get(executionId);
          if (execution?.status === 'running') throw new RmmError('EXECUTION_RUNNING');
          db.prepare('DELETE FROM device_occupancy WHERE node_id = ? AND execution_id = ?').run(
            nodeId,
            executionId,
          );
          store.audit(
            domain,
            actor,
            'releaseDevice',
            JSON.stringify({ nodeId, executionId, reason: reason.trim() }),
          );
          return {};
        });
      }
      default:
        throw new RmmError('UNKNOWN_ACTION');
    }
  }

  private scriptView(
    id: string,
    version: number,
    archived: boolean,
    script: Script,
    admin: boolean,
    builtin: boolean,
  ) {
    const { body, ...metadata } = script;
    return { id, version, archived, builtin, ...metadata, ...(admin ? { body } : {}) };
  }

  private script(domain: string, id: unknown, version: unknown, allowArchived = false): Script {
    if (typeof id !== 'string' || typeof version !== 'number' || !Number.isSafeInteger(version))
      throw new RmmError('INVALID_SCRIPT');
    if (version === 1 && Object.hasOwn(examples, id)) return examples[id]!;
    const row = this.store!.db.prepare(
      'SELECT v.data FROM versions v JOIN scripts s ON s.domain = v.domain AND s.id = v.script_id WHERE v.domain = ? AND v.script_id = ? AND v.version = ? AND (s.archived = 0 OR ? = 1)',
    ).get(domain, id, version, Number(allowArchived));
    if (!row) throw new RmmError('SCRIPT_UNAVAILABLE');
    return JSON.parse(String(row.data)) as Script;
  }

  private device(context: Context, id: string) {
    return new Promise<{ agent?: { id?: number }; name?: string } | undefined>((resolve) => {
      const webserver = this.server.webserver;
      if (!webserver?.GetNodeWithRights || !id.startsWith('node/' + context.domain.id + '/'))
        return resolve(undefined);
      webserver.GetNodeWithRights(context.domain, context.actor, id, (node, rights, visible) => {
        resolve(visible && (rights & 0x20000) !== 0 ? (node ?? undefined) : undefined);
      });
    });
  }

  private agent(id: string): MeshCentralAgentConnection | undefined {
    const agent = this.server.webserver?.wsagents?.[id];
    return agent?.authenticated === 2 && agent.agentInfo ? agent : undefined;
  }

  private async targets(
    context: Context,
    nodes: string[],
    groups: string[],
    script: Script,
  ): Promise<Target[]> {
    const ids = new Set(nodes);
    if (groups.length) {
      if (groups.some((group) => !group.startsWith('mesh/' + context.domain.id + '/')))
        throw new RmmError('INVALID_TARGET');
      if (groups.some((group) => !this.server.webserver?.GetMeshRights?.(context.actor, group))) {
        throw new RmmError('ACCESS_DENIED');
      }
      const documents = await new Promise<unknown[]>((resolve, reject) => {
        const db = this.server.db;
        if (!db?.GetAllTypeNoTypeField) return reject(new RmmError('GROUPS_UNAVAILABLE'));
        db.GetAllTypeNoTypeField('node', context.domain.id, (error, records) =>
          error ? reject(error) : resolve(records),
        );
      });
      const groupIds = new Set(groups);
      for (const entry of documents) {
        const { meshid, _id } = object(entry);
        if (typeof meshid === 'string' && groupIds.has(meshid) && typeof _id === 'string')
          ids.add(_id);
        if (ids.size > 100) throw new RmmError('INVALID_TARGET_COUNT');
      }
    }
    if (ids.size < 1 || ids.size > 100) throw new RmmError('INVALID_TARGET_COUNT');
    return Promise.all(
      [...ids].map(async (id) => {
        const device = await this.device(context, id);
        if (!device) throw new RmmError('ACCESS_DENIED');
        const reason = !supportsAgent(script, device.agent?.id ?? 0)
          ? 'UNSUPPORTED_AGENT'
          : this.agent(id)
            ? undefined
            : 'AGENT_OFFLINE';
        return { id, name: device.name ?? id, reason };
      }),
    );
  }

  private async taskView(
    context: Context,
    task: Task,
    rights: Map<string, Promise<boolean>>,
    detail: boolean,
  ) {
    const db = this.store!.db;
    const rows = db
      .prepare('SELECT * FROM executions WHERE task_id = ?')
      .all(task.id) as unknown as Execution[];
    const visible = (
      await Promise.all(
        rows.map(async (row) => {
          let access = rights.get(row.node_id);
          if (!access) {
            access = this.device(context, row.node_id).then(Boolean);
            rights.set(row.node_id, access);
          }
          return (await access) ? row : undefined;
        }),
      )
    ).filter((row) => row !== undefined);
    if (!visible.length) return undefined;
    const counts: Record<string, number> = {};
    for (const row of visible) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return {
      id: task.id,
      actor: task.actor,
      scriptId: task.script_id,
      version: task.version,
      name: task.name,
      platform: this.script(task.domain, task.script_id, task.version, true).platform ?? 'windows',
      created: task.created,
      counts,
      active: visible.some((row) => pending(row.status)),
      ...(detail
        ? {
            results: visible.map((row) => ({
              executionId: row.id,
              ...this.occupancyView(context, row),
              id: row.node_id,
              name: row.name,
              status: row.status,
              reason: row.reason,
              exitCode: row.exit_code,
              output: row.output,
              truncated: Boolean(row.truncated),
            })),
          }
        : {}),
    };
  }

  private occupancyView(context: Context, row: Execution) {
    const occupied = this.store!.db.prepare(
      'SELECT execution_id FROM device_occupancy WHERE domain = ? AND node_id = ?',
    ).get(context.domain.id, row.node_id);
    if (!occupied || (row.status !== 'queued' && occupied.execution_id !== row.id)) return {};
    const running =
      this.store!.db.prepare('SELECT status FROM executions WHERE id = ?').get(
        String(occupied.execution_id),
      )?.status === 'running';
    return {
      occupiedBy: String(occupied.execution_id),
      ...(row.status === 'running'
        ? {}
        : { waitingReason: running ? 'DEVICE_BUSY' : 'REMOTE_STATE_UNKNOWN' }),
      canRelease:
        !running && this.server.webserver?.users?.[context.actor]?.siteadmin === 0xffffffff,
    };
  }

  private async tick(): Promise<void> {
    if (!this.store || this.ticking) return;
    this.ticking = true;
    const db = this.store.db;
    try {
      const now = Date.now();
      db.prepare(
        "UPDATE executions SET status = 'timeout', reason = 'NO_RECEIPT' WHERE status = 'running' AND deadline <= ?",
      ).run(now);
      if (now - this.lastMaintenance >= 3_600_000) {
        this.store.maintain();
        this.lastMaintenance = now;
      }
      if (process.env.MESHCENTRAL_RMM_PAUSED === '1') return;
      const active = Number(
        db.prepare('SELECT COUNT(*) AS count FROM device_occupancy').get()?.count ?? 0,
      );
      const candidates = db
        .prepare(
          "SELECT e.*, t.domain, t.actor, t.script_id, t.version, t.params FROM executions e JOIN tasks t ON t.id = e.task_id WHERE e.status = 'queued' AND NOT EXISTS (SELECT 1 FROM device_occupancy o WHERE o.node_id = e.node_id) ORDER BY t.created, e.rowid",
        )
        .all() as unknown as (Execution & Task)[];
      let slots = Math.max(0, 5 - active);
      for (const row of candidates) {
        if (slots === 0) break;
        const domain = this.server.config?.domains?.[row.domain];
        const device = domain
          ? await this.device({ actor: row.actor, domain }, row.node_id)
          : undefined;
        const agent = this.agent(row.node_id);
        const script = this.script(row.domain, row.script_id, row.version, true);
        const reason = !device
          ? 'ACCESS_DENIED'
          : !supportsAgent(script, device.agent?.id ?? 0)
            ? 'UNSUPPORTED_AGENT'
            : !agent
              ? 'AGENT_OFFLINE'
              : undefined;
        if (reason) {
          db.prepare(
            "UPDATE executions SET status = 'skipped', reason = ? WHERE id = ? AND status = 'queued'",
          ).run(reason, row.id);
          continue;
        }
        const command = buildCommand(
          row.id,
          row.actor,
          script,
          JSON.parse(row.params) as Record<string, unknown>,
        );
        const acquired = this.store.transaction(() => {
          if (
            Number(db.prepare('SELECT COUNT(*) AS count FROM device_occupancy').get()?.count) >= 5
          )
            return false;
          const changed = db
            .prepare('INSERT OR IGNORE INTO device_occupancy VALUES (?, ?, ?, ?)')
            .run(row.node_id, row.id, row.domain, Date.now());
          if (!changed.changes) return false;
          db.prepare(
            "UPDATE executions SET status = 'running', deadline = ? WHERE id = ? AND status = 'queued'",
          ).run(Date.now() + 300_000, row.id);
          return true;
        });
        if (!acquired) continue;
        slots--;
        try {
          agent!.send(JSON.stringify(command));
        } catch {
          db.prepare(
            "UPDATE executions SET status = 'unknown', reason = 'SEND_UNCERTAIN' WHERE id = ? AND status = 'running'",
          ).run(row.id);
        }
      }
    } catch {
      console.error('[rmm] Execution scheduler failed');
    } finally {
      this.ticking = false;
    }
  }

  @PluginHook('hook_processAgentData')
  onAgentData(command: MeshCentralCommand, agent: MeshCentralAgentConnection): void {
    if (!this.store || agent.authenticated !== 2 || !agent.dbNodeKey) return;
    const result = readResult(command);
    if (!result) return;
    try {
      const received = Date.now();
      this.store.transaction(() => {
        const occupied = this.store!.db.prepare(
          'SELECT execution_id FROM device_occupancy WHERE node_id = ? AND execution_id = ?',
        ).get(agent.dbNodeKey!, result.id);
        if (!occupied) return;
        this.store!.db.prepare(
          "UPDATE executions SET status = 'timeout', reason = 'NO_RECEIPT' WHERE id = ? AND status = 'running' AND deadline <= ?",
        ).run(result.id, received);
        this.store!.db.prepare(
          "UPDATE executions SET status = ?, exit_code = ?, output = ?, truncated = ? WHERE id = ? AND node_id = ? AND status = 'running' AND deadline > ?",
        ).run(
          result.exitCode === 0 ? 'succeeded' : 'failed',
          result.exitCode,
          result.output,
          Number(result.truncated),
          result.id,
          agent.dbNodeKey!,
          received,
        );
        this.store!.db.prepare(
          'DELETE FROM device_occupancy WHERE node_id = ? AND execution_id = ?',
        ).run(agent.dbNodeKey!, result.id);
      });
    } catch {
      console.error('[rmm] Unable to persist execution receipt');
    }
  }
}
