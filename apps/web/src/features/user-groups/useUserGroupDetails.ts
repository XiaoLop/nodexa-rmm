import type {
  ManagedUser,
  UserGroup,
  UserGroupLink,
} from '@meshcentral/control-client';
import type { MessageInstance } from 'antd/es/message/interface';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeshCentralControlData } from '../gateway';
import {
  filterDeviceLinks,
  filterGroupLinks,
  filterMemberLinks,
} from './userGroupFilters';

export type GroupPermissionEditor = 'new' | { groupId: string; rights: number };
export type DevicePermissionEditor = 'new' | { deviceId: string; rights: number };

function errorMessage(error: unknown, unknownText: string): string {
  return error instanceof Error ? error.message : unknownText;
}

export function useUserGroupDetails(decodedId: string, messageApi: MessageInstance) {
  const { t, i18n } = useTranslation();
  const { client, status, groups, devices } = useMeshCentralControlData();
  const [group, setGroup] = useState<UserGroup>();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  // Tabs & searches
  const [activeTab, setActiveTab] = useState('overview');
  const [memberSearch, setMemberSearch] = useState('');
  const [groupPermSearch, setGroupPermSearch] = useState('');
  const [devicePermSearch, setDevicePermSearch] = useState('');

  // Modals
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [groupPermissionEditor, setGroupPermissionEditor] = useState<GroupPermissionEditor>();
  const [devicePermissionEditor, setDevicePermissionEditor] = useState<DevicePermissionEditor>();

  const requestSequence = useRef(0);

  const loadDetails = useCallback(async () => {
    if (!client || status !== 'connected' || !decodedId) return;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError(undefined);
    try {
      const [availableGroups, availableUsers] = await Promise.all([
        client.userGroups.list(),
        client.users.list(),
      ]);
      if (sequence !== requestSequence.current) return;
      const targetGroup = availableGroups.find((item) => item.id === decodedId);
      setGroup(targetGroup);
      setUsers(availableUsers);
    } catch (error) {
      if (sequence === requestSequence.current) {
        setLoadError(errorMessage(error, t('common.status.unknown')));
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [client, decodedId, status, t]);

  useEffect(() => {
    if (status === 'connected') void loadDetails();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadDetails, status]);

  const memberLinks = useMemo(
    () => group?.links.filter((link) => link.type === 'user') ?? [],
    [group],
  );
  const groupLinks = useMemo(
    () => group?.links.filter((link) => link.type === 'device-group') ?? [],
    [group],
  );
  const deviceLinks = useMemo(
    () => group?.links.filter((link) => link.type === 'device') ?? [],
    [group],
  );

  const memberIds = useMemo(() => new Set(memberLinks.map((link) => link.id)), [memberLinks]);
  const availableUsers = useMemo(
    () =>
      users
        .filter((user) => !memberIds.has(user.id))
        .sort((a, b) => a.name.localeCompare(b.name, i18n.resolvedLanguage ?? i18n.language)),
    [i18n.language, i18n.resolvedLanguage, memberIds, users],
  );

  const filteredMemberLinks = useMemo(
    () => filterMemberLinks(memberLinks, users, memberSearch),
    [memberLinks, memberSearch, users],
  );
  const filteredGroupLinks = useMemo(
    () => filterGroupLinks(groupLinks, groups, groupPermSearch),
    [groupLinks, groupPermSearch, groups],
  );
  const filteredDeviceLinks = useMemo(
    () => filterDeviceLinks(deviceLinks, devices, devicePermSearch),
    [deviceLinks, devicePermSearch, devices],
  );

  const mutate = async (operation: () => Promise<unknown>, success: string) => {
    setSubmitting(true);
    try {
      await operation();
      await loadDetails();
      void messageApi.success(success);
      return true;
    } catch (error) {
      void messageApi.error(
        `${success}: ${errorMessage(error, t('common.status.unknown'))}`,
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyId = () => {
    if (!group) return;
    navigator.clipboard
      .writeText(group.id)
      .then(() => void messageApi.success(t('common.actions.copied')))
      .catch(() => void messageApi.info(group.id));
  };

  const addMembers = async () => {
    if (!client || !group || selectedUsernames.length === 0) return;
    const succeeded = await mutate(
      () => client.userGroups.addUsers(group.id, selectedUsernames),
      t('userGroups.details.actions.addMember'),
    );
    if (succeeded) {
      setMemberModalOpen(false);
      setSelectedUsernames([]);
    }
  };

  const removeMember = (link: UserGroupLink) => {
    if (!client || !group) return Promise.resolve(false);
    return mutate(
      () => client.userGroups.removeUser(group.id, link.id),
      t('userGroups.details.actions.removeMember'),
    );
  };

  const removeGroupGrant = (link: UserGroupLink) => {
    if (!client || !group) return Promise.resolve(false);
    return mutate(
      () => client.groups.removeUserGroup(link.id, group.id),
      t('userGroups.details.confirm.removeGroupTitle'),
    );
  };

  const removeDeviceGrant = (link: UserGroupLink) => {
    if (!client || !group) return Promise.resolve(false);
    return mutate(
      () => client.devices.removeUserGroup(link.id, group.id),
      t('userGroups.details.confirm.removeDeviceTitle'),
    );
  };

  const saveGroupPermission = async (value: { groupId: string; rights: number }) => {
    if (!client || !group) return;
    const target = groups.find((item) => item.id === value.groupId);
    if (!target) throw new Error(t('userGroups.details.errors.groupDeleted'));
    const succeeded = await mutate(
      () => client.groups.setUserGroupRights(target.id, target.name, group.id, value.rights),
      t('userGroups.details.actions.saveGroupPermissions'),
    );
    if (succeeded) setGroupPermissionEditor(undefined);
  };

  const saveDevicePermission = async (value: { deviceId: string; rights: number }) => {
    if (!client || !group) return;
    const target = devices.find((item) => item.id === value.deviceId);
    if (!target) throw new Error(t('userGroups.details.errors.deviceDeleted'));
    const succeeded = await mutate(
      () => client.devices.setUserGroupRights(target.id, target.name, group.id, value.rights),
      t('userGroups.details.actions.saveDevicePermissions'),
    );
    if (succeeded) setDevicePermissionEditor(undefined);
  };

  const openMemberModal = () => setMemberModalOpen(true);
  const closeMemberModal = () => setMemberModalOpen(false);
  const openEditModal = () => setEditOpen(true);
  const closeEditModal = () => setEditOpen(false);
  const openDeleteModal = () => {
    setDeleteConfirmation('');
    setDeleteOpen(true);
  };
  const closeDeleteModal = () => setDeleteOpen(false);

  return {
    group,
    users,
    groups,
    devices,
    loading,
    loadError,
    submitting,
    memberLinks,
    groupLinks,
    deviceLinks,
    availableUsers,
    filteredMemberLinks,
    filteredGroupLinks,
    filteredDeviceLinks,
    memberSearch,
    setMemberSearch,
    groupPermSearch,
    setGroupPermSearch,
    devicePermSearch,
    setDevicePermSearch,
    activeTab,
    setActiveTab,
    memberModalOpen,
    openMemberModal,
    closeMemberModal,
    selectedUsernames,
    setSelectedUsernames,
    editOpen,
    openEditModal,
    closeEditModal,
    deleteOpen,
    openDeleteModal,
    closeDeleteModal,
    deleteConfirmation,
    setDeleteConfirmation,
    groupPermissionEditor,
    setGroupPermissionEditor,
    devicePermissionEditor,
    setDevicePermissionEditor,
    mutate,
    addMembers,
    removeMember,
    removeGroupGrant,
    removeDeviceGrant,
    saveGroupPermission,
    saveDevicePermission,
    handleCopyId,
    loadDetails,
  };
}
