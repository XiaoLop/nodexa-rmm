export type FilesSessionState = 'ready' | 'busy' | 'closed' | 'error';

export type FileOperationState =
  | 'idle'
  | 'requesting'
  | 'waiting-start'
  | 'reading'
  | 'receiving'
  | 'sending'
  | 'waiting-ack'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'timed-out'
  | 'connection-lost';

export type FileEntryKind = 'drive' | 'directory' | 'file' | 'unknown';

export interface FileEntry {
  name: string;
  path: string;
  kind: FileEntryKind;
  size?: number;
  modifiedAt?: Date;
  driveType?: string;
  raw: Readonly<Record<string, unknown>>;
}

export interface DirectoryListing {
  path: string;
  entries: FileEntry[];
}

export interface FilePath {
  value: string;
  style: 'windows' | 'posix' | 'root';
}

export type FileOperationErrorCode =
  | 'busy'
  | 'cancelled'
  | 'connection-lost'
  | 'invalid-path'
  | 'not-found'
  | 'permission-denied'
  | 'protocol'
  | 'source'
  | 'timed-out'
  | 'unknown';

export class FileOperationError extends Error {
  constructor(
    message: string,
    readonly code: FileOperationErrorCode,
    readonly requestId?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'FileOperationError';
  }
}

export interface FileOperationOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type ListDirectoryOptions = FileOperationOptions;

export interface UploadSource {
  readonly name: string;
  readonly size: number;
  readonly type?: string;
  read(start: number, end: number): Promise<ArrayBuffer | ArrayBufferView | Blob>;
}

export interface FileUploadProgress {
  requestId: string;
  state: FileOperationState;
  acknowledgedBytes: number;
  sentBytes: number;
  totalBytes: number;
  percentage: number;
}

export interface UploadFileOptions extends FileOperationOptions {
  chunkSize?: number;
  name?: string;
  onProgress?: (progress: FileUploadProgress) => void;
}

export interface FileUploadResult {
  requestId: string;
  path: string;
  name: string;
  size: number;
}

export interface DownloadSink {
  write(chunk: Uint8Array): void | Promise<void>;
  close(): void | Promise<void>;
  abort(reason?: unknown): void | Promise<void>;
}

export interface FileDownloadProgress {
  requestId: string;
  state: FileOperationState;
  receivedBytes: number;
  totalBytes?: number;
  percentage?: number;
}

export interface DownloadFileOptions extends FileOperationOptions {
  totalBytes?: number;
  onProgress?: (progress: FileDownloadProgress) => void;
}

export interface FileDownloadResult {
  requestId: string;
  path: string;
  size: number;
}

export interface FilesSessionOptions {
  defaultTimeoutMs?: number;
  defaultChunkSize?: number;
  createRequestId?: () => string;
  onUnhandledMessage?: (message: unknown) => void;
}
