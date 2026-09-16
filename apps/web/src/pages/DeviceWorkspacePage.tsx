import {
  AppstoreOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { Button, Empty, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DeviceOverviewPanel } from '../components/device-workspace/DeviceOverviewPanel';
import { DeviceLogsPanel } from '../components/device-workspace/DeviceLogsPanel';
import { DeviceWorkspaceHeader } from '../components/device-workspace/DeviceWorkspaceHeader';
import {
  DeviceProcessesPanel,
  DeviceServicesPanel,
} from '../components/device-workspace/SystemManagementPanels';
import { DeviceFilesPanel } from '../components/device-workspace/files/DeviceFilesPanel';
import { RemoteDesktopPanel, type RemoteDesktopPanelHandle } from '../components/device-workspace/RemoteDesktopPanel';
import { WorkspaceSettings, type WorkspaceSettingsValue } from '../components/device-workspace/WorkspaceSettings';
import { WorkspaceTabs } from '../components/device-workspace/WorkspaceTabs';
import { TerminalPanel } from '../components/device-workspace/terminal/TerminalPanel';
import { createDeviceWorkspaceModel } from '../features/device-workspace/deviceWorkspaceModel.ts';
import type { WorkspaceTab } from '../features/device-workspace/types';
import { useGatewayData } from '../features/gateway/useGatewayData';

const WORKSPACE_TABS: WorkspaceTab[] = [
  'overview',
  'desktop',
  'terminal',
  'files',
  'processes',
  'services',
  'logs',
  'monitoring',
  'security',
];

function workspaceTab(value: string | null): WorkspaceTab {
  return WORKSPACE_TABS.includes(value as WorkspaceTab) ? (value as WorkspaceTab) : 'overview';
}

export function DeviceWorkspacePage() {
  const data = useGatewayData();
  const navigate = useNavigate();
  const { deviceId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [, messageContextHolder] = message.useMessage();
  const desktopPanelRef = useRef<RemoteDesktopPanelHandle>(null);
  const activeTab = workspaceTab(searchParams.get('tab'));
  const [scale, setScale] = useState('fit');
  const [desktopSessionActive, setDesktopSessionActive] = useState(false);
  const [deviceDetails, setDeviceDetails] = useState<Awaited<ReturnType<NonNullable<typeof data.client>['devices']['details']>>>();
  const [desktopLatency, setDesktopLatency] = useState<number>();
  const [desktopLatencyTrend, setDesktopLatencyTrend] = useState<number[]>([]);
  const [desktopLatencyTimedOut, setDesktopLatencyTimedOut] = useState(false);
  const [settings, setSettings] = useState<WorkspaceSettingsValue>({
    keyboard: true,
    mouse: true,
    screenInput: false,
    resolution: '1280 × 720',
    colorDepth: '32 位',
    quality: 58,
  });
  const device = data.devices.find((item) => item.id === deviceId);
  const workspaceLoading =
    !device &&
    (data.initializing ||
      data.status === 'idle' ||
      data.status === 'connecting' ||
      data.status === 'reconnecting');
  useEffect(() => {
    let cancelled = false;
    setDeviceDetails(undefined);
    if (!deviceId || !device || data.status !== 'connected' || !data.client) return;
    void data.client.devices
      .details(deviceId)
      .then((details) => {
        if (!cancelled) setDeviceDetails(details);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [data.client, data.status, device?.id, deviceId]);
  const model = useMemo(() => {
    if (!device) return undefined;
    const groupName = data.groups.find((group) => group.id === device.groupId)?.name;
    return createDeviceWorkspaceModel(device, deviceDetails, groupName);
  }, [data.groups, device, deviceDetails]);
  const setActiveTab = (tab: WorkspaceTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };
  const handleDesktopLatencyChange = (latencyMs: number | undefined) => {
    setDesktopLatency(latencyMs);
    setDesktopLatencyTimedOut(latencyMs === undefined);
    if (latencyMs !== undefined) setDesktopLatencyTrend((current) => [...current.slice(-19), latencyMs]);
  };
  const handleDesktopSessionActiveChange = (active: boolean) => {
    setDesktopSessionActive(active);
    if (!active) {
      setDesktopLatency(undefined);
      setDesktopLatencyTrend([]);
      setDesktopLatencyTimedOut(false);
    }
  };

  if (workspaceLoading) {
    return (
      <main
        className="device-workspace-page page-stack workspace-loading"
        aria-busy="true"
        aria-label="正在加载设备工作区"
      >
        {messageContextHolder}
        <header className="workspace-device-header console-card workspace-loading-header" aria-hidden="true">
          <div className="workspace-device-identity">
            <span className="workspace-device-icon workspace-loading-device-icon">
              <DesktopOutlined />
            </span>
            <div className="workspace-loading-identity-copy">
              <span className="workspace-loading-line is-device-name" />
              <div className="workspace-loading-badges">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>

          <div className="workspace-header-metrics">
            {[ThunderboltOutlined, AppstoreOutlined, DatabaseOutlined, DesktopOutlined].map(
              (MetricIcon, index) => (
                <div className="workspace-header-metric workspace-loading-metric" key={index}>
                  <span><MetricIcon /> <i className="workspace-loading-line is-metric-label" /></span>
                  <i className="workspace-loading-line is-metric-value" />
                  <i className="workspace-loading-line is-metric-note" />
                </div>
              ),
            )}
          </div>

          <div className="workspace-header-meta workspace-loading-meta">
            <span className="workspace-loading-line is-meta-label" />
            <span className="workspace-loading-line is-meta-value" />
            <span className="workspace-loading-line is-meta-note" />
          </div>
          <span className="workspace-loading-line is-header-status" />
        </header>

        <div className="workspace-tabs workspace-loading-tabs" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => <span className={index === 0 ? 'is-active' : ''} key={index} />)}
        </div>

        <section className="workspace-overview workspace-loading-overview" aria-hidden="true">
          <div className="workspace-overview-metrics">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="workspace-overview-metric workspace-loading-summary" key={index}>
                <div>
                  <span className="workspace-loading-line is-summary-label" />
                  <span className="workspace-loading-line is-summary-value" />
                  <span className="workspace-loading-line is-summary-note" />
                </div>
                <span className="workspace-loading-summary-icon" />
              </div>
            ))}
          </div>

          <div className="workspace-overview-main workspace-loading-main">
            <section className="console-card workspace-loading-panel">
              <div className="workspace-loading-panel-heading">
                <span className="workspace-loading-line is-panel-title" />
                <span className="workspace-loading-line is-panel-action" />
              </div>
              <div className="workspace-loading-panel-grid">
                {Array.from({ length: 6 }, (_, index) => (
                  <div key={index}>
                    <span className="workspace-loading-tile-icon" />
                    <span className="workspace-loading-line is-tile-label" />
                    <span className="workspace-loading-line is-tile-value" />
                  </div>
                ))}
              </div>
            </section>
            <section className="console-card workspace-loading-panel">
              <div className="workspace-loading-panel-heading">
                <span className="workspace-loading-line is-panel-title" />
              </div>
              <div className="workspace-loading-list">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index}>
                    <span className="workspace-loading-line is-list-label" />
                    <span className="workspace-loading-line is-list-value" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <span className="workspace-loading-announcement">正在连接网关并加载设备信息...</span>
      </main>
    );
  }

  if (!model) {
    return (
      <section className="console-card workspace-missing">
        {messageContextHolder}
        <Empty description="未找到该设备">
          <Button type="primary" onClick={() => navigate('/devices')}>
            返回设备列表
          </Button>
        </Empty>
      </section>
    );
  }

  return (
    <main className="device-workspace-page page-stack">
      {messageContextHolder}
      <DeviceWorkspaceHeader model={model} />
      <WorkspaceTabs active={activeTab} onChange={setActiveTab} />
      {activeTab === 'overview' ? (
        <DeviceOverviewPanel
          model={model}
          events={data.events}
          gatewayClient={data.client}
          gatewayConnected={data.status === 'connected'}
          onNavigate={setActiveTab}
        />
      ) : activeTab === 'desktop' ? (
        <div className="device-workspace-grid">
          <RemoteDesktopPanel
            ref={desktopPanelRef}
            model={model}
            device={model.device}
            gatewayClient={data.client}
            gatewayConnected={data.status === 'connected'}
            desktopAccess={model.desktopAccess}
            keyboardEnabled={settings.keyboard}
            mouseEnabled={settings.mouse}
            quality={settings.quality}
            scale={scale}
            onScaleChange={setScale}
            onSessionActiveChange={handleDesktopSessionActiveChange}
            onLatencyChange={handleDesktopLatencyChange}
          />
          <WorkspaceSettings
            value={settings}
            onChange={setSettings}
            controlAvailable={model.desktopAccess !== 'denied' && model.desktopAccess !== 'view-only'}
            sessionActive={desktopSessionActive}
            latency={desktopLatency}
            latencyTrend={desktopLatencyTrend}
            latencyTimedOut={desktopLatencyTimedOut}
            onEndSession={() => desktopPanelRef.current?.disconnect()}
          />
        </div>
      ) : activeTab === 'terminal' ? (
        <TerminalPanel
          device={model.device}
          gatewayClient={data.client}
          gatewayConnected={data.status === 'connected'}
          terminalAllowed={model.terminalAllowed}
        />
      ) : activeTab === 'files' ? (
        <DeviceFilesPanel
          device={model.device}
          gatewayClient={data.client}
          gatewayConnected={data.status === 'connected'}
          filesAllowed={model.filesAllowed}
        />
      ) : activeTab === 'processes' ? (
        <DeviceProcessesPanel
          device={model.device}
          gatewayClient={data.client}
          gatewayConnected={data.status === 'connected'}
        />
      ) : activeTab === 'services' ? (
        <DeviceServicesPanel
          device={model.device}
          gatewayClient={data.client}
          gatewayConnected={data.status === 'connected'}
        />
      ) : activeTab === 'logs' ? (
        <DeviceLogsPanel
          device={model.device}
          events={data.events}
          gatewayClient={data.client}
          gatewayConnected={data.status === 'connected'}
        />
      ) : (
        <section className="console-card workspace-tab-empty">
          <Empty description="该工作区将在后续版本接入">
            <Button type="primary" onClick={() => setActiveTab('overview')}>回到概览</Button>
          </Empty>
        </section>
      )}
    </main>
  );
}
