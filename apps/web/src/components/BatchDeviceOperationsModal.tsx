import {
  RetweetOutlined,
} from '@ant-design/icons';
import type { BatchDeviceResult, GatewayClient } from '@meshcentral/control-client';
import type { Device, DeviceGroup } from '@meshcentral/shared-state';
import { Alert, Button, Modal, Select, Space, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BatchDeviceOperationsModalProps {
  open: boolean;
  devices: Device[];
  groups: DeviceGroup[];
  client?: GatewayClient;
  connected: boolean;
  onClose: () => void;
  onCompleted: (successfulDeviceIds: string[]) => void;
}

const resultColors: Record<BatchDeviceResult['status'], string> = {
  queued: 'default',
  running: 'processing',
  submitted: 'processing',
  succeeded: 'success',
  failed: 'error',
  skipped: 'warning',
};

export function BatchDeviceOperationsModal({

  open,
  devices,
  groups,
  client,
  connected,
  onClose,
  onCompleted,
}: BatchDeviceOperationsModalProps) {
  const { t } = useTranslation();
  const [targetGroupId, setTargetGroupId] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BatchDeviceResult[]>();

  useEffect(() => {
    if (!open) return;
    setTargetGroupId(undefined);
    setSubmitting(false);
    setResults(undefined);
  }, [open]);

  const moveTargets = useMemo(
    () => devices.filter((device) => !targetGroupId || device.groupId !== targetGroupId),
    [devices, targetGroupId],
  );
  const submit = async () => {
    if (!client || !connected || !targetGroupId || !moveTargets.length) return;

    setSubmitting(true);
    try {
      const deviceTargets = moveTargets.map((device) => ({ id: device.id, name: device.name }));
      const result = await client.devices.updateManyGroup(deviceTargets, targetGroupId);
      setResults(result.results);
      onCompleted(
        result.results
          .filter((result) => result.status === 'submitted' || result.status === 'succeeded')
          .map((result) => result.deviceId),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableColumnsType<BatchDeviceResult> = [
    { title: t('batchOperations.columns.device'), dataIndex: 'deviceName', width: 180 },
    { title: t('batchOperations.columns.deviceId'), dataIndex: 'deviceId', width: 220, ellipsis: true },
    {
      title: t('batchOperations.columns.status'),
      dataIndex: 'status',
      width: 100,
      render: (status: BatchDeviceResult['status']) => (
        <Tag color={resultColors[status]}>{t(`batchOperations.status.${status}`)}</Tag>
      ),
    },
    { title: t('batchOperations.columns.detail'), dataIndex: 'message', render: (value?: string) => value || '—' },
  ];

  const selectedGroup = groups.find((group) => group.id === targetGroupId);
  const submittedCount = results?.filter(
    (result) => result.status === 'submitted' || result.status === 'succeeded',
  ).length;

  return (
    <Modal
      open={open}
      title={
        <Space>
          <RetweetOutlined />
          {t('batchOperations.moveTitle')}
        </Space>
      }
      width={920}
      onCancel={onClose}
      destroyOnHidden
      footer={
        results
          ? [
              <Button key="close" type="primary" onClick={onClose}>
                {t('batchOperations.close')}
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onClose} disabled={submitting}>
                {t('common.actions.cancel')}
              </Button>,
              <Button
                key="submit"
                type="primary"
                loading={submitting}
                disabled={!connected || !client || !moveTargets.length || !targetGroupId}
                onClick={() => void submit()}
              >
                {t('batchOperations.submitButton', { count: moveTargets.length })}
              </Button>,
            ]
      }
    >
      {results ? (
        <>
          <Alert
            showIcon
            type={results.some((result) => result.status === 'failed') ? 'warning' : 'success'}
            message={t('batchOperations.completedNotice', { count: submittedCount ?? 0 })}
            description={t('batchOperations.completedDesc')}
          />
          <Table
            rowKey="deviceId"
            size="small"
            columns={columns}
            dataSource={results}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 700, y: 360 }}
            style={{ marginTop: 16 }}
          />
        </>
      ) : (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text>{t('batchOperations.selectGroupPrompt')}</Typography.Text>
          <Select
            placeholder={t('batchOperations.selectTargetGroupPlaceholder')}
            value={targetGroupId}
            onChange={setTargetGroupId}
            options={groups.map((group) => ({ value: group.id, label: group.name }))}
            style={{ width: '100%' }}
          />
          {targetGroupId && (
            <Alert
              showIcon
              type={moveTargets.length ? 'info' : 'warning'}
              message={t('batchOperations.moveCountNotice', { count: moveTargets.length, name: selectedGroup?.name ?? t('common.status.defaultGroup') })}
              description={
                devices.length === moveTargets.length
                  ? t('batchOperations.allTargetsEligible') : t('batchOperations.skippedSameGroup', { count: devices.length - moveTargets.length })
              }
            />
          )}
        </Space>
      )}
    </Modal>
  );
}
