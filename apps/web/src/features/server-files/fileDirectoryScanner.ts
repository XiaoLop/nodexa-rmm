export interface StagedUploadFile {
  id: string;
  file: File;
  subPath: string[];
  relativePath: string;
}

const IGNORED_FILES = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);
const MAX_SCAN_FILES = 1000;

function isIgnored(fileName: string): boolean {
  return IGNORED_FILES.has(fileName.toLowerCase());
}

export function parseFilesFromInput(files: FileList | File[]): StagedUploadFile[] {
  const result: StagedUploadFile[] = [];
  const fileArray = Array.isArray(files) ? files : Array.from(files);

  for (const file of fileArray) {
    if (isIgnored(file.name)) continue;

    // input webkitdirectory 会在 file.webkitRelativePath 提供形如 "folder/sub/file.txt" 的路径
    if (file.webkitRelativePath) {
      const parts = file.webkitRelativePath.split('/').filter(Boolean);
      const subPath = parts.slice(0, -1);
      const relativePath = parts.join('/');
      result.push({
        id: `${relativePath}_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2, 6)}`,
        file,
        subPath,
        relativePath,
      });
    } else {
      result.push({
        id: `${file.name}_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2, 6)}`,
        file,
        subPath: [],
        relativePath: file.name,
      });
    }
  }

  return result;
}

interface DirectoryReaderLike {
  readEntries(
    successCallback: (entries: FileSystemEntryLike[]) => void,
    errorCallback?: (error: Error) => void,
  ): void;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
}

interface FileSystemFileEntryLike extends FileSystemEntryLike {
  file(successCallback: (file: File) => void, errorCallback?: (error: Error) => void): void;
}

interface FileSystemDirectoryEntryLike extends FileSystemEntryLike {
  createReader(): DirectoryReaderLike;
}

async function readDirectoryEntries(reader: DirectoryReaderLike): Promise<FileSystemEntryLike[]> {
  const allEntries: FileSystemEntryLike[] = [];

  while (true) {
    const batch = await new Promise<FileSystemEntryLike[]>((resolve, reject) => {
      reader.readEntries(
        (entries) => resolve(entries),
        (err) => reject(err),
      );
    });

    if (batch.length === 0) break;
    allEntries.push(...batch);
  }

  return allEntries;
}

async function readFileEntry(fileEntry: FileSystemFileEntryLike): Promise<File> {
  return new Promise<File>((resolve, reject) => {
    fileEntry.file(
      (file) => resolve(file),
      (err) => reject(err),
    );
  });
}

export async function scanFilesFromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<{ files: StagedUploadFile[]; exceededMaxLimit?: boolean }> {
  const items = dataTransfer.items;
  // 如果 items 不可用，回退至普通 files
  if (!items || items.length === 0) {
    return { files: parseFilesFromInput(dataTransfer.files) };
  }

  const result: StagedUploadFile[] = [];
  const queue: Array<{ entry: FileSystemEntryLike; path: string[] }> = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const entry =
      typeof item.webkitGetAsEntry === 'function'
        ? (item.webkitGetAsEntry() as FileSystemEntryLike | null)
        : null;

    if (entry) {
      queue.push({ entry, path: [] });
    } else {
      const file = item.getAsFile();
      if (file && !isIgnored(file.name)) {
        result.push({
          id: `${file.name}_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2, 6)}`,
          file,
          subPath: [],
          relativePath: file.name,
        });
      }
    }
  }

  let exceededMaxLimit = false;

  while (queue.length > 0) {
    if (result.length >= MAX_SCAN_FILES) {
      exceededMaxLimit = true;
      break;
    }

    const current = queue.shift();
    if (!current) break;

    const { entry, path } = current;

    if (isIgnored(entry.name)) continue;

    if (entry.isFile) {
      try {
        const file = await readFileEntry(entry as FileSystemFileEntryLike);
        if (!isIgnored(file.name)) {
          const relPath = [...path, file.name].join('/');
          result.push({
            id: `${relPath}_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2, 6)}`,
            file,
            subPath: path,
            relativePath: relPath,
          });
        }
      } catch {
        // 忽略无法读取的锁住的文件
      }
    } else if (entry.isDirectory) {
      try {
        const dirEntry = entry as FileSystemDirectoryEntryLike;
        const reader = dirEntry.createReader();
        const entries = await readDirectoryEntries(reader);
        const nextPath = [...path, dirEntry.name];
        for (const child of entries) {
          queue.push({ entry: child, path: nextPath });
        }
      } catch {
        // 忽略无法遍历的受保护目录
      }
    }
  }

  return { files: result, exceededMaxLimit };
}
