import { Button, Empty, message } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DeviceOverviewPanel } from '../components/device-workspace/DeviceOverviewPanel';
import { DeviceWorkspaceHeader } from '../components/device-workspace/DeviceWorkspaceHeader';
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
