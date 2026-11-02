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
import {
  Button,
  Empty,
  List,
  Progress,
  Space,
  Spin,
  Tag,
  Typography,
  message,
  theme,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { formatServerFileSize } from './serverFileViewModel';
import type {
  BatchUploadItem,
  BatchUploadSummary,
} from './chunkUploadService';
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
  const { token } = theme.useToken();
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
        const { files, exceededMaxLimit } = await scanFilesFromDataTransfer(
          event.dataTransfer,
        );
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

  return (
    <ConsoleDrawer
      open={open}
      title={t('serverFiles.upload.drawerTitle', '上传文件与文件夹')}
      placement="right"
      onClose={onClose}
      destroyOnHidden={false}
      footer={
        <div className="console-drawer-actions">
          <Button onClick={onClose}>{t('common.actions.cancel', '取消')}</Button>
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
        {/* 隐藏的 input 输入控件 */}
        <input
          ref={fileInputRef}
          hidden
          type="file"
          multiple
          onChange={handleFileInputChange}
        />

        {/* 拖拽投放卡片区域 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!isDraggingOverBox) setIsDraggingOverBox(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDraggingOverBox(false);
          }}
          onDrop={handleDropOnBox}
          style={{
            border: `1.5px dashed ${isDraggingOverBox ? token.colorPrimary : token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            padding: '24px 16px',
            textAlign: 'center',
            backgroundColor: isDraggingOverBox ? token.colorPrimaryBg : token.colorFillAlter,
            boxShadow: isDraggingOverBox ? `0 0 0 3px ${token.colorPrimaryBorder}` : 'none',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
          }}
        >
          {scanning ? (
            <div style={{ padding: '24px 0' }}>
              <Spin tip={t('serverFiles.upload.scanningFiles', '正在递归解析文件与文件夹...')} />
            </div>
          ) : (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  margin: '0 auto',
                  borderRadius: '50%',
                  backgroundColor: token.colorPrimaryBg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <InboxOutlined style={{ fontSize: 28, color: token.colorPrimary }} />
              </div>
              <div>
                <Typography.Text strong style={{ fontSize: 15 }}>
                  {t('serverFiles.upload.dragPrompt', '拖拽文件或文件夹到此处')}
                </Typography.Text>
                <div style={{ marginTop: 2 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {t(
                      'serverFiles.upload.dragPromptSub',
                      '支持批量拖入任意多个文件或多层嵌套文件夹',
                    )}
                  </Typography.Text>
                </div>
              </div>

              <div style={{ marginTop: 4 }}>
                <Space size={12}>
                  <Button
                    type="primary"
                    ghost
                    icon={<FileOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    {t('serverFiles.upload.selectFiles', '选择文件')}
                  </Button>
                </Space>
              </div>
            </Space>
          )}
        </div>

        {/* 1Panel 风格的文件面板：统计栏与文件列表合并 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 360,
            minWidth: 0,
            borderRadius: token.borderRadius,
            border: `1px solid ${token.colorBorderSecondary}`,
            backgroundColor: token.colorFillAlter,
            overflow: 'hidden',
          }}
        >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            minHeight: 46,
            padding: '10px 14px',
            background: token.colorFillQuaternary,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isUploading && uploadSummary ? (
              <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
                {t('serverFiles.upload.overallProgress', '上传进度')}：
                {uploadSummary.completedFiles} / {uploadSummary.totalFiles}
                <span style={{ color: token.colorPrimary, marginLeft: 8 }}>
                  {uploadSummary.overallPercent}%
                </span>
              </Typography.Text>
            ) : totalFiles > 0 ? (
              <>
                <Typography.Text style={{ fontSize: 13, fontWeight: 500 }}>
                  {t('serverFiles.upload.stagedSummary', '待上传：{{count}} 个文件', {
                    count: totalFiles,
                  })}
                </Typography.Text>
                {directoryCount > 0 && (
                  <Tag
                    bordered={false}
                    color="blue"
                    style={{ margin: 0, fontSize: 11, padding: '0 6px' }}
                  >
                    {t('serverFiles.upload.directoryCount', '涉及 {{count}} 个子目录', {
                      count: directoryCount,
                    })}
                  </Tag>
                )}
                <span
                  style={{
                    color: token.colorPrimary,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  · {formatServerFileSize(totalBytes)}
                </span>
              </>
            ) : (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {t('serverFiles.upload.noFilesStaged', '暂无待上传文件')}
              </Typography.Text>
            )}
          </div>

          {!isUploading && totalFiles > 0 && (
            <Button
              type="link"
              danger
              size="small"
              icon={<ClearOutlined />}
              onClick={handleClearAll}
              style={{ padding: '0 4px', height: 'auto', fontSize: 12 }}
            >
              {t('common.actions.clearAll', '清空清单')}
            </Button>
          )}
        </div>

        {/* 待上传文件列表 */}
        {isUploading ? (
          <List
            size="small"
            dataSource={uploadItems}
            style={{
              flex: 1,
              minHeight: 0,
              maxHeight: 'none',
              overflowY: 'auto',
              border: 0,
              backgroundColor: token.colorFillAlter,
            }}
            renderItem={(item) => {
              const canCancel = ['queued', 'hashing', 'uploading', 'merging'].includes(item.status);
              const canRetry = item.status === 'error' || item.status === 'canceled';
              return (
                <List.Item style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Typography.Text strong ellipsis style={{ minWidth: 0, flex: 1 }} title={item.relativePath ?? item.file.name}>
                      {item.relativePath ?? item.file.name}
                    </Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {item.progressPercent}%
                    </Typography.Text>
                    {canCancel && (
                      <Button type="text" danger size="small" icon={<StopOutlined />} onClick={() => onCancelUploadItem?.(item.id)} />
                    )}
                    {canRetry && (
                      <Button type="text" size="small" icon={<RedoOutlined />} onClick={() => onRetryUploadItem?.(item.id)} />
                    )}
                  </div>
                  <Progress
                    percent={item.progressPercent}
                    size="small"
                    status={item.status === 'completed' ? 'success' : item.status === 'error' ? 'exception' : item.status === 'canceled' ? 'normal' : 'active'}
                    showInfo={false}
                  />
                </List.Item>
              );
            }}
          />
        ) : totalFiles === 0 ? (
          <div
            style={{
              padding: '36px 16px',
              flex: 1,
              textAlign: 'center',
              backgroundColor: 'transparent',
            }}
          >
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  {t(
                    'serverFiles.upload.emptyStagedHint',
                    '请拖拽或选择要上传的文件/文件夹',
                  )}
                </Typography.Text>
              }
              style={{ margin: 0 }}
            />
          </div>
        ) : (
          <List
            size="small"
            dataSource={stagedFiles}
            style={{
              flex: 1,
              minHeight: 0,
              maxHeight: 'none',
              overflowY: 'auto',
              border: 0,
              backgroundColor: token.colorFillAlter,
            }}
            renderItem={(item) => {
              const isNested = item.subPath && item.subPath.length > 0;
              return (
                <List.Item
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: token.borderRadiusSM,
                        backgroundColor: isNested ? 'rgba(231, 173, 69, 0.12)' : token.colorPrimaryBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isNested ? (
                        <FolderOpenOutlined style={{ color: token.colorWarning, fontSize: 15 }} />
                      ) : (
                        <FileOutlined style={{ color: token.colorPrimary, fontSize: 15 }} />
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Typography.Text strong ellipsis style={{ maxWidth: 280, fontSize: 13 }}>
                          {item.file.name}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          ({formatServerFileSize(item.file.size)})
                        </Typography.Text>
                      </div>
                      {isNested && (
                        <div style={{ marginTop: 2 }}>
                          <span
                            style={{
                              fontSize: 11,
                              color: token.colorTextTertiary,
                              backgroundColor: token.colorFillTertiary,
                              padding: '1px 6px',
                              borderRadius: token.borderRadiusSM,
                              display: 'inline-block',
                              maxWidth: 320,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={item.subPath.join('/')}
                          >
                            {item.subPath.join('/')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveItem(item.id)}
                    title={t('common.actions.remove', '移除')}
                  />
                </List.Item>
              );
            }}
          />
        )}
        </div>

      </div>
    </ConsoleDrawer>
  );
}
