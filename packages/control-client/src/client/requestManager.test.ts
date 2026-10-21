import { describe, expect, it, vi } from 'vitest';
import type { MeshCentralServerError } from '../errors';
import { RequestManager } from './requestManager';

describe('RequestManager', () => {
  it('never consumes console or trace streams as unrelated tagged request responses', async () => {
    const sent: Record<string, unknown>[] = [];
    const manager = new RequestManager(
      (payload) => sent.push(payload as Record<string, unknown>),
      1_000,
      () => undefined,
    );
    const request = manager.request({ action: 'test', tag: 'shared' });
    for (const action of ['serverconsole', 'trace', 'traceinfo']) {
      expect(manager.consume({ action, tag: 'shared', responseid: sent[0]?.responseid, value: 'output' })).toBe(false);
    }
    expect(manager.consume({ action: 'test', responseid: sent[0]?.responseid, result: 'ok' })).toBe(true);
    await expect(request).resolves.toMatchObject({ action: 'test' });
  });
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
      name: 'MeshCentralServerError',
      message: 'Invalid rights',
    } satisfies Partial<MeshCentralServerError>);
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

  it('accepts the descriptive wakedevices result without a response id', async () => {
    const sent: Record<string, unknown>[] = [];
    const manager = new RequestManager(
      (payload) => sent.push(payload as Record<string, unknown>),
      1_000,
      () => undefined,
    );
    const request = manager.request({ action: 'wakedevices', nodeids: ['node//one'] });
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(manager.consume({ action: 'wakedevices', result: 'Used 1 device(s) to send wake packets' })).toBe(
      true,
    );
    await expect(request).resolves.toMatchObject({ action: 'wakedevices' });
  });

  it('serializes poweraction requests whose confirmations have no correlation fields', async () => {
    const sent: Record<string, unknown>[] = [];
    const manager = new RequestManager(
      (payload) => sent.push(payload as Record<string, unknown>),
      1_000,
      () => undefined,
    );
    const first = manager.request({ action: 'poweraction', nodeid: 'node//one' });
    const second = manager.request({ action: 'poweraction', nodeid: 'node//two' });
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(manager.consume({ action: 'poweraction' })).toBe(true);
    await expect(first).resolves.toMatchObject({ action: 'poweraction' });
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(manager.consume({ action: 'poweraction' })).toBe(true);
    await expect(second).resolves.toMatchObject({ action: 'poweraction' });
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

  it('serializes responseid-less server timeline stats requests', async () => {
    const sent: Record<string, unknown>[] = [];
    const manager = new RequestManager(
      (payload) => sent.push(payload as Record<string, unknown>),
      1_000,
      () => undefined,
    );
    const first = manager.request({ action: 'servertimelinestats', hours: 24 });
    const second = manager.request({ action: 'servertimelinestats', hours: 168 });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ action: 'servertimelinestats', hours: 24 });

    expect(
      manager.consume({
        action: 'servertimelinestats',
        events: [{ time: '2026-09-23T00:00:00.000Z' }],
      }),
    ).toBe(true);
    await expect(first).resolves.toMatchObject({ action: 'servertimelinestats' });
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toMatchObject({ action: 'servertimelinestats', hours: 168 });

    expect(manager.consume({ action: 'servertimelinestats', events: [] })).toBe(true);
    await expect(second).resolves.toMatchObject({ action: 'servertimelinestats' });
  });

  it('serializes responseid-less powertimeline requests', async () => {
    const sent: Record<string, unknown>[] = [];
    const manager = new RequestManager(
      (payload) => sent.push(payload as Record<string, unknown>),
      1_000,
      () => undefined,
    );
    const first = manager.request({ action: 'powertimeline', nodeid: 'node//one' });
    const second = manager.request({ action: 'powertimeline', nodeid: 'node//two' });
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ action: 'powertimeline', nodeid: 'node//one' });

    expect(
      manager.consume({
        action: 'powertimeline',
        nodeid: 'node//one',
        timeline: [0, 1791548099, 1, 977, 0],
      }),
    ).toBe(true);
    await expect(first).resolves.toMatchObject({
      action: 'powertimeline',
      nodeid: 'node//one',
      timeline: [0, 1791548099, 1, 977, 0],
    });
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]).toMatchObject({ action: 'powertimeline', nodeid: 'node//two' });

    expect(
      manager.consume({
        action: 'powertimeline',
        nodeid: 'node//two',
        timeline: [1, 1791548099, 1],
      }),
    ).toBe(true);
    await expect(second).resolves.toMatchObject({
      action: 'powertimeline',
      nodeid: 'node//two',
    });
  });

  it('serializes responseid-less report requests', async () => {
    const sent: Record<string, unknown>[] = [];
    const manager = new RequestManager(
      (payload) => sent.push(payload as Record<string, unknown>),
      1_000,
      () => undefined,
    );
    const first = manager.request({ action: 'report', type: 1 });
    const second = manager.request({ action: 'report', type: 3 });
    await vi.waitFor(() => expect(sent).toHaveLength(1));

    expect(manager.consume({ action: 'report', data: { columns: [], groups: {} } })).toBe(true);
    await expect(first).resolves.toMatchObject({ action: 'report' });
    await vi.waitFor(() => expect(sent).toHaveLength(2));

    expect(manager.consume({ action: 'report', data: { columns: [], groups: {} } })).toBe(true);
    await expect(second).resolves.toMatchObject({ action: 'report' });
  });

  it('continues the report queue after a timeout', async () => {
    vi.useFakeTimers();
    try {
      const sent: Record<string, unknown>[] = [];
      const manager = new RequestManager(
        (payload) => sent.push(payload as Record<string, unknown>),
        10,
        () => undefined,
      );
      const first = manager.request({ action: 'report', type: 1 });
      const second = manager.request({ action: 'report', type: 2 });
      await vi.advanceTimersByTimeAsync(10);

      await expect(first).rejects.toMatchObject({ name: 'MeshCentralRequestTimeoutError' });
      expect(sent).toHaveLength(2);

      expect(manager.consume({ action: 'report', data: { columns: [], groups: {} } })).toBe(true);
      await expect(second).resolves.toMatchObject({ action: 'report' });
    } finally {
      vi.useRealTimers();
    }
  });
});