/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BatchUploadFileItem } from '../../../features/batch-upload/types';
import { createTestI18n } from '../../../i18n/testI18n';
import { DeviceFileUploadModal } from './DeviceFileUploadModal';

window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => cleanup());

describe('DeviceFileUploadModal', () => {
  const testI18n = createTestI18n();
  const dummyFile1 = new File(['hello world'], 'hello.txt', { type: 'text/plain' });
  const dummyFile2 = new File(['folder content'], 'index.ts', { type: 'text/typescript' });

  const files: BatchUploadFileItem[] = [
    { file: dummyFile1, relativePath: 'hello.txt' },
    { file: dummyFile2, relativePath: 'src/index.ts' },
  ];

  it('renders target directory and file list correctly', () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <DeviceFileUploadModal
          open={true}
          targetDirectory="/tmp/destination"
          files={files}
          onClose={vi.fn()}
          onConfirm={vi.fn()}
        />
      </I18nextProvider>,
    );

    expect(screen.getByText('/tmp/destination')).toBeDefined();
    expect(screen.getByText('hello.txt')).toBeDefined();
    expect(screen.getByText('src/index.ts')).toBeDefined();
  });

  it('allows removing an individual item before confirming', () => {
    const onConfirm = vi.fn();
    render(
      <I18nextProvider i18n={testI18n}>
        <DeviceFileUploadModal
          open={true}
          targetDirectory="C:\\Temp"
          files={files}
          onClose={vi.fn()}
          onConfirm={onConfirm}
        />
      </I18nextProvider>,
    );

    // Delete the first file from modal portal
    const deleteButtons = document.querySelectorAll('.ant-btn-text.ant-btn-dangerous');
    expect(deleteButtons.length).toBe(2);
    fireEvent.click(deleteButtons[0]!);

    expect(screen.queryByText('hello.txt')).toBeNull();
    expect(screen.getByText('src/index.ts')).toBeDefined();

    // Confirm upload
    const confirmButton = screen.getByRole('button', { name: /确认上传|confirm/i });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith(
      [{ file: dummyFile2, relativePath: 'src/index.ts' }],
      { overwritePolicy: 'overwrite' },
    );
  });
});
