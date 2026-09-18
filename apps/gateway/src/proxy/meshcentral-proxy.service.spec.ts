import { createServer, request as httpRequest, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocket, WebSocketServer } from 'ws';
import { afterEach, describe, expect, it } from 'vitest';

import type { GatewayConfig } from '../config/gateway-config';
import { MeshCentralProxyService } from './meshcentral-proxy.service';

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

function createConfig(origin: string): GatewayConfig {
  return {
    port: 0,
    publicOrigin: new URL('http://localhost:5173'),
    upstreamBaseUrl: new URL(origin),
    domainPath: '/domain/',
    trustProxy: false,
    upstreamTimeoutMs: 1_000,
    loginValidationTimeoutMs: 500,
    wsIdleTimeoutMs: 0,
    tlsRejectUnauthorized: true,
    allowMissingOrigin: false,
  };
}

async function listen(server: ReturnType<typeof createServer>): Promise<string> {
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function collect(response: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    response.on('data', (chunk: Buffer) => chunks.push(chunk));
    response.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

describe('MeshCentralProxyService', () => {
  it('streams MeshAgents requests with query, method, and Range intact', async () => {
    const upstream = createServer((request, response) => {
      expect(request.url).toBe('/domain/meshagents?id=4&meshid=secret');
      expect(request.method).toBe('GET');
      expect(request.headers.range).toBe('bytes=2-5');
      response.writeHead(206, { 'Content-Range': 'bytes 2-5/8' });
      response.end('2345');
    });
    const upstreamOrigin = await listen(upstream);
    const service = new MeshCentralProxyService(createConfig(upstreamOrigin));
    const gateway = createServer((request, response) => service.proxyMeshAgents(request, response));
    const gatewayOrigin = await listen(gateway);

    const response = await new Promise<IncomingMessage>((resolve, reject) => {
      const request = httpRequest(
        `${gatewayOrigin}/api/meshagents?id=4&meshid=secret`,
        {
          headers: { Range: 'bytes=2-5' },
        },
        resolve,
      );
      request.on('error', reject);
      request.end();
    });

    expect(response.statusCode).toBe(206);
    expect(response.headers['content-range']).toBe('bytes 2-5/8');
    expect((await collect(response)).toString()).toBe('2345');
    service.onApplicationShutdown();
  });

  it('proxies relay query plus text and binary frames without modification', async () => {
    let upstreamPath = '';
    const upstream = createServer();
    const upstreamWs = new WebSocketServer({ noServer: true, perMessageDeflate: false });
    upstream.on('upgrade', (request, socket, head) => {
      upstreamPath = request.url ?? '';
      upstreamWs.handleUpgrade(request, socket, head, (webSocket) => {
        webSocket.on('message', (data, isBinary) => webSocket.send(data, { binary: isBinary }));
      });
    });
    const upstreamOrigin = await listen(upstream);
    const service = new MeshCentralProxyService(createConfig(upstreamOrigin));
    const gateway = createServer();
    gateway.on('upgrade', (request, socket, head) => service.handleUpgrade(request, socket, head));
    const gatewayOrigin = await listen(gateway);

    const client = new WebSocket(
      `${gatewayOrigin.replace('http:', 'ws:')}/api/meshrelay.ashx?p=5&auth=alpha&rauth=beta`,
      { headers: { Origin: 'http://localhost:5173' }, perMessageDeflate: false },
    );
    await new Promise<void>((resolve, reject) => {
      client.once('open', resolve);
      client.once('error', reject);
    });

    const textResult = new Promise<{ value: string; binary: boolean }>((resolve) => {
      client.once('message', (data, isBinary) =>
        resolve({ value: data.toString(), binary: isBinary }),
      );
    });
    client.send('hello');
    expect(await textResult).toEqual({ value: 'hello', binary: false });

    const binaryResult = new Promise<{ value: Buffer; binary: boolean }>((resolve) => {
      client.once('message', (data, isBinary) =>
        resolve({ value: Buffer.from(data as Buffer), binary: isBinary }),
      );
    });
    client.send(Buffer.from([0, 1, 2, 255]));
    expect(await binaryResult).toEqual({ value: Buffer.from([0, 1, 2, 255]), binary: true });
    expect(upstreamPath).toBe('/domain/meshrelay.ashx?p=5&auth=alpha&rauth=beta');

    const closed = new Promise<void>((resolve) => client.once('close', () => resolve()));
    client.close();
    await closed;
    await new Promise<void>((resolve) => upstreamWs.close(() => resolve()));
    service.onApplicationShutdown();
  });
});
