// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ServerDiagnosticsPanel } from './ServerDiagnosticsPanel';

const state = vi.hoisted(() => ({
  connection: {
    connected: true,
    generation: 0,
    client: {
      connectionStatus: 'connected',
      server: {
        sendConsoleCommand: vi.fn(),
        subscribeConsole: vi.fn(() => vi.fn()),
      },
    },
  },
  trace: {
    connected: true,
    sources: ['web'],
    records: [],
    paused: false,
    setPaused: vi.fn(),
    clearRecords: vi.fn(),
    client: {
      connectionStatus: 'connected',
      server: { setTraceSources: vi.fn() },
    },
  },
  log: {
    connected: true,
    busy: false,
    error: false,
    clearSent: false,
    content: undefined as string | undefined,
    clear: vi.fn(),
    refresh: vi.fn(),
  },
}));

vi.mock('../../features/server-admin/hooks', () => ({
  useServerConnection: () => state.connection,
  useServerTrace: () => state.trace,
  useServerErrorLog: () => state.log,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    cols = 80;
    loadAddon() {}
    open() {}
    write = vi.fn();
    dispose = vi.fn();
    onData() {
      return { dispose: vi.fn() };
    }
  },
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class {
    fit() {}
  },
}));

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  window.getComputedStyle = (() => ({ getPropertyValue: () => '' })) as any;
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ServerDiagnosticsPanel', () => {
  it('defaults to console tab and renders tabs without destroying inactive panes', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/admin/server']}>
        <Routes>
          <Route path="/admin/server" element={<ServerDiagnosticsPanel />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('navigation', { name: 'serverAdmin.diagnostics' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'serverAdmin.console' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'serverAdmin.trace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'serverAdmin.logs' })).toBeTruthy();
    expect(container.querySelector('div[aria-label="serverAdmin.console"]')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'serverAdmin.trace' }));
    expect(screen.getByText('serverAdmin.globalWarning')).toBeTruthy();
    // Inactive console container is preserved in DOM (keep-alive)
    expect(container.querySelector('div[aria-label="serverAdmin.console"]')).toBeTruthy();

    // Switch to Logs tab
    fireEvent.click(screen.getByRole('button', { name: 'serverAdmin.logs' }));
    expect(screen.getByRole('button', { name: 'serverAdmin.clear' })).toBeTruthy();
    // Console container remains in DOM
    expect(container.querySelector('div[aria-label="serverAdmin.console"]')).toBeTruthy();
  });

  it('respects the tab query parameter when opening the page', () => {
    render(
      <MemoryRouter initialEntries={['/admin/server?tab=logs']}>
        <Routes>
          <Route path="/admin/server" element={<ServerDiagnosticsPanel />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'serverAdmin.logs' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: 'serverAdmin.clear' })).toBeTruthy();
  });
});
