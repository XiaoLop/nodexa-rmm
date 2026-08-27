import type { ReactNode } from 'react';
import {
  AndroidOutlined,
  ApiOutlined,
  AppleOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  FundProjectionScreenOutlined,
  GlobalOutlined,
  HddOutlined,
  LinuxOutlined,
  QuestionOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  WifiOutlined,
  WindowsOutlined,
} from '@ant-design/icons';
import type { Device } from '@meshcentral/shared-state';
import { Alert, Drawer, Progress, Tag, Tooltip, Typography } from 'antd';

interface DeviceDetailsDrawerProps {
  open: boolean;
  onClose: () => void;
  device: Device | null;
}

type UnknownRecord = Record<string, unknown>;

interface UsageMetric {
  percent?: number;
  used?: number;
  total?: number;
}

interface DiskMetric extends UsageMetric {
  name: string;
  fileSystem?: string;
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

function clampPercent(value?: number) {
  if (value === undefined) return undefined;
  const normalized = value > 0 && value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, normalized));
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

function formatDuration(bootTime?: number) {
  if (!bootTime) return '—';
  const timestamp = bootTime < 1_000_000_000_000 ? bootTime * 1000 : bootTime;
  const days = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
  return days < 1 ? '不足 1 天' : `${days} 天`;
}

function osIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('windows')) return <WindowsOutlined />;
  if (value.includes('mac') || value.includes('apple') || value.includes('ios')) return <AppleOutlined />;
  if (value.includes('linux')) return <LinuxOutlined />;
  if (value.includes('android')) return <AndroidOutlined />;
  return <QuestionOutlined />;
}

function getUsageMetric(raw: unknown, type: 'cpu' | 'memory'): UsageMetric {
  const prefix = type === 'cpu' ? 'cpu' : 'memory';
  const used = numberValue(firstValue(raw, [
    `${prefix}.used`, `${prefix}.usedBytes`, `${prefix}Used`, `${prefix}used`,
    type === 'memory' ? 'memused' : 'cpu.used',
  ]));
  const total = numberValue(firstValue(raw, [
    `${prefix}.total`, `${prefix}.totalBytes`, `${prefix}Total`, `${prefix}total`,
    type === 'memory' ? 'totalmem' : 'cpu.total',
  ]));
  const explicitPercent = numberValue(firstValue(raw, [
    `${prefix}.percent`, `${prefix}.usage`, `${prefix}.usagePercent`, `${prefix}Usage`, `${prefix}usage`,
    type === 'cpu' ? 'cpuusage' : 'memusage',
  ]));
  const percent = clampPercent(explicitPercent ?? (used !== undefined && total ? (used / total) * 100 : undefined));
  return { used, total, percent };
}

function getDisks(raw: unknown): DiskMetric[] {
  const source = firstValue(raw, [
    'disks', 'drives', 'volumes', 'storage', 'sysinfo.disks', 'sysinfo.storage',
    'sysinfo.hardware.windows.volumes', 'hardware.windows.volumes',
  ]);
  const entries = Array.isArray(source)
    ? source
    : isRecord(source)
      ? Object.entries(source).map(([name, value]) => (isRecord(value) ? { name, ...value } : { name, total: value }))
      : [];

  return entries.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const total = numberValue(firstValue(entry, ['total', 'size', 'capacity', 'totalBytes']));
    const free = numberValue(firstValue(entry, ['free', 'available', 'freeBytes']));
    const used = numberValue(firstValue(entry, ['used', 'usedBytes'])) ?? (total !== undefined && free !== undefined ? total - free : undefined);
    const percent = clampPercent(numberValue(firstValue(entry, ['percent', 'usage', 'usedPercent'])) ?? (used !== undefined && total ? (used / total) * 100 : undefined));
    return [{
      name: stringValue(firstValue(entry, ['name', 'drive', 'device', 'mount', 'caption'])) ?? `磁盘 ${index + 1}`,
      fileSystem: stringValue(firstValue(entry, ['fileSystem', 'filesystem', 'fs', 'type'])),
      total,
      used,
      percent,
    }];
  });
}

