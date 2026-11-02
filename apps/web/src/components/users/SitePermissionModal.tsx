import type { ManagedUser } from '@meshcentral/control-client';
import { Alert, Button, Checkbox, Space, Switch, Tag, Tooltip, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConsoleModal } from '../ui/ConsoleModal';
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
  const { t } = useTranslation();
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

  const toggleCategory = (categoryKey: (typeof SITE_PERMISSION_CATEGORIES)[number]['key']) => {
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
    <ConsoleModal
      title={t('permissions.siteModal.title')}
      open={open}
      variant="details"
      okText={t('common.actions.save')}
      cancelText={t('common.actions.cancel')}
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => void onSubmit(rights)}
      destroyOnHidden
    >
      <div className="mesh-permission-modal">
        <Typography.Text type="secondary">
          {t('permissions.siteModal.notice', { name: user?.name })}
        </Typography.Text>

        <div className="mesh-permission-toolbar">
          <Space size={8} wrap>
            <Switch size="small" checked={fullAdministrator} onChange={setFullAdministrator} />
            <Typography.Text strong>{t('permissions.summary.siteAdmin')}</Typography.Text>
            <Typography.Text type="secondary">0xFFFFFFFF</Typography.Text>
          </Space>
          {!fullAdministrator ? (
            <Space size={4} wrap>
              <Button
                type="link"
                size="small"
                onClick={() => setSelectedFlags(SITE_PERMISSIONS.map(({ flag }) => flag))}
              >
                {t('permissions.actions.selectAll')}
              </Button>
              <Button type="link" size="small" onClick={() => setSelectedFlags([])}>
                {t('permissions.actions.clear')}
              </Button>
            </Space>
          ) : null}
        </div>

        {fullAdministrator ? (
          <Alert showIcon type="warning" title={t('permissions.siteModal.adminNotice')} />
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
                      <span className="mesh-permission-section-title">{t(category.labelKey)}</span>
                      <span className="mesh-permission-section-count">
                        ({selectedCount}/{permissions.length})
                      </span>
                    </Space>
                    {!fullAdministrator ? (
                      <Button type="link" size="small" onClick={() => toggleCategory(category.key)}>
                        {selectedCount === permissions.length
                          ? t('permissions.actions.deselectGroup')
                          : t('permissions.actions.selectGroup')}
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
                              <Tag
                                color="warning"
                                bordered={false}
                                className="mesh-permission-risk-tag"
                              >
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
    </ConsoleModal>
  );
}
