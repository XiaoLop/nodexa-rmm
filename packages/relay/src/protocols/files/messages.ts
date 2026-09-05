import { FileOperationError, type DirectoryListing, type FileEntry } from './types';
import { joinFilePath, normalizeFilePath } from './path';

export interface FilesProtocolMessage {
  action?: string;
  requestId?: string;
  raw: Readonly<Record<string, unknown>>;
}

export interface DirectoryListMessage extends FilesProtocolMessage {
  path: string;
  entries: FileEntry[];
}

export function createListDirectoryMessage(
  path: string,
  requestId: string,
): Record<string, unknown> {
  return { action: 'ls', reqid: requestId, path };
}

export function createUploadMessage(
  path: string,
  name: string,
  size: number,
  requestId: string,
): Record<string, unknown> {
  return { action: 'upload', reqid: requestId, path, name, size };
}

export function createUploadDoneMessage(requestId: string): Record<string, unknown> {
  return { action: 'uploaddone', reqid: requestId };
}

export function createUploadCancelMessage(requestId: string): Record<string, unknown> {
  return { action: 'uploadcancel', reqid: requestId };
}

export function createDownloadStartMessage(
  path: string,
  requestId: string,
): Record<string, unknown> {
  return { action: 'download', sub: 'start', id: requestId, path };
}

export function createDownloadStartAckMessage(requestId: string): Record<string, unknown> {
  return { action: 'download', sub: 'startack', id: requestId, ack: 1 };
}

export function createDownloadAckMessage(requestId: string): Record<string, unknown> {
  return { action: 'download', sub: 'ack', id: requestId };
}

export function createDownloadStopMessage(requestId: string): Record<string, unknown> {
  return { action: 'download', sub: 'stop', id: requestId };
}

export function parseFilesProtocolText(text: string): FilesProtocolMessage {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new FileOperationError(
      'Received invalid JSON from the file relay.',
      'protocol',
      undefined,
      {
        cause: error,
      },
    );
  }
  if (!isRecord(value)) {
    throw new FileOperationError('File relay JSON message must be an object.', 'protocol');
  }
  return {
    action: typeof value.action === 'string' ? value.action.toLowerCase() : undefined,
    requestId: requestIdOf(value),
    raw: value,
  };
}

export function isDirectoryListMessage(message: FilesProtocolMessage): boolean {
  return Array.isArray(message.raw.dir);
}

export function parseDirectoryListing(
  message: FilesProtocolMessage,
  requestedPath: string,
): DirectoryListing {
  if (!isDirectoryListMessage(message)) {
    throw errorFromMessage(message, 'Directory response omitted the dir array.');
  }
  const rawPath = typeof message.raw.path === 'string' ? message.raw.path : requestedPath;
  const path = normalizeFilePath(rawPath);
  const entries = (message.raw.dir as unknown[]).map((entry, index) =>
    parseFileEntry(entry, path, index),
  );
  return { path, entries };
}

export function errorFromMessage(
  message: FilesProtocolMessage,
  fallback = 'The remote file operation failed.',
): FileOperationError {
  const detail = firstString(
    message.raw.error,
    message.raw.message,
    message.raw.msg,
    message.raw.reason,
  );
  const text = detail ?? fallback;
  const lower = text.toLowerCase();
  const code =
    lower.includes('denied') || lower.includes('permission') || lower.includes('access')
      ? 'permission-denied'
      : lower.includes('not found') || lower.includes('no such')
        ? 'not-found'
        : 'protocol';
  return new FileOperationError(text, code, message.requestId);
}

export function messageIndicatesError(message: FilesProtocolMessage): boolean {
  if (message.action?.includes('error')) return true;
  if (message.raw.error != null) return true;
  return message.raw.result === false || message.raw.success === false;
}

function parseFileEntry(value: unknown, parentPath: string, index: number): FileEntry {
  if (!isRecord(value)) {
    throw new FileOperationError(`Directory entry ${index} is invalid.`, 'protocol');
  }
  const name = firstString(value.n, value.name, value.filename);
  if (!name) throw new FileOperationError(`Directory entry ${index} omitted its name.`, 'protocol');
  const type = typeof value.t === 'number' ? value.t : undefined;
  const kind =
    type === 1
      ? 'drive'
      : type === 2
        ? 'directory'
        : type === 3
          ? 'file'
          : value.directory === true
            ? 'directory'
            : value.file === true
              ? 'file'
              : 'unknown';
  const size = numberOf(value.s, value.size);
  const modifiedAt = dateOf(value.d, value.mtime, value.modified);
  return {
    name,
    path: parentPath ? joinFilePath(parentPath, name) : normalizeFilePath(name),
    kind,
    ...(size === undefined ? {} : { size }),
    ...(modifiedAt === undefined ? {} : { modifiedAt }),
    ...(typeof value.dt === 'string' ? { driveType: value.dt } : {}),
    raw: value,
  };
}

function requestIdOf(value: Readonly<Record<string, unknown>>): string | undefined {
  const requestId = value.reqid ?? value.requestId ?? value.id;
  if (typeof requestId === 'string' || typeof requestId === 'number') return String(requestId);
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}

function numberOf(...values: unknown[]): number | undefined {
  const value = values.find(
    (candidate) => typeof candidate === 'number' || typeof candidate === 'string',
  );
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function dateOf(...values: unknown[]): Date | undefined {
  const value = values.find(
    (candidate) => typeof candidate === 'number' || typeof candidate === 'string',
  );
  if (value === undefined) return undefined;
  const parsed = new Date(
    typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : value,
  );
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
