import {
  CloudUploadOutlined,
  PoweroffOutlined,
  ProfileOutlined,
  RetweetOutlined,
  RightOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Badge, Button, Empty, Popover, Progress, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBatchTasks } from './BatchTaskContext';
import type { BatchTask, BatchTaskKind, BatchTaskStatus } from './types';

const kindIcons: Record<BatchTaskKind, React.ReactNode> = {
  'file-upload': <CloudUploadOutlined style={{ color: '#2f80ff' }} />,
  command: <ToolOutlined style={{ color: '#fa8c16' }} />,
  'move-group': <RetweetOutlined style={{ color: '#13c2c2' }} />,
  power: <PoweroffOutlined style={{ color: '#eb2f96' }} />,
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

export function TaskCenterPopover() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tasks, activeCount, unviewedCompletedCount } = useBatchTasks();
  const [open, setOpen] = useState(false);

  const recentTasks = useMemo(
    () => [...tasks].sort((a, b) => b.createdAt - a.createdAt).slice(0, 2),
    [tasks],
  );

  const handleViewAll = () => {
    setOpen(false);
    navigate('/devices/tasks');
  };

  const content = (
    <div className="task-popover-content">
      <div className="task-popover-header">
        <Typography.Text strong>{t('taskCenter.recentTasks')}</Typography.Text>
        {activeCount > 0 && (
          <Tag color="processing" style={{ margin: 0 }}>
            {t('taskCenter.metrics.running')}: {activeCount}
          </Tag>
        )}
      </div>

      <div className="task-popover-body">
        {recentTasks.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('taskCenter.empty')}
            style={{ margin: '16px 0' }}
          />
        ) : (
          <div className="task-popover-list">
            {recentTasks.map((task: BatchTask) => (
                <div key={task.id} className="task-popover-item">
                  <div className="task-popover-item-header">
                    <Space size="small" style={{ overflow: 'hidden' }}>
                      <span className="task-popover-item-icon">{kindIcons[task.kind]}</span>
                      <Typography.Text
                        strong
                        ellipsis={{ tooltip: task.title }}
                        style={{ maxWidth: 170 }}
                      >
                        {task.title}
                      </Typography.Text>
                    </Space>
                    <Tag
                      color={statusColors[task.status]}
                      style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}
                    >
                      {t(`taskCenter.statuses.${task.status}`)}
                    </Tag>
                  </div>
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
                    style={{ margin: '6px 0 4px' }}
                  />
                  <div className="task-popover-item-footer">
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                      {t('taskCenter.counts', {
                        completed: task.completedCount,
                        total: task.totalCount,
                        failed: task.failedCount,
                      })}
                    </Typography.Text>
                    {task.createdAt && (
                      <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                        {new Date(task.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography.Text>
                    )}
                  </div>
                </div>
            ))}
          </div>
        )}
      </div>

      <div className="task-popover-footer">
        <Button
          type="primary"
          ghost
          block
          size="small"
          icon={<RightOutlined />}
          onClick={handleViewAll}
        >
          {t('taskCenter.viewAllTasks')}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomRight"
      overlayClassName="task-center-popover-overlay"
    >
      <Badge
        count={activeCount}
        dot={!activeCount && unviewedCompletedCount > 0}
        size="small"
      >
        <Button
          type="text"
          icon={<ProfileOutlined />}
          aria-label={t('taskCenter.title')}
        />
      </Badge>
    </Popover>
  );
}
