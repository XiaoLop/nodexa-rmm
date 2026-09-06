import type { DeviceWorkspaceModel } from '../../features/device-workspace/types';
import { ConnectionSparkline } from './ConnectionSparkline';

export function SessionPanels({ model }: { model: DeviceWorkspaceModel }) {
  return (
    <div className="workspace-session-grid">
      <section className="console-card workspace-panel">
        <div className="card-header"><h2>实时会话日志 <i className="workspace-live-dot" /></h2></div>
        <div className="workspace-event-list">
          {model.events.map((event) => <div key={event.id}><time>{event.time}</time><span>{event.message}</span></div>)}
        </div>
      </section>
      <section className="console-card workspace-panel workspace-quality-panel">
        <div className="card-header"><h2>连接质量 <i className="workspace-live-dot" /></h2><span>延迟：{model.latency} ms</span></div>
        <div className="workspace-quality-state"><i />良好</div>
        <ConnectionSparkline values={model.latencyTrend} />
      </section>
    </div>
  );
}
