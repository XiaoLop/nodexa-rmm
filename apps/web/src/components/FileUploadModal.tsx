import {
  ArrowUpOutlined,
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
  RELAY_PROTOCOLS,
  RelayClient,
  browserFileSource,
  type DirectoryListing,
  type FileEntry,
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

interface FileUploadModalProps {
  open: boolean;
  device: Device | null;
  gatewayClient?: GatewayClient;
  onClose: () => void;
}

type ConnectionStatus = 'idle' | 'connecting' | 'ready' | 'error';

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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress>();
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
    setUploadProgress(undefined);
    setUploading(false);
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
    if (!filesSession || directoryLoading || uploading) return;
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
    if (!filesSession || !selectedFile || !listing || uploading) return;
    const lifecycle = lifecycleRef.current;
    setUploading(true);
    setError(undefined);
    setUploadProgress(undefined);
    try {
      await filesSession.uploadFile(listing.path, browserFileSource(selectedFile), {
        timeoutMs: 60_000,
        chunkSize: calculateBatchUploadChunkSize(batchUploadBandwidthConfig, 1),
        onProgress: setUploadProgress,
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
      const detail = uploadError instanceof Error ? uploadError.message : '文件上传失败。';
      setError(detail);
      void messageApi.error(`文件上传失败：${detail}`);
    } finally {
      if (lifecycleRef.current === lifecycle) setUploading(false);
    }
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
  ];

  return (
    <>
      {messageContextHolder}
      <Modal
        open={open}
        title={
          <Space>
            <UploadOutlined />
            上传文件到 {device?.name ?? '设备'}
          </Space>
        }
        width={820}
        onCancel={onClose}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={onClose}>
            关闭
          </Button>,
          uploading ? (
            <Button
              key="stop"
              danger
              onClick={() => filesSessionRef.current?.cancelActive('用户取消上传。')}
            >
              取消上传
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
        <div className="file-upload-modal">
          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              closable
              onClose={() => setError(undefined)}
            />
          )}
          <div className="file-upload-location">
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
          <div className="file-upload-toolbar">
            <Space wrap>
              <Button
                icon={<HomeOutlined />}
                disabled={status !== 'ready' || directoryLoading || uploading || !listing?.path}
                onClick={() => void loadDirectory('')}
              >
                根目录
              </Button>
              <Button
                icon={<ArrowUpOutlined />}
                disabled={
                  status !== 'ready' || directoryLoading || uploading || currentParent === undefined
                }
                onClick={() => currentParent !== undefined && void loadDirectory(currentParent)}
              >
                上一级
              </Button>
              <Button
                icon={<ReloadOutlined />}
                disabled={status !== 'ready' || directoryLoading || uploading || !listing}
                onClick={() => listing && void loadDirectory(listing.path)}
              >
                刷新
              </Button>
            </Space>
            <Typography.Text type="secondary">点击文件夹进入并选择上传位置</Typography.Text>
          </div>
          <Table<FileEntry>
            className="file-directory-table"
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
                className: directory ? 'file-directory-row' : 'file-entry-row',
                onClick: directory ? () => void loadDirectory(entry.path) : undefined,
              };
            }}
          />
          <div className="file-upload-selection">
            <input
              ref={fileInputRef}
              hidden
              type="file"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0]);
                setUploadProgress(undefined);
              }}
            />
            <Button
              icon={<FolderOpenOutlined />}
              disabled={status !== 'ready' || uploading}
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
          {uploadProgress && (
            <Progress
              percent={Number(uploadProgress.percentage.toFixed(1))}
              status={uploadProgress.state === 'failed' ? 'exception' : undefined}
              format={(percent) =>
                `${percent}% · ${formatBytes(uploadProgress.acknowledgedBytes)} / ${formatBytes(uploadProgress.totalBytes)}`
              }
            />
          )}
        </div>
      </Modal>
    </>
  );
}
