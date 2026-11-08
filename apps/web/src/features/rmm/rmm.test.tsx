// @vitest-environment jsdom
import type { MeshCentralClient } from '@meshcentral/control-client';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilesPage } from '../../pages/FilesPage';
import { ScriptLibraryPage } from '../../pages/ScriptLibraryPage';
import { decodeScript, maxScriptBytes, ScriptEditor } from './ScriptEditor';
import { ScriptTasks } from './ScriptTasks';

const state = vi.hoisted(() => ({
  admin: true,
  rmm: {
    saveScript: vi.fn(),
    listScripts: vi.fn(),
    getTask: vi.fn(),
    listTasks: vi.fn(),
    releaseDevice: vi.fn(),
  },
  files: {
    connected: true,
    busy: false,
    loading: false,
    entries: [{ name: 'check.ps1', kind: 'file', size: 20, path: ['user', 'check.ps1'] }],
    currentSpace: { id: 'user', path: ['user'], kind: 'user', name: 'Files' },
    currentPath: ['user'],
    selectedEntries: [],
    selectedPaths: [],
    tree: { spaces: [{ id: 'user', path: ['user'], kind: 'user', name: 'Files', entries: [] }] },
    readFile: vi.fn(),
    openSpace: vi.fn(),
    openPath: vi.fn(),
    refresh: vi.fn(),
    select: vi.fn(),
  },
}));
vi.mock('../gateway', () => {
  const data = { status: 'connected', client: { rmm: state.rmm } };
  return { useMeshCentralControlData: () => data };
});
vi.mock('../permissions/useUiCapabilities', () => ({
  useApplicationUiCapabilities: () => ({ siteAdmin: state.admin, serverFiles: true }),
}));
vi.mock('../server-files/useServerFiles', () => ({ useServerFiles: () => state.files }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../i18n', () => ({ useFormatters: () => ({ dateTime: (value: string) => value }) }));
vi.mock('../../i18n/formatters', () => ({
  useFormatters: () => ({ dateTime: (value: string) => value }),
}));

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
  }));
  window.getComputedStyle = (() => ({
    getPropertyValue: () => '',
  })) as unknown as typeof window.getComputedStyle;
});
beforeEach(() => {
  state.admin = true;
  state.files.entries[0] = {
    name: 'check.ps1',
    kind: 'file',
    size: 20,
    path: ['user', 'check.ps1'],
  };
  vi.clearAllMocks();
  state.rmm.listScripts.mockResolvedValue([]);
  state.rmm.saveScript.mockResolvedValue({ id: 'script', version: 1 });
  state.files.readFile.mockResolvedValue(new TextEncoder().encode('\uFEFFWrite-Output "中文"'));
});
afterEach(cleanup);

describe('script import', () => {
  it('strips UTF-8 BOM and enforces extension, valid encoding and the exact byte boundary', () => {
    expect(decodeScript('TEST.PS1', new TextEncoder().encode('\uFEFF中文'))).toBe('中文');
    expect(decodeScript('a.ps1', new Uint8Array(maxScriptBytes).fill(35))).toHaveLength(
      maxScriptBytes,
    );
    expect(() => decodeScript('a.ps1', new Uint8Array(maxScriptBytes + 1))).toThrow();
    expect(() => decodeScript('a.ps1', new Uint8Array([255, 254, 255]))).toThrow();
    expect(() => decodeScript('a.txt', new Uint8Array([35]))).toThrow('INVALID_SCRIPT');
  });

  it.each(['windows', 'linux'])(
    'imports a %s server file from the library into the shared editor',
    async (platform) => {
      const filename = platform === 'linux' ? 'check.sh' : 'check.ps1';
      const label = platform === 'linux' ? 'POSIX Shell' : 'PowerShell';
      const body = platform === 'linux' ? 'printf 中文' : 'Write-Output "中文"';
      state.files.entries[0] = { name: filename, kind: 'file', size: 20, path: ['user', filename] };
      state.files.readFile.mockResolvedValue(new TextEncoder().encode('\uFEFF' + body));
      render(
        <MemoryRouter>
          <ScriptLibraryPage />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'rmm.newScript' }));
      fireEvent.click(screen.getByRole('button', { name: 'rmm.serverImport' }));
      fireEvent.click(screen.getByRole('button', { name: filename }));
      await waitFor(() =>
        expect((screen.getByLabelText(label) as HTMLTextAreaElement).value).toBe(body),
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: /rmm.saveVersion/ }).hasAttribute('disabled'),
        ).toBe(false),
      );
      fireEvent.click(screen.getByRole('button', { name: /rmm.saveVersion/ }));
      await waitFor(() =>
        expect(state.rmm.saveScript).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'check', body, platform }),
          undefined,
        ),
      );
    },
  );

  it.each(['windows', 'linux'])(
    'imports %s from file management with admin gating',
    async (platform) => {
      const filename = platform === 'linux' ? 'check.sh' : 'check.ps1';
      const label = platform === 'linux' ? 'POSIX Shell' : 'PowerShell';
      const body = platform === 'linux' ? 'printf 中文' : 'Write-Output "中文"';
      state.files.entries[0] = { name: filename, kind: 'file', size: 20, path: ['user', filename] };
      state.files.readFile.mockResolvedValue(new TextEncoder().encode('\uFEFF' + body));
      const view = render(
        <MemoryRouter>
          <FilesPage />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'rmm.importToLibrary' }));
      await waitFor(() =>
        expect((screen.getByLabelText(label) as HTMLTextAreaElement).value).toBe(body),
      );
      fireEvent.click(screen.getByRole('button', { name: /rmm.saveVersion/ }));
      await waitFor(() =>
        expect(state.rmm.saveScript).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'check', body, platform }),
          undefined,
        ),
      );
      view.unmount();
      state.admin = false;
      render(
        <MemoryRouter>
          <FilesPage />
        </MemoryRouter>,
      );
      expect(screen.queryByRole('button', { name: 'rmm.importToLibrary' })).toBeNull();
    },
  );

  it('shows an error for invalid local uploads without replacing the current script', async () => {
    const client = { rmm: state.rmm } as unknown as MeshCentralClient;
    const view = render(
      <ScriptEditor
        client={client}
        imported={{ name: 'original', body: 'exit 0' }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    const input = view.container.ownerDocument.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: {
        files: [
          { name: 'bad.ps1', size: 3, arrayBuffer: async () => new Uint8Array([255]).buffer },
        ],
      },
    });
    await screen.findByRole('alert');
    expect((screen.getByLabelText('PowerShell') as HTMLTextAreaElement).value).toBe('exit 0');
    expect(state.rmm.saveScript).not.toHaveBeenCalled();
  });

  it('imports a local shell file with BOM and saves it as a Linux version', async () => {
    const client = { rmm: state.rmm } as unknown as MeshCentralClient;
    render(<ScriptEditor client={client} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: {
        files: [
          {
            name: 'local.sh',
            size: 30,
            arrayBuffer: async () => new TextEncoder().encode('\uFEFFprintf "中文"').buffer,
          },
        ],
      },
    });
    await waitFor(() =>
      expect((screen.getByLabelText('POSIX Shell') as HTMLTextAreaElement).value).toBe(
        'printf "中文"',
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /rmm.saveVersion/ }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /rmm.saveVersion/ }));
    await waitFor(() =>
      expect(state.rmm.saveScript).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'local', platform: 'linux', body: 'printf "中文"' }),
        undefined,
      ),
    );
  });
});

describe('device occupancy recovery UI', () => {
  beforeEach(() => {
    state.rmm.getTask.mockResolvedValue({
      id: 'task',
      name: 'Test',
      scriptId: 'script',
      version: 1,
      actor: 'user//admin',
      created: Date.now(),
      active: false,
      counts: { timeout: 1 },
      results: [
        {
          id: 'node//test',
          name: 'Device',
          executionId: 'execution',
          status: 'timeout',
          reason: 'NO_RECEIPT',
          exitCode: null,
          output: null,
          truncated: false,
          occupiedBy: 'execution',
          waitingReason: 'REMOTE_STATE_UNKNOWN',
          canRelease: true,
        },
      ],
    });
    state.rmm.releaseDevice.mockResolvedValue({});
  });

  it('requires process confirmation and a reason, submits the expected execution then refreshes', async () => {
    render(
      <MemoryRouter>
        <ScriptTasks taskId="task" onSelect={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'rmm.releaseDevice' }));
    const dialog = screen.getByRole('dialog');
    const ok = within(dialog).getByRole('button', { name: 'OK' });
    expect(ok.hasAttribute('disabled')).toBe(true);
    fireEvent.click(within(dialog).getByRole('checkbox'));
    expect(ok.hasAttribute('disabled')).toBe(true);
    fireEvent.change(within(dialog).getByRole('textbox'), {
      target: { value: 'Checked process ended' },
    });
    fireEvent.click(ok);
    await waitFor(() =>
      expect(state.rmm.releaseDevice).toHaveBeenCalledWith(
        'node//test',
        'execution',
        'Checked process ended',
      ),
    );
    await waitFor(() => expect(state.rmm.getTask).toHaveBeenCalledTimes(2));
  });

  it('hides the release action when the server denies permission', async () => {
    const value = await state.rmm.getTask();
    value.results[0].canRelease = false;
    state.rmm.getTask.mockResolvedValue(value);
    render(
      <MemoryRouter>
        <ScriptTasks taskId="task" onSelect={vi.fn()} />
      </MemoryRouter>,
    );
    await screen.findByText('rmm.reason.REMOTE_STATE_UNKNOWN');
    expect(screen.queryByRole('button', { name: 'rmm.releaseDevice' })).toBeNull();
  });
});
