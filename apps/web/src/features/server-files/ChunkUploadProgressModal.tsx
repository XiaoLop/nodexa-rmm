import { Modal, Progress, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatServerFileSize } from './serverFileViewModel';
import type { ChunkUploadProgress } from './chunkUploadService';

interface ChunkUploadProgressModalProps {
  open: boolean;
  fileName: string;
  progress?: ChunkUploadProgress;
  onCancel?: () => void;
}

export function ChunkUploadProgressModal({
  open,
  fileName,
  progress,
  onCancel,
}: ChunkUploadProgressModalProps) {
  const { t } = useTranslation();

  const getPhaseText = () => {
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

  return (
    <Modal
      open={open}
      title={t('serverFiles.upload.progressTitle', '文件分片上传')}
      footer={null}
      closable={progress?.phase === 'completed'}
      onCancel={onCancel}
      width={480}
      destroyOnHidden
    >
      <div style={{ padding: '16px 0' }}>
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
            {getPhaseText()}
          </Typography.Text>
        </Space>
      </div>
    </Modal>
  );
}
