import type { ManagedUser } from '@meshcentral/control-client';
import { Alert, Button, Checkbox, Space, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConsoleModal } from '../ui/ConsoleModal';
import {
  FEATURE_RESTRICTION_CATEGORIES,
  USER_FEATURE_RESTRICTIONS,
  composeRemoveRights,
  selectedRemoveRights,
} from '../../features/users/removeRights';

interface UserFeatureRestrictionModalProps {
  open: boolean;
  user?: ManagedUser;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (removeRights: number) => void | Promise<void>;
}

export function UserFeatureRestrictionModal({
  open,
  user,
  submitting = false,
  onCancel,
  onSubmit,
}: UserFeatureRestrictionModalProps) {
  const { t } = useTranslation();
  const [selectedFlags, setSelectedFlags] = useState<number[]>([]);

  useEffect(() => {
    if (open && user) setSelectedFlags(selectedRemoveRights(user.removeRights));
  }, [open, user]);

  const removeRights = useMemo(
    () => composeRemoveRights(selectedFlags, user?.removeRights ?? 0),
    [selectedFlags, user?.removeRights],
  );

  const toggleCategory = (categoryKey: (typeof FEATURE_RESTRICTION_CATEGORIES)[number]['key']) => {
    const flags = USER_FEATURE_RESTRICTIONS.filter((r) => r.category === categoryKey).map(
      (r) => r.flag,
    );
    const allSelected = flags.every((flag) => selectedFlags.includes(flag));
    setSelectedFlags((current) =>
      allSelected
        ? current.filter((flag) => !flags.includes(flag))
        : Array.from(new Set([...current, ...flags])),
    );
  };

  return (
    <ConsoleModal
      title={t('featureRestrictions.title')}
      open={open}
      variant="details"
      okText={t('common.actions.save')}
      cancelText={t('common.actions.cancel')}
      confirmLoading={submitting}
      onCancel={onCancel}
      onOk={() => void onSubmit(removeRights)}
      destroyOnHidden
    >
      <div className="mesh-permission-modal">
        <Typography.Text type="secondary">
          {t('featureRestrictions.notice', { name: user?.name })}
        </Typography.Text>

        <div className="mesh-permission-toolbar">
          <Space size={8} wrap>
            {selectedFlags.length === 0 ? (
              <Tag color="success" bordered={false}>
                {t('featureRestrictions.status.unrestricted')}
              </Tag>
            ) : (
              <Tag color="warning" bordered={false}>
                {t('featureRestrictions.status.restricted', { count: selectedFlags.length })}
              </Tag>
            )}
          </Space>
          {selectedFlags.length > 0 ? (
            <Button type="link" size="small" onClick={() => setSelectedFlags([])}>
              {t('featureRestrictions.restoreAll')}
            </Button>
          ) : null}
        </div>

        {selectedFlags.includes(0x00000008) ? (
          <Alert showIcon type="warning" title={t('featureRestrictions.remoteControlNotice')} />
        ) : null}

        <div className="mesh-permission-body">
          <Checkbox.Group
            value={selectedFlags}
            onChange={(values) => setSelectedFlags(values as number[])}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}
          >
            {FEATURE_RESTRICTION_CATEGORIES.map((category) => {
              const restrictions = USER_FEATURE_RESTRICTIONS.filter(
                (item) => item.category === category.key,
              );
              const flags = restrictions.map((r) => r.flag);
              const selectedCount = flags.filter((flag) => selectedFlags.includes(flag)).length;
              return (
                <div key={category.key} className="mesh-permission-section">
                  <div className="mesh-permission-section-header">
                    <Space size={6}>
                      <span className="mesh-permission-section-title">{t(category.labelKey)}</span>
                      <span className="mesh-permission-section-count">
                        ({selectedCount}/{restrictions.length})
                      </span>
                    </Space>
                    <Button type="link" size="small" onClick={() => toggleCategory(category.key)}>
                      {selectedCount === restrictions.length
                        ? t('featureRestrictions.deselectGroup')
                        : t('featureRestrictions.selectGroup')}
                    </Button>
                  </div>
                  <div className="mesh-permission-restrictions">
                    {restrictions.map((restriction) => (
                      <div
                        key={restriction.flag}
                        className="mesh-permission-item mesh-permission-restriction"
                      >
                        <Checkbox value={restriction.flag} style={{ width: '100%' }}>
                          <span className="mesh-permission-label">
                            {t(`featureRestrictions.items.${restriction.key}.label`)}
                          </span>
                          {restriction.broadImpact ? (
                            <Tag
                              color="error"
                              bordered={false}
                              style={{
                                marginLeft: 8,
                                padding: '0 6px',
                                fontSize: 10,
                                lineHeight: '18px',
                              }}
                            >
                              {t('featureRestrictions.broadImpactTag')}
                            </Tag>
                          ) : null}
                        </Checkbox>
                        <div className="mesh-permission-description">
                          {t(`featureRestrictions.items.${restriction.key}.description`)}
                        </div>
                      </div>
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
