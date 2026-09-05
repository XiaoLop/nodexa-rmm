import {
  ArrowUpOutlined,
  DownloadOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  HddOutlined,
  HomeOutlined,
  InboxOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  FilesSession,
  FileOperationError,
  RELAY_PROTOCOLS,
  RelayClient,
  browserFileSource,
  type DirectoryListing,
  type FileEntry,
  type FileDownloadProgress,
  type FileUploadProgress,
  type RelaySession,
} from '@meshcentral/relay';
import type { GatewayClient } from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Empty,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
  message,
  type TableColumnsType,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  batchUploadBandwidthConfig,
  calculateBatchUploadChunkSize,
} from '../features/batch-upload/bandwidth';
import { GATEWAY_RELAY_URL } from '../config/gateway';
import { createBrowserDownload } from '../features/files/createBrowserDownload';

interface FileUploadModalProps {
  open: boolean;
  device: Device | null;
  gatewayClient?: GatewayClient;
  onClose: () => void;
}

type ConnectionStatus = 'idle' | 'connecting' | 'ready' | 'error';

interface ActiveTransfer {
  kind: 'upload' | 'download';
  name: string;
  transferredBytes: number;
  totalBytes?: number;
  percentage?: number;
}

function parentPath(path: string): string | undefined {
  if (!path) return undefined;
  if (/^[a-zA-Z]:\\?$/.test(path) || path === '/') return '';

  const separator = path.includes('\\') ? '\\' : '/';
  const trimmed = path.endsWith(separator) ? path.slice(0, -1) : path;
  const index = trimmed.lastIndexOf(separator);
  if (index < 0) return '';
  if (separator === '\\' && index === 2) return `${trimmed.slice(0, 2)}\\`;
  if (separator === '/' && index === 0) return '/';
  return trimmed.slice(0, index);
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${unit}`;
}

function entryIcon(entry: FileEntry) {
  if (entry.kind === 'drive') return <HddOutlined />;
  if (entry.kind === 'directory') return <FolderOutlined />;
  return <FileOutlined />;
}

export function FileUploadModal({ open, device, gatewayClient, onClose }: FileUploadModalProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [error, setError] = useState<string>();
  const [listing, setListing] = useState<DirectoryListing>();
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File>();
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const relaySessionRef = useRef<RelaySession | undefined>(undefined);
  const filesSessionRef = useRef<FilesSession | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const lifecycleRef = useRef(0);
  const baseUrl = GATEWAY_RELAY_URL;

  const entries = useMemo(
    () =>
      [...(listing?.entries ?? [])].sort((left, right) => {
        const leftDirectory = left.kind === 'drive' || left.kind === 'directory';
        const rightDirectory = right.kind === 'drive' || right.kind === 'directory';
        if (leftDirectory !== rightDirectory) return leftDirectory ? -1 : 1;
        return left.name.localeCompare(right.name, 'zh-CN');
      }),
    [listing],
  );

  const disconnect = () => {
    lifecycleRef.current += 1;
    abortRef.current?.abort();
    filesSessionRef.current?.dispose();
    relaySessionRef.current?.cancel('File upload dialog closed.');
    abortRef.current = undefined;
    filesSessionRef.current = undefined;
    relaySessionRef.current = undefined;
  };

  useEffect(() => {
    if (!open) {
      disconnect();
      return;
    }

    const lifecycle = ++lifecycleRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('connecting');
    setError(undefined);
    setListing(undefined);
    setDirectoryLoading(true);
    setSelectedFile(undefined);
    setActiveTransfer(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const connect = async () => {
      if (!device?.online || !gatewayClient || !baseUrl) {
        setStatus('error');
        setDirectoryLoading(false);
        setError(!device?.online ? '设备当前离线，无法建立文件中继。' : '网关或中继地址不可用。');
        return;
      }

      try {
        const relayClient = new RelayClient({ baseUrl, control: gatewayClient });
        const relaySession = await relayClient.createSession({
          deviceId: device.id,
          protocol: RELAY_PROTOCOLS.files,
          signal: controller.signal,
        });
        if (controller.signal.aborted || lifecycleRef.current !== lifecycle) {
          relaySession.cancel('File upload dialog is no longer active.');
          return;
        }
        relaySessionRef.current = relaySession;
        const filesSession = new FilesSession(relaySession);
        filesSessionRef.current = filesSession;
        setStatus('ready');
        const rootListing = await filesSession.listDirectory('', {
          signal: controller.signal,
          timeoutMs: 20_000,
        });
        if (lifecycleRef.current === lifecycle) setListing(rootListing);
      } catch (connectionError) {
        if (controller.signal.aborted || lifecycleRef.current !== lifecycle) return;
        setStatus('error');
        setError(connectionError instanceof Error ? connectionError.message : '文件中继连接失败。');
      } finally {
        if (lifecycleRef.current === lifecycle) setDirectoryLoading(false);
      }
    };

    void connect();
    return disconnect;
  }, [baseUrl, device, gatewayClient, open]);

  const loadDirectory = async (path: string) => {
    const filesSession = filesSessionRef.current;
    if (!filesSession || directoryLoading || activeTransfer) return;
    setDirectoryLoading(true);
    setError(undefined);
    try {
      const result = await filesSession.listDirectory(path, { timeoutMs: 20_000 });
      setListing(result);
    } catch (directoryError) {
      const detail = directoryError instanceof Error ? directoryError.message : '目录读取失败。';
      setError(detail);
      void messageApi.error(`目录读取失败：${detail}`);
    } finally {
      setDirectoryLoading(false);
    }
  };

  const uploadFile = async () => {
    const filesSession = filesSessionRef.current;
    if (!filesSession || !selectedFile || !listing || activeTransfer) return;
    const lifecycle = lifecycleRef.current;
    setError(undefined);
    setActiveTransfer({
      kind: 'upload',
      name: selectedFile.name,
      transferredBytes: 0,
      totalBytes: selectedFile.size,
      percentage: 0,
    });
    try {
      await filesSession.uploadFile(listing.path, browserFileSource(selectedFile), {
        timeoutMs: 60_000,
        chunkSize: calculateBatchUploadChunkSize(batchUploadBandwidthConfig, 1),
        onProgress: (progress: FileUploadProgress) =>
          setActiveTransfer({
            kind: 'upload',
            name: selectedFile.name,
            transferredBytes: progress.acknowledgedBytes,
            totalBytes: progress.totalBytes,
            percentage: progress.percentage,
          }),
      });
      if (lifecycleRef.current !== lifecycle) return;
      void messageApi.success(`${selectedFile.name} 已上传到 ${listing.path || '根目录'}`);
      try {
        const refreshed = await filesSession.listDirectory(listing.path, { timeoutMs: 20_000 });
        if (lifecycleRef.current === lifecycle) setListing(refreshed);
      } catch {
        void messageApi.warning('文件已上传，但目录刷新失败，请手动刷新。');
      }
    } catch (uploadError) {
      if (lifecycleRef.current !== lifecycle) return;
      if (uploadError instanceof FileOperationError && uploadError.code === 'cancelled') {
        void messageApi.info('已取消上传。');
        return;
      }
      const detail = uploadError instanceof Error ? uploadError.message : '文件上传失败。';
      setError(detail);
      void messageApi.error(`文件上传失败：${detail}`);
    } finally {
      if (lifecycleRef.current === lifecycle) setActiveTransfer(undefined);
    }
  };

  const downloadFile = async (entry: FileEntry) => {
    const filesSession = filesSessionRef.current;
    if (!filesSession || entry.kind !== 'file' || activeTransfer) return;
    try {
      const target = await createBrowserDownload(entry.name);
      if (!target) return;
      const lifecycle = lifecycleRef.current;
      setError(undefined);
      setActiveTransfer({
        kind: 'download',
        name: entry.name,
        transferredBytes: 0,
        totalBytes: entry.size,
        percentage: entry.size === undefined ? undefined : 0,
      });
      try {
        const result = await filesSession.downloadFile(entry.path, target.sink, {
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
        if (lifecycleRef.current !== lifecycle) return;
        void messageApi.success(`${entry.name} 下载完成，共 ${formatBytes(result.size)}`);
      } catch (downloadError) {
        if (lifecycleRef.current !== lifecycle) return;
        if (downloadError instanceof FileOperationError && downloadError.code === 'cancelled') {
          void messageApi.info('已取消下载。');
          return;
        }
        const detail = downloadError instanceof Error ? downloadError.message : '文件下载失败。';
        setError(detail);
        void messageApi.error(`文件下载失败：${detail}`);
      } finally {
        if (lifecycleRef.current === lifecycle) setActiveTransfer(undefined);
      }
    } catch (targetError) {
      const detail = targetError instanceof Error ? targetError.message : '无法创建本地保存文件。';
      setError(detail);
      void messageApi.error(`无法开始下载：${detail}`);
    }
  };

  const closeModal = () => {
    if (!activeTransfer) {
      onClose();
      return;
    }
    Modal.confirm({
      title: activeTransfer.kind === 'upload' ? '上传仍在进行' : '下载仍在进行',
      content: '关闭文件管理器将取消当前传输。',
      okText: '取消传输并关闭',
      okButtonProps: { danger: true },
      cancelText: '继续传输',
      onOk: () => {
        filesSessionRef.current?.cancelActive('用户关闭文件管理器。');
        onClose();
      },
    });
  };

  const currentParent = parentPath(listing?.path ?? '');
  const columns: TableColumnsType<FileEntry> = [
    {
      title: '名称',
      dataIndex: 'name',
      ellipsis: true,
      render: (name: string, entry) => (
        <Space>
          {entryIcon(entry)}
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'kind',
      width: 100,
      render: (kind: FileEntry['kind']) =>
        ({ drive: '磁盘', directory: '文件夹', file: '文件', unknown: '未知' })[kind],
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 110,
      align: 'right',
      render: (size: number | undefined, entry) =>
        entry.kind === 'file' && size !== undefined ? formatBytes(size) : '—',
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedAt',
      width: 180,
      render: (modifiedAt: Date | undefined) => modifiedAt?.toLocaleString('zh-CN') ?? '—',
    },
    {
      title: '操作',
      key: 'actions',
      width: 72,
      align: 'center',
      render: (_, entry) =>
        entry.kind === 'file' ? (
          <Button
            type="text"
            title={`下载 ${entry.name}`}
            aria-label={`下载 ${entry.name}`}
            icon={<DownloadOutlined />}
            disabled={status !== 'ready' || directoryLoading || Boolean(activeTransfer)}
            onClick={(event) => {
              event.stopPropagation();
              void downloadFile(entry);
            }}
          />
        ) : null,
    },
  ];

  return (
    <>
      {messageContextHolder}
      <Modal
        open={open}
        title={
          <Space>
            <FolderOpenOutlined />
            文件管理 - {device?.name ?? '设备'}
          </Space>
        }
        width={820}
        onCancel={closeModal}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={closeModal}>
            关闭
          </Button>,
          activeTransfer ? (
            <Button
              key="stop"
              danger
              onClick={() => filesSessionRef.current?.cancelActive('用户取消文件传输。')}
            >
              取消{activeTransfer.kind === 'upload' ? '上传' : '下载'}
            </Button>
          ) : (
            <Button
              key="upload"
              type="primary"
              icon={<UploadOutlined />}
              disabled={status !== 'ready' || !listing || !selectedFile || directoryLoading}
              onClick={() => void uploadFile()}
            >
              开始上传
            </Button>
          ),
        ]}
      >
        <div className="file-explorer-modal">
          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              closable
              onClose={() => setError(undefined)}
            />
          )}
          <div className="file-explorer-location">
            <div>
              <Typography.Text type="secondary">上传目录</Typography.Text>
              <Typography.Text strong ellipsis={{ tooltip: listing?.path || '根目录' }}>
                {listing?.path || '根目录'}
              </Typography.Text>
            </div>
            <Tag
              color={status === 'ready' ? 'success' : status === 'error' ? 'error' : 'processing'}
            >
              {status === 'ready' ? '已连接' : status === 'error' ? '连接失败' : '正在连接'}
            </Tag>
          </div>
          <div className="file-explorer-toolbar">
            <Space wrap>
              <Button
                icon={<HomeOutlined />}
                disabled={status !== 'ready' || directoryLoading || Boolean(activeTransfer) || !listing?.path}
                onClick={() => void loadDirectory('')}
              >
                根目录
              </Button>
              <Button
                icon={<ArrowUpOutlined />}
                disabled={
                  status !== 'ready' || directoryLoading || Boolean(activeTransfer) || currentParent === undefined
                }
                onClick={() => currentParent !== undefined && void loadDirectory(currentParent)}
              >
                上一级
              </Button>
              <Button
                icon={<ReloadOutlined />}
                disabled={status !== 'ready' || directoryLoading || Boolean(activeTransfer) || !listing}
                onClick={() => listing && void loadDirectory(listing.path)}
              >
                刷新
              </Button>
            </Space>
            <Typography.Text type="secondary">点击文件夹进入并选择上传位置</Typography.Text>
          </div>
          <Table<FileEntry>
            className="file-explorer-table"
            size="small"
            rowKey="path"
            columns={columns}
            dataSource={entries}
            loading={directoryLoading || status === 'connecting'}
            pagination={false}
            scroll={{ y: 310 }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={listing ? '当前目录为空' : '正在读取文件目录'}
                />
              ),
            }}
            onRow={(entry) => {
              const directory = entry.kind === 'directory' || entry.kind === 'drive';
              return {
                className: directory ? 'file-explorer-directory-row' : 'file-explorer-entry-row',
                onClick: directory ? () => void loadDirectory(entry.path) : undefined,
              };
            }}
          />
          <div className="file-explorer-upload">
            <input
              ref={fileInputRef}
              hidden
              type="file"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0]);
              }}
            />
            <Button
              icon={<FolderOpenOutlined />}
              disabled={status !== 'ready' || Boolean(activeTransfer)}
              onClick={() => fileInputRef.current?.click()}
            >
              选择本地文件
            </Button>
            <div>
              {selectedFile ? (
                <>
                  <Typography.Text strong ellipsis={{ tooltip: selectedFile.name }}>
                    {selectedFile.name}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {formatBytes(selectedFile.size)}
                  </Typography.Text>
                </>
              ) : (
                <Typography.Text type="secondary">
                  <InboxOutlined /> 尚未选择文件
                </Typography.Text>
              )}
            </div>
          </div>
          {activeTransfer && (
            <Progress
              percent={Number((activeTransfer.percentage ?? 0).toFixed(1))}
              status="active"
              format={(percent) =>
                activeTransfer.totalBytes === undefined
                  ? `${activeTransfer.kind === 'upload' ? '上传' : '下载'} ${formatBytes(activeTransfer.transferredBytes)}`
                  : `${percent}% · ${formatBytes(activeTransfer.transferredBytes)} / ${formatBytes(activeTransfer.totalBytes)}`
              }
            />
          )}
        </div>
      </Modal>
    </>
  );
}