function MetricCard({ icon, label, value, detail, percent, tone = 'blue' }: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string;
  percent?: number;
  tone?: 'blue' | 'purple' | 'cyan' | 'amber';
}) {
  return (
    <div className={`device-detail-metric tone-${tone}`}>
      <div className="device-detail-metric-icon">{icon}</div>
      <div className="device-detail-metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        {detail ? <small>{detail}</small> : null}
      </div>
      {percent !== undefined ? <Progress percent={Math.round(percent)} size="small" showInfo={false} /> : null}
    </div>
  );
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

export function DeviceDetailsDrawer({ open, onClose, device }: DeviceDetailsDrawerProps) {
  if (!device) {
    return (
      <Drawer title="设备详情" placement="right" onClose={onClose} open={open}>
        <Typography.Text type="secondary">未选择设备</Typography.Text>
      </Drawer>
    );
  }

  const raw = isRecord(device.raw) ? device.raw : {};
  const bootTime = numberValue(firstValue(raw, ['lastbootuptime', 'lastBootAt']));
  const cpu = getUsageMetric(raw, 'cpu');
  const memory = getUsageMetric(raw, 'memory');
  const disks = getDisks(raw);
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
  const hasPerformanceData = cpu.percent !== undefined || memory.percent !== undefined || disks.length > 0;

  return (
    <Drawer
      title={null}
      placement="right"
      onClose={onClose}
      open={open}
      width="min(760px, 100vw)"
      rootClassName="device-details-drawer"
      styles={{
        section: { background: 'var(--bg)' },
        body: { background: 'var(--bg)' },
      }}
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
        <div className="device-detail-section-title"><h4>运行概览</h4><span>{hasPerformanceData ? '设备最新上报数据' : '等待设备上报性能数据'}</span></div>
        <div className="device-detail-metrics">
          <MetricCard icon={<FundProjectionScreenOutlined />} label="CPU 使用率" value={cpu.percent === undefined ? '暂无数据' : `${Math.round(cpu.percent)}%`} detail={cpuModel} percent={cpu.percent} />
          <MetricCard icon={<DatabaseOutlined />} label="内存占用" value={memory.percent === undefined ? '暂无数据' : `${Math.round(memory.percent)}%`} detail={memory.total !== undefined ? `${formatBytes(memory.used)} / ${formatBytes(memory.total)}` : undefined} percent={memory.percent} tone="purple" />
          <MetricCard icon={<GlobalOutlined />} label="公网 IP" value={publicIp} detail={publicIp === '—' ? '网关暂未上报' : '外部访问地址'} tone="cyan" />
          <MetricCard icon={<ClockCircleOutlined />} label="持续运行" value={formatDuration(bootTime)} detail={bootTime ? `启动于 ${formatDateTime(bootTime)}` : '未上报启动时间'} tone="amber" />
        </div>
        {!hasPerformanceData ? <Alert showIcon type="info" message="性能数据尚未接入" description="CPU、内存和磁盘信息需要业务网关转发设备的系统信息（getsysinfo）响应；字段可用后会自动展示。" /> : null}
      </section>

      <section className="device-detail-section">
        <div className="device-detail-section-title"><h4>磁盘占用</h4><span>{disks.length ? `${disks.length} 个卷` : '暂无磁盘数据'}</span></div>
        <div className="device-detail-disk-list">
          {disks.length ? disks.map((disk) => (
            <div className="device-detail-disk" key={disk.name}>
              <div className="device-detail-disk-icon"><HddOutlined /></div>
              <div className="device-detail-disk-copy">
                <div><strong>{disk.name}</strong><span>{disk.fileSystem || '本地磁盘'}</span></div>
                <Progress percent={disk.percent === undefined ? 0 : Math.round(disk.percent)} showInfo={false} strokeColor={disk.percent !== undefined && disk.percent >= 80 ? '#f4b43c' : '#2f80ff'} />
                <small><span>{disk.total !== undefined ? `已使用 ${formatBytes(disk.used)}，共 ${formatBytes(disk.total)}` : '容量信息未上报'}</span>{disk.percent !== undefined ? <b>{Math.round(disk.percent)}%</b> : null}</small>
              </div>
            </div>
          )) : <div className="device-detail-empty-disk"><HddOutlined /><span>设备尚未上报磁盘卷与容量信息</span></div>}
        </div>
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
