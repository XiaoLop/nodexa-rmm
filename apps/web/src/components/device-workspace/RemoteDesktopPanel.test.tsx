/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestI18n } from '../../i18n/testI18n';
import { createDeviceWorkspaceModel } from '../../features/device-workspace/deviceWorkspaceModel';
import { RemoteDesktopPanel } from './RemoteDesktopPanel';

vi.mock('./desktop/DesktopCanvas', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  return {
    DesktopCanvas: forwardRef(function MockCanvas(_props, ref) {
      useImperativeHandle(ref, () => ({ clear: vi.fn() }));
      return <canvas data-testid="desktop-canvas" />;
    }),
  };
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
});

afterEach(cleanup);

function renderPanel(access: 'control' | 'view-only' = 'control') {
  const onSettingsChange = vi.fn();
  const model = createDeviceWorkspaceModel({ id: 'test-device', name: 'Desktop', online: true });
  const result = render(
    <I18nextProvider i18n={createTestI18n()}>
      <RemoteDesktopPanel
        model={model}
        device={model.device}
        controlConnected
        desktopAccess={access}
        settings={{ keyboard: true, mouse: true, screenInput: false, resolution: '1280 × 720', colorDepth: 32, quality: 58, imageFormat: 'webp', frameTimer: 100 }}
        onSettingsChange={onSettingsChange}
        scale="fit"
        onScaleChange={vi.fn()}
      />
    </I18nextProvider>,
  );
  return { ...result, onSettingsChange };
}

describe('RemoteDesktopPanel layout', () => {
  it('keeps persistent controls outside the remote screen', () => {
    const { container } = renderPanel();
    const toolbar = screen.getByRole('complementary');
    const canvas = screen.getByTestId('desktop-canvas');
    expect(toolbar.contains(canvas)).toBe(false);
    expect(toolbar.parentElement).toBe(canvas.closest('.remote-desktop-card'));
    expect(container.querySelector('.remote-floating-capsule')).toBeNull();
    expect(within(toolbar).getAllByRole('switch')).toHaveLength(2);
    expect(within(toolbar).getAllByRole('combobox')).toHaveLength(3);
    expect(within(toolbar).getByRole('slider')).toBeDefined();
    fireEvent.mouseLeave(toolbar);
    expect(toolbar.hidden).toBe(false);
  });

  it('prevents page scrolling only over the remote screen, without stopping remote wheel delivery', () => {
    const { container } = renderPanel();
    const remoteScreen = container.querySelector('.remote-screen')!;
    const receiveWheel = vi.fn();
    remoteScreen.addEventListener('wheel', receiveWheel);
    const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
    screen.getByTestId('desktop-canvas').dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(receiveWheel).toHaveBeenCalledOnce();

    const toolbarWheel = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 120 });
    screen.getByRole('complementary').dispatchEvent(toolbarWheel);
    expect(toolbarWheel.defaultPrevented).toBe(false);
  });

  it('preserves settings changes and view-only restrictions', () => {
    const { onSettingsChange, unmount } = renderPanel();
    fireEvent.click(screen.getAllByRole('switch')[0]!);
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ keyboard: false }));
    unmount();
    renderPanel('view-only');
    for (const toggle of screen.getAllByRole('switch')) {
      expect((toggle as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
