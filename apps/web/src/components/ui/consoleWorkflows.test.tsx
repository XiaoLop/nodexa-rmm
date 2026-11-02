import { UserCreateModal } from '../users/UserCreateModal';
/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestI18n } from '../../i18n/testI18n';
import { ServerFileUploadDrawer } from '../../features/server-files/ServerFileUploadDrawer';
import { AccessCard } from '../users/UserDetailsAccessTab';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((media: string) => ({
    matches: false,
    media,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
afterEach(cleanup);

describe('console workflows', () => {
  it('submits the staged files and removes a file without starting an upload', () => {
    const files = [
      { id: 'a', file: new File(['hello'], 'hello.txt'), subPath: [], relativePath: 'hello.txt' },
    ];
    const onStartUpload = vi.fn();
    const onStagedFilesChange = vi.fn();
    render(
      <I18nextProvider i18n={createTestI18n('zh-CN')}>
        <ServerFileUploadDrawer
          open
          targetPathDisplay="/shared"
          stagedFiles={files}
          onClose={vi.fn()}
          onStartUpload={onStartUpload}
          onStagedFilesChange={onStagedFilesChange}
        />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /移除/ }));
    expect(onStagedFilesChange).toHaveBeenCalledWith([]);
    expect(onStartUpload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /开始上传/ }));
    expect(onStartUpload).toHaveBeenCalledWith(files);
  });

  it('shows the upload error and retries the failed file', () => {
    const onRetry = vi.fn();
    render(
      <I18nextProvider i18n={createTestI18n('en-US')}>
        <ServerFileUploadDrawer
          open
          targetPathDisplay="/shared"
          stagedFiles={[]}
          onClose={vi.fn()}
          onStartUpload={vi.fn()}
          onStagedFilesChange={vi.fn()}
          onRetryUploadItem={onRetry}
          uploadItems={[
            {
              id: 'failed',
              file: new File(['hello'], 'hello.txt'),
              status: 'error',
              progressPercent: 20,
              uploadedBytes: 1,
              totalBytes: 5,
              error: 'Connection lost',
            },
          ]}
          uploadSummary={{
            totalFiles: 1,
            completedFiles: 0,
            failedFiles: 1,
            skippedFiles: 0,
            totalBytes: 5,
            uploadedBytes: 1,
            overallPercent: 20,
          }}
        />
      </I18nextProvider>,
    );
    expect(screen.getByText('Connection lost')).toBeDefined();
    expect(screen.getByText('Failed')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledWith('failed');
    expect(
      (screen.getByRole('button', { name: /Start upload/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('keeps permission actions bound to the selected row', () => {
    const row = { id: 'group', name: 'Operations', permission: 'Full access', rights: 1 };
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(
      <I18nextProvider i18n={createTestI18n('en-US')}>
        <AccessCard
          icon={null}
          title="Access"
          tone="blue-text"
          editable
          rows={[row]}
          onEdit={onEdit}
          onRemove={onRemove}
        />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Edit/ }));
    expect(onEdit).toHaveBeenCalledWith(row);
    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(onRemove).toHaveBeenCalledWith(row);
  });

  it('preserves disabled permission actions', () => {
    const onEdit = vi.fn();
    render(
      <I18nextProvider i18n={createTestI18n('en-US')}>
        <AccessCard
          icon={null}
          title="Access"
          tone="blue-text"
          editable
          editDisabled
          addDisabled
          rows={[{ id: 'group', name: 'Operations', permission: 'Full access', rights: 1 }]}
          onEdit={onEdit}
        />
      </I18nextProvider>,
    );
    const edit = screen.getByRole('button', { name: /Edit/ }) as HTMLButtonElement;
    expect(edit.disabled).toBe(true);
    fireEvent.click(edit);
    expect(onEdit).not.toHaveBeenCalled();
  });
});

describe('account creation dialog', () => {
  it('validates matching passwords before submitting the manual credentials', async () => {
    const i18n = createTestI18n('en-US');
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nextProvider i18n={i18n}>
        <UserCreateModal open submitting={false} onCancel={vi.fn()} onSubmit={onSubmit} />
      </I18nextProvider>,
    );
    fireEvent.change(screen.getByLabelText(i18n.t('users.modal.username')), {
      target: { value: 'operator' },
    });
    fireEvent.change(screen.getByLabelText(i18n.t('users.modal.password')), {
      target: { value: 'Password123!' },
    });
    fireEvent.change(screen.getByLabelText(i18n.t('users.modal.confirmPassword')), {
      target: { value: 'Different123!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(i18n.t('common.actions.create')) }),
    );
    await screen.findByText(i18n.t('users.modal.passwordMismatch'));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(i18n.t('users.modal.confirmPassword')), {
      target: { value: 'Password123!' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(i18n.t('common.actions.create')) }),
    );
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'operator',
          password: 'Password123!',
          randomPassword: false,
        }),
      ),
    );
  });

  it('submits random-password mode without requiring manual credentials', async () => {
    const i18n = createTestI18n('en-US');
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <I18nextProvider i18n={i18n}>
        <UserCreateModal open submitting={false} onCancel={vi.fn()} onSubmit={onSubmit} />
      </I18nextProvider>,
    );
    fireEvent.change(screen.getByLabelText(i18n.t('users.modal.username')), {
      target: { value: 'operator' },
    });
    fireEvent.click(
      screen.getByRole('radio', { name: new RegExp(i18n.t('users.modal.randomPassword')) }),
    );
    await waitFor(() =>
      expect(screen.queryByLabelText(i18n.t('users.modal.confirmPassword'))).toBeNull(),
    );
    fireEvent.click(
      screen.getByRole('button', { name: new RegExp(i18n.t('common.actions.create')) }),
    );
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'operator',
          password: '',
          randomPassword: true,
        }),
      ),
    );
  });
});
