import { Drawer, type DrawerProps } from 'antd';

export interface ConsoleDrawerProps extends Omit<DrawerProps, 'size' | 'width'> {
  variant?: 'form' | 'details' | 'compact';
}

const drawerWidths = { compact: 480, form: 560, details: 800 };

/** Shared spacing and responsive sizing for console forms and task details. */
export function ConsoleDrawer({ variant = 'form', rootClassName, ...props }: ConsoleDrawerProps) {
  return (
    <Drawer
      {...props}
      size={`min(${drawerWidths[variant]}px, 100vw)`}
      rootClassName={['console-drawer', rootClassName].filter(Boolean).join(' ')}
    />
  );
}
