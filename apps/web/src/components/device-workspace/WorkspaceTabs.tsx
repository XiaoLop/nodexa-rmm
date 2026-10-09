import {
  BarChartOutlined,
  CodeOutlined,
  DashboardOutlined,
  DesktopOutlined,
  FileOutlined,
  MonitorOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { DeviceUiCapabilities, UiPermission } from '@meshcentral/control-client';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import type { DeviceWorkspaceModel, WorkspaceTab } from '../../features/device-workspace/types';

const tabs: Array<{
  key: WorkspaceTab;
  labelKey: string;
  icon: React.ReactNode;
  permission?: keyof Pick<DeviceUiCapabilities, 'desktop' | 'terminal' | 'files'>;
}> = [
  { key: 'overview', labelKey: 'deviceWorkspace.tabs.overview', icon: <DashboardOutlined /> },
  { key: 'desktop', labelKey: 'deviceWorkspace.tabs.desktop', icon: <DesktopOutlined />, permission: 'desktop' },
  { key: 'terminal', labelKey: 'deviceWorkspace.tabs.terminal', icon: <CodeOutlined />, permission: 'terminal' },
  { key: 'files', labelKey: 'deviceWorkspace.tabs.files', icon: <FileOutlined />, permission: 'files' },
  { key: 'processes', labelKey: 'deviceWorkspace.tabs.processes', icon: <MonitorOutlined /> },
  { key: 'services', labelKey: 'deviceWorkspace.tabs.services', icon: <SettingOutlined /> },
  { key: 'logs', labelKey: 'deviceWorkspace.tabs.logs', icon: <UnorderedListOutlined /> },
  { key: 'online-stats', labelKey: 'deviceWorkspace.tabs.onlineStats', icon: <BarChartOutlined /> },
];

export function workspaceTabPermission(
  tab: WorkspaceTab,
  capabilities: DeviceUiCapabilities,
  context: {
    model: DeviceWorkspaceModel;
    remoteControlAllowed: boolean;
    agentPresent: boolean;
    controlConnected: boolean;
  },
): UiPermission | undefined {
  if (tab === 'processes' || tab === 'services') {
    if (!context.remoteControlAllowed) return { visible: false, enabled: false };
    if (!context.agentPresent) {
      return { visible: true, enabled: false, reason: 'agent-unsupported' };
    }
    if (!context.controlConnected) {
      return { visible: true, enabled: false, reason: 'gateway-disconnected' };
    }
    if (!context.model.device.online) {
      return { visible: true, enabled: false, reason: 'device-offline' };
    }
    return { visible: true, enabled: true };
  }
  const definition = tabs.find((item) => item.key === tab);
  if (!definition?.permission) return undefined;
  const permission = capabilities[definition.permission];
  const accessAllowed = definition.permission === 'desktop'
    ? context.model.desktopAccess !== undefined && context.model.desktopAccess !== 'denied'
    : definition.permission === 'terminal'
      ? context.model.terminalAllowed === true
      : context.model.filesAllowed === true;
  if (!permission.visible && accessAllowed) {
    return { visible: true, enabled: false, reason: 'agent-unsupported' };
  }
  return permission;
}

export function WorkspaceTabs({
  active,
  onChange,
  capabilities,
  model,
  remoteControlAllowed,
  agentPresent,
  controlConnected,
}: {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  capabilities: DeviceUiCapabilities;
  model: DeviceWorkspaceModel;
  remoteControlAllowed: boolean;
  agentPresent: boolean;
  controlConnected: boolean;
}) {
  const { t } = useTranslation();
  return (
    <nav className="workspace-tabs" aria-label={t('deviceWorkspace.ariaLabel')}>
      {tabs.map((tab) => {
        const permission = workspaceTabPermission(
          tab.key,
          capabilities,
          { model, remoteControlAllowed, agentPresent, controlConnected },
        );
        if (permission && !permission.visible) return null;
        const button = (
          <button
            type="button"
            className={active === tab.key ? 'is-active' : ''}
            disabled={permission ? !permission.enabled : false}
            onClick={() => onChange(tab.key)}
          >
            {tab.icon}
            <span>{t(tab.labelKey)}</span>
          </button>
        );
        const permissionMessage = permission?.message ?? (permission?.reason
          ? t(`deviceWorkspace.tabs.reasons.${permission.reason}`)
          : undefined);
        return permissionMessage ? (
          <Tooltip key={tab.key} title={permissionMessage}>
            <span>{button}</span>
          </Tooltip>
        ) : (
          <span key={tab.key}>{button}</span>
        );
      })}
    </nav>
  );
}
