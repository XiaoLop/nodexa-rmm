import type { ManagedUser, UserUpdate } from '@meshcentral/control-client';
import { Button, Drawer, Form, Input, Space } from 'antd';
import { useEffect } from 'react';

interface UserEditDrawerProps {
  user?: ManagedUser;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (updates: UserUpdate) => Promise<void>;
}

export function UserEditDrawer({ user, submitting, onClose, onSubmit }: UserEditDrawerProps) {
  const [form] = Form.useForm<UserUpdate>();

  useEffect(() => {
    if (user) {
      form.setFieldsValue({ email: user.email, realName: user.realName, phone: user.phone });
    } else {
      form.resetFields();
    }
  }, [form, user]);

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
    await onSubmit(updates);
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
