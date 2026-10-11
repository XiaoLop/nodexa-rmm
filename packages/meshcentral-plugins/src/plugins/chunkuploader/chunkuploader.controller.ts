import type {
  MeshCentralHttpRequest,
  MeshCentralHttpResponse,
  MeshCentralServer,
  MeshCentralUser,
  MeshCentralWebServer,
} from '../../types/meshcentral.types.js';
import type {
  MergeChunksPayload,
  UploadStatusQuery,
} from './chunkuploader.types.js';
import type { ChunkUploadService } from './services/chunk-upload.service.js';

export class ChunkUploadController {
  constructor(
    private readonly service: ChunkUploadService,
    private readonly meshServer: MeshCentralServer,
  ) {}

  public register(webServer: MeshCentralWebServer): void {
    webServer.app.post(
      '/plugin/chunkuploader/status',
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => {
        void this.handleStatus(req, res);
      },
    );

    webServer.app.post(
      '/plugin/chunkuploader/chunk',
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => {
        void this.handleUploadChunk(req, res);
      },
    );

    webServer.app.post(
      '/plugin/chunkuploader/merge',
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => {
        void this.handleMerge(req, res);
      },
    );
  }

  private authenticateUser(req: MeshCentralHttpRequest): MeshCentralUser | null {
    const userId = req.session?.userid;
    if (!userId || typeof userId !== 'string') return null;

    const user = this.meshServer.webserver?.users?.[userId] ?? {
      _id: userId,
      siteadmin: 0,
    };
    return user;
  }

  private getDomainId(req: MeshCentralHttpRequest): string {
    return (req.xdomain?.id ?? req.session?.domain ?? '') as string;
  }

  private async readRequestBodyBuffer(req: MeshCentralHttpRequest): Promise<Buffer> {
    if (Buffer.isBuffer(req.body)) {
      return req.body;
    }
    if (typeof req.body === 'string') {
      return Buffer.from(req.body);
    }
    return new Promise((resolve, reject) => {
      const stream = req as unknown as NodeJS.ReadableStream;
      if (typeof stream?.on !== 'function') {
        resolve(Buffer.alloc(0));
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer | string) => {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(err));
    });
  }

  public async handleStatus(
    req: MeshCentralHttpRequest,
    res: MeshCentralHttpResponse,
  ): Promise<void> {
    const user = this.authenticateUser(req);
    if (!user) {
      res.status(401).json({
        success: false,
        errorCode: 'UNAUTHENTICATED',
        message: 'Valid session required',
      });
      return;
    }

    const body = (req.body ?? {}) as Partial<UploadStatusQuery>;
    const fileHash = body.fileHash;
    const spaceId = body.spaceId;
    const fileName = body.fileName;
    const fileSize = body.fileSize;

    if (!fileHash || !spaceId || !fileName || typeof fileSize !== 'number') {
      res.status(400).json({
        success: false,
        errorCode: 'INVALID_PARAMETERS',
        message: 'Missing fileHash, spaceId, fileName or fileSize',
      });
      return;
    }

    if (!this.service.hasSpacePermission(user, spaceId)) {
      res.status(403).json({
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: 'Access denied for the requested space',
      });
      return;
    }

    try {
      const domainId = this.getDomainId(req);
      const result = await this.service.getUploadStatus(domainId, {
        fileHash,
        spaceId,
        fileName,
        fileSize,
        path: Array.isArray(body.path) ? body.path : [],
      });
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        message,
      });
    }
  }

  public async handleUploadChunk(
    req: MeshCentralHttpRequest,
    res: MeshCentralHttpResponse,
  ): Promise<void> {
    const user = this.authenticateUser(req);
    if (!user) {
      res.status(401).json({
        success: false,
        errorCode: 'UNAUTHENTICATED',
        message: 'Valid session required',
      });
      return;
    }

    const query = req.query ?? {};
    const headerHash = req.headers['x-file-hash'];
    const headerChunkIndex = req.headers['x-chunk-index'];
    const headerSpaceId = req.headers['x-space-id'];

    const fileHash = (query['fileHash'] ?? headerHash) as string;
    const chunkIndexStr = (query['chunkIndex'] ?? headerChunkIndex) as string;
    const spaceId = (query['spaceId'] ?? headerSpaceId) as string | undefined;

    const chunkIndex = parseInt(chunkIndexStr, 10);

    if (!fileHash || Number.isNaN(chunkIndex)) {
      res.status(400).json({
        success: false,
        errorCode: 'INVALID_PARAMETERS',
        message: 'Missing fileHash or chunkIndex',
      });
      return;
    }

    if (spaceId && !this.service.hasSpacePermission(user, spaceId)) {
      res.status(403).json({
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: 'Access denied for the requested space',
      });
      return;
    }

    try {
      const buffer = await this.readRequestBodyBuffer(req);
      if (buffer.length === 0) {
        res.status(400).json({
          success: false,
          errorCode: 'INVALID_PARAMETERS',
          message: 'Empty chunk data received',
        });
        return;
      }

      await this.service.saveChunk(fileHash, chunkIndex, buffer);
      res.json({ success: true, chunkIndex });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_ERROR',
        message,
      });
    }
  }

  public async handleMerge(
    req: MeshCentralHttpRequest,
    res: MeshCentralHttpResponse,
  ): Promise<void> {
    const user = this.authenticateUser(req);
    if (!user) {
      res.status(401).json({
        success: false,
        errorCode: 'UNAUTHENTICATED',
        message: 'Valid session required',
      });
      return;
    }

    const body = (req.body ?? {}) as Partial<MergeChunksPayload>;
    const { fileHash, fileName, fileSize, totalChunks, spaceId } = body;

    if (
      !fileHash ||
      !fileName ||
      !spaceId ||
      typeof fileSize !== 'number' ||
      typeof totalChunks !== 'number'
    ) {
      res.status(400).json({
        success: false,
        errorCode: 'INVALID_PARAMETERS',
        message: 'Missing required merge parameters',
      });
      return;
    }

    if (!this.service.hasSpacePermission(user, spaceId)) {
      res.status(403).json({
        success: false,
        errorCode: 'PERMISSION_DENIED',
        message: 'Access denied for the requested space',
      });
      return;
    }

    try {
      const domainId = this.getDomainId(req);
      const result = await this.service.mergeChunks(domainId, {
        fileHash,
        fileName,
        fileSize,
        totalChunks,
        spaceId,
        path: Array.isArray(body.path) ? body.path : [],
      });

      this.service.notifyFileTreeUpdate(user, domainId, spaceId);
      res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const isExpected =
        message.startsWith('CHUNK_MISSING') ||
        message === 'FILE_SIZE_MISMATCH' ||
        message === 'PATH_TRAVERSAL_DETECTED';

      res.status(isExpected ? 400 : 500).json({
        success: false,
        errorCode: isExpected ? 'CHUNKS_INCOMPLETE' : 'INTERNAL_ERROR',
        message,
      });
    }
  }
}
