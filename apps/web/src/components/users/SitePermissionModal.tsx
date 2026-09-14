import { SafetyCertificateOutlined } from '@ant-design/icons';
import type { ManagedUser } from '@meshcentral/control-client';
import { Alert, Button, Checkbox, Modal, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  SITE_PERMISSION_CATEGORIES,
  SITE_PERMISSIONS,
  composeEditableSiteRights,
  selectedSitePermissionFlags,
} from '../../features/users/sitePermissions';

interface SitePermissionModalProps {
  open: boolean;
  user?: ManagedUser;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (rights: number) => void | Promise<void>;
}

export function SitePermissionModal({
  open,
  user,
  submitting = false,
  onCancel,
  onSubmit,
}: SitePermissionModalProps) {
  const [fullAdministrator, setFullAdministrator] = useState(false);
  const [selectedFlags, setSelectedFlags] = useState<number[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    setFullAdministrator(user.siteRights === 0xffffffff);
    setSelectedFlags(selectedSitePermissionFlags(user.siteRights));
  }, [open, user]);

  const categoryFlags = useMemo(
    () =>
      new Map(
        SITE_PERMISSION_CATEGORIES.map((category) => [
          category.key,
          SITE_PERMISSIONS.filter((permission) => permission.category === category.key).map(
            (permission) => permission.flag,
          ),
        ]),
      ),
    [],
  );

  const toggleCategory = (
    categoryKey: (typeof SITE_PERMISSION_CATEGORIES)[number]['key'],
  ) => {
    const flags = categoryFlags.get(categoryKey) ?? [];
    const allSelected = flags.every((flag) => selectedFlags.includes(flag));
    setSelectedFlags((current) =>
      allSelected
        ? current.filter((flag) => !flags.includes(flag))
        : Array.from(new Set([...current, ...flags])),
    );
  };

  const rights = user
    ? composeEditableSiteRights(selectedFlags, fullAdministrator, user.siteRights)
    : 0;

  return (
    <Modal
      title={
        <Space size={8}>
          <SafetyCertificateOutlined style={{ color: '#2f80ff' }} />
          <span>设置用户权限</span>
        </Space>
      }
      open={open}
      width={660}
      centered
      okText="保存权限"
      cancelText="取消"
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => void onSubmit(rights)}
      destroyOnHidden
    >
      <div className="mesh-permission-modal">
        <Typography.Text type="secondary">
          正在设置用户「{user?.name}」的站点权限。账户启用或锁定状态不会在此修改。
        </Typography.Text>

        <div className="mesh-permission-toolbar">
          <Space size={8}>
            <Switch
              size="small"
              checked={fullAdministrator}
              onChange={setFullAdministrator}
            />
            <Typography.Text strong>全站管理员</Typography.Text>
            <Typography.Text type="secondary">0xFFFFFFFF</Typography.Text>
          </Space>
          {!fullAdministrator ? (
            <Space size={4}>
              <Button
                type="link"
                size="small"
                onClick={() => setSelectedFlags(SITE_PERMISSIONS.map(({ flag }) => flag))}
              >
                全选
              </Button>
              <Button type="link" size="small" onClick={() => setSelectedFlags([])}>
                清空
              </Button>
            </Space>
          ) : null}
        </div>

        {fullAdministrator ? (
          <Alert showIcon type="warning" message="全站管理员拥有当前及未来的全部站点权限。" />
        ) : null}

        <div className="mesh-permission-body">
          <Checkbox.Group
            value={selectedFlags}
            disabled={fullAdministrator}
            onChange={(values) => setSelectedFlags(values as number[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}
          >
            {SITE_PERMISSION_CATEGORIES.map((category) => {
              const permissions = SITE_PERMISSIONS.filter(
                (permission) => permission.category === category.key,
              );
              const flags = categoryFlags.get(category.key) ?? [];
              const selectedCount = flags.filter((flag) => selectedFlags.includes(flag)).length;
              return (
                <div key={category.key} className="mesh-permission-section">
                  <div className="mesh-permission-section-header">
                    <Space size={6}>
                      <span className="mesh-permission-section-title">{category.label}</span>
                      <span className="mesh-permission-section-count">
                        ({selectedCount}/{permissions.length})
                      </span>
                    </Space>
                    {!fullAdministrator ? (
                      <Button type="link" size="small" onClick={() => toggleCategory(category.key)}>
                        {selectedCount === permissions.length ? '取消全选' : '本组全选'}
                      </Button>
                    ) : null}
                  </div>
                  <div className="mesh-permission-grid">
                    {permissions.map((permission) => (
                      <Tooltip key={permission.flag} title={permission.description}>
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