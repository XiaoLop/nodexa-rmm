import {
  ApartmentOutlined,
  CopyOutlined,
  DeleteOutlined,
  DesktopOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  SiteRight,
  hasSiteRight,
  isSiteAdministrator,
  type UserGroup,
  type UserGroupCreateOptions,
} from '@meshcentral/control-client';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
  type TableColumnsType,
} from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGatewayData } from '../features/gateway/useGatewayData';
import { createCollator } from '../i18n';
import { useFormatters } from '../i18n/formatters';
import '../assets/styles/users.css';

type EditorMode = 'create' | 'edit' | 'clone';
type GroupFilter = 'all' | 'with-members' | 'no-members' | 'with-permissions' | 'no-permissions';

interface EditorState {
  mode: EditorMode;
  group?: UserGroup;
}

interface EditorValues {
  name: string;
  description?: string;
}

function countLinks(group: UserGroup, type: UserGroup['links'][number]['type']): number {
  return group.links.filter((link) => link.type === type).length;
}

export function UserGroupsPage() {
  const { t } = useTranslation();
  const formatters = useFormatters();
  const navigate = useNavigate();
  const { client, status, userInfo } = useGatewayData();
  const [form] = Form.useForm<EditorValues>();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [listError, setListError] = useState<string>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GroupFilter>('all');
  const [editor, setEditor] = useState<EditorState>();
  const [deletingGroup, setDeletingGroup] = useState<UserGroup>();
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const requestSequence = useRef(0);
  const connected = Boolean(client && status === 'connected');
  const canManage = Boolean(
    userInfo &&
      (isSiteAdministrator(userInfo.siteadmin ?? 0) ||
        hasSiteRight(userInfo.siteadmin ?? 0, SiteRight.ManageUserGroups)),
  );
  const canWrite = connected && canManage;

  const collator = useMemo(
    () => createCollator(formatters.language, { numeric: true, sensitivity: 'base' }),
    [formatters.language],
  );

  const loadGroups = useCallback(async (): Promise<UserGroup[] | undefined> => {
    if (!client || status !== 'connected') return undefined;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setListError(undefined);
    try {
      const result = await client.userGroups.list();
      if (sequence === requestSequence.current) setGroups(result);
      return result;
    } catch (error) {
      if (sequence === requestSequence.current) {
        setListError(error instanceof Error ? error.message : t('common.status.unknown'));
      }
      return undefined;
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [client, status, t]);

  useEffect(() => {
    if (status === 'connected') void loadGroups();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadGroups, status]);

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return [...groups]
      .filter((group) => {
        if (normalized) {
          const match =
            group.name.toLowerCase().includes(normalized) ||
            group.description?.toLowerCase().includes(normalized) ||
            group.id.toLowerCase().includes(normalized);
          if (!match) return false;
        }

        const memberCount = countLinks(group, 'user');
        const permCount = countLinks(group, 'device-group') + countLinks(group, 'device');

        switch (filter) {
          case 'with-members':
            return memberCount > 0;
          case 'no-members':
            return memberCount === 0;
          case 'with-permissions':
            return permCount > 0;
          case 'no-permissions':
            return permCount === 0;
          default:
            return true;
        }
      })
      .sort((left, right) => collator.compare(left.name, right.name));
  }, [collator, filter, groups, query]);

  useEffect(() => {
    if (!editor) return;
    form.setFieldsValue({
      name: editor.mode === 'clone' ? `${editor.group?.name ?? ''} (Copy)` : editor.group?.name ?? '',
      description: editor.group?.description ?? '',
    });
  }, [editor, form]);

  const openEditor = (mode: EditorMode, group?: UserGroup) => {
    setEditor({ mode, group });
  };

  const submitEditor = async () => {
    if (!client || !canWrite || !editor) return;
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (editor.mode === 'edit' && editor.group) {
        await client.userGroups.update(editor.group.id, values);
      } else {
        const options: UserGroupCreateOptions = {
          name: values.name,
          description: values.description,
          cloneUserGroupId: editor.mode === 'clone' ? editor.group?.id : undefined,
        };
        await client.userGroups.create(options);
      }
      const refreshed = await loadGroups();
      if (!refreshed) {
        void messageApi.warning(t('userGroups.messages.mutationUncertain'));
        return;
      }
      void messageApi.success(
        editor.mode === 'edit'
          ? t('userGroups.messages.updateSuccess', { name: values.name })
          : editor.mode === 'clone'
          ? t('userGroups.messages.cloneSuccess', { name: values.name })
          : t('userGroups.messages.createSuccess', { name: values.name }),
      );
      setEditor(undefined);
    } catch (error) {
      const detail = error instanceof Error ? error.message : t('common.status.unknown');
      void messageApi.error(t('userGroups.messages.mutationFailed', { detail }));
    } finally {
      setSubmitting(false);
    }
  };

  const deleteGroup = async () => {
    if (!client || !canWrite || !deletingGroup) return;
    setSubmitting(true);
    try {
      const latest = (await client.userGroups.list()).find((group) => group.id === deletingGroup.id);
      if (!latest) throw new Error(t('userGroups.messages.targetGroupNotFound'));
      await client.userGroups.remove(latest.id);
      const refreshed = await loadGroups();
      if (!refreshed) {
        void messageApi.warning(t('userGroups.messages.mutationUncertain'));
        return;
      }
      void messageApi.success(t('userGroups.messages.deleteSuccess', { name: latest.name }));
      setDeletingGroup(undefined);
      setDeleteConfirmation('');
    } catch (error) {
      const detail = error instanceof Error ? error.message : t('common.status.unknown');
      void messageApi.error(t('userGroups.messages.deleteFailed', { detail }));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: TableColumnsType<UserGroup> = [
    {
      title: t('userGroups.columns.name'),
      key: 'group',
      fixed: 'left',
      width: 290,
      render: (_, group) => (
        <button
          className="user-identity"
          onClick={() => navigate(`/admin/roles/${encodeURIComponent(group.id)}`)}
          title={t('userGroups.columns.name')}
        >
          <span className="user-group-identity-icon"><TeamOutlined /></span>
          <span>
            <strong>{group.name}</strong>
            <small>{group.description || group.id}</small>
          </span>
        </button>
      ),
    },
    {
      title: t('userGroups.columns.members'),
      width: 130,
      sorter: (a, b) => countLinks(a, 'user') - countLinks(b, 'user'),
      render: (_, group) => {
        const count = countLinks(group, 'user');
        return count > 0 ? (
          <Tag color="purple" icon={<TeamOutlined />}>
            {count}
          </Tag>
        ) : (
          <Tag style={{ opacity: 0.65 }}>0</Tag>
        );
      },
    },
    {
      title: t('userGroups.columns.deviceGroups'),
      width: 140,
      sorter: (a, b) => countLinks(a, 'device-group') - countLinks(b, 'device-group'),
      render: (_, group) => {
        const count = countLinks(group, 'device-group');
        return count > 0 ? (
          <Tag color="green" icon={<ApartmentOutlined />}>
            {count}
          </Tag>
        ) : (
          <Tag style={{ opacity: 0.65 }}>{t('userGroups.zeroMembers')}</Tag>
        );
      },
    },
    {
      title: t('userGroups.columns.devices'),
      width: 140,
      sorter: (a, b) => countLinks(a, 'device') - countLinks(b, 'device'),
      render: (_, group) => {
        const count = countLinks(group, 'device');
        return count > 0 ? (
          <Tag color="blue" icon={<DesktopOutlined />}>
            {count}
          </Tag>
        ) : (
          <Tag style={{ opacity: 0.65 }}>{t('userGroups.zeroDevices')}</Tag>
        );
      },
    },
    {
      title: t('userGroups.columns.domainAttributes'),
      width: 170,
      render: (_, group) => (
        <Space size={4} wrap>
          {group.domain ? <Tag color="geekblue">{group.domain}</Tag> : <Tag>{t('userGroups.defaultDomain')}</Tag>}
          {group.flags === 0 ? null : <Tag color="cyan">{t('userGroups.flags', { value: group.flags })}</Tag>}
        </Space>
      ),
    },
    {
      title: t('userGroups.columns.actions'),
      key: 'actions',
      fixed: 'right',
      width: 260,
      render: (_, group) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => navigate(`/admin/roles/${encodeURIComponent(group.id)}`)}
          >
            {t('common.actions.details')}
          </Button>
          <Tooltip title={!canWrite ? t('errors.permissionDenied') : undefined}>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              disabled={!canWrite}
              onClick={() => openEditor('edit', group)}
            >{t('common.actions.edit')}
            </Button>
          </Tooltip>
          <Tooltip title={!canWrite ? t('errors.permissionDenied') : undefined}>
            <Button
              type="link"
              size="small"
              icon={<CopyOutlined />}
              disabled={!canWrite}
              onClick={() => openEditor('clone', group)}
            >{t('userGroups.actions.clone')}
            </Button>
          </Tooltip>
          <Tooltip title={!canWrite ? t('errors.permissionDenied') : undefined}>
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={!canWrite}
              onClick={() => {
                setDeletingGroup(group);
                setDeleteConfirmation('');
              }}
            >{t('common.actions.delete')}
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-stack users-page">
      {messageContextHolder}
      <div className="page-heading">
        <div>
          <h1>{t('userGroups.title')}</h1>
          <p>{t('userGroups.subtitle')}</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!canWrite}
          onClick={() => openEditor('create')}
        >{t('userGroups.createGroup')}
        </Button>
      </div>

      {!connected ? (
        <Alert
          type="warning"
          showIcon
          message={t('header.gatewayDisconnected')}
          description={t('userGroups.gatewayDisconnectedNotice')}
        />
      ) : null}
      {connected && !canManage ? (
        <Alert
          type="info"
          showIcon
          message={t('userGroups.readOnly')}
          description={t('userGroups.readOnlyDescription')}
        />
      ) : null}
      {listError ? (
        <Alert
          type="error"
          showIcon
          message={t('userGroups.loadFailed')}
          description={listError}
          action={
            <Button size="small" onClick={() => void loadGroups()}>
              {t('common.actions.retry')}
            </Button>
          }
        />
      ) : null}

      {/* 用户组主列表卡片 */}
      <section className="console-card devices-table-card">
        <div className="table-toolbar users-toolbar">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<SearchOutlined />}
            placeholder={t('userGroups.searchPlaceholder')}
            allowClear
          />
          <Select<GroupFilter>
            className="user-group-filter-select"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('userGroups.filters.all') },
              { value: 'with-members', label: t('userGroups.filters.withMembers') },
              { value: 'no-members', label: t('userGroups.filters.noMembers') },
              { value: 'with-permissions', label: t('userGroups.filters.withPermissions') },
              { value: 'no-permissions', label: t('userGroups.filters.noPermissions') },
            ]}
          />
          <div className="toolbar-spacer" />
          <Tag color="default">
            {t('userGroups.countTag', { filtered: filteredGroups.length, total: groups.length })}
          </Tag>
          <Button
            icon={<ReloadOutlined />}
            disabled={!connected}
            loading={loading}
            onClick={() => void loadGroups()}
          >{t('common.actions.refresh')}
          </Button>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredGroups}
          loading={loading && groups.length === 0}
          pagination={{
            defaultPageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total) => t('userGroups.totalCount', { count: total }),
          }}
          scroll={{ x: 1100 }}
          locale={{
            emptyText: (
              <Empty
                description={
                  groups.length === 0 ? t('userGroups.empty.waiting') : t('userGroups.empty.filtered')
                }
              />
            ),
          }}
        />
      </section>

      {/* 创建 / 编辑 / 复制 Modal */}
      <Modal
        title={
          editor?.mode === 'edit' ? t('userGroups.modal.editTitle') : editor?.mode === 'clone' ? t('userGroups.modal.cloneTitle') : t('userGroups.modal.createTitle')
        }
        open={Boolean(editor)}
        onCancel={() => {
          setEditor(undefined);
        }}
        onOk={() => void submitEditor()}
        confirmLoading={submitting}
        okText={t('common.actions.save')}
        cancelText={t('common.actions.cancel')}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          {editor?.mode === 'clone' ? (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              showIcon
              message={t('userGroups.cloneMode')}
              description={t('userGroups.cloneDescription', { name: editor.group?.name })}
            />
          ) : (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              showIcon
              message={t('userGroups.inheritanceTitle')}
              description={t('userGroups.inheritanceDescription')}
            />
          )}

          <Form.Item
            label={t('userGroups.modal.name')}
            name="name"
            rules={[
              { required: true, whitespace: true, message: t('userGroups.modal.nameRequired') },
              { max: 128, message: t('userGroups.modal.nameTooLong') },
            ]}
          >
            <Input autoFocus placeholder={t('userGroups.modal.namePlaceholder')} showCount maxLength={128} />
          </Form.Item>

          <Form.Item
            label={t('userGroups.modal.description')}
            name="description"
            rules={[{ max: 1024, message: t('userGroups.modal.descriptionTooLong') }]}
          >
            <Input.TextArea
              rows={4}
              placeholder={t('userGroups.modal.descriptionPlaceholder')}
              showCount
              maxLength={1024}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 删除确认 Modal */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>{t('userGroups.confirm.deleteTitle')}</span>
          </Space>
        }
        open={Boolean(deletingGroup)}
        onCancel={() => setDeletingGroup(undefined)}
        onOk={() => void deleteGroup()}
        okText={t('userGroups.confirm.deleteOk')}
        cancelText={t('common.actions.cancel')}
        confirmLoading={submitting}
        okButtonProps={{ danger: true, disabled: deleteConfirmation !== deletingGroup?.name }}
        destroyOnHidden
      >
        {deletingGroup ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Alert
              type="warning"
              showIcon
              message={t('userGroups.confirm.irreversible')}
              description={
                <div>
                  {t('userGroups.confirm.deleteImpactTitle')}
                  <ul style={{ margin: '4px 0 0 0', paddingLeft: 20 }}>
                    <li>{t('userGroups.confirm.memberImpact', { count: countLinks(deletingGroup, 'user') })}</li>
                    <li>{t('userGroups.confirm.deviceGroupImpact', { count: countLinks(deletingGroup, 'device-group') })}</li>
                    <li>{t('userGroups.confirm.deviceImpact', { count: countLinks(deletingGroup, 'device') })}</li>
                  </ul>
                </div>
              }
            />
            <p>{t('userGroups.confirm.deleteNotice', { name: deletingGroup.name })}</p>
            <p>{t('userGroups.confirm.deleteInputTip')}</p>
            <Input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              placeholder={deletingGroup.name}
              autoComplete="off"
            />
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}
