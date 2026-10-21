import {
  ApartmentOutlined,
  DesktopOutlined,
  LaptopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  SiteRight,
  hasSiteRight,
  isSiteAdministrator,
} from '@meshcentral/control-client';
import { Alert, Button, Empty, Tabs, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AddMembersModal } from '../components/user-groups/AddMembersModal';
import { DeleteUserGroupModal } from '../components/user-groups/DeleteUserGroupModal';
import {
  EditUserGroupModal,
  type EditUserGroupValues,
} from '../components/user-groups/EditUserGroupModal';
import { UserGroupDeviceGroupTab } from '../components/user-groups/UserGroupDeviceGroupTab';
import { UserGroupDeviceTab } from '../components/user-groups/UserGroupDeviceTab';
import { UserGroupHeader } from '../components/user-groups/UserGroupHeader';
import { UserGroupLoadingSkeleton } from '../components/user-groups/UserGroupLoadingSkeleton';
import { UserGroupMembersTab } from '../components/user-groups/UserGroupMembersTab';
import { UserGroupOverviewPanel } from '../components/user-groups/UserGroupOverviewPanel';
import { UserGroupPermissionModals } from '../components/user-groups/UserGroupPermissionModals';
import { useMeshCentralControlData } from '../features/gateway';
import { useUserGroupDetails } from '../features/user-groups/useUserGroupDetails';
import '../assets/styles/user-details.css';

