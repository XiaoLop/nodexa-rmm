import { describe, expect, it } from 'vitest';
import { GatewayValidationError } from '../errors';
import { DevicesResource } from './devices';
import { EventsResource } from './events';
import { GroupsResource } from './groups';

class FakeClient {
  readonly requests: Record<string, unknown>[] = [];
  responses: unknown[] = [];
  async request<T>(payload: Record<string, unknown>): Promise<T> {
    this.requests.push(payload);
    return this.responses.shift() as T;
  }
}

describe('resources', () => {
  it('builds and normalizes device requests', async () => {
    const client = new FakeClient();
    const devices = new DevicesResource(client);
    client.responses.push({ nodes: { group: [{ _id: 'one', name: 'One', conn: 1 }] } });
    await expect(devices.list()).resolves.toMatchObject([{ id: 'one', online: true }]);
    client.responses.push({ ok: true });
    await devices.update('one', { name: 'Renamed' });
    expect(client.requests.at(-1)).toMatchObject({
      action: 'changedevice',
      nodeid: 'one',
      name: 'Renamed',
    });
  });

  it('builds group and history requests', async () => {
    const client = new FakeClient();
    const groups = new GroupsResource(client);
    const events = new EventsResource(client);
    client.responses.push({ ok: true });
    await groups.create('Servers');
    expect(client.requests.at(-1)).toMatchObject({
      action: 'createmesh',
      meshname: 'Servers',
      meshtype: 2,
    });
    client.responses.push({ events: [{ action: 'agentlog', nodeid: 'one', msg: 'Uploaded' }] });
    await expect(events.listByDevice('one')).resolves.toMatchObject([
      { type: 'agentLog', deviceId: 'one' },
    ]);
  });

  it('passes history limits and filters and rejects invalid limits', async () => {
    const client = new FakeClient();
    const events = new EventsResource(client);
    client.responses.push({ events: [] });
    await events.list({ limit: 60, filter: 'relaylog' });
    expect(client.requests.at(-1)).toEqual({ action: 'events', limit: 60, filter: 'relaylog' });

    expect(() => events.list({ limit: 0 })).toThrow(GatewayValidationError);
    expect(() => events.list({ limit: 201 })).toThrow(GatewayValidationError);
    expect(() => events.list({ limit: 1.5 })).toThrow(GatewayValidationError);
  });
});
