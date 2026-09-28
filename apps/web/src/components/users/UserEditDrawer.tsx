import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import type { ManagedUser, UserUpdate } from '@meshcentral/control-client';
import { Button, Drawer, Form, Input, Space, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AVATAR_MIME_TYPES,
  MAX_AVATAR_FILE_SIZE,
  prepareAvatarImage,
} from '../../utils/avatarImage';
import { UserAvatar } from './UserAvatar';

export interface UserEditSubmission {
  updates: UserUpdate;
  image?: string;
}

interface UserEditDrawerProps {
  user?: ManagedUser;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (submission: UserEditSubmission) => Promise<void>;
}

export function UserEditDrawer({ user, submitting, onClose, onSubmit }: UserEditDrawerProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<UserUpdate>();
  const [image, setImage] = useState<string>();

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        email: user.email ?? '',
        realName: user.realName ?? '',
        phone: user.phone ?? '',
      });
      setImage(undefined);
    } else {
      setImage(undefined);
    }
  }, [form, user]);

  const beforeAvatarUpload: UploadProps['beforeUpload'] = (file) => {
    if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
      void message.error(t('users.editDrawer.invalidImageType'));
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      void message.error(t('users.editDrawer.avatarTooLarge'));
      return Upload.LIST_IGNORE;
    }
    void prepareAvatarImage(file).then(setImage, () => {
      void message.error(t('users.editDrawer.readAvatarFailed'));
    });
    return false;
  };

  const submit = async () => {
    if (!user) return;
    const values = await form.validateFields();
    const updates: UserUpdate = {};
    const email = values.email?.trim() ?? '';
    const realName = values.realName?.trim() ?? '';
    const phone = values.phone?.trim() ?? '';
    if (email !== (user.email ?? '')) updates.email = email;
    if (realName !== (user.realName ?? '')) updates.realName = realName;
    if (phone !== (user.phone ?? '')) updates.phone = phone;
    await onSubmit({ updates, image });
  };

  return (
    <Drawer
      title={user ? t('users.editDrawer.title', { name: user.name }) : t('users.editDrawer.titleDefault')}
      open={Boolean(user)}
      size="min(520px, 100vw)"
      onClose={onClose}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>{t('common.actions.cancel')}</Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={() => void submit().catch(() => undefined)}
          >
            {t('common.actions.save')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item label={t('users.editDrawer.avatar')}>
          <div className="user-edit-avatar-field">
            <UserAvatar
              size={72}
              username={user?.name}
              src={image ?? user?.image}
              hasImage={Boolean(image || user?.image || user?.hasImage)}
            />
            <Space wrap>
              <Upload
                accept="image/jpeg,image/png,image/gif,image/webp"
                beforeUpload={beforeAvatarUpload}
                maxCount={1}
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />}>{t('users.editDrawer.selectImage')}</Button>
              </Upload>
              {image ? (
                <Button icon={<DeleteOutlined />} onClick={() => setImage(undefined)}>
                  {t('users.editDrawer.restoreAvatar')}
                </Button>
              ) : null}
            </Space>
          </div>
        </Form.Item>
        <Form.Item label={t('users.editDrawer.username')}>
          <Input value={user?.name} disabled />
        </Form.Item>
        <Form.Item name="email" label={t('users.editDrawer.email')}>
          <Input type="email" maxLength={256} />
        </Form.Item>
        <Form.Item name="realName" label={t('users.editDrawer.realName')}>
          <Input maxLength={256} />
        </Form.Item>
        <Form.Item name="phone" label={t('users.editDrawer.phone')}>
          <Input maxLength={64} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
