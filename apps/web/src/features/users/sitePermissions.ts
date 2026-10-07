import {
  SiteRight,
  composeRights,
  hasSiteRight,
  isSiteAdministrator,
  normalizeRights,
} from '@meshcentral/control-client';

export type SitePermissionCategoryKey =
  | 'management'
  | 'server'
  | 'visibility'
  | 'restrictions';

export type SitePermission = {
  flag: number;
  labelKey: string;
  descriptionKey: string;
  category: SitePermissionCategoryKey;
  risk?: 'high';
  /** @deprecated Use labelKey with i18n */
  label: string;
  /** @deprecated Use descriptionKey with i18n */
  description: string;
};

export const SITE_RIGHT_ADMIN = SiteRight.Administrator;

export const SITE_PERMISSIONS: SitePermission[] = [
  {
    flag: SiteRight.ManageUsers,
    labelKey: 'permissions.site.manageUsers.label',
    descriptionKey: 'permissions.site.manageUsers.description',
    label: '管理用户',
    description: '创建、编辑和删除用户账户',
    category: 'management',
    risk: 'high',
  },
  {
    flag: SiteRight.ManageUserGroups,
    labelKey: 'permissions.site.manageUserGroups.label',
    descriptionKey: 'permissions.site.manageUserGroups.description',
    label: '管理用户组',
    description: '创建、编辑和删除用户组',
    category: 'management',
    risk: 'high',
  },
  {
    flag: SiteRight.ServerBackup,
    labelKey: 'permissions.site.serverBackup.label',
    descriptionKey: 'permissions.site.serverBackup.description',
    label: '服务器备份',
    description: '创建和下载服务器备份',
    category: 'server',
    risk: 'high',
  },
  {
    flag: SiteRight.ServerRestore,
    labelKey: 'permissions.site.serverRestore.label',
    descriptionKey: 'permissions.site.serverRestore.description',
    label: '服务器恢复',
    description: '从备份恢复服务器数据',
    category: 'server',
    risk: 'high',
  },
  {
    flag: SiteRight.ServerUpdate,
    labelKey: 'permissions.site.serverUpdate.label',
    descriptionKey: 'permissions.site.serverUpdate.description',
    label: '服务器更新',
    description: '执行 Nodex RMM 服务器更新',
    category: 'server',
    risk: 'high',
  },
  {
    flag: SiteRight.FileAccess,
    labelKey: 'permissions.site.fileAccess.label',
    descriptionKey: 'permissions.site.fileAccess.description',
    label: '服务器文件访问',
    description: '访问服务器端文件功能',
    category: 'server',
  },
  {
    flag: SiteRight.Recordings,
    labelKey: 'permissions.site.recordings.label',
    descriptionKey: 'permissions.site.recordings.description',
    label: '查看录制',
    description: '访问远程会话录制内容',
    category: 'visibility',
  },
  {
    flag: SiteRight.AllEvents,
    labelKey: 'permissions.site.allEvents.label',
    descriptionKey: 'permissions.site.allEvents.description',
    label: '查看全部事件',
    description: '查看所有用户和设备的事件',
    category: 'visibility',
  },
  {
    flag: SiteRight.LockSettings,
    labelKey: 'permissions.site.lockSettings.label',
    descriptionKey: 'permissions.site.lockSettings.description',
    label: '锁定设置',
    description: '限制账户修改相关设置',
    category: 'restrictions',
  },
  {
    flag: SiteRight.NoNewGroups,
    labelKey: 'permissions.site.noNewGroups.label',
    descriptionKey: 'permissions.site.noNewGroups.description',
    label: '禁止新建设备组',
    description: '禁止该用户创建新的设备组',
    category: 'restrictions',
  },
  {
    flag: SiteRight.NoMeshCommand,
    labelKey: 'permissions.site.noMeshCommand.label',
    descriptionKey: 'permissions.site.noMeshCommand.description',
    label: '禁止设备组命令',
    description: '禁止该用户执行设备组命令',
    category: 'restrictions',
  },
  {
    flag: SiteRight.NoNewDevices,
    labelKey: 'permissions.site.noNewDevices.label',
    descriptionKey: 'permissions.site.noNewDevices.description',
    label: '禁止添加设备',
    description: '禁止该用户添加新的设备',
    category: 'restrictions',
  },
];

