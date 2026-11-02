import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  DesktopOutlined,
  FolderOpenOutlined,
  PoweroffOutlined,
  ProfileOutlined,
  ReloadOutlined,
  RetweetOutlined,
  SearchOutlined,
  SyncOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {
  Button,
  Empty,
  Input,
  Progress,
  Select,
  Space,
  Tag,
  Typography,
  type TableColumnsType,
} from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBatchTasks } from '../features/tasks/BatchTaskContext';
import { TaskDetailsView } from '../features/tasks/TaskDetailsView';
import type { BatchTask, BatchTaskKind, BatchTaskStatus } from '../features/tasks/types';
import { isActiveBatchTaskStatus } from '../features/tasks/types';
import { useFormatters } from '../i18n';
import { ConsoleTable, ConsoleDrawer, FilterBar, MetricCard, PageHeader, Panel } from '../components/ui';
import '../assets/styles/devices.css';
import '../assets/styles/tasks.css';

const kindIcons: Record<BatchTaskKind, React.ReactNode> = {
  'file-upload': <CloudUploadOutlined style={{ color: 'var(--color-brand-hover)' }} />,
  command: <ToolOutlined style={{ color: 'var(--color-warning)' }} />,
  'move-group': <RetweetOutlined style={{ color: 'var(--color-success)' }} />,
  power: <PoweroffOutlined style={{ color: 'var(--color-text-secondary)' }} />,
};

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

export function TasksPage() {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const navigate = useNavigate();
  const { tasks, activeCount, manager } = useBatchTasks();

  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string>();

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

  // Statistics
  const stats = useMemo(() => {
    let completed = 0;
    let failed = 0;
    for (const task of tasks) {
      if (task.status === 'completed') completed += 1;
      else if (
        task.status === 'failed' ||
        task.status === 'partially-completed' ||
        task.status === 'interrupted'
      ) {
        failed += 1;
      }
    }
    return {
      total: tasks.length,
      running: activeCount,
      completed,
      failed,
    };
  }, [tasks, activeCount]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (kindFilter !== 'all' && task.kind !== kindFilter) return false;
        if (statusFilter === 'active' && !isActiveBatchTaskStatus(task.status)) return false;
        if (statusFilter === 'completed' && task.status !== 'completed') return false;
        if (
          statusFilter === 'failed' &&
          task.status !== 'failed' &&
          task.status !== 'partially-completed' &&
          task.status !== 'interrupted'
        ) {
          return false;
        }
        if (q) {
          const matchTitle = task.title.toLowerCase().includes(q);
          const matchId = task.id.toLowerCase().includes(q);
          const matchCommand = task.kind === 'command' && task.command.toLowerCase().includes(q);
          return matchTitle || matchId || matchCommand;
        }
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [tasks, query, kindFilter, statusFilter]);

  const handleOpenDetails = (task: BatchTask) => {
    manager.markViewed(task.id);
    setSelectedTaskId(task.id);
  };

  const columns: TableColumnsType<BatchTask> = useMemo(
    () => [
      {
        title: t('taskCenter.columns.task'),
        key: 'task',
        width: 260,
        render: (_, task) => (
          <Space orientation="horizontal" align="center" size="small">
            <span style={{ fontSize: 18, display: 'inline-flex' }}>{kindIcons[task.kind]}</span>
            <div>
              <Typography.Text strong style={{ display: 'block' }}>
                {task.title}
              </Typography.Text>
              {task.kind === 'command' && (
                <Typography.Text
                  type="secondary"
                  ellipsis={{ tooltip: task.command }}
                  style={{ fontSize: 12, maxWidth: 220, display: 'block' }}
                >
                  {task.command}
                </Typography.Text>
              )}
            </div>
          </Space>
        ),
      },
      {
        title: t('taskCenter.columns.kind'),
        key: 'kind',
        width: 120,
        render: (_, task) => <Tag>{t(`taskCenter.kinds.${task.kind}`)}</Tag>,
      },
      {
        title: t('taskCenter.columns.targets'),
        key: 'targets',
        width: 170,
        render: (_, task) => {
          if (task.kind === 'file-upload') {
            const deviceCount =
              task.targetDeviceCount ||
              (task.upload?.tasks?.length
                ? new Set(task.upload.tasks.map((item) => item.device.id)).size
                : 1);
            const fileCount =
              task.fileCount ||
              task.upload?.config?.files?.length ||
              (task.upload?.tasks?.length && deviceCount
                ? Math.round(task.upload.tasks.length / deviceCount)
                : task.totalCount);
            return (
              <div>
                <Typography.Text>
                  {t('taskCenter.uploadTargets', {
                    deviceCount,
                    fileCount,
                  })}
                </Typography.Text>
                {task.failedCount > 0 && (
                  <span style={{ color: 'var(--danger)', fontSize: 12, marginLeft: 6 }}>
                    ({task.failedCount} {t('taskCenter.failed')})
                  </span>
                )}
              </div>
            );
          }

          return (
            <div>
              <Typography.Text>
                {t('taskCenter.targetsCount', { count: task.totalCount })}
              </Typography.Text>
              {task.failedCount > 0 && (
                <span style={{ color: 'var(--danger)', fontSize: 12, marginLeft: 6 }}>
                  ({task.failedCount} {t('common.status.offline')})
                </span>
              )}
            </div>
          );
        },
      },
      {
        title: t('taskCenter.columns.progress'),
        key: 'progress',
        width: 180,
        render: (_, task) => (
          <Progress
            size="small"
            percent={Math.round(task.progress)}
            status={
              task.status === 'failed'
                ? 'exception'
                : task.status === 'completed'
                  ? 'success'
                  : undefined
            }
          />
        ),
      },
      {
        title: t('taskCenter.columns.status'),
        dataIndex: 'status',
        width: 130,
        render: (status: BatchTaskStatus) => (
          <Tag color={statusColors[status]}>{t(`taskCenter.statuses.${status}`)}</Tag>
        ),
      },
      {
        title: t('taskCenter.columns.createdAt'),
        dataIndex: 'createdAt',
        width: 160,
        render: (val: number) => formatters.dateTime(new Date(val).toISOString()),
      },
      {
        title: t('taskCenter.columns.actions'),
        key: 'actions',
        fixed: 'right',
        width: 160,
        render: (_, task) => {
          const active = isActiveBatchTaskStatus(task.status);
          return (
            <Space size="small">
              <Button
                type="link"
                size="small"
                icon={<FolderOpenOutlined />}
                onClick={() => handleOpenDetails(task)}
              >
                {t('taskCenter.viewDetails')}
              </Button>
              {task.availableActions.includes('retry') && (
                <Button
                  type="link"
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => manager.runAction(task.id, 'retry')}
                >
                  {t('taskCenter.retry')}
                </Button>
              )}
              {task.availableActions.includes('cancel') && (
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<CloseCircleOutlined />}
                  onClick={() => manager.runAction(task.id, 'cancel')}
                >
                  {t('common.actions.cancel')}
                </Button>
              )}
              {!active && (
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => manager.removeTask(task.id)}
                />
              )}
            </Space>
          );
        },
      },
    ],
    [formatters, manager, t],
  );

  return (
    <div className="page-stack tasks-page">
      <PageHeader
        title={t('taskCenter.title')}
        description={t('taskCenter.subtitle')}
        actions={
          <Space>
            <Button icon={<DesktopOutlined />} onClick={() => navigate('/devices')}>
              {t('taskCenter.backToDevices')}
            </Button>
            <Button
              icon={<DeleteOutlined />}
              disabled={!tasks.some((task) => !isActiveBatchTaskStatus(task.status))}
              onClick={() => manager.clearCompleted()}
            >
              {t('taskCenter.clearCompleted')}
            </Button>
          </Space>
        }
      />

      <div className="tasks-metrics-grid">
        <MetricCard
          icon={<ProfileOutlined />}
          label={t('taskCenter.metrics.total')}
          value={stats.total}
        />
        <MetricCard
          icon={<SyncOutlined spin={stats.running > 0} />}
          label={t('taskCenter.metrics.running')}
          value={stats.running}
        />
        <MetricCard
          icon={<CheckCircleOutlined />}
          label={t('taskCenter.metrics.completed')}
          value={stats.completed}
          tone="success"
        />
        <MetricCard
          icon={<CloseCircleOutlined />}
          label={t('taskCenter.metrics.failed')}
          value={stats.failed}
          tone="danger"
        />
      </div>

      {/* Main Table Card */}
      <Panel className="devices-table-card">
        <FilterBar>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefix={<SearchOutlined />}
            placeholder={t('taskCenter.searchPlaceholder')}
            allowClear
          />
          <Select
            value={kindFilter}
            onChange={setKindFilter}
            options={[
              { value: 'all', label: t('taskCenter.kinds.all') },
              { value: 'file-upload', label: t('taskCenter.kinds.file-upload') },
              { value: 'command', label: t('taskCenter.kinds.command') },
              { value: 'move-group', label: t('taskCenter.kinds.move-group') },
              { value: 'power', label: t('taskCenter.kinds.power') },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: t('taskCenter.filterAllStatuses') },
              { value: 'active', label: t('taskCenter.filterActive') },
              { value: 'completed', label: t('taskCenter.filterCompleted') },
              { value: 'failed', label: t('taskCenter.filterFailed') },
            ]}
          />
          <div className="toolbar-spacer" />
          <Tag>
            {filteredTasks.length} / {tasks.length}
          </Tag>
        </FilterBar>

        <ConsoleTable
          rowKey="id"
          columns={columns}
          dataSource={filteredTasks}
          pagination={{ defaultPageSize: 20 }}
          scroll={{ x: 1040 }}
          locale={{
            emptyText: <Empty description={t('taskCenter.empty')} />,
          }}
        />
      </Panel>

      {/* Task Details Drawer */}
      <ConsoleDrawer
        title={selectedTask ? selectedTask.title : t('taskCenter.details')}
        variant="details"
        open={Boolean(selectedTask)}
        onClose={() => setSelectedTaskId(undefined)}
      >
        {selectedTask && <TaskDetailsView task={selectedTask} />}
      </ConsoleDrawer>
    </div>
  );
}
