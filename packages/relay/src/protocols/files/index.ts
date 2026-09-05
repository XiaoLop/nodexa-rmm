import { RELAY_PROTOCOLS, type RelayProtocolDescriptor } from '../types';

export const filesRelayProtocol: RelayProtocolDescriptor = {
  protocol: RELAY_PROTOCOLS.files,
  name: 'files',
};

export { FilesSession } from './FilesSession';
export {
  createDownloadAckMessage,
  createDownloadStartAckMessage,
  createDownloadStartMessage,
  createDownloadStopMessage,
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
  type DownloadFileOptions,
  type DownloadSink,
  FileOperationError,
  type DirectoryListing,
  type FileDownloadProgress,
  type FileDownloadResult,
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
