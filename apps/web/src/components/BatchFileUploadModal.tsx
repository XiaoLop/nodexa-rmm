import {
  CloseCircleOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { GatewayClient } from '@meshcentral/control-client';
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
import type { BatchUploadManager } from '../features/batch-upload/BatchUploadManager';
import {
  summarizeBatchUpload,
  validateTargetDirectory,
  validateTargetFileName,
  type BatchUploadConfig,
  type BatchUploadDeviceSnapshot,
  type BatchUploadTask,
  type BatchUploadTaskStatus,
} from '../features/batch-upload/types';

interface BatchFileUploadModalProps {
  open: boolean;
  devices: BatchUploadDeviceSnapshot[];
  gatewayClient?: GatewayClient;
  baseUrl?: string;
  connected: boolean;
  manager: BatchUploadManager;
  onClose: () => void;
}

interface UploadFormValues {
  targetDirectory: string;
  targetFileName: string;
  overwritePolicy: 'skip' | 'overwrite';
  concurrency: number;
}

const statusLabels: Record<BatchUploadTaskStatus, string> = {
  queued: '等待',
  connecting: '连接中',
  checking: '检查中',
  uploading: '上传中',
  success: '成功',
  skipped: '跳过',
  failed: '失败',
  cancelling: '取消中',
  cancelled: '已取消',
};

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
  if (duration < 60_000) return `${(duration / 1000).toFixed(1)} 秒`;
  return `${Math.floor(duration / 60_000)}分${Math.round((duration % 60_000) / 1000)}秒`;
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

export function BatchFileUploadModal({
  open,
  devices,
  gatewayClient,
  baseUrl,
  connected,
  manager,
  onClose,
}: BatchFileUploadModalProps) {
  const [form] = Form.useForm<UploadFormValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const snapshot = useSyncExternalStore(
    manager.subscribe,
    manager.getSnapshot,
    manager.getSnapshot,
  );
  const [selectedFile, setSelectedFile] = useState<File>();
  const [now, setNow] = useState(Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
    setSelectedFile(undefined);
    form.resetFields();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [form, snapshot.id]);

  const startUpload = async () => {
    if (!selectedFile || !gatewayClient || !baseUrl || !connected) {
      void messageApi.error(!selectedFile ? '请选择本地文件。' : '网关或中继地址不可用。');
      return;
    }
    try {
      const values = await form.validateFields();
      const directoryError = validateTargetDirectory(values.targetDirectory);
      const nameError = validateTargetFileName(values.targetFileName);
      if (directoryError || nameError) {
        void messageApi.error(directoryError ?? nameError);
        return;
      }
      const config: BatchUploadConfig = {
        file: selectedFile,
        targetDirectory: values.targetDirectory.trim(),
        targetFileName: values.targetFileName,
        overwritePolicy: values.overwritePolicy,
        concurrency: values.concurrency,
      };
      manager.start(config, gatewayClient, baseUrl);
    } catch {
      // Ant Design form displays validation details.
    }
  };

  const closeModal = () => {
    if (!running) {
      manager.reset();
      onClose();
      return;
    }
    Modal.confirm({
      title: '批量上传仍在运行',
      content: '可返回任务列表继续查看，或取消全部任务后关闭。',
      okText: '取消全部并关闭',
      okButtonProps: { danger: true },
      cancelText: '返回任务列表',
      onOk: () => {
        manager.cancelAll();
        onClose();
      },
    });
  };

  const columns: TableColumnsType<BatchUploadTask> = [
    {
      title: '设备',
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
      title: '平台',
      key: 'platform',
      width: 115,
      render: (_, task) => task.device.platform || '未知',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 95,
      render: (status: BatchUploadTaskStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: '进度',
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
      title: '已确认 / 总大小',
      key: 'bytes',
      width: 155,
      render: (_, task) =>
        `${formatBytes(task.acknowledgedBytes)} / ${formatBytes(task.totalBytes)}`,
    },
    { title: '耗时', key: 'duration', width: 90, render: (_, task) => formatDuration(task) },
    {
      title: '详情',
      dataIndex: 'detail',
      ellipsis: { showTitle: false },
      render: (detail?: string) => (
        <Typography.Text ellipsis={{ tooltip: detail }}>{detail || '—'}</Typography.Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_, task) => {
        const cancellable = ['queued', 'connecting', 'checking', 'uploading'].includes(task.status);
        return cancellable ? (
          <Button type="link" danger size="small" onClick={() => manager.cancelTask(task.id)}>
            取消
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
            批量上传文件（{devices.length} 台设备）
          </Space>
        }
        width={1180}
        onCancel={closeModal}
        destroyOnHidden={false}
        footer={
          configurable
            ? [
                <Button key="close" onClick={closeModal}>
                  关闭
                </Button>,
                <Button
                  key="start"
                  type="primary"
                  icon={<UploadOutlined />}
                  disabled={!selectedFile || !connected || !baseUrl}
                  onClick={() => void startUpload()}
                >
                  开始上传
                </Button>,
              ]
            : [
                summary.failed > 0 && !running ? (
                  <Button
                    key="retry"
                    icon={<ReloadOutlined />}
                    onClick={() => manager.retryFailed()}
                  >
                    重试全部失败任务
                  </Button>
                ) : null,
                running ? (
                  <Button
                    key="cancel-all"
                    danger
                    icon={<StopOutlined />}
                    onClick={() => manager.cancelAll()}
                  >
                    取消全部
                  </Button>
                ) : null,
                <Button key="close" onClick={closeModal}>
                  关闭
                </Button>,
              ]
        }
      >
        <div className="batch-upload-modal">
          {hasMixedPlatforms(devices) && (
            <Alert
              showIcon
              type="warning"
              message="选中设备包含不同平台"
              description="目标目录必须在所有设备上有效，系统不会自动转换 Windows 与 POSIX 路径。"
            />
          )}
          {configurable ? (
            <Form<UploadFormValues>
              form={form}
              layout="vertical"
              initialValues={{ overwritePolicy: 'skip', concurrency: 4 }}
              className="batch-upload-form"
            >
              <Form.Item label="本地文件" required>
                <input
                  ref={fileInputRef}
                  hidden
                  type="file"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setSelectedFile(file);
                    if (file) form.setFieldValue('targetFileName', file.name);
                  }}
                />
                <div className="batch-upload-file-picker">
                  <Button
                    icon={<FolderOpenOutlined />}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    选择文件
                  </Button>
                  {selectedFile ? (
                    <Typography.Text ellipsis={{ tooltip: selectedFile.name }}>
                      {selectedFile.name} · {formatBytes(selectedFile.size)}
                    </Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">尚未选择文件</Typography.Text>
                  )}
                </div>
              </Form.Item>
              <div className="batch-upload-form-grid">
                <Form.Item
                  name="targetDirectory"
                  label="目标目录"
                  rules={[{ required: true, message: '请输入目标目录。' }]}
                >
                  <Input placeholder="例如 C:\\Temp 或 /tmp" />
                </Form.Item>
                <Form.Item
                  name="targetFileName"
                  label="目标文件名"
                  rules={[{ required: true, message: '请输入目标文件名。' }]}
                >
                  <Input placeholder="默认使用本地文件名" />
                </Form.Item>
                <Form.Item name="concurrency" label="最大并发数">
                  <InputNumber min={1} max={8} precision={0} style={{ width: '100%' }} />
                </Form.Item>
              </div>
              <Form.Item name="overwritePolicy" label="同名文件策略">
                <Radio.Group>
                  <Radio value="skip">跳过（推荐）</Radio>
                  <Radio value="overwrite">覆盖（取决于当前 Agent 行为）</Radio>
                </Radio.Group>
              </Form.Item>
              <Alert
                showIcon
                type="info"
                message={`即将向 ${devices.length} 台设备上传；离线设备会直接跳过。`}
                description="每台在线设备使用独立文件中继，并发 Worker 和中继连接最多 8 个。"
              />
            </Form>
          ) : (
            <>
              <div className="batch-upload-summary">
                <Statistic title="总设备" value={summary.total} />
                <Statistic title="等待" value={summary.queued} />
                <Statistic title="进行中" value={summary.active} />
                <Statistic title="成功" value={summary.success} />
                <Statistic title="跳过" value={summary.skipped} />
                <Statistic title="失败" value={summary.failed} />
                <Statistic title="已取消" value={summary.cancelled} />
              </div>
              {!connected && running && (
                <Alert
                  showIcon
                  type="error"
                  icon={<CloseCircleOutlined />}
                  message="网关连接已断开"
                  description="正在运行的控制请求会失败；可等待任务结束后重试失败设备。"
                />
              )}
              <Table<BatchUploadTask>
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={snapshot.tasks}
                pagination={{ pageSize: 20, hideOnSinglePage: true }}
                scroll={{ x: 1080, y: 430 }}
              />
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
