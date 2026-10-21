import { Button, Modal, Select, Slider, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ConnectionSparkline } from './ConnectionSparkline';

export interface WorkspaceSettingsValue {
  keyboard: boolean;
  mouse: boolean;
  screenInput: boolean;
  resolution: string;
  colorDepth: number;
  quality: number;
  imageFormat: 'jpeg' | 'png' | 'webp';
  frameTimer: number;
}

export function WorkspaceSettings({
  value,
  onChange,
  onEndSession,
  controlAvailable,
  sessionActive,
  latency,
  latencyTrend,
  latencyTimedOut,
}: {
  value: WorkspaceSettingsValue;
  onChange: (value: WorkspaceSettingsValue) => void;
  onEndSession: () => void;
  controlAvailable: boolean;
  sessionActive: boolean;
  latency?: number;
  latencyTrend: number[];
  latencyTimedOut: boolean;
}) {
  const { t } = useTranslation();
  const set = <Key extends keyof WorkspaceSettingsValue>(key: Key, next: WorkspaceSettingsValue[Key]) => onChange({ ...value, [key]: next });
  return (
    <aside className="workspace-right-column">
      <section className="console-card workspace-panel">
        <div className="card-header"><h2>{t('deviceWorkspace.settings.remoteControl')}</h2></div>
        <div className="workspace-setting-list">
          <label><span>{t('deviceWorkspace.settings.keyboard')}</span><Switch size="small" checked={value.keyboard} disabled={!controlAvailable} onChange={(checked) => set('keyboard', checked)} /></label>
          <label><span>{t('deviceWorkspace.settings.mouse')}</span><Switch size="small" checked={value.mouse} disabled={!controlAvailable} onChange={(checked) => set('mouse', checked)} /></label>
          <label><span>{t('deviceWorkspace.settings.screenInput')}</span><Switch size="small" checked={false} disabled /></label>
        </div>
      </section>
      <section className="console-card workspace-panel">
        <div className="card-header"><h2>{t('deviceWorkspace.settings.display')}</h2></div>
        <div className="workspace-display-settings">
          <label><span>{t('deviceWorkspace.settings.resolution')}</span><Select size="small" value={value.resolution} onChange={(next) => set('resolution', next)} options={[{ value: '1280 × 720', label: '1280 × 720' }, { value: '1920 × 1080', label: '1920 × 1080' }]} /></label>
          <label><span>{t('deviceWorkspace.settings.colorDepth')}</span><Select size="small" value={value.colorDepth} onChange={(next) => set('colorDepth', next)} options={[{ value: 32, label: t('deviceWorkspace.settings.bits', { value: 32 }) }, { value: 16, label: t('deviceWorkspace.settings.bits', { value: 16 }) }]} /></label>
          <label className="workspace-quality-slider"><span>{t('deviceWorkspace.settings.quality')}</span><Slider min={10} max={100} value={value.quality} onChange={(next) => set('quality', next)} /><small>{value.quality < 40 ? t('deviceWorkspace.settings.smooth') : value.quality > 75 ? t('deviceWorkspace.settings.high') : t('deviceWorkspace.settings.medium')}</small></label>
        </div>
      </section>
      <section className="console-card workspace-panel workspace-latency-panel">
        <div className="card-header"><h2>{t('deviceWorkspace.settings.latency')}</h2></div>
        <div className="workspace-latency-summary">
          <strong>{latency === undefined ? '—' : latency}<small> ms</small></strong>
          <span className={latencyTimedOut ? 'is-timeout' : ''}>
            {latencyTimedOut ? t('deviceWorkspace.settings.timeout') : sessionActive ? latency === undefined ? t('deviceWorkspace.settings.waiting') : t('deviceWorkspace.settings.rtt') : t('common.status.disconnected')}
          </span>
        </div>
        <ConnectionSparkline values={latencyTrend} />
      </section>
      <section className="console-card workspace-panel workspace-end-session">
        <div className="card-header"><h2>{t('deviceWorkspace.settings.sessionActions')}</h2></div>
        <Button danger disabled={!sessionActive} onClick={() => Modal.confirm({ title: t('deviceWorkspace.settings.endSessionTitle'), content: t('deviceWorkspace.settings.endSessionContent'), okText: t('deviceWorkspace.settings.confirmEnd'), cancelText: t('common.actions.cancel'), okButtonProps: { danger: true }, onOk: onEndSession })}>{t('deviceWorkspace.settings.endSession')}</Button>
      </section>
    </aside>
  );
}
