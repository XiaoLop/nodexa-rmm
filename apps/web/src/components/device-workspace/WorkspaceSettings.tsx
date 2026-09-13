import { Button, Modal, Select, Slider, Switch } from 'antd';
import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';
import { ConnectionSparkline } from './ConnectionSparkline';

export interface WorkspaceSettingsValue {
  keyboard: boolean;
  mouse: boolean;
  screenInput: boolean;
  resolution: string;
  colorDepth: string;
  quality: number;
}

export function WorkspaceSettings({ model, value, onChange, onEndSession, controlAvailable, sessionActive }: {
  model: DeviceWorkspaceModel;
  value: WorkspaceSettingsValue;
  onChange: (value: WorkspaceSettingsValue) => void;
  onEndSession: () => void;
  controlAvailable: boolean;
  sessionActive: boolean;
}) {
  const set = <Key extends keyof WorkspaceSettingsValue>(key: Key, next: WorkspaceSettingsValue[Key]) => onChange({ ...value, [key]: next });
  return (
    <aside className="workspace-right-column">
      <section className="console-card workspace-panel">
        <div className="card-header"><h2>远程控制</h2></div>
        <div className="workspace-setting-list">
          <label><span>启用键盘输入</span><Switch size="small" checked={value.keyboard} disabled={!controlAvailable} onChange={(checked) => set('keyboard', checked)} /></label>
          <label><span>启用鼠标控制</span><Switch size="small" checked={value.mouse} disabled={!controlAvailable} onChange={(checked) => set('mouse', checked)} /></label>
          <label><span>屏幕用户输入</span><Switch size="small" checked={false} disabled /></label>
        </div>
      </section>
      <section className="console-card workspace-panel">
        <div className="card-header"><h2>显示设置</h2></div>
        <div className="workspace-display-settings">
          <label><span>分辨率</span><Select size="small" value={value.resolution} onChange={(next) => set('resolution', next)} options={[{ value: '1280 × 720', label: '1280 × 720' }, { value: '1920 × 1080', label: '1920 × 1080' }]} /></label>
          <label><span>色深</span><Select size="small" value={value.colorDepth} onChange={(next) => set('colorDepth', next)} options={[{ value: '32 位', label: '32 位' }, { value: '16 位', label: '16 位' }]} /></label>
          <label className="workspace-quality-slider"><span>画质</span><Slider min={10} max={100} value={value.quality} onChange={(next) => set('quality', next)} /><small>{value.quality < 40 ? '流畅' : value.quality > 75 ? '高清' : '中等'}</small></label>
        </div>
      </section>
      <section className="console-card workspace-panel workspace-quality-panel">
        <div className="card-header"><h2>连接质量</h2><span>延迟：{model.latency} ms</span></div>
        <div className="workspace-quality-state"><i />{model.latency < 60 ? '良好' : '存在波动'}</div>
        <ConnectionSparkline values={model.latencyTrend} />
      </section>
      <section className="console-card workspace-panel workspace-end-session">
        <div className="card-header"><h2>会话操作</h2></div>
        <Button danger disabled={!sessionActive} onClick={() => Modal.confirm({ title: '结束当前会话？', content: '远程桌面连接将立即关闭。', okText: '确认结束', cancelText: '取消', okButtonProps: { danger: true }, onOk: onEndSession })}>结束会话</Button>
      </section>
    </aside>
  );
}
