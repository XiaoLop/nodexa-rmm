import {
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
import type { WorkspaceTab } from '../../features/device-workspace/types';

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
];

export function workspaceTabPermission(
  tab: WorkspaceTab,
  capabilities: DeviceUiCapabilities,
  remoteControlAllowed: boolean,
  agentPresent: boolean,
): UiPermission | undefined {
  if (tab === 'processes' || tab === 'services') {
    const available = remoteControlAllowed && agentPresent;
    return { visible: available, enabled: available };
  }
  const definition = tabs.find((item) => item.key === tab);
  return definition?.permission ? capabilities[definition.permission] : undefined;
}

export function WorkspaceTabs({
  active,
  onChange,
  capabilities,
  remoteControlAllowed,
  agentPresent,
}: {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  capabilities: DeviceUiCapabilities;
  remoteControlAllowed: boolean;
  agentPresent: boolean;
}) {
  const { t } = useTranslation();
  return (
    <nav className="workspace-tabs" aria-label={t('deviceWorkspace.ariaLabel')}>
      {tabs.map((tab) => {
        const permission = workspaceTabPermission(
          tab.key,
          capabilities,
          remoteControlAllowed,
          agentPresent,
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
        return permission?.message ? (
          <Tooltip key={tab.key} title={permission.message}>
            <span>{button}</span>
          </Tooltip>
        ) : (
          <span key={tab.key}>{button}</span>
        );
      })}
    </nav>
  );
}
