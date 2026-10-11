/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestI18n } from '../../i18n/testI18n';
import { BatchTaskContext, type BatchTaskContextValue } from './BatchTaskContext';
import { BatchTaskManager } from './BatchTaskManager';
import { TaskCenterPopover } from './TaskCenterPopover';

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

describe('TaskCenterPopover', () => {
  it('renders popover with empty state when there are no tasks', () => {
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
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <BatchTaskContext.Provider value={contextValue}>
            <TaskCenterPopover />
          </BatchTaskContext.Provider>
        </I18nextProvider>
      </MemoryRouter>,
    );

    const triggerButton = screen.getByRole('button', { name: '任务中心' });
    fireEvent.click(triggerButton);

    expect(screen.getByText('暂无批量任务')).toBeDefined();
    expect(screen.getByText('显示全部任务')).toBeDefined();
  });

  it('renders only the latest 2 tasks when multiple tasks exist', () => {
    const manager = new BatchTaskManager();
    manager.addTask({
      kind: 'power',
      title: 'Old task 1',
      status: 'completed',
      createdAt: 1000,
      progress: 100,
      totalCount: 1,
      completedCount: 1,
      succeededCount: 1,
      failedCount: 0,
      skippedCount: 0,
      availableActions: [],
      action: 'poweroff',
      results: [],
    });
    manager.addTask({
      kind: 'command',
      title: 'Middle task 2',
      status: 'running',
      createdAt: 2000,
      progress: 50,
      totalCount: 2,
      completedCount: 1,
      succeededCount: 1,
      failedCount: 0,
      skippedCount: 0,
      availableActions: [],
      command: 'echo 1',
      shell: 'shell',
      deviceNames: {},
    });
    manager.addTask({
      kind: 'file-upload',
      title: 'Newest task 3',
      status: 'running',
      createdAt: 3000,
      progress: 20,
      totalCount: 7,
      completedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      skippedCount: 0,
      availableActions: [],
      upload: { status: 'running', tasks: [] },
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
      <MemoryRouter>
        <I18nextProvider i18n={i18n}>
          <BatchTaskContext.Provider value={contextValue}>
            <TaskCenterPopover />
          </BatchTaskContext.Provider>
        </I18nextProvider>
      </MemoryRouter>,
    );

    const triggerButton = screen.getByRole('button', { name: '任务中心' });
    fireEvent.click(triggerButton);

    expect(screen.getByText('Newest task 3')).toBeDefined();
    expect(screen.getByText('Middle task 2')).toBeDefined();
    expect(screen.queryByText('Old task 1')).toBeNull();
  });

  it('navigates to tasks page on clicking view all tasks', () => {
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
      <MemoryRouter initialEntries={['/devices']}>
        <I18nextProvider i18n={i18n}>
          <BatchTaskContext.Provider value={contextValue}>
            <TaskCenterPopover />
          </BatchTaskContext.Provider>
          <Routes>
            <Route path="/devices" element={<div>Devices Page</div>} />
            <Route path="/devices/tasks" element={<div>Tasks Target Page</div>} />
          </Routes>
        </I18nextProvider>
      </MemoryRouter>,
    );

    const triggerButton = screen.getByRole('button', { name: '任务中心' });
    fireEvent.click(triggerButton);

    const viewAllBtn = screen.getByText('显示全部任务');
    fireEvent.click(viewAllBtn);

    expect(screen.getByText('Tasks Target Page')).toBeDefined();
  });
});
