import { useEffect, useState } from 'react';
import {
  AndroidOutlined,
  ApiOutlined,
  AppleOutlined,
  CloudServerOutlined,
  DesktopOutlined,
  HddOutlined,
  LoadingOutlined,
  LinuxOutlined,
  ReloadOutlined,
  QuestionOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  WifiOutlined,
  WindowsOutlined,
} from '@ant-design/icons';
import type { Device, GatewayClient } from '@meshcentral/shared-state';
import { Alert, Button, Drawer, Spin, Tag, Tooltip, Typography } from 'antd';

interface DeviceDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  device: Device | null;
  client?: GatewayClient;
  connected: boolean;
}

type UnknownRecord = Record<string, unknown>;

interface HardwareDisk {
  name: string;
  model?: string;
  serial?: string;
  size?: number;
  type?: string;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valueAt(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), source);
}

function firstValue(source: unknown, paths: string[]) {
  for (const path of paths) {
    const value = valueAt(source, path);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function stringValue(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function formatBytes(value?: number) {
  if (value === undefined || !Number.isFinite(value) || value < 0) return '—';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 2 ? 1 : 0)} ${units[index]}`;
}

function formatDateTime(value?: string | number) {
  if (!value) return '—';
  const numeric = numberValue(value);
  const date = new Date(numeric && numeric < 1_000_000_000_000 ? numeric * 1000 : value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function osIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('windows')) return <WindowsOutlined />;
  if (value.includes('mac') || value.includes('apple') || value.includes('ios')) return <AppleOutlined />;
  if (value.includes('linux')) return <LinuxOutlined />;
  if (value.includes('android')) return <AndroidOutlined />;
  return <QuestionOutlined />;
}

function systemInfoPayload(response: unknown): unknown {
  return firstValue(response, ['sysinfo', 'data.sysinfo', 'data', 'result']) ?? response;
}

function recordList(source: unknown, paths: string[]): UnknownRecord[] {
  const value = firstValue(source, paths);
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return Object.values(value).filter(isRecord);
  return [];
}

function getHardwareDisks(raw: unknown): HardwareDisk[] {
  const disks = recordList(raw, [
    'hardware.windows.physicalDrives',
    'hardware.windows.drives',
    'hardware.linux.blockdevices',
    'hardware.identifiers.storage_devices',
    'hardware.storage_devices',
    'physicalDrives',
    'storage_devices',
  ]);
  return disks.map((disk, index) => ({
    name: stringValue(firstValue(disk, ['Caption', 'caption', 'DeviceID', 'device', 'name'])) ?? `磁盘 ${index + 1}`,
    model: stringValue(firstValue(disk, ['Model', 'model', 'product'])),
    serial: stringValue(firstValue(disk, ['SerialNumber', 'serialNumber', 'serial'])),
    size: numberValue(firstValue(disk, ['Size', 'size', 'capacity', 'bytes'])),
    type: stringValue(firstValue(disk, ['MediaType', 'mediaType', 'type', 'tran'])),
  }));
}

function joinValues(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(' · ') || undefined;
}

function InfoItem({ label, value, copyable = false }: { label: string; value?: string; copyable?: boolean }) {
  return (
    <div className="device-detail-info-item">
      <span>{label}</span>
      {copyable && value && value !== '—' ? (
        <Typography.Text copyable={{ text: value }}>{value}</Typography.Text>
      ) : (
        <strong title={value}>{value || '—'}</strong>
      )}
    </div>
  );
}

export function DeviceDetailsDrawer({ open, onClose, device, client, connected }: DeviceDetailsDrawerProps) {
  const [systemInfo, setSystemInfo] = useState<unknown>();
  const [systemInfoLoading, setSystemInfoLoading] = useState(false);
  const [systemInfoError, setSystemInfoError] = useState<string>();

  const loadSystemInfo = () => {
    if (!device || !client || !connected) return;
    setSystemInfoLoading(true);
    setSystemInfoError(undefined);
    void client.requestSystemInfo(device.id)
      .then((response) => setSystemInfo(systemInfoPayload(response)))
      .catch((error: unknown) => {
        setSystemInfoError(error instanceof Error ? error.message : '获取硬件配置失败');
      })
      .finally(() => setSystemInfoLoading(false));
  };

  useEffect(() => {
    setSystemInfo(undefined);
    setSystemInfoError(undefined);
    if (!open || !device || !client || !connected) return;

    let active = true;
    setSystemInfoLoading(true);
    void client.requestSystemInfo(device.id)
      .then((response) => {
        if (active) setSystemInfo(systemInfoPayload(response));
      })
      .catch((error: unknown) => {
        if (active) setSystemInfoError(error instanceof Error ? error.message : '获取硬件配置失败');
      })
      .finally(() => {
        if (active) setSystemInfoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [client, connected, device, open]);

  if (!device) {
    return (
      <Drawer title="设备详情" placement="right" onClose={onClose} open={open}>
        <Typography.Text type="secondary">未选择设备</Typography.Text>
      </Drawer>
    );
  }

  const raw = isRecord(device.raw) ? device.raw : {};
  const conn = numberValue(raw.conn) ?? (device.online ? 1 : 0);
  const connectionTypes = [
    (conn & 1) !== 0 ? 'Agent' : undefined,
    (conn & 2) !== 0 ? 'CIRA' : undefined,
    (conn & 4) !== 0 || (conn & 8) !== 0 ? 'Intel AMT' : undefined,
  ].filter(Boolean).join(' + ') || '无活动连接';
  const localIp = stringValue(firstValue(raw, ['ip', 'localip', 'localIp', 'network.localIp'])) ?? '—';
  const publicIp = stringValue(firstValue(raw, ['publicip', 'publicIp', 'wanip', 'wanIp', 'externalip', 'externalIp', 'network.publicIp'])) ?? '—';
  const cpuModel = stringValue(firstValue(raw, ['cpu.model', 'cpuModel', 'processor', 'hardware.cpu', 'sysinfo.hardware.cpu']));
  const loggedInUsers = firstValue(raw, ['lusers', 'loggedInUsers']);
  const userText = Array.isArray(loggedInUsers) ? loggedInUsers.map(stringValue).filter(Boolean).join('、') : stringValue(loggedInUsers);
  const hardwareCpu = stringValue(firstValue(systemInfo, [
    'hardware.identifiers.cpu_name',
    'hardware.cpu.name',
    'hardware.cpu.model',
    'hardware.windows.processors.0.Name',
    'hardware.windows.processors.0.name',
    'cpu.name',
    'cpu.model',
  ])) ?? cpuModel;
  const processor = recordList(systemInfo, ['hardware.windows.processors', 'hardware.processors', 'processors'])[0];
  const coreCount = stringValue(firstValue(processor, ['NumberOfCores', 'cores']));
  const threadCount = stringValue(firstValue(processor, ['NumberOfLogicalProcessors', 'logicalProcessors', 'threads']));
  const clockSpeed = stringValue(firstValue(processor, ['MaxClockSpeed', 'maxClockSpeed']));
  const cpuDetail = joinValues([
    coreCount ? `${coreCount} 核` : undefined,
    threadCount ? `${threadCount} 线程` : undefined,
    clockSpeed ? `${clockSpeed} MHz` : undefined,
  ]);
  const memoryModules = recordList(systemInfo, ['hardware.windows.memory', 'hardware.memory', 'memory.modules']);
  const physicalMemory = memoryModules.reduce((total, module) => total + (numberValue(firstValue(module, ['Capacity', 'capacity', 'size'])) ?? 0), 0);
  const reportedMemory = numberValue(firstValue(systemInfo, [
    'hardware.windows.computerSystem.TotalPhysicalMemory',
    'hardware.totalMemory',
    'memory.total',
  ]));
  const totalPhysicalMemory = physicalMemory || reportedMemory;
  const motherboard = joinValues([
    stringValue(firstValue(systemInfo, ['hardware.windows.motherboard.Manufacturer', 'hardware.identifiers.board_vendor', 'hardware.motherboard.manufacturer'])),
    stringValue(firstValue(systemInfo, ['hardware.windows.motherboard.Product', 'hardware.identifiers.board_name', 'hardware.motherboard.model'])),
  ]);
  const bios = joinValues([
    stringValue(firstValue(systemInfo, ['hardware.windows.bios.Manufacturer', 'hardware.identifiers.bios_vendor', 'hardware.bios.vendor'])),
    stringValue(firstValue(systemInfo, ['hardware.windows.bios.SMBIOSBIOSVersion', 'hardware.identifiers.bios_version', 'hardware.bios.version'])),
  ]);
  const gpu = stringValue(firstValue(systemInfo, ['hardware.identifiers.gpu_name', 'hardware.gpu.name', 'hardware.windows.videoControllers.0.Name']));
  const hardwareDisks = getHardwareDisks(systemInfo);
  const hasHardwareData = Boolean(hardwareCpu || totalPhysicalMemory || motherboard || bios || gpu || hardwareDisks.length);

  return (
    <Drawer
      title={null}
      placement="right"
      onClose={onClose}
      open={open}
      width="min(760px, 100vw)"
      rootClassName="device-details-drawer"
    >
      <header className="device-detail-hero">
        <div className={`device-detail-device-icon ${device.online ? 'is-online' : ''}`}>{osIcon(device.platform)}</div>
        <div className="device-detail-title">
          <div>
            <Typography.Title level={3}>{device.name}</Typography.Title>
            <Tag color={device.online ? 'success' : 'default'}><span className="device-detail-live-dot" />{device.online ? '在线' : '离线'}</Tag>
          </div>
          <p>{stringValue(raw.rname) || stringValue(raw.host) || '未上报主机名'}</p>
          <div className="device-detail-tags">
            <Tag icon={<DesktopOutlined />}>{device.platform || '未知系统'}</Tag>
            <Tag icon={<CloudServerOutlined />}>{device.groupName || '未分组'}</Tag>
            <Tag icon={<ApiOutlined />}>{connectionTypes}</Tag>
          </div>
        </div>
      </header>

      <section className="device-detail-section">
        <div className="device-detail-section-title">
          <h4>硬件配置</h4>
          <Button type="text" size="small" icon={<ReloadOutlined />} loading={systemInfoLoading} disabled={!connected || !client} onClick={loadSystemInfo}>刷新</Button>
        </div>
        {systemInfoLoading && !systemInfo ? (
          <div className="device-detail-hardware-loading"><Spin indicator={<LoadingOutlined spin />} /><span>正在读取设备硬件配置</span></div>
        ) : null}
        {systemInfoError ? <Alert showIcon type="warning" message="硬件配置读取失败" description={systemInfoError} /> : null}
        {!systemInfoLoading && !systemInfoError && !hasHardwareData ? (
          <Alert showIcon type="info" message={connected ? '设备未返回硬件配置' : '网关未连接'} description={connected ? '可点击刷新重新发送 getsysinfo 请求。' : '连接网关后将自动读取 CPU、内存、主板和磁盘信息。'} />
        ) : null}
        {hasHardwareData ? (
          <>
            <div className="device-detail-info-grid">
              <InfoItem label="处理器" value={hardwareCpu} />
              <InfoItem label="核心规格" value={cpuDetail} />
              <InfoItem label="物理内存" value={totalPhysicalMemory ? `${formatBytes(totalPhysicalMemory)}${memoryModules.length ? `（${memoryModules.length} 条）` : ''}` : undefined} />
              <InfoItem label="显卡" value={gpu} />
              <InfoItem label="主板" value={motherboard} />
              <InfoItem label="BIOS" value={bios} />
            </div>
            <div className="device-detail-hardware-disks">
              {hardwareDisks.map((disk) => (
                <div className="device-detail-hardware-disk" key={`${disk.name}-${disk.serial ?? ''}`}>
                  <HddOutlined />
                  <div><strong>{disk.model || disk.name}</strong><span>{joinValues([disk.type, disk.size !== undefined ? formatBytes(disk.size) : undefined, disk.serial ? `SN ${disk.serial}` : undefined]) || '容量与序列号未上报'}</span></div>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </section>

      <section className="device-detail-section">
        <div className="device-detail-section-title"><h4>网络与连接</h4></div>
        <div className="device-detail-info-grid">
          <InfoItem label="局域网 IP" value={localIp} copyable />
          <InfoItem label="公网 IP" value={publicIp} copyable />
          <InfoItem label="主机地址" value={stringValue(raw.host)} copyable />
          <InfoItem label="连接方式" value={connectionTypes} />
          <InfoItem label="最后在线" value={device.online ? '当前在线' : formatDateTime(device.lastSeenAt)} />
          <InfoItem label="首次连接" value={formatDateTime(numberValue(raw.firstconnect))} />
        </div>
      </section>

      <section className="device-detail-section">
        <div className="device-detail-section-title"><h4>设备信息</h4></div>
        <div className="device-detail-info-grid">
          <InfoItem label="设备 ID" value={device.id} copyable />
          <InfoItem label="Agent 版本" value={device.agentVersion} />
          <InfoItem label="设备分组" value={device.groupName || '未分组'} />
          <InfoItem label="当前用户" value={userText} />
          <InfoItem label="操作系统" value={device.platform} />
          <InfoItem label="设备描述" value={stringValue(raw.desc)} />
        </div>
        <div className="device-detail-health-row">
          <Tooltip title="Agent 连接状态"><span><WifiOutlined /> Agent {(conn & 1) !== 0 ? '已连接' : '未连接'}</span></Tooltip>
          <Tooltip title="安全信息来自设备上报"><span><SafetyCertificateOutlined /> 安全状态 {isRecord(raw.wsc) ? '已上报' : '未知'}</span></Tooltip>
          <Tooltip title="当前登录用户"><span><UserOutlined /> {userText || '无用户数据'}</span></Tooltip>
        </div>
      </section>
    </Drawer>
  );
}
