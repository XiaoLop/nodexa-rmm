/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestI18n } from '../i18n/testI18n';
import { BatchTaskContext, type BatchTaskContextValue } from '../features/tasks/BatchTaskContext';
import { BatchTaskManager } from '../features/tasks/BatchTaskManager';
import { TasksPage } from './TasksPage';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(() => cleanup());

describe('TasksPage', () => {
  it('renders task center page with metrics and tasks', () => {
    const manager = new BatchTaskManager();
    manager.addTask({
      kind: 'power',
      title: 'Power off devices',
      status: 'completed',
      createdAt: Date.now(),
      progress: 100,
      totalCount: 3,
      completedCount: 3,
      succeededCount: 3,
      failedCount: 0,
      skippedCount: 0,
      availableActions: [],
      action: 'poweroff',
      results: [],
    });

    const contextValue: BatchTaskContextValue = {
      ...manager.getSnapshot(),
      manager,
      createUploadTask: vi.fn(),
      createCommandTask: vi.fn(),
      createMoveTask: vi.fn(),
      createPowerTask: vi.fn(),
    };

    const i18n = createTestI18n('zh-CN');

    render(
      <MemoryRouter initialEntries={['/devices/tasks']}>
        <I18nextProvider i18n={i18n}>
          <BatchTaskContext.Provider value={contextValue}>
            <TasksPage />
          </BatchTaskContext.Provider>
        </I18nextProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: '任务中心' })).toBeDefined();
    expect(screen.getByText('Power off devices')).toBeDefined();
    expect(screen.getByText('总任务数')).toBeDefined();
  });

  it('renders empty state when no tasks exist', () => {
    const manager = new BatchTaskManager();
    const contextValue: BatchTaskContextValue = {
      ...manager.getSnapshot(),
      manager,
      createUploadTask: vi.fn(),
      createCommandTask: vi.fn(),
      createMoveTask: vi.fn(),
      createPowerTask: vi.fn(),
    };

    const i18n = createTestI18n('zh-CN');

    render(
      <MemoryRouter initialEntries={['/devices/tasks']}>
        <I18nextProvider i18n={i18n}>
          <BatchTaskContext.Provider value={contextValue}>
            <TasksPage />
          </BatchTaskContext.Provider>
        </I18nextProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('暂无批量任务')).toBeDefined();
  });

  it('renders upload task targets accurately as devices and files', () => {
    const manager = new BatchTaskManager();
    manager.addTask({
      kind: 'file-upload',
      title: 'Batch file upload',
      status: 'completed',
      createdAt: Date.now(),
      progress: 100,
      totalCount: 7,
      targetDeviceCount: 1,
      fileCount: 7,
      completedCount: 7,
      succeededCount: 7,
      failedCount: 0,
      skippedCount: 0,
      availableActions: [],
      upload: {
        status: 'completed',
        tasks: [
          {
            id: '1',
            batchId: 'b1',
            device: { id: 'd1', name: 'Device-1', online: true },
            status: 'success',
            totalBytes: 100,
            sentBytes: 100,
            acknowledgedBytes: 100,
            percentage: 100,
            retryCount: 0,
          },
        ],
      },
    });

    const contextValue: BatchTaskContextValue = {
      ...manager.getSnapshot(),
      manager,
      createUploadTask: vi.fn(),
      createCommandTask: vi.fn(),
      createMoveTask: vi.fn(),
      createPowerTask: vi.fn(),
    };

    const i18n = createTestI18n('zh-CN');

    render(
      <MemoryRouter initialEntries={['/devices/tasks']}>
        <I18nextProvider i18n={i18n}>
          <BatchTaskContext.Provider value={contextValue}>
            <TasksPage />
          </BatchTaskContext.Provider>
        </I18nextProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('1 台设备（7 个文件）')).toBeDefined();
    expect(screen.queryByText('7 台设备')).toBeNull();
  });
});
