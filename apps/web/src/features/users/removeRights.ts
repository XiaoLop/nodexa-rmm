export type FeatureRestrictionCategory = 'remote' | 'system' | 'maintenance';

export interface UserFeatureRestriction {
  flag: number;
  key: string;
  category: FeatureRestrictionCategory;
  broadImpact?: boolean;
}

export const USER_FEATURE_RESTRICTIONS: readonly UserFeatureRestriction[] = [
  // 远程访问与控制
  { flag: 0x00000008, key: 'remoteControl', category: 'remote', broadImpact: true },
  { flag: 0x00010000, key: 'desktopAccess', category: 'remote' },
  { flag: 0x00000100, key: 'remoteViewOnly', category: 'remote' },
  { flag: 0x00000200, key: 'terminalAccess', category: 'remote' },
  { flag: 0x00000400, key: 'fileAccess', category: 'remote' },

  // 系统管理与命令
  { flag: 0x00020000, key: 'remoteCommand', category: 'system' },
  { flag: 0x00400000, key: 'registryAccess', category: 'system' },
  { flag: 0x00800000, key: 'softwareAccess', category: 'system' },
  { flag: 0x00000010, key: 'agentConsole', category: 'system' },

  // 设备维护与电源
  { flag: 0x00040000, key: 'resetOff', category: 'maintenance' },
  { flag: 0x00000040, key: 'wake', category: 'maintenance' },
  { flag: 0x00008000, key: 'uninstall', category: 'maintenance' },
] as const;

export const FEATURE_RESTRICTION_CATEGORIES = [
  { key: 'remote', labelKey: 'featureRestrictions.categories.remote' },
  { key: 'system', labelKey: 'featureRestrictions.categories.system' },
  { key: 'maintenance', labelKey: 'featureRestrictions.categories.maintenance' },
] as const;

export const KNOWN_REMOVE_RIGHTS_MASK = USER_FEATURE_RESTRICTIONS.reduce(
  (mask, restriction) => (mask | restriction.flag) >>> 0,
  0,
);

export function selectedRemoveRights(removeRights: number): number[] {
  const normalized = removeRights >>> 0;
  return USER_FEATURE_RESTRICTIONS.filter(({ flag }) => (normalized & flag) !== 0).map(
    ({ flag }) => flag,
  );
}

export function composeRemoveRights(selectedFlags: number[], currentRemoveRights: number): number {
  const unknownRights = (currentRemoveRights & ~KNOWN_REMOVE_RIGHTS_MASK) >>> 0;
  return selectedFlags.reduce((rights, flag) => (rights | flag) >>> 0, unknownRights);
}

export function formatRemoveRightsHex(removeRights: number): string {
  return `0x${(removeRights >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}