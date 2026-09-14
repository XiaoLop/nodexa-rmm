import {
  SiteRight,
  composeRights,
  hasSiteRight,
  isSiteAdministrator,
  normalizeRights,
} from '@meshcentral/control-client';

export type SitePermission = {
  flag: number;
  label: string;
  description: string;
  category: 'management' | 'server' | 'visibility' | 'restrictions';
  risk?: 'high';
};

export const SITE_RIGHT_ADMIN = SiteRight.Administrator;

export const SITE_PERMISSIONS: SitePermission[] = [
  { flag: SiteRight.ManageUsers, label: '管理用户', description: '创建、编辑和删除用户账户', category: 'management', risk: 'high' },
  { flag: SiteRight.ManageUserGroups, label: '管理用户组', description: '创建、编辑和删除用户组', category: 'management', risk: 'high' },
  { flag: SiteRight.ServerBackup, label: '服务器备份', description: '创建和下载服务器备份', category: 'server', risk: 'high' },
  { flag: SiteRight.ServerRestore, label: '服务器恢复', description: '从备份恢复服务器数据', category: 'server', risk: 'high' },
  { flag: SiteRight.ServerUpdate, label: '服务器更新', description: '执行 MeshCentral 服务器更新', category: 'server', risk: 'high' },
  { flag: SiteRight.FileAccess, label: '服务器文件访问', description: '访问服务器端文件功能', category: 'server' },
  { flag: SiteRight.Recordings, label: '查看录制', description: '访问远程会话录制内容', category: 'visibility' },
  { flag: SiteRight.AllEvents, label: '查看全部事件', description: '查看所有用户和设备的事件', category: 'visibility' },
  { flag: SiteRight.LockSettings, label: '锁定设置', description: '限制账户修改相关设置', category: 'restrictions' },
  { flag: SiteRight.NoNewGroups, label: '禁止新建设备组', description: '禁止该用户创建新的设备组', category: 'restrictions' },
  { flag: SiteRight.NoMeshCommand, label: '禁止设备组命令', description: '禁止该用户执行设备组命令', category: 'restrictions' },
  { flag: SiteRight.NoNewDevices, label: '禁止添加设备', description: '禁止该用户添加新的设备', category: 'restrictions' },
];

export const SITE_PERMISSION_CATEGORIES = [
  { key: 'management', label: '账户管理' },
  { key: 'server', label: '服务器管理' },
  { key: 'visibility', label: '数据访问' },
  { key: 'restrictions', label: '限制项（选中即限制）' },
] as const;

export function selectedSitePermissionFlags(rights: number): number[] {
  if (isSiteAdministrator(rights)) return [];
  const normalized = normalizeRights(rights);
  return SITE_PERMISSIONS.filter(({ flag }) => hasSiteRight(normalized, flag)).map(({ flag }) => flag);
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

export function preserveLatestAccountLock(proposedRights: number, latestRights: number): number {
  if (isSiteAdministrator(proposedRights)) return SITE_RIGHT_ADMIN;
  const withoutLock = normalizeRights(proposedRights) & ~SiteRight.Locked;
  const locked =
    !isSiteAdministrator(latestRights) && hasSiteRight(latestRights, SiteRight.Locked)
      ? SiteRight.Locked
      : 0;
  return (withoutLock | locked) >>> 0;
}

export function summarizeSiteRights(rights: number): string {
  if (isSiteAdministrator(rights)) return '全站管理员';
  const selected = SITE_PERMISSIONS.filter(({ flag }) => hasSiteRight(rights, flag));
  if (!selected.length) return hasSiteRight(rights, SiteRight.Locked) ? '已锁定，无站点权限' : '无站点权限';
  if (selected.length <= 2) return selected.map(({ label }) => label).join('、');
  return `${selected.slice(0, 2).map(({ label }) => label).join('、')}等 ${selected.length} 项`;
}