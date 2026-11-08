// @vitest-environment jsdom
import type { MeshCentralClient, RmmScript } from '@meshcentral/control-client';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FilesPage } from '../../pages/FilesPage';
import { ScriptLibraryPage } from '../../pages/ScriptLibraryPage';
import { decodeScript, maxScriptBytes, ScriptEditor } from './ScriptEditor';
import { ExecuteScriptModal } from './ExecuteScriptModal';
import { ScriptTasks } from './ScriptTasks';

const state = vi.hoisted(() => ({
  admin: true,
  rmm: {
    saveScript: vi.fn(),
    listScripts: vi.fn(),
    getTask: vi.fn(),
    listTasks: vi.fn(),
    releaseDevice: vi.fn(),
    preview: vi.fn(),
    submit: vi.fn(),
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
  const data = { status: 'connected', client: { rmm: state.rmm }, devices: [], groups: [] };
  return { useMeshCentralControlData: () => data };
});
vi.mock('../permissions/useUiCapabilities', () => ({
  useApplicationUiCapabilities: () => ({ siteAdmin: state.admin, serverFiles: true }),
}));
vi.mock('../server-files/useServerFiles', () => ({ useServerFiles: () => state.files }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) =>
      key === 'rmm.eligibleTargets' ? `${key}:${values?.count}` : key,
  }),
}));
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

