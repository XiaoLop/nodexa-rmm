import {
  DEVICE_USER_ASSIGNABLE_RIGHTS_MASK,
  DEVICE_USER_GROUP_ASSIGNABLE_RIGHTS_MASK,
  MeshRight,
  canUseDeviceFiles,
  canUseTerminal,
  composeMeshRights,
  getDesktopAccess,
  hasMeshRight,
  normalizeMeshRights,
  type DesktopAccess,
} from '@meshcentral/control-client';

export const MESH_RIGHT_ADMIN = MeshRight.Administrator;
export {
  canUseDeviceFiles,
  canUseTerminal,
  composeMeshRights,
  getDesktopAccess,
  hasMeshRight,
  normalizeMeshRights,
};
export type { DesktopAccess };

export type MeshPermissionCategoryKey =
  | 'management'
  | 'access'
  | 'operations'
  | 'restrictions';

export type MeshPermission = {
  flag: number;
  labelKey: string;
  descriptionKey: string;
  category: MeshPermissionCategoryKey;
  risk?: 'high';
  /** @deprecated Use labelKey with i18n */
  label: string;
  /** @deprecated Use descriptionKey with i18n */
  description: string;
};

export const MESH_PERMISSIONS: MeshPermission[] = [
  {
    flag: 0x00000001,
    labelKey: 'permissions.mesh.editGroup.label',
    descriptionKey: 'permissions.mesh.editGroup.description',
    label: '编辑设备组',
    description: '修改设备组名称和描述',
    category: 'management',
  },
  {
    flag: 0x00000002,
    labelKey: 'permissions.mesh.manageUsers.label',
    descriptionKey: 'permissions.mesh.manageUsers.description',
    label: '管理组内用户',
    description: '添加、移除用户并修改其权限',
    category: 'management',
    risk: 'high',
  },
  {
    flag: 0x00000004,
    labelKey: 'permissions.mesh.manageDevices.label',
    descriptionKey: 'permissions.mesh.manageDevices.description',
    label: '管理设备',
    description: '编辑、删除或移动设备',
    category: 'management',
    risk: 'high',
  },
  {
    flag: 0x00000008,
    labelKey: 'permissions.mesh.remoteDesktop.label',
    descriptionKey: 'permissions.mesh.remoteDesktop.description',
    label: '远程桌面控制',
    description: '查看并控制远程桌面',
    category: 'access',
  },
  {
    flag: 0x00000010,
    labelKey: 'permissions.mesh.agentConsole.label',
    descriptionKey: 'permissions.mesh.agentConsole.description',
    label: 'Mesh Agent 控制台',
    description: '访问 Mesh Agent 调试控制台',
    category: 'access',
  },
  {
    flag: 0x00000020,
    labelKey: 'permissions.mesh.serverFiles.label',
    descriptionKey: 'permissions.mesh.serverFiles.description',
    label: '服务器文件空间',
    description: '访问服务器侧文件空间',
    category: 'access',
  },
  {
    flag: 0x00004000,
    labelKey: 'permissions.mesh.chatNotify.label',
    descriptionKey: 'permissions.mesh.chatNotify.description',
    label: '桌面通知与消息',
    description: '向设备发送通知和文本消息',
    category: 'access',
  },
  {
    flag: 0x00020000,
    labelKey: 'permissions.mesh.remoteCommand.label',
    descriptionKey: 'permissions.mesh.remoteCommand.description',
    label: '后台执行命令',
    description: '在设备上执行单次命令',
    category: 'access',
    risk: 'high',
  },
  {
    flag: 0x00000040,
    labelKey: 'permissions.mesh.wakeDevice.label',
    descriptionKey: 'permissions.mesh.wakeDevice.description',
    label: '唤醒设备',
    description: '执行 Wake-on-LAN',
    category: 'operations',
  },
  {
    flag: 0x00000080,
    labelKey: 'permissions.mesh.setNotes.label',
    descriptionKey: 'permissions.mesh.setNotes.description',
    label: '修改设备备注',
    description: '编辑设备备注信息',
    category: 'operations',
  },
  {
    flag: 0x00008000,
    labelKey: 'permissions.mesh.uninstall.label',
    descriptionKey: 'permissions.mesh.uninstall.description',
    label: '卸载 Agent',
    description: '卸载设备上的 Agent',
    category: 'operations',
    risk: 'high',
  },
  {
    flag: 0x00040000,
    labelKey: 'permissions.mesh.resetOff.label',
    descriptionKey: 'permissions.mesh.resetOff.description',
    label: '重启与关机',
    description: '执行电源管理操作',
    category: 'operations',
    risk: 'high',
  },
  {
    flag: 0x00080000,
    labelKey: 'permissions.mesh.guestSharing.label',
    descriptionKey: 'permissions.mesh.guestSharing.description',
    label: '访客分享',
    description: '创建临时访客分享链接',
    category: 'operations',
  },
  {
    flag: 0x00100000,
    labelKey: 'permissions.mesh.deviceDetails.label',
    descriptionKey: 'permissions.mesh.deviceDetails.description',
    label: '查看设备详情',
    description: '查看硬件和系统详情',
    category: 'operations',
  },
  {
    flag: 0x00200000,
    labelKey: 'permissions.mesh.relay.label',
    descriptionKey: 'permissions.mesh.relay.description',
    label: 'Web Relay',
    description: '创建端口中继映射',
    category: 'operations',
  },
  {
    flag: 0x00000100,
    labelKey: 'permissions.mesh.remoteViewOnly.label',
    descriptionKey: 'permissions.mesh.remoteViewOnly.description',
    label: '远程桌面仅查看',
    description: '桌面会话仅允许查看',
    category: 'restrictions',
  },
  {
    flag: 0x00000200,
    labelKey: 'permissions.mesh.noTerminal.label',
    descriptionKey: 'permissions.mesh.noTerminal.description',
    label: '禁用终端',
    description: '明确禁止终端访问',
    category: 'restrictions',
  },
  {
    flag: 0x00000400,
    labelKey: 'permissions.mesh.noFiles.label',
    descriptionKey: 'permissions.mesh.noFiles.description',
    label: '禁用文件访问',
    description: '明确禁止远程文件访问',
    category: 'restrictions',
  },
  {
    flag: 0x00000800,
    labelKey: 'permissions.mesh.noAmt.label',
    descriptionKey: 'permissions.mesh.noAmt.description',
    label: '禁用 Intel AMT',
    description: '禁止 Intel AMT 功能',
    category: 'restrictions',
  },
  {
    flag: 0x00001000,
    labelKey: 'permissions.mesh.desktopLimitedInput.label',
    descriptionKey: 'permissions.mesh.desktopLimitedInput.description',
    label: '限制桌面输入',
    description: '限制远程桌面键鼠输入',
    category: 'restrictions',
  },
  {
    flag: 0x00002000,
    labelKey: 'permissions.mesh.limitEvents.label',
    descriptionKey: 'permissions.mesh.limitEvents.description',
    label: '限制事件查看',
    description: '限制设备事件日志范围',
    category: 'restrictions',
  },
  {
    flag: 0x00010000,
    labelKey: 'permissions.mesh.noDesktop.label',
    descriptionKey: 'permissions.mesh.noDesktop.description',
    label: '禁用远程桌面',
    description: '明确禁止远程桌面访问',
    category: 'restrictions',
  },
  {
    flag: 0x00400000,
    labelKey: 'permissions.mesh.noRegistry.label',
    descriptionKey: 'permissions.mesh.noRegistry.description',
    label: '禁用注册表',
    description: '禁止使用注册表编辑器',
    category: 'restrictions',
  },
  {
    flag: 0x00800000,
    labelKey: 'permissions.mesh.noSoftware.label',
    descriptionKey: 'permissions.mesh.noSoftware.description',
    label: '禁用软件管理',
    description: '禁止管理已安装软件',
    category: 'restrictions',
  },
];

