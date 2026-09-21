import { DesktopOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { Device, DeviceGroup } from '@meshcentral/control-client';
import { Alert, Button, Checkbox, Modal, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEVICE_PERMISSION_CATEGORIES,
  DEVICE_PERMISSIONS,
  DEVICE_RIGHT_FULL,
  MESH_PERMISSION_PRESETS,
  composeMeshRights,
  normalizeMeshRights,
} from '../../features/users/meshPermissions';

type DevicePermissionValue = { deviceId: string; rights: number };

interface DevicePermissionModalProps {
  open: boolean;
  groups: DeviceGroup[];
  devices: Device[];
  currentDeviceIds: string[];
  editing?: DevicePermissionValue;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (value: DevicePermissionValue) => void | Promise<void>;
}

const DEFAULT_RIGHTS = 0x00000008 | 0x00000010 | 0x00000020;

export function DevicePermissionModal({
  open,
  groups,
  devices,
  currentDeviceIds,
  editing,
  submitting = false,
  onCancel,
  onSubmit,
}: DevicePermissionModalProps) {
  const editingDevice = devices.find((device) => device.id === editing?.deviceId);
  const { t } = useTranslation();
  const [groupId, setGroupId] = useState<string>();
  const [deviceId, setDeviceId] = useState<string>();
  const [fullAccess, setFullAccess] = useState(false);
  const [selectedFlags, setSelectedFlags] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    const rights = normalizeMeshRights(editing?.rights ?? DEFAULT_RIGHTS);
    setGroupId(editingDevice?.groupId);
    setDeviceId(editing?.deviceId);
    setFullAccess(rights === DEVICE_RIGHT_FULL);
    setSelectedFlags(
      rights === DEVICE_RIGHT_FULL
        ? []
        : DEVICE_PERMISSIONS.filter(({ flag }) => (rights & flag) === flag).map(({ flag }) => flag),
    );
  }, [editing?.deviceId, editing?.rights, editingDevice?.groupId, open]);

  const selectableDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          device.groupId === groupId &&
          (editing?.deviceId === device.id || !currentDeviceIds.includes(device.id)),
      ),
    [currentDeviceIds, devices, editing?.deviceId, groupId],
  );

  const categoryFlags = useMemo(
    () =>
      new Map(
        DEVICE_PERMISSION_CATEGORIES.map((category) => [
          category.key,
          DEVICE_PERMISSIONS.filter((permission) => permission.category === category.key).map(
            (permission) => permission.flag,
          ),
        ]),
      ),
    [],
  );

  const toggleCategory = (
    categoryKey: (typeof DEVICE_PERMISSION_CATEGORIES)[number]['key'],
  ) => {
    const flags = categoryFlags.get(categoryKey) ?? [];
    const allSelected = flags.every((flag) => selectedFlags.includes(flag));
    setSelectedFlags((current) =>
      allSelected
        ? current.filter((flag) => !flags.includes(flag))
        : Array.from(new Set([...current, ...flags])),
    );
  };

  const rights = fullAccess ? DEVICE_RIGHT_FULL : composeMeshRights(selectedFlags);

  return (
    <Modal
      title={
        <Space size={8}>
          <DesktopOutlined style={{ color: '#2f80ff' }} />
          <span>{editing ? t('permissions.deviceModal.editTitle') : t('permissions.deviceModal.addTitle')}</span>
        </Space>
      }
      open={open}
      width={680}
      centered
      okText={editing ? t('common.actions.save') : t('permissions.deviceModal.addOk')}
      cancelText={t('common.actions.cancel')}
      confirmLoading={submitting}
      okButtonProps={{ disabled: !deviceId }}
      onCancel={onCancel}
      onOk={() => deviceId && void onSubmit({ deviceId, rights })}
      destroyOnHidden
    >
      <div className="mesh-permission-modal">
        <div className="mesh-permission-field">
          <span className="mesh-permission-field-label">{t('permissions.meshModal.deviceGroup')}</span>
          <Select
            style={{ flex: 1 }}
            showSearch
            value={groupId}
            disabled={Boolean(editing)}
            placeholder={t('permissions.deviceModal.selectGroupFirst')}
            optionFilterProp="label"
            options={groups.map((group) => ({ value: group.id, label: group.name }))}
            onChange={(value) => {
              setGroupId(value);
              setDeviceId(undefined);
            }}
          />
        </div>
        <div className="mesh-permission-field">
          <span className="mesh-permission-field-label">{t('permissions.deviceModal.device')}</span>
          <Select
            style={{ flex: 1 }}
            showSearch
            value={deviceId}
            disabled={!groupId || Boolean(editing)}
            placeholder={groupId ? t('permissions.deviceModal.selectDevicePlaceholder') : t('permissions.deviceModal.selectGroupFirst')}
            optionFilterProp="label"
            options={selectableDevices.map((device) => ({ value: device.id, label: device.name }))}
            onChange={setDeviceId}
            notFoundContent={t('permissions.deviceModal.noAvailableDevices')}
          />
        </div>

        <div className="mesh-permission-toolbar">
          <Space size={8}>
            <SafetyCertificateOutlined />
            <Switch size="small" checked={fullAccess} onChange={setFullAccess} />
            <Typography.Text strong>{t('permissions.deviceModal.allDeviceRights')}</Typography.Text>
          </Space>
          {!fullAccess ? (
            <Space size={4}>
              <Button
                type="link"
                size="small"
                onClick={() => setSelectedFlags(DEVICE_PERMISSIONS.map(({ flag }) => flag))}
              >
                {t('permissions.actions.selectAll')}
              </Button>
              <Button type="link" size="small" onClick={() => setSelectedFlags([])}>
                {t('permissions.actions.clear')}
              </Button>
            </Space>
          ) : null}
        </div>

        {!fullAccess ? (
          <div className="mesh-permission-field">
            <span className="mesh-permission-field-label">{t('permissions.actions.presets')}</span>
            <Select
              style={{ flex: 1 }}
              placeholder={t('permissions.actions.selectPresetPlaceholder')}
              options={MESH_PERMISSION_PRESETS.map((preset) => ({
                value: preset.key,
                label: t(preset.labelKey),
              }))}
              onChange={(key) => {
                const preset = MESH_PERMISSION_PRESETS.find((item) => item.key === key);
                if (!preset) return;
                setSelectedFlags(
                  DEVICE_PERMISSIONS.filter(({ flag }) => (preset.rights & flag) === flag).map(
                    ({ flag }) => flag,
                  ),
                );
              }}
            />
          </div>
        ) : null}

        {fullAccess ? <Alert showIcon type="warning" message={t('permissions.deviceModal.fullRightsNotice')} /> : null}

        <div className="mesh-permission-body">
          <Checkbox.Group
            value={selectedFlags}
            disabled={fullAccess}
            onChange={(values) => setSelectedFlags(values as number[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}
          >
            {DEVICE_PERMISSION_CATEGORIES.map((category) => {
              const permissions = DEVICE_PERMISSIONS.filter(
                (permission) => permission.category === category.key,
              );
              const flags = categoryFlags.get(category.key) ?? [];
              const selectedCount = flags.filter((flag) => selectedFlags.includes(flag)).length;
              return (
                <div key={category.key} className="mesh-permission-section">
                  <div className="mesh-permission-section-header">
                    <Space size={6}>
                      <span className="mesh-permission-section-title">{t(category.labelKey)}</span>
                      <span className="mesh-permission-section-count">({selectedCount}/{permissions.length})</span>
                    </Space>
                    {!fullAccess ? (
                      <Button type="link" size="small" onClick={() => toggleCategory(category.key)}>
                        {selectedCount === permissions.length ? t('permissions.actions.deselectGroup') : t('permissions.actions.selectGroup')}
                      </Button>
                    ) : null}
                  </div>
                  <div className="mesh-permission-grid">
                    {permissions.map((permission) => (
                      <Tooltip key={permission.flag} title={t(permission.descriptionKey)}>
                        <div className="mesh-permission-item">
                          <Checkbox value={permission.flag}>
                            <span className="mesh-permission-label">{t(permission.labelKey)}</span>
                            {permission.risk ? (
                              <Tag color="warning" bordered={false} className="mesh-permission-risk-tag">
                                {t('permissions.riskTag')}
                              </Tag>
                            ) : null}
                          </Checkbox>
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              );
            })}
          </Checkbox.Group>
        </div>
      </div>
    </Modal>
  );
}