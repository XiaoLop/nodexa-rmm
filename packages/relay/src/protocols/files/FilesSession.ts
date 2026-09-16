import type { RelayInboundData } from '../../types';
import type { RelaySession } from '../../RelaySession';
import {
  createCopyFilesMessage,
  createDirectoryMessage,
  createDownloadAckMessage,
  createDownloadStartAckMessage,
  createDownloadStartMessage,
  createDownloadStopMessage,
  createListDirectoryMessage,
  createMoveFilesMessage,
  createRemoveEntriesMessage,
  createRenameEntryMessage,
  createUnzipMessage,
  createUploadCancelMessage,
  createUploadDoneMessage,
  createUploadMessage,
  createZipMessage,
  errorFromMessage,
  isFileRefreshMessage,
  isDirectoryListMessage,
  messageIndicatesError,
  parseDirectoryListing,
  parseFileDialogMessage,
  parseFilesProtocolText,
  type FilesProtocolMessage,
} from './messages';
import { normalizeFileName, normalizeFilePath } from './path';
import {
  FileOperationError,
  type DownloadFileOptions,
  type DownloadSink,
  type DirectoryListing,
  type FileCommandReceipt,
  type FileDialogMessage,
  type FileDownloadProgress,
  type FileDownloadResult,
  type FileOperationState,
  type FileUploadProgress,
  type FileUploadResult,
  type FilesSessionOptions,
  type FilesSessionState,
  type ListDirectoryOptions,
  type RemoveEntriesOptions,
  type UploadFileOptions,
  type UploadSource,
} from './types';

interface ActiveOperation<T> {
  requestId: string;
  kind: 'list' | 'upload' | 'download';
  state: FileOperationState;
  timeoutMs: number;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout?: ReturnType<typeof setTimeout>;
  removeAbort?: () => void;
  handleMessage(message: FilesProtocolMessage): void;
  cancel(error: FileOperationError, notifyRemote: boolean): void;
}

interface DownloadOperation extends ActiveOperation<FileDownloadResult> {
  kind: 'download';
  path: string;
  sink: DownloadSink;
  receivedBytes: number;
  totalBytes?: number;
  onProgress?: (progress: FileDownloadProgress) => void;
}

type AnyActiveOperation = ActiveOperation<any>;

interface UploadOperation extends ActiveOperation<FileUploadResult> {
  kind: 'upload';
  path: string;
  name: string;
  source: UploadSource;
  chunkSize: number;
  sentBytes: number;
  acknowledgedBytes: number;
  awaitingBytes: number;
  finishing: boolean;
  onProgress?: (progress: FileUploadProgress) => void;
  sendNext(): Promise<void>;
}

export class FilesSession {
  private active?: AnyActiveOperation;
  private archiveBusy = false;
  private disposed = false;
  private requestSequence = 0;
  private inboundQueue = Promise.resolve();
  private readonly removeListeners: Array<() => void> = [];
  private readonly dialogListeners = new Set<(message: FileDialogMessage) => void>();
  private readonly refreshListeners = new Set<() => void>();

  constructor(
    readonly relay: RelaySession,
    private readonly options: FilesSessionOptions = {},
  ) {
    if (relay.protocol !== 5) {
      throw new FileOperationError('FilesSession requires a p=5 relay session.', 'protocol');
    }
    if (relay.state !== 'ready') {
      throw new FileOperationError('File relay session is not ready.', 'connection-lost');
    }
    this.removeListeners.push(
      relay.onMessage((data) => {
        this.inboundQueue = this.inboundQueue.then(() => this.handleInbound(data));
      }),
      relay.onError((error) => this.failConnection(error)),
      relay.onClose(() => this.failConnection(new Error('File relay connection was closed.'))),
    );
  }

  get state(): FilesSessionState {
    if (this.disposed) return this.relay.state === 'error' ? 'error' : 'closed';
    return this.active || this.archiveBusy ? 'busy' : 'ready';
  }

