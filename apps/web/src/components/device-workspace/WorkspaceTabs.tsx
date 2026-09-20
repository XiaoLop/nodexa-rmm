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
import type { WorkspaceTab } from '../../features/device-workspace/types';

const tabs: Array<{
  key: WorkspaceTab;
  label: string;
  icon: React.ReactNode;
  permission?: keyof Pick<DeviceUiCapabilities, 'desktop' | 'terminal' | 'files'>;
}> = [
  { key: 'overview', label: '概览', icon: <DashboardOutlined /> },
  { key: 'desktop', label: '远程桌面', icon: <DesktopOutlined />, permission: 'desktop' },
  { key: 'terminal', label: '终端', icon: <CodeOutlined />, permission: 'terminal' },
  { key: 'files', label: '文件管理', icon: <FileOutlined />, permission: 'files' },
  { key: 'processes', label: '进程', icon: <MonitorOutlined /> },
  { key: 'services', label: '服务', icon: <SettingOutlined /> },
  { key: 'logs', label: '日志', icon: <UnorderedListOutlined /> },
];

export function workspaceTabPermission(
  tab: WorkspaceTab,
  capabilities: DeviceUiCapabilities,
  remoteControlAllowed: boolean,
): UiPermission | undefined {
  if (tab === 'processes' || tab === 'services') {
    return { visible: remoteControlAllowed, enabled: remoteControlAllowed };
  }
  const definition = tabs.find((item) => item.key === tab);
  return definition?.permission ? capabilities[definition.permission] : undefined;
}

export function WorkspaceTabs({
  active,
  onChange,
  capabilities,
  remoteControlAllowed,
}: {
  active: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
  capabilities: DeviceUiCapabilities;
  remoteControlAllowed: boolean;
}) {
  return (
    <nav className="workspace-tabs" aria-label="设备工作台功能">
      {tabs.map((tab) => {
        const permission = workspaceTabPermission(tab.key, capabilities, remoteControlAllowed);
        if (permission && !permission.visible) return null;
        const button = (
          <button
            type="button"
            className={active === tab.key ? 'is-active' : ''}
            disabled={permission ? !permission.enabled : false}
            onClick={() => onChange(tab.key)}
          >
            {tab.icon}
            <span>{tab.label}</span>
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
