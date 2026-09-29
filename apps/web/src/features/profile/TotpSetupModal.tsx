import { CheckOutlined, CopyOutlined, KeyOutlined, SafetyOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Tooltip } from 'antd';
import type { FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import type { TotpSetup } from './twoFactorManagement';

interface TotpSetupModalProps {
  form: FormInstance<{ token: string }>;
  open: boolean;
  setup?: TotpSetup;
  submitting: boolean;
  secretCopied: boolean;
  onCancel: () => void;
  onCopySecret: (secret: string) => void;
  onSubmit: () => void;
}

function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

export function TotpSetupModal({
  form,
  open,
  setup,
  submitting,
  secretCopied,
  onCancel,
  onCopySecret,
  onSubmit,
}: TotpSetupModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      title={
        <div className="profile-totp-modal-title">
          <span className="profile-totp-modal-icon">
            <SafetyOutlined />
          </span>
          <span>{t('profile.security.management.totpTitle')}</span>
        </div>
      }
      open={open}
      okText={t('profile.security.management.confirmTotp')}
      cancelText={t('common.actions.cancel')}
      confirmLoading={submitting}
      width={500}
      className="profile-totp-modal"
      onCancel={onCancel}
      onOk={onSubmit}
      destroyOnHidden
    >
      {setup ? (
        <div className="profile-totp-setup">
          <div className="profile-totp-step">
            <div className="profile-totp-step-header">
              <span className="profile-totp-step-badge">1</span>
              <div className="profile-totp-step-meta">
                <h4>{t('profile.security.management.totpStepScan')}</h4>
                <p>{t('profile.security.management.totpStepScanDesc')}</p>
              </div>
            </div>

            <div className="profile-totp-qr-wrapper">
              <div className="profile-totp-qr-box">
                <QRCodeSVG value={setup.url} size={152} level="M" />
              </div>
            </div>

            <div className="profile-totp-manual-entry">
              <div className="profile-totp-manual-label">
                {t('profile.security.management.totpManualKey')}
              </div>
              <div className="profile-totp-secret-card">
                <KeyOutlined className="profile-totp-key-icon" />
                <code className="profile-totp-secret-text" title={setup.secret}>
                  {formatSecret(setup.secret)}
                </code>
                <Tooltip
                  title={
                    secretCopied
                      ? t('profile.security.management.totpCopiedSecret')
                      : t('profile.security.management.totpCopySecret')
                  }
                >
                  <Button
                    type="text"
                    size="small"
                    className="profile-totp-copy-btn"
                    icon={
                      secretCopied ? (
                        <CheckOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <CopyOutlined />
                      )
                    }
                    onClick={() => onCopySecret(setup.secret)}
                  >
                    {secretCopied
                      ? t('profile.security.management.totpCopiedSecret')
                      : t('profile.security.management.totpCopySecret')}
                  </Button>
                </Tooltip>
              </div>
            </div>
          </div>

          <div className="profile-totp-divider" />

          <div className="profile-totp-step">
            <div className="profile-totp-step-header">
              <span className="profile-totp-step-badge">2</span>
              <div className="profile-totp-step-meta">
                <h4>{t('profile.security.management.totpStepVerify')}</h4>
                <p>{t('profile.security.management.totpStepVerifyDesc')}</p>
              </div>
            </div>

            <Form
              form={form}
              layout="vertical"
              className="profile-totp-verify-form"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSubmit();
                }
              }}
            >
              <Form.Item
                name="token"
                rules={[
                  {
                    required: true,
                    message: t('profile.security.management.totpCodeRequired'),
                  },
                  {
                    pattern: /^\d{6}$/,
                    message: t('profile.security.management.totpCodeInvalid'),
                  },
                ]}
                className="profile-totp-otp-item"
              >
                <Input.OTP length={6} size="large" className="profile-totp-otp-input" />
              </Form.Item>
            </Form>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}