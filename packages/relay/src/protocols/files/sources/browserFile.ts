import type { UploadSource } from '../types';

export function browserFileSource(file: File): UploadSource {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    read: async (start, end) => file.slice(start, end),
  };
}
