import {
  ClearOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  FileOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  InboxOutlined,
  ReloadOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { MeshCentralClient } from '@meshcentral/control-client';
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Radio,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
  type TableColumnsType,
} from 'antd';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { extractFilesFromDataTransfer } from '../features/batch-upload/fileSystem';
import type { BatchUploadManager } from '../features/batch-upload/BatchUploadManager';
import {
  summarizeBatchUpload,
  validateRelativeFilePath,
  validateTargetDirectory,
  type BatchUploadConfig,
  type BatchUploadDeviceSnapshot,
  type BatchUploadFileItem,
  type BatchUploadTask,
  type BatchUploadTaskStatus,
} from '../features/batch-upload/types';

interface BatchFileUploadModalProps {
  open: boolean;
  devices: BatchUploadDeviceSnapshot[];
  meshCentralClient?: MeshCentralClient;
  baseUrl?: string;
  connected: boolean;
  manager: BatchUploadManager;
  onClose: () => void;
  onStartTask?: (config: BatchUploadConfig) => void;
}

interface UploadFormValues {
  targetDirectory: string;
  overwritePolicy: 'skip' | 'overwrite';
  concurrency: number;
}

const statusColors: Record<BatchUploadTaskStatus, string> = {
  queued: 'default',
  connecting: 'processing',
  checking: 'cyan',
  uploading: 'blue',
  success: 'success',
  skipped: 'warning',
  failed: 'error',
  cancelling: 'orange',
  cancelled: 'default',
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value.toFixed(2)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(2)} ${unit}`;
}

function formatDuration(task: BatchUploadTask): string {
  if (!task.startedAt) return '—';
  const duration = Math.max(0, (task.completedAt ?? Date.now()) - task.startedAt);
  if (duration < 1000) return `${duration} ms`;
  if (duration < 60_000) return `${(duration / 1000).toFixed(1)} s`;
  return `${Math.floor(duration / 60_000)}m ${Math.round((duration % 60_000) / 1000)}s`;
}

function hasMixedPlatforms(devices: BatchUploadDeviceSnapshot[]): boolean {
  const families = new Set(
    devices.map((device) => {
      const platform = device.platform?.toLowerCase() ?? '';
      if (platform.includes('windows')) return 'windows';
      if (platform.includes('linux') || platform.includes('mac')) return 'posix';
      return 'unknown';
    }),
  );
  return families.size > 1;
}

function formatTaskDetail(detail: BatchUploadTask['detail'], t: (key: string) => string): string {
  if (!detail) return '—';
  const key = `batchUpload.details.${detail.code}`;
  const translated = t(key);
  return translated === key ? (detail.raw ?? detail.code) : translated;
}

export function BatchFileUploadModal({
  open,
  devices,
  meshCentralClient,
  baseUrl,
  connected,
  manager,
  onClose,
  onStartTask,
}: BatchFileUploadModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<UploadFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const snapshot = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot,
  );
  const [selectedFiles, setSelectedFiles] = useState<BatchUploadFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [now, setNow] = useState(Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const summary = useMemo(() => summarizeBatchUpload(snapshot.tasks), [snapshot.tasks]);
  const running = snapshot.status === 'running' || snapshot.status === 'cancelling';
  const configurable = snapshot.status === 'configuring';

  useEffect(() => {
    if (!open || !running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open, running]);

  useEffect(() => {
    void now;
  }, [now]);

  useEffect(() => {
    setSelectedFiles([]);
    setIsDragging(false);
    form.resetFields();
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  }, [form, snapshot.id]);

  const addFileItems = (newItems: BatchUploadFileItem[]) => {
    if (!newItems.length) return;
    setSelectedFiles((prev) => {
      const existingPaths = new Set(prev.map((item) => item.relativePath.toLowerCase()));
      const filtered = newItems.filter((item) => !existingPaths.has(item.relativePath.toLowerCase()));
      return [...prev, ...filtered];
    });
  };

  const removeFileItem = (indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const clearAllFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging false if relatedTarget is outside the current target
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!e.dataTransfer) return;
    try {
      const items = await extractFilesFromDataTransfer(e.dataTransfer);
      if (items.length) {
        addFileItems(items);
      }
    } catch {
      void messageApi.error(t('batchUpload.messages.selectFilesFirst'));
    }
  };

  const startUpload = async () => {
    if (!selectedFiles.length || !meshCentralClient || !baseUrl || !connected) {
      void messageApi.error(
        !selectedFiles.length
          ? t('batchUpload.messages.selectFilesFirst')
          : t('batchUpload.messages.gatewayUnavailable'),
      );
      return;
    }
    try {
      const values = await form.validateFields();
      const directoryError = validateTargetDirectory(values.targetDirectory);
      const relativePathError = selectedFiles
        .map((item) => validateRelativeFilePath(item.relativePath))
        .find((error) => error !== undefined);
      if (directoryError || relativePathError) {
        const err = directoryError ?? relativePathError;
        void messageApi.error(err ? t(`batchUpload.validation.${err}`) : '');
        return;
      }
      const normalizedPaths = selectedFiles.map((item) => item.relativePath.toLocaleLowerCase());
      if (new Set(normalizedPaths).size !== normalizedPaths.length) {
        void messageApi.error(t('batchUpload.messages.duplicateFileNames'));
        return;
      }
      const config: BatchUploadConfig = {
        files: selectedFiles,
        targetDirectory: values.targetDirectory.trim(),
        overwritePolicy: values.overwritePolicy,
        concurrency: values.concurrency,
      };
      if (onStartTask) {
        onStartTask(config);
        onClose();
        return;
      }
      manager.start(config, meshCentralClient, baseUrl);
    } catch {
      // Ant Design form displays validation details.
    }
  };

  const closeModal = () => {
    if (onStartTask) {
      manager.reset();
      onClose();
      return;
    }
    if (!running) {
      manager.reset();
      onClose();
      return;
    }
    Modal.confirm({
      title: t('batchUpload.closeRunningConfirmTitle'),
      content: t('batchUpload.closeRunningConfirmContent'),
      okText: t('batchUpload.closeRunningConfirmOk'),
      okButtonProps: { danger: true },
      cancelText: t('batchUpload.closeRunningConfirmCancel'),
      onOk: () => {
        manager.cancelAll();
        onClose();
      },
    });
  };

  const columns: TableColumnsType<BatchUploadTask> = [
    {
      title: t('batchUpload.columns.device'),
      key: 'device',
      width: 190,
      render: (_, task) => (
        <div className="batch-upload-device">
          <Typography.Text strong ellipsis={{ tooltip: task.device.name }}>
            {task.device.name}
          </Typography.Text>
          <Typography.Text type="secondary" ellipsis={{ tooltip: task.device.id }}>
            {task.device.id}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: t('batchUpload.columns.platform'),
      key: 'platform',
      width: 115,
      render: (_, task) => task.device.platform || t('common.status.unknown'),
    },
    {
      title: t('batchUpload.columns.file'),
      dataIndex: 'targetFileName',
      width: 180,
      ellipsis: { showTitle: false },
      render: (_, task) => {
        const displayName = task.targetRelativePath || task.targetFileName || '—';
        return <Typography.Text ellipsis={{ tooltip: displayName }}>{displayName}</Typography.Text>;
      },
    },
    {
      title: t('batchUpload.columns.status'),
      dataIndex: 'status',
      width: 95,
      render: (status: BatchUploadTaskStatus) => (
        <Tag color={statusColors[status]}>{t(`batchUpload.status.${status}`)}</Tag>
      ),
    },
    {
      title: t('batchUpload.columns.progress'),
      key: 'progress',
      width: 170,
      render: (_, task) => (
        <Progress
          size="small"
          percent={Number(task.percentage.toFixed(1))}
          status={
            task.status === 'failed'
              ? 'exception'
              : task.status === 'success'
                ? 'success'
                : undefined
          }
        />
      ),
    },
    {
      title: t('batchUpload.columns.bytes'),
      key: 'bytes',
      width: 155,
      render: (_, task) =>
        `${formatBytes(task.acknowledgedBytes)} / ${formatBytes(task.totalBytes)}`,
    },
    {
      title: t('batchUpload.columns.duration'),
      key: 'duration',
      width: 90,
      render: (_, task) => formatDuration(task),
    },
    {
      title: t('batchUpload.columns.detail'),
      dataIndex: 'detail',
      ellipsis: { showTitle: false },
      render: (detail?: BatchUploadTask['detail']) => (
        <Typography.Text ellipsis={{ tooltip: formatTaskDetail(detail, t) }}>
          {formatTaskDetail(detail, t)}
        </Typography.Text>
      ),
    },
    {
      title: t('batchUpload.columns.action'),
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, task) => {
        const cancellable = ['queued', 'connecting', 'checking', 'uploading'].includes(task.status);
        return cancellable ? (
          <Button type="link" danger size="small" onClick={() => manager.cancelTask(task.id)}>
            {t('common.actions.cancel')}
          </Button>
        ) : null;
      },
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
            {t('batchUpload.modalTitle', { count: devices.length })}
          </Space>
        }
        width={1180}
        onCancel={closeModal}
        destroyOnHidden={false}
        footer={
          configurable
            ? [
                <Button
                  key="start"
                  type="primary"
                  icon={<UploadOutlined />}
                  disabled={!selectedFiles.length || !connected || !baseUrl}
                  onClick={() => void startUpload()}
                >
                  {t('batchUpload.startUpload')}
                </Button>,
              ]
            : [
                summary.failed > 0 && !running ? (
                  <Button
                    key="retry"
                    icon={<ReloadOutlined />}
                    onClick={() => manager.retryFailed()}
                  >
                    {t('batchUpload.retryFailed')}
                  </Button>
                ) : null,
                running ? (
                  <Button
                    key="cancel-all"
                    danger
                    icon={<StopOutlined />}
                    onClick={() => manager.cancelAll()}
                  >
                    {t('batchUpload.cancelAll')}
                  </Button>
                ) : null,
                <Button key="close" onClick={closeModal}>
                  {t('batchUpload.close')}
                </Button>,
              ]
        }
      >
        <div className="batch-upload-modal">
          {hasMixedPlatforms(devices) && (
            <Alert
              showIcon
              type="warning"
              title={t('batchUpload.mixedPlatformTitle')}
              description={t('batchUpload.mixedPlatformDesc')}
            />
          )}
          {configurable ? (
            <Form<UploadFormValues>
              form={form}
              layout="vertical"
              initialValues={{ overwritePolicy: 'skip', concurrency: 4 }}
              className="batch-upload-form"
            >
              {/* Header: Target Directory, Overwrite Policy, Concurrency */}
              <div className="batch-upload-header-grid">
                <Form.Item
                  name="targetDirectory"
                  label={t('batchUpload.targetDirectory')}
                  rules={[{ required: true, message: t('batchUpload.targetDirectoryRequired') }]}
                >
                  <Input placeholder={t('batchUpload.targetDirectoryPlaceholder')} />
                </Form.Item>
                <Form.Item name="overwritePolicy" label={t('batchUpload.overwritePolicy')}>
                  <Radio.Group>
                    <Radio value="skip">{t('batchUpload.policySkip')}</Radio>
                    <Radio value="overwrite">{t('batchUpload.policyOverwrite')}</Radio>
                  </Radio.Group>
                </Form.Item>
                <Form.Item name="concurrency" label={t('batchUpload.concurrency')}>
                  <InputNumber min={1} max={8} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </div>

              {/* Middle Section: Drag-and-drop Dropzone */}
              <input
                ref={fileInputRef}
                hidden
                type="file"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  addFileItems(
                    files.map((file) => ({
                      file,
                      relativePath: file.webkitRelativePath || file.name,
                    })),
                  );
                }}
              />
              <input
                ref={folderInputRef}
                hidden
                type="file"
                multiple
                {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  addFileItems(
                    files.map((file) => ({
                      file,
                      relativePath: file.webkitRelativePath || file.name,
                    })),
                  );
                }}
              />

              <div
                className={`batch-upload-dropzone ${isDragging ? 'is-dragging' : ''}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => void handleDrop(e)}
                onClick={() => fileInputRef.current?.click()}
              >
                <InboxOutlined className="batch-upload-dropzone-icon" />
                <div className="batch-upload-dropzone-title">{t('batchUpload.dropzoneTitle')}</div>
                <div className="batch-upload-dropzone-desc">{t('batchUpload.dropzoneDesc')}</div>
                <div
                  className="batch-upload-dropzone-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    icon={<FileOutlined />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {t('batchUpload.selectFiles')}
                  </Button>
                  <Button
                    icon={<FolderOpenOutlined />}
                    onClick={() => folderInputRef.current?.click()}
                  >
                    {t('batchUpload.selectFolder')}
                  </Button>
                </div>
              </div>

              {/* Middle Section: Scrollable File List */}
              {selectedFiles.length > 0 && (
                <div className="batch-upload-files-section">
                  <div className="batch-upload-files-header">
                    <Typography.Text strong>
                      {t('batchUpload.fileListTitle')} (
                      {
                        t('batchUpload.filesSelectedInfo', {
                          count: selectedFiles.length,
                          size: '',
                        }).split('·')[0]
                      }
                      · {formatBytes(selectedFiles.reduce((total, item) => total + item.file.size, 0))})
                    </Typography.Text>
                    <Button
                      type="link"
                      danger
                      size="small"
                      icon={<ClearOutlined />}
                      onClick={clearAllFiles}
                    >
                      {t('batchUpload.clearFiles')}
                    </Button>
                  </div>
                  <div className="batch-upload-file-list">
                    {selectedFiles.map((item, index) => {
                      const hasSubDir = item.relativePath.includes('/') || item.relativePath.includes('\\');
                      return (
                        <div key={`${item.relativePath}-${index}`} className="batch-upload-file-item">
                          <div className="batch-upload-file-info">
                            {hasSubDir ? (
                              <FolderOutlined className="batch-upload-file-icon" />
                            ) : (
                              <FileOutlined className="batch-upload-file-icon" />
                            )}
                            <Typography.Text
                              ellipsis={{ tooltip: item.relativePath }}
                              className="batch-upload-file-name"
                            >
                              {item.relativePath}
                            </Typography.Text>
                          </div>
                          <div className="batch-upload-file-meta">
                            <span className="batch-upload-file-size">
                              {formatBytes(item.file.size)}
                            </span>
                            <Button
                              type="text"
                              danger
                              size="small"
                              icon={<DeleteOutlined />}
                              onClick={() => removeFileItem(index)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Alert
                showIcon
                type="info"
                title={t('batchUpload.startNoticeTitle', {
                  deviceCount: devices.length,
                  fileCount: selectedFiles.length,
                })}
                description={t('batchUpload.startNoticeDesc')}
              />
            </Form>
          ) : (
            <>
              <div className="batch-upload-summary">
                <Statistic title={t('batchUpload.statistics.total')} value={summary.total} />
                <Statistic title={t('batchUpload.statistics.queued')} value={summary.queued} />
                <Statistic title={t('batchUpload.statistics.active')} value={summary.active} />
                <Statistic title={t('batchUpload.statistics.success')} value={summary.success} />
                <Statistic title={t('batchUpload.statistics.skipped')} value={summary.skipped} />
                <Statistic title={t('batchUpload.statistics.failed')} value={summary.failed} />
                <Statistic
                  title={t('batchUpload.statistics.cancelled')}
                  value={summary.cancelled}
                />
              </div>
              {!connected && running && (
                <Alert
                  showIcon
                  type="error"
                  icon={<CloseCircleOutlined />}
                  title={t('batchUpload.gatewayDisconnectedTitle')}
                  description={t('batchUpload.gatewayDisconnectedDesc')}
                />
              )}
              <Table<BatchUploadTask>
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={snapshot.tasks}
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                scroll={{ x: 1260, y: 430 }}
              />
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
