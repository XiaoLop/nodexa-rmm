import type { HTMLAttributes, ReactNode } from 'react';

export type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusBadgeTone;
  children: ReactNode;
}

export function StatusBadge({ tone = 'neutral', className, children, ...props }: StatusBadgeProps) {
  const classes = ['status-badge', `status-badge-${tone}`, className].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      <i aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}