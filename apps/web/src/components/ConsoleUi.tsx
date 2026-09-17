import {
  ApartmentOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  ExclamationCircleOutlined,
  FolderOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';

export type MetricTone = 'blue' | 'green' | 'purple' | 'amber' | 'red';

export function MetricCard({
  label,
  value,
  hint,
  tone,
  icon,
  chart,
}: {
  label: string;
  value: number;
  hint: ReactNode;
  tone: MetricTone;
  icon: ReactNode;
  chart?: number[];
}) {
  return (
    <section className={`metric-card tone-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
      {chart && <Sparkline values={chart} />}
    </section>
  );
}

export function Sparkline({ values, tone = 'green' }: { values: number[]; tone?: MetricTone }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 34 - ((value - min) / span) * 28;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg className={`sparkline tone-${tone}`} viewBox="0 0 100 38" role="img" aria-label="趋势">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function TrendChart({ online, offline }: { online: number[]; offline: number[] }) {
  const all = [...online, ...offline, 1];
  const max = Math.max(...all);
  const makePoints = (values: number[]) =>
    values
      .map((value, index) => {
        const x = 4 + (index / Math.max(values.length - 1, 1)) * 92;
        const y = 86 - (value / max) * 70;
        return `${x},${y}`;
      })
      .join(' ');

  return (
    <div className="trend-chart">
      <div className="chart-legend">
        <span className="online">在线</span>
        <span className="offline">离线</span>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="设备状态趋势">
        {[20, 40, 60, 80].map((y) => (
          <line key={y} x1="4" y1={y} x2="96" y2={y} className="grid-line" />
        ))}
        <polyline points={makePoints(online)} className="trend-online" />
        <polyline points={makePoints(offline)} className="trend-offline" />
      </svg>
      <div className="chart-axis">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>现在</span>
      </div>
    </div>
  );
}

export function DonutChart({
  data,
  total,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const denominator = Math.max(
    data.reduce((sum, item) => sum + item.value, 0),
    1,
  );
  let cursor = 0;
  const gradient = data
    .map((item) => {
      const start = cursor;
      cursor += (item.value / denominator) * 100;
      return `${item.color} ${start}% ${cursor}%`;
    })
    .join(', ');

  return (
    <div className="donut-layout">
      <div
        className="donut"
        style={{ background: `conic-gradient(${gradient || '#253348 0 100%'})` }}
      >
        <div>
          <strong>{total}</strong>
          <span>总设备</span>
        </div>
      </div>
      <div className="donut-legend">
        {data.map((item) => (
          <div key={item.label}>
            <i style={{ background: item.color }} />
            <span>{item.label}</span>
            <b>{Math.round((item.value / denominator) * 100)}%</b>
            <em>({item.value})</em>
          </div>
        ))}
      </div>
    </div>
  );
}

export function iconForMetric(kind: 'total' | 'online' | 'groups' | 'offline' | 'events') {
  const icons = {
    total: <CloudServerOutlined />,
    online: <DesktopOutlined />,
    groups: <FolderOutlined />,
    offline: <ExclamationCircleOutlined />,
    events: <SafetyCertificateOutlined />,
  };
  return icons[kind];
}

export function deviceIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('server') || value.includes('linux')) return <CloudServerOutlined />;
  if (value.includes('mobile') || value.includes('android') || value.includes('ios')) {
    return <ApartmentOutlined />;
  }
  return <DesktopOutlined />;
}

export function connectionIcon(connected: boolean) {
  return connected ? <CheckCircleOutlined /> : <DisconnectOutlined />;
}
