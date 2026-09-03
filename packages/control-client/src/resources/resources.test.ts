import { describe, expect, it } from 'vitest';
import { GatewayValidationError } from '../errors';
import { DevicesResource } from './devices';
import { CommandsResource } from './commands';
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

class ControllableClient extends FakeClient {
  readonly pending: Array<{
    payload: Record<string, unknown>;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
  }> = [];

  override request<T>(payload: Record<string, unknown>): Promise<T> {
    this.requests.push(payload);
    return new Promise<T>((resolve, reject) =>
      this.pending.push({ payload, resolve: (value) => resolve(value as T), reject }),
    );
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

  it('builds invite, batch power, and command requests', async () => {
    const client = new FakeClient();
    const devices = new DevicesResource(client);
    const commands = new CommandsResource(client);
    client.responses.push({ ok: true });
    await devices.inviteByEmail({ groupId: 'group', email: 'user@example.com' });
    expect(client.requests.at(-1)).toMatchObject({ action: 'inviteAgent', meshid: 'group' });
    client.responses.push({ ok: true });
    await devices.powerMany(['one', 'two'], 'wake');
    expect(client.requests.at(-1)).toEqual({ action: 'wakedevices', nodeids: ['one', 'two'] });
    client.responses.push({ ok: true });
    await commands.run(['one'], 'hostname', { shell: 'powershell' });
    expect(client.requests.at(-1)).toMatchObject({
      action: 'runcommands',
      nodeids: ['one'],
      cmds: 'hostname',
      type: 2,
    });
  });

  it('keeps batch group results in target order with names and failures', async () => {
    const client = new FakeClient();
    const devices = new DevicesResource(client);
    client.responses.push({ ok: true }, new Error('Denied'));
    const originalRequest = client.request.bind(client);
    client.request = async <T>(payload: Record<string, unknown>) => {
      const response = await originalRequest<T>(payload);
      if (response instanceof Error) throw response;
      return response;
    };

    const result = await devices.updateManyGroup(
      [
        { id: 'one', name: 'One' },
        { id: 'two', name: 'Two' },
        { id: 'one', name: 'Duplicate' },
      ],
      'target',
    );

    expect(result.results).toMatchObject([
      { deviceId: 'one', deviceName: 'One', status: 'submitted' },
      { deviceId: 'two', deviceName: 'Two', status: 'failed', message: 'Denied' },
    ]);
    expect(result.results.every((item) => item.startedAt && item.finishedAt)).toBe(true);
  });

  it('turns a rejected wake batch into per-device failures', async () => {
    const client = new FakeClient();
    const devices = new DevicesResource(client);
    client.request = async () => {
      throw new Error('Gateway disconnected');
    };

    await expect(devices.powerMany([{ id: 'one', name: 'One' }], 'wake')).resolves.toMatchObject({
      results: [
        {
          deviceId: 'one',
          deviceName: 'One',
          status: 'failed',
          message: 'Gateway disconnected',
        },
      ],
    });
  });

  it('limits non-wake batch power requests to four concurrent devices', async () => {
    const client = new ControllableClient();
    const devices = new DevicesResource(client);
    const operation = devices.powerMany(['one', 'two', 'three', 'four', 'five'], 'reset');

    await Promise.resolve();
    expect(client.requests).toHaveLength(4);
    client.pending.splice(0, 4).forEach(({ resolve }) => resolve({ ok: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(client.requests).toHaveLength(5);
    client.pending.splice(0).forEach(({ resolve }) => resolve({ ok: true }));
    await expect(operation).resolves.toMatchObject({
      results: expect.arrayContaining([
        expect.objectContaining({ deviceId: 'one', status: 'submitted' }),
        expect.objectContaining({ deviceId: 'five', status: 'submitted' }),
      ]),
    });
  });

  it('rejects invalid batch input and power actions', async () => {
    const devices = new DevicesResource(new FakeClient());
    await expect(devices.powerMany([], 'wake')).rejects.toBeInstanceOf(GatewayValidationError);
    await expect(devices.powerMany(['one'], 'invalid' as never)).rejects.toBeInstanceOf(
      GatewayValidationError,
    );
  });
});
