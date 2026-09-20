import {
  ApiOutlined,
  AppstoreOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  CloudServerOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  ExclamationCircleFilled,
  GlobalOutlined,
  HddOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { GatewayClient, GatewayEvent } from '@meshcentral/control-client';
import { formatEventMessage } from '@meshcentral/shared-state';
import { Button, Empty, Progress, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import type {
  DeviceWorkspaceModel,
  WorkspaceTab,
} from '../../features/device-workspace/types';

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

function statusIndicator(status: string | undefined, okValue = 'OK') {
  if (!status) {
    return { className: '', icon: <CheckCircleFilled />, text: '未检测' };
  }
  if (status === okValue || status === 'true') {
    return { className: 'is-healthy', icon: <CheckCircleFilled />, text: '正常运行' };
  }
  if (status === 'WARNING') {
    return { className: 'is-warning', icon: <ExclamationCircleFilled />, text: '存在警告' };
  }
  return { className: 'is-danger', icon: <CloseCircleFilled />, text: '异常或关闭' };
}

export function DeviceOverviewPanel({
  model,
  events,
  gatewayClient,
  gatewayConnected,
  onNavigate,
}: {
  model: DeviceWorkspaceModel;
  events: GatewayEvent[];
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const hw = model.hardware;
  const sec = hw?.security;
  const hasSystemSummary = model.hasSystemDetails && (
    hw.cpuName !== '未提供' ||
    hw.memoryTotal !== '未提供' ||
    hw.storageTotal !== '未提供'
  );
  const hasNetworkSummary = model.hasNetworkDetails && hw.interfaces.length > 0;
  const hasSecurityDetails = Boolean(
    sec?.antiVirus ||
    sec?.firewall ||
    sec?.autoUpdate ||
    sec?.realTimeProtection !== undefined,
  );
  const [historyEvents, setHistoryEvents] = useState<GatewayEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    setHistoryEvents([]);
    if (!gatewayClient || !gatewayConnected) return;
    void gatewayClient.events
      .listByDevice(model.device.id, { limit: 20 })
      .then((result) => {
        if (!cancelled) setHistoryEvents(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [gatewayClient, gatewayConnected, model.device.id]);

  const recentEvents = useMemo(() => {
    const byId = new Map(historyEvents.map((event) => [event.id, event]));
    for (const event of events) {
      if (event.deviceId === model.device.id) byId.set(event.id, event);
    }
    return [...byId.values()]
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, 20);
  }, [events, historyEvents, model.device.id]);

  const avStatus = statusIndicator(sec?.antiVirus);
  const fwStatus = statusIndicator(sec?.firewall);
  const updateStatus = statusIndicator(sec?.autoUpdate);
  const rtpStatus = statusIndicator(
    sec?.realTimeProtection === undefined ? undefined : sec.realTimeProtection ? 'OK' : 'PROBLEM',
  );

  return (
    <div className="workspace-overview">
      {(hasSystemSummary || hasNetworkSummary) && (
        <div className="workspace-overview-metrics workspace-static-facts">
          {model.hasSystemDetails && hw.cpuName !== '未提供' && (
            <section className="workspace-overview-metric tone-primary">
              <div>
                <span>处理器 (CPU)</span>
                <strong title={hw.cpuName}>{hw.cpuShortName}</strong>
                {hw.cpuSpeed && <em>频率 {hw.cpuSpeed}</em>}
              </div>
              <ThunderboltOutlined className="workspace-metric-icon" />
            </section>
          )}

          {model.hasSystemDetails && hw.memoryTotal !== '未提供' && (
            <section className="workspace-overview-metric tone-success">
              <div>
                <span>系统物理内存</span>
                <strong>{hw.memoryTotal}</strong>
                {(hw.memorySlots > 0 || hw.memorySpeed) && (
                  <em>{hw.memorySlots > 0 ? `${hw.memorySlots} 个插槽` : ''} {hw.memorySpeed ? `· ${hw.memorySpeed}` : ''}</em>
                )}
              </div>
              <AppstoreOutlined className="workspace-metric-icon" />
            </section>
          )}

          {model.hasSystemDetails && hw.storageTotal !== '未提供' && (
            <section className="workspace-overview-metric tone-warning">
              <div>
                <span>本地存储空间</span>
                <strong>{hw.storageTotal}</strong>
                <em>{hw.storageRemaining !== '未提供' ? `可用 ${hw.storageRemaining}` : ''}{hw.volumes.length > 0 ? ` · ${hw.volumes.length} 个逻辑卷` : ''}</em>
              </div>
              <DatabaseOutlined className="workspace-metric-icon" />
            </section>
          )}

          {hasNetworkSummary && (
            <section className="workspace-overview-metric tone-cyan">
              <div>
                <span>主网络适配器</span>
                <strong>{hw.primarySpeed || hw.interfaces[0]?.name}</strong>
                <em>{model.ipAddress !== '—' ? `${model.ipAddress} · ` : ''}{hw.interfaces.length} 个活动网卡</em>
              </div>
              <GlobalOutlined className="workspace-metric-icon" />
            </section>
          )}
        </div>
      )}

      <div className="workspace-overview-main">
        <div className="workspace-left-column">
          <section className="console-card workspace-panel workspace-health-card">
            <div className="card-header">
              <div>
                <h2>设备健康与安全中心</h2>
                <span>{hasSecurityDetails ? '系统运行基线与 Windows 安全中心检测' : '设备与业务网关连接状态'}</span>
              </div>
              <Tag color={model.device.online ? 'success' : 'default'}>
                {model.device.online ? '设备在线' : '设备离线'}
              </Tag>
            </div>

            {sec?.pendingReboot && (
              <div className="workspace-pending-banner">
                <WarningOutlined />
                <span>系统提示：检测到待重启事项（{sec.pendingReboot}），建议适时重启设备。</span>
              </div>
            )}

            <div className="workspace-health-grid">
              <div className={model.device.online ? 'is-healthy' : 'is-danger'}>
                <DesktopOutlined />
                <span>设备信令<strong>{model.device.online ? '连接正常' : '已断开'}</strong></span>
                {model.device.online ? <CheckCircleFilled /> : <CloseCircleFilled />}
              </div>
              <div className={gatewayConnected ? 'is-healthy' : 'is-danger'}>
                <CloudServerOutlined />
                <span>业务网关<strong>{gatewayConnected ? '正常连接' : '网关离线'}</strong></span>
                {gatewayConnected ? <CheckCircleFilled /> : <CloseCircleFilled />}
              </div>
              {sec?.antiVirus && (
                <div className={avStatus.className}>
                  <SafetyCertificateOutlined />
                  <span>病毒防护<strong>{avStatus.text}</strong></span>
                  {avStatus.icon}
                </div>
              )}
              {sec?.firewall && (
                <div className={fwStatus.className}>
                  <SafetyCertificateOutlined />
                  <span>系统防火墙<strong>{fwStatus.text}</strong></span>
                  {fwStatus.icon}
                </div>
              )}
              {sec?.autoUpdate && (
                <div className={updateStatus.className}>
                  <ClockCircleOutlined />
                  <span>自动更新<strong>{updateStatus.text}</strong></span>
                  {updateStatus.icon}
                </div>
              )}
              {sec?.realTimeProtection !== undefined && (
                <div className={rtpStatus.className}>
                  <SafetyCertificateOutlined />
                  <span>实时保护<strong>{rtpStatus.text}</strong></span>
                  {rtpStatus.icon}
                </div>
              )}
            </div>
          </section>

          {hw?.volumes && hw.volumes.length > 0 && (
            <section className="console-card workspace-panel workspace-volumes-card">
              <div className="card-header">
                <div>
                  <h2>磁盘卷存储分布</h2>
                  <span>磁盘逻辑分区与剩余容量</span>
                </div>
                <small style={{ color: 'var(--muted)', fontSize: 10 }}>共 {hw.volumes.length} 个卷</small>
              </div>
              <div className="workspace-volume-list">
                {hw.volumes.map((vol) => (
                  <div className="workspace-volume-item" key={vol.letter}>
                    <div className="workspace-volume-header">
                      <strong>
                        <HddOutlined style={{ color: '#4096ff' }} />
                        {vol.letter} {vol.name ? `[${vol.name}]` : ''}
                      </strong>
                      <span>{vol.type} · 已用 {vol.usedPercent}%</span>
                    </div>
                    <Progress
                      percent={vol.usedPercent}
                      size="small"
                      status={vol.usedPercent >= 90 ? 'exception' : 'normal'}
                      strokeColor={vol.usedPercent >= 90 ? '#ff4d4f' : vol.usedPercent >= 75 ? '#faad14' : '#2f80ff'}
                    />
                    <div className="workspace-volume-meta">
                      <span>总容量 <b>{vol.sizeFormatted}</b></span>
                      <span>剩余可用 <b>{vol.remainingFormatted}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="console-card workspace-panel workspace-profile-card">
          <div className="card-header">
            <div>
              <h2>系统与硬件规格</h2>
              <span>设备身份与底层组件信息</span>
            </div>
          </div>
          <dl className="workspace-profile-list">
            <div><dt><DesktopOutlined /> 主机名</dt><dd title={model.hostname}>{model.hostname}</dd></div>
            <div><dt><CloudServerOutlined /> 操作系统</dt><dd title={model.platform}>{model.platform}</dd></div>
            {model.hasSystemDetails && hw.cpuName !== '未提供' && <div><dt><ThunderboltOutlined /> 处理器型号</dt><dd title={hw.cpuName}>{hw.cpuName}</dd></div>}
            {model.hasSystemDetails && hw.gpuName !== '—' && <div><dt><DesktopOutlined /> 显卡设备</dt><dd title={hw.gpuName}>{hw.gpuName}</dd></div>}
            {model.hasSystemDetails && hw.boardName !== '—' && <div><dt><AppstoreOutlined /> 主板 / BIOS</dt><dd title={`${hw.boardName} (${hw.biosVersion})`}>{hw.boardName}</dd></div>}
            {model.currentUser !== '—' && <div><dt><UserOutlined /> 当前用户</dt><dd>{model.currentUser}</dd></div>}
            {model.uptime !== '—' && <div><dt><ClockCircleOutlined /> 在线运行时长</dt><dd>{model.uptime}</dd></div>}
            {hw.agentVersion && <div><dt><ApiOutlined /> Agent 核心</dt><dd>{hw.agentVersion} {hw.agentIsRoot ? '(管理员模式)' : ''}</dd></div>}
          </dl>
        </section>
      </div>

      <div className="workspace-overview-bottom">
        <section className="console-card workspace-panel workspace-overview-activity">
          <div className="card-header">
            <div><h2>最近设备活动</h2><span>当前设备的实时网关事件</span></div>
            <Button type="link" onClick={() => onNavigate('logs')}>查看日志</Button>
          </div>
          <div className="workspace-overview-event-list">
            {recentEvents.map((event) => (
              <div key={event.id}>
                <i className={event.type === 'deviceOffline' ? 'is-danger' : ''} />
                <span>
                  <strong>{formatEventMessage(event, [model.device], [])}</strong>
                  <small>{event.user ?? '系统'}</small>
                </span>
                <time>{formatEventTime(event.occurredAt)}</time>
              </div>
            ))}
            {recentEvents.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无设备活动" />}
          </div>
        </section>

        <section className="console-card workspace-panel workspace-overview-quality">
          <div className="card-header">
            <div><h2>网络配置与连接审计</h2><span>接口详情与最后接入来源</span></div>
          </div>
          <dl className="workspace-profile-list">
            {model.ipAddress !== '—' && <div><dt><GlobalOutlined /> IPv4 地址</dt><dd>{model.ipAddress}</dd></div>}
            {model.macAddress !== '—' && <div><dt><GlobalOutlined /> 物理 MAC</dt><dd>{model.macAddress}</dd></div>}
            {model.hasNetworkDetails && hw.primaryNic !== '未提供' && <div><dt><ApiOutlined /> 主网卡接口</dt><dd>{hw.primaryNic}</dd></div>}
            {model.hasNetworkDetails && hw.dns.length > 0 && <div><dt><GlobalOutlined /> DNS 服务器</dt><dd title={hw.dns.join(', ')}>{hw.dns[0]}</dd></div>}
            {hw.lastConnectAddr && <div><dt><DesktopOutlined /> 远端接入源</dt><dd title={hw.lastConnectAddr}>{hw.lastConnectAddr}</dd></div>}
            {(hw.lastConnectTime || model.lastHeartbeat) && <div><dt><ClockCircleOutlined /> 最后连接时间</dt><dd>{hw.lastConnectTime || (model.lastHeartbeat === '刚刚' ? '刚刚' : new Date(model.lastHeartbeat).toLocaleString('zh-CN'))}</dd></div>}
          </dl>
        </section>
      </div>
    </div>
  );
}