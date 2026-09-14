import { describe, expect, it } from 'vitest';
import { GatewayServerError } from '../errors';
import { RequestManager } from './requestManager';

describe('RequestManager', () => {
  it('rejects matched responses with a non-success result', async () => {
    const sent: Record<string, unknown>[] = [];
    const manager = new RequestManager(
      (payload) => sent.push(payload as Record<string, unknown>),
      1_000,
      () => undefined,
    );
    const request = manager.request({ action: 'adddeviceuser' });
    const responseid = sent[0]?.responseid;

    manager.consume({ action: 'adddeviceuser', responseid, result: 'Invalid rights' });

    await expect(request).rejects.toMatchObject<Partial<GatewayServerError>>({
      name: 'GatewayServerError',
      message: 'Invalid rights',
    });
  });

  it('accepts ok and success result responses', async () => {
    const sent: Record<string, unknown>[] = [];
    const manager = new RequestManager(
      (payload) => sent.push(payload as Record<string, unknown>),
      1_000,
      () => undefined,
    );
    const request = manager.request({ action: 'test' });
    manager.consume({ action: 'test', responseid: sent[0]?.responseid, result: 'ok' });
    await expect(request).resolves.toMatchObject({ result: 'ok' });
  });
});