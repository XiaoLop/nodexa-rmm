import {
  ApartmentOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { DeviceGroup } from '@meshcentral/shared-state';
import {
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
  theme,
  type TableColumnsType,
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMeshCentralControlData } from '../features/gateway';
import { useApplicationUiCapabilities } from '../features/permissions/useUiCapabilities';
import {
  getDeviceGroupUiCapabilities,
  resolveEffectiveDeviceGroupRights,
  type UiPermission,
} from '@meshcentral/control-client';
import { createCollator, useFormatters } from '../i18n';
import { FilterBar, PageHeader, Panel } from '../components/ui';
import '../assets/styles/devices.css';

function nameCategory(name: string) {
  const firstChar = name.trim().charAt(0);
  if (/^\d$/.test(firstChar)) return 0;
  if (/^[a-z]$/.test(firstChar)) return 1;
  if (/^[A-Z]$/.test(firstChar)) return 3;
  return 2;
}

function PermissionButton({
  permission,
  children,
}: {
  permission: UiPermission;
  children: React.ReactElement;
}) {
  if (!permission.visible) return null;
  return permission.message ? (
    <Tooltip title={permission.message}>
      <span>{children}</span>
    </Tooltip>
  ) : (
    children
  );
}

export function DeviceGroupsPage() {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const { token } = theme.useToken();
  const { groups, devices, client, status, userInfo, serverInfo, refreshSnapshot } = useMeshCentralControlData();
  const applicationCapabilities = useApplicationUiCapabilities();
  const navigate = useNavigate();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const [query, setQuery] = useState('');
  const [editingGroup, setEditingGroup] = useState<DeviceGroup | null | 'new'>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<{ name: string; description?: string }>();
  const permissionContextRef = useRef({ groups, userInfo, serverInfo, status });
  permissionContextRef.current = { groups, userInfo, serverInfo, status };

  const groupCapabilities = useCallback(
    (group: DeviceGroup) =>
      getDeviceGroupUiCapabilities(
        resolveEffectiveDeviceGroupRights(group, userInfo, serverInfo),
        status === 'connected',
      ),
    [serverInfo, status, userInfo],
  );

  const latestGroupPermission = (groupId: string, capability: 'edit' | 'remove') => {
    const context = permissionContextRef.current;
    const group = context.groups.find((item) => item.id === groupId);
    if (!group) return undefined;
    return getDeviceGroupUiCapabilities(
      resolveEffectiveDeviceGroupRights(group, context.userInfo, context.serverInfo),
      context.status === 'connected',
    )[capability];
  };

  const collator = useMemo(
    () => createCollator(formatters.language, { numeric: true, sensitivity: 'base' }),
    [formatters.language],
  );

  const compareGroupName = useCallback(
    (a: DeviceGroup, b: DeviceGroup) => {
      const categoryDifference = nameCategory(a.name) - nameCategory(b.name);
      return categoryDifference || collator.compare(a.name, b.name);
    },
    [collator],
  );

  const deviceStatsByGroup = useMemo(() => {
    const stats = new Map<string, { total: number; online: number; offline: number }>();
    devices.forEach((device) => {
      if (!device.groupId) return;
      const current = stats.get(device.groupId) ?? { total: 0, online: 0, offline: 0 };
      current.total += 1;
      if (device.online) current.online += 1;
      else current.offline += 1;
      stats.set(device.groupId, current);
    });
    return stats;
  }, [devices]);

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return groups
      .filter((group) => {
        const matchesQuery =
          !normalized ||
          [group.name, group.id, group.description].some((value) =>
            value?.toLowerCase().includes(normalized),
          );
        return matchesQuery;
      })
      .sort(compareGroupName);
  }, [compareGroupName, groups, query]);

  useEffect(() => {
    if (!editingGroup) return;
    form.setFieldsValue({
      name: editingGroup === 'new' ? '' : editingGroup.name,
      description: editingGroup === 'new' ? '' : editingGroup.description,
    });
  }, [editingGroup, form]);

  const openGroupEditor = (group?: DeviceGroup) => {
    if (group && !groupCapabilities(group).edit.enabled) {
      void messageApi.error(t('deviceGroups.messages.permissionDenied'));
      return;
    }
    setEditingGroup(group ?? 'new');
  };

  const submitGroup = async () => {
    if (!client || !editingGroup) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingGroup === 'new') {
        await client.groups.create(values.name.trim(), { description: values.description?.trim() });
      } else {
        if (!latestGroupPermission(editingGroup.id, 'edit')?.enabled) {
          void messageApi.error(t('deviceGroups.messages.permissionDenied'));
          return;
        }
        await client.groups.update(editingGroup.id, {
          name: values.name.trim(),
          description: values.description?.trim() ?? '',
        });
      }
      await refreshSnapshot();
      void messageApi.success(
        editingGroup === 'new'
          ? t('deviceGroups.messages.createSuccess')
          : t('deviceGroups.messages.updateSuccess'),
      );
      setEditingGroup(null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : t('common.status.unknown');
      void messageApi.error(t('deviceGroups.messages.saveFailed', { detail }));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmGroupDeletion = (group: DeviceGroup) => {
    if (!client) return;
    if (!groupCapabilities(group).remove.enabled) {
      void messageApi.error(t('deviceGroups.messages.permissionDenied'));
      return;
    }
    const count = deviceStatsByGroup.get(group.id)?.total ?? 0;
    modal.confirm({
      title: t('deviceGroups.confirm.deleteTitle'),
      content: t('deviceGroups.confirm.deleteContent', { name: group.name, count }),
      okText: t('deviceGroups.confirm.deleteOk'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          if (!latestGroupPermission(group.id, 'remove')?.enabled) {
            void messageApi.error(t('deviceGroups.messages.permissionDenied'));
            return;
          }
          await client.groups.remove(group.id);
          await refreshSnapshot();
          void messageApi.success(t('deviceGroups.messages.deleteSuccess', { name: group.name }));
        } catch (error) {
          const detail = error instanceof Error ? error.message : t('common.status.unknown');
          void messageApi.error(t('deviceGroups.messages.deleteFailed', { detail }));
          throw error;
        }
      },
    });
  };

  const columns: TableColumnsType<DeviceGroup> = [
    {
      title: t('deviceGroups.columns.name'),
      dataIndex: 'name',
      fixed: 'left',
      width: 200,
      defaultSortOrder: 'ascend',
      render: (value) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ApartmentOutlined style={{ color: '#177ddc' }} />
          <span style={{ fontWeight: 600, color: '#e0e0e0' }}>{value}</span>
        </div>
      ),
    },
    {
      title: t('deviceGroups.columns.desc'),
      dataIndex: 'description',
      width: 250,
      render: (value) => value || '—',
    },
    {
      title: t('deviceGroups.columns.deviceCount'),
      key: 'deviceCount',
      width: 120,
      render: (_, group) => {
        const count = deviceStatsByGroup.get(group.id)?.total ?? 0;
        return <Tag color="blue">{t('devices.totalCount', { count })}</Tag>;
      },
      sorter: (a, b) => {
        const countA = deviceStatsByGroup.get(a.id)?.total ?? 0;
        const countB = deviceStatsByGroup.get(b.id)?.total ?? 0;
        return countA - countB;
      },
    },
    {
      title: t('deviceGroups.columns.deviceStats'),
      key: 'deviceStats',
      width: 260,
      render: (_, group) => {
        const stats = deviceStatsByGroup.get(group.id) ?? {
          total: 0,
          online: 0,
          offline: 0,
        };
        const onlinePercent = stats.total ? (stats.online / stats.total) * 100 : 0;
        return (
          <Progress
            percent={onlinePercent}
            strokeColor={token.colorPrimary}
            format={() => (
              <span style={{ color: token.colorPrimary }}>
                {stats.online} / {stats.offline}
              </span>
            )}
          />
        );
      },
      sorter: (a, b) => {
        const onlineA = deviceStatsByGroup.get(a.id)?.online ?? 0;
        const onlineB = deviceStatsByGroup.get(b.id)?.online ?? 0;
        return onlineA - onlineB;
      },
    },
    {
      title: t('deviceGroups.columns.creation'),
      key: 'creation',
      width: 170,
      render: (_, group) => {
        const raw = group.raw as Record<string, unknown> | undefined;
        const creation = raw?.creation as number | undefined;
        return creation
          ? formatters.dateTime(new Date(creation < 10000000000 ? creation * 1000 : creation))
          : '—';
      },
      sorter: (a, b) => {
        const rawA = a.raw as Record<string, unknown> | undefined;
        const rawB = b.raw as Record<string, unknown> | undefined;
        const creationA = (rawA?.creation as number) || 0;
        const creationB = (rawB?.creation as number) || 0;
        return creationA - creationB;
      },
    },
    {
      title: t('deviceGroups.columns.creator'),
      key: 'creator',
      width: 150,
      render: (_, group) => {
        const raw = group.raw as Record<string, unknown> | undefined;
        return (raw?.creatorname as string) || '—';
      },
    },
    {
      title: t('deviceGroups.columns.actions'),
      key: 'actions',
      fixed: 'right',
      width: 290,
      render: (_, group) => {
        const capabilities = groupCapabilities(group);
        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              onClick={() => navigate(`/devices?groupId=${encodeURIComponent(group.id)}`)}
            >
              {t('deviceGroups.actions.viewDevices')}
            </Button>
            {applicationCapabilities.serverFiles && (
              <Button
                type="link"
                size="small"
                icon={<FolderOpenOutlined />}
                onClick={() => navigate(`/files?groupId=${encodeURIComponent(group.id)}`)}
              >
                {t('deviceGroups.actions.sharedFiles')}
              </Button>
            )}
            <PermissionButton permission={capabilities.edit}>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                disabled={!client || !capabilities.edit.enabled}
                onClick={() => openGroupEditor(group)}
              >
                {t('common.actions.edit')}
              </Button>
            </PermissionButton>
            <PermissionButton permission={capabilities.remove}>
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                disabled={!client || !capabilities.remove.enabled}
                onClick={() => confirmGroupDeletion(group)}
              >
                {t('common.actions.delete')}
              </Button>
            </PermissionButton>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-stack devices-page">
      {messageContextHolder}
      {modalContextHolder}
      <PageHeader
        title={t('deviceGroups.title')}
        description={t('deviceGroups.subtitle')}
        actions={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={
              !applicationCapabilities.createDeviceGroups || !client || status !== 'connected'
            }
            onClick={() => openGroupEditor()}
          >
            {t('deviceGroups.createGroup')}
          </Button>
        }
      />
      <Panel className="devices-table-card">
        <FilterBar className="devices-toolbar">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder={t('deviceGroups.searchPlaceholder')}
            allowClear
          />
          <div className="toolbar-spacer" />
          <Tag>
            {t('deviceGroups.countTag', {
              filtered: filteredGroups.length,
              total: groups.length,
            })}
          </Tag>
          <Button
            icon={<ReloadOutlined />}
            disabled={status !== 'connected'}
            onClick={() => void refreshSnapshot()}
          >
            {t('common.actions.refresh')}
          </Button>
        </FilterBar>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredGroups}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total) => t('deviceGroups.totalCount', { count: total }),
          }}
          scroll={{ x: 1490 }}
          locale={{
            emptyText: (
              <Empty
                description={
                  groups.length
                    ? t('deviceGroups.empty.filtered')
                    : t('deviceGroups.empty.waiting')
                }
              />
            ),
          }}
        />
      </Panel>
      <Modal
        title={
          editingGroup === 'new'
            ? t('deviceGroups.modal.createTitle')
            : t('deviceGroups.modal.editTitle')
        }
        open={Boolean(editingGroup)}
        onCancel={() => setEditingGroup(null)}
        onOk={() => void submitGroup()}
        okText={
          editingGroup === 'new'
            ? t('deviceGroups.modal.createOk')
            : t('deviceGroups.modal.editOk')
        }
        cancelText={t('common.actions.cancel')}
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label={t('deviceGroups.modal.name')}
            rules={[
              {
                required: true,
                whitespace: true,
                message: t('deviceGroups.modal.nameRequired'),
              },
            ]}
          >
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="description" label={t('deviceGroups.modal.desc')}>
            <Input.TextArea rows={3} maxLength={500} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