export const SITE_PERMISSION_CATEGORIES = [
  { key: 'management', labelKey: 'permissions.categories.management', label: '账户管理' },
  { key: 'server', labelKey: 'permissions.categories.server', label: '服务器管理' },
  { key: 'visibility', labelKey: 'permissions.categories.visibility', label: '数据访问' },
  {
    key: 'restrictions',
    labelKey: 'permissions.categories.restrictions',
    label: '限制项（选中即限制）',
  },
] as const;

export function selectedSitePermissionFlags(rights: number): number[] {
  if (isSiteAdministrator(rights)) return [];
  const normalized = normalizeRights(rights);
  return SITE_PERMISSIONS.filter(({ flag }) => hasSiteRight(normalized, flag)).map(
    ({ flag }) => flag,
  );
}

export function composeEditableSiteRights(
  flags: readonly number[],
  fullAdministrator: boolean,
  currentRights: number,
): number {
  if (fullAdministrator) return SITE_RIGHT_ADMIN;
  const locked =
    !isSiteAdministrator(currentRights) && hasSiteRight(currentRights, SiteRight.Locked)
      ? SiteRight.Locked
      : 0;
  return (composeRights(flags) | locked) >>> 0;
}

export function preserveLatestAccountLock(
  proposedRights: number,
  latestRights: number,
): number {
  if (isSiteAdministrator(proposedRights)) return SITE_RIGHT_ADMIN;
  const withoutLock = normalizeRights(proposedRights) & ~SiteRight.Locked;
  const locked =
    !isSiteAdministrator(latestRights) && hasSiteRight(latestRights, SiteRight.Locked)
      ? SiteRight.Locked
      : 0;
  return (withoutLock | locked) >>> 0;
}

export interface SiteRightsSummary {
  kind: 'admin' | 'lockedNone' | 'none' | 'custom';
  permissionKeys: string[];
  totalCount: number;
}

export function getSiteRightsSummary(rights: number): SiteRightsSummary {
  if (isSiteAdministrator(rights)) {
    return { kind: 'admin', permissionKeys: [], totalCount: 0 };
  }
  const selected = SITE_PERMISSIONS.filter(({ flag }) => hasSiteRight(rights, flag));
  if (!selected.length) {
    return {
      kind: hasSiteRight(rights, SiteRight.Locked) ? 'lockedNone' : 'none',
      permissionKeys: [],
      totalCount: 0,
    };
  }
  return {
    kind: 'custom',
    permissionKeys: selected.map(({ labelKey }) => labelKey),
    totalCount: selected.length,
  };
}

export function summarizeSiteRights(
  rights: number,
  t?: (key: string, options?: Record<string, unknown>) => string,
): string {
  const summary = getSiteRightsSummary(rights);
  if (!t) {
    if (summary.kind === 'admin') return '全站管理员';
    if (summary.kind === 'lockedNone') return '已锁定，无站点权限';
    if (summary.kind === 'none') return '无站点权限';
    const selected = SITE_PERMISSIONS.filter(({ flag }) => hasSiteRight(rights, flag));
    if (selected.length <= 2) return selected.map(({ label }) => label).join('、');
    return `${selected.slice(0, 2).map(({ label }) => label).join('、')}等 ${selected.length} 项`;
  }

  if (summary.kind === 'admin') return t('permissions.summary.siteAdmin');
  if (summary.kind === 'lockedNone') return t('permissions.summary.lockedNoSiteRights');
  if (summary.kind === 'none') return t('permissions.summary.noSiteRights');

  const translatedLabels = summary.permissionKeys.map((key) => t(key));
  const separator = t('permissions.summary.separator');
  if (translatedLabels.length <= 2) {
    return translatedLabels.join(separator);
  }
  return t('permissions.summary.itemsAndMore', {
    items: translatedLabels.slice(0, 2).join(separator),
    count: translatedLabels.length,
  });
}