import {
  MeshCentralConnectionClosedError,
  MeshCentralProtocolError,
  MeshCentralRequestTimeoutError,
  MeshCentralValidationError,
} from '../errors';
import { isRecord } from '../protocol/normalizers';
import {
  MAX_SERVER_FILE_BYTES,
  type ServerFileEntry,
  type ServerFileTree,
} from '../serverFiles.types';
import type {
  MeshCentralClientEvents,
  MeshCentralEventChannel,
  MeshCentralListener,
} from '../types';

interface ResourceClient {
  send(payload: unknown): void;
  on<K extends MeshCentralEventChannel>(
    channel: K,
    listener: MeshCentralListener<MeshCentralClientEvents[K]>,
  ): () => void;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const INVALID_NAME = /[\\/:*?"<>|\0]/;

function validatePath(path: readonly string[]): string[] {
  if (path.length === 0 || path.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new MeshCentralValidationError('Server file path must contain valid segments.');
  }
  return [...path];
}

function validateName(name: string, directory = false): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === '.' || trimmed === '..' || INVALID_NAME.test(trimmed)) {
    throw new MeshCentralValidationError('Server file name contains invalid characters.');
  }
  if (directory && trimmed.startsWith('.')) {
    throw new MeshCentralValidationError('Server folder name cannot start with a dot.');
  }
  return trimmed;
}

function findEntries(tree: ServerFileTree, path: readonly string[]): ServerFileEntry[] | undefined {
  const [spaceId, ...segments] = path;
  let entries = tree.spaces.find((space) => space.id === spaceId)?.entries;
  for (const segment of segments) {
    const directory = entries?.find(
      (entry) => entry.kind === 'directory' && entry.name === segment,
    );
    entries = directory?.children;
  }
  return entries;
}

function hasNames(tree: ServerFileTree, path: readonly string[], names: readonly string[]): boolean {
  const entries = findEntries(tree, path);
  return Boolean(entries && names.every((name) => entries.some((entry) => entry.name === name)));
}

function hasAnyName(tree: ServerFileTree, path: readonly string[], names: readonly string[]): boolean {
  const entries = findEntries(tree, path);
  return Boolean(entries?.some((entry) => names.includes(entry.name)));
}

