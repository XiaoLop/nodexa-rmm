import { DatabaseSync } from 'node:sqlite';

export class RmmStore {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS scripts (
        domain TEXT NOT NULL, id TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (domain, id)
      );
      CREATE TABLE IF NOT EXISTS versions (
        domain TEXT NOT NULL, script_id TEXT NOT NULL, version INTEGER NOT NULL,
        actor TEXT NOT NULL, created INTEGER NOT NULL, data TEXT NOT NULL,
        PRIMARY KEY (domain, script_id, version),
        FOREIGN KEY (domain, script_id) REFERENCES scripts(domain, id)
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, domain TEXT NOT NULL, actor TEXT NOT NULL, idem TEXT NOT NULL,
        script_id TEXT NOT NULL, version INTEGER NOT NULL, name TEXT NOT NULL,
        created INTEGER NOT NULL, params TEXT NOT NULL, UNIQUE (domain, actor, idem)
      );
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        node_id TEXT NOT NULL, name TEXT NOT NULL, status TEXT NOT NULL, reason TEXT,
        deadline INTEGER, exit_code INTEGER, output TEXT, truncated INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS rmm_execution_task ON executions(task_id);
      CREATE INDEX IF NOT EXISTS rmm_execution_state ON executions(status, node_id);
      CREATE TABLE IF NOT EXISTS audit (
        domain TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL,
        created INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS device_occupancy (
        node_id TEXT PRIMARY KEY, execution_id TEXT NOT NULL UNIQUE,
        domain TEXT NOT NULL, created INTEGER NOT NULL
      );
      INSERT OR IGNORE INTO device_occupancy
        SELECT e.node_id, e.id, t.domain, t.created FROM executions e
        JOIN tasks t ON t.id = e.task_id WHERE e.status = 'running';
      UPDATE executions SET status = 'unknown', reason = 'SERVER_RESTART' WHERE status = 'running';
    `);
  }

  transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  audit(domain: string, actor: string, action: string, target: string): void {
    this.db
      .prepare('INSERT INTO audit VALUES (?, ?, ?, ?, ?)')
      .run(domain, actor, action, target, Date.now());
  }

  maintain(): void {
    const day = 86_400_000;
    const now = Date.now();
    this.db
      .prepare(
        'UPDATE executions SET output = NULL WHERE output IS NOT NULL AND task_id IN (SELECT id FROM tasks WHERE created < ?)',
      )
      .run(now - 30 * day);
    this.db.prepare('DELETE FROM tasks WHERE created < ?').run(now - 90 * day);
    this.db.prepare('DELETE FROM audit WHERE created < ?').run(now - 90 * day);
  }
}
