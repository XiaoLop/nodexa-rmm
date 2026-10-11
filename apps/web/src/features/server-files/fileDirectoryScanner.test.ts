import { describe, expect, it } from 'vitest';
import {
  parseFilesFromInput,
  scanFilesFromDataTransfer,
} from './fileDirectoryScanner';

describe('fileDirectoryScanner', () => {
  it('parses flat files from simple input', () => {
    const file1 = new File(['1'], 'doc.pdf', { type: 'application/pdf' });
    const file2 = new File(['2'], 'image.png', { type: 'image/png' });
    const ignored = new File(['0'], '.DS_Store', { type: 'text/plain' });

    const results = parseFilesFromInput([file1, file2, ignored]);
    expect(results).toHaveLength(2);
    expect(results[0]?.relativePath).toBe('doc.pdf');
    expect(results[0]?.subPath).toEqual([]);
    expect(results[1]?.relativePath).toBe('image.png');
  });

  it('parses nested folder files with webkitRelativePath', () => {
    const file = new File(['code'], 'index.ts', { type: 'text/plain' });
    Object.defineProperty(file, 'webkitRelativePath', {
      value: 'my-project/src/index.ts',
    });

    const results = parseFilesFromInput([file]);
    expect(results).toHaveLength(1);
    expect(results[0]?.subPath).toEqual(['my-project', 'src']);
    expect(results[0]?.relativePath).toBe('my-project/src/index.ts');
  });

  it('scans mock directory tree from DataTransfer items recursively', async () => {
    const mockFileA = new File(['a'], 'a.txt', { type: 'text/plain' });
    const mockFileB = new File(['b'], 'b.txt', { type: 'text/plain' });

    // Mock FileSystemFileEntry
    const fileEntryA = {
      isFile: true,
      isDirectory: false,
      name: 'a.txt',
      file: (cb: (f: File) => void) => cb(mockFileA),
    };

    const fileEntryB = {
      isFile: true,
      isDirectory: false,
      name: 'b.txt',
      file: (cb: (f: File) => void) => cb(mockFileB),
    };

    // Mock FileSystemDirectoryEntry
    const subDirEntry = {
      isFile: false,
      isDirectory: true,
      name: 'sub',
      createReader: () => {
        let called = false;
        return {
          readEntries: (cb: (entries: unknown[]) => void) => {
            if (!called) {
              called = true;
              cb([fileEntryB]);
            } else {
              cb([]);
            }
          },
        };
      },
    };

    const rootDirEntry = {
      isFile: false,
      isDirectory: true,
      name: 'root',
      createReader: () => {
        let called = false;
        return {
          readEntries: (cb: (entries: unknown[]) => void) => {
            if (!called) {
              called = true;
              cb([fileEntryA, subDirEntry]);
            } else {
              cb([]);
            }
          },
        };
      },
    };

    const fakeDataTransfer = {
      items: [
        {
          webkitGetAsEntry: () => rootDirEntry,
        },
      ],
      files: [],
    } as unknown as DataTransfer;

    const { files, exceededMaxLimit } = await scanFilesFromDataTransfer(fakeDataTransfer);
    expect(exceededMaxLimit).toBe(false);
    expect(files).toHaveLength(2);

    const relPaths = files.map((f) => f.relativePath);
    expect(relPaths).toContain('root/a.txt');
    expect(relPaths).toContain('root/sub/b.txt');

    const subFile = files.find((f) => f.file.name === 'b.txt');
    expect(subFile?.subPath).toEqual(['root', 'sub']);
  });
});
