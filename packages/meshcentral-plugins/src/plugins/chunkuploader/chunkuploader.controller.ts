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
    const jsonParser = webServer.bodyParser?.json?.({ limit: '10mb' });
    const postJsonHandlers = jsonParser ? [jsonParser] : [];

    // 1. 状态查询：支持 GET (优先读取 req.query，不受任何 body-parser 影响) 与 POST (兼容)
    webServer.app.get(
      '/chunkuploader/status',
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => this.handleStatus(req, res),
    );

    webServer.app.post(
      '/chunkuploader/status',
      ...postJsonHandlers,
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => this.handleStatus(req, res),
    );

    // 2. 切片上传：POST 二进制流
    webServer.app.post(
      '/chunkuploader/chunk',
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => this.handleUploadChunk(req, res),
    );

    // 3. 切片合并：POST 挂载 jsonParser，并由 Controller 流式兜底
    webServer.app.post(
      '/chunkuploader/merge',
      ...postJsonHandlers,
      (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => this.handleMerge(req, res),
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

  private async readRequestBodyJson<T>(req: MeshCentralHttpRequest): Promise<Partial<T>> {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body as Partial<T>;
    }
    try {
      const buffer = await this.readRequestBodyBuffer(req);
      if (buffer.length === 0) return {};
      const text = buffer.toString('utf-8');
      return JSON.parse(text) as Partial<T>;
    } catch {
      return {};
    }
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

    const query = (req.query ?? {}) as Record<string, unknown>;
    const body = await this.readRequestBodyJson<UploadStatusQuery>(req);

    const fileHash = (query.fileHash ?? body.fileHash) as string | undefined;
    const spaceId = (query.spaceId ?? body.spaceId) as string | undefined;
    const fileName = (query.fileName ?? body.fileName) as string | undefined;
    const fileSizeRaw = query.fileSize ?? body.fileSize;
    const fileSize = typeof fileSizeRaw === 'number' ? fileSizeRaw : Number(fileSizeRaw);

    let pathSegments: string[] = [];
    if (Array.isArray(body.path)) {
      pathSegments = body.path;
    } else if (typeof query.path === 'string') {
      pathSegments = query.path.split('/').filter(Boolean);
    }

    if (!fileHash || !spaceId || !fileName || Number.isNaN(fileSize)) {
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
        path: pathSegments,
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

    const body = await this.readRequestBodyJson<MergeChunksPayload>(req);
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

      this.service.notifyFileTreeUpdate(user, spaceId);
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
