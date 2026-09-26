import { SafetyCertificateOutlined } from '@ant-design/icons';
import type { DeviceGroup } from '@meshcentral/control-client';
import { Alert, Button, Checkbox, Modal, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MESH_PERMISSION_CATEGORIES,
  MESH_PERMISSIONS,
  MESH_PERMISSION_PRESETS,
  MESH_RIGHT_ADMIN,
  composeMeshRights,
  normalizeMeshRights,
} from '../../features/users/meshPermissions';

type DeviceGroupPermissionValue = {
  groupId: string;
  rights: number;
};

interface DeviceGroupPermissionModalProps {
  open: boolean;
  groups: DeviceGroup[];
  currentGroupIds: string[];
  editing?: DeviceGroupPermissionValue;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (value: DeviceGroupPermissionValue) => void | Promise<void>;
}

const DEFAULT_RIGHTS = 0x00000008 | 0x00000010 | 0x00000020 | 0x00100000;
const DEFAULT_FLAGS = MESH_PERMISSIONS.filter(({ flag }) => (DEFAULT_RIGHTS & flag) === flag).map(
  ({ flag }) => flag,
);
const ALL_FLAGS = MESH_PERMISSIONS.map(({ flag }) => flag);

export function DeviceGroupPermissionModal({
  open,
  groups,
  currentGroupIds,
  editing,
  submitting = false,
  onCancel,
  onSubmit,
}: DeviceGroupPermissionModalProps) {
  const { t } = useTranslation();
  const [groupId, setGroupId] = useState<string>();
  const [fullAccess, setFullAccess] = useState(false);
  const [selectedFlags, setSelectedFlags] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    const rights = normalizeMeshRights(editing?.rights ?? DEFAULT_RIGHTS);
    setGroupId(editing?.groupId);
    setFullAccess(rights === MESH_RIGHT_ADMIN);
    setSelectedFlags(
      rights === MESH_RIGHT_ADMIN
        ? []
        : MESH_PERMISSIONS.filter(({ flag }) => (rights & flag) === flag).map(({ flag }) => flag),
    );
  }, [editing, open]);

  const selectableGroups = useMemo(
    () => groups.filter((group) => editing?.groupId === group.id || !currentGroupIds.includes(group.id)),
    [currentGroupIds, editing?.groupId, groups],
  );

  const categoryFlagsMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const cat of MESH_PERMISSION_CATEGORIES) {
      map.set(
        cat.key,
        MESH_PERMISSIONS.filter((p) => p.category === cat.key).map((p) => p.flag),
      );
    }
    return map;
  }, []);

  const toggleCategory = (categoryKey: string) => {
    const flags = categoryFlagsMap.get(categoryKey) ?? [];
    const isAllSelected = flags.length > 0 && flags.every((f) => selectedFlags.includes(f));
    if (isAllSelected) {
      setSelectedFlags((prev) => prev.filter((f) => !flags.includes(f)));
    } else {
      setSelectedFlags((prev) => Array.from(new Set([...prev, ...flags])));
    }
  };

  const rights = fullAccess ? MESH_RIGHT_ADMIN : composeMeshRights(selectedFlags);
  const title = editing ? t('permissions.meshModal.editGroupTitle') : t('permissions.meshModal.addGroupTitle');

  return (
    <Modal
      title={
        <Space size={8}>
          <SafetyCertificateOutlined style={{ color: '#2f80ff' }} />
          <span>{title}</span>
        </Space>
      }
      open={open}
      width={660}
      centered
      okText={editing ? t('common.actions.save') : t('permissions.meshModal.addGroupOk')}
      cancelText={t('common.actions.cancel')}
      confirmLoading={submitting}
      okButtonProps={{ disabled: !groupId }}
      onCancel={onCancel}
      onOk={() => groupId && void onSubmit({ groupId, rights })}
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
            placeholder={t('permissions.meshModal.selectGroupPlaceholder')}
            optionFilterProp="label"
            options={selectableGroups.map((group) => ({ value: group.id, label: group.name }))}
            onChange={setGroupId}
            notFoundContent={t('permissions.meshModal.noAvailableGroups')}
          />
        </div>

        <div className="mesh-permission-toolbar">
          <Space size={8}>
            <Switch
              size="small"
              checked={fullAccess}
              onChange={(checked) => {
                setFullAccess(checked);
                if (!checked && selectedFlags.length === 0) {
                  setSelectedFlags(DEFAULT_FLAGS);
                }
              }}
            />
            <Typography.Text strong style={{ fontSize: 13 }}>
              {t('permissions.meshModal.fullAdminRights')}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('permissions.meshModal.fullAdminRightsDesc')}
            </Typography.Text>
          </Space>

          {!fullAccess && (
            <Space size={4}>
              <Button
                type="link"
                size="small"
                style={{ padding: '0 4px', fontSize: 12 }}
                onClick={() => setSelectedFlags(DEFAULT_FLAGS)}
              >
                {t('permissions.actions.defaultPreset')}
              </Button>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                |
              </Typography.Text>
              <Button
                type="link"
                size="small"
                style={{ padding: '0 4px', fontSize: 12 }}
                onClick={() => setSelectedFlags(ALL_FLAGS)}
              >
                {t('permissions.actions.selectAll')}
              </Button>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                |
              </Typography.Text>
              <Button
                type="link"
                size="small"
                style={{ padding: '0 4px', fontSize: 12 }}
                onClick={() => setSelectedFlags([])}
              >
                {t('permissions.actions.clear')}
              </Button>
            </Space>
          )}
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
                  MESH_PERMISSIONS.filter(({ flag }) => (preset.rights & flag) === flag).map(
                    ({ flag }) => flag,
                  ),
                );
              }}
            />
          </div>
        ) : null}

        {fullAccess ? (
          <Alert
            showIcon
            type="warning"
            title={t('permissions.deviceModal.fullRightsNotice')}
            style={{ padding: '6px 12px', fontSize: 12 }}
          />
        ) : null}

        <div className="mesh-permission-body">
          <Checkbox.Group
            value={selectedFlags}
            onChange={(values) => setSelectedFlags(values as number[])}
            disabled={fullAccess}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}
          >
            {MESH_PERMISSION_CATEGORIES.map((category) => {
              const categoryPermissions = MESH_PERMISSIONS.filter((p) => p.category === category.key);
              const flags = categoryFlagsMap.get(category.key) ?? [];
              const selectedCount = flags.filter((f) => selectedFlags.includes(f)).length;
              const allSelected = flags.length > 0 && selectedCount === flags.length;

              return (
                <div key={category.key} className="mesh-permission-section">
                  <div className="mesh-permission-section-header">
                    <Space size={6}>
                      <span className="mesh-permission-section-title">{t(category.labelKey)}</span>
                      <span className="mesh-permission-section-count">
                        ({selectedCount}/{categoryPermissions.length})
                      </span>
                    </Space>
                    {!fullAccess && (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0, height: 'auto', fontSize: 12 }}
                        onClick={() => toggleCategory(category.key)}
                      >
                        {allSelected ? t('permissions.actions.deselectGroup') : t('permissions.actions.selectGroup')}
                      </Button>
                    )}
                  </div>

                  <div className="mesh-permission-grid">
                    {categoryPermissions.map((permission) => (
                      <Tooltip
                        key={permission.flag}
                        title={t(permission.descriptionKey)}
                        placement="top"
                        mouseEnterDelay={0.3}
                      >
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
