import { Modal, type ModalProps } from 'antd';
import type { ReactNode } from 'react';

export interface ConsoleModalProps extends Omit<ModalProps, 'width'> {
  variant?: 'form' | 'details' | 'wide';
  description?: ReactNode;
}

const modalWidths = { form: 560, details: 800, wide: 1180 };

/** Shared dialog sizing with a scrollable body and visible actions. */
export function ConsoleModal({
  variant = 'form',
  description,
  title,
  rootClassName,
  centered = true,
  ...props
}: ConsoleModalProps) {
  return (
    <Modal
      {...props}
      centered={centered}
      width={`min(${modalWidths[variant]}px, calc(100vw - 32px))`}
      rootClassName={['console-modal', rootClassName].filter(Boolean).join(' ')}
      title={
        description ? (
          <div className="console-modal-heading">
            <div>{title}</div>
            <p>{description}</p>
          </div>
        ) : (
          title
        )
      }
    />
  );
}
