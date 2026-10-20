import {
  AppstoreOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import {
  MeshRight,
  hasMeshRight,
  resolveEffectiveDeviceRights,
  type Device,
  type MeshCentralEvent,
} from '@meshcentral/control-client';
import { Alert, Button, Empty, message } from 'antd';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DeviceOverviewPanel } from '../components/device-workspace/DeviceOverviewPanel';
import { DeviceLogsPanel } from '../components/device-workspace/DeviceLogsPanel';
import { DevicePowerTimelineCard } from '../components/device-workspace/DevicePowerTimelineCard';
import { DeviceWorkspaceHeader } from '../components/device-workspace/DeviceWorkspaceHeader';
import {
  DeviceProcessesPanel,
  DeviceServicesPanel,
} from '../components/device-workspace/SystemManagementPanels';
import type { WorkspaceSettingsValue } from '../components/device-workspace/WorkspaceSettings';
import {
  WorkspaceTabs,
  workspaceTabPermission,
} from '../components/device-workspace/WorkspaceTabs';
import type { RemoteDesktopPanelHandle } from '../components/device-workspace/RemoteDesktopPanel';
import {
  deviceOnlineFromMessage,
  normalizeDeviceRouteId,
} from '../features/device-workspace/deviceConnectionState';
import { createDeviceWorkspaceModel } from '../features/device-workspace/deviceWorkspaceModel.ts';
import type { WorkspaceTab } from '../features/device-workspace/types';
import { useMeshCentralControlData } from '../features/gateway';
import { getDeviceCapabilities } from '../features/permissions/useUiCapabilities';
import '../assets/styles/user-details.css';
import '../assets/styles/device-workspace.css';

const DeviceFilesPanel = lazy(() =>
  import('../components/device-workspace/files/DeviceFilesPanel').then((module) => ({
    default: module.DeviceFilesPanel,
  })),
);
const RemoteDesktopPanel = lazy(() =>
  import('../components/device-workspace/RemoteDesktopPanel').then((module) => ({
    default: module.RemoteDesktopPanel,
  })),
);
const TerminalPanel = lazy(() =>
  import('../components/device-workspace/terminal/TerminalPanel').then((module) => ({
    default: module.TerminalPanel,
  })),
);

const WORKSPACE_TABS: WorkspaceTab[] = [
  'overview',
  'desktop',
  'terminal',
  'files',
  'processes',
  'services',
  'logs',
  'online-stats',
  'monitoring',
  'security',
];

function workspaceTab(value: string | null): WorkspaceTab {
  return WORKSPACE_TABS.includes(value as WorkspaceTab) ? (value as WorkspaceTab) : 'overview';
}

export function DeviceWorkspacePage() {
  const { t } = useTranslation();
  const data = useMeshCentralControlData();
  const navigate = useNavigate();
  const { deviceId: routeDeviceId } = useParams();
  const deviceId = normalizeDeviceRouteId(routeDeviceId);
  const [searchParams, setSearchParams] = useSearchParams();
  const [, messageContextHolder] = message.useMessage();
  const desktopPanelRef = useRef<RemoteDesktopPanelHandle>(null);
  const activeTab = workspaceTab(searchParams.get('tab'));
  const [scale, setScale] = useState('fit');
  const [deviceDetails, setDeviceDetails] =
    useState<Awaited<ReturnType<NonNullable<typeof data.client>['devices']['details']>>>();
  const [fetchedDevice, setFetchedDevice] = useState<Device>();
  const [liveConnection, setLiveConnection] = useState<{
    deviceId: string;
    online: boolean;
  }>();
  const [historyEvents, setHistoryEvents] = useState<MeshCentralEvent[]>([]);
  const [loadedDeviceId, setLoadedDeviceId] = useState<string>();
  const [failedDeviceId, setFailedDeviceId] = useState<string>();
  const [loadError, setLoadError] = useState<string>();
  const requestSequence = useRef(0);
  const [settings, setSettings] = useState<WorkspaceSettingsValue>({
    keyboard: true,
    mouse: true,
    screenInput: false,
    resolution: '1280 × 720',
    colorDepth: 32,
    quality: 58,
  });

  const loadDetails = useCallback(async () => {
    if (!data.client || data.status !== 'connected' || !deviceId) return;
    const sequence = ++requestSequence.current;
    setLoadError(undefined);
    setFailedDeviceId(undefined);
    try {
      const [details, deviceEvents] = await Promise.all([
        data.client.devices.details(deviceId),
        data.client.events.listByDevice(deviceId, { limit: 20 }),
      ]);
      if (sequence !== requestSequence.current) return;
      setDeviceDetails(details);
      setHistoryEvents(deviceEvents);
      setLoadedDeviceId(deviceId);
      if (details.device) {
        setFetchedDevice(details.device);
      }
    } catch (error) {
      if (sequence === requestSequence.current) {
        setFailedDeviceId(deviceId);
        setLoadError(
          error instanceof Error ? error.message : t('common.status.unknown'),
        );
      }
    }
  }, [data.client, data.status, deviceId, t]);

  useEffect(() => {
    if (data.status === 'connected') void loadDetails();
    return () => {
      requestSequence.current += 1;
    };
  }, [data.status, loadDetails]);

  useEffect(() => {
    setLiveConnection(undefined);
    if (!data.client || !deviceId) return undefined;
    return data.client.on('message', (message) => {
      const online = deviceOnlineFromMessage(message, deviceId);
      if (online !== undefined) setLiveConnection({ deviceId, online });
    });
  }, [data.client, deviceId]);

  const storeDevice = data.devices.find((item) => item.id === deviceId);
  const device = useMemo(() => {
    const liveOnline =
      liveConnection && liveConnection.deviceId === deviceId ? liveConnection.online : undefined;
    if (storeDevice && fetchedDevice) {
      return { ...fetchedDevice, ...storeDevice, online: liveOnline ?? storeDevice.online };
    }
    const snapshot = storeDevice ?? fetchedDevice;
    return snapshot && liveOnline !== undefined ? { ...snapshot, online: liveOnline } : snapshot;
  }, [deviceId, fetchedDevice, liveConnection, storeDevice]);

  const detailsReady = loadedDeviceId === deviceId && Boolean(deviceDetails);
  const currentLoadError = failedDeviceId === deviceId ? loadError : undefined;
  const isInitialLoading = !detailsReady && !currentLoadError;
  const model = useMemo(() => {
    if (!device) return undefined;
    const groupName = data.groups.find((group) => group.id === device.groupId)?.name;
    return createDeviceWorkspaceModel(device, deviceDetails, groupName);
  }, [data.groups, device, deviceDetails]);
  const deviceGroup = data.groups.find((group) => group.id === device?.groupId);
  const capabilities = useMemo(
    () =>
      device
        ? getDeviceCapabilities(device, data.status === 'connected', {
            group: deviceGroup,
            userInfo: data.userInfo,
            serverInfo: data.serverInfo,
          })
        : undefined,
    [data.serverInfo, data.status, data.userInfo, device, deviceGroup],
  );
  const remoteControlAllowed = device
    ? hasMeshRight(
        resolveEffectiveDeviceRights(device, deviceGroup, data.userInfo) ?? 0,
        MeshRight.RemoteControl,
      )
    : false;
  const setActiveTab = (tab: WorkspaceTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'overview') next.delete('tab');
    else next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };
  useEffect(() => {
    if (!capabilities || !model) return;
    const permission = workspaceTabPermission(
      activeTab,
      capabilities,
      {
        model,
        remoteControlAllowed,
        agentPresent: device?.agentCapabilities !== undefined || device?.agentId !== undefined,
        controlConnected: data.status === 'connected',
      },
    );
    if (permission && !permission.visible) setActiveTab('overview');
  }, [activeTab, capabilities, data.status, device?.agentCapabilities, device?.agentId, model, remoteControlAllowed]);

  if (isInitialLoading) {
    return (
      <main
        className="device-workspace-page page-stack workspace-loading"
        aria-busy="true"
        aria-label={t('deviceWorkspace.loading')}
      >
        {messageContextHolder}
        <nav className="user-detail-breadcrumb user-group-loading-breadcrumb" aria-hidden="true">
          <span className="user-group-loading-line is-breadcrumb" />
          <span>›</span>
          <span className="user-group-loading-line is-breadcrumb-current" />
        </nav>
        <header
          className="workspace-device-header console-card workspace-loading-header"
          aria-hidden="true"
        >
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
                  <span>
                    <MetricIcon /> <i className="workspace-loading-line is-metric-label" />
                  </span>
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
          {Array.from({ length: 9 }, (_, index) => (
            <span className={index === 0 ? 'is-active' : ''} key={index} />
          ))}
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

        <span className="workspace-loading-announcement">{t('deviceWorkspace.loadingAnnouncement')}</span>
      </main>
    );
  }

  if (currentLoadError && !detailsReady) {
    return (
      <main className="device-workspace-page page-stack">
        {messageContextHolder}
        <nav className="user-detail-breadcrumb" aria-label={t('navigation.deviceWorkspace')}>
          <button onClick={() => navigate('/devices')}>{t('navigation.allDevices')}</button>
          <span>›</span>
          <strong>{t('deviceWorkspace.loadFailed')}</strong>
        </nav>
        <Alert
          type="error"
          showIcon
          title={t('deviceWorkspace.loadFailed')}
          description={currentLoadError}
          action={
            <Button onClick={() => void loadDetails()} disabled={data.status !== 'connected'}>
              {t('common.actions.retry')}
            </Button>
          }
        />
      </main>
    );
  }

  if (!device || !model || !capabilities) {
    return (
      <main className="device-workspace-page page-stack">
        {messageContextHolder}
        <nav className="user-detail-breadcrumb" aria-label={t('navigation.deviceWorkspace')}>
          <button onClick={() => navigate('/devices')}>{t('navigation.allDevices')}</button>
          <span>›</span>
          <strong>{t('deviceWorkspace.notFound')}</strong>
        </nav>
        <section className="console-card workspace-missing">
          <Empty description={t('deviceWorkspace.notFound')}>
            <Button type="primary" onClick={() => navigate('/devices')}>
              {t('deviceWorkspace.backToList')}
            </Button>
          </Empty>
        </section>
      </main>
    );
  }

  return (
    <main className="device-workspace-page page-stack">
      {messageContextHolder}
      <nav className="user-detail-breadcrumb" aria-label={t('navigation.deviceWorkspace')}>
        <button onClick={() => navigate('/devices')}>{t('navigation.allDevices')}</button>
        <span>›</span>
        <strong>{device.name}</strong>
      </nav>
      {currentLoadError ? (
        <Alert
          showIcon
          type="warning"
          title={t('deviceWorkspace.partialRefreshFailed')}
          description={currentLoadError}
        />
      ) : null}
      <DeviceWorkspaceHeader model={model} />
      <WorkspaceTabs
        active={activeTab}
        onChange={setActiveTab}
        capabilities={capabilities}
        model={model}
        remoteControlAllowed={remoteControlAllowed}
        agentPresent={device.agentCapabilities !== undefined || device.agentId !== undefined}
        controlConnected={data.status === 'connected'}
      />
      <Suspense fallback={<WorkspacePanelLoading />}>
        {activeTab === 'overview' ? (
          <DeviceOverviewPanel
            model={model}
            historyEvents={historyEvents}
            controlConnected={data.status === 'connected'}
            onNavigate={setActiveTab}
          />
        ) : activeTab === 'desktop' ? (
          <div className="device-workspace-desktop-container">
            <RemoteDesktopPanel
              ref={desktopPanelRef}
              model={model}
              device={model.device}
              meshCentralClient={data.client}
              controlConnected={data.status === 'connected'}
              desktopAccess={model.desktopAccess}
              settings={settings}
              onSettingsChange={setSettings}
              scale={scale}
              onScaleChange={setScale}
            />
          </div>
        ) : activeTab === 'terminal' ? (
          <TerminalPanel
            device={model.device}
            meshCentralClient={data.client}
            controlConnected={data.status === 'connected'}
            terminalAllowed={model.terminalAllowed}
          />
        ) : activeTab === 'files' ? (
          <DeviceFilesPanel
            device={model.device}
            meshCentralClient={data.client}
            controlConnected={data.status === 'connected'}
            filesAllowed={model.filesAllowed}
          />
        ) : activeTab === 'processes' ? (
          <DeviceProcessesPanel
            device={model.device}
            meshCentralClient={data.client}
            controlConnected={data.status === 'connected'}
            deviceOnline={model.device.online}
          />
        ) : activeTab === 'services' ? (
          <DeviceServicesPanel
            device={model.device}
            meshCentralClient={data.client}
            controlConnected={data.status === 'connected'}
            deviceOnline={model.device.online}
          />
        ) : activeTab === 'logs' ? (
          <DeviceLogsPanel
            device={model.device}
            meshCentralClient={data.client}
            controlConnected={data.status === 'connected'}
          />
        ) : activeTab === 'online-stats' ? (
          <DevicePowerTimelineCard
            deviceId={model.device.id}
            client={data.client}
            controlConnected={data.status === 'connected'}
          />
        ) : (
          <section className="console-card workspace-tab-empty">
            <Empty description="该工作区将在后续版本接入">
              <Button type="primary" onClick={() => setActiveTab('overview')}>
                回到概览
              </Button>
            </Empty>
          </section>
        )}
      </Suspense>
    </main>
  );
}

function WorkspacePanelLoading() {
  return (
    <section className="console-card workspace-tab-empty" aria-busy="true">
      <span className="boot-spinner" />
      <span>正在加载工作区...</span>
    </section>
  );
}
