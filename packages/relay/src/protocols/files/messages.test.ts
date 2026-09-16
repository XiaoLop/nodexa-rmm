import { describe, expect, it } from 'vitest';
import {
  createCopyFilesMessage,
  createDirectoryMessage,
  createMoveFilesMessage,
  createRemoveEntriesMessage,
  createRenameEntryMessage,
  createUnzipMessage,
  createZipMessage,
  parseFileDialogMessage,
  parseFilesProtocolText,
} from './messages';
import { normalizeFileName, parentFilePath } from './path';

describe('file protocol messages', () => {
  it('builds confirmed command payloads with only supported request identifiers', () => {
    expect(createDirectoryMessage('c:/test', '1')).toEqual({
      action: 'mkdir',
      reqid: '1',
      path: 'C:\\test',
    });
    expect(createRemoveEntriesMessage('C:', ['test', 'test'], true, '2')).toEqual({
      action: 'rm',
      reqid: '2',
      path: 'C:\\',
      delfiles: ['test'],
      rec: true,
    });
    expect(createRenameEntryMessage('/tmp', 'old.txt', 'new.txt')).toEqual({
      action: 'rename',
      path: '/tmp',
      oldname: 'old.txt',
      newname: 'new.txt',
    });
    expect(createCopyFilesMessage('C:', 'C:/dest', ['a.txt'], '3')).toEqual({
      action: 'copy',
      reqid: '3',
      scpath: 'C:\\',
      dspath: 'C:\\dest',
      names: ['a.txt'],
    });
    expect(createMoveFilesMessage('/tmp', '/dest', ['a.txt'], '4')).toEqual({
      action: 'move',
      reqid: '4',
      scpath: '/tmp',
      dspath: '/dest',
      names: ['a.txt'],
    });
    expect(createZipMessage('/tmp', ['folder', 'a.txt'], 'archive.zip')).toEqual({
      action: 'zip',
      path: '/tmp',
      files: ['folder', 'a.txt'],
      output: 'archive.zip',
    });
    expect(createUnzipMessage('C:/archive.zip', 'C:/archive')).toEqual({
      action: 'unzip',
      input: 'C:\\archive.zip',
      dest: 'C:\\archive',
    });
  });

  it('rejects unsafe names and empty arrays', () => {
    for (const name of ['', '.', '..', 'a/b', 'a\\b', `a\0b`]) {
      expect(() => normalizeFileName(name)).toThrow();
    }
    expect(() => createZipMessage('/tmp', [], 'archive.zip')).toThrow();
  });

  it('finds parents across relay, POSIX, and Windows roots', () => {
    expect(parentFilePath('')).toBeUndefined();
    expect(parentFilePath('/')).toBe('');
    expect(parentFilePath('/tmp/file')).toBe('/tmp');
    expect(parentFilePath('C:')).toBe('');
    expect(parentFilePath('C:/Temp/file')).toBe('C:\\Temp');
  });

  it('parses archive dialog messages without changing raw progress', () => {
    const message = parseFilesProtocolText(
      JSON.stringify({ action: 'dialogmessage', msg: 'zippingFile', file: 'a.txt', progress: 120 }),
    );
    expect(parseFileDialogMessage(message)).toEqual({
      type: 'zipping-file',
      file: 'a.txt',
      progress: 120,
      raw: { action: 'dialogmessage', msg: 'zippingFile', file: 'a.txt', progress: 120 },
    });
  });
});
