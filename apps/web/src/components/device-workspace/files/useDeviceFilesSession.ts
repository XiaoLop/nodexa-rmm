import type { GatewayClient } from '@meshcentral/control-client';
import {
  FileOperationError,
  FilesSession,
  RELAY_PROTOCOLS,
  RelayClient,
  browserFileSource,
  joinFilePath,
  type DirectoryListing,
  type FileDialogMessage,
  type FileDownloadProgress,
  type FileEntry,
  type FileUploadProgress,
  type RelaySession,
} from '@meshcentral/relay';
import type { Device } from '@meshcentral/shared-state';
import { useEffect, useRef, useState } from 'react';
import { GATEWAY_RELAY_URL } from '../../../config/gateway';
import {
  batchUploadBandwidthConfig,
  calculateBatchUploadChunkSize,
} from '../../../features/batch-upload/bandwidth';
import { createBrowserDownload } from '../../../features/files/createBrowserDownload';
import { retainExistingSelection } from './fileViewModel';

export type FileWorkspaceStatus =
  'connecting' | 'ready' | 'busy' | 'error' | 'disconnected' | 'offline' | 'forbidden';

export interface FileTransferView {
  kind: 'upload' | 'download';
  name: string;
  transferredBytes: number;
  totalBytes?: number;
  percentage?: number;
}

export interface FileArchiveProgress {
  type: FileDialogMessage['type'];
  file?: string;
  progress?: number;
}

interface UseDeviceFilesSessionOptions {
  device: Device;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
  filesAllowed?: boolean;
}

