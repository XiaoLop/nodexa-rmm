import { ClockCircleOutlined, DesktopOutlined, UserOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';

export function DeviceWorkspaceHeader({ model }: { model: DeviceWorkspaceModel }) {
  return (
    <header className="workspace-device-header console-card">
      <div className="workspace-device-identity">
        <span className="workspace-device-icon"><DesktopOutlined /></span>
        <div>
          <div className="workspace-device-title">
            <strong>{model.hostname}</strong>
            <span className={model.device.online ? 'is-online' : 'is-offline'}>
              <i /> {model.device.online ? '在线' : '离线'}
            </span>
          </div>
          <small>{model.platform} · {model.ipAddress}</small>
        </div>
      </div>
      <div className="workspace-header-metrics">
        {model.metrics.map((metric) => (
          <div className={`workspace-header-metric tone-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}{metric.suffix}</strong>
            <i><b style={{ width: `${Math.min(metric.value, 100)}%` }} /></i>
          </div>
        ))}
        <div className="workspace-header-metric tone-primary">
          <span>延迟</span>
          <strong>{model.latency} ms</strong>
          <i><b style={{ width: `${Math.min(model.latency * 2, 100)}%` }} /></i>
        </div>
      </div>
      <div className="workspace-header-meta">
        <span><UserOutlined /> 当前用户</span>
        <strong>{model.currentUser}</strong>
      </div>
      <div className="workspace-header-meta">
        <span><ClockCircleOutlined /> 最后心跳</span>
        <strong>{model.lastHeartbeat === '刚刚' ? model.lastHeartbeat : new Date(model.lastHeartbeat).toLocaleString('zh-CN')}</strong>
      </div>
      <Tag color={model.device.online ? 'success' : 'default'}>{model.device.online ? '可连接' : '不可连接'}</Tag>
    </header>
  );
}