export function UserGroupDetailsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userGroupId } = useParams();
  const decodedId = userGroupId ? decodeURIComponent(userGroupId) : '';
  const { client, status, userInfo } = useMeshCentralControlData();
  const [messageApi, messageContextHolder] = message.useMessage();
  const details = useUserGroupDetails(decodedId, messageApi);
  const group = details.group;

  const connected = Boolean(client && status === 'connected');
  const canManage = Boolean(
    userInfo &&
      (isSiteAdministrator(userInfo.siteadmin ?? 0) ||
        hasSiteRight(userInfo.siteadmin ?? 0, SiteRight.ManageUserGroups)),
  );
  const canWrite = connected && canManage;

  if (details.loading && !group) return <UserGroupLoadingSkeleton />;

  if (details.loadError) {
    return (
      <main className="page-stack user-details-page">
        <nav className="user-detail-breadcrumb" aria-label={t('userGroups.details.breadcrumb')}>
          <button onClick={() => navigate('/admin/roles')}>{t('navigation.userGroups')}</button>
          <span>›</span>
          <strong>{t('userGroups.details.loadFailed')}</strong>
        </nav>
        <Alert
          type="error"
          showIcon
          title={t('userGroups.details.loadFailed')}
          description={details.loadError}
          action={
            <Button onClick={() => void details.loadDetails()}>{t('common.actions.retry')}</Button>
          }
        />
      </main>
    );
  }

  if (!group) {
    return (
      <Empty description={t('userGroups.details.notFound')} style={{ marginTop: 60 }}>
        <Button type="primary" onClick={() => navigate('/admin/roles')}>
          {t('userGroups.details.backToList')}
        </Button>
      </Empty>
    );
  }

  const updateGroup = (values: EditUserGroupValues) =>
    details.mutate(
      () => client!.userGroups.update(group.id, values),
      t('userGroups.details.actions.updateGroup'),
    );

  const deleteGroup = async () => {
    const succeeded = await details.mutate(
      () => client!.userGroups.remove(group.id),
      t('common.actions.delete'),
    );
    if (succeeded) navigate('/admin/roles');
  };

  return (
    <main className="page-stack user-details-page">
      {messageContextHolder}

      <UserGroupHeader
        group={group} memberCount={details.memberLinks.length}
        groupCount={details.groupLinks.length} deviceCount={details.deviceLinks.length}
        canWrite={canWrite} onEdit={details.openEditModal}
        onAddMember={details.openMemberModal} onDelete={details.openDeleteModal}
        onCopyId={details.handleCopyId}
      >
        {!connected ? (
          <Alert type="warning" showIcon title={t('userGroups.details.gatewayDisconnected')}
            description={t('userGroups.details.gatewayDisconnectedDescription')} />
        ) : null}
        {connected && !canManage ? (
          <Alert type="info" showIcon title={t('userGroups.details.readOnly')}
            description={t('userGroups.details.readOnlyDescription')} />
        ) : null}
      </UserGroupHeader>
      <Tabs
        activeKey={details.activeTab}
        onChange={details.setActiveTab}
        items={[
          {
            key: 'overview',
            label: (
              <span>
                <LaptopOutlined /> {t('userGroups.details.tabs.overview')}
              </span>
            ),
            children: (
              <UserGroupOverviewPanel
                memberLinks={details.memberLinks} groupLinks={details.groupLinks} deviceLinks={details.deviceLinks}
                users={details.users} groups={details.groups} devices={details.devices}
                onSelectTab={details.setActiveTab}
              />
            ),
          },
          {
            key: 'members',
            label: (
              <span>
                <TeamOutlined /> {t('userGroups.details.tabs.members', { count: details.memberLinks.length })}
              </span>
            ),
            children: (
              <UserGroupMembersTab
                groupName={group.name} links={details.memberLinks} filteredLinks={details.filteredMemberLinks}
                users={details.users} canWrite={canWrite} search={details.memberSearch}
                onSearchChange={details.setMemberSearch} onAddMember={details.openMemberModal}
                onRemoveMember={details.removeMember}
              />
            ),
          },
          {
            key: 'groups',
            label: (
              <span>
                <ApartmentOutlined /> {t('userGroups.details.tabs.groups', { count: details.groupLinks.length })}
              </span>
            ),
            children: (
              <UserGroupDeviceGroupTab
                links={details.groupLinks} filteredLinks={details.filteredGroupLinks} groups={details.groups}
                canWrite={canWrite} search={details.groupPermSearch} onSearchChange={details.setGroupPermSearch}
                onAddGrant={() => details.setGroupPermissionEditor('new')}
                onEditGrant={(link) => details.setGroupPermissionEditor({ groupId: link.id, rights: link.rights })}
                onRemoveGrant={details.removeGroupGrant}
              />
            ),
          },
          {
            key: 'devices',
            label: (
              <span>
                <DesktopOutlined /> {t('userGroups.details.tabs.devices', { count: details.deviceLinks.length })}
              </span>
            ),
            children: (
              <UserGroupDeviceTab
                links={details.deviceLinks} filteredLinks={details.filteredDeviceLinks} devices={details.devices}
                canWrite={canWrite} search={details.devicePermSearch} onSearchChange={details.setDevicePermSearch}
                onAddGrant={() => details.setDevicePermissionEditor('new')}
                onEditGrant={(link) => details.setDevicePermissionEditor({ deviceId: link.id, rights: link.rights })}
                onRemoveGrant={details.removeDeviceGrant}
              />
            ),
          },
        ]}
      />

      <AddMembersModal
        open={details.memberModalOpen} groupName={group.name}
        availableUsers={details.availableUsers} selectedUsernames={details.selectedUsernames}
        submitting={details.submitting} onSelectionChange={details.setSelectedUsernames}
        onClose={details.closeMemberModal} onSubmit={details.addMembers}
      />

      <EditUserGroupModal
        open={details.editOpen} group={group} submitting={details.submitting}
        onClose={details.closeEditModal} onSubmit={updateGroup}
      />

      <DeleteUserGroupModal
        open={details.deleteOpen} group={group}
        memberCount={details.memberLinks.length} groupCount={details.groupLinks.length}
        deviceCount={details.deviceLinks.length} confirmation={details.deleteConfirmation}
        submitting={details.submitting} onConfirmationChange={details.setDeleteConfirmation}
        onClose={details.closeDeleteModal} onSubmit={deleteGroup}
      />

      <UserGroupPermissionModals
        canWrite={canWrite} groups={details.groups} devices={details.devices}
        currentGroupIds={details.groupLinks.map((link) => link.id)}
        currentDeviceIds={details.deviceLinks.map((link) => link.id)}
        groupEditor={details.groupPermissionEditor} deviceEditor={details.devicePermissionEditor}
        submitting={details.submitting} onGroupCancel={() => details.setGroupPermissionEditor(undefined)}
        onDeviceCancel={() => details.setDevicePermissionEditor(undefined)}
        onGroupSubmit={details.saveGroupPermission} onDeviceSubmit={details.saveDevicePermission}
      />
    </main>
  );
}
