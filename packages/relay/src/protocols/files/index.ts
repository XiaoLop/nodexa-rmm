import { RELAY_PROTOCOLS, type RelayProtocolDescriptor } from '../types';

export const filesRelayProtocol: RelayProtocolDescriptor = {
  protocol: RELAY_PROTOCOLS.files,
  name: 'files',
};

export { FilesSession } from './FilesSession';
export {
  createListDirectoryMessage,
  createUploadCancelMessage,
  createUploadDoneMessage,
  createUploadMessage,
  errorFromMessage,
  isDirectoryListMessage,
  messageIndicatesError,
  parseDirectoryListing,
  parseFilesProtocolText,
  type DirectoryListMessage,
  type FilesProtocolMessage,
} from './messages';
export { joinFilePath, normalizeFilePath, parseFilePath } from './path';
export { browserFileSource } from './sources';
export {
  FileOperationError,
  type DirectoryListing,
  type FileEntry,
  type FileEntryKind,
  type FileOperationErrorCode,
  type FileOperationOptions,
  type FileOperationState,
  type FilePath,
  type FileUploadProgress,
  type FileUploadResult,
  type FilesSessionOptions,
  type FilesSessionState,
  type ListDirectoryOptions,
  type UploadFileOptions,
  type UploadSource,
} from './types';
