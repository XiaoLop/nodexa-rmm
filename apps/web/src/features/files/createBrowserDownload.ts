import type { DownloadSink } from '@meshcentral/relay';

interface FileSystemWritableFileStreamLike {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

interface FileSystemFileHandleLike {
  createWritable(): Promise<FileSystemWritableFileStreamLike>;
}

interface SaveFilePickerOptionsLike {
  suggestedName?: string;
}

type ShowSaveFilePicker = (
  options?: SaveFilePickerOptionsLike,
) => Promise<FileSystemFileHandleLike>;

declare global {
  interface Window {
    showSaveFilePicker?: ShowSaveFilePicker;
  }
}

export interface BrowserDownloadTarget {
  sink: DownloadSink;
  mode: 'stream' | 'blob';
}

export async function createBrowserDownload(
  fileName: string,
): Promise<BrowserDownloadTarget | undefined> {
  const showSaveFilePicker = window.showSaveFilePicker;
  if (showSaveFilePicker) {
    try {
      const handle = await showSaveFilePicker({ suggestedName: fileName });
      const writable = await handle.createWritable();
      return {
        mode: 'stream',
        sink: {
          write: (chunk) => writable.write(chunk),
          close: () => writable.close(),
          abort: (reason) => writable.abort(reason),
        },
      };
    } catch (error) {
      if (isAbortError(error)) return undefined;
      throw error;
    }
  }

  const chunks: BlobPart[] = [];
  let settled = false;
  return {
    mode: 'blob',
    sink: {
      write(chunk) {
        if (settled) throw new Error('Download target is already closed.');
        chunks.push(chunk.slice());
      },
      close() {
        if (settled) return;
        settled = true;
        const url = URL.createObjectURL(new Blob(chunks));
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        anchor.style.display = 'none';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      },
      abort() {
        settled = true;
        chunks.length = 0;
      },
    },
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}