import { describe, expect, it } from 'vitest';
import { getDirectoryHierarchy, resolveTargetFilePath } from './fileSystem';
import {
  normalizeBatchUploadItem,
  validateRelativeFilePath,
  type BatchUploadFileItem,
} from './types';

describe('fileSystem and relative path helpers', () => {
  it('normalizes File and BatchUploadFileItem', () => {
    const file = new File(['hello'], 'demo.txt');
    const normalized1 = normalizeBatchUploadItem(file);
    expect(normalized1.relativePath).toBe('demo.txt');
    expect(normalized1.file).toBe(file);

    const customItem: BatchUploadFileItem = {
      file,
      relativePath: 'folder/sub/demo.txt',
    };
    const normalized2 = normalizeBatchUploadItem(customItem);
    expect(normalized2.relativePath).toBe('folder/sub/demo.txt');
  });

  it('validates relative paths correctly', () => {
    expect(validateRelativeFilePath('folder/sub/file.txt')).toBeUndefined();
    expect(validateRelativeFilePath('file.txt')).toBeUndefined();
    expect(validateRelativeFilePath('../secret.txt')).toBe('directoryTraversal');
    expect(validateRelativeFilePath('folder/../secret.txt')).toBe('directoryTraversal');
    expect(validateRelativeFilePath('folder/\0secret.txt')).toBe('fileNameNullByte');
    expect(validateRelativeFilePath('')).toBe('fileNameRequired');
  });

  it('resolves target file path for POSIX platforms', () => {
    const resolved = resolveTargetFilePath('/tmp', 'myproject/src/index.ts', 'linux');
    expect(resolved.targetDirectory).toBe('/tmp/myproject/src');
    expect(resolved.targetFileName).toBe('index.ts');

    const simple = resolveTargetFilePath('/tmp', 'single.txt', 'linux');
    expect(simple.targetDirectory).toBe('/tmp');
    expect(simple.targetFileName).toBe('single.txt');
  });

  it('resolves target file path for Windows platforms', () => {
    const resolved = resolveTargetFilePath('C:\\Temp', 'myproject/src/index.ts', 'windows');
    expect(resolved.targetDirectory).toBe('C:\\Temp\\myproject\\src');
    expect(resolved.targetFileName).toBe('index.ts');

    const withTrailing = resolveTargetFilePath('C:\\Temp\\', 'sub/app.exe', 'windows');
    expect(resolved.targetFileName).toBe('index.ts');
    expect(withTrailing.targetDirectory).toBe('C:\\Temp\\sub');
    expect(withTrailing.targetFileName).toBe('app.exe');
  });

  it('decomposes directory paths into hierarchy for mkdir -p', () => {
    // Windows paths
    expect(getDirectoryHierarchy('C:\\NotExist\\App\\sub', 'windows')).toEqual([
      'C:\\NotExist',
      'C:\\NotExist\\App',
      'C:\\NotExist\\App\\sub',
    ]);
    expect(getDirectoryHierarchy('C:\\', 'windows')).toEqual([]);
    expect(getDirectoryHierarchy('C:', 'windows')).toEqual([]);

    // POSIX paths
    expect(getDirectoryHierarchy('/opt/notexist/app/sub', 'linux')).toEqual([
      '/opt',
      '/opt/notexist',
      '/opt/notexist/app',
      '/opt/notexist/app/sub',
    ]);
    expect(getDirectoryHierarchy('/', 'linux')).toEqual([]);
    expect(getDirectoryHierarchy('', 'linux')).toEqual([]);
  });
});
