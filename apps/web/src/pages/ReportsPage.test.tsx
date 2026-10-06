/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestI18n } from '../i18n/testI18n';
import { ReportsPage } from './ReportsPage';

const capabilities = {
  viewUserTrafficReports: false,
  viewDatabaseRecordReports: false,
};

vi.mock('../features/gateway/useMeshCentralControlData', () => ({
  useMeshCentralControlData: () => ({
    status: 'connected',
    client: { reports: { query: vi.fn() } },
    devices: [],
    groups: [],
  }),
}));

vi.mock('../features/permissions/useUiCapabilities', () => ({
  useApplicationUiCapabilities: () => capabilities,
}));

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

afterEach(() => {
  cleanup();
  capabilities.viewUserTrafficReports = false;
  capabilities.viewDatabaseRecordReports = false;
});

describe('ReportsPage', () => {
  it('keeps personal reports available to regular users', () => {
    renderPage();

    expect(screen.getByRole('button', { name: /远程会话/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /用户登录/ })).toBeDefined();
    expect(screen.queryByRole('button', { name: /用户流量/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /数据库记录/ })).toBeNull();
  });

  it('shows privileged report types when capabilities allow them', () => {
    capabilities.viewUserTrafficReports = true;
    capabilities.viewDatabaseRecordReports = true;
    renderPage();

    expect(screen.getByRole('button', { name: /用户流量/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /数据库记录/ })).toBeDefined();
  });
});

function renderPage() {
  render(
    <I18nextProvider i18n={createTestI18n('zh-CN')}>
      <ReportsPage />
    </I18nextProvider>,
  );
}