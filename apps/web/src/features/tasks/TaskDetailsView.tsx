import { CopyOutlined } from '@ant-design/icons';
import type { BatchDeviceResult, CommandDeviceResult } from '@meshcentral/control-client';
import {
  Alert,
  Button,
  Descriptions,
  Progress,
  Space,
  Table,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cleanCommandOutput } from '../commands/commandOutput';
import type { BatchUploadTask } from '../batch-upload/types';
import type { BatchTask, BatchTaskStatus } from './types';

interface TaskDetailsViewProps {
  task: BatchTask;
}

const statusColors: Record<BatchTaskStatus, string> = {
  queued: 'default',
  running: 'processing',
  cancelling: 'warning',
  completed: 'success',
  'partially-completed': 'warning',
  failed: 'error',
  cancelled: 'default',
  interrupted: 'error',
};

function formatBytes(value: number): string {
  if (value < 1024) return `${value.toFixed(1)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index];
  }
  return `${size.toFixed(1)} ${unit}`;
}

export function TaskDetailsView({ task }: TaskDetailsViewProps) {
  const { t } = useTranslation();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>();

  return (
    <div className="task-details-view">
      <div className="task-details-meta">
        <Descriptions size="small" column={{ xs: 1, sm: 2, md: 3 }} bordered>
          <Descriptions.Item label={t('taskCenter.kind')}>
            <Tag color="blue">{t(`taskCenter.kinds.${task.kind}`)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('taskCenter.status')}>
            <Tag color={statusColors[task.status]}>{t(`taskCenter.statuses.${task.status}`)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('taskCenter.progress')}>
            <Progress size="small" percent={Math.round(task.progress)} style={{ width: 140 }} />
          </Descriptions.Item>
          <Descriptions.Item label={t('taskCenter.summary')}>
            <Space size="middle">
              <span>
                {t('taskCenter.total')}: <strong>{task.totalCount}</strong>
              </span>
              <span>
                {t('taskCenter.succeeded')}:{' '}
                <strong style={{ color: 'var(--success)' }}>{task.succeededCount}</strong>
              </span>
              {task.failedCount > 0 && (
                <span>
                  {t('taskCenter.failed')}:{' '}
                  <strong style={{ color: 'var(--danger)' }}>{task.failedCount}</strong>
                </span>
              )}
              {task.skippedCount > 0 && (
                <span>
                  {t('taskCenter.skipped')}:{' '}
                  <strong style={{ color: 'var(--warning)' }}>{task.skippedCount}</strong>
                </span>
              )}
            </Space>
          </Descriptions.Item>
          {task.startedAt && (
            <Descriptions.Item label={t('taskCenter.startedAt')}>
              {new Date(task.startedAt).toLocaleTimeString()}
            </Descriptions.Item>
          )}
          {task.completedAt && (
            <Descriptions.Item label={t('taskCenter.completedAt')}>
              {new Date(task.completedAt).toLocaleTimeString()}
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>

      <div style={{ marginTop: 16 }}>
        {task.kind === 'file-upload' && <UploadTaskDetailsSection task={task} />}
        {task.kind === 'command' && (
          <CommandTaskDetailsSection
            task={task}
            selectedDeviceId={selectedDeviceId}
            onSelectDeviceId={setSelectedDeviceId}
          />
        )}
        {task.kind === 'move-group' && <MoveGroupTaskDetailsSection task={task} />}
        {task.kind === 'power' && <PowerTaskDetailsSection task={task} />}
      </div>
    </div>
  );
}

function UploadTaskDetailsSection({ task }: { task: Extract<BatchTask, { kind: 'file-upload' }> }) {
  const { t } = useTranslation();
  const columns: TableColumnsType<BatchUploadTask> = [
    {
      title: t('taskCenter.device'),
      render: (_, item) => (
        <div>
          <Typography.Text strong>{item.device.name}</Typography.Text>
          <br />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {item.device.id}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: t('taskCenter.file'),
      dataIndex: 'targetFileName',
      ellipsis: true,
      render: (_, item) => item.targetRelativePath || item.targetFileName || '—',
    },
    {
      title: t('taskCenter.status'),
      dataIndex: 'status',
      width: 110,
      render: (status: string) => {
        const color =
          status === 'success'
            ? 'success'
            : status === 'failed'
              ? 'error'
              : status === 'uploading'
                ? 'processing'
                : 'default';
        return <Tag color={color}>{t(`batchUpload.status.${status}`)}</Tag>;
      },
    },
    {
      title: t('taskCenter.progress'),
      width: 170,
      render: (_, item) => (
        <Space direction="vertical" size={2} style={{ width: '100%' }}>
          <Progress size="small" percent={Math.round(item.percentage)} />
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {formatBytes(item.acknowledgedBytes)} / {formatBytes(item.totalBytes)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: t('taskCenter.result'),
      render: (_, item) => item.detail?.raw || item.errorCode || '—',
      ellipsis: true,
    },
  ];

  return (
    <Table
      rowKey="id"
      size="small"
      columns={columns}
      dataSource={task.upload.tasks}
      pagination={{ pageSize: 10, hideOnSinglePage: true }}
      scroll={{ x: 680 }}
    />
  );
}

function CommandTaskDetailsSection({
  task,
  selectedDeviceId,
  onSelectDeviceId,
}: {
  task: Extract<BatchTask, { kind: 'command' }>;
  selectedDeviceId?: string;
  onSelectDeviceId: (id: string) => void;
}) {
  const { t } = useTranslation();
  const results = task.commandSnapshot?.results ?? [];
  const selectedResult = results.find((r) => r.deviceId === selectedDeviceId) ?? results[0];

  const columns: TableColumnsType<CommandDeviceResult> = [
    {
      title: t('taskCenter.device'),
      dataIndex: 'deviceId',
      render: (deviceId: string) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => onSelectDeviceId(deviceId)}>
          {task.deviceNames[deviceId] ?? deviceId}
        </Button>
      ),
    },
    {
      title: t('taskCenter.status'),
      dataIndex: 'status',
      width: 110,
      render: (value: string) => {
        const color =
          value === 'succeeded'
            ? 'success'
            : value === 'failed'
              ? 'error'
              : value === 'running' || value === 'submitting'
                ? 'processing'
                : 'default';
        return <Tag color={color}>{t(`commands.status.${value}`)}</Tag>;
      },
    },
    {
      title: t('taskCenter.exitCode'),
      dataIndex: 'exitCode',
      width: 90,
      render: (value?: number) => (value !== undefined ? value : '—'),
    },
    {
      title: t('taskCenter.duration'),
      dataIndex: 'durationMs',
      width: 90,
      render: (val?: number) => (val !== undefined ? `${(val / 1000).toFixed(1)}s` : '—'),
    },
    {
      title: t('taskCenter.result'),
      ellipsis: true,
      render: (_, result) => {
        const output = cleanCommandOutput(
          result.output.map((chunk) => chunk.content).join(''),
        ).trim();
        return result.error || output.split(/\r?\n/)[0] || '—';
      },
    },
    {
      title: t('common.actions.view'),
      width: 80,
      render: (_, result) => (
        <Button type="link" size="small" onClick={() => onSelectDeviceId(result.deviceId)}>
          {t('commands.actions.output')}
        </Button>
      ),
    },
  ];

  const outputText = selectedResult
    ? cleanCommandOutput(selectedResult.output.map((chunk) => chunk.content).join(''))
    : '';

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <Typography.Text strong>{t('commands.commandPlaceholder')}:</Typography.Text>
          <Tag>{task.shell}</Tag>
        </div>
        <Typography.Paragraph copyable={{ text: task.command }} className="task-command">
          {task.command}
        </Typography.Paragraph>
      </div>

      <Table
        rowKey="deviceId"
        size="small"
        columns={columns}
        dataSource={results}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        scroll={{ x: 680 }}
      />

      {selectedResult && (
        <div className="task-command-output-box">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <Typography.Text strong>
              {task.deviceNames[selectedResult.deviceId] ?? selectedResult.deviceId}{' '}
              {t('commands.actions.output')}
            </Typography.Text>
            {outputText && (
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={() => void navigator.clipboard.writeText(outputText)}
              >
                {t('common.actions.copy')}
              </Button>
            )}
          </div>
          <pre className="task-command-pre">
            {outputText || selectedResult.error || t('commands.gatewayOutputUnavailable')}
          </pre>
        </div>
      )}
    </Space>
  );
}

function MoveGroupTaskDetailsSection({
  task,
}: {
  task: Extract<BatchTask, { kind: 'move-group' }>;
}) {
  const { t } = useTranslation();
  const columns: TableColumnsType<BatchDeviceResult> = [
    { title: t('taskCenter.device'), dataIndex: 'deviceName' },
    {
      title: t('taskCenter.status'),
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const color =
          value === 'submitted' || value === 'succeeded'
            ? 'success'
            : value === 'failed'
              ? 'error'
              : value === 'skipped'
                ? 'warning'
                : 'default';
        return <Tag color={color}>{t(`batchOperations.status.${value}`)}</Tag>;
      },
    },
    {
      title: t('taskCenter.result'),
      dataIndex: 'message',
      render: (value?: string) => value || '—',
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        showIcon
        type="info"
        title={t('taskCenter.targetGroupNotice', { name: task.targetGroupName })}
      />
      <Table
        rowKey="deviceId"
        size="small"
        columns={columns}
        dataSource={task.results}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        scroll={{ x: 560 }}
      />
    </Space>
  );
}

function PowerTaskDetailsSection({ task }: { task: Extract<BatchTask, { kind: 'power' }> }) {
  const { t } = useTranslation();
  const columns: TableColumnsType<BatchDeviceResult> = [
    { title: t('taskCenter.device'), dataIndex: 'deviceName' },
    {
      title: t('taskCenter.status'),
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const color =
          value === 'submitted' || value === 'succeeded'
            ? 'success'
            : value === 'failed'
              ? 'error'
              : value === 'skipped'
                ? 'warning'
                : 'default';
        return <Tag color={color}>{t(`batchOperations.status.${value}`)}</Tag>;
      },
    },
    {
      title: t('taskCenter.result'),
      dataIndex: 'message',
      render: (value?: string) => value || '—',
    },
  ];

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        showIcon
        type="info"
        title={t('taskCenter.powerActionNotice', {
          action: t(`devices.powerActions.${task.action}`),
        })}
      />
      <Table
        rowKey="deviceId"
        size="small"
        columns={columns}
        dataSource={task.results}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        scroll={{ x: 560 }}
      />
    </Space>
  );
}
