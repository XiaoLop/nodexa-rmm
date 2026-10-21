import type {
  ConnectionStatus,
  Device,
  DeviceGroup,
  ManagedUser,
  MeshCentralClient,
  MeshCentralEvent,
  UserGroup,
  UserInfo,
} from '@meshcentral/control-client';
import { Modal, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserEditSubmission } from '../../components/users/UserEditDrawer';
import { errorMessage } from './accessRows';
import { preserveLatestAccountLock } from './sitePermissions';
import {
  canChangeSiteRights,
  isCurrentUser,
  isLastActiveAdministrator,
} from './userProtection';

export type DeviceGroupPermissionDraft = { groupId: string; rights: number } | 'new';
export type DevicePermissionDraft = { deviceId: string; rights: number } | 'new';

interface UseUserDetailsOptions {
  userId?: string;
  client?: MeshCentralClient;
  status: ConnectionStatus;
  devices: Device[];
  groups: DeviceGroup[];
  userInfo?: UserInfo;
  onDeleted: () => void;
}

/**
 * Owns the user-details data lifecycle and every mutation currently performed
 * on that page. UI visibility state for the permission editors and modals lives
 * here too so the mutation handlers can keep closing them exactly like the
 * original page did.
 */
export function useUserDetails({
  userId,
  client,
  status,
  devices,
  groups,
  userInfo,
  onDeleted,
}: UseUserDetailsOptions) {
  const { t } = useTranslation();
  const [user, setUser] = useState<ManagedUser>();
  const [avatarRefreshKey, setAvatarRefreshKey] = useState(() => Date.now());
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [events, setEvents] = useState<MeshCentralEvent[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string>();
  const [permissionEditor, setPermissionEditor] = useState<DeviceGroupPermissionDraft>();
  const [devicePermissionEditor, setDevicePermissionEditor] =
    useState<DevicePermissionDraft>();
  const [editingProfile, setEditingProfile] = useState(false);
  const [sitePermissionOpen, setSitePermissionOpen] = useState(false);
  const [featureRestrictionOpen, setFeatureRestrictionOpen] = useState(false);
  const [userMutationSubmitting, setUserMutationSubmitting] = useState(false);
  const [permissionSubmitting, setPermissionSubmitting] = useState(false);
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const requestSequence = useRef(0);

  const loadDetails = useCallback(async () => {
    if (!client || status !== 'connected' || !userId) return;
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError(undefined);
    try {
      const [users, availableUserGroups, sessionCounts, userEvents] = await Promise.all([
        client.users.list(),
        client.userGroups.list().catch(() => []),
        client.users.listSessionCounts().catch(() => ({}) as Record<string, number>),
        client.events.listByUser(userId, { limit: 60 }),
      ]);
      if (sequence !== requestSequence.current) return;
      const selectedUser = users.find((item) => item.id === userId);
      if (!selectedUser) throw new Error(t('userDetails.errors.userDeleted'));
      setUser(selectedUser);
      setUserGroups(availableUserGroups);
      setSessionCount(sessionCounts[userId] ?? 0);
      setEvents(userEvents);
    } catch (error) {
      if (sequence === requestSequence.current) setLoadError(errorMessage(error, t));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [client, status, t, userId]);

  useEffect(() => {
    if (status === 'connected') void loadDetails();
    return () => {
      requestSequence.current += 1;
    };
  }, [loadDetails, status]);

  const isViewingCurrentUser = Boolean(user && isCurrentUser(user, userInfo?.id));

  useEffect(() => {
    if (isViewingCurrentUser) {
      setPermissionEditor(undefined);
      setDevicePermissionEditor(undefined);
      setSitePermissionOpen(false);
      setFeatureRestrictionOpen(false);
    }
  }, [isViewingCurrentUser]);

  const findLatestUser = async () => {
    if (!client || !user) throw new Error(t('userDetails.errors.dataNotLoaded'));
    const users = await client.users.list();
    const latest = users.find((item) => item.id === user.id);
    if (!latest) throw new Error(t('userDetails.errors.userDeletedReturn'));
    return { latest, users };
  };

  const updateUser = async ({ updates, image }: UserEditSubmission) => {
    if (!client || !user) return;
    if (!Object.keys(updates).length && !image) {
      void messageApi.info(t('userDetails.messages.profileUnchanged'));
      return;
    }
    setUserMutationSubmitting(true);
    try {
      const { latest } = await findLatestUser();
      if (Object.keys(updates).length) await client.users.update(latest.id, updates);
      if (image) client.users.updateImage(latest.id, image);
      await loadDetails();
      if (image) {
        setAvatarRefreshKey(Date.now());
      }
      setEditingProfile(false);
      void messageApi.success(t('userDetails.messages.userUpdated', { name: latest.name }));
    } catch (error) {
      void messageApi.error(t('userDetails.messages.userUpdateFailed', { detail: errorMessage(error, t) }));
      throw error;
    } finally {
      setUserMutationSubmitting(false);
    }
  };

  const saveSitePermissions = async (proposedRights: number) => {
    if (!client || !user) return;
    setUserMutationSubmitting(true);
    try {
      const { latest, users } = await findLatestUser();
      const nextRights = preserveLatestAccountLock(proposedRights, latest.siteRights);
      if (!canChangeSiteRights(latest, users, userInfo?.id, nextRights)) {
        throw new Error(
          isCurrentUser(latest, userInfo?.id)
            ? t('userDetails.errors.cannotEditCurrentPermissions')
            : t('userDetails.errors.cannotRemoveLastAdmin'),
        );
      }
      await client.users.setSiteRights(latest.id, nextRights);
      await loadDetails();
      setSitePermissionOpen(false);
      void messageApi.success(t('userDetails.messages.siteRightsUpdated', { name: latest.name }));
    } catch (error) {
      void messageApi.error(t('userDetails.messages.siteRightsFailed', { detail: errorMessage(error, t) }));
    } finally {
      setUserMutationSubmitting(false);
    }
  };

  const saveFeatureRestrictions = async (removeRights: number) => {
    if (!client || !user) return;
    setUserMutationSubmitting(true);
    try {
      const { latest } = await findLatestUser();
      if (isCurrentUser(latest, userInfo?.id)) {
        throw new Error(t('userDetails.errors.cannotEditCurrentPermissions'));
      }
      await client.users.setRemoveRights(latest.id, removeRights);
      await loadDetails();
      setFeatureRestrictionOpen(false);
      void messageApi.success(t('userDetails.messages.featureRestrictionsUpdated', { name: latest.name }));
    } catch (error) {
      void messageApi.error(t('userDetails.messages.featureRestrictionsFailed', { detail: errorMessage(error, t) }));
    } finally {
      setUserMutationSubmitting(false);
    }
  };

  const confirmLockChange = () => {
    if (!client || !user) return;
    const locking = !user.locked;
    modalApi.confirm({
      title: locking ? t('userDetails.confirm.disableTitle') : t('userDetails.confirm.enableTitle'),
      content: t(locking ? 'userDetails.confirm.disableContent' : 'userDetails.confirm.enableContent', { name: user.name }),
      okText: locking ? t('common.actions.disable') : t('common.actions.enable'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: locking },
      onOk: async () => {
        const { latest, users } = await findLatestUser();
        if (isCurrentUser(latest, userInfo?.id)) throw new Error(t('userDetails.errors.cannotChangeCurrentStatus'));
        if (locking && isLastActiveAdministrator(latest, users)) {
          throw new Error(t('userDetails.errors.cannotDisableLastAdmin'));
        }
        await client.users.setLocked(latest.id, locking, latest.siteRights);
        await loadDetails();
        void messageApi.success(t(locking ? 'userDetails.messages.userDisabled' : 'userDetails.messages.userEnabled', { name: latest.name }));
      },
    });
  };

  const confirmDeleteUser = () => {
    if (!client || !user) return;
    modalApi.confirm({
      title: t('userDetails.confirm.deleteTitle'),
      content: t('userDetails.confirm.deleteContent', { name: user.name }),
      okText: t('userDetails.confirm.deleteOk'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const { latest, users } = await findLatestUser();
        if (isCurrentUser(latest, userInfo?.id)) throw new Error(t('userDetails.errors.cannotDeleteCurrent'));
        if (isLastActiveAdministrator(latest, users)) {
          throw new Error(t('userDetails.errors.cannotDeleteLastAdmin'));
        }
        await client.users.remove(latest.id, latest.name);
        void messageApi.success(t('userDetails.messages.userDeleted', { name: latest.name }));
        onDeleted();
      },
    });
  };

  const saveDeviceGroupPermission = async ({ groupId, rights }: { groupId: string; rights: number }) => {
    if (!client || !user) return;
    if (isCurrentUser(user, userInfo?.id)) {
      setPermissionEditor(undefined);
      void messageApi.error(t('userDetails.errors.cannotEditCurrentDeviceGroups'));
      return;
    }
    const group = groups.find((item) => item.id === groupId);
    if (!group) {
      void messageApi.error(t('userDetails.errors.groupDeleted'));
      return;
    }
    setPermissionSubmitting(true);
    try {
      await client.groups.setUserRights(group.id, group.name, user.id, rights);
      await loadDetails();
      void messageApi.success(t(permissionEditor === 'new' ? 'userDetails.messages.groupAdded' : 'userDetails.messages.groupUpdated', { name: group.name }));
      setPermissionEditor(undefined);
    } catch (error) {
      void messageApi.error(t('userDetails.messages.groupSaveFailed', { detail: errorMessage(error, t) }));
    } finally {
      setPermissionSubmitting(false);
    }
  };

  const confirmDeviceGroupRemoval = (row: { id: string; name: string }) => {
    if (!client || !user) return;
    if (isCurrentUser(user, userInfo?.id)) {
      setPermissionEditor(undefined);
      void messageApi.error(t('userDetails.errors.cannotEditCurrentDeviceGroups'));
      return;
    }
    modalApi.confirm({
      title: t('userDetails.confirm.removeGroupTitle'),
      content: t('userDetails.confirm.removeGroupContent', { user: user.name, name: row.name }),
      okText: t('userDetails.actions.confirmRemove'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await client.groups.removeUser(row.id, user.id);
          await loadDetails();
          void messageApi.success(t('userDetails.messages.groupRemoved', { name: row.name }));
        } catch (error) {
          void messageApi.error(t('userDetails.messages.groupRemoveFailed', { detail: errorMessage(error, t) }));
          throw error;
        }
      },
    });
  };

  const saveDevicePermission = async ({ deviceId, rights }: { deviceId: string; rights: number }) => {
    if (!client || !user) return;
    if (isCurrentUser(user, userInfo?.id)) {
      setDevicePermissionEditor(undefined);
      void messageApi.error(t('userDetails.errors.cannotEditCurrentDevices'));
      return;
    }
    const device = devices.find((item) => item.id === deviceId);
    if (!device) {
      void messageApi.error(t('userDetails.errors.deviceDeleted'));
      return;
    }
    setPermissionSubmitting(true);
    try {
      const { latest } = await findLatestUser();
      if (isCurrentUser(latest, userInfo?.id)) throw new Error(t('userDetails.errors.cannotEditCurrentDevices'));
      await client.devices.setUserRights(device.id, latest.name, rights);
      await loadDetails();
      void messageApi.success(
        devicePermissionEditor === 'new'
          ? t('userDetails.messages.deviceAdded', { name: device.name })
          : t('userDetails.messages.deviceUpdated', { name: device.name }),
      );
      setDevicePermissionEditor(undefined);
    } catch (error) {
      void messageApi.error(t('userDetails.messages.deviceSaveFailed', { detail: errorMessage(error, t) }));
    } finally {
      setPermissionSubmitting(false);
    }
  };

  const confirmDevicePermissionRemoval = (row: { id: string; name: string }) => {
    if (!client || !user) return;
    modalApi.confirm({
      title: t('userDetails.confirm.removeDeviceTitle'),
      content: t('userDetails.confirm.removeDeviceContent', { user: user.name, name: row.name }),
      okText: t('userDetails.actions.confirmRemove'),
      cancelText: t('common.actions.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const { latest } = await findLatestUser();
        if (isCurrentUser(latest, userInfo?.id)) throw new Error(t('userDetails.errors.cannotEditCurrentDevices'));
        await client.devices.removeUser(row.id, latest.name);
        await loadDetails();
        void messageApi.success(t('userDetails.messages.deviceRemoved', { name: row.name }));
      },
    });
  };

  return {
    user,
    userGroups,
    events,
    sessionCount,
    loading,
    loadError,
    avatarRefreshKey,
    permissionEditor,
    devicePermissionEditor,
    editingProfile,
    sitePermissionOpen,
    featureRestrictionOpen,
    userMutationSubmitting,
    permissionSubmitting,
    isViewingCurrentUser,
    messageContextHolder,
    modalContextHolder,
    loadDetails,
    setPermissionEditor,
    setDevicePermissionEditor,
    setEditingProfile,
    setSitePermissionOpen,
    setFeatureRestrictionOpen,
    updateUser,
    saveSitePermissions,
    saveFeatureRestrictions,
    confirmLockChange,
    confirmDeleteUser,
    saveDeviceGroupPermission,
    confirmDeviceGroupRemoval,
    saveDevicePermission,
    confirmDevicePermissionRemoval,
  };
}
