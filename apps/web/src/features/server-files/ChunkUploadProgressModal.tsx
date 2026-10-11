import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  RedoOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Button, List, Modal, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatServerFileSize } from './serverFileViewModel';
import type {
  BatchUploadItem,
  BatchUploadSummary,
  ChunkUploadProgress,
} from './chunkUploadService';

interface ChunkUploadProgressModalProps {
  open: boolean;
  // 批量模式字段
  items?: BatchUploadItem[];
  summary?: BatchUploadSummary;
  onCancelItem?: (id: string) => void;
  onRetryItem?: (id: string) => void;
  onCancelAll?: () => void;
  onClose?: () => void;
  // 兼容单文件模式字段
  fileName?: string;
  progress?: ChunkUploadProgress;
  onCancel?: () => void;
}

export function ChunkUploadProgressModal({
  open,
  items,
  summary,
  onCancelItem,
  onRetryItem,
  onCancelAll,
  onClose,
  fileName,
  progress,
  onCancel,
}: ChunkUploadProgressModalProps) {
  const { t } = useTranslation();

  // 若传入 items 且具有文件，则采用批量列表模式
  const isBatchMode = Boolean(items && items.length > 0);

  // 批量模式下是否所有任务都已完结（完成、跳过、失败、取消）
  const isBatchAllFinished = isBatchMode
    ? Boolean(
        items &&
          items.every(
            (i) =>
              i.status === 'completed' ||
              i.status === 'skipped' ||
              i.status === 'error' ||
              i.status === 'canceled',
          ),
      )
    : progress?.phase === 'completed';

  const getItemStatusTag = (item: BatchUploadItem) => {
    switch (item.status) {
      case 'queued':
        return <Tag color="default">{t('serverFiles.upload.statusQueued', '排队中')}</Tag>;
      case 'hashing':
        return (
          <Tag icon={<LoadingOutlined />} color="blue">
            {t('serverFiles.upload.statusHashing', '校验Hash')}
          </Tag>
        );
      case 'uploading': {
        const concurrencyStr =
          item.concurrency && item.concurrency > 1 ? ` · ${item.concurrency}并发` : '';
        const chunkInfo =
          item.totalChunks && item.totalChunks > 1
            ? ` (${item.currentChunk ?? 1}/${item.totalChunks})`
            : '';
        return (
          <Tag icon={<LoadingOutlined />} color="processing">
            {t('serverFiles.upload.statusUploading', '传输中')}
            {chunkInfo}
            {concurrencyStr}
          </Tag>
        );
      }
      case 'merging':
        return (
          <Tag icon={<LoadingOutlined />} color="purple">
            {t('serverFiles.upload.statusMerging', '流式合并中')}
          </Tag>
        );
      case 'completed':
        return (
          <Tag icon={<CheckCircleOutlined />} color="success">
            {item.isExisting
              ? t('serverFiles.upload.statusInstantDone', '秒传完成')
              : t('serverFiles.upload.statusDone', '已完成')}
          </Tag>
        );
      case 'skipped':
        return <Tag color="warning">{t('serverFiles.upload.statusSkipped', '已跳过')}</Tag>;
      case 'error':
        return (
          <Tooltip title={item.error}>
            <Tag icon={<CloseCircleOutlined />} color="error">
              {t('serverFiles.upload.statusError', '上传失败')}
            </Tag>
          </Tooltip>
        );
      case 'canceled':
        return (
          <Tag icon={<StopOutlined />} color="default">
            {t('serverFiles.upload.statusCanceled', '已取消')}
          </Tag>
        );
      default:
        return null;
    }
  };

  const getSinglePhaseText = () => {
    switch (progress?.phase) {
      case 'hashing':
        return t('serverFiles.upload.hashing', '正在校验文件哈希...');
      case 'uploading': {
        const concurrencyInfo =
          progress.concurrency && progress.concurrency > 1
            ? ` · ${progress.concurrency} 并发`
            : '';
        return (
          t(
            'serverFiles.upload.uploadingChunks',
            '正在传输分片 ({{current}} / {{total}})...',
            {
              current: progress.currentChunk,
              total: progress.totalChunks,
            },
          ) + concurrencyInfo
        );
      }
      case 'merging':
        return t('serverFiles.upload.merging', '分片传输完成，服务端正在流式合并文件...');
      case 'completed':
        return progress.isExisting
          ? t('serverFiles.upload.instantDone', '秒传完成（云端已存在完全一致的文件）')
          : t('serverFiles.upload.uploadSuccess', '文件上传并合并成功！');
      default:
        return t('serverFiles.upload.preparing', '准备就绪...');
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  return (
    <Modal
      open={open}
      title={
        isBatchMode
          ? t('serverFiles.upload.batchTitle', '批量文件上传')
          : t('serverFiles.upload.progressTitle', '文件分片上传')
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {!isBatchAllFinished && (
            <Button
              danger
              onClick={() => {
                if (isBatchMode && onCancelAll) {
                  onCancelAll();
                } else if (onCancel) {
                  onCancel();
                }
              }}
            >
              {isBatchMode
                ? t('serverFiles.upload.cancelAll', '取消全部')
                : t('common.actions.cancel', '取消')}
            </Button>
          )}
          {isBatchAllFinished && (
            <Button type="primary" onClick={handleClose}>
              {t('common.actions.close', '关闭')}
            </Button>
          )}
        </div>
      }
      closable={isBatchAllFinished}
      onCancel={handleClose}
      width={isBatchMode ? 620 : 480}
      destroyOnHidden
    >
      <div style={{ padding: '8px 0' }}>
        {isBatchMode && summary && items ? (
          <Space orientation="vertical" style={{ width: '100%' }} size={16}>
            {/* 总体进度 */}
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Typography.Text strong>
                  {t('serverFiles.upload.overallProgress', '总体进度')}: {summary.completedFiles} / {summary.totalFiles}{' '}
                  {t('serverFiles.upload.filesCount', '个文件')}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {formatServerFileSize(summary.uploadedBytes)} / {formatServerFileSize(summary.totalBytes)}
                </Typography.Text>
              </div>
              <Progress
                percent={summary.overallPercent}
                status={isBatchAllFinished ? (summary.failedFiles > 0 ? 'exception' : 'success') : 'active'}
                strokeColor="#3b82f6"
              />
            </div>

            {/* 各任务列表 */}
            <List
              size="small"
              bordered
              dataSource={items}
              style={{ maxHeight: 320, overflowY: 'auto' }}
              renderItem={(item) => (
                <List.Item
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '10px 14px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, marginRight: 8 }}>
                      <Typography.Text strong ellipsis style={{ maxWidth: 260 }} title={item.relativePath ?? item.file.name}>
                        {item.relativePath ?? item.file.name}
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        ({formatServerFileSize(item.totalBytes)})
                      </Typography.Text>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {getItemStatusTag(item)}
                      {(item.status === 'queued' ||
                        item.status === 'hashing' ||
                        item.status === 'uploading' ||
                        item.status === 'merging') && (
                        <Button
                          size="small"
                          type="text"
                          danger
                          icon={<StopOutlined />}
                          onClick={() => onCancelItem?.(item.id)}
                          title={t('common.actions.cancel', '取消')}
                        />
                      )}
                      {(item.status === 'error' || item.status === 'canceled') && (
                        <Button
                          size="small"
                          type="text"
                          icon={<RedoOutlined />}
                          onClick={() => onRetryItem?.(item.id)}
                          title={t('serverFiles.upload.retry', '重试')}
                        />
                      )}
                    </div>
                  </div>

                  {item.status !== 'skipped' && (
                    <Progress
                      percent={item.progressPercent}
                      size="small"
                      status={
                        item.status === 'completed'
                          ? 'success'
                          : item.status === 'error'
                            ? 'exception'
                            : item.status === 'canceled'
                              ? 'normal'
                              : 'active'
                      }
                      strokeColor="#3b82f6"
                      showInfo={false}
                    />
                  )}
                </List.Item>
              )}
            />
          </Space>
        ) : (
          /* 单文件回退模式 */
          <Space orientation="vertical" style={{ width: '100%' }} size={14}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography.Text strong ellipsis style={{ maxWidth: 300 }}>
                {fileName}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {progress
                  ? `${formatServerFileSize(progress.uploadedBytes)} / ${formatServerFileSize(
                      progress.totalBytes,
                    )}`
                  : '—'}
              </Typography.Text>
            </div>

            <Progress
              percent={progress?.percent ?? 0}
              status={progress?.phase === 'completed' ? 'success' : 'active'}
              strokeColor="#3b82f6"
            />

            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {getSinglePhaseText()}
            </Typography.Text>
          </Space>
        )}
      </div>
    </Modal>
  );
}