  async listDirectory(path = '', options: ListDirectoryOptions = {}): Promise<DirectoryListing> {
    this.assertAvailable();
    if (options.signal?.aborted) {
      throw new FileOperationError('File operation was cancelled.', 'cancelled');
    }
    const normalizedPath = normalizeFilePath(path);
    const requestId = this.nextRequestId('ls');
    const promise = new Promise<DirectoryListing>((resolve, reject) => {
      const operation: ActiveOperation<DirectoryListing> = {
        requestId,
        kind: 'list',
        state: 'requesting',
        timeoutMs: 0,
        resolve,
        reject,
        handleMessage: (message) => {
          if (messageIndicatesError(message)) {
            this.finishFailure(operation, errorFromMessage(message));
            return;
          }
          if (!isDirectoryListMessage(message)) return;
          try {
            this.finishSuccess(operation, parseDirectoryListing(message, normalizedPath));
          } catch (error) {
            this.finishFailure(operation, toFileError(error, requestId));
          }
        },
        cancel: (error) => this.finishFailure(operation, error),
      };
      this.startOperation(operation, options);
    });
    try {
      this.relay.sendJson(createListDirectoryMessage(normalizedPath, requestId));
    } catch (error) {
      this.active?.cancel(connectionError(error, requestId), false);
    }
    return promise;
  }

  async uploadFile(
    path: string,
    source: UploadSource,
    options: UploadFileOptions = {},
  ): Promise<FileUploadResult> {
    this.assertAvailable();
    if (options.signal?.aborted) {
      throw new FileOperationError('File operation was cancelled.', 'cancelled');
    }
    const normalizedPath = normalizeFilePath(path);
    const name = options.name ?? source.name;
    assertUploadSource(source, name);
    const requestId = this.nextRequestId('up');
    const chunkSize = options.chunkSize ?? this.options.defaultChunkSize ?? 5 * 1024 * 1024;
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new FileOperationError(
        'Upload chunk size must be a positive integer.',
        'source',
        requestId,
      );
    }

