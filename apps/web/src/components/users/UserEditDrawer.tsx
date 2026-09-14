import { DeleteOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import type { ManagedUser, UserUpdate } from '@meshcentral/control-client';
import { Avatar, Button, Drawer, Form, Input, Space, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { useEffect, useState } from 'react';

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

const MAX_AVATAR_SIZE = 2 * 1024 * 1024;

export function UserEditDrawer({ user, submitting, onClose, onSubmit }: UserEditDrawerProps) {
  const [form] = Form.useForm<UserUpdate>();
  const [image, setImage] = useState<string>();

  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        email: user.email ?? '',
        realName: user.realName ?? '',
        phone: user.phone ?? '',
      });
      setImage(user.image);
    } else {
      form.resetFields();
      setImage(undefined);
    }
  }, [form, user]);

  const beforeAvatarUpload: UploadProps['beforeUpload'] = (file) => {
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      void message.error('请选择 JPG、PNG、GIF 或 WebP 图片。');
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      void message.error('头像图片不能超过 2 MB。');
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setImage(reader.result);
    };
    reader.onerror = () => void message.error('读取头像图片失败。');
    reader.readAsDataURL(file);
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
    await onSubmit({ updates, image: image !== user.image ? image : undefined });
  };

  return (
    <Drawer
      title={user ? `编辑 ${user.name}` : '编辑用户'}
      open={Boolean(user)}
      width="min(520px, 100vw)"
      onClose={onClose}
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            loading={submitting}
            onClick={() => void submit().catch(() => undefined)}
          >
            保存修改
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item label="头像">
          <div className="user-edit-avatar-field">
            <Avatar size={72} src={image} icon={<UserOutlined />} />
            <Space wrap>
              <Upload
                accept="image/jpeg,image/png,image/gif,image/webp"
                beforeUpload={beforeAvatarUpload}
                maxCount={1}
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />}>选择图片</Button>
              </Upload>
              {image !== user?.image ? (
                <Button icon={<DeleteOutlined />} onClick={() => setImage(user?.image)}>
                  恢复当前头像
                </Button>
              ) : null}
            </Space>
          </div>
        </Form.Item>
        <Form.Item label="用户名">
          <Input value={user?.name} disabled />
        </Form.Item>
        <Form.Item name="email" label="邮箱">
          <Input type="email" maxLength={256} />
        </Form.Item>
        <Form.Item name="realName" label="真实姓名">
          <Input maxLength={256} />
        </Form.Item>
        <Form.Item name="phone" label="电话">
          <Input maxLength={64} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
