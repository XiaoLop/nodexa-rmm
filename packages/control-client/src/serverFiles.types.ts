export const MAX_SERVER_FILE_BYTES = 200 * 1024;

export type ServerFileSpaceKind = 'user' | 'mesh';
export type ServerFileEntryKind = 'directory' | 'file';

export interface ServerFileEntry {
  name: string;
  kind: ServerFileEntryKind;
  path: string[];
  size?: number;
  modifiedAt?: Date;
  children?: ServerFileEntry[];
}

export interface ServerFileSpace {
  id: string;
  name: string;
  kind: ServerFileSpaceKind;
  path: [string];
  maxBytes?: number;
  usedBytes: number;
  entries: ServerFileEntry[];
}

export interface ServerFileTree {
  spaces: ServerFileSpace[];
  receivedAt: Date;
}