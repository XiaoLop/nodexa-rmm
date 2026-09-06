import { Button, Empty, message } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DeviceInfoPanel } from '../components/device-workspace/DeviceInfoPanel';
import { DeviceOverviewPanel } from '../components/device-workspace/DeviceOverviewPanel';
import { DeviceWorkspaceHeader } from '../components/device-workspace/DeviceWorkspaceHeader';
import { RemoteDesktopPanel } from '../components/device-workspace/RemoteDesktopPanel';
import { WorkspaceSettings, type WorkspaceSettingsValue } from '../components/device-workspace/WorkspaceSettings';
import { WorkspaceTabs } from '../components/device-workspace/WorkspaceTabs';
import { createDeviceWorkspaceModel } from '../features/device-workspace/deviceWorkspaceModel';
import type { WorkspaceTab } from '../features/device-workspace/types';
import { useGatewayData } from '../features/gateway/useGatewayData';

export function DeviceWorkspacePage() {
  const data = useGatewayData();
  const navigate = useNavigate();
  const { deviceId } = useParams();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [scale, setScale] = useState('fit');
  const [settings, setSettings] = useState<WorkspaceSettingsValue>({
    keyboard: true,
    mouse: true,
    screenInput: false,
    resolution: '1280 × 720',
    colorDepth: '32 位',
    quality: 58,
  });
  const device = data.devices.find((item) => item.id === deviceId);
  const model = useMemo(() => (device ? createDeviceWorkspaceModel(device) : undefined), [device]);

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
          <DeviceInfoPanel model={model} />
          <RemoteDesktopPanel
            model={model}
            scale={scale}
            onScaleChange={setScale}
            onAction={(action) => void messageApi.info(`${action}为静态演示，未向设备发送指令。`)}
          />
          <WorkspaceSettings
            value={settings}
            onChange={setSettings}
            onEndSession={() => void messageApi.info('静态演示会话已重置。')}
          />
        </div>
      ) : (
        <section className="console-card workspace-tab-empty">
          <Empty description="该工作区将在后续版本接入">
            <Button type="primary" onClick={() => setActiveTab('desktop')}>返回远程桌面</Button>
          </Empty>
        </section>
      )}
    </main>
  );
}
