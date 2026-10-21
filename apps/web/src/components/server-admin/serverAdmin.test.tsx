// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ErrorLogPanel } from './ErrorLogPanel';
import { Highlight, TracePanel } from './TracePanel';

const state = vi.hoisted(() => ({
  trace: { connected: true, sources: ['web'], records: [], paused: false, setPaused: vi.fn(), clearRecords: vi.fn(), client: { connectionStatus: 'connected', server: { setTraceSources: vi.fn(async (values: string[]) => { void values; }) } } },
  log: { connected: true, busy: false, error: false, clearSent: false, content: undefined as string | undefined, clear: vi.fn(), refresh: vi.fn() },
}));
vi.mock('../../features/server-admin/hooks', () => ({ useServerTrace: () => state.trace, useServerErrorLog: () => state.log }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  window.getComputedStyle = (() => ({ getPropertyValue: () => '' })) as any;
});
afterEach(() => { cleanup(); vi.clearAllMocks(); state.log.connected = true; state.log.content = undefined; state.log.clearSent = false; });

describe('server administration components', () => {
  it('renders and highlights untrusted text without interpreting markup', () => {
    const { container } = render(<Highlight text="<script>danger</script>" keyword="danger" />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('mark')?.textContent).toBe('danger');
  });
  it('distinguishes absent and empty log responses and only sends clear after confirmation', async () => {
    const { rerender } = render(<ErrorLogPanel />);
    expect(screen.getByText('serverAdmin.absent')).toBeTruthy();
    state.log.content = '';
    rerender(<ErrorLogPanel />);
    expect(screen.getByText('serverAdmin.empty')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'serverAdmin.clear' }));
    expect(state.log.clear).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(state.log.clear).toHaveBeenCalledTimes(1));
  });
  it('disables disconnected refresh and clear and does not claim sent clear is successful', () => {
    state.log.connected = false;
    state.log.clearSent = true;
    render(<ErrorLogPanel />);
    expect((screen.getByRole('button', { name: 'serverAdmin.clear' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'common.actions.refresh' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('serverAdmin.clearSent')).toBeTruthy();
    expect(state.log.clear).not.toHaveBeenCalled();
  });
  it('requires confirmation before sending a global trace change', async () => {
    render(<TracePanel />);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'serverAdmin.globalCategories' }));
    fireEvent.click((await screen.findAllByTitle('web')).find(element => element.classList.contains('ant-select-item-option'))!);
    fireEvent.click(screen.getByRole('button', { name: 'serverAdmin.apply' }));
    expect(state.trace.client.server.setTraceSources).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'OK' }));
    await waitFor(() => expect(state.trace.client.server.setTraceSources).toHaveBeenCalledWith([]));
    expect(screen.getByText('serverAdmin.sent')).toBeTruthy();
  });
  it('pauses scrolling without hiding collected records or disabling export', () => {
    const scroll = vi.fn();
    HTMLElement.prototype.scrollIntoView = scroll;
    state.trace.paused = true;
    const { rerender } = render(<TracePanel />);
    expect(scroll).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'serverAdmin.export' }) as HTMLButtonElement).disabled).toBe(false);
    state.trace.paused = false;
    rerender(<TracePanel />);
    expect(scroll).toHaveBeenCalled();
  });
  it('shows live global settings and never writes them merely by rendering or unmounting', () => {
    const { unmount } = render(<TracePanel />);
    expect(screen.getByText('serverAdmin.globalWarning')).toBeTruthy();
    expect(screen.getByText(/serverAdmin.enabled/).textContent).toContain('web');
    fireEvent.click(screen.getByRole('button', { name: 'serverAdmin.clearLocal' }));
    expect(state.trace.clearRecords).toHaveBeenCalledTimes(1);
    unmount();
    expect(state.trace.client.server.setTraceSources).not.toHaveBeenCalled();
  });
});
