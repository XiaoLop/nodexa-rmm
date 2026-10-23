import { readFileSync } from 'node:fs';

import type { WebSocketFactory, WebSocketLike } from '@meshcentral/control-client';
import WebSocket from 'ws';

export interface NodeSocketOptions {
  readonly cookieHeader?: string;
  readonly meshAuthHeader?: string;
  readonly tlsCaPath?: string;
  readonly allowInsecureTls?: boolean;
  readonly userAgent?: string;
}

export function createNodeSocketFactory(options: NodeSocketOptions): WebSocketFactory {
  const ca = options.tlsCaPath ? readFileSync(options.tlsCaPath) : undefined;

  const headers: Record<string, string> = {};
  if (options.userAgent) headers['User-Agent'] = options.userAgent;
  if (options.cookieHeader) headers.Cookie = options.cookieHeader;
  if (options.meshAuthHeader) headers['x-meshauth'] = options.meshAuthHeader;

  return (url: string) => {
    const target =
      options.meshAuthHeader === undefined
        ? url
        : appendMeshAuthQuery(url, options.meshAuthHeader);

    const socket = new WebSocket(target, {
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
      ...(ca === undefined ? {} : { ca }),
      ...(options.allowInsecureTls ? { rejectUnauthorized: false } : {}),
    });

    return socket as unknown as WebSocketLike;
  };
}

export function appendMeshAuthQuery(url: string, meshAuthHeader: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}x-meshauth=${encodeURIComponent(meshAuthHeader)}`;
}