    const promise = new Promise<FileUploadResult>((resolve, reject) => {
      const operation: UploadOperation = {
        requestId,
        kind: 'upload',
        state: 'waiting-start',
        timeoutMs: 0,
        path: normalizedPath,
        name,
        source,
        chunkSize,
        sentBytes: 0,
        acknowledgedBytes: 0,
        awaitingBytes: 0,
        finishing: false,
        onProgress: options.onProgress,
        resolve,
        reject,
        handleMessage: (message) => this.handleUploadMessage(operation, message),
        cancel: (error, notifyRemote) => {
          if (notifyRemote) this.safeSendJson(createUploadCancelMessage(requestId));
          this.finishFailure(operation, error);
        },
        sendNext: () => this.sendNextUploadChunk(operation),
      };
      this.startOperation(operation, options);
      this.reportUploadProgress(operation);
    });
    try {
      this.relay.sendJson(createUploadMessage(normalizedPath, name, source.size, requestId));
    } catch (error) {
      this.active?.cancel(connectionError(error, requestId), false);
    }
    return promise;
  }

  createDirectory(path: string): FileCommandReceipt {
    this.assertAvailable();
    const requestId = this.nextRequestId('mkdir');
    this.relay.sendJson(createDirectoryMessage(path, requestId));
    return { action: 'mkdir', requestId };
  }

  removeEntries(
    path: string,
    names: string[],
    options: RemoveEntriesOptions = {},
  ): FileCommandReceipt {
    this.assertAvailable();
    const requestId = this.nextRequestId('rm');
    this.relay.sendJson(
      createRemoveEntriesMessage(path, names, options.recursive ?? false, requestId),
    );
    return { action: 'rm', requestId };
  }

  renameEntry(path: string, oldName: string, newName: string): FileCommandReceipt {
    this.assertAvailable();
    this.relay.sendJson(createRenameEntryMessage(path, oldName, newName));
    return { action: 'rename' };
  }

  copyFiles(sourcePath: string, destinationPath: string, names: string[]): FileCommandReceipt {
    this.assertAvailable();
    const requestId = this.nextRequestId('copy');
    this.relay.sendJson(createCopyFilesMessage(sourcePath, destinationPath, names, requestId));
    return { action: 'copy', requestId };
  }

  moveFiles(sourcePath: string, destinationPath: string, names: string[]): FileCommandReceipt {
    this.assertAvailable();
    const requestId = this.nextRequestId('move');
    this.relay.sendJson(createMoveFilesMessage(sourcePath, destinationPath, names, requestId));
    return { action: 'move', requestId };
  }

  createZip(path: string, names: string[], outputName: string): FileCommandReceipt {
    this.assertAvailable();
    this.relay.sendJson(createZipMessage(path, names, outputName));
    this.archiveBusy = true;
    return { action: 'zip' };
  }

  extractZip(inputPath: string, destinationPath: string): FileCommandReceipt {
    this.assertAvailable();
    this.relay.sendJson(createUnzipMessage(inputPath, destinationPath));
    this.archiveBusy = true;
    return { action: 'unzip' };
  }

  onDialogMessage(listener: (message: FileDialogMessage) => void): () => void {
    this.dialogListeners.add(listener);
    return () => this.dialogListeners.delete(listener);
  }

  onRefreshRequested(listener: () => void): () => void {
    this.refreshListeners.add(listener);
    return () => this.refreshListeners.delete(listener);
  }

  async downloadFile(
    path: string,
    sink: DownloadSink,
    options: DownloadFileOptions = {},
  ): Promise<FileDownloadResult> {
    this.assertAvailable();
    if (options.signal?.aborted) {
      throw new FileOperationError('File operation was cancelled.', 'cancelled');
    }
    const normalizedPath = normalizeFilePath(path);
    if (options.totalBytes !== undefined && (!Number.isSafeInteger(options.totalBytes) || options.totalBytes < 0)) {
      throw new FileOperationError('Download size must be a non-negative safe integer.', 'source');
    }
    const requestId = this.nextRequestId('down');
    const promise = new Promise<FileDownloadResult>((resolve, reject) => {
      const operation: DownloadOperation = {
        requestId,
        kind: 'download',
        state: 'waiting-start',
        timeoutMs: 0,
        path: normalizedPath,
        sink,
        receivedBytes: 0,
        totalBytes: options.totalBytes,
        onProgress: options.onProgress,
        resolve,
        reject,
        handleMessage: (message) => this.handleDownloadMessage(operation, message),
        cancel: (error, notifyRemote) => {
          if (notifyRemote) this.safeSendJson(createDownloadStopMessage(requestId));
          void Promise.resolve(operation.sink.abort(error)).catch(() => undefined);
          this.finishFailure(operation, error);
        },
      };
      this.startOperation(operation, options);
      this.reportDownloadProgress(operation);
    });
    try {
      this.relay.sendJson(createDownloadStartMessage(normalizedPath, requestId));
    } catch (error) {
      this.active?.cancel(connectionError(error, requestId), false);
    }
    return promise;
  }

  cancelActive(reason = 'File operation was cancelled.'): void {
    const operation = this.active;
    if (!operation) return;
    operation.cancel(new FileOperationError(reason, 'cancelled', operation.requestId), true);
  }

  close(code?: number, reason?: string): void {
    this.dispose(new FileOperationError('File session was closed.', 'connection-lost'));
    this.relay.close(code, reason);
  }

  dispose(error = new FileOperationError('File session was disposed.', 'connection-lost')): void {
    if (this.disposed) return;
    this.disposed = true;
    this.archiveBusy = false;
    for (const remove of this.removeListeners.splice(0)) remove();
    this.active?.cancel(error, false);
    this.dialogListeners.clear();
    this.refreshListeners.clear();
  }

  private startOperation<T>(operation: ActiveOperation<T>, options: ListDirectoryOptions): void {
    this.active = operation as AnyActiveOperation;
    operation.timeoutMs = options.timeoutMs ?? this.options.defaultTimeoutMs ?? 30_000;
    this.resetOperationTimeout(operation);
    if (options.signal) {
      const abort = () =>
        operation.cancel(
          new FileOperationError('File operation was cancelled.', 'cancelled', operation.requestId),
          true,
        );
      options.signal.addEventListener('abort', abort, { once: true });
      operation.removeAbort = () => options.signal?.removeEventListener('abort', abort);
      if (options.signal.aborted) abort();
    }
  }

  private async handleInbound(data: RelayInboundData): Promise<void> {
    const text = await protocolText(data);
    if (text === undefined) {
      if (typeof data !== 'string' && this.active?.kind === 'download') {
        this.resetOperationTimeout(this.active);
        await this.handleDownloadBinary(this.active as DownloadOperation, data);
        return;
      }
      this.options.onUnhandledMessage?.(data);
      return;
    }
    let message: FilesProtocolMessage;
    try {
      message = parseFilesProtocolText(text);
    } catch (error) {
      if (this.active) this.finishFailure(this.active, toFileError(error, this.active.requestId));
      else this.options.onUnhandledMessage?.(text);
      return;
    }
    const dialogMessage = parseFileDialogMessage(message);
    if (dialogMessage) {
      if (dialogMessage.type === 'closed') this.archiveBusy = false;
      for (const listener of this.dialogListeners) listener(dialogMessage);
      return;
    }
    if (isFileRefreshMessage(message)) {
      for (const listener of this.refreshListeners) listener();
      return;
    }
    const operation = this.active;
    if (!operation) {
      this.options.onUnhandledMessage?.(message.raw);
      return;
    }
    if (message.requestId !== undefined && message.requestId !== operation.requestId) {
      this.options.onUnhandledMessage?.(message.raw);
      return;
    }
    this.resetOperationTimeout(operation);
    operation.handleMessage(message);
  }

  private handleUploadMessage(operation: UploadOperation, message: FilesProtocolMessage): void {
    if (messageIndicatesError(message) || message.action === 'uploadcancel') {
      this.finishFailure(operation, errorFromMessage(message, 'Remote file upload failed.'));
      return;
    }
    switch (message.action) {
      case 'uploadstart':
        if (operation.state !== 'waiting-start') return;
        if (operation.source.size === 0) {
          operation.finishing = true;
          operation.state = 'waiting-ack';
          this.reportUploadProgress(operation);
          this.relay.sendJson(createUploadDoneMessage(operation.requestId));
          return;
        }
        void operation.sendNext();
        break;
      case 'uploadack':
        if (operation.state !== 'waiting-ack' || operation.finishing) return;
        operation.acknowledgedBytes += operation.awaitingBytes;
        operation.awaitingBytes = 0;
        this.reportUploadProgress(operation);
        if (operation.acknowledgedBytes >= operation.source.size) {
          operation.finishing = true;
          this.relay.sendJson(createUploadDoneMessage(operation.requestId));
        } else {
          void operation.sendNext();
        }
        break;
      case 'uploaddone':
        operation.acknowledgedBytes = operation.source.size;
        operation.state = 'completed';
        this.reportUploadProgress(operation);
        this.finishSuccess(operation, {
          requestId: operation.requestId,
          path: operation.path,
          name: operation.name,
          size: operation.source.size,
        });
        break;
      default:
        this.options.onUnhandledMessage?.(message.raw);
    }
  }

  private handleDownloadMessage(operation: DownloadOperation, message: FilesProtocolMessage): void {
    if (messageIndicatesError(message) || (message.action === 'download' && message.raw.sub === 'cancel')) {
      operation.cancel(errorFromMessage(message, 'Remote file download failed.'), false);
      return;
    }
    if (message.action !== 'download' || message.raw.sub !== 'start' || operation.state !== 'waiting-start') {
      this.options.onUnhandledMessage?.(message.raw);
      return;
    }
    operation.state = 'receiving';
    this.reportDownloadProgress(operation);
    try {
      this.relay.sendJson(createDownloadStartAckMessage(operation.requestId));
    } catch (error) {
      operation.cancel(connectionError(error, operation.requestId), false);
    }
  }

  private async handleDownloadBinary(
    operation: DownloadOperation,
    data: Exclude<RelayInboundData, string>,
  ): Promise<void> {
    if (this.active !== operation || operation.state !== 'receiving') {
      this.options.onUnhandledMessage?.(data);
      return;
    }
    try {
      const bytes = await binaryBytes(data);
      if (bytes.byteLength < 4) {
        throw new FileOperationError('Download data frame omitted its control header.', 'protocol', operation.requestId);
      }
      const flags = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, false);
      const chunk = bytes.subarray(4);
      if (chunk.byteLength > 0) await operation.sink.write(chunk);
      if (this.active !== operation) return;
      operation.receivedBytes += chunk.byteLength;
      this.reportDownloadProgress(operation);
      if ((flags & 1) !== 0) {
        await operation.sink.close();
        if (this.active !== operation) return;
        this.finishSuccess(operation, {
          requestId: operation.requestId,
          path: operation.path,
          size: operation.receivedBytes,
        });
      } else {
        this.relay.sendJson(createDownloadAckMessage(operation.requestId));
      }
    } catch (error) {
      operation.cancel(toFileError(error, operation.requestId, 'source'), true);
    }
  }

  private async sendNextUploadChunk(operation: UploadOperation): Promise<void> {
    if (this.active !== operation || operation.finishing) return;
    const start = operation.sentBytes;
    const end = Math.min(start + operation.chunkSize, operation.source.size);
    operation.state = 'reading';
    this.reportUploadProgress(operation);
    try {
      const chunk = await operation.source.read(start, end);
      if (this.active !== operation) return;
      const byteLength = binaryByteLength(chunk);
      const expected = end - start;
      if (byteLength !== expected) {
        throw new FileOperationError(
          `Upload source returned ${byteLength} bytes, expected ${expected}.`,
          'source',
          operation.requestId,
        );
      }
      operation.state = 'sending';
      this.reportUploadProgress(operation);
      this.relay.sendBinary(await encodeUploadChunk(chunk));
      operation.sentBytes = end;
      operation.awaitingBytes = byteLength;
      operation.state = 'waiting-ack';
      this.reportUploadProgress(operation);
    } catch (error) {
      operation.cancel(toFileError(error, operation.requestId, 'source'), true);
    }
  }

  private reportUploadProgress(operation: UploadOperation): void {
    operation.onProgress?.({
      requestId: operation.requestId,
      state: operation.state,
      acknowledgedBytes: operation.acknowledgedBytes,
      sentBytes: operation.sentBytes,
      totalBytes: operation.source.size,
      percentage:
        operation.source.size === 0
          ? operation.state === 'completed'
            ? 100
            : 0
          : Math.min(100, (operation.acknowledgedBytes / operation.source.size) * 100),
    });
  }

  private reportDownloadProgress(operation: DownloadOperation): void {
    operation.onProgress?.({
      requestId: operation.requestId,
      state: operation.state,
      receivedBytes: operation.receivedBytes,
      ...(operation.totalBytes === undefined
        ? {}
        : {
            totalBytes: operation.totalBytes,
            percentage:
              operation.totalBytes === 0
                ? operation.state === 'completed'
                  ? 100
                  : 0
                : Math.min(100, (operation.receivedBytes / operation.totalBytes) * 100),
          }),
    });
  }

  private finishSuccess<T>(operation: ActiveOperation<T>, value: T): void {
    if (this.active !== operation) return;
    operation.state = 'completed';
    this.cleanupOperation(operation);
    operation.resolve(value);
  }

  private finishFailure<T>(operation: ActiveOperation<T>, error: FileOperationError): void {
    if (this.active !== operation) return;
    operation.state =
      error.code === 'cancelled'
        ? 'cancelled'
        : error.code === 'timed-out'
          ? 'timed-out'
          : error.code === 'connection-lost'
            ? 'connection-lost'
            : 'failed';
    if (operation.kind === 'upload') this.reportUploadProgress(operation as UploadOperation);
    if (operation.kind === 'download') this.reportDownloadProgress(operation as DownloadOperation);
    this.cleanupOperation(operation);
    operation.reject(error);
  }

  private cleanupOperation<T>(operation: ActiveOperation<T>): void {
    if (operation.timeout) clearTimeout(operation.timeout);
    operation.removeAbort?.();
    this.active = undefined;
  }

  private resetOperationTimeout<T>(operation: ActiveOperation<T>): void {
    if (operation.timeout) clearTimeout(operation.timeout);
    if (operation.timeoutMs <= 0) return;
    operation.timeout = setTimeout(() => {
      operation.cancel(
        new FileOperationError(
          'File operation timed out while waiting for remote activity.',
          'timed-out',
          operation.requestId,
        ),
        true,
      );
    }, operation.timeoutMs);
  }

  private failConnection(cause: Error): void {
    this.archiveBusy = false;
    if (!this.active) return;
    this.active.cancel(
      new FileOperationError(
        'File relay connection was lost.',
        'connection-lost',
        this.active.requestId,
        {
          cause,
        },
      ),
      false,
    );
  }

  private assertAvailable(checkArchive = true): void {
    if (this.disposed || this.relay.state !== 'ready') {
      throw new FileOperationError('File relay connection is not available.', 'connection-lost');
    }
    if (this.active || (checkArchive && this.archiveBusy)) {
      throw new FileOperationError('Another file operation is already active.', 'busy');
    }
  }

  private nextRequestId(prefix: string): string {
    return (
      this.options.createRequestId?.() ??
      `${prefix}-${Date.now().toString(36)}-${++this.requestSequence}`
    );
  }

  private safeSendJson(payload: unknown): void {
    if (this.relay.state !== 'ready') return;
    try {
      this.relay.sendJson(payload);
    } catch {
      // The operation still settles locally if the connection disappears during cancellation.
    }
  }
}

