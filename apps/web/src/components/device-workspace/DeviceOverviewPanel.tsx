import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloudServerOutlined,
  DesktopOutlined,
  GlobalOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { GatewayEvent } from '@meshcentral/control-client';
import { formatEventMessage } from '@meshcentral/shared-state';
import { Button, Empty, Tag } from 'antd';
import { Sparkline } from '../ConsoleUi';
import type {
  DeviceWorkspaceModel,
  WorkspaceMetric,
  WorkspaceTab,
} from '../../features/device-workspace/types';
import { ConnectionSparkline } from './ConnectionSparkline';

function metricTrend(metric: WorkspaceMetric) {
  return [7, -3, 5, -6, 2, 8, -2, 4].map((offset) =>
    Math.max(0, metric.value + offset),
  );
}

function formatEventTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '刚刚';
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

export function DeviceOverviewPanel({
  model,
  events,
  gatewayConnected,
  onNavigate,
}: {
  model: DeviceWorkspaceModel;
  events: GatewayEvent[];
  gatewayConnected: boolean;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const recentEvents = events.filter((event) => event.deviceId === model.device.id).slice(0, 6);
  const cpu = model.metrics.find((metric) => metric.label === 'CPU');
  const memory = model.metrics.find((metric) => metric.label === '内存');

  return (
    <div className="workspace-overview">
      <div className="workspace-overview-metrics">
        {model.metrics.map((metric) => (
          <section className={`workspace-overview-metric tone-${metric.tone}`} key={metric.label}>
            <div>
              <span>{metric.label} 使用情况</span>
              <strong>{metric.value}<small>{metric.suffix}</small></strong>
              <em>{metric.label === '网络' ? '当前实时吞吐' : '当前资源占用'}</em>
            </div>
            <Sparkline
              values={metricTrend(metric)}
              tone={metric.tone === 'primary' ? 'blue' : metric.tone === 'success' ? 'green' : 'amber'}
            />
          </section>
        ))}
        <section className="workspace-overview-metric tone-primary">
          <div>
            <span>网络延迟</span>
            <strong>{model.latency}<small>ms</small></strong>
            <em>{model.latency < 60 ? '连接质量良好' : '连接存在波动'}</em>
          </div>
          <Sparkline values={model.latencyTrend} tone="blue" />
        </section>
      </div>

      <div className="workspace-overview-main">
        <section className="console-card workspace-panel workspace-health-card">
          <div className="card-header">
            <div><h2>设备健康状态</h2><span>连接、安全与资源状态汇总</span></div>
            <Tag color={model.device.online ? 'success' : 'default'}>
              {model.device.online ? '运行正常' : '设备离线'}
            </Tag>
          </div>
          <div className="workspace-health-grid">
            <div className={model.device.online ? 'is-healthy' : ''}>
              <DesktopOutlined />
              <span>设备连接<strong>{model.device.online ? '在线' : '离线'}</strong></span>
              <CheckCircleFilled />
            </div>
            <div className={gatewayConnected ? 'is-healthy' : ''}>
              <CloudServerOutlined />
              <span>业务网关<strong>{gatewayConnected ? '已连接' : '不可用'}</strong></span>
              <CheckCircleFilled />
            </div>
            <div className="is-healthy">
              <SafetyCertificateOutlined />
              <span>通信安全<strong>端到端加密</strong></span>
              <CheckCircleFilled />
            </div>
            <div className={(cpu?.value ?? 0) < 80 && (memory?.value ?? 0) < 80 ? 'is-healthy' : ''}>
              <ClockCircleOutlined />
              <span>资源负载<strong>处于正常范围</strong></span>
              <CheckCircleFilled />
            </div>
          </div>
          <div className="workspace-overview-actions">
            <Button type="primary" icon={<DesktopOutlined />} onClick={() => onNavigate('desktop')}>
              打开远程桌面
            </Button>
            <Button onClick={() => onNavigate('terminal')}>远程终端</Button>
            <Button onClick={() => onNavigate('files')}>文件管理</Button>
          </div>
        </section>

        <section className="console-card workspace-panel workspace-profile-card">
          <div className="card-header"><div><h2>系统摘要</h2><span>设备身份与运行信息</span></div></div>
          <dl className="workspace-profile-list">
            <div><dt><DesktopOutlined /> 主机名</dt><dd>{model.hostname}</dd></div>
            <div><dt><CloudServerOutlined /> 操作系统</dt><dd>{model.platform}</dd></div>
            <div><dt><GlobalOutlined /> IP 地址</dt><dd>{model.ipAddress}</dd></div>
            <div><dt><GlobalOutlined /> MAC 地址</dt><dd>{model.macAddress}</dd></div>
            <div><dt><UserOutlined /> 当前用户</dt><dd>{model.currentUser}</dd></div>
            <div><dt><ClockCircleOutlined /> 在线时长</dt><dd>{model.uptime}</dd></div>
          </dl>
        </section>
      </div>

      <div className="workspace-overview-bottom">
        <section className="console-card workspace-panel workspace-overview-activity">
          <div className="card-header">
            <div><h2>最近活动</h2><span>当前设备的实时事件</span></div>
            <Button type="link" onClick={() => onNavigate('logs')}>查看日志</Button>
          </div>
          <div className="workspace-overview-event-list">
            {recentEvents.map((event) => (
              <div key={event.id}>
                <i className={event.type === 'deviceOffline' ? 'is-danger' : ''} />
                <span><strong>{formatEventMessage(event, [model.device], [])}</strong><small>{event.user ?? '系统'}</small></span>
                <time>{formatEventTime(event.occurredAt)}</time>
              </div>
            ))}
            {recentEvents.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无设备活动" />}
          </div>
        </section>

        <section className="console-card workspace-panel workspace-overview-quality">
          <div className="card-header">
            <div><h2>连接质量</h2><span>最近一段时间的网络延迟</span></div>
            <Tag color={model.latency < 60 ? 'success' : 'warning'}>{model.latency < 60 ? '良好' : '一般'}</Tag>
          </div>
          <div className="workspace-overview-latency">
            <strong>{model.latency}<small> ms</small></strong>
            <span><i />连接稳定</span>
          </div>
          <ConnectionSparkline values={model.latencyTrend} />
        </section>
      </div>
    </div>
  );
}