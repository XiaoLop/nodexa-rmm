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
import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';

function platformIcon(platform: string) {
  const lower = platform.toLowerCase();
  if (lower.includes('win')) return <WindowsOutlined />;
  if (lower.includes('linux') || lower.includes('ubuntu') || lower.includes('debian')) return <CloudServerOutlined />;
  return <DesktopOutlined />;
}

export function DeviceWorkspaceHeader({ model }: { model: DeviceWorkspaceModel }) {
  const hw = model.hardware;
  const isDiffName = model.device.name && model.hostname && model.device.name !== model.hostname;

  return (
    <header className="workspace-device-header console-card">
      <div className="workspace-device-identity">
        <span className="workspace-device-icon">{platformIcon(model.platform)}</span>
        <div>
          <div className="workspace-device-title">
            <strong>{model.device.name}</strong>
            {isDiffName && <span className="workspace-rname">({model.hostname})</span>}
            <span className={model.device.online ? 'is-online' : 'is-offline'}>
              <i /> {model.device.online ? '在线' : '离线'}
            </span>
          </div>
          <div className="workspace-device-badges">
            <Tag color="blue">{model.groupName}</Tag>
            <Tag color="cyan">{model.platform}</Tag>
            {hw?.agentVersion && (
              <Tag color="geekblue">
                {hw.agentVersion} {hw.agentIsRoot ? '(Root)' : ''}
              </Tag>
            )}
            {hw?.security?.pendingReboot && (
              <Tag color="warning" icon={<WarningOutlined />}>
                待重启
              </Tag>
            )}
          </div>
        </div>
      </div>

      <div className="workspace-header-metrics">
        <div className="workspace-header-metric">
          <span><ThunderboltOutlined /> 处理器</span>
          <strong title={hw?.cpuName || model.cpuName}>{hw?.cpuShortName || model.cpuName}</strong>
          <small>{hw?.cpuSpeed || '系统硬件'}</small>
        </div>
        <div className="workspace-header-metric">
          <span><AppstoreOutlined /> 物理内存</span>
          <strong>{hw?.memoryTotal || model.memorySummary}</strong>
          <small>{hw?.memorySlots ? `${hw.memorySlots} 个插槽` : hw?.memorySpeed || '系统内存'}</small>
        </div>
        <div className="workspace-header-metric">
          <span><DatabaseOutlined /> 存储容量</span>
          <strong>{hw?.storageTotal || model.storageSummary}</strong>
          <small>{hw?.storageRemaining !== '未提供' ? `余 ${hw?.storageRemaining}` : '本地磁盘'}</small>
        </div>
        <div className="workspace-header-metric">
          <span><DesktopOutlined /> 显卡/显示</span>
          <strong title={hw?.gpuName || '—'}>{hw?.gpuName || '标准显示'}</strong>
          <small>{hw?.gpuResolution || hw?.primaryNic || '—'}</small>
        </div>
      </div>

      <div className="workspace-header-meta">
        <span><ClockCircleOutlined /> 运行时间</span>
        <strong>{model.uptime}</strong>
        <small>{hw?.lastConnectAddr ? `来源 ${hw.lastConnectAddr}` : `心跳 ${model.lastHeartbeat === '刚刚' ? '刚刚' : new Date(model.lastHeartbeat).toLocaleTimeString('zh-CN')}`}</small>
      </div>

      <Tag color={model.device.online ? 'success' : 'default'}>
        {model.device.online ? '可连接' : '不可连接'}
      </Tag>
    </header>
  );
}