describe('automation discovery and preview', () => {
  const scripts: RmmScript[] = [
    {
      id: 'win',
      name: 'Windows check',
      description: 'Disk health',
      version: 1,
      builtin: true,
      archived: false,
      parameters: [],
    },
    {
      id: 'linux',
      name: 'Linux check',
      description: 'System health',
      version: 2,
      platform: 'linux',
      builtin: false,
      archived: false,
      parameters: [],
    },
    {
      id: 'old',
      name: 'Archived check',
      description: '',
      version: 1,
      builtin: false,
      archived: true,
      parameters: [],
    },
  ];

  it('filters scripts by text, platform, source and archive state', async () => {
    state.rmm.listScripts.mockResolvedValue(scripts);
    render(
      <MemoryRouter>
        <ScriptLibraryPage />
      </MemoryRouter>,
    );
    await screen.findByText('Windows check');
    expect(screen.queryByText('Archived check')).toBeNull();
    fireEvent.change(screen.getByLabelText('rmm.searchScripts'), { target: { value: 'disk' } });
    expect(screen.getByText('Windows check')).toBeDefined();
    expect(screen.queryByText('Linux check')).toBeNull();
    fireEvent.change(screen.getByLabelText('rmm.searchScripts'), { target: { value: '' } });
    fireEvent.mouseDown(screen.getByLabelText('rmm.platform'));
    fireEvent.click(screen.getByTitle('Linux · /bin/sh'));
    expect(screen.getByText('Linux check')).toBeDefined();
    expect(screen.queryByText('Windows check')).toBeNull();
    fireEvent.mouseDown(screen.getByLabelText('rmm.source'));
    fireEvent.click(screen.getByTitle('rmm.builtin'));
    expect(screen.getByText('rmm.noMatchingScripts')).toBeDefined();
    fireEvent.mouseDown(screen.getByLabelText('rmm.scriptState'));
    fireEvent.click(screen.getByTitle('rmm.archived'));
    fireEvent.mouseDown(screen.getByLabelText('rmm.platform'));
    fireEvent.click(screen.getByTitle('rmm.allPlatforms'));
    fireEvent.mouseDown(screen.getByLabelText('rmm.source'));
    fireEvent.click(screen.getByTitle('rmm.custom'));
    expect(screen.getByText('Archived check')).toBeDefined();
    expect(screen.queryByText('Linux check')).toBeNull();
  });

  it('filters the current task page without hiding pagination', async () => {
    state.rmm.listTasks.mockResolvedValue({
      tasks: [
        {
          id: 'a',
          name: 'Alpha',
          actor: 'admin',
          version: 1,
          created: Date.now(),
          counts: { succeeded: 1 },
          active: false,
        },
        {
          id: 'b',
          name: 'Beta',
          actor: 'operator',
          version: 2,
          created: Date.now(),
          counts: { timeout: 1 },
          active: false,
        },
      ],
      before: 123,
    });
    render(
      <MemoryRouter>
        <ScriptTasks onSelect={vi.fn()} />
      </MemoryRouter>,
    );
    await screen.findByText('Alpha v1');
    fireEvent.change(screen.getByLabelText('rmm.searchTasks'), { target: { value: 'operator' } });
    expect(screen.queryByText('Alpha v1')).toBeNull();
    expect(screen.getByText('Beta v2')).toBeDefined();
    expect(screen.getByText('rmm.currentPageFilter')).toBeDefined();
    expect(screen.getByRole('button', { name: 'rmm.next' }).hasAttribute('disabled')).toBe(false);
    fireEvent.change(screen.getByLabelText('rmm.searchTasks'), { target: { value: '' } });
    fireEvent.mouseDown(screen.getByLabelText('rmm.resultFilter'));
    fireEvent.click(screen.getByTitle('rmm.status.timeout'));
    expect(screen.queryByText('Alpha v1')).toBeNull();
    expect(screen.getByText('Beta v2')).toBeDefined();
  });

  it('summarizes preview exclusions and requires a new preview after editing', async () => {
    state.rmm.preview.mockResolvedValue({
      id: 'preview',
      targets: [
        { id: 'one', name: 'Online' },
        { id: 'two', name: 'Offline', reason: 'AGENT_OFFLINE' },
        { id: 'three', name: 'Unsupported', reason: 'UNSUPPORTED_AGENT' },
      ],
    });
    render(
      <MemoryRouter>
        <ExecuteScriptModal initial={scripts[0]!} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'rmm.preview' }));
    await screen.findByText('rmm.previewMayChange');
    expect(screen.getByText('rmm.eligibleTargets:1')).toBeDefined();
    expect(screen.getByText('rmm.reason.AGENT_OFFLINE: 1')).toBeDefined();
    expect(screen.getByText('rmm.reason.UNSUPPORTED_AGENT: 1')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'rmm.editTargets' }));
    expect(screen.queryByText('rmm.previewMayChange')).toBeNull();
    expect(screen.getByRole('button', { name: /rmm.preview/ })).toBeDefined();
    expect(state.rmm.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /rmm.preview/ }));
    await screen.findByText('rmm.previewMayChange');
    expect(state.rmm.preview).toHaveBeenCalledTimes(2);
    state.rmm.submit.mockResolvedValue({ id: 'task' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /rmm.confirm/ }).hasAttribute('disabled')).toBe(
        false,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /rmm.confirm/ }));
    await waitFor(() =>
      expect(state.rmm.submit).toHaveBeenCalledWith('preview', expect.any(String), {}),
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

  it('filters device results without changing the task summary', async () => {
    const value = await state.rmm.getTask();
    value.counts.succeeded = 1;
    value.results.push({
      id: 'node//other',
      name: 'Other device',
      status: 'succeeded',
      reason: null,
      exitCode: 0,
      output: 'done',
      truncated: false,
    });
    state.rmm.getTask.mockResolvedValue(value);
    render(
      <MemoryRouter>
        <ScriptTasks taskId="task" onSelect={vi.fn()} />
      </MemoryRouter>,
    );
    await screen.findByText('Other device');
    fireEvent.mouseDown(screen.getByLabelText('rmm.resultFilter'));
    fireEvent.click(screen.getByTitle('rmm.status.succeeded'));
    expect(screen.getByText('Other device')).toBeDefined();
    expect(screen.queryByText('Device')).toBeNull();
    expect(screen.getByText('rmm.status.timeout 1')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'rmm.releaseDevice' })).toBeNull();
  });
});
