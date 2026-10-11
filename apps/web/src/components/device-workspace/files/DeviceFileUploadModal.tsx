import {
  ClearOutlined,
  DeleteOutlined,
  FileOutlined,
  FolderOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import { Button, Modal, Radio, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BatchUploadFileItem } from '../../../features/batch-upload/types';
import { formatFileSize } from './fileViewModel';

interface DeviceFileUploadModalProps {
  open: boolean;
  targetDirectory: string;
  files: BatchUploadFileItem[];
  onClose: () => void;
  onConfirm: (
    files: BatchUploadFileItem[],
    options: { overwritePolicy: 'skip' | 'overwrite' },
  ) => void;
}

export function DeviceFileUploadModal({
  open,
  targetDirectory,
  files,
  onClose,
  onConfirm,
}: DeviceFileUploadModalProps) {
  const { t } = useTranslation();
  const [fileList, setFileList] = useState<BatchUploadFileItem[]>([]);
  const [overwritePolicy, setOverwritePolicy] = useState<'skip' | 'overwrite'>('overwrite');

  useEffect(() => {
    if (open) {
      setFileList(files);
      setOverwritePolicy('overwrite');
    }
  }, [open, files]);

  const removeFile = (indexToRemove: number) => {
    setFileList((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const clearAll = () => {
    setFileList([]);
  };

  const totalBytes = fileList.reduce((acc, item) => acc + item.file.size, 0);

  const handleConfirm = () => {
    if (fileList.length === 0) return;
    onConfirm(fileList, { overwritePolicy });
    onClose();
  };

  return (
    <Modal
      open={open}
      title={
        <Space>
          <UploadOutlined />
          <span>{t('deviceWorkspace.files.uploadModalTitle')}</span>
        </Space>
      }
      width={640}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('common.actions.cancel')}
        </Button>,
        <Button
          key="confirm"
          type="primary"
          icon={<UploadOutlined />}
          disabled={fileList.length === 0}
          onClick={handleConfirm}
        >
          {t('deviceWorkspace.files.confirmUpload')}
        </Button>,
      ]}
    >
      <div className="device-file-upload-modal">
        <div className="device-file-upload-header">
          <div className="device-file-upload-meta-item">
            <Typography.Text type="secondary" className="meta-label">
              {t('deviceWorkspace.files.targetDirectory')}：
            </Typography.Text>
            <Typography.Text code ellipsis={{ tooltip: targetDirectory || t('deviceWorkspace.files.root') }}>
              {targetDirectory || t('deviceWorkspace.files.root')}
            </Typography.Text>
          </div>
          <div className="device-file-upload-meta-item">
            <Typography.Text type="secondary" className="meta-label">
              {t('deviceWorkspace.files.overwritePolicy')}：
            </Typography.Text>
            <Radio.Group
              size="small"
              value={overwritePolicy}
              onChange={(e) => setOverwritePolicy(e.target.value)}
            >
              <Radio value="overwrite">{t('deviceWorkspace.files.policyOverwrite')}</Radio>
              <Radio value="skip">{t('deviceWorkspace.files.policySkip')}</Radio>
            </Radio.Group>
          </div>
        </div>

        <div className="device-file-upload-list-section">
          <div className="device-file-upload-list-header">
            <Typography.Text strong>
              {t('deviceWorkspace.files.fileCountInfo', {
                count: fileList.length,
                size: formatFileSize(totalBytes),
              })}
            </Typography.Text>
            {fileList.length > 0 && (
              <Button
                type="link"
                danger
                size="small"
                icon={<ClearOutlined />}
                onClick={clearAll}
              >
                {t('deviceWorkspace.files.clearAll')}
              </Button>
            )}
          </div>

          <div className="device-file-upload-list">
            {fileList.length === 0 ? (
              <div className="device-file-upload-empty">
                <Typography.Text type="secondary">
                  {t('deviceWorkspace.files.noFilesSelected')}
                </Typography.Text>
              </div>
            ) : (
              fileList.map((item, index) => {
                const hasSubDir = item.relativePath.includes('/') || item.relativePath.includes('\\');
                return (
                  <div key={`${item.relativePath}-${index}`} className="device-file-upload-item">
                    <div className="device-file-item-info">
                      {hasSubDir ? (
                        <FolderOutlined className="device-file-icon" />
                      ) : (
                        <FileOutlined className="device-file-icon" />
                      )}
                      <Typography.Text
                        ellipsis={{ tooltip: item.relativePath }}
                        className="device-file-name"
                      >
                        {item.relativePath}
                      </Typography.Text>
                    </div>
                    <div className="device-file-item-meta">
                      <span className="device-file-size">{formatFileSize(item.file.size)}</span>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => removeFile(index)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