function assertUploadSource(source: UploadSource, name: string): void {
  normalizeFileName(name);
  if (!Number.isSafeInteger(source.size) || source.size < 0) {
    throw new FileOperationError(
      'Upload source size must be a non-negative safe integer.',
      'source',
    );
  }
}

function binaryByteLength(value: ArrayBuffer | ArrayBufferView | Blob): number {
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (ArrayBuffer.isView(value)) return value.byteLength;
  return value.size;
}

async function protocolText(data: RelayInboundData): Promise<string | undefined> {
  if (typeof data === 'string') return data;
  const bytes = await binaryBytes(data);
  if (bytes.byteLength === 0 || bytes[0] !== 123) return undefined;
  return new TextDecoder().decode(bytes);
}

async function encodeUploadChunk(
  value: ArrayBuffer | ArrayBufferView | Blob,
): Promise<ArrayBufferView> {
  const bytes = await binaryBytes(value);
  if (bytes[0] !== 0 && bytes[0] !== 123) return bytes;
  const escaped = new Uint8Array(bytes.byteLength + 1);
  escaped.set(bytes, 1);
  return escaped;
}

async function binaryBytes(value: ArrayBuffer | ArrayBufferView | Blob): Promise<Uint8Array> {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array(await value.arrayBuffer());
}

function toFileError(
  error: unknown,
  requestId?: string,
  fallbackCode: 'protocol' | 'source' = 'protocol',
): FileOperationError {
  if (error instanceof FileOperationError) return error;
  return new FileOperationError(
    error instanceof Error ? error.message : 'Unknown file operation error.',
    fallbackCode,
    requestId,
    error instanceof Error ? { cause: error } : undefined,
  );
}

function connectionError(error: unknown, requestId: string): FileOperationError {
  return new FileOperationError(
    error instanceof Error ? error.message : 'File relay connection is not available.',
    'connection-lost',
    requestId,
    error instanceof Error ? { cause: error } : undefined,
  );
}
