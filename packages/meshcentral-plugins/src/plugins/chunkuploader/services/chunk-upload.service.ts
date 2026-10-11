import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  MeshCentralServer,
  MeshCentralUser,
} from '../../../types/meshcentral.types.js';
import type {
  MergeChunksPayload,
  MergeChunksResult,
  UploadStatusQuery,
  UploadStatusResult,
} from '../chunkuploader.types.js';

const SITERIGHT_SERVERFILES = 8;
const MESHRIGHT_SERVERFILES = 0x20;
const SITEADMIN_FULL = 0xffffffff;
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB

export class ChunkUploadService {
  constructor(private readonly meshServer: MeshCentralServer) {}

  public hasSpacePermission(user: MeshCentralUser, spaceId: string): boolean {
    if (!user || typeof user !== 'object') return false;
    const siteadmin = user.siteadmin ?? 0;
    if (siteadmin === SITEADMIN_FULL) return true;

    // Must have general server files permission
    if ((siteadmin & SITERIGHT_SERVERFILES) === 0) return false;

    if (spaceId.startsWith('user//')) {
      const targetUser = spaceId.slice(6);
      const currentUserId = user._id ?? '';
      const normalizedCurrent = currentUserId.startsWith('user//')
        ? currentUserId.slice(6)
        : currentUserId;
      return normalizedCurrent === targetUser || user.name === targetUser;
    }

    if (spaceId.startsWith('mesh//')) {
      const meshId = spaceId.slice(6);
      // Check user links or meshrights
      const linkRights = (user.links as Record<string, { rights?: number }> | undefined)?.[meshId]?.rights;
      if (typeof linkRights === 'number' && (linkRights & MESHRIGHT_SERVERFILES) !== 0) {
        return true;
      }
      const meshRights = (user.meshrights as Record<string, number> | undefined)?.[meshId];
      if (typeof meshRights === 'number' && (meshRights & MESHRIGHT_SERVERFILES) !== 0) {
        return true;
      }
      return false;
    }

    return false;
  }

  public sanitizeSegment(segment: string): string {
    if (!segment || typeof segment !== 'string') return '';
    if (segment.includes('..') || segment.includes('/') || segment.includes('\\')) {
      throw new Error('PATH_TRAVERSAL_DETECTED');
    }
    // Strip control characters and invalid filename characters
    const sanitized = segment.replace(/[\0\r\n\t]/g, '').trim();
    if (!sanitized) throw new Error('PATH_TRAVERSAL_DETECTED');
    return sanitized;
  }

