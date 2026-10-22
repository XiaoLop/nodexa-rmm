// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServerOpsSummary } from './ServerOpsSummary';

const state = vi.hoisted(() => ({
  statsResult: {
    connected: true,
    stats: {
      cpuAverage: [0.35, 0.42, 0.5],
      totalMemory: 8 * 1024 * 1024 * 1024,
      freeMemory: 4 * 1024 * 1024 * 1024,
      availableMemory: 4.8 * 1024 * 1024 * 1024,
      serverState: {
        agentSessions: 42,
        userSessions: 3,
      },
    } as any,
  },
}));

vi.mock('../../features/server-admin/hooks', () => ({
  useServerStats: () => state.statsResult,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
});

describe('ServerOpsSummary', () => {
  it('renders stats when connected', () => {
    render(<ServerOpsSummary />);
    expect(screen.getByText('serverAdmin.channel')).toBeTruthy();
    expect(screen.getByText('common.status.connected')).toBeTruthy();
    expect(screen.getByText('0.35')).toBeTruthy();
    expect(screen.getByText('0.42')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders placeholder when disconnected', () => {
    state.statsResult = {
      connected: false,
      stats: undefined,
    };
    render(<ServerOpsSummary />);
    expect(screen.getByText('common.status.disconnected')).toBeTruthy();
  });
});
