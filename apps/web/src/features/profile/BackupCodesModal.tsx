import { ConsoleModal } from '../../components/ui';
import {
  CheckOutlined,
  CopyOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Tag, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import type { BackupCode } from './twoFactorManagement';

interface BackupCodesModalProps {
  codes: BackupCode[];
  open: boolean;
  submitting: boolean;
  allCodesCopied: boolean;
  copiedCodeIndex: number | null;
  onCancel: () => void;
  onCopyAll: () => void;
  onCopyCode: (code: number, index: number) => void;
  onDisable: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
}

export function BackupCodesModal({
  codes,
  open,
  submitting,
  allCodesCopied,
  copiedCodeIndex,
  onCancel,
  onCopyAll,
  onCopyCode,
  onDisable,
  onDownload,
  onRegenerate,
}: BackupCodesModalProps) {
  const { t } = useTranslation();
  const availableCount = codes.filter((code) => code.unused).length;
  const usedCount = codes.length - availableCount;

  return (
    <ConsoleModal
      title={t('profile.security.management.backupCodesTitle')}
      open={open}
      onCancel={onCancel}
      variant="form"
      className="profile-backup-codes-modal"
      footer={
        <div className="profile-backup-codes-footer">
          <Button onClick={onRegenerate} loading={submitting}>
            {t('profile.security.management.regenerate')}
          </Button>
          <Button danger onClick={onDisable} loading={submitting}>
            {t('profile.security.management.disableBackupCodesBtn')}
          </Button>
        </div>
      }
    >
      <div className="profile-backup-codes-container">
        {codes.length > 0 && availableCount === 0 ? (
          <Alert
            type="error"
            showIcon
            message={t('profile.security.management.allCodesUsedWarning')}
            className="profile-backup-codes-alert"
          />
        ) : (
          <Alert
            type="warning"
            showIcon
            message={t('profile.security.management.backupCodesNotice')}
            className="profile-backup-codes-alert"
          />
        )}

        <div className="profile-backup-codes-toolbar">
          <div className="profile-backup-codes-toolbar-stats">
            <Tag
              color={availableCount > 0 ? 'success' : 'error'}
              className="profile-backup-codes-tag"
            >
              {t('profile.security.management.backupCodesAvailable', {
                count: availableCount,
              })}
            </Tag>
            {usedCount > 0 ? (
              <Tag className="profile-backup-codes-tag">
                {t('profile.security.management.backupCodesUsed', { count: usedCount })}
              </Tag>
            ) : null}
          </div>

          <div className="profile-backup-codes-toolbar-actions">
            <Button
              size="small"
              icon={
                allCodesCopied ? (
                  <CheckOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <CopyOutlined />
                )
              }
              onClick={onCopyAll}
              disabled={availableCount === 0}
            >
              {allCodesCopied
                ? t('profile.security.management.copiedAllCodes')
                : t('profile.security.management.copyAllCodes')}
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              onClick={onDownload}
              disabled={codes.length === 0}
            >
              {t('profile.security.management.downloadCodes')}
            </Button>
          </div>
        </div>

        <div className="profile-backup-codes-grid">
          {codes.map((backupCode, index) => {
            const rawCode = String(backupCode.code).padStart(8, '0');
            const formatted = `${rawCode.slice(0, 4)} ${rawCode.slice(4)}`;
            const isCopied = copiedCodeIndex === index;
            return (
              <div
                key={`${backupCode.code}-${index}`}
                className={`profile-backup-code-card ${backupCode.unused ? 'is-available' : 'is-used'}`}
              >
                <span className="profile-backup-code-index">
                  #{String(index + 1).padStart(2, '0')}
                </span>
                <code className="profile-backup-code-text" title={rawCode}>
                  {formatted}
                </code>
                <div className="profile-backup-code-action">
                  {backupCode.unused ? (
                    <Tooltip
                      title={
                        isCopied
                          ? t('profile.security.management.copiedSingleCode', {
                              code: formatted,
                            })
                          : t('profile.security.management.copySingleCode')
                      }
                    >
                      <Button
                        type="text"
                        size="small"
                        className="profile-backup-code-copy-btn"
                        icon={
                          isCopied ? (
                            <CheckOutlined style={{ color: '#52c41a' }} />
                          ) : (
                            <CopyOutlined />
                          )
                        }
                        onClick={() => onCopyCode(backupCode.code, index)}
                      />
                    </Tooltip>
                  ) : (
                    <Tag className="profile-backup-code-used-tag" bordered={false}>
                      {t('profile.security.management.codeStatusUsed')}
                    </Tag>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ConsoleModal>
  );
}