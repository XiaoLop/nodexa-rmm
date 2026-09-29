import { Alert, Form, Input, Modal } from 'antd';
import type { FormInstance } from 'antd';
import { useTranslation } from 'react-i18next';

export interface PasswordFormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface PasswordChangeModalProps {
  form: FormInstance<PasswordFormValues>;
  open: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export function PasswordChangeModal({
  form,
  open,
  submitting,
  onCancel,
  onSubmit,
}: PasswordChangeModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      title={t('profile.password.title')}
      open={open}
      okText={t('profile.password.submit')}
      cancelText={t('common.actions.cancel')}
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={onSubmit}
      destroyOnHidden
    >
      <Alert type="warning" showIcon message={t('profile.password.notice')} />
      <Form form={form} layout="vertical" className="profile-password-form">
        <Form.Item
          name="currentPassword"
          label={t('profile.password.current')}
          rules={[{ required: true, message: t('profile.validation.currentPasswordRequired') }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label={t('profile.password.new')}
          rules={[{ required: true, message: t('profile.validation.newPasswordRequired') }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label={t('profile.password.confirm')}
          dependencies={['newPassword']}
          rules={[
            { required: true, message: t('profile.validation.confirmPasswordRequired') },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue('newPassword') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('profile.validation.passwordMismatch')));
              },
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
      </Form>
    </Modal>
  );
}