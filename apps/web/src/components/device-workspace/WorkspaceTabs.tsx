import {
  CodeOutlined,
  DashboardOutlined,
  DesktopOutlined,
  FileOutlined,
  MonitorOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import type { WorkspaceTab } from '../../features/device-workspace/types';

const tabs: Array<{ key: WorkspaceTab; label: string; icon: React.ReactNode }> = [
  { key: 'overview', label: '概览', icon: <DashboardOutlined /> },
  { key: 'desktop', label: '远程桌面', icon: <DesktopOutlined /> },
  { key: 'terminal', label: '终端', icon: <CodeOutlined /> },
  { key: 'files', label: '文件管理', icon: <FileOutlined /> },
  { key: 'processes', label: '进程', icon: <MonitorOutlined /> },
  { key: 'services', label: '服务', icon: <SettingOutlined /> },
  { key: 'logs', label: '日志', icon: <UnorderedListOutlined /> },
];

export function WorkspaceTabs({ active, onChange }: { active: WorkspaceTab; onChange: (tab: WorkspaceTab) => void }) {
  return (
    <nav className="workspace-tabs" aria-label="设备工作台功能">
      {tabs.map((tab) => (
        <button
          type="button"
          key={tab.key}
          className={active === tab.key ? 'is-active' : ''}
          onClick={() => onChange(tab.key)}
        >
          {tab.icon}<span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
