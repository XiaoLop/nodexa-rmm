import { FileOperationError, type FilePath } from './types';

const WINDOWS_DRIVE = /^[a-zA-Z]:/;

export function parseFilePath(value: string): FilePath {
  const normalized = normalizeFilePath(value);
  return {
    value: normalized,
    style: normalized === '' ? 'root' : WINDOWS_DRIVE.test(normalized) ? 'windows' : 'posix',
  };
}

export function normalizeFilePath(value: string): string {
  if (value.includes('\0')) {
    throw new FileOperationError('File path contains a null byte.', 'invalid-path');
  }

  const trimmed = value.trim();
  if (!trimmed) return '';

  if (WINDOWS_DRIVE.test(trimmed) || trimmed.includes('\\')) {
    const drive = WINDOWS_DRIVE.exec(trimmed)?.[0];
    const remainder = drive ? trimmed.slice(drive.length) : trimmed;
    const parts = collapsePathParts(
      remainder.split(/[\\/]+/),
      Boolean(drive) || trimmed.startsWith('\\'),
    );
    if (drive) return `${drive.toUpperCase()}\\${parts.join('\\')}`.replace(/\\$/, '\\');
    return `${trimmed.startsWith('\\') ? '\\' : ''}${parts.join('\\')}`;
  }

  const absolute = trimmed.startsWith('/');
  const parts = collapsePathParts(trimmed.split('/'), absolute);
  if (absolute) return parts.length === 0 ? '/' : `/${parts.join('/')}`;
  return parts.join('/');
}

export function joinFilePath(parent: string, child: string): string {
  if (!child || child === '.' || child === '..' || child.includes('/') || child.includes('\\')) {
    throw new FileOperationError('File name must be a single safe path segment.', 'invalid-path');
  }
  const normalizedParent = normalizeFilePath(parent);
  if (!normalizedParent) return child;
  const separator =
    WINDOWS_DRIVE.test(normalizedParent) || normalizedParent.includes('\\') ? '\\' : '/';
  return normalizedParent.endsWith(separator)
    ? `${normalizedParent}${child}`
    : `${normalizedParent}${separator}${child}`;
}

function collapsePathParts(parts: string[], absolute: boolean): string[] {
  const result: string[] = [];
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (result.length === 0) {
        if (absolute) continue;
        throw new FileOperationError(
          'Relative parent path segments are not allowed.',
          'invalid-path',
        );
      }
      result.pop();
      continue;
    }
    result.push(part);
  }
  return result;
}
