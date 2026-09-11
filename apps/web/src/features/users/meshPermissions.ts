export const MESH_RIGHT_ADMIN = 0xffffffff;

export type MeshPermission = {
  flag: number;
  label: string;
  description: string;
  category: 'management' | 'access' | 'operations' | 'restrictions';
  risk?: 'high';
};

export const MESH_PERMISSIONS: MeshPermission[] = [
  { flag: 0x00000001, label: '编辑设备组', description: '修改设备组名称和描述', category: 'management' },
  { flag: 0x00000002, label: '管理组内用户', description: '添加、移除用户并修改其权限', category: 'management', risk: 'high' },
  { flag: 0x00000004, label: '管理设备', description: '编辑、删除或移动设备', category: 'management', risk: 'high' },
  { flag: 0x00000008, label: '远程桌面控制', description: '查看并控制远程桌面', category: 'access' },
  { flag: 0x00000010, label: '终端控制台', description: '使用终端或命令 Shell', category: 'access' },
  { flag: 0x00000020, label: '远程文件管理', description: '上传、下载和管理文件', category: 'access' },
  { flag: 0x00004000, label: '桌面通知与消息', description: '向设备发送通知和文本消息', category: 'access' },
  { flag: 0x00020000, label: '后台执行命令', description: '在设备上执行单次命令', category: 'access', risk: 'high' },
  { flag: 0x00000040, label: '唤醒设备', description: '执行 Wake-on-LAN', category: 'operations' },
  { flag: 0x00000080, label: '修改设备备注', description: '编辑设备备注信息', category: 'operations' },
  { flag: 0x00008000, label: '卸载 Agent', description: '卸载设备上的 Agent', category: 'operations', risk: 'high' },
  { flag: 0x00040000, label: '重启与关机', description: '执行电源管理操作', category: 'operations', risk: 'high' },
  { flag: 0x00080000, label: '访客分享', description: '创建临时访客分享链接', category: 'operations' },
  { flag: 0x00100000, label: '查看设备详情', description: '查看硬件和系统详情', category: 'operations' },
  { flag: 0x00200000, label: 'Web Relay', description: '创建端口中继映射', category: 'operations' },
  { flag: 0x00000100, label: '远程桌面仅查看', description: '桌面会话仅允许查看', category: 'restrictions' },
  { flag: 0x00000200, label: '禁用终端', description: '明确禁止终端访问', category: 'restrictions' },
  { flag: 0x00000400, label: '禁用文件访问', description: '明确禁止远程文件访问', category: 'restrictions' },
  { flag: 0x00000800, label: '禁用 Intel AMT', description: '禁止 Intel AMT 功能', category: 'restrictions' },
  { flag: 0x00001000, label: '限制桌面输入', description: '限制远程桌面键鼠输入', category: 'restrictions' },
  { flag: 0x00002000, label: '限制事件查看', description: '限制设备事件日志范围', category: 'restrictions' },
  { flag: 0x00010000, label: '禁用远程桌面', description: '明确禁止远程桌面访问', category: 'restrictions' },
  { flag: 0x00400000, label: '禁用注册表', description: '禁止使用注册表编辑器', category: 'restrictions' },
  { flag: 0x00800000, label: '禁用软件管理', description: '禁止管理已安装软件', category: 'restrictions' },
];

export const MESH_PERMISSION_CATEGORIES = [
  { key: 'management', label: '设备组管理' },
  { key: 'access', label: '远程访问' },
  { key: 'operations', label: '设备操作' },
  { key: 'restrictions', label: '限制项（选中即限制）' },
] as const;

export function normalizeMeshRights(rights: number): number {
  return rights >>> 0;
}

export function hasMeshRight(rights: number, flag: number): boolean {
  const normalized = normalizeMeshRights(rights);
  return normalized === MESH_RIGHT_ADMIN || (normalized & flag) === flag;
}

export function composeMeshRights(flags: number[]): number {
  return flags.reduce((rights, flag) => (rights | flag) >>> 0, 0);
}

export function summarizeMeshRights(rights: number): string {
  const normalized = normalizeMeshRights(rights);
  if (normalized === MESH_RIGHT_ADMIN) return '全部权限';
  const selected = MESH_PERMISSIONS.filter(({ flag }) => (normalized & flag) === flag);
  if (!selected.length) return '仅设备组可见';
  if (selected.length <= 2) return selected.map(({ label }) => label).join('、');
  return `${selected.slice(0, 2).map(({ label }) => label).join('、')}等 ${selected.length} 项`;
}
