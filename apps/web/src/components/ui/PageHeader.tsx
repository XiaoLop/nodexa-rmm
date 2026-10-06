import type { HTMLAttributes, ReactNode } from 'react';

export interface PageHeaderProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  leading,
  status,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  const classes = ['page-heading', className].filter(Boolean).join(' ');

  return (
    <header className={classes} {...props}>
      <div className="page-heading-main">
        {leading}
        <div className="page-heading-copy">
          <div className="page-heading-title-row">
            <h1>{title}</h1>
            {status}
          </div>
          {description && <p>{description}</p>}
        </div>
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}