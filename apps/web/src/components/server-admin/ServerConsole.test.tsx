// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ServerConsole } from './ServerConsole';
const mock = vi.hoisted(() => ({ input: (_data: string) => { void _data; }, output: (_packet: { text: string }) => { void _packet; }, write: vi.fn(), dispose: vi.fn(), unsubscribe: vi.fn(), connection: { connected: true, generation: 0, client: { connectionStatus: 'connected', server: { sendConsoleCommand: vi.fn(async (command: string) => { void command; }), subscribeConsole: vi.fn() } } } }));
vi.mock('../../features/server-admin/hooks', () => ({ useServerConnection: () => mock.connection }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@xterm/xterm', () => ({ Terminal: class {
  cols = 80;
  loadAddon() {} open() {} write = mock.write; dispose = mock.dispose;
  onData(listener: typeof mock.input) { mock.input = listener; return { dispose: vi.fn() }; }
} }));
vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit() {} } }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  mock.connection.connected = true;
  mock.connection.client.connectionStatus = 'connected';
  mock.connection.client.server.subscribeConsole.mockImplementation(listener => { mock.output = listener; return mock.unsubscribe; });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it('edits, completes and recalls locally; never replays on disconnect/reconnect or cleanup', async () => {
  const { rerender, unmount } = render(<ServerConsole />);
  await act(async () => { mock.input('inf'); mock.input('\t'); mock.input('\r'); });
  expect(mock.connection.client.server.sendConsoleCommand).toHaveBeenCalledWith('info');
  await act(async () => { mock.input('\x1b[A'); mock.input('\r'); });
  expect(mock.connection.client.server.sendConsoleCommand).toHaveBeenCalledTimes(2);
  mock.connection.connected = false;
  mock.connection.client.connectionStatus = 'disconnected';
  rerender(<ServerConsole />);
  act(() => { mock.input('maintenance'); mock.input('\r'); });
  mock.connection.connected = true;
  mock.connection.client.connectionStatus = 'connected';
  rerender(<ServerConsole />);
  expect(mock.connection.client.server.sendConsoleCommand).toHaveBeenCalledTimes(2);
  unmount();
  expect(mock.unsubscribe).toHaveBeenCalled();
  expect(mock.dispose).toHaveBeenCalled();
});

it('sanitizes remote output and uses bounded scrollback instead of a relay session', () => {
  render(<ServerConsole />);
  act(() => { mock.output({ text: '\x1b[31mhello\x1b[0m\x1b]52;c;secret\x07' }); vi.advanceTimersByTime(100); });
  expect(mock.write).toHaveBeenCalledWith('\r\x1b[2Khello\r\n');
});
