import type { MeshCentralClient, ServerInfo, UserInfo } from '@meshcentral/control-client';
import type { Device, DeviceGroup } from '@meshcentral/shared-state';
import { Form, Input, Modal, Select, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  classifyDeviceGroupMoves,
  manageableTargetGroups,
} from '../features/permissions/deviceGroupMoves';

interface DeviceEditModalProps {
  device: Device | null;
  groups: DeviceGroup[];
  client?: MeshCentralClient;
  userInfo?: UserInfo;
  serverInfo?: ServerInfo;
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

export function DeviceEditModal({
  device,
  groups,
  client,
  userInfo,
  serverInfo,
  onClose,
  onSaved,
}: DeviceEditModalProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<DeviceEditValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [submitting, setSubmitting] = useState(false);
  const initialValues = useMemo(() => (device ? formValues(device) : undefined), [device]);
  const targetGroups = useMemo(
    () => manageableTargetGroups(groups, userInfo, serverInfo),
    [groups, serverInfo, userInfo],
  );
  const groupOptions = useMemo(() => {
    if (!device?.groupId) return targetGroups;
    const currentGroup = groups.find((group) => group.id === device.groupId);
    return currentGroup && !targetGroups.some((group) => group.id === currentGroup.id)
      ? [currentGroup, ...targetGroups]
      : targetGroups;
  }, [device?.groupId, groups, targetGroups]);

  useEffect(() => {
    if (!device) return;
    form.resetFields();
    form.setFieldsValue(formValues(device));
  }, [device, form]);

  const submit = async () => {
    if (!device || !client) return;
    try {
      const values = await form.validateFields();
      if (device.groupId) {
        const sourceCheck = classifyDeviceGroupMoves({
          devices: [device],
          groups,
          targetGroupId: device.groupId,
          userInfo,
          serverInfo,
        });
        const canManageSource = sourceCheck.sameTarget.length === 1 && targetGroups.some(
          (group) => group.id === device.groupId,
        );
        if (!canManageSource) {
          void messageApi.error(t('devices.editModal.permissionDenied'));
          return;
        }
      }
      if (values.groupId && values.groupId !== device.groupId) {
        const moveCheck = classifyDeviceGroupMoves({
          devices: [device],
          groups,
          targetGroupId: values.groupId,
          userInfo,
          serverInfo,
        });
        if (moveCheck.allowed.length !== 1) {
          void messageApi.error(t('devices.editModal.movePermissionDenied'));
          return;
        }
      }
      setSubmitting(true);
      await client.devices.update(device.id, {
        name: values.name.trim(),
        desc: values.desc?.trim() ?? '',
        tags: values.tags ?? [],
        groupId: values.groupId,
      });
      await onSaved();
      void messageApi.success(t('devices.editModal.success', { name: device.name }));
      onClose();
    } catch (error) {
      const detail = error instanceof Error ? error.message : t('common.status.unknown');
      void messageApi.error(t('devices.editModal.failed', { detail }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {messageContextHolder}
      <Modal
        title={t('devices.editModal.title')}
        open={Boolean(device)}
        onCancel={onClose}
        onOk={() => void submit()}
        okText={t('common.actions.save')}
        cancelText={t('common.actions.cancel')}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={initialValues}>
          <Form.Item
            name="name"
            label={t('devices.editModal.name')}
            rules={[{ required: true, whitespace: true, message: t('devices.editModal.nameRequired') }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="desc" label={t('devices.editModal.desc')}>
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
          <Form.Item name="tags" label={t('devices.editModal.tags')}>
            <Select mode="tags" tokenSeparators={[',']} placeholder={t('devices.editModal.tagsPlaceholder')} />
          </Form.Item>
          <Form.Item name="groupId" label={t('devices.editModal.group')}>
            <Select
              allowClear
              placeholder={t('devices.editModal.groupPlaceholder')}
              options={groupOptions.map((group) => ({ value: group.id, label: group.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