function bytesToBase64(data: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < data.length; offset += 0x8000) {
    binary += String.fromCharCode(...data.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(data: string): Uint8Array {
  try {
    const binary = atob(data);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new MeshCentralProtocolError('Server file response contains invalid Base64 data.');
  }
}

export class ServerFilesResource {
  private listChain: Promise<void> = Promise.resolve();
  private readonly pendingReads = new Map<string, Promise<Uint8Array>>();

  constructor(
    private readonly client: ResourceClient,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  subscribe(listener: MeshCentralListener<ServerFileTree>): () => void {
    return this.client.on('files', listener);
  }

  list(): Promise<ServerFileTree> {
    const request = this.listChain.then(() =>
      this.waitForFiles(() => true, () => this.client.send({ action: 'files' })),
    );
    this.listChain = request.then(
      () => undefined,
      () => undefined,
    );
    return request;
  }

  getFile(path: readonly string[], file: string): Promise<Uint8Array> {
    const validPath = validatePath(path);
    const validFile = validateName(file);
    const key = JSON.stringify([...validPath, validFile]);
    const pending = this.pendingReads.get(key);
    if (pending) return pending;
    const request = this.readFile(validPath, validFile).finally(() => {
      if (this.pendingReads.get(key) === request) this.pendingReads.delete(key);
    });
    this.pendingReads.set(key, request);
    return request;
  }

  private readFile(validPath: string[], validFile: string): Promise<Uint8Array> {
    const tag = `server-file-get-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    return new Promise<Uint8Array>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new MeshCentralRequestTimeoutError('Timed out while reading the server file.'));
      }, this.timeoutMs);
      const unsubscribeMessage = this.client.on('message', (message) => {
        if (
          !isRecord(message) ||
          message.action !== 'fileoperation' ||
          message.fileop !== 'get' ||
          message.tag !== tag
        ) {
          return;
        }
        cleanup();
        if (typeof message.data !== 'string') {
          reject(new MeshCentralProtocolError('Server file response does not contain data.'));
          return;
        }
        const bytes = base64ToBytes(message.data);
        if (bytes.byteLength >= MAX_SERVER_FILE_BYTES) {
          reject(new MeshCentralProtocolError('Server file exceeds the inline file size limit.'));
          return;
        }
        resolve(bytes);
      });
      const unsubscribeConnection = this.client.on('connection', (state) => {
        if (state.current === 'disconnected' || state.current === 'error' || state.current === 'destroyed') {
          cleanup();
          reject(new MeshCentralConnectionClosedError('Control connection closed while reading the server file.'));
        }
      });
      const cleanup = () => {
        clearTimeout(timer);
        unsubscribeMessage();
        unsubscribeConnection();
      };
      try {
        this.client.send({
          action: 'fileoperation',
          fileop: 'get',
          path: validPath,
          file: validFile,
          tag,
        });
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  setFile(path: readonly string[], file: string, data: Uint8Array): Promise<ServerFileTree> {
    const validPath = validatePath(path);
    const validFile = validateName(file);
    if (data.byteLength >= MAX_SERVER_FILE_BYTES) {
      throw new MeshCentralValidationError('Server files must be smaller than 200 KiB.');
    }
    return this.waitForFiles(
      (tree) => hasNames(tree, validPath, [validFile]),
      () =>
        this.client.send({
          action: 'fileoperation',
          fileop: 'set',
          path: validPath,
          file: validFile,
          data: bytesToBase64(data),
        }),
    );
  }

  createFolder(path: readonly string[], name: string): Promise<ServerFileTree> {
    const validPath = validatePath(path);
    const validName = validateName(name, true);
    return this.waitForFiles(
      (tree) => hasNames(tree, validPath, [validName]),
      () =>
        this.client.send({
          action: 'fileoperation',
          fileop: 'createfolder',
          path: validPath,
          newfolder: validName,
        }),
    );
  }

  delete(
    path: readonly string[],
    names: readonly string[],
    recursive = false,
  ): Promise<ServerFileTree> {
    const validPath = validatePath(path);
    const validNames = this.validateNames(names);
    return this.waitForFiles(
      (tree) => !hasAnyName(tree, validPath, validNames),
      () =>
        this.client.send({
          action: 'fileoperation',
          fileop: 'delete',
          path: validPath,
          delfiles: validNames,
          rec: recursive,
        }),
    );
  }

  rename(path: readonly string[], oldName: string, newName: string): Promise<ServerFileTree> {
    const validPath = validatePath(path);
    const validOldName = validateName(oldName);
    const validNewName = validateName(newName);
    return this.waitForFiles(
      (tree) =>
        hasNames(tree, validPath, [validNewName]) && !hasNames(tree, validPath, [validOldName]),
      () =>
        this.client.send({
          action: 'fileoperation',
          fileop: 'rename',
          path: validPath,
          oldname: validOldName,
          newname: validNewName,
        }),
    );
  }

  copy(
    sourcePath: readonly string[],
    destinationPath: readonly string[],
    names: readonly string[],
  ): Promise<ServerFileTree> {
    return this.transfer('copy', sourcePath, destinationPath, names);
  }

  move(
    sourcePath: readonly string[],
    destinationPath: readonly string[],
    names: readonly string[],
  ): Promise<ServerFileTree> {
    return this.transfer('move', sourcePath, destinationPath, names);
  }

  private transfer(
    operation: 'copy' | 'move',
    sourcePath: readonly string[],
    destinationPath: readonly string[],
    names: readonly string[],
  ): Promise<ServerFileTree> {
    const validSourcePath = validatePath(sourcePath);
    const validDestinationPath = validatePath(destinationPath);
    const validNames = this.validateNames(names);
    return this.waitForFiles(
      (tree) =>
        hasNames(tree, validDestinationPath, validNames) &&
        (operation === 'copy' || !hasNames(tree, validSourcePath, validNames)),
      () =>
        this.client.send({
          action: 'fileoperation',
          fileop: operation,
          scpath: validSourcePath,
          path: validDestinationPath,
          names: validNames,
        }),
    );
  }

  private validateNames(names: readonly string[]): string[] {
    if (names.length === 0) {
      throw new MeshCentralValidationError('At least one server file name is required.');
    }
    return names.map((name) => validateName(name));
  }

  private waitForFiles(
    predicate: (tree: ServerFileTree) => boolean,
    send: () => void,
  ): Promise<ServerFileTree> {
    return new Promise<ServerFileTree>((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new MeshCentralRequestTimeoutError('Unable to confirm the server file operation.'));
      }, this.timeoutMs);
      const unsubscribeFiles = this.client.on('files', (tree) => {
        if (!predicate(tree)) return;
        cleanup();
        resolve(tree);
      });
      const unsubscribeConnection = this.client.on('connection', (state) => {
        if (state.current === 'disconnected' || state.current === 'error' || state.current === 'destroyed') {
          cleanup();
          reject(new MeshCentralConnectionClosedError('Control connection closed during the server file operation.'));
        }
      });
      const cleanup = () => {
        clearTimeout(timer);
        unsubscribeFiles();
        unsubscribeConnection();
      };
      try {
        send();
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }
}