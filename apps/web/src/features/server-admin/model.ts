/* eslint-disable no-control-regex -- Terminal sanitization and local input explicitly match control characters. */
export const VERIFIED_COMMANDS = ['help', 'info', 'versions', 'maintenance'] as const;
export const TRACE_LIMIT = 5000;
// MeshCentral 1.1.54 default.handlebars setServerTracingEx (includes legacy sources).
export const TRACE_SOURCE_CATALOG_VERSION = '1.1.54';
export const KNOWN_TRACE_SOURCES = [
  'cookie', 'dispatch', 'main', 'peer', 'web', 'webrequest', 'relay',
  'webrelaydata', 'webrelay', 'mps', 'mpscmd', 'swarm', 'swarmcmd',
  'agentupdate', 'agent', 'cert', 'db', 'email', 'amt', 'httpheaders', 'authlog',
] as const;

export function traceSourceOptions(enabled: readonly string[] = [], observed: readonly string[] = []) {
  return [...new Set<string>([...KNOWN_TRACE_SOURCES, ...enabled, ...observed])]
    .map(value => ({ value, label: value }));
}

// Never allow server text (including OSC links and C1 controls) to drive xterm.
export function safeTerminalText(value: string): string {
  return value
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\|$)/g, '')
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[^\n]?/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, '')
    .replace(/\n/g, '\r\n');
}

export function boundedAppend<T>(previous: readonly T[], incoming: readonly T[], limit = TRACE_LIMIT): T[] {
  return [...previous.slice(-limit), ...incoming.slice(-limit)].slice(-limit);
}

export function printable(value: unknown): string {
  try { return typeof value === 'string' ? value : JSON.stringify(value) ?? String(value); }
  catch { return '[unserializable]'; }
}

export function downloadText(content: string, name: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export interface LineState { text: string; cursor: number }
export function editLine(line: LineState, input: string): LineState {
  if (input === '\x1b[D') return { ...line, cursor: Math.max(0, line.cursor - 1) };
  if (input === '\x1b[C') return { ...line, cursor: Math.min(line.text.length, line.cursor + 1) };
  if (input === '\x01' || input === '\x1b[H') return { ...line, cursor: 0 };
  if (input === '\x05' || input === '\x1b[F') return { ...line, cursor: line.text.length };
  if (input === '\x7f' || input === '\b') return line.cursor ? {
    text: line.text.slice(0, line.cursor - 1) + line.text.slice(line.cursor), cursor: line.cursor - 1,
  } : line;
  if (input === '\x1b[3~') return { ...line, text: line.text.slice(0, line.cursor) + line.text.slice(line.cursor + 1) };
  if (input === '\t') {
    const matches = VERIFIED_COMMANDS.filter(command => command.startsWith(line.text));
    const match = matches.length === 1 ? matches[0] : undefined;
    return match ? { text: match, cursor: match.length } : line;
  }
  // Paste is text only; multiline paste never executes commands.
  if (input.includes('\x1b')) return line;
  const text = input.replace(/[\x00-\x1f\x7f-\x9f]/g, '').slice(0, 4096 - line.text.length);
  return { text: line.text.slice(0, line.cursor) + text + line.text.slice(line.cursor), cursor: line.cursor + text.length };
}
