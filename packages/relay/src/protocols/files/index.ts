import { RELAY_PROTOCOLS, type RelayProtocolDescriptor } from '../types';

export const filesRelayProtocol: RelayProtocolDescriptor = {
  protocol: RELAY_PROTOCOLS.files,
  name: 'files',
};

export { FilesSession } from './FilesSession';
export {
  createCopyFilesMessage,
  createDirectoryMessage,
  createDownloadAckMessage,
  createDownloadStartAckMessage,
  createDownloadStartMessage,
  createDownloadStopMessage,
  createListDirectoryMessage,
  createMoveFilesMessage,
  createRemoveEntriesMessage,
  createRenameEntryMessage,
  createUnzipMessage,
  createUploadCancelMessage,
  createUploadDoneMessage,
  createUploadMessage,
  createZipMessage,
  errorFromMessage,
  isDirectoryListMessage,
  isFileRefreshMessage,
  messageIndicatesError,
  parseDirectoryListing,
  parseFileDialogMessage,
  parseFilesProtocolText,
  type DirectoryListMessage,
  type FilesProtocolMessage,
} from './messages';
export {
  joinFilePath,
  normalizeFileName,
  normalizeFilePath,
  parentFilePath,
  parseFilePath,
} from './path';
export { browserFileSource } from './sources';
export {
  type DownloadFileOptions,
  type DownloadSink,
  FileOperationError,
  type DirectoryListing,
  type FileCommandReceipt,
  type FileDialogMessage,
  type FileDialogMessageType,
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
  type RemoveEntriesOptions,
  type UploadFileOptions,
  type UploadSource,
} from './types';
