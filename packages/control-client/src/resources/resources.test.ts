import { describe, expect, it, vi } from 'vitest';
import { GatewayValidationError } from '../errors';
import type { GatewayClientEvents, GatewayEventChannel, GatewayListener } from '../types';
import addUserSuccessFixture from '../testing/fixtures/users/add-success.json';
import deleteUserSuccessFixture from '../testing/fixtures/users/delete-success.json';
import editUserSuccessFixture from '../testing/fixtures/users/edit-success.json';
import { DevicesResource } from './devices';
import { CommandsResource } from './commands';
import { EventsResource } from './events';
import { GroupsResource } from './groups';
import { UserGroupsResource } from './userGroups';
import { UsersResource } from './users';

class FakeClient {
  readonly requests: Record<string, unknown>[] = [];
  readonly sent: unknown[] = [];
  responses: unknown[] = [];
  private readonly listeners = new Map<GatewayEventChannel, Set<GatewayListener<never>>>();

  async request<T>(payload: Record<string, unknown>): Promise<T> {
    this.requests.push(payload);
    return this.responses.shift() as T;
  }

  send(payload: unknown): void {
    this.sent.push(payload);
  }

  on<K extends GatewayEventChannel>(
    channel: K,
    listener: GatewayListener<GatewayClientEvents[K]>,
  ): () => void {
    const listeners = this.listeners.get(channel) ?? new Set<GatewayListener<never>>();
    listeners.add(listener as GatewayListener<never>);
    this.listeners.set(channel, listeners);
    return () => listeners.delete(listener as GatewayListener<never>);
  }