  public sanitizeFileHash(hash: string): string {
    if (!hash || typeof hash !== 'string') {
      throw new Error('INVALID_HASH');
    }
    // Only allow alphanumeric characters, dash and underscore
    const sanitized = hash.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) throw new Error('INVALID_HASH');
    return sanitized;
  }

  public getStorageRoot(domainId = ''): string {
    const configSettings = this.meshServer.config?.settings;
    const configuredPath =
      (configSettings?.filesPath as string | undefined) ??
      (this.meshServer['filespath'] as string | undefined) ??
      path.join(process.cwd(), 'meshcentral-files');

    const cleanDomain = this.sanitizeSegment(domainId);
    const domainFolder = cleanDomain ? `domain-${cleanDomain}` : 'domain';
    return path.join(configuredPath, domainFolder);
  }

  public getTempRoot(): string {
    const dataPath =
      (this.meshServer.datapath as string | undefined) ??
      path.join(process.cwd(), 'meshcentral-data');
    return path.join(dataPath, 'temp', 'chunkuploader');
  }

  public resolveSpaceDirectory(domainId: string, spaceId: string, relativePath: string[] = []): string {
    const storageRoot = this.getStorageRoot(domainId);
    let spaceFolder: string;

    const parts = spaceId.split('/').filter(Boolean);
    const spaceKind = parts[0];
    const spaceKey = parts[parts.length - 1];

    if (spaceKind === 'user' && spaceKey) {
      spaceFolder = `user-${this.sanitizeSegment(spaceKey)}`;
    } else if (spaceKind === 'mesh' && spaceKey) {
      spaceFolder = `mesh-${this.sanitizeSegment(spaceKey)}`;
    } else {
      throw new Error('INVALID_SPACE');
    }

    const safeParts = relativePath
      .map((part) => this.sanitizeSegment(part))
      .filter((part) => part.length > 0);

    const resolved = path.resolve(storageRoot, spaceFolder, ...safeParts);
    const spaceBase = path.resolve(storageRoot, spaceFolder);

    // Verify no traversal outside the space folder
    if (!resolved.startsWith(spaceBase)) {
      throw new Error('PATH_TRAVERSAL_DETECTED');
    }

    return resolved;
  }

  public resolveTempDirectory(fileHash: string): string {
    const safeHash = this.sanitizeFileHash(fileHash);
    const tempRoot = this.getTempRoot();
    return path.resolve(tempRoot, safeHash);
  }

  public async getUploadStatus(domainId: string, query: UploadStatusQuery): Promise<UploadStatusResult> {
    const safeHash = this.sanitizeFileHash(query.fileHash);
    const safeName = this.sanitizeSegment(query.fileName);
    const targetDir = this.resolveSpaceDirectory(domainId, query.spaceId, query.path);
    const targetFile = path.join(targetDir, safeName);

    // Check if target file already exists
    let isExisting = false;
    try {
      const stat = await fs.stat(targetFile);
      if (stat.isFile() && stat.size === query.fileSize) {
        isExisting = true;
      }
    } catch {
      // File does not exist yet
    }

    if (isExisting) {
      return {
        success: true,
        fileHash: safeHash,
        uploadedChunks: [],
        chunkSize: DEFAULT_CHUNK_SIZE,
        isExisting: true,
      };
    }

    // Inspect chunks in temp directory
    const tempDir = this.resolveTempDirectory(safeHash);
    const uploadedChunks: number[] = [];

    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        const match = /^chunk_(\d+)$/.exec(file);
        if (match && typeof match[1] === 'string') {
          uploadedChunks.push(parseInt(match[1], 10));
        }
      }
      uploadedChunks.sort((a, b) => a - b);
    } catch {
      // Temp directory does not exist yet
    }

    return {
      success: true,
      fileHash: safeHash,
      uploadedChunks,
      chunkSize: DEFAULT_CHUNK_SIZE,
      isExisting: false,
    };
  }

  public async saveChunk(
    fileHash: string,
    chunkIndex: number,
    data: Buffer,
  ): Promise<void> {
    const safeHash = this.sanitizeFileHash(fileHash);
    if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
      throw new Error('INVALID_CHUNK_INDEX');
    }

    const tempDir = this.resolveTempDirectory(safeHash);
    await fs.mkdir(tempDir, { recursive: true });

    const chunkPath = path.join(tempDir, `chunk_${chunkIndex}`);
    await fs.writeFile(chunkPath, data);
  }

  public async mergeChunks(
    domainId: string,
    payload: MergeChunksPayload,
  ): Promise<MergeChunksResult> {
    const safeHash = this.sanitizeFileHash(payload.fileHash);
    const safeName = this.sanitizeSegment(payload.fileName);
    if (!safeName) throw new Error('INVALID_FILE_NAME');
    if (!payload.totalChunks || payload.totalChunks <= 0) {
      throw new Error('INVALID_TOTAL_CHUNKS');
    }

    const tempDir = this.resolveTempDirectory(safeHash);

    // Verify all chunks exist
    for (let index = 0; index < payload.totalChunks; index++) {
      const chunkPath = path.join(tempDir, `chunk_${index}`);
      try {
        await fs.access(chunkPath);
      } catch {
        throw new Error(`CHUNK_MISSING_${index}`);
      }
    }

    const targetDir = this.resolveSpaceDirectory(domainId, payload.spaceId, payload.path);
    await fs.mkdir(targetDir, { recursive: true });

    const finalFilePath = path.join(targetDir, safeName);
    const tempMergedPath = path.join(targetDir, `.${safeName}.${safeHash}.tmp`);

    // Stream chunks sequentially into target file
    const writeStream = createWriteStream(tempMergedPath, { flags: 'w' });
    try {
      for (let index = 0; index < payload.totalChunks; index++) {
        const chunkPath = path.join(tempDir, `chunk_${index}`);
        const readStream = createReadStream(chunkPath);
        for await (const chunk of readStream) {
          if (!writeStream.write(chunk)) {
            await new Promise((resolve) => writeStream.once('drain', resolve));
          }
        }
      }
    } finally {
      writeStream.end();
      await new Promise<void>((resolve, reject) => {
        writeStream.once('finish', () => resolve());
        writeStream.once('error', (err) => reject(err));
      });
    }

    // Verify merged file size if provided
    const stat = await fs.stat(tempMergedPath);
    if (payload.fileSize > 0 && stat.size !== payload.fileSize) {
      await fs.unlink(tempMergedPath).catch(() => {});
      throw new Error('FILE_SIZE_MISMATCH');
    }

    // Atomic move into final position
    await fs.rename(tempMergedPath, finalFilePath);

    // Clean up temporary chunks
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});

    return {
      success: true,
      fileName: safeName,
      fileSize: stat.size,
      destinationPath: finalFilePath,
    };
  }

  public notifyFileTreeUpdate(
    user: MeshCentralUser,
    spaceId = '',
  ): void {
    if (!this.meshServer.DispatchEvent) return;

    let targets: string[] = [];
    if (spaceId.startsWith('mesh//') || spaceId.startsWith('mesh/')) {
      const parts = spaceId.split('/').filter(Boolean);
      const meshId = parts[parts.length - 1] ?? '';
      const createTargets =
        this.meshServer.webserver?.CreateMeshDispatchTargets ??
        (this.meshServer['CreateMeshDispatchTargets'] as ((meshId: string) => string[]) | undefined);
      if (createTargets) {
        targets = createTargets(meshId);
      } else {
        targets = [`mesh/${meshId}`];
      }
    } else {
      const userId = user._id ?? (user.name ? `user//${user.name}` : '');
      if (userId) targets = [userId];
    }

    if (targets.length === 0) return;

    // MeshCentral 的 HandleEvent 精确匹配纯字符串 'updatefiles'，从而触发 updateUserFiles 重新扫描磁盘并广播
    this.meshServer.DispatchEvent(targets, this, 'updatefiles');
  }

  public async cleanExpiredTempChunks(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
    const tempRoot = this.getTempRoot();
    let cleanedCount = 0;
    try {
      const entries = await fs.readdir(tempRoot, { withFileTypes: true });
      const now = Date.now();
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const entryPath = path.join(tempRoot, entry.name);
        try {
          const stat = await fs.stat(entryPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            await fs.rm(entryPath, { recursive: true, force: true });
            cleanedCount++;
          }
        } catch {
          // ignore stat/rm failure on single entry
        }
      }
    } catch {
      // temp root does not exist
    }
    return cleanedCount;
  }
}
