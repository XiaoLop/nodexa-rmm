import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs';
import path from 'node:path';

import { redactSensitive } from './redact';

export interface AuditEvent {
  readonly event: string;
  readonly [key: string]: unknown;
}

export interface ToolCallAudit {
  readonly tool: string;
  readonly args: unknown;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly resultBytes?: number;
  readonly errorCode?: string;
  readonly user?: string;
  readonly targetDevices?: readonly string[];
  readonly connection?: { readonly status: string; readonly reconnectAttempt: number };
}

export interface AuditWriter {
  toolCall(entry: ToolCallAudit): void;
  connection(status: string, reconnectAttempt: number): void;
  event(event: AuditEvent): void;
  close(): Promise<void>;
}

export interface AuditWriterOptions {
  readonly file?: string;
  readonly now?: () => Date;
}

const NOOP_AUDIT: AuditWriter = {
  toolCall: () => undefined,
  connection: () => undefined,
  event: () => undefined,
  close: async () => undefined,
};

export function createAuditWriter(options: AuditWriterOptions = {}): AuditWriter {
  if (!options.file) return NOOP_AUDIT;

  const now = options.now ?? (() => new Date());
  let stream: WriteStream | undefined;
  let failed = false;

  try {
    mkdirSync(path.dirname(options.file), { recursive: true });
    stream = createWriteStream(options.file, { flags: 'a', mode: 0o600, encoding: 'utf8' });
    stream.on('error', (error) => {
      if (failed) return;
      failed = true;
      process.stderr.write(`[meshcentral-mcp] audit log disabled: ${String(error)}\n`);
      stream = undefined;
    });
  } catch (error) {
    process.stderr.write(`[meshcentral-mcp] audit log disabled: ${String(error)}\n`);
    return NOOP_AUDIT;
  }

  const write = (payload: Record<string, unknown>): void => {
    if (!stream || failed) return;
    const line = JSON.stringify(redactSensitive({ ts: now().toISOString(), ...payload }));
    stream.write(`${line}\n`);
  };

  return {
    toolCall(entry) {
      write({
        event: 'tool.call',
        tool: entry.tool,
        args: entry.args,
        ok: entry.ok,
        durationMs: entry.durationMs,
        ...(entry.resultBytes === undefined ? {} : { resultBytes: entry.resultBytes }),
        ...(entry.errorCode === undefined ? {} : { errorCode: entry.errorCode }),
        ...(entry.user === undefined ? {} : { user: entry.user }),
        ...(entry.targetDevices === undefined ? {} : { targetDevices: entry.targetDevices }),
        ...(entry.connection === undefined ? {} : { connection: entry.connection }),
      });
    },
    connection(status, reconnectAttempt) {
      write({ event: 'connection', status, reconnectAttempt });
    },
    event(entry) {
      write(entry as unknown as Record<string, unknown>);
    },
    async close() {
      const active = stream;
      stream = undefined;
      if (!active) return;
      await new Promise<void>((resolve) => {
        active.end(() => resolve());
      });
    },
  };
}
