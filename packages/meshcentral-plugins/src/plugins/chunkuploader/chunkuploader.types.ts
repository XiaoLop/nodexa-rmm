export interface UploadStatusQuery {
  fileHash: string;
  spaceId: string;
  fileName: string;
  fileSize: number;
  path?: string[];
}

export interface UploadStatusResult {
  success: boolean;
  fileHash: string;
  uploadedChunks: number[];
  chunkSize: number;
  isExisting: boolean;
}

export interface UploadChunkQuery {
  fileHash: string;
  chunkIndex: number;
  totalChunks: number;
}

export interface MergeChunksPayload {
  fileHash: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  spaceId: string;
  path?: string[];
}

export interface MergeChunksResult {
  success: boolean;
  fileName: string;
  fileSize: number;
  destinationPath: string;
}

export type ChunkUploadErrorCode =
  | 'UNAUTHENTICATED'
  | 'PERMISSION_DENIED'
  | 'INVALID_PARAMETERS'
  | 'INVALID_PATH'
  | 'CHUNKS_INCOMPLETE'
  | 'FILE_SIZE_MISMATCH'
  | 'INTERNAL_ERROR';

export interface ChunkUploadErrorResponse {
  success: false;
  errorCode: ChunkUploadErrorCode;
  message: string;
}
