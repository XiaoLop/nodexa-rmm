import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MeshCentralHttpRequest,
  MeshCentralHttpResponse,
  MeshCentralPluginHandler,
  MeshCentralServer,
  MeshCentralUser,
  MeshCentralWebServer,
} from '../../types/meshcentral.types.js';
import { chunkuploader } from './index.js';
import { ChunkUploadService } from './services/chunk-upload.service.js';

describe('chunkuploader plugin', () => {
  const testDir = path.join(process.cwd(), 'temp-test-chunkuploader');
  const filesPath = path.join(testDir, 'files');
  const dataPath = path.join(testDir, 'data');

  const regularUser: MeshCentralUser = {
    _id: 'user//alice',
    name: 'alice',
    siteadmin: 8, // SITERIGHT_SERVERFILES
    links: {
      group1: { rights: 0x20 }, // MESHRIGHT_SERVERFILES
    },
  };

  const restrictedUser: MeshCentralUser = {
    _id: 'user//bob',
    name: 'bob',
    siteadmin: 0,
  };

  const adminUser: MeshCentralUser = {
    _id: 'user//admin',
    name: 'admin',
    siteadmin: 0xffffffff,
  };

  const mockServer: MeshCentralServer = {
    config: { settings: { filesPath } },
    datapath: dataPath,
    DispatchEvent: vi.fn(),
    webserver: {
      users: {
        'user//alice': regularUser,
        'user//bob': restrictedUser,
        'user//admin': adminUser,
      },
      app: {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        use: vi.fn(),
      },
    } as unknown as MeshCentralWebServer,
  };

  beforeEach(async () => {
    await fs.mkdir(filesPath, { recursive: true });
    await fs.mkdir(dataPath, { recursive: true });
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  describe('Plugin Factory and Lifecycle', () => {
    it('creates plugin with expected hooks', () => {
      const plugin = chunkuploader({ parent: mockServer } as MeshCentralPluginHandler);
      expect(plugin).toBeDefined();
      expect(typeof plugin.server_startup).toBe('function');
      expect(typeof plugin.hook_setupHttpHandlers).toBe('function');
    });

    it('registers HTTP routes on setupHttpHandlers', () => {
      const plugin = chunkuploader({ parent: mockServer } as MeshCentralPluginHandler);
      const postRoutes: string[] = [];
      const app = {
        post: vi.fn((route: string) => postRoutes.push(route)),
      };
      plugin.hook_setupHttpHandlers?.(
        { app } as unknown as MeshCentralWebServer,
        mockServer,
      );

      expect(postRoutes).toContain('/plugin/chunkuploader/status');
      expect(postRoutes).toContain('/plugin/chunkuploader/chunk');
      expect(postRoutes).toContain('/plugin/chunkuploader/merge');
    });
  });

  describe('Permission & Path Security', () => {
    const service = new ChunkUploadService(mockServer);

    it('validates user permissions correctly', () => {
      expect(service.hasSpacePermission(regularUser, 'user//alice')).toBe(true);
      expect(service.hasSpacePermission(regularUser, 'user//bob')).toBe(false);
      expect(service.hasSpacePermission(regularUser, 'mesh//group1')).toBe(true);
      expect(service.hasSpacePermission(regularUser, 'mesh//group2')).toBe(false);

      expect(service.hasSpacePermission(restrictedUser, 'user//bob')).toBe(false); // siteadmin = 0
      expect(service.hasSpacePermission(adminUser, 'user//bob')).toBe(true); // full admin
      expect(service.hasSpacePermission(adminUser, 'mesh//any')).toBe(true);
    });

    it('detects and blocks path traversal', () => {
      expect(() =>
        service.resolveSpaceDirectory('', 'user//alice', ['..', 'secret']),
      ).toThrow();

      expect(() =>
        service.resolveSpaceDirectory('', 'user//alice', ['valid', '../../etc']),
      ).toThrow();
    });
  });

  describe('Chunk Save, Query and Streaming Merge', () => {
    const service = new ChunkUploadService(mockServer);

    it('saves chunks and performs streaming merge into destination file', async () => {
      const fileHash = 'test-hash-12345';
      const chunk0 = Buffer.from('Hello, ');
      const chunk1 = Buffer.from('world! This is a ');
      const chunk2 = Buffer.from('chunked file upload test.');
      const expectedTotal = Buffer.concat([chunk0, chunk1, chunk2]);

      // 1. Initial status - no chunks
      const initialStatus = await service.getUploadStatus('', {
        fileHash,
        fileName: 'sample.txt',
        fileSize: expectedTotal.length,
        spaceId: 'user//alice',
      });
      expect(initialStatus.isExisting).toBe(false);
      expect(initialStatus.uploadedChunks).toEqual([]);

      // 2. Save chunks
      await service.saveChunk(fileHash, 0, chunk0);
      await service.saveChunk(fileHash, 1, chunk1);
      await service.saveChunk(fileHash, 2, chunk2);

      // 3. Query status - all 3 chunks present
      const midStatus = await service.getUploadStatus('', {
        fileHash,
        fileName: 'sample.txt',
        fileSize: expectedTotal.length,
        spaceId: 'user//alice',
      });
      expect(midStatus.uploadedChunks).toEqual([0, 1, 2]);

      // 4. Merge chunks
      const mergeResult = await service.mergeChunks('', {
        fileHash,
        fileName: 'sample.txt',
        fileSize: expectedTotal.length,
        totalChunks: 3,
        spaceId: 'user//alice',
      });

      expect(mergeResult.success).toBe(true);
      expect(mergeResult.fileName).toBe('sample.txt');
      expect(mergeResult.fileSize).toBe(expectedTotal.length);

      // Verify merged content on disk
      const content = await fs.readFile(mergeResult.destinationPath);
      expect(content.equals(expectedTotal)).toBe(true);

      // Verify temp chunks are cleaned
      const afterStatus = await service.getUploadStatus('', {
        fileHash,
        fileName: 'sample.txt',
        fileSize: expectedTotal.length,
        spaceId: 'user//alice',
      });
      expect(afterStatus.isExisting).toBe(true);
    });

    it('rejects merge when chunks are missing', async () => {
      const fileHash = 'incomplete-hash-888';
      await service.saveChunk(fileHash, 0, Buffer.from('chunk 0'));

      await expect(
        service.mergeChunks('', {
          fileHash,
          fileName: 'incomplete.txt',
          fileSize: 100,
          totalChunks: 2,
          spaceId: 'user//alice',
        }),
      ).rejects.toThrow('CHUNK_MISSING_1');
    });
  });

  describe('HTTP Controller Handlers', () => {
    function createMockResponse() {
      const res: Partial<MeshCentralHttpResponse> = {};
      res.status = vi.fn().mockReturnValue(res);
      res.json = vi.fn().mockReturnValue(res);
      return res as MeshCentralHttpResponse & {
        status: ReturnType<typeof vi.fn>;
        json: ReturnType<typeof vi.fn>;
      };
    }

    it('rejects unauthenticated requests with 401', async () => {
      const plugin = chunkuploader({ parent: mockServer } as MeshCentralPluginHandler);
      let statusHandler: ((req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => void) | undefined;

      const app = {
        post: vi.fn((route: string, handler: (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => void) => {
          if (route === '/plugin/chunkuploader/status') statusHandler = handler;
        }),
      };
      plugin.hook_setupHttpHandlers?.({ app } as unknown as MeshCentralWebServer, mockServer);

      const res = createMockResponse();
      await statusHandler?.(
        { session: {}, headers: {}, query: {} } as MeshCentralHttpRequest,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errorCode: 'UNAUTHENTICATED' }),
      );
    });

    it('rejects unauthorized access with 403', async () => {
      const plugin = chunkuploader({ parent: mockServer } as MeshCentralPluginHandler);
      let statusHandler: ((req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => void) | undefined;

      const app = {
        post: vi.fn((route: string, handler: (req: MeshCentralHttpRequest, res: MeshCentralHttpResponse) => void) => {
          if (route === '/plugin/chunkuploader/status') statusHandler = handler;
        }),
      };
      plugin.hook_setupHttpHandlers?.({ app } as unknown as MeshCentralWebServer, mockServer);

      const res = createMockResponse();
      await statusHandler?.(
        {
          session: { userid: 'user//bob' },
          headers: {},
          query: {},
          body: {
            fileHash: 'hash-abc',
            fileName: 'doc.pdf',
            fileSize: 1024,
            spaceId: 'user//bob', // bob has siteadmin = 0
          },
        } as MeshCentralHttpRequest,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ errorCode: 'PERMISSION_DENIED' }),
      );
    });
  });
});
