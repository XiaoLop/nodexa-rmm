import { SafetyCertificateOutlined } from '@ant-design/icons';
import type { DeviceGroup } from '@meshcentral/control-client';
import { Alert, Button, Checkbox, Modal, Select, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  MESH_PERMISSION_CATEGORIES,
  MESH_PERMISSIONS,
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
  const title = editing ? '编辑设备组权限' : '添加设备组权限';

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
      okText={editing ? '保存权限' : '添加设备组'}
      cancelText="取消"
      confirmLoading={submitting}
      okButtonProps={{ disabled: !groupId }}
      onCancel={onCancel}
      onOk={() => groupId && void onSubmit({ groupId, rights })}
      destroyOnHidden
    >
      <div className="mesh-permission-modal">
        <div className="mesh-permission-field">
          <span className="mesh-permission-field-label">设备组</span>
          <Select
            style={{ flex: 1 }}
            showSearch
            value={groupId}
            disabled={Boolean(editing)}
            placeholder="选择要授权的设备组"
            optionFilterProp="label"
            options={selectableGroups.map((group) => ({ value: group.id, label: group.name }))}
            onChange={setGroupId}
            notFoundContent="没有可添加的设备组"
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
              完全管理员权限
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              (拥有全部权限 0xFFFFFFFF)
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
                常用默认
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
                全选
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
                清空
              </Button>
            </Space>
          )}
        </div>

        {fullAccess ? (
          <Alert
            showIcon
            type="warning"
            message="已开启完全管理员权限，包含当前及未来所有权限项。"
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
                      <span className="mesh-permission-section-title">{category.label}</span>
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
                        {allSelected ? '取消全选' : '本组全选'}
                      </Button>
                    )}
                  </div>

                  <div className="mesh-permission-grid">
                    {categoryPermissions.map((permission) => (
                      <Tooltip
                        key={permission.flag}
                        title={permission.description}
                        placement="top"
                        mouseEnterDelay={0.3}
                      >
                        <div className="mesh-permission-item">
                          <Checkbox value={permission.flag}>
                            <span className="mesh-permission-label">{permission.label}</span>
                            {permission.risk ? (
                              <Tag color="warning" bordered={false} className="mesh-permission-risk-tag">
                                敏感
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
