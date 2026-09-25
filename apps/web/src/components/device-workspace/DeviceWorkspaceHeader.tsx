import {
  AppstoreOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  WindowsOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { splitUptime } from '../../features/device-workspace/deviceWorkspaceModel';
import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';
import { useFormatters } from '../../i18n/formatters';

function platformIcon(platform: string) {
  const lower = platform.toLowerCase();
  if (lower.includes('win')) return <WindowsOutlined />;
  if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian')) return <CloudServerOutlined />;
  return <DesktopOutlined />;
}

export function DeviceWorkspaceHeader({ model }: { model: DeviceWorkspaceModel }) {
  const { t } = useTranslation();
  const { time } = useFormatters();
  const hw = model.hardware;
  const isDiffName = model.device.name && model.hostname && model.device.name !== model.hostname;
  const uptime = model.uptimeSeconds === undefined ? undefined : splitUptime(model.uptimeSeconds);
  const uptimeText = uptime
    ? [
        uptime.years ? t('deviceWorkspace.duration.years', { count: uptime.years }) : '',
        uptime.months ? t('deviceWorkspace.duration.months', { count: uptime.months }) : '',
        uptime.days ? t('deviceWorkspace.duration.days', { count: uptime.days }) : '',
        uptime.hours ? t('deviceWorkspace.duration.hours', { count: uptime.hours }) : '',
        uptime.minutes || (!uptime.years && !uptime.months && !uptime.days && !uptime.hours)
          ? t('deviceWorkspace.duration.minutes', { count: uptime.minutes })
          : '',
      ].filter(Boolean).join(' ')
    : '—';

  return (
    <header className="workspace-device-header console-card">
      <div className="workspace-device-identity">
        <span className="workspace-device-icon">{platformIcon(model.platform ?? '')}</span>
        <div>
          <div className="workspace-device-title">
            <strong>{model.device.name}</strong>
            {isDiffName && <span className="workspace-rname">({model.hostname})</span>}
            <span className={model.device.online ? 'is-online' : 'is-offline'}>
              <i /> {model.device.online ? t('common.status.online') : t('common.status.offline')}
            </span>
          </div>
          <div className="workspace-device-badges">
            <Tag color="blue">{model.groupName ?? t('common.status.ungrouped')}</Tag>
            <Tag color="cyan">{model.platform ?? t('common.status.unknown')}</Tag>
            {hw?.agentVersion && (
              <Tag color="geekblue">
                {hw.agentVersion} {hw.agentIsRoot ? '(Root)' : ''}
              </Tag>
            )}
            {hw?.security?.pendingReboot && (
              <Tag color="warning" icon={<WarningOutlined />}>
                {t('deviceWorkspace.header.pendingReboot')}
              </Tag>
            )}
          </div>
        </div>
      </div>

      <div className="workspace-header-metrics">
        <div className="workspace-header-metric">
          <span><ThunderboltOutlined /> {t('deviceWorkspace.header.cpu')}</span>
          <strong title={hw?.cpuName || model.cpuName}>{hw?.cpuShortName || model.cpuName || '—'}</strong>
          <small>{hw?.cpuSpeed || t('deviceWorkspace.header.systemHardware')}</small>
        </div>
        <div className="workspace-header-metric">
          <span><AppstoreOutlined /> {t('deviceWorkspace.header.memory')}</span>
          <strong>{hw?.memoryTotal || model.memorySummary || '—'}</strong>
          <small>{hw?.memorySlots ? t('deviceWorkspace.header.slots', { count: hw.memorySlots }) : hw?.memorySpeed || t('deviceWorkspace.header.systemMemory')}</small>
        </div>
        <div className="workspace-header-metric">
          <span><DatabaseOutlined /> {t('deviceWorkspace.header.storage')}</span>
          <strong>{hw?.storageTotal || model.storageSummary || '—'}</strong>
          <small>{hw?.storageRemaining ? t('deviceWorkspace.header.remaining', { value: hw.storageRemaining }) : t('deviceWorkspace.header.localDisk')}</small>
        </div>
        <div className="workspace-header-metric">
          <span><DesktopOutlined /> {t('deviceWorkspace.header.display')}</span>
          <strong title={hw?.gpuName || '—'}>{hw?.gpuName || t('deviceWorkspace.header.standardDisplay')}</strong>
          <small>{hw?.gpuResolution || hw?.primaryNic || '—'}</small>
        </div>
      </div>

      <div className="workspace-header-meta">
        <span><ClockCircleOutlined /> {t('deviceWorkspace.header.uptime')}</span>
        <strong>{uptimeText}</strong>
        <small>{hw?.lastConnectAddr ? t('deviceWorkspace.header.source', { value: hw.lastConnectAddr }) : model.lastHeartbeatAt ? t('deviceWorkspace.header.heartbeat', { value: time(model.lastHeartbeatAt) }) : '—'}</small>
      </div>

      <Tag color={model.device.online ? 'success' : 'default'}>
        {model.device.online ? t('deviceWorkspace.header.connectable') : t('deviceWorkspace.header.unavailable')}
      </Tag>
    </header>
  );
}