export const MESH_PERMISSION_CATEGORIES = [
  { key: 'management', labelKey: 'permissions.categories.meshManagement', label: '设备组管理' },
  { key: 'access', labelKey: 'permissions.categories.meshAccess', label: '远程访问' },
  { key: 'operations', labelKey: 'permissions.categories.meshOperations', label: '设备操作' },
  {
    key: 'restrictions',
    labelKey: 'permissions.categories.restrictions',
    label: '限制项（选中即限制）',
  },
] as const;

function permissionsWithinMask(mask: number): MeshPermission[] {
  return MESH_PERMISSIONS.filter(({ flag }) => (flag & mask) === flag);
}

export const DEVICE_USER_PERMISSIONS = permissionsWithinMask(
  DEVICE_USER_ASSIGNABLE_RIGHTS_MASK,
);

export const DEVICE_USER_GROUP_PERMISSIONS = permissionsWithinMask(
  DEVICE_USER_GROUP_ASSIGNABLE_RIGHTS_MASK,
);

/** @deprecated Use the subject-specific device permission collection. */
export const DEVICE_PERMISSIONS = DEVICE_USER_PERMISSIONS;

export const DEVICE_PERMISSION_CATEGORIES = MESH_PERMISSION_CATEGORIES.filter(({ key }) =>
  DEVICE_PERMISSIONS.some((permission) => permission.category === key),
);

