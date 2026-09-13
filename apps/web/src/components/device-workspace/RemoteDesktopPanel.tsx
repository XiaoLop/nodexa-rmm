import {
  CameraOutlined,
  CompressOutlined,
  DesktopOutlined,
  FileSyncOutlined,
  FullscreenOutlined,
  LockOutlined,
  PoweroffOutlined,
  RedoOutlined,
  ScissorOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { Button, Select, Tooltip } from 'antd';
import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';

const actions = [
  ['全屏', <FullscreenOutlined />],
  ['发送 Ctrl+Alt+Del', <CompressOutlined />],
  ['锁屏', <LockOutlined />],
  ['重启', <RedoOutlined />],
  ['关机', <PoweroffOutlined />],
  ['截图', <CameraOutlined />],
  ['剪贴板', <ScissorOutlined />],
  ['文件传输', <FileSyncOutlined />],
  ['录制', <VideoCameraOutlined />],
] as const;

export function RemoteDesktopPanel({ model, scale, onScaleChange, onAction }: {
  model: DeviceWorkspaceModel;
  scale: string;
  onScaleChange: (value: string) => void;
  onAction: (action: string) => void;
}) {
  return (
    <div className="workspace-center-column">
      <section className="console-card remote-desktop-card">
        <div className="remote-toolbar">
          <Button type="primary" size="small" icon={<FullscreenOutlined />} onClick={() => onAction('全屏')}>全屏</Button>
          {actions.slice(1).map(([label, icon]) => <Tooltip title={label} key={label}><Button type="text" size="small" icon={icon} onClick={() => onAction(label)}>{label}</Button></Tooltip>)}
        </div>
        <div className="remote-status-row">
          <span><i /> 远程桌面连接中 · 1280 × 720 · 30 FPS · 画质：中等</span>
          <Select size="small" value={scale} onChange={onScaleChange} options={[{ value: 'fit', label: '适应窗口' }, { value: '100', label: '100%' }, { value: '75', label: '75%' }]} />
        </div>
        <div className="remote-screen-shell">
          <div className="remote-screen" data-scale={scale}>
            <div className="desktop-shortcut"><DesktopOutlined /><span>此电脑</span></div>
            <div className="desktop-shortcut desktop-shortcut-second"><FileSyncOutlined /><span>文件</span></div>
            <div className="desktop-wallpaper" aria-label={`${model.hostname} 的静态桌面演示预览`}>
              <i className="wallpaper-fold fold-one" /><i className="wallpaper-fold fold-two" /><i className="wallpaper-fold fold-three" />
              <span>静态演示预览</span>
            </div>
            <div className="desktop-taskbar"><b>▦</b><span>搜索</span><i /><i /><i /><small>14:32<br />2026/9/6</small></div>
          </div>
        </div>
      </section>
    </div>
  );
}