  emit<K extends GatewayEventChannel>(channel: K, value: GatewayClientEvents[K]): void {
    for (const listener of this.listeners.get(channel) ?? []) listener(value as never);
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

    client.responses.push({ ok: true }, { ok: true });
    await devices.setUserRights('node//one', 'operator', 8);
    expect(client.requests.at(-1)).toEqual({
      action: 'adddeviceuser',
      nodeid: 'node//one',
      usernames: ['operator'],
      rights: 8,
    });
    await devices.removeUser('node//one', 'operator');
    expect(client.requests.at(-1)).toEqual({
      action: 'adddeviceuser',
      nodeid: 'node//one',
      usernames: ['operator'],
      rights: 0,
      remove: true,
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

    const grant = groups.setUserRights('mesh//servers', 'Servers', 'user//test', 3);
    expect(client.sent.at(-1)).toEqual({
      action: 'addmeshuser',
      meshid: 'mesh//servers',
      meshname: 'Servers',
      userids: ['user//test'],
      meshadmin: 3,
      remove: false,
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'user',
        action: 'accountchange',
        account: { _id: 'user//test' },
      },
    });
    await expect(grant).resolves.toMatchObject({ action: 'accountchange' });

    const remove = groups.removeUser('mesh//servers', 'user//test');
    expect(client.sent.at(-1)).toEqual({
      action: 'removemeshuser',
      meshid: 'mesh//servers',
      userid: 'user//test',
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'user',
        action: 'accountchange',
        account: { _id: 'user//test' },
      },
    });
    await expect(remove).resolves.toMatchObject({ action: 'accountchange' });
    client.responses.push({ events: [{ action: 'agentlog', nodeid: 'one', msg: 'Uploaded' }] });
    await expect(events.listByDevice('one')).resolves.toMatchObject([
      { type: 'agentLog', deviceId: 'one' },
    ]);
    client.responses.push({ events: [] });
    await events.listByUser('user//admin', { limit: 60 });
    expect(client.requests.at(-1)).toEqual({
      action: 'events',
      userid: 'user//admin',
      limit: 60,
    });
  });

  it('builds and normalizes user group requests', async () => {
    const client = new FakeClient();
    const userGroups = new UserGroupsResource(client);
    client.responses.push({
      ugroups: {
        'ugrp//operators': { name: 'Operators', desc: 'Operations team' },
      },
    });
    await expect(userGroups.list()).resolves.toMatchObject([
      { id: 'ugrp//operators', name: 'Operators', description: 'Operations team' },
    ]);
    expect(client.requests.at(-1)).toEqual({ action: 'usergroups' });
  });

  it('builds and normalizes user requests', async () => {
    const client = new FakeClient();
    const users = new UsersResource(client);
    client.responses.push({
      users: [{ _id: 'user//admin', name: 'admin', siteadmin: -1 }],
    });
    await expect(users.list()).resolves.toMatchObject([
      { id: 'user//admin', name: 'admin', siteRights: 0xffffffff, locked: false },
    ]);

    client.responses.push({ action: 'wssessioncount', wssessions: { 'user//admin': 2 } });
    await expect(users.listSessionCounts()).resolves.toEqual({ 'user//admin': 2 });

    client.responses.push({ users: [] });
    const create = users.create({
      username: ' new-user ',
      password: 'secret',
      email: ' user@example.com ',
      realName: ' New User ',
      phone: ' 10000 ',
      resetNextLogin: true,
    });
    await vi.waitFor(() => expect(client.sent).toHaveLength(1));
    expect(client.sent.at(-1)).toEqual({
      action: 'adduser',
      username: 'new-user',
      pass: 'secret',
      email: 'user@example.com',
      realname: 'New User',
      phone: '10000',
      resetNextLogin: true,
      randomPassword: false,
      removeEvents: false,
    });
    client.emit('message', {
      action: 'event',
      event: { etype: 'user', action: 'accountcreate', username: 'other-user' },
    });
    let createSettled = false;
    void create.finally(() => {
      createSettled = true;
    });
    await Promise.resolve();
    expect(createSettled).toBe(false);
    client.emit('message', {
      ...addUserSuccessFixture,
      event: { ...addUserSuccessFixture.event, username: 'new-user' },
    });
    await expect(create).resolves.toMatchObject({ action: 'accountcreate' });

    const update = users.update('user//new-user', { realName: 'New User' });
    await Promise.resolve();
    expect(client.sent.at(-1)).toEqual({
      action: 'edituser',
      id: 'user//new-user',
      email: undefined,
      realname: 'New User',
      phone: undefined,
    });
    client.emit('message', {
      ...editUserSuccessFixture,
      event: {
        ...editUserSuccessFixture.event,
        account: { ...editUserSuccessFixture.event.account, _id: 'user//new-user' },
      },
    });
    await expect(update).resolves.toMatchObject({ action: 'accountchange' });

    const lock = users.setLocked('user//new-user', true, 0x100);
    await Promise.resolve();
    expect(client.sent.at(-1)).toEqual({
      action: 'edituser',
      id: 'user//new-user',
      siteadmin: 0x120,
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'user',
        action: 'accountchange',
        userid: 'user//new-user',
      },
    });
    await expect(lock).resolves.toMatchObject({ action: 'accountchange' });

    const siteRights = users.setSiteRights('user//new-user', 4);
    await Promise.resolve();
    expect(client.sent.at(-1)).toEqual({
      action: 'edituser',
      id: 'user//new-user',
      siteadmin: 4,
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'user',
        action: 'accountchange',
        account: { _id: 'user//new-user', siteadmin: 4 },
      },
    });
    await expect(siteRights).resolves.toMatchObject({ action: 'accountchange' });

    const remove = users.remove('user//new-user', 'new-user');
    await Promise.resolve();
    expect(client.sent.at(-1)).toEqual({
      action: 'deleteuser',
      userid: 'user//new-user',
      username: 'new-user',
    });
    client.emit('message', {
      ...deleteUserSuccessFixture,
      event: {
        ...deleteUserSuccessFixture.event,
        userid: 'user//new-user',
        username: 'new-user',
      },
    });
    await expect(remove).resolves.toMatchObject({ action: 'accountremove' });
  });

  it('rejects invalid group membership mutations', () => {
    const groups = new GroupsResource(new FakeClient());
    expect(() => groups.setUserRights(' ', 'Servers', 'user//test', 3)).toThrow(GatewayValidationError);
    expect(() => groups.setUserRights('mesh//servers', 'Servers', 'user//test', -1)).toThrow(
      GatewayValidationError,
    );
    expect(() => groups.setUserRights('mesh//servers', 'Servers', 'user//test', 0x100000000)).toThrow(
      GatewayValidationError,
    );
    expect(() => groups.removeUser('mesh//servers', ' ')).toThrow(GatewayValidationError);
  });

  it('rejects invalid device permission mutations', () => {
    const devices = new DevicesResource(new FakeClient());
    expect(() => devices.setUserRights(' ', 'operator', 8)).toThrow(GatewayValidationError);
    expect(() => devices.setUserRights('node//one', ' ', 8)).toThrow(GatewayValidationError);
    expect(() => devices.setUserRights('node//one', 'operator', -1)).toThrow(
      GatewayValidationError,
    );
    expect(() => devices.setUserRights('node//one', 'operator', 0x100000000)).toThrow(
      GatewayValidationError,
    );
    expect(() => devices.setUserRights('node//one', 'operator', 0xffffffff)).toThrow(
      GatewayValidationError,
    );
    expect(() => devices.setUserRights('node//one', 'operator', 0x00000004)).toThrow(
      GatewayValidationError,
    );
    expect(() => devices.removeUser('node//one', ' ')).toThrow(GatewayValidationError);
  });

  it('rejects invalid user mutations', async () => {
    const users = new UsersResource(new FakeClient());
    await expect(users.create({ username: ' ', password: 'secret' })).rejects.toBeInstanceOf(
      GatewayValidationError,
    );
    await expect(users.create({ username: 'user', password: ' ' })).rejects.toBeInstanceOf(
      GatewayValidationError,
    );
    expect(() => users.update('user//one', {})).toThrow(GatewayValidationError);
    expect(() => users.remove(' ')).toThrow(GatewayValidationError);
  });

  it('rejects user mutations when the gateway reports an error', async () => {
    const client = new FakeClient();
    const users = new UsersResource(client);
    const update = users.update('user//one', { email: 'one@example.invalid' });
    await vi.waitFor(() => expect(client.sent).toHaveLength(1));
    client.emit('message', { action: 'edituser', result: 'Access denied' });
    await expect(update).rejects.toThrow('Access denied');
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
