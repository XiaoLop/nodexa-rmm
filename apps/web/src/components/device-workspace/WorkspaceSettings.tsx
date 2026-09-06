import { LockOutlined } from '@ant-design/icons';
import { Button, Modal, Select, Slider, Switch } from 'antd';

export interface WorkspaceSettingsValue {
  keyboard: boolean;
  mouse: boolean;
  screenInput: boolean;
  resolution: string;
  colorDepth: string;
  quality: number;
}

export function WorkspaceSettings({ value, onChange, onEndSession }: {
  value: WorkspaceSettingsValue;
  onChange: (value: WorkspaceSettingsValue) => void;
  onEndSession: () => void;
}) {
  const set = <Key extends keyof WorkspaceSettingsValue>(key: Key, next: WorkspaceSettingsValue[Key]) => onChange({ ...value, [key]: next });
  return (
    <aside className="workspace-right-column">
      <section className="console-card workspace-panel">
        <div className="card-header"><h2>远程控制</h2></div>
        <div className="workspace-setting-list">
          <label><span>启用键盘输入</span><Switch size="small" checked={value.keyboard} onChange={(checked) => set('keyboard', checked)} /></label>
          <label><span>启用鼠标控制</span><Switch size="small" checked={value.mouse} onChange={(checked) => set('mouse', checked)} /></label>
          <label><span>屏幕用户输入</span><Switch size="small" checked={value.screenInput} onChange={(checked) => set('screenInput', checked)} /></label>
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
      <section className="console-card workspace-panel">
        <div className="card-header"><h2>安全信息</h2></div>
        <div className="workspace-security-list">
          <div><span><LockOutlined /> 会话加密</span><b>已加密</b></div>
          <div><span>连接管理员</span><strong>admin</strong></div>
          <div><span>会话超时</span><strong>1 小时</strong></div>
        </div>
      </section>
      <section className="console-card workspace-panel workspace-end-session">
        <div className="card-header"><h2>会话操作</h2></div>
        <Button danger onClick={() => Modal.confirm({ title: '结束当前会话？', content: '这是静态演示，不会向设备发送指令。', okText: '确认结束', cancelText: '取消', okButtonProps: { danger: true }, onOk: onEndSession })}>结束会话</Button>
      </section>
    </aside>
  );
}