/** @deprecated Use DEVICE_USER_ASSIGNABLE_RIGHTS_MASK from control-client. */
export const DEVICE_RIGHT_FULL = DEVICE_USER_ASSIGNABLE_RIGHTS_MASK;

export const MESH_PERMISSION_PRESETS = [
  {
    key: 'remote-access',
    labelKey: 'permissions.presets.remoteAccess',
    label: '远程桌面、终端和设备文件',
    rights: MeshRight.RemoteControl,
  },
  {
    key: 'desktop-only',
    labelKey: 'permissions.presets.desktopOnly',
    label: '仅远程桌面',
    rights: MeshRight.RemoteControl | MeshRight.NoTerminal | MeshRight.NoFiles,
  },
  {
    key: 'files-only',
    labelKey: 'permissions.presets.filesOnly',
    label: '仅设备文件管理',
    rights: MeshRight.RemoteControl | MeshRight.NoTerminal | MeshRight.NoDesktop,
  },
  {
    key: 'desktop-readonly',
    labelKey: 'permissions.presets.desktopReadonly',
    label: '桌面只读',
    rights:
      MeshRight.RemoteControl |
      MeshRight.RemoteViewOnly |
      MeshRight.NoTerminal |
      MeshRight.NoFiles,
  },
] as const;

export interface MeshRightsSummary {
  kind: 'admin' | 'groupOnly' | 'custom';
  permissionKeys: string[];
  totalCount: number;
}

export function getMeshRightsSummary(rights: number): MeshRightsSummary {
  const normalized = normalizeMeshRights(rights);
  if (normalized === MESH_RIGHT_ADMIN) {
    return { kind: 'admin', permissionKeys: [], totalCount: 0 };
  }
  const selected = MESH_PERMISSIONS.filter(({ flag }) => (normalized & flag) === flag);
  if (!selected.length) {
    return { kind: 'groupOnly', permissionKeys: [], totalCount: 0 };
  }
  return {
    kind: 'custom',
    permissionKeys: selected.map(({ labelKey }) => labelKey),
    totalCount: selected.length,
  };
}

export function summarizeMeshRights(
  rights: number,
  t?: (key: string, options?: Record<string, unknown>) => string,
): string {
  const summary = getMeshRightsSummary(rights);
  if (!t) {
    if (summary.kind === 'admin') return '全部权限';
    if (summary.kind === 'groupOnly') return '仅设备组可见';
    const normalized = normalizeMeshRights(rights);
    const selected = MESH_PERMISSIONS.filter(({ flag }) => (normalized & flag) === flag);
    if (selected.length <= 2) return selected.map(({ label }) => label).join('、');
    return `${selected.slice(0, 2).map(({ label }) => label).join('、')}等 ${selected.length} 项`;
  }

  if (summary.kind === 'admin') return t('permissions.summary.allRights');
  if (summary.kind === 'groupOnly') return t('permissions.summary.groupOnly');

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
