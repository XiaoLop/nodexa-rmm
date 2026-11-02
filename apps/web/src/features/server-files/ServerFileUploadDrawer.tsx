import '../../assets/styles/server-file-upload.css';
import { ConsoleDrawer } from '../../components/ui';
import { useRef, useState } from 'react';
import {
  ClearOutlined,
  DeleteOutlined,
  FileOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  RedoOutlined,
  StopOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, Empty, List, Progress, Spin, Tooltip, Tag, Typography, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { formatServerFileSize } from './serverFileViewModel';
import type { BatchUploadItem, BatchUploadSummary } from './chunkUploadService';
import {
  parseFilesFromInput,
  scanFilesFromDataTransfer,
  type StagedUploadFile,
} from './fileDirectoryScanner';

interface ServerFileUploadDrawerProps {
  open: boolean;
  targetPathDisplay: string;
  stagedFiles: StagedUploadFile[];
  onStagedFilesChange: (files: StagedUploadFile[]) => void;
  onClose: () => void;
  onStartUpload: (files: StagedUploadFile[]) => void;
  uploadItems?: BatchUploadItem[];
  uploadSummary?: BatchUploadSummary;
  onCancelUploadItem?: (id: string) => void;
  onRetryUploadItem?: (id: string) => void;
  isScanning?: boolean;
}

export function ServerFileUploadDrawer({
  open,
  targetPathDisplay,
  stagedFiles,
  onStagedFilesChange,
  onClose,
  onStartUpload,
  uploadItems = [],
  uploadSummary,
  onCancelUploadItem,
  onRetryUploadItem,
  isScanning = false,
}: ServerFileUploadDrawerProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOverBox, setIsDraggingOverBox] = useState(false);
  const [internalScanning, setInternalScanning] = useState(false);

  const scanning = isScanning || internalScanning;
  const isUploading = uploadItems.length > 0 && Boolean(uploadSummary);

  // 计算汇总信息
  const totalFiles = stagedFiles.length;
  const totalBytes = stagedFiles.reduce((acc, curr) => acc + curr.file.size, 0);
  const directoryCount = new Set(
    stagedFiles
      .filter((item) => item.subPath && item.subPath.length > 0)
      .map((item) => item.subPath.join('/')),
  ).size;

  const handleAppendFiles = (newFiles: StagedUploadFile[]) => {
    if (newFiles.length === 0) return;

    // 根据相对路径进行去重（后加入的覆盖已有同路径暂存项）
    const map = new Map<string, StagedUploadFile>();
    for (const item of stagedFiles) {
      map.set(item.relativePath, item);
    }
    for (const item of newFiles) {
      map.set(item.relativePath, item);
    }
    onStagedFilesChange(Array.from(map.values()));
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const parsed = parseFilesFromInput(event.target.files);
      handleAppendFiles(parsed);
      event.target.value = '';
    }
  };

  const handleDropOnBox = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOverBox(false);

    if (event.dataTransfer) {
      setInternalScanning(true);
      try {
        const { files, exceededMaxLimit } = await scanFilesFromDataTransfer(event.dataTransfer);
        if (exceededMaxLimit) {
          message.warning(
            t(
              'serverFiles.upload.maxFilesScanned',
              '已达到单次扫描上限（1000个文件），超出部分已被忽略。建议将过大目录打包上传。',
            ),
          );
        }
        handleAppendFiles(files);
      } finally {
        setInternalScanning(false);
      }
    }
  };

  const handleRemoveItem = (id: string) => {
    onStagedFilesChange(stagedFiles.filter((item) => item.id !== id));
  };

  const handleClearAll = () => {
    onStagedFilesChange([]);
  };

  const statusLabels = {
    queued: t('serverFiles.upload.statuses.queued'),
    hashing: t('serverFiles.upload.statuses.hashing'),
    uploading: t('serverFiles.upload.statuses.uploading'),
    merging: t('serverFiles.upload.statuses.merging'),
    completed: t('serverFiles.upload.statuses.completed'),
    skipped: t('serverFiles.upload.statuses.skipped'),
    error: t('serverFiles.upload.statuses.error'),
    canceled: t('serverFiles.upload.statuses.canceled'),
  };

  return (
    <ConsoleDrawer
      open={open}
      title={t('serverFiles.upload.drawerTitle', '上传文件与文件夹')}
      onClose={onClose}
      footer={
        <div className="console-drawer-actions">
          <Button onClick={onClose}>{t('common.actions.close')}</Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            disabled={totalFiles === 0 || scanning}
            onClick={() => onStartUpload(stagedFiles)}
          >
            {totalFiles > 0
              ? t('serverFiles.upload.startUploadWithCount', '开始上传 ({{count}})', {
                  count: totalFiles,
                })
              : t('serverFiles.upload.startUpload', '开始上传')}
          </Button>
        </div>
      }
    >
      <div className="server-upload-content">
        <div className="server-upload-destination">
          <Typography.Text type="secondary">
            {t('serverFiles.upload.destination', '目标路径')}
          </Typography.Text>
          <code title={targetPathDisplay}>{targetPathDisplay}</code>
        </div>
        <input ref={fileInputRef} hidden type="file" multiple onChange={handleFileInputChange} />
        <div
          className={`server-upload-dropzone${isDraggingOverBox ? ' is-dragging' : ''}`}
          aria-busy={scanning}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setIsDraggingOverBox(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!event.currentTarget.contains(event.relatedTarget as Node))
              setIsDraggingOverBox(false);
          }}
          onDrop={handleDropOnBox}
        >
          <Spin spinning={scanning}>
            <div className="server-upload-dropzone-content">
              <span className="server-upload-dropzone-icon">
                <InboxOutlined />
              </span>
              <div>
                <Typography.Text strong>
                  {t('serverFiles.upload.dragPrompt', '拖拽文件或文件夹到此处')}
                </Typography.Text>
                <p>
                  {scanning
                    ? t('serverFiles.upload.scanningFiles', '正在递归解析文件与文件夹...')
                    : t(
                        'serverFiles.upload.dragPromptSub',
                        '支持批量拖入任意多个文件或多层嵌套文件夹',
                      )}
                </p>
              </div>
              <Button
                icon={<FileOutlined />}
                disabled={scanning}
                onClick={() => fileInputRef.current?.click()}
              >
                {t('serverFiles.upload.selectFiles', '选择文件')}
              </Button>
            </div>
          </Spin>
        </div>

        <section className="server-upload-panel" aria-label={t('serverFiles.upload.fileList')}>
          <div className="server-upload-panel-header">
            <div className="server-upload-summary" aria-live="polite">
              {isUploading && uploadSummary ? (
                <Typography.Text strong>
                  {t('serverFiles.upload.overallProgress', '上传进度')}：
                  {uploadSummary.completedFiles} / {uploadSummary.totalFiles}
                </Typography.Text>
              ) : totalFiles > 0 ? (
                <>
                  <Typography.Text strong>
                    {t('serverFiles.upload.stagedSummary', '待上传：{{count}} 个文件', {
                      count: totalFiles,
                    })}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {formatServerFileSize(totalBytes)}
                  </Typography.Text>
                  {directoryCount > 0 && (
                    <Tag>
                      {t('serverFiles.upload.directoryCount', '涉及 {{count}} 个子目录', {
                        count: directoryCount,
                      })}
                    </Tag>
                  )}
                </>
              ) : (
                <Typography.Text type="secondary">
                  {t('serverFiles.upload.noFilesStaged', '暂无待上传文件')}
                </Typography.Text>
              )}
            </div>
            {!isUploading && totalFiles > 0 && (
              <Button
                type="text"
                danger
                size="small"
                icon={<ClearOutlined />}
                onClick={handleClearAll}
              >
                {t('common.actions.clearAll', '清空清单')}
              </Button>
            )}
          </div>
          {isUploading && uploadSummary && (
            <div className="server-upload-overall-progress">
              <Progress
                percent={uploadSummary.overallPercent}
                size="small"
                status={uploadSummary.failedFiles > 0 ? 'exception' : undefined}
              />
            </div>
          )}
          {isUploading ? (
            <List
              className="server-upload-list"
              rowKey="id"
              dataSource={uploadItems}
              renderItem={(item) => {
                const canCancel = ['queued', 'hashing', 'uploading', 'merging'].includes(
                  item.status,
                );
                const canRetry = item.status === 'error' || item.status === 'canceled';
                return (
                  <List.Item className="server-upload-progress-item">
                    <div className="server-upload-file-heading">
                      <Typography.Text
                        strong
                        ellipsis
                        className="server-upload-file-name"
                        title={item.relativePath ?? item.file.name}
                      >
                        {item.relativePath ?? item.file.name}
                      </Typography.Text>
                      <Tag
                        color={
                          item.status === 'error'
                            ? 'error'
                            : item.status === 'completed'
                              ? 'success'
                              : canCancel
                                ? 'processing'
                                : 'default'
                        }
                      >
                        {statusLabels[item.status]}
                      </Tag>
                      {canCancel && onCancelUploadItem && (
                        <Tooltip title={t('common.actions.cancel')}>
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<StopOutlined />}
                            aria-label={t('common.actions.cancel')}
                            onClick={() => onCancelUploadItem(item.id)}
                          />
                        </Tooltip>
                      )}
                      {canRetry && onRetryUploadItem && (
                        <Tooltip title={t('common.actions.retry')}>
                          <Button
                            type="text"
                            size="small"
                            icon={<RedoOutlined />}
                            aria-label={t('common.actions.retry')}
                            onClick={() => onRetryUploadItem(item.id)}
                          />
                        </Tooltip>
                      )}
                    </div>
                    <Progress
                      percent={item.progressPercent}
                      size="small"
                      status={
                        item.status === 'completed'
                          ? 'success'
                          : item.status === 'error'
                            ? 'exception'
                            : 'normal'
                      }
                    />
                    <Typography.Text
                      type={item.error ? 'danger' : 'secondary'}
                      className="server-upload-file-detail"
                    >
                      {item.error ||
                        `${formatServerFileSize(item.uploadedBytes)} / ${formatServerFileSize(item.totalBytes)}`}
                    </Typography.Text>
                  </List.Item>
                );
              }}
            />
          ) : (
            <List
              className="server-upload-list"
              rowKey="id"
              dataSource={stagedFiles}
              locale={{
                emptyText: (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t(
                      'serverFiles.upload.emptyStagedHint',
                      '请拖拽或选择要上传的文件/文件夹',
                    )}
                  />
                ),
              }}
              renderItem={(item) => (
                <List.Item>
                  <span
                    className={`server-upload-file-icon${item.subPath?.length ? ' is-directory' : ''}`}
                  >
                    {item.subPath?.length ? <FolderOpenOutlined /> : <FileOutlined />}
                  </span>
                  <div className="server-upload-file-copy">
                    <div className="server-upload-file-heading">
                      <Typography.Text
                        strong
                        ellipsis
                        className="server-upload-file-name"
                        title={item.file.name}
                      >
                        {item.file.name}
                      </Typography.Text>
                      <Typography.Text type="secondary" className="server-upload-file-size">
                        {formatServerFileSize(item.file.size)}
                      </Typography.Text>
                    </div>
                    {Boolean(item.subPath?.length) && (
                      <span className="server-upload-file-path" title={item.subPath.join('/')}>
                        {item.subPath.join('/')}
                      </span>
                    )}
                  </div>
                  <Tooltip title={t('common.actions.remove', '移除')}>
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      aria-label={t('common.actions.remove', '移除')}
                      onClick={() => handleRemoveItem(item.id)}
                    />
                  </Tooltip>
                </List.Item>
              )}
            />
          )}
        </section>
      </div>
    </ConsoleDrawer>
  );
}
