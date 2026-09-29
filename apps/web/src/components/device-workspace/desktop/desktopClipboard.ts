import type { MeshCentralClient } from '@meshcentral/control-client';

const CLIPBOARD_TIMEOUT_MS = 10_000;

export type RemoteClipboardErrorCode = 'missingText' | 'timeout' | 'sendFailed';

export class RemoteClipboardError extends Error {
  constructor(public readonly code: RemoteClipboardErrorCode, cause?: unknown) {
    super(code);
    this.name = 'RemoteClipboardError';
    if (cause !== undefined) this.cause = cause;
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function clipboardMessage(value: unknown): Record<string, unknown> | undefined {
  const root = record(value);
  if (!root) return undefined;
  const candidates = [root, record(root.data), record(root.payload), record(root.message), record(root.event)];
  return candidates.find((candidate) => candidate?.type === 'getclip');
}

export function setRemoteClipboard(client: MeshCentralClient, deviceId: string, text: string): void {
  client.send({ action: 'msg', type: 'setclip', nodeid: deviceId, data: text });
}

export function getRemoteClipboard(
  client: MeshCentralClient,
  deviceId: string,
  timeoutMs = CLIPBOARD_TIMEOUT_MS,
): Promise<string> {
  const tag = `desktop-clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribe();
      callback();
    };
    const unsubscribe = client.on('message', (message) => {
      const response = clipboardMessage(message);
      if (!response || response.tag !== tag) return;
      const responseDeviceId = response.nodeid ?? response.nodeId;
      if (typeof responseDeviceId === 'string' && responseDeviceId !== deviceId) return;
      if (typeof response.data !== 'string') {
        finish(() => reject(new RemoteClipboardError('missingText')));
        return;
      }
      finish(() => resolve(response.data as string));
    });
    const timeout = setTimeout(
      () => finish(() => reject(new RemoteClipboardError('timeout'))),
      timeoutMs,
    );
    try {
      client.send({ action: 'msg', type: 'getclip', nodeid: deviceId, tag });
    } catch (error) {
      finish(() => reject(error instanceof Error ? error : new RemoteClipboardError('sendFailed')));
    }
  });
}