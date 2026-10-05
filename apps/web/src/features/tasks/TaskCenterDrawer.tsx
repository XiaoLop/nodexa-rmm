import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudUploadOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  PoweroffOutlined,
  ReloadOutlined,
  RetweetOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Empty, Progress, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBatchTasks } from './BatchTaskContext';
import type { BatchTask } from './types';
import { isActiveBatchTaskStatus } from './types';
import { TaskDetailsView } from './TaskDetailsView';

interface TaskCenterDrawerProps {
  open: boolean;
  onClose: () => void;
}

const taskIcons = {
  'file-upload': <CloudUploadOutlined />,
  command: <ToolOutlined />,
  'move-group': <RetweetOutlined />,
  power: <PoweroffOutlined />,
};

export function TaskCenterDrawer({ open, onClose }: TaskCenterDrawerProps) {
  const { t } = useTranslation();
  const { tasks, manager } = useBatchTasks();
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => b.createdAt - a.createdAt), [tasks]);

  const openDetails = (task: BatchTask) => {
    manager.markViewed(task.id);
    setSelectedTaskId(task.id);
  };

  return (
    <Drawer
      open={open}
      title={selectedTask ? selectedTask.title : t('taskCenter.title')}
      width={selectedTask ? 760 : 460}
      onClose={() => {
        if (selectedTask) setSelectedTaskId(undefined);
        else onClose();
      }}
      extra={
        !selectedTask && tasks.some((task) => !isActiveBatchTaskStatus(task.status)) ? (
          <Button size="small" icon={<DeleteOutlined />} onClick={() => manager.clearCompleted()}>
            {t('taskCenter.clearCompleted')}
          </Button>
        ) : undefined
      }
    >
      {selectedTask ? (
        <div className="task-details">
          <TaskDetailsView task={selectedTask} />
        </div>
      ) : sortedTasks.length ? (
        <div className="task-list">
          {sortedTasks.map((task) => {
            const active = isActiveBatchTaskStatus(task.status);
            return (
              <div key={task.id} className="task-list-item">
                <div className="task-list-icon">{taskIcons[task.kind]}</div>
                <div className="task-list-content">
                  <div className="task-list-heading">
                    <Typography.Text strong>{task.title}</Typography.Text>
                    <Tag color={active ? 'processing' : task.failedCount ? 'warning' : 'success'}>
                      {t(`taskCenter.statuses.${task.status}`)}
                    </Tag>
                  </div>
                  <Progress
                    size="small"
                    percent={Math.round(task.progress)}
                    status={task.status === 'failed' ? 'exception' : undefined}
                  />
                  <div className="task-list-footer">
                    <Typography.Text type="secondary">
                      {t('taskCenter.counts', {
                        completed: task.completedCount,
                        total: task.totalCount,
                        failed: task.failedCount,
                      })}
                    </Typography.Text>
                    <Space size="small">
                      {task.availableActions.includes('retry') && (
                        <Button
                          size="small"
                          icon={<ReloadOutlined />}
                          onClick={() => manager.runAction(task.id, 'retry')}
                        >
                          {t('taskCenter.retry')}
                        </Button>
                      )}
                      {task.availableActions.includes('cancel') && (
                        <Button
                          size="small"
                          danger
                          icon={<CloseCircleOutlined />}
                          onClick={() => manager.runAction(task.id, 'cancel')}
                        >
                          {t('common.actions.cancel')}
                        </Button>
                      )}
                      <Button
                        size="small"
                        icon={active ? <FolderOpenOutlined /> : <CheckCircleOutlined />}
                        onClick={() => openDetails(task)}
                      >
                        {t('taskCenter.details')}
                      </Button>
                    </Space>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty description={t('taskCenter.empty')} />
      )}
    </Drawer>
  );
}
