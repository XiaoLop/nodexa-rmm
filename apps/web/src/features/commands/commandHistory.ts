import type { CommandShell } from '@meshcentral/control-client';

export interface CommandHistoryEntry {
  id: string;
  command: string;
  shell: CommandShell;
  targetCount: number;
  createdAt: number;
}

let entries: CommandHistoryEntry[] = [];

export function getCommandHistory() {
  return entries.map((entry) => ({ ...entry }));
}

export function addCommandHistory(entry: Omit<CommandHistoryEntry, 'id' | 'createdAt'>) {
  entries = entries.filter(
    (current) => current.command !== entry.command || current.shell !== entry.shell,
  );
  entries.unshift({ ...entry, id: crypto.randomUUID(), createdAt: Date.now() });
  entries = entries.slice(0, 20);
  return getCommandHistory();
}

export function clearCommandHistory() {
  entries = [];
}
