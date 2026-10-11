/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestI18n } from '../../i18n/testI18n';
import { DevicePowerTimelineCard } from './DevicePowerTimelineCard';

vi.mock('echarts/core', () => {
  return {
    use: vi.fn(),
    init: vi.fn().mockReturnValue({
      setOption: vi.fn(),
      resize: vi.fn(),
      dispose: vi.fn(),
    }),
  };
});

beforeAll(() => {
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

  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe('DevicePowerTimelineCard', () => {
  it('renders online statistics card and requests powertimeline', async () => {
    const testI18n = createTestI18n('zh-CN');
    const mockRequest = vi.fn().mockResolvedValue({
      action: 'powertimeline',
      nodeid: 'node//target',
      timeline: [0, 1791548099, 1, 977, 0],
    });
    const mockOn = vi.fn().mockReturnValue(() => {});

    const fakeClient = {
      request: mockRequest,
      on: mockOn,
      devices: {
        powerTimeline: vi.fn().mockResolvedValue([0, 1791548099, 1, 977, 0]),
      },
    } as unknown as Parameters<typeof DevicePowerTimelineCard>[0]['client'];

    render(
      <I18nextProvider i18n={testI18n}>
        <DevicePowerTimelineCard
          deviceId="node//target"
          client={fakeClient}
          deviceOnline={true}
          controlConnected={true}
        />
      </I18nextProvider>,
    );

    expect(screen.getByText('近 7 天在线统计')).toBeDefined();
    expect(screen.getByText(/7天在线率/)).toBeDefined();
    expect(screen.getByText(/今日在线率/)).toBeDefined();

    await waitFor(() => {
      expect(fakeClient?.devices.powerTimeline).toHaveBeenCalledWith('node//target');
    });
  });
});
