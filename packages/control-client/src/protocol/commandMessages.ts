import type { CommandOutputStream, NormalizedCommandMessage } from '../types';

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

function unwrap(raw: unknown): UnknownRecord | undefined {
  let current = record(raw);
  for (let depth = 0; current && depth < 4; depth += 1) {
    const nested =
      record(current.data) ??
      record(current.payload) ??
      record(current.message) ??
      record(current.event);
    if (!nested) break;
    current = { ...current, ...nested };
  }
  return current;
}

const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const boolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined);

function stream(value: unknown): CommandOutputStream {
  const normalized = text(value)?.toLowerCase();
  if (normalized === 'stdout' || normalized === 'stderr' || normalized === 'system')
    return normalized;
  return 'output';
}

export function isCommandConsoleEnd(content: string) {
  const ansiEscape = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g');
  const normalized = content.replace(ansiEscape, '').trimEnd();
  return /(?:^|[\r\n])[^\r\n>]*>\s*exit\s*$/i.test(normalized);
}

export function normalizeCommandMessage(raw: unknown): NormalizedCommandMessage | undefined {
  const value = unwrap(raw);
  if (!value) return undefined;

  const action = text(value.action)?.toLowerCase();
  const type = text(value.type)?.toLowerCase();
  const requestId = text(value.responseid) ?? text(value.responseId) ?? text(value.tag);
  const deviceId = text(value.nodeid) ?? text(value.nodeId) ?? text(value.deviceId);
  const isConsoleOutput = action === 'msg' && type === 'console' && Boolean(deviceId);
  const isFinalResult = action === 'msg' && type === 'runcommands' && Boolean(deviceId);
  const relevant =
    action === 'runcommands' ||
    type === 'runcommands' ||
    isConsoleOutput ||
    Boolean(requestId?.startsWith('command-'));
  if (!relevant) return undefined;

  const exitCode = number(value.exitCode) ?? number(value.exitcode) ?? number(value.code);
  const error =
    text(value.error) ??
    text(value.err) ??
    (value.result === 'error' ? text(value.message) : undefined);
  const content =
    text(value.output) ??
    text(value.stdout) ??
    text(value.stderr) ??
    text(value.value) ??
    (typeof value.result === 'string' &&
    !['ok', 'success', 'error'].includes(value.result.toLowerCase())
      ? value.result
      : undefined);
  const phase = text(value.phase)?.toLowerCase() ?? text(value.status)?.toLowerCase();
  const completed = boolean(value.completed) ?? boolean(value.done) ?? boolean(value.finished);

  let kind: NormalizedCommandMessage['kind'] = 'unknown';
  if (phase === 'cancelled' || phase === 'canceled') kind = 'cancelled';
  else if (error || phase === 'failed' || phase === 'error' || value.result === 'error')
    kind = 'failed';
  else if (
    completed ||
    isFinalResult ||
    phase === 'completed' ||
    phase === 'succeeded' ||
    exitCode !== undefined
  )
    kind = 'completed';
  else if (content !== undefined) kind = 'output';
  else if (phase === 'accepted' || phase === 'running' || value.result === 'ok') kind = 'accepted';

  const inferredStream =
    value.stderr !== undefined
      ? 'stderr'
      : value.stdout !== undefined
        ? 'stdout'
        : stream(value.stream);
  return {
    requestId,
    deviceId,
    kind,
    finalResult: isFinalResult,
    stream: content === undefined ? undefined : inferredStream,
    content,
    exitCode,
    error,
    raw,
  };
}
