import { EditOutlined, SignalFilled } from '@ant-design/icons';
import { Button, Progress, Tag, Tooltip } from 'antd';
import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';

export function DeviceInfoPanel({ model }: { model: DeviceWorkspaceModel }) {
  const cpu = model.metrics.find((metric) => metric.label === 'CPU')?.value ?? 0;
  const memory = model.metrics.find((metric) => metric.label === '内存')?.value ?? 0;
  const rows = [
    ['主机名', model.hostname],
    ['操作系统', model.platform],
    ['IP 地址', model.ipAddress],
    ['MAC 地址', model.macAddress],
  ];

  return (
    <aside className="workspace-left-column">
      <section className="console-card workspace-panel">
        <div className="card-header">
          <h2>设备信息</h2>
          <Tooltip title="静态演示暂不支持编辑"><Button type="text" size="small" icon={<EditOutlined />} /></Tooltip>
        </div>
        <div className="workspace-info-list">
          {rows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
          <div><span>CPU 使用率</span><strong>{cpu}%</strong></div>
          <Progress percent={cpu} showInfo={false} size="small" />
          <div><span>内存使用率</span><strong>{memory}%</strong></div>
          <Progress percent={memory} showInfo={false} size="small" strokeColor="#2dcc70" />
          <div><span>网络延迟</span><strong>{model.latency} ms <SignalFilled className="workspace-signal" /></strong></div>
          <div><span>当前用户</span><strong>{model.currentUser}</strong></div>
          <div><span>在线时长</span><strong>{model.uptime}</strong></div>
          <div><span>最后心跳</span><strong>{model.lastHeartbeat === '刚刚' ? model.lastHeartbeat : new Date(model.lastHeartbeat).toLocaleString('zh-CN')}</strong></div>
        </div>
      </section>
      <section className="console-card workspace-panel workspace-group-panel">
        <div className="card-header"><h2>设备分组</h2></div>
        <div className="workspace-group-value"><span>⌂</span>{model.groupName}<b>1</b></div>
      </section>
      <section className="console-card workspace-panel workspace-tags-panel">
        <div className="card-header"><h2>标签</h2></div>
        <div>{model.tags.map((tag) => <Tag color="blue" key={tag}>{tag}</Tag>)}</div>
      </section>
    </aside>
  );
}
