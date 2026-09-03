import type { GatewayClient } from '@meshcentral/control-client';
import type { Device, DeviceGroup } from '@meshcentral/shared-state';
import { Form, Input, Modal, Select, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';

interface DeviceEditModalProps {
  device: Device | null;
  groups: DeviceGroup[];
  client?: GatewayClient;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

interface DeviceEditValues {
  name: string;
  desc?: string;
  tags?: string[];
  groupId?: string;
}

function rawString(device: Device, key: string) {
  const raw = device.raw as Record<string, unknown> | undefined;
  const value = raw?.[key];
  return typeof value === 'string' ? value : undefined;
}

function deviceTags(device: Device): string[] {
  const raw = device.raw as Record<string, unknown> | undefined;
  if (Array.isArray(raw?.tags)) return raw.tags.filter((tag): tag is string => typeof tag === 'string');
  if (typeof raw?.tags === 'string') return raw.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function formValues(device: Device): DeviceEditValues {
  return {
    name: device.name,
    desc: rawString(device, 'desc') ?? rawString(device, 'description') ?? '',
    tags: deviceTags(device),
    groupId: device.groupId,
  };
}

export function DeviceEditModal({ device, groups, client, onClose, onSaved }: DeviceEditModalProps) {
  const [form] = Form.useForm<DeviceEditValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [submitting, setSubmitting] = useState(false);
  const initialValues = useMemo(() => (device ? formValues(device) : undefined), [device]);

  useEffect(() => {
    if (!device) return;
    form.resetFields();
    form.setFieldsValue(formValues(device));
  }, [device, form]);

  const submit = async () => {
    if (!device || !client) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await client.devices.update(device.id, {
        name: values.name.trim(),
        desc: values.desc?.trim() ?? '',
        tags: values.tags ?? [],
        groupId: values.groupId,
      });
      await onSaved();
      void messageApi.success(`已更新「${device.name}」`);
      onClose();
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误';
      void messageApi.error(`更新设备失败：${detail}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {messageContextHolder}
      <Modal
        title="编辑设备"
        open={Boolean(device)}
        onCancel={onClose}
        onOk={() => void submit()}
        okText="保存修改"
        cancelText="取消"
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={initialValues}>
          <Form.Item name="name" label="设备名称" rules={[{ required: true, whitespace: true, message: '请输入设备名称' }]}>
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="desc" label="描述">
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" tokenSeparators={[',']} placeholder="输入标签后按回车" />
          </Form.Item>
          <Form.Item name="groupId" label="所属分组">
            <Select allowClear placeholder="请选择分组" options={groups.map((group) => ({ value: group.id, label: group.name }))} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
