import type { Device } from '@meshcentral/shared-state';
import type { DeviceDetails } from '@meshcentral/control-client';
import { canUseTerminal, getDesktopAccess } from '../users/meshPermissions';
import { workspaceEvents } from './mockWorkspaceData';
import type {
  DeviceHardwareInfo,
  DeviceWorkspaceModel,
  NetworkInterfaceInfo,
  StorageVolume,
} from './types';

function rawRecord(device: Device) {
  return device.raw && typeof device.raw === 'object'
    ? (device.raw as Record<string, unknown>)
    : undefined;
}

function stringFrom(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function rawString(device: Device, keys: string[], extra?: unknown) {
  const raw = extra && typeof extra === 'object' ? (extra as Record<string, unknown>) : rawRecord(device);
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function detailRecord(details: DeviceDetails | undefined, key: 'systemInfo' | 'networkInfo' | 'lastConnect') {
  const value = details?.[key];
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function hardwareRecord(details: DeviceDetails | undefined) {
  const system = detailRecord(details, 'systemInfo');
  const hardware = system?.hardware;
  return hardware && typeof hardware === 'object' ? (hardware as Record<string, unknown>) : undefined;
}

function formatBytes(value: unknown) {
  const bytes = typeof value === 'string' ? Number(value) : value;
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return undefined;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = bytes;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatUptime(value: unknown) {
  const timestamp = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days} 天 ${hours} 小时`;
  if (hours > 0) return `${hours} 小时 ${minutes % 60} 分钟`;
  return `${minutes} 分钟`;
}

function simplifyCpuName(name: string | undefined): string {
  if (!name) return '未知处理器';
  return name
    .replace(/\(R\)|\(TM\)|CPU|@.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || name;
}

function parseVolumes(volumesRecord: unknown): StorageVolume[] {
  if (!volumesRecord || typeof volumesRecord !== 'object') return [];
  return Object.entries(volumesRecord as Record<string, unknown>).map(([letter, item]) => {
    const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const size = typeof rec.size === 'number' ? rec.size : 0;
    const remaining = typeof rec.sizeremaining === 'number' ? rec.sizeremaining : 0;
    const used = Math.max(0, size - remaining);
    const usedPercent = size > 0 ? Math.min(100, Math.round((used / size) * 100)) : 0;
    return {
      letter: `${letter.toUpperCase()}:`,
      name: stringFrom(rec.name),
      type: stringFrom(rec.type) ?? 'NTFS',
      sizeBytes: size,
      remainingBytes: remaining,
      sizeFormatted: formatBytes(size) ?? '—',
      remainingFormatted: formatBytes(remaining) ?? '—',
      usedPercent,
    };
  });
}

function parseInterfaces(networkInfo: unknown): NetworkInterfaceInfo[] {
  if (!networkInfo || typeof networkInfo !== 'object') return [];
  const rec = networkInfo as Record<string, unknown>;
  const netif2 = rec.netif2;
  if (!netif2 || typeof netif2 !== 'object') return [];
  const list: NetworkInterfaceInfo[] = [];

  for (const [name, items] of Object.entries(netif2 as Record<string, unknown>)) {
    if (name.toLowerCase().includes('loopback') || name.toLowerCase() === 'meta') continue;
    if (Array.isArray(items)) {
      const ipv4 = items.find((it) => it && typeof it === 'object' && (it as Record<string, unknown>).family === 'IPv4') as Record<string, unknown> | undefined;
      const anyItem = items[0] as Record<string, unknown> | undefined;
      const target = ipv4 ?? anyItem;
      if (target) {
        const speedNum = typeof target.speed === 'number' ? target.speed : undefined;
        let speedText: string | undefined;
        if (speedNum) {
          speedText = speedNum >= 1_000_000_000 ? `${speedNum / 1_000_000_000} Gbps` : `${Math.round(speedNum / 1_000_000)} Mbps`;
        }
        list.push({
          name,
          ip: stringFrom(target.address),
          mac: stringFrom(target.mac),
          gateway: stringFrom(target.gateway),
          speed: speedText,
          status: stringFrom(target.status) ?? 'up',
        });
      }
    }
  }
  return list;
}

function staticDetails(details: DeviceDetails | undefined) {
  const hardware = hardwareRecord(details);
  const platformKey = Object.keys(hardware ?? {})[0];
  const platformHardware = platformKey && hardware?.[platformKey];
  const platformRecord = platformHardware && typeof platformHardware === 'object'
    ? (platformHardware as Record<string, unknown>)
    : undefined;
  const cpu = Array.isArray(platformRecord?.cpu) ? platformRecord.cpu[0] : undefined;
  const cpuRec = cpu && typeof cpu === 'object' ? (cpu as Record<string, unknown>) : undefined;
  const rawCpuName = stringFrom(cpuRec?.Name);
  const cpuMaxClock = typeof cpuRec?.MaxClockSpeed === 'number' ? `${(cpuRec.MaxClockSpeed / 1000).toFixed(2)} GHz` : undefined;

  const memory = Array.isArray(platformRecord?.memory) ? platformRecord.memory : [];
  const memorySlots = memory.length;
  const firstMem = memory[0] && typeof memory[0] === 'object' ? (memory[0] as Record<string, unknown>) : undefined;
  const memorySpeed = typeof firstMem?.Speed === 'number' ? `${firstMem.Speed} MHz` : undefined;

  const volumes = parseVolumes(platformRecord?.volumes);
  const drives = Array.isArray(platformRecord?.drives) ? platformRecord.drives : [];
  const driveNames = drives.map((d) => (d && typeof d === 'object' ? stringFrom((d as Record<string, unknown>).Model) ?? stringFrom((d as Record<string, unknown>).Caption) : undefined)).filter(Boolean) as string[];

  const totalMemory = memory.reduce<number>((sum, item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : undefined;
    return sum + (typeof record?.Capacity === 'string' ? Number(record.Capacity) : 0);
  }, 0);
  const totalStorage = volumes.reduce<number>((sum, item) => sum + item.sizeBytes, 0);
  const totalRemaining = volumes.reduce<number>((sum, item) => sum + item.remainingBytes, 0);

  const sysRec = detailRecord(details, 'systemInfo');
  const networkRec = detailRecord(details, 'networkInfo');
  const lastConnectRec = detailRecord(details, 'lastConnect');
  const interfaces = parseInterfaces(networkRec);
  const primaryIf = interfaces[0];

  const identifiers = sysRec?.identifiers && typeof sysRec.identifiers === 'object' ? (sysRec.identifiers as Record<string, unknown>) : undefined;
  const boardName = stringFrom(identifiers?.board_name) ?? stringFrom(identifiers?.product_name) ?? '—';
  const biosVersion = stringFrom(identifiers?.bios_version)
    ? `${stringFrom(identifiers?.bios_vendor) ?? ''} ${String(identifiers?.bios_version ?? '')}`.trim()
    : '—';

  const gpus = Array.isArray(platformRecord?.gpu) ? platformRecord.gpu : [];
  const activeGpu = gpus.find((g) => g && typeof g === 'object' && (g as Record<string, unknown>).CurrentHorizontalResolution) ?? gpus[0];
  const activeGpuRec = activeGpu && typeof activeGpu === 'object' ? (activeGpu as Record<string, unknown>) : undefined;
  const gpuName = stringFrom(activeGpuRec?.Name) ?? (Array.isArray(identifiers?.gpu_name) ? identifiers?.gpu_name[0] : undefined) ?? '—';
  const gpuResolution = activeGpuRec?.CurrentHorizontalResolution && activeGpuRec?.CurrentVerticalResolution
    ? `${activeGpuRec.CurrentHorizontalResolution} × ${activeGpuRec.CurrentVerticalResolution}`
    : undefined;

  const dns = (sysRec?.network && typeof sysRec.network === 'object' && Array.isArray((sysRec.network as Record<string, unknown>).dns)
    ? (sysRec.network as Record<string, unknown>).dns
    : []) as string[];

  const detailRaw = details?.raw?.detail && typeof details.raw.detail === 'object' ? (details.raw.detail as Record<string, unknown>) : undefined;
  const nodeRaw = (detailRaw?.node && typeof detailRaw.node === 'object' ? detailRaw.node : details?.device?.raw) as Record<string, unknown> | undefined;
  const wsc = nodeRaw?.wsc && typeof nodeRaw.wsc === 'object' ? (nodeRaw.wsc as Record<string, unknown>) : undefined;
  const defender = nodeRaw?.defender && typeof nodeRaw.defender === 'object' ? (nodeRaw.defender as Record<string, unknown>) : undefined;
  const agent = nodeRaw?.agent && typeof nodeRaw.agent === 'object' ? (nodeRaw.agent as Record<string, unknown>) : undefined;

  const security = {
    antiVirus: stringFrom(wsc?.antiVirus),
    firewall: stringFrom(wsc?.firewall),
    autoUpdate: stringFrom(wsc?.autoUpdate),
    realTimeProtection: typeof defender?.RealTimeProtection === 'boolean' ? defender.RealTimeProtection : undefined,
    tamperProtected: typeof defender?.TamperProtected === 'boolean' ? defender.TamperProtected : undefined,
    pendingReboot: stringFrom(sysRec?.pendingReboot),
  };

  const securityParts: string[] = [];
  if (security.antiVirus) securityParts.push(`杀毒: ${security.antiVirus === 'OK' ? '正常' : security.antiVirus}`);
  if (security.firewall) securityParts.push(`防火墙: ${security.firewall === 'OK' ? '启用' : security.firewall}`);
  if (security.pendingReboot) securityParts.push(`待重启: ${security.pendingReboot}`);

  const hardwareInfo: DeviceHardwareInfo = {
    cpuName: rawCpuName ?? '未提供',
    cpuShortName: simplifyCpuName(rawCpuName),
    cpuSpeed: cpuMaxClock,
    memoryTotal: formatBytes(totalMemory) ?? '未提供',
    memorySlots,
    memorySpeed,
    storageTotal: formatBytes(totalStorage) ?? '未提供',
    storageRemaining: formatBytes(totalRemaining) ?? '未提供',
    storageDrives: driveNames,
    volumes,
    gpuName,
    gpuResolution,
    boardName,
    biosVersion,
    primaryNic: primaryIf ? `${primaryIf.name}${primaryIf.speed ? ` (${primaryIf.speed})` : ''}` : '未提供',
    primarySpeed: primaryIf?.speed,
    dns,
    interfaces,
    security,
    agentVersion: agent ? `v${agent.ver}` : undefined,
    agentCore: stringFrom(agent?.core),
    agentIsRoot: typeof agent?.root === 'boolean' ? agent.root : undefined,
    lastConnectAddr: stringFrom(lastConnectRec?.addr),
    lastConnectTime: typeof lastConnectRec?.time === 'number' ? new Date(lastConnectRec.time).toLocaleString('zh-CN') : undefined,
  };

  return {
    cpuName: hardwareInfo.cpuName,
    memorySummary: hardwareInfo.memoryTotal,
    storageSummary: hardwareInfo.storageTotal !== '未提供'
      ? `${hardwareInfo.storageTotal} (余 ${hardwareInfo.storageRemaining})`
      : '未提供',
    networkSummary: interfaces.length > 0 ? `${interfaces.length} 个网络接口` : '未提供',
    securitySummary: securityParts.length > 0 ? securityParts.join(' · ') : '未提供',
    hardware: hardwareInfo,
  };
}

function terminalPermission(device: Device): boolean | undefined {
  if (device.effectiveRights !== undefined) return canUseTerminal(device.effectiveRights);
  const raw = rawRecord(device);
  const rights = raw?.effectiveRights ?? raw?.meshrights;
  return typeof rights === 'number' && Number.isFinite(rights) ? canUseTerminal(rights) : undefined;
}

function desktopPermission(
  device: Device,
): 'denied' | 'view-only' | 'limited-input' | 'control' | undefined {
  if (device.effectiveRights !== undefined) return getDesktopAccess(device.effectiveRights);
  const raw = rawRecord(device);
  const rights = raw?.effectiveRights ?? raw?.meshrights;
  return typeof rights === 'number' && Number.isFinite(rights) ? getDesktopAccess(rights) : undefined;
}

export function createDeviceWorkspaceModel(device: Device, details?: DeviceDetails, groupName?: string): DeviceWorkspaceModel {
  const resolvedDevice = details?.device ?? device;
  const hardware = staticDetails(details);
  const platformKey = Object.keys(hardwareRecord(details) ?? {})[0];
  const platformHardware = platformKey && hardwareRecord(details)?.[platformKey];
  const platformRecord = platformHardware && typeof platformHardware === 'object' ? platformHardware as Record<string, unknown> : undefined;
  const osInfo = platformRecord?.osinfo && typeof platformRecord.osinfo === 'object' ? platformRecord.osinfo as Record<string, unknown> : undefined;
  return {
    device: resolvedDevice,
    details,
    hostname: rawString(resolvedDevice, ['rname', 'host', 'hostname'], resolvedDevice.raw) ?? resolvedDevice.name,
    platform: resolvedDevice.platform ?? rawString(resolvedDevice, ['osdesc', 'platform'], resolvedDevice.raw) ?? stringFrom(osInfo?.Caption) ?? '未知系统',
    ipAddress: rawString(resolvedDevice, ['ip', 'host'], resolvedDevice.raw) ?? '—',
    macAddress: rawString(resolvedDevice, ['mac', 'macaddr'], resolvedDevice.raw) ?? '—',
    currentUser: rawString(resolvedDevice, ['user', 'currentUser'], resolvedDevice.raw) ?? '—',
    uptime: formatUptime(osInfo?.LastBootUpTime),
    lastHeartbeat: resolvedDevice.lastSeenAt ?? '刚刚',
    groupName: groupName ?? resolvedDevice.groupName ?? '未分组',
    tags: [],
    ...hardware,
    events: workspaceEvents,
    sessionStartedAt: '—',
    terminalAllowed: terminalPermission(resolvedDevice),
    desktopAccess: desktopPermission(resolvedDevice),
  };
}
