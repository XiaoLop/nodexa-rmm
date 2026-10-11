import type { BatchUploadFileItem } from './types';

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

interface FileSystemFileEntryLike extends FileSystemEntryLike {
  isFile: true;
  isDirectory: false;
  file: (successCallback: (file: File) => void, errorCallback?: (error: DOMException) => void) => void;
}

interface FileSystemDirectoryReaderLike {
  readEntries: (
    successCallback: (entries: FileSystemEntryLike[]) => void,
    errorCallback?: (error: DOMException) => void,
  ) => void;
}

interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
  isFile: false;
  isDirectory: true;
  createReader: () => FileSystemDirectoryReaderLike;
}

async function readFileEntry(fileEntry: FileSystemFileEntryLike): Promise<File> {
  return new Promise<File>((resolve, reject) => {
    fileEntry.file(resolve, (err) => reject(err || new Error('Failed to read file entry')));
  });
}

async function readDirectoryEntries(dirEntry: FileSystemDirectoryEntryLike): Promise<FileSystemEntryLike[]> {
  const reader = dirEntry.createReader();
  const allEntries: FileSystemEntryLike[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(resolve, (err) => reject(err || new Error('Failed to read directory entries')));
    });
    if (!batch || batch.length === 0) break;
    allEntries.push(...batch);
  }

  return allEntries;
}

async function traverseFileSystemEntry(
  entry: FileSystemEntryLike,
  pathPrefix = '',
): Promise<BatchUploadFileItem[]> {
  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntryLike);
    const relativePath = pathPrefix ? `${pathPrefix}/${file.name}` : file.name;
    return [{ file, relativePath }];
  }

  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntryLike;
    const currentPrefix = pathPrefix ? `${pathPrefix}/${dirEntry.name}` : dirEntry.name;
    const children = await readDirectoryEntries(dirEntry);
    const results: BatchUploadFileItem[] = [];
    for (const child of children) {
      const subItems = await traverseFileSystemEntry(child, currentPrefix);
      results.push(...subItems);
    }
    return results;
  }

  return [];
}

/**
 * Extracts all files with their relative paths from a drag-and-drop DataTransfer event.
 * Preserves folder hierarchy using webkitGetAsEntry when available,
 * and falls back to standard DataTransfer.files.
 */
export async function extractFilesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<BatchUploadFileItem[]> {
  const items = dataTransfer.items;
  if (!items || items.length === 0) {
    return Array.from(dataTransfer.files ?? []).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    }));
  }

  const entriesToProcess: FileSystemEntryLike[] = [];
  let hasValidEntry = false;

  for (const item of Array.from(items)) {
    if (item.kind === 'file') {
      const entry = (item as unknown as { webkitGetAsEntry?: () => FileSystemEntryLike | null }).webkitGetAsEntry?.();
      if (entry) {
        entriesToProcess.push(entry);
        hasValidEntry = true;
      }
    }
  }

  if (hasValidEntry) {
    const allResults: BatchUploadFileItem[] = [];
    for (const entry of entriesToProcess) {
      const entryFiles = await traverseFileSystemEntry(entry);
      allResults.push(...entryFiles);
    }
    return allResults;
  }

  return Array.from(dataTransfer.files ?? []).map((file) => ({
    file,
    relativePath: file.webkitRelativePath || file.name,
  }));
}

/**
 * Resolves the destination directory and target file name for a given device platform.
 */
export function resolveTargetFilePath(
  baseTargetDirectory: string,
  relativePath: string,
  platform?: string,
): { targetDirectory: string; targetFileName: string } {
  const isWindows =
    Boolean(platform?.toLowerCase().includes('windows')) ||
    /^[a-zA-Z]:/.test(baseTargetDirectory) ||
    baseTargetDirectory.includes('\\');

  const sep = isWindows ? '\\' : '/';
  const cleanRelative = relativePath.replace(/^[\\/]+/, '').replace(/\\/g, '/');
  const parts = cleanRelative.split('/').filter(Boolean);

  if (parts.length <= 1) {
    return {
      targetDirectory: baseTargetDirectory.trim(),
      targetFileName: parts[0] ?? relativePath,
    };
  }

  const fileName = parts[parts.length - 1];
  const subDirs = parts.slice(0, -1);
  const normalizedBase = baseTargetDirectory.trim();

  let targetDir = normalizedBase;
  for (const dir of subDirs) {
    if (targetDir.endsWith(sep) || (isWindows && targetDir.endsWith('/'))) {
      targetDir = `${targetDir}${dir}`;
    } else {
      targetDir = `${targetDir}${sep}${dir}`;
    }
  }

  const firstPart = parts[0];
  const targetFileName = fileName ?? firstPart ?? relativePath;

  return {
    targetDirectory: targetDir,
    targetFileName,
  };
}

/**
 * Decomposes a target directory path into an array of hierarchical parent directories
 * from shallowest to deepest, excluding the drive or filesystem root.
 * Used for recursive directory creation ("mkdir -p") on remote agents.
 */
export function getDirectoryHierarchy(
  directoryPath: string,
  platform?: string,
): string[] {
  const trimmed = directoryPath.trim();
  if (!trimmed) return [];

  const isWindows =
    Boolean(platform?.toLowerCase().includes('windows')) ||
    /^[a-zA-Z]:/.test(trimmed) ||
    trimmed.includes('\\');

  if (isWindows) {
    const driveMatch = /^[a-zA-Z]:/.exec(trimmed);
    const drive = driveMatch ? driveMatch[0].toUpperCase() : '';
    const remainder = drive ? trimmed.slice(drive.length) : trimmed;
    const parts = remainder.split(/[\\/]+/).filter(Boolean);

    if (parts.length === 0) return [];

    const results: string[] = [];
    let current = drive ? `${drive}\\` : (trimmed.startsWith('\\') ? '\\' : '');

    for (const part of parts) {
      if (current.endsWith('\\')) {
        current = `${current}${part}`;
      } else {
        current = current ? `${current}\\${part}` : part;
      }
      results.push(current);
    }
    return results;
  } else {
    const isAbsolute = trimmed.startsWith('/');
    const parts = trimmed.split(/[\\/]+/).filter(Boolean);

    if (parts.length === 0) return [];

    const results: string[] = [];
    let current = isAbsolute ? '' : '';

    for (const part of parts) {
      current = isAbsolute ? `${current}/${part}` : (current ? `${current}/${part}` : part);
      results.push(current);
    }
    return results;
  }
}

