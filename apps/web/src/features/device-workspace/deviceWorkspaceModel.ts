import type { DeviceDetails } from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';
import { canUseDeviceFiles, canUseTerminal, getDesktopAccess } from '../users/meshPermissions';
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

export function formatBytes(value: unknown) {
  const bytes = typeof value === 'string' ? Number(value) : value;
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return undefined;
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let current = bytes;
  let index = 0;
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024;
    index += 1;
  }
  return `${current.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatBitRate(value: unknown) {
  const bitsPerSecond = typeof value === 'string' ? Number(value) : value;
  if (
    typeof bitsPerSecond !== 'number' ||
    !Number.isFinite(bitsPerSecond) ||
    bitsPerSecond <= 0
  ) {
    return undefined;
  }
  const units = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps', 'Pbps'];
  let current = bitsPerSecond;
  let index = 0;
  while (current >= 1000 && index < units.length - 1) {
    current /= 1000;
    index += 1;
  }
  const fractionDigits = index === 0 || Number.isInteger(current) ? 0 : 1;
  return `${current.toFixed(fractionDigits)} ${units[index]}`;
}

export interface UptimeParts {
  years: number;
  months: number;
  days: number;
  hours: number;
  minutes: number;
}

export function splitUptime(seconds: number): UptimeParts {
  let remainingMinutes = Math.max(0, Math.floor(seconds / 60));
  const minutesPerYear = 365 * 24 * 60;
  const minutesPerMonth = 30 * 24 * 60;
  const minutesPerDay = 24 * 60;
  const years = Math.floor(remainingMinutes / minutesPerYear);
  remainingMinutes %= minutesPerYear;
  const months = Math.floor(remainingMinutes / minutesPerMonth);
  remainingMinutes %= minutesPerMonth;
  const days = Math.floor(remainingMinutes / minutesPerDay);
  remainingMinutes %= minutesPerDay;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return { years, months, days, hours, minutes };
}

function bootTimestamp(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 100_000_000_000 ? value * 1000 : value;
  }
  if (typeof value !== 'string') return NaN;
  if (/^\d+$/.test(value)) {
    const numericValue = Number(value);
    return numericValue < 100_000_000_000 ? numericValue * 1000 : numericValue;
  }
  const dmtf = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\.\d+)?([+-])(\d{3})$/.exec(value);
  if (dmtf) {
    const [, year, month, day, hour, minute, second, sign, offset] = dmtf;
    const localTimestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    const offsetMilliseconds = Number(offset) * 60_000 * (sign === '+' ? 1 : -1);
    return localTimestamp - offsetMilliseconds;
  }
  return Date.parse(value);
}

function uptimeSeconds(value: unknown, endTime: unknown): number | undefined {
  const timestamp = bootTimestamp(value);
  const endTimestamp = bootTimestamp(endTime);
  if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(endTimestamp) || endTimestamp < timestamp) return undefined;
  return Math.floor((endTimestamp - timestamp) / 1000);
}

function simplifyCpuName(name: string | undefined): string {
  if (!name) return '';
  return name
    .replace(/\(R\)|\(TM\)|CPU|@.*$/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || name;
}

function parseVolumes(volumesRecord: unknown): StorageVolume[] {
  if (!volumesRecord || typeof volumesRecord !== 'object') return [];
  return Object.entries(volumesRecord as Record<string, unknown>).map(([letter, item]) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const size = typeof record.size === 'number' ? record.size : 0;
    const remaining = typeof record.sizeremaining === 'number' ? record.sizeremaining : 0;
    const used = Math.max(0, size - remaining);
    const usedPercent = size > 0 ? Math.min(100, Math.round((used / size) * 100)) : 0;
    return {
      letter: `${letter.toUpperCase()}:`,
      name: stringFrom(record.name),
      type: stringFrom(record.type) ?? 'NTFS',
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
  const record = networkInfo as Record<string, unknown>;
  const netif2 = record.netif2;
  if (!netif2 || typeof netif2 !== 'object') return [];
  const list: NetworkInterfaceInfo[] = [];

  for (const [name, items] of Object.entries(netif2 as Record<string, unknown>)) {
    if (name.toLowerCase().includes('loopback') || name.toLowerCase() === 'meta') continue;
    if (Array.isArray(items)) {
      const ipv4 = items.find((item) => item && typeof item === 'object' && (item as Record<string, unknown>).family === 'IPv4') as Record<string, unknown> | undefined;
      const target = ipv4 ?? items[0] as Record<string, unknown> | undefined;
      if (target) {
        const speedText = formatBitRate(target.speed);
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

const VIRTUAL_INTERFACE_PATTERN =
  /loopback|virtual|vpn|tunnel|tap|tun|docker|vmware|hyper-v|vethernet|vbox|wsl|tailscale|zerotier/i;
const PHYSICAL_INTERFACE_PATTERN = /ethernet|以太网|wi-?fi|wlan|wireless|无线/i;

function isUsableIpv4(address: string | undefined) {
  return Boolean(
    address &&
      !address.startsWith('127.') &&
      !address.startsWith('169.254.') &&
      address !== '0.0.0.0',
  );
}

function primaryInterfaceScore(networkInterface: NetworkInterfaceInfo) {
  const status = networkInterface.status.toLowerCase();
  let score = 0;
  if (networkInterface.gateway) score += 1000;
  if (status === 'up' || status === 'connected') score += 200;
  if (isUsableIpv4(networkInterface.ip)) score += 100;
  if (PHYSICAL_INTERFACE_PATTERN.test(networkInterface.name)) score += 30;
  if (VIRTUAL_INTERFACE_PATTERN.test(networkInterface.name)) score -= 50;
  return score;
}

function selectPrimaryInterface(interfaces: NetworkInterfaceInfo[]) {
  return interfaces.reduce<NetworkInterfaceInfo | undefined>((selected, candidate) => {
    if (!selected) return candidate;
    return primaryInterfaceScore(candidate) > primaryInterfaceScore(selected)
      ? candidate
      : selected;
  }, undefined);
}

function staticDetails(details: DeviceDetails | undefined) {
  const hardware = hardwareRecord(details);
  const platformKey = Object.keys(hardware ?? {})[0];
  const platformHardware = platformKey && hardware?.[platformKey];
  const platformRecord = platformHardware && typeof platformHardware === 'object'
    ? (platformHardware as Record<string, unknown>)
    : undefined;
  const cpu = Array.isArray(platformRecord?.cpu) ? platformRecord.cpu[0] : undefined;
  const cpuRecord = cpu && typeof cpu === 'object' ? (cpu as Record<string, unknown>) : undefined;
  const rawCpuName = stringFrom(cpuRecord?.Name);
  const cpuMaxClock = typeof cpuRecord?.MaxClockSpeed === 'number' ? `${(cpuRecord.MaxClockSpeed / 1000).toFixed(2)} GHz` : undefined;

  const memory = Array.isArray(platformRecord?.memory) ? platformRecord.memory : [];
  const memorySlots = memory.length;
  const firstMemory = memory[0] && typeof memory[0] === 'object' ? (memory[0] as Record<string, unknown>) : undefined;
  const memorySpeed = typeof firstMemory?.Speed === 'number' ? `${firstMemory.Speed} MHz` : undefined;

  const volumes = parseVolumes(platformRecord?.volumes);
  const drives = Array.isArray(platformRecord?.drives) ? platformRecord.drives : [];
  const driveNames = drives.map((drive) => (drive && typeof drive === 'object' ? stringFrom((drive as Record<string, unknown>).Model) ?? stringFrom((drive as Record<string, unknown>).Caption) : undefined)).filter(Boolean) as string[];

  const totalMemory = memory.reduce<number>((sum, item) => {
    const record = item && typeof item === 'object' ? (item as Record<string, unknown>) : undefined;
    return sum + (typeof record?.Capacity === 'string' ? Number(record.Capacity) : 0);
  }, 0);
  const totalStorage = volumes.reduce<number>((sum, item) => sum + item.sizeBytes, 0);
  const totalRemaining = volumes.reduce<number>((sum, item) => sum + item.remainingBytes, 0);

  const systemRecord = detailRecord(details, 'systemInfo');
  const networkRecord = detailRecord(details, 'networkInfo');
  const lastConnectRecord = detailRecord(details, 'lastConnect');
  const interfaces = parseInterfaces(networkRecord);
  const primaryInterface = selectPrimaryInterface(interfaces);

  const identifiers = systemRecord?.identifiers && typeof systemRecord.identifiers === 'object' ? (systemRecord.identifiers as Record<string, unknown>) : undefined;
  const boardName = stringFrom(identifiers?.board_name) ?? stringFrom(identifiers?.product_name) ?? '—';
  const biosVersion = stringFrom(identifiers?.bios_version)
    ? `${stringFrom(identifiers?.bios_vendor) ?? ''} ${String(identifiers?.bios_version ?? '')}`.trim()
    : '—';

  const gpus = Array.isArray(platformRecord?.gpu) ? platformRecord.gpu : [];
  const activeGpu = gpus.find((gpu) => gpu && typeof gpu === 'object' && (gpu as Record<string, unknown>).CurrentHorizontalResolution) ?? gpus[0];
  const activeGpuRecord = activeGpu && typeof activeGpu === 'object' ? (activeGpu as Record<string, unknown>) : undefined;
  const gpuName = stringFrom(activeGpuRecord?.Name) ?? (Array.isArray(identifiers?.gpu_name) ? identifiers?.gpu_name[0] : undefined) ?? '—';
  const gpuResolution = activeGpuRecord?.CurrentHorizontalResolution && activeGpuRecord?.CurrentVerticalResolution
    ? `${activeGpuRecord.CurrentHorizontalResolution} × ${activeGpuRecord.CurrentVerticalResolution}`
    : undefined;

  const dns = (systemRecord?.network && typeof systemRecord.network === 'object' && Array.isArray((systemRecord.network as Record<string, unknown>).dns)
    ? (systemRecord.network as Record<string, unknown>).dns
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
    pendingReboot: stringFrom(systemRecord?.pendingReboot),
  };

  const securityParts: string[] = [];
  if (security.antiVirus) securityParts.push(`antivirus:${security.antiVirus}`);
  if (security.firewall) securityParts.push(`firewall:${security.firewall}`);
  if (security.pendingReboot) securityParts.push(`pending-reboot:${security.pendingReboot}`);

  const hardwareInfo: DeviceHardwareInfo = {
    cpuName: rawCpuName,
    cpuShortName: simplifyCpuName(rawCpuName),
    cpuSpeed: cpuMaxClock,
    memoryTotal: formatBytes(totalMemory),
    memorySlots,
    memorySpeed,
    storageTotal: formatBytes(totalStorage),
    storageRemaining: formatBytes(totalRemaining),
    storageDrives: driveNames,
    volumes,
    gpuName,
    gpuResolution,
    boardName,
    biosVersion,
    primaryNic: primaryInterface ? `${primaryInterface.name}${primaryInterface.speed ? ` (${primaryInterface.speed})` : ''}` : undefined,
    primarySpeed: primaryInterface?.speed,
    dns,
    interfaces,
    security,
    agentVersion: agent ? `v${agent.ver}` : undefined,
    agentCore: stringFrom(agent?.core),
    agentIsRoot: typeof agent?.root === 'boolean' ? agent.root : undefined,
    lastConnectAddr: stringFrom(lastConnectRecord?.addr),
    lastConnectTime: typeof lastConnectRecord?.time === 'number' ? new Date(lastConnectRecord.time).toISOString() : undefined,
  };

  return {
    cpuName: hardwareInfo.cpuName,
    memorySummary: hardwareInfo.memoryTotal,
    storageSummary: hardwareInfo.storageTotal
      ? `${hardwareInfo.storageTotal} (${hardwareInfo.storageRemaining ?? ''})`
      : undefined,
    networkSummary: interfaces.length > 0 ? `${interfaces.length} interfaces` : undefined,
    securitySummary: securityParts.length > 0 ? securityParts.join(' · ') : undefined,
    hardware: hardwareInfo,
  };
}

function terminalPermission(device: Device): boolean | undefined {
  if (device.effectiveRights !== undefined) return canUseTerminal(device.effectiveRights);
  const raw = rawRecord(device);
  const rights = raw?.effectiveRights ?? raw?.meshrights;
  return typeof rights === 'number' && Number.isFinite(rights) ? canUseTerminal(rights) : undefined;
}

function filesPermission(device: Device): boolean | undefined {
  if (device.effectiveRights !== undefined) return canUseDeviceFiles(device.effectiveRights);
  const raw = rawRecord(device);
  const rights = raw?.effectiveRights ?? raw?.meshrights;
  return typeof rights === 'number' && Number.isFinite(rights)
    ? canUseDeviceFiles(rights)
    : undefined;
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
  const hasSystemDetails = detailRecord(details, 'systemInfo') !== undefined;
  const hasNetworkDetails = detailRecord(details, 'networkInfo') !== undefined;
  const platformKey = Object.keys(hardwareRecord(details) ?? {})[0];
  const platformHardware = platformKey && hardwareRecord(details)?.[platformKey];
  const platformRecord = platformHardware && typeof platformHardware === 'object' ? platformHardware as Record<string, unknown> : undefined;
  const osInfo = platformRecord?.osinfo && typeof platformRecord.osinfo === 'object' ? platformRecord.osinfo as Record<string, unknown> : undefined;
  const uptimeEndTime = resolvedDevice.online ? Date.now() : resolvedDevice.lastSeenAt;
  return {
    device: resolvedDevice,
    details,
    hasSystemDetails,
    hasNetworkDetails,
    hostname: rawString(resolvedDevice, ['rname', 'host', 'hostname'], resolvedDevice.raw) ?? resolvedDevice.name,
    platform: resolvedDevice.platform ?? rawString(resolvedDevice, ['osdesc', 'platform'], resolvedDevice.raw) ?? stringFrom(osInfo?.Caption),
    ipAddress: rawString(resolvedDevice, ['ip', 'host'], resolvedDevice.raw),
    macAddress: rawString(resolvedDevice, ['mac', 'macaddr'], resolvedDevice.raw),
    currentUser: rawString(resolvedDevice, ['user', 'currentUser'], resolvedDevice.raw),
    uptimeSeconds: uptimeSeconds(osInfo?.LastBootUpTime ?? rawRecord(resolvedDevice)?.lastbootuptime, uptimeEndTime),
    lastHeartbeatAt: resolvedDevice.lastSeenAt,
    groupName: groupName ?? resolvedDevice.groupName,
    tags: [],
    ...hardware,
    events: workspaceEvents,
    sessionStartedAt: '—',
    terminalAllowed: terminalPermission(resolvedDevice),
    filesAllowed: filesPermission(resolvedDevice),
    desktopAccess: desktopPermission(resolvedDevice),
  };
}