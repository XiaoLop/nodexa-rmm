import { describe, expect, it, vi } from 'vitest';
import type { GatewayServerError } from '../errors';
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

    await expect(request).rejects.toMatchObject({
      name: 'GatewayServerError',
      message: 'Invalid rights',
    } satisfies Partial<GatewayServerError>);
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

  it('serializes responseid-less device detail requests', async () => {
    const sent: Record<string, unknown>[] = [];
    const manager = new RequestManager(
      (payload) => sent.push(payload as Record<string, unknown>),
      1_000,
      () => undefined,
    );
    const first = manager.request({ action: 'getDeviceDetails', nodeids: ['node//one'] });
    const second = manager.request({ action: 'getDeviceDetails', nodeids: ['node//one'] });
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    manager.consume({ action: 'getDeviceDetails', data: '[{"node":{"_id":"node//one"}}]' });
    await expect(first).resolves.toMatchObject({ action: 'getDeviceDetails' });
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    manager.consume({ action: 'getDeviceDetails', data: '[{"node":{"_id":"node//one"}}]' });
    await expect(second).resolves.toMatchObject({ action: 'getDeviceDetails' });
  });
});