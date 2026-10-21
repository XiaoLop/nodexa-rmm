import type { UserGroup } from '@meshcentral/control-client';
import { Form, Input, Modal } from 'antd';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export interface EditUserGroupValues {
  name: string;
  description?: string;
}

interface EditUserGroupModalProps {
  open: boolean;
  group: UserGroup;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (values: EditUserGroupValues) => Promise<boolean>;
}

export function EditUserGroupModal({
  open,
  group,
  submitting,
  onClose,
  onSubmit,
}: EditUserGroupModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<EditUserGroupValues>();

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ name: group.name, description: group.description });
  }, [form, group, open]);

  return (
    <Modal
      title={t('userGroups.details.modals.editTitle')}
      open={open}
      onCancel={onClose}
      onOk={() =>
        void form.validateFields().then(async (values) => {
          const succeeded = await onSubmit(values);
          if (succeeded) onClose();
        })
      }
      confirmLoading={submitting}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t('userGroups.modal.name')}
          name="name"
          rules={[
            { required: true, whitespace: true, message: t('userGroups.modal.nameRequired') },
            { max: 128, message: t('userGroups.details.validation.nameMax') },
          ]}
        >
          <Input showCount maxLength={128} />
        </Form.Item>
        <Form.Item
          label={t('userGroups.modal.description')}
          name="description"
          rules={[{ max: 1024, message: t('userGroups.details.validation.descriptionMax') }]}
        >
          <Input.TextArea
            rows={4}
            showCount
            maxLength={1024}
            placeholder={t('userGroups.details.modals.descriptionPlaceholder')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
