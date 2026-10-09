import {
  ApiOutlined,
  AppstoreOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  CloudServerOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  EnvironmentOutlined,
  ExclamationCircleFilled,
  GlobalOutlined,
  HddOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { MeshCentralEvent } from '@meshcentral/control-client';
import { Button, Empty, Progress, Tag } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDeviceLocation } from '../../features/device-location/formatDeviceLocation';
import { splitUptime } from '../../features/device-workspace/deviceWorkspaceModel';
import { eventMessage, isHistoricalEventVisible } from '../../features/events/eventPresentation';
import type {
  DeviceWorkspaceModel,
  WorkspaceTab,
} from '../../features/device-workspace/types';
import { useFormatters } from '../../i18n/formatters';

function statusIndicator(status: string | undefined, labels: { unknown: string; healthy: string; warning: string; danger: string }, okValue = 'OK') {
  if (!status) {
    return { className: '', icon: <CheckCircleFilled />, text: labels.unknown };
  }
  if (status === okValue || status === 'true') {
    return { className: 'is-healthy', icon: <CheckCircleFilled />, text: labels.healthy };
  }
  if (status === 'WARNING') {
    return { className: 'is-warning', icon: <ExclamationCircleFilled />, text: labels.warning };
  }
  return { className: 'is-danger', icon: <CloseCircleFilled />, text: labels.danger };
}

