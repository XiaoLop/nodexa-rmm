import type { HTMLAttributes } from 'react';

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  grow?: boolean;
}

export function FilterBar({ className, grow = false, ...props }: FilterBarProps) {
  const classes = ['table-toolbar', grow && 'filter-bar-grow', className]
    .filter(Boolean)
    .join(' ');

  return <div className={classes} {...props} />;
}