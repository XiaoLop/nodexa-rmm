import {
  RetweetOutlined,
} from '@ant-design/icons';
import type { BatchDeviceResult, GatewayClient } from '@meshcentral/control-client';
import type { Device, DeviceGroup } from '@meshcentral/shared-state';
import { Alert, Button, Modal, Select, Space, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { useEffect, useMemo, useState } from 'react';

interface BatchDeviceOperationsModalProps {
  open: boolean;
  devices: Device[];
  groups: DeviceGroup[];
  client?: GatewayClient;
  connected: boolean;
  onClose: () => void;
  onCompleted: (successfulDeviceIds: string[]) => void;
}

const resultLabels: Record<BatchDeviceResult['status'], string> = {
  queued: '等待',
  running: '执行中',
  submitted: '已提交',
  succeeded: '已确认',
  failed: '失败',
  skipped: '跳过',
};

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
    { title: '设备', dataIndex: 'deviceName', width: 180 },
    { title: '设备 ID', dataIndex: 'deviceId', width: 220, ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: BatchDeviceResult['status']) => (
        <Tag color={resultColors[status]}>{resultLabels[status]}</Tag>
      ),
    },
    { title: '详情', dataIndex: 'message', render: (value?: string) => value || '—' },
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
          批量移动分组
        </Space>
      }
      width={920}
      onCancel={onClose}
      destroyOnHidden
      footer={
        results
          ? [
              <Button key="close" type="primary" onClick={onClose}>
                关闭
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={onClose} disabled={submitting}>
                取消
              </Button>,
              <Button
                key="submit"
                type="primary"
                loading={submitting}
                disabled={!connected || !client || !moveTargets.length || !targetGroupId}
                onClick={() => void submit()}
              >
                移动 {moveTargets.length} 台设备
              </Button>,
            ]
      }
    >
      {results ? (
        <>
          <Alert
            showIcon
            type={results.some((result) => result.status === 'failed') ? 'warning' : 'success'}
            message={`操作完成：${submittedCount ?? 0} 台请求已提交`}
            description="成功提交的设备已从当前选择中移除；失败项保留，便于重试。"
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
          <Typography.Text>选择目标分组。提交前会以当前设备快照重新计算目标。</Typography.Text>
          <Select
            placeholder="选择目标分组"
            value={targetGroupId}
            onChange={setTargetGroupId}
            options={groups.map((group) => ({ value: group.id, label: group.name }))}
            style={{ width: '100%' }}
          />
          {targetGroupId && (
            <Alert
              showIcon
              type={moveTargets.length ? 'info' : 'warning'}
              message={`将移动 ${moveTargets.length} 台设备至「${selectedGroup?.name ?? '目标分组'}」`}
              description={
                devices.length === moveTargets.length
                  ? '所有选中设备均可提交移动请求。'
                  : `${devices.length - moveTargets.length} 台设备已属于目标分组，将跳过。`
              }
            />
          )}
        </Space>
      )}
    </Modal>
  );
}