export function DeviceOverviewPanel({
  model,
  historyEvents,
  controlConnected,
  onNavigate,
}: {
  model: DeviceWorkspaceModel;
  historyEvents: MeshCentralEvent[];
  controlConnected: boolean;
  onNavigate: (tab: WorkspaceTab) => void;
}) {
  const { t, i18n } = useTranslation();
  const { time, dateTime } = useFormatters();
  const hw = model.hardware;
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
  const sec = hw?.security;
  const hasSystemSummary = model.hasSystemDetails && Boolean(hw.cpuName || hw.memoryTotal || hw.storageTotal);
  const hasNetworkSummary = model.hasNetworkDetails && hw.interfaces.length > 0;
  const hasSecurityDetails = Boolean(
    sec?.antiVirus ||
    sec?.firewall ||
    sec?.autoUpdate ||
    sec?.realTimeProtection !== undefined,
  );
  const recentEvents = useMemo(() => {
    return [...historyEvents]
      .filter(isHistoricalEventVisible)
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, 20);
  }, [historyEvents]);
  const locationText = formatDeviceLocation(model.location, i18n.resolvedLanguage ?? i18n.language);

  const statusLabels = { unknown: t('deviceWorkspace.overview.status.unknown'), healthy: t('deviceWorkspace.overview.status.healthy'), warning: t('deviceWorkspace.overview.status.warning'), danger: t('deviceWorkspace.overview.status.danger') };
  const avStatus = statusIndicator(sec?.antiVirus, statusLabels);
  const fwStatus = statusIndicator(sec?.firewall, statusLabels);
  const updateStatus = statusIndicator(sec?.autoUpdate, statusLabels);
  const rtpStatus = statusIndicator(
    sec?.realTimeProtection === undefined ? undefined : sec.realTimeProtection ? 'OK' : 'PROBLEM', statusLabels,
  );

  return (
    <div className="workspace-overview">
      {(hasSystemSummary || hasNetworkSummary) && (
        <div className="workspace-overview-metrics workspace-static-facts">
          {model.hasSystemDetails && hw.cpuName && (
            <section className="workspace-overview-metric tone-primary">
              <div>
                <span>{t('deviceWorkspace.overview.cpu')}</span>
                <strong title={hw.cpuName}>{hw.cpuShortName}</strong>
                {hw.cpuSpeed && <em>{t('deviceWorkspace.overview.frequency', { value: hw.cpuSpeed })}</em>}
              </div>
              <ThunderboltOutlined className="workspace-metric-icon" />
            </section>
          )}

          {model.hasSystemDetails && hw.memoryTotal && (
            <section className="workspace-overview-metric tone-success">
              <div>
                <span>{t('deviceWorkspace.overview.memory')}</span>
                <strong>{hw.memoryTotal}</strong>
                {(hw.memorySlots > 0 || hw.memorySpeed) && (
                  <em>{hw.memorySlots > 0 ? t('deviceWorkspace.overview.slots', { count: hw.memorySlots }) : ''} {hw.memorySpeed ? `· ${hw.memorySpeed}` : ''}</em>
                )}
              </div>
              <AppstoreOutlined className="workspace-metric-icon" />
            </section>
          )}

          {model.hasSystemDetails && hw.storageTotal && (
            <section className="workspace-overview-metric tone-warning">
              <div>
                <span>{t('deviceWorkspace.overview.storage')}</span>
                <strong>{hw.storageTotal}</strong>
                <em>{hw.storageRemaining ? t('deviceWorkspace.overview.available', { value: hw.storageRemaining }) : ''}{hw.volumes.length > 0 ? ` · ${t('deviceWorkspace.overview.volumes', { count: hw.volumes.length })}` : ''}</em>
              </div>
              <DatabaseOutlined className="workspace-metric-icon" />
            </section>
          )}

          {hasNetworkSummary && (
            <section className="workspace-overview-metric tone-cyan">
              <div>
                <span>{t('deviceWorkspace.overview.network')}</span>
                <strong>{hw.primarySpeed || hw.interfaces[0]?.name}</strong>
                <em>{model.ipAddress ? `${model.ipAddress} · ` : ''}{t('deviceWorkspace.overview.interfaces', { count: hw.interfaces.length })}</em>
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
                <h2>{t('deviceWorkspace.overview.healthTitle')}</h2>
                <span>{hasSecurityDetails ? t('deviceWorkspace.overview.securityDescription') : t('deviceWorkspace.overview.connectionDescription')}</span>
              </div>
              <Tag color={model.device.online ? 'success' : 'default'}>
                {model.device.online ? t('common.status.online') : t('common.status.offline')}
              </Tag>
            </div>

            {sec?.pendingReboot && (
              <div className="workspace-pending-banner">
                <WarningOutlined />
                <span>{t('deviceWorkspace.overview.pendingReboot', { value: sec.pendingReboot })}</span>
              </div>
            )}

            <div className="workspace-health-grid">
              <div className={model.device.online ? 'is-healthy' : 'is-danger'}>
                <DesktopOutlined />
                <span>{t('deviceWorkspace.overview.deviceSignal')}<strong>{model.device.online ? t('deviceWorkspace.overview.connected') : t('common.status.disconnected')}</strong></span>
                {model.device.online ? <CheckCircleFilled /> : <CloseCircleFilled />}
              </div>
              <div className={controlConnected ? 'is-healthy' : 'is-danger'}>
                <CloudServerOutlined />
                <span>{t('deviceWorkspace.overview.gateway')}<strong>{controlConnected ? t('deviceWorkspace.overview.connected') : t('deviceWorkspace.overview.gatewayOffline')}</strong></span>
                {controlConnected ? <CheckCircleFilled /> : <CloseCircleFilled />}
              </div>
              {sec?.antiVirus && (
                <div className={avStatus.className}>
                  <SafetyCertificateOutlined />
                  <span>{t('deviceWorkspace.overview.antivirus')}<strong>{avStatus.text}</strong></span>
                  {avStatus.icon}
                </div>
              )}
              {sec?.firewall && (
                <div className={fwStatus.className}>
                  <SafetyCertificateOutlined />
                  <span>{t('deviceWorkspace.overview.firewall')}<strong>{fwStatus.text}</strong></span>
                  {fwStatus.icon}
                </div>
              )}
              {sec?.autoUpdate && (
                <div className={updateStatus.className}>
                  <ClockCircleOutlined />
                  <span>{t('deviceWorkspace.overview.updates')}<strong>{updateStatus.text}</strong></span>
                  {updateStatus.icon}
                </div>
              )}
              {sec?.realTimeProtection !== undefined && (
                <div className={rtpStatus.className}>
                  <SafetyCertificateOutlined />
                  <span>{t('deviceWorkspace.overview.realtimeProtection')}<strong>{rtpStatus.text}</strong></span>
                  {rtpStatus.icon}
                </div>
              )}
            </div>
          </section>

          {hw?.volumes && hw.volumes.length > 0 && (
            <section className="console-card workspace-panel workspace-volumes-card">
              <div className="card-header">
                <div>
                  <h2>{t('deviceWorkspace.overview.volumesTitle')}</h2>
                  <span>{t('deviceWorkspace.overview.volumesDescription')}</span>
                </div>
                <small style={{ color: 'var(--muted)', fontSize: 10 }}>{t('deviceWorkspace.overview.volumeCount', { count: hw.volumes.length })}</small>
              </div>
              <div className="workspace-volume-list">
                {hw.volumes.map((vol) => (
                  <div className="workspace-volume-item" key={vol.letter}>
                    <div className="workspace-volume-header">
                      <strong>
                        <HddOutlined style={{ color: '#4096ff' }} />
                        {vol.letter} {vol.name ? `[${vol.name}]` : ''}
                      </strong>
                      <span>{vol.type} · {t('deviceWorkspace.overview.usedPercent', { value: vol.usedPercent })}</span>
                    </div>
                    <Progress
                      percent={vol.usedPercent}
                      size="small"
                      status={vol.usedPercent >= 90 ? 'exception' : 'normal'}
                      strokeColor={vol.usedPercent >= 90 ? '#ff4d4f' : vol.usedPercent >= 75 ? '#faad14' : '#2f80ff'}
                    />
                    <div className="workspace-volume-meta">
                      <span>{t('deviceWorkspace.overview.totalCapacity')} <b>{vol.sizeFormatted}</b></span>
                      <span>{t('deviceWorkspace.overview.remaining')} <b>{vol.remainingFormatted}</b></span>
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
              <h2>{t('deviceWorkspace.overview.profileTitle')}</h2>
              <span>{t('deviceWorkspace.overview.profileDescription')}</span>
            </div>
          </div>
          <dl className="workspace-profile-list">
            <div><dt><DesktopOutlined /> {t('deviceWorkspace.overview.fields.hostname')}</dt><dd title={model.hostname}>{model.hostname}</dd></div>
            <div><dt><CloudServerOutlined /> {t('deviceWorkspace.overview.fields.platform')}</dt><dd title={model.platform}>{model.platform ?? t(`deviceWorkspace.data.platforms.${hw.platformKind}`)}</dd></div>
            <div><dt><ApiOutlined /> {t('deviceWorkspace.overview.fields.management')}</dt><dd>{t(`deviceWorkspace.data.management.${model.managementKind}`)}</dd></div>
            {locationText && <div><dt><EnvironmentOutlined /> {t('deviceWorkspace.overview.fields.location')}</dt><dd title={t('deviceWorkspace.location.approximate')}>{locationText}</dd></div>}
            {hw.deviceModel && <div><dt><DesktopOutlined /> {t('deviceWorkspace.overview.fields.deviceModel')}</dt><dd title={hw.deviceModel}>{hw.deviceModel}</dd></div>}
            {hw.osVersion && <div><dt><CloudServerOutlined /> {t('deviceWorkspace.overview.fields.osVersion')}</dt><dd title={hw.osVersion}>{hw.osVersion}</dd></div>}
            {hw.kernelVersion && <div><dt><ApiOutlined /> {t('deviceWorkspace.overview.fields.kernel')}</dt><dd title={hw.kernelVersion}>{hw.kernelVersion}</dd></div>}
            {hw.bootloader && <div><dt><ApiOutlined /> {t('deviceWorkspace.overview.fields.bootloader')}</dt><dd title={hw.bootloader}>{hw.bootloader}</dd></div>}
            {model.hasSystemDetails && hw.cpuName && <div><dt><ThunderboltOutlined /> {t('deviceWorkspace.overview.fields.cpu')}</dt><dd title={hw.cpuName}>{hw.cpuName}</dd></div>}
            {model.hasSystemDetails && hw.gpuName && <div><dt><DesktopOutlined /> {t('deviceWorkspace.overview.fields.gpu')}</dt><dd title={hw.gpuName}>{hw.gpuName}</dd></div>}
            {model.hasSystemDetails && hw.boardName && <div><dt><AppstoreOutlined /> {t('deviceWorkspace.overview.fields.board')}</dt><dd title={`${hw.boardName} (${hw.biosVersion ?? ''})`}>{hw.boardName}</dd></div>}
            {model.currentUser && <div><dt><UserOutlined /> {t('deviceWorkspace.overview.fields.currentUser')}</dt><dd>{model.currentUser}</dd></div>}
            {model.uptimeSeconds !== undefined && <div><dt><ClockCircleOutlined /> {t('deviceWorkspace.overview.fields.uptime')}</dt><dd>{uptimeText}</dd></div>}
            {hw.agentVersion && <div><dt><ApiOutlined /> {t('deviceWorkspace.overview.fields.agent')}</dt><dd>{hw.agentVersion} {hw.agentIsRoot ? `(${t('deviceWorkspace.overview.adminMode')})` : ''}</dd></div>}
          </dl>
        </section>
      </div>

      <div className="workspace-overview-bottom">
        <section className="console-card workspace-panel workspace-overview-activity">
          <div className="card-header">
            <div><h2>{t('deviceWorkspace.overview.activityTitle')}</h2><span>{t('deviceWorkspace.overview.activityDescription')}</span></div>
            <Button type="link" onClick={() => onNavigate('logs')}>{t('deviceWorkspace.overview.viewLogs')}</Button>
          </div>
          <div className="workspace-overview-event-list">
            {recentEvents.map((event) => (
              <div key={event.id}>
                <i className={event.type === 'deviceOffline' ? 'is-danger' : ''} />
                <span>
                  <strong>{eventMessage(event)}</strong>
                  <small>{event.user ?? t('common.status.systemEvent')}</small>
                </span>
                <time>{time(event.occurredAt)}</time>
              </div>
            ))}
            {recentEvents.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('deviceWorkspace.overview.noActivity')} />}
          </div>
        </section>

        <section className="console-card workspace-panel workspace-overview-quality">
          <div className="card-header">
            <div><h2>{t('deviceWorkspace.overview.networkTitle')}</h2><span>{t('deviceWorkspace.overview.networkDescription')}</span></div>
          </div>
          <dl className="workspace-profile-list">
            {model.ipAddress && <div><dt><GlobalOutlined /> {t('deviceWorkspace.overview.fields.ipv4')}</dt><dd>{model.ipAddress}</dd></div>}
            {model.macAddress && <div><dt><GlobalOutlined /> {t('deviceWorkspace.overview.fields.mac')}</dt><dd>{model.macAddress}</dd></div>}
            {model.hasNetworkDetails && hw.primaryNic && <div><dt><ApiOutlined /> {t('deviceWorkspace.overview.fields.primaryNic')}</dt><dd>{hw.primaryNic}</dd></div>}
            {model.hasNetworkDetails && hw.dns.length > 0 && <div><dt><GlobalOutlined /> {t('deviceWorkspace.overview.fields.dns')}</dt><dd title={hw.dns.join(', ')}>{hw.dns[0]}</dd></div>}
            {hw.lastConnectAddr && <div><dt><DesktopOutlined /> {t('deviceWorkspace.overview.fields.remoteSource')}</dt><dd title={hw.lastConnectAddr}>{hw.lastConnectAddr}</dd></div>}
            {(hw.lastConnectTime || model.lastHeartbeatAt) && <div><dt><ClockCircleOutlined /> {t('deviceWorkspace.overview.fields.lastConnection')}</dt><dd>{hw.lastConnectTime || dateTime(model.lastHeartbeatAt as string)}</dd></div>}
          </dl>
        </section>
      </div>
    </div>
  );
}