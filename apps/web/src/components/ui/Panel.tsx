import type { HTMLAttributes, ReactNode } from 'react';

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  tools?: ReactNode;
}

export function Panel({
  title,
  description,
  tools,
  className,
  children,
  ...props
}: PanelProps) {
  const classes = ['console-card', className].filter(Boolean).join(' ');
  const hasHeader = title || description || tools;

  return (
    <section className={classes} {...props}>
      {hasHeader && (
        <div className="card-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <span>{description}</span>}
          </div>
          {tools}
        </div>
      )}
      {children}
    </section>
  );
}