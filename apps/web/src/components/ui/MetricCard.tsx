import type { ReactNode } from 'react';

export interface MetricCardProps {
  icon: ReactNode;
  label: ReactNode;
  value: ReactNode;
  tone?: 'info' | 'success' | 'danger';
}

export function MetricCard({ icon, label, value, tone = 'info' }: MetricCardProps) {
  return (
    <article className="console-card console-metric">
      <span className={`console-metric-icon console-metric-icon-${tone}`}>{icon}</span>
      <div className="console-metric-content">
        <span className="console-metric-label">{label}</span>
        <strong className="console-metric-value">{value}</strong>
      </div>
    </article>
  );
}
