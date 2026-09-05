// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBrowserDownload } from './createBrowserDownload';

afterEach(() => {
  delete window.showSaveFilePicker;
  vi.restoreAllMocks();
});

describe('createBrowserDownload', () => {
  it('streams chunks through the File System Access API', async () => {
    const writable = {
      write: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      abort: vi.fn().mockResolvedValue(undefined),
    };
    window.showSaveFilePicker = vi.fn().mockResolvedValue({
      createWritable: vi.fn().mockResolvedValue(writable),
    });

    const target = await createBrowserDownload('demo.bin');

    expect(target?.mode).toBe('stream');
    await target?.sink.write(new Uint8Array([1, 2]));
    await target?.sink.close();
    expect(window.showSaveFilePicker).toHaveBeenCalledWith({ suggestedName: 'demo.bin' });
    expect(writable.write).toHaveBeenCalledWith(new Uint8Array([1, 2]));
    expect(writable.close).toHaveBeenCalledOnce();
  });

  it('returns undefined when the save picker is cancelled', async () => {
    window.showSaveFilePicker = vi
      .fn()
      .mockRejectedValue(new DOMException('Cancelled', 'AbortError'));

    await expect(createBrowserDownload('demo.bin')).resolves.toBeUndefined();
  });

  it('falls back to a Blob download and releases its object URL', async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:download');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const target = await createBrowserDownload('demo.bin');
    await target?.sink.write(new Uint8Array([1, 2, 3]));
    await target?.sink.close();

    expect(target?.mode).toBe('blob');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    await vi.runAllTimersAsync();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:download');
    vi.useRealTimers();
  });
});