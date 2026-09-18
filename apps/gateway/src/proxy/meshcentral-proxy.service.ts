import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common';
import httpProxy from 'http-proxy';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';

import { buildUpstreamUrl, GATEWAY_CONFIG, type GatewayConfig } from '../config/gateway-config';

const WEBSOCKET_ROUTES = new Map([
  ['/api/control.ashx', '/control.ashx'],
  ['/api/meshrelay.ashx', '/meshrelay.ashx'],
]);

@Injectable()
export class MeshCentralProxyService implements OnApplicationShutdown {
  private readonly logger = new Logger(MeshCentralProxyService.name);
  private readonly proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    ignorePath: true,
    ws: true,
  });

  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {
    this.proxy.on('error', (error) => {
      this.logger.error(`Upstream proxy error: ${error.message}`);
    });
  }

  proxyMeshAgents(request: IncomingMessage, response: ServerResponse): void {
    const incomingUrl = new URL(request.url ?? '/api/meshagents', this.config.publicOrigin);
    const target = buildUpstreamUrl(this.config, '/meshagents');
    target.search = incomingUrl.search;

    this.proxy.web(
      request,
      response,
      {
        target: target.href,
        secure: this.config.tlsRejectUnauthorized,
        proxyTimeout: this.config.upstreamTimeoutMs,
      },
      (error) => {
        this.logger.error(`MeshAgents proxy failed: ${error.message}`);
        if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'application/json' });
        if (!response.writableEnded) response.end('{"code":"UPSTREAM_UNAVAILABLE"}');
      },
    );
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    const incomingUrl = new URL(request.url ?? '/', this.config.publicOrigin);
    const upstreamPath = WEBSOCKET_ROUTES.get(incomingUrl.pathname);
    if (!upstreamPath) {
      this.rejectUpgrade(socket, 404, 'Not Found');
      return;
    }

    const origin = request.headers.origin;
    if (
      (!origin && !this.config.allowMissingOrigin) ||
      (origin && origin !== this.config.publicOrigin.origin)
    ) {
      this.rejectUpgrade(socket, 403, 'Forbidden');
      return;
    }

    if (incomingUrl.pathname === '/api/control.ashx' && !request.headers.cookie) {
      this.rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }

    const target = buildUpstreamUrl(this.config, upstreamPath);
    target.search = incomingUrl.search;
    request.url = `${target.pathname}${target.search}`;

    this.proxy.ws(
      request,
      socket,
      head,
      {
        target: target.href,
        secure: this.config.tlsRejectUnauthorized,
        headers: { origin: this.config.upstreamBaseUrl.origin },
      },
      (error) => {
        this.logger.error(`WebSocket proxy failed for ${incomingUrl.pathname}: ${error.message}`);
        if (!socket.destroyed) this.rejectUpgrade(socket, 502, 'Bad Gateway');
      },
    );
  }

  onApplicationShutdown(): void {
    this.proxy.close();
  }

  private rejectUpgrade(socket: Duplex, status: number, message: string): void {
    socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  }
}