export function useDeviceFilesSession({
  device,
  gatewayClient,
  gatewayConnected,
  filesAllowed,
}: UseDeviceFilesSessionOptions) {
  const [status, setStatus] = useState<FileWorkspaceStatus>('connecting');
  const [listing, setListing] = useState<DirectoryListing>();
  const [error, setError] = useState<string>();
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [activeTransfer, setActiveTransfer] = useState<FileTransferView>();
  const [archiveProgress, setArchiveProgress] = useState<FileArchiveProgress>();
  const [reconnectVersion, setReconnectVersion] = useState(0);
  const relayRef = useRef<RelaySession | undefined>(undefined);
  const filesRef = useRef<FilesSession | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const lifecycleRef = useRef(0);
  const listingRef = useRef<DirectoryListing | undefined>(undefined);
  const refreshRunningRef = useRef(false);
  const refreshQueuedRef = useRef(false);

  listingRef.current = listing;

  const disconnect = () => {
    lifecycleRef.current += 1;
    abortRef.current?.abort();
    filesRef.current?.dispose();
    relayRef.current?.cancel('File workspace closed.');
    abortRef.current = undefined;
    filesRef.current = undefined;
    relayRef.current = undefined;
    refreshRunningRef.current = false;
    refreshQueuedRef.current = false;
  };

  const setOperationError = (operationError: unknown, fallback: string) => {
    if (operationError instanceof FileOperationError && operationError.code === 'cancelled') return;
    setError(operationError instanceof Error ? operationError.message : fallback);
  };

  const readDirectory = async (path: string, preserveSelection = false) => {
    const files = filesRef.current;
    if (!files) throw new FileOperationError('文件中继尚未连接。', 'connection-lost');
    const lifecycle = lifecycleRef.current;
    setError(undefined);
    setStatus('busy');
    try {
      const nextListing = await files.listDirectory(path, { timeoutMs: 20_000 });
      if (lifecycleRef.current !== lifecycle) return;
      setListing(nextListing);
      setSelectedPaths((current) =>
        preserveSelection ? retainExistingSelection(current, nextListing.entries) : [],
      );
      setStatus('ready');
    } catch (directoryError) {
      if (lifecycleRef.current !== lifecycle) return;
      setOperationError(directoryError, '目录读取失败。');
      setStatus('error');
      throw directoryError;
    }
  };

  const refresh = async () => {
    const path = listingRef.current?.path ?? '';
    if (refreshRunningRef.current) {
      refreshQueuedRef.current = true;
      return;
    }
    refreshRunningRef.current = true;
    try {
      do {
        refreshQueuedRef.current = false;
        await readDirectory(path, true);
      } while (refreshQueuedRef.current);
    } finally {
      refreshRunningRef.current = false;
    }
  };

  useEffect(() => {
    disconnect();
    setListing(undefined);
    setSelectedPaths([]);
    setActiveTransfer(undefined);
    setArchiveProgress(undefined);
    setError(undefined);

    if (filesAllowed === false) {
      setStatus('forbidden');
      return;
    }
    if (!device.online) {
      setStatus('offline');
      return;
    }
    if (!gatewayConnected || !gatewayClient || !GATEWAY_RELAY_URL) {
      setStatus('disconnected');
      return;
    }

    const lifecycle = ++lifecycleRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('connecting');

    void (async () => {
      try {
        const relay = await new RelayClient({
          baseUrl: GATEWAY_RELAY_URL,
          control: gatewayClient,
        }).createSession({
          deviceId: device.id,
          protocol: RELAY_PROTOCOLS.files,
          signal: controller.signal,
        });
        if (controller.signal.aborted || lifecycleRef.current !== lifecycle) {
          relay.cancel('File workspace is no longer active.');
          return;
        }
        relayRef.current = relay;
        relay.onError((relayError) => {
          if (lifecycleRef.current !== lifecycle) return;
          setOperationError(relayError, '文件中继连接中断。');
          setStatus('disconnected');
        });
        relay.onClose(() => {
          if (lifecycleRef.current !== lifecycle) return;
          setStatus('disconnected');
          setActiveTransfer(undefined);
          setArchiveProgress(undefined);
        });
        const files = new FilesSession(relay);
        filesRef.current = files;
        files.onDialogMessage((message) => {
          if (lifecycleRef.current !== lifecycle) return;
          setArchiveProgress(
            message.type === 'closed'
              ? undefined
              : { type: message.type, file: message.file, progress: message.progress },
          );
        });
        files.onRefreshRequested(() => {
          if (lifecycleRef.current === lifecycle) void refresh().catch(() => undefined);
        });
        await readDirectory('');
      } catch (connectionError) {
        if (controller.signal.aborted || lifecycleRef.current !== lifecycle) return;
        setOperationError(connectionError, '文件中继连接失败。');
        setStatus('error');
      }
    })();

    return disconnect;
  }, [device.id, device.online, filesAllowed, gatewayClient, gatewayConnected, reconnectVersion]);

  const selectedEntries = (listing?.entries ?? []).filter((entry) =>
    selectedPaths.includes(entry.path),
  );

  const runWriteAndRefresh = async (send: (files: FilesSession) => void) => {
    const files = filesRef.current;
    if (!files || !listingRef.current) return;
    setError(undefined);
    try {
      send(files);
      await refresh();
    } catch (operationError) {
      setOperationError(operationError, '文件操作无法发送。');
    }
  };

  const createDirectory = (name: string) => {
    const current = listingRef.current;
    if (!current) return Promise.resolve();
    return runWriteAndRefresh((files) => files.createDirectory(joinFilePath(current.path, name)));
  };

  const removeSelected = () => {
    const current = listingRef.current;
    if (!current || selectedEntries.length === 0) return Promise.resolve();
    return runWriteAndRefresh((files) =>
      files.removeEntries(
        current.path,
        selectedEntries.map((entry) => entry.name),
        { recursive: selectedEntries.some((entry) => entry.kind !== 'file') },
      ),
    );
  };

  const renameSelected = (name: string) => {
    const current = listingRef.current;
    const entry = selectedEntries[0];
    if (!current || !entry || selectedEntries.length !== 1) return Promise.resolve();
    return runWriteAndRefresh((files) => files.renameEntry(current.path, entry.name, name));
  };

  const copySelected = (destination: string) => {
    const current = listingRef.current;
    if (!current) return Promise.resolve();
    return runWriteAndRefresh((files) =>
      files.copyFiles(
        current.path,
        destination,
        selectedEntries.map((entry) => entry.name),
      ),
    );
  };

  const moveSelected = (destination: string) => {
    const current = listingRef.current;
    if (!current) return Promise.resolve();
    return runWriteAndRefresh((files) =>
      files.moveFiles(
        current.path,
        destination,
        selectedEntries.map((entry) => entry.name),
      ),
    );
  };

  const upload = async (file: File) => {
    const files = filesRef.current;
    const current = listingRef.current;
    if (!files || !current) return;
    const lifecycle = lifecycleRef.current;
    setError(undefined);
    setStatus('busy');
    setActiveTransfer({
      kind: 'upload',
      name: file.name,
      transferredBytes: 0,
      totalBytes: file.size,
      percentage: 0,
    });
    try {
      await files.uploadFile(current.path, browserFileSource(file), {
        timeoutMs: 60_000,
        chunkSize: calculateBatchUploadChunkSize(batchUploadBandwidthConfig, 1),
        onProgress: (progress: FileUploadProgress) =>
          setActiveTransfer({
            kind: 'upload',
            name: file.name,
            transferredBytes: progress.acknowledgedBytes,
            totalBytes: progress.totalBytes,
            percentage: progress.percentage,
          }),
      });
      if (lifecycleRef.current === lifecycle) await refresh();
    } catch (uploadError) {
      if (lifecycleRef.current === lifecycle) setOperationError(uploadError, '文件上传失败。');
    } finally {
      if (lifecycleRef.current === lifecycle) {
        setActiveTransfer(undefined);
        setStatus(filesRef.current ? 'ready' : 'disconnected');
      }
    }
  };

  const download = async (entry: FileEntry) => {
    const files = filesRef.current;
    if (!files || entry.kind !== 'file') return;
    try {
      const target = await createBrowserDownload(entry.name);
      if (!target) return;
      const lifecycle = lifecycleRef.current;
      setError(undefined);
      setStatus('busy');
      setActiveTransfer({
        kind: 'download',
        name: entry.name,
        transferredBytes: 0,
        totalBytes: entry.size,
        percentage: entry.size === undefined ? undefined : 0,
      });
      try {
        await files.downloadFile(entry.path, target.sink, {
          timeoutMs: 60_000,
          totalBytes: entry.size,
          onProgress: (progress: FileDownloadProgress) =>
            setActiveTransfer({
              kind: 'download',
              name: entry.name,
              transferredBytes: progress.receivedBytes,
              totalBytes: progress.totalBytes,
              percentage: progress.percentage,
            }),
        });
      } finally {
        if (lifecycleRef.current === lifecycle) {
          setActiveTransfer(undefined);
          setStatus(filesRef.current ? 'ready' : 'disconnected');
        }
      }
    } catch (downloadError) {
      setOperationError(downloadError, '文件下载失败。');
    }
  };

  const createZip = (outputName: string) => {
    const files = filesRef.current;
    const current = listingRef.current;
    if (!files || !current) return;
    try {
      files.createZip(
        current.path,
        selectedEntries.map((entry) => entry.name),
        outputName,
      );
      setArchiveProgress({ type: 'zipping' });
    } catch (archiveError) {
      setOperationError(archiveError, '压缩请求无法发送。');
    }
  };

  const extractZip = (destination: string) => {
    const files = filesRef.current;
    const entry = selectedEntries[0];
    if (!files || !entry) return;
    try {
      files.extractZip(entry.path, destination);
      setArchiveProgress({ type: 'unzipping' });
    } catch (archiveError) {
      setOperationError(archiveError, '解压请求无法发送。');
    }
  };

  return {
    status,
    listing,
    error,
    selectedPaths,
    selectedEntries,
    activeTransfer,
    archiveProgress,
    setSelectedPaths,
    openDirectory: readDirectory,
    refresh,
    createDirectory,
    removeSelected,
    renameSelected,
    copySelected,
    moveSelected,
    upload,
    download,
    createZip,
    extractZip,
    cancelTransfer: () => filesRef.current?.cancelActive('用户取消文件传输。'),
    reconnect: () => setReconnectVersion((current) => current + 1),
  };
}
