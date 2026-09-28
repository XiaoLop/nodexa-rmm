import { describe, expect, it, vi } from 'vitest';
import { GatewayRequestTimeoutError, GatewayServerError, GatewayValidationError } from '../errors';
import type { GatewayClientEvents, GatewayEventChannel, GatewayListener } from '../types';
import addUserSuccessFixture from '../testing/fixtures/users/add-success.json';
import deleteUserSuccessFixture from '../testing/fixtures/users/delete-success.json';
import editUserSuccessFixture from '../testing/fixtures/users/edit-success.json';
import { DevicesResource } from './devices';
import { CommandsResource } from './commands';
import { EventsResource } from './events';
import { GroupsResource } from './groups';
import { ServerResource } from './server';
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
  it('requests server timeline statistics', async () => {
    const client = new FakeClient();
    const server = new ServerResource(client);
    client.responses.push({
      events: [
        {
          time: '2026-09-22T02:19:19.933Z',
          conn: { ca: 84, cu: 0 },
          mem: { rss: 213278720 },
          traffic: { AgentCtrlIn: 55917 },
          cpu: [0.03, 0.08, 0.02],
        },
      ],
    });

    await expect(server.getTimelineStats(24)).resolves.toMatchObject([
      {
        time: '2026-09-22T02:19:19.933Z',
        connections: { connectedAgents: 84 },
        memory: { rss: 213278720 },
        traffic: { agentCtrlIn: 55917 },
        cpu: [0.03, 0.08, 0.02],
      },
    ]);
    expect(client.requests.at(-1)).toEqual({
      action: 'servertimelinestats',
      hours: 24,
    });
    await expect(server.getTimelineStats(-1)).rejects.toThrow(GatewayValidationError);
    await expect(server.getTimelineStats(721)).rejects.toThrow(GatewayValidationError);
    await expect(server.getTimelineStats(1.5)).rejects.toThrow(GatewayValidationError);
  });

  it('subscribes to server statistics pushes', () => {
    const client = new FakeClient();
    const server = new ServerResource(client);
    const listener = vi.fn();
    const unsubscribe = server.subscribeStats(listener);
    expect(client.sent).toEqual([{ action: 'serverstats', interval: 10_000 }]);

    const stats: GatewayClientEvents['serverStats'] = {
      totalMemory: 100,
      freeMemory: 40,
      availableMemory: 50,
      cpuAverage: [0.1, 0.2, 0.3],
      raw: {},
    };
    client.emit('serverStats', stats);
    expect(listener).toHaveBeenCalledWith(stats);

    unsubscribe();
    client.emit('serverStats', stats);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(() => server.subscribeStats(listener, 0)).toThrow(GatewayValidationError);
  });

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

  it('builds user group target permission requests', async () => {
    const client = new FakeClient();
    const groups = new GroupsResource(client);
    const devices = new DevicesResource(client);
    const userGroupId = 'ugrp//operators';

    const groupGrant = groups.setUserGroupRights(
      'mesh//servers',
      'Servers',
      userGroupId,
      0xffffffff,
    );
    expect(client.sent.at(-1)).toEqual({
      action: 'addmeshuser',
      meshid: 'mesh//servers',
      meshname: 'Servers',
      userids: [userGroupId],
      meshadmin: 0xffffffff,
      remove: false,
    });
    client.emit('message', {
      action: 'event',
      event: { etype: 'ugrp', action: 'usergroupchange', ugrpid: userGroupId, links: {} },
    });
    await expect(groupGrant).resolves.toMatchObject({ ugrpid: userGroupId });

    const groupRemove = groups.removeUserGroup('mesh//servers', userGroupId);
    expect(client.sent.at(-1)).toEqual({
      action: 'removemeshuser',
      meshid: 'mesh//servers',
      userid: userGroupId,
    });
    client.emit('message', {
      action: 'event',
      event: { etype: 'ugrp', action: 'usergroupchange', ugrpid: userGroupId, links: {} },
    });
    await expect(groupRemove).resolves.toMatchObject({ ugrpid: userGroupId });

    const deviceGrant = devices.setUserGroupRights('node//one', 'One', userGroupId, 8);
    expect(client.sent.at(-1)).toEqual({
      action: 'adddeviceuser',
      nodeid: 'node//one',
      nodename: 'One',
      userids: [userGroupId],
      rights: 8,
      remove: false,
    });
    client.emit('message', {
      action: 'event',
      event: { etype: 'ugrp', action: 'usergroupchange', ugrpid: userGroupId, links: {} },
    });
    await expect(deviceGrant).resolves.toMatchObject({ ugrpid: userGroupId });

    const deviceRemove = devices.removeUserGroup('node//one', userGroupId);
    expect(client.sent.at(-1)).toEqual({
      action: 'adddeviceuser',
      nodeid: 'node//one',
      userids: [userGroupId],
      rights: 0,
      remove: true,
    });
    client.emit('message', {
      action: 'event',
      event: { etype: 'ugrp', action: 'usergroupchange', ugrpid: userGroupId, links: {} },
    });
    await expect(deviceRemove).resolves.toMatchObject({ ugrpid: userGroupId });
  });

  it('builds and normalizes user group requests', async () => {
    const client = new FakeClient();
    const userGroups = new UserGroupsResource(client);
    client.responses.push({
      ugroups: {
        'ugrp//operators': {
          name: 'Operators',
          desc: 'Operations team',
          domain: '',
          flags: 2,
          consent: 0,
          links: {
            'user//root': { userid: 'user//root', name: 'root', rights: 1 },
            'mesh//servers': { rights: -1 },
            'node//one': { rights: 8 },
          },
        },
      },
    });
    await expect(userGroups.list()).resolves.toMatchObject([
      {
        id: 'ugrp//operators',
        name: 'Operators',
        description: 'Operations team',
        flags: 2,
        consent: 0,
        links: [
          { id: 'user//root', type: 'user', name: 'root', rights: 1 },
          { id: 'mesh//servers', type: 'device-group', rights: 0xffffffff },
          { id: 'node//one', type: 'device', rights: 8 },
        ],
      },
    ]);
    expect(client.requests.at(-1)).toEqual({ action: 'usergroups' });
  });

  it('builds and confirms user group mutations', async () => {
    const client = new FakeClient();
    const userGroups = new UserGroupsResource(client);

    const create = userGroups.create({ name: ' test22 ', description: ' 123 ' });
    await vi.waitFor(() => expect(client.sent).toHaveLength(1));
    expect(client.sent.at(-1)).toEqual({
      action: 'createusergroup',
      name: 'test22',
      desc: '123',
    });
    client.emit('message', {
      action: 'createusergroup',
      result: 'ok',
      ugrpid: 'ugrp//test22',
      links: {},
    });
    await expect(create).resolves.toMatchObject({ ugrpid: 'ugrp//test22' });

    const clone = userGroups.create({
      name: 'test-copy',
      description: 'copy',
      cloneUserGroupId: 'ugrp//test22',
    });
    await vi.waitFor(() => expect(client.sent).toHaveLength(2));
    expect(client.sent.at(-1)).toEqual({
      action: 'createusergroup',
      name: 'test-copy',
      desc: 'copy',
      clone: 'ugrp//test22',
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'ugrp',
        action: 'createusergroup',
        ugrpid: 'ugrp//test-copy',
        name: 'test-copy',
      },
    });
    await expect(clone).resolves.toMatchObject({ ugrpid: 'ugrp//test-copy' });

    const update = userGroups.update('ugrp//test22', {
      name: 'test22',
      description: '123123',
    });
    await vi.waitFor(() => expect(client.sent).toHaveLength(3));
    expect(client.sent.at(-1)).toEqual({
      action: 'editusergroup',
      ugrpid: 'ugrp//test22',
      name: 'test22',
      desc: '123123',
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'ugrp',
        action: 'usergroupchange',
        ugrpid: 'ugrp//test22',
        name: 'test22',
      },
    });
    await expect(update).resolves.toMatchObject({ action: 'usergroupchange' });

    const addUsers = userGroups.addUsers('ugrp//test22', [' root ', 'root']);
    await vi.waitFor(() => expect(client.sent).toHaveLength(4));
    expect(client.sent.at(-1)).toEqual({
      action: 'addusertousergroup',
      ugrpid: 'ugrp//test22',
      usernames: ['root'],
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'ugrp',
        action: 'usergroupchange',
        ugrpid: 'ugrp//test22',
        links: { 'user//root': { userid: 'user//root', name: 'root', rights: 1 } },
      },
    });
    await expect(addUsers).resolves.toMatchObject({ action: 'usergroupchange' });

    const removeUser = userGroups.removeUser('ugrp//test22', 'user//root');
    await vi.waitFor(() => expect(client.sent).toHaveLength(5));
    expect(client.sent.at(-1)).toEqual({
      action: 'removeuserfromusergroup',
      ugrpid: 'ugrp//test22',
      userid: 'user//root',
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'ugrp',
        action: 'usergroupchange',
        ugrpid: 'ugrp//test22',
        links: {},
      },
    });
    await expect(removeUser).resolves.toMatchObject({ action: 'usergroupchange' });

    const remove = userGroups.remove('ugrp//test22');
    await vi.waitFor(() => expect(client.sent).toHaveLength(6));
    expect(client.sent.at(-1)).toEqual({
      action: 'deleteusergroup',
      ugrpid: 'ugrp//test22',
    });
    client.emit('message', {
      action: 'deleteusergroup',
      result: 'ok',
      ugrpid: 'ugrp//test22',
    });
    await expect(remove).resolves.toMatchObject({ ugrpid: 'ugrp//test22' });
  });

  it('rejects invalid user group mutations', () => {
    const userGroups = new UserGroupsResource(new FakeClient());
    expect(() => userGroups.create({ name: ' ' })).toThrow(GatewayValidationError);
    expect(() => userGroups.create({ name: 'copy', cloneUserGroupId: 'invalid' })).toThrow(
      GatewayValidationError,
    );
    expect(() => userGroups.update('invalid', { name: 'test' })).toThrow(GatewayValidationError);
    expect(() => userGroups.addUsers('ugrp//test', [])).toThrow(GatewayValidationError);
    expect(() => userGroups.removeUser('ugrp//test', 'root')).toThrow(GatewayValidationError);
  });

  it('builds and normalizes user requests', async () => {
    const client = new FakeClient();
    const users = new UsersResource(client);
    client.responses.push({
      users: [
        {
          _id: 'user//admin',
          name: 'admin',
          image: 'data:image/png;base64,YWRtaW4=',
          siteadmin: -1,
        },
      ],
    });
    await expect(users.list()).resolves.toMatchObject([
      {
        id: 'user//admin',
        name: 'admin',
        image: 'data:image/png;base64,YWRtaW4=',
        siteRights: 0xffffffff,
        locked: false,
      },
    ]);

    client.responses.push({ action: 'wssessioncount', wssessions: { 'user//admin': 2 } });
    await expect(users.listSessionCounts()).resolves.toEqual({ 'user//admin': 2 });

    client.responses.push({
      action: 'previousLogins',
      events: [
        {
          t: '2026-09-28T01:10:09.575Z',
          m: 107,
          a: ['172.19.0.1', 'Edge/153.0.0.0', 'Windows'],
        },
        { t: 'invalid', m: 110, a: [] },
      ],
    });
    await expect(users.listPreviousLogins()).resolves.toEqual([
      {
        occurredAt: '2026-09-28T01:10:09.575Z',
        messageId: 107,
        ip: '172.19.0.1',
        client: 'Edge/153.0.0.0',
        platform: 'Windows',
      },
    ]);
    expect(client.requests.at(-1)).toEqual({ action: 'previousLogins' });

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

    users.updateImage('user//new-user', 'data:image/jpeg;base64,YXZhdGFy');
    expect(client.sent.at(-1)).toEqual({
      action: 'updateUserImage',
      userid: 'user//new-user',
      image: 'data:image/jpeg;base64,YXZhdGFy',
    });

    const currentImage = users.updateCurrentImage(
      'user//admin',
      'data:image/png;base64,YXZhdGFy',
    );
    await Promise.resolve();
    expect(client.sent.at(-1)).toEqual({
      action: 'updateUserImage',
      image: 'data:image/png;base64,YXZhdGFy',
      userid: 'user//admin',
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'user',
        action: 'accountchange',
        userid: 'user//admin',
        accountImageChange: 1,
      },
    });
    await expect(currentImage).resolves.toMatchObject({ accountImageChange: 1 });

    const email = users.changeCurrentEmail('user//admin', ' admin@168.com ');
    await Promise.resolve();
    expect(client.sent.at(-1)).toEqual({ action: 'changeemail', email: 'admin@168.com' });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'user',
        action: 'accountchange',
        userid: 'user//admin',
        account: { _id: 'user//admin', email: 'admin@168.com' },
      },
    });
    await expect(email).resolves.toMatchObject({ action: 'accountchange' });

    const password = users.changeCurrentPassword('user//admin', 'admin@123456', '123456');
    await Promise.resolve();
    expect(client.sent.at(-1)).toEqual({
      action: 'changepassword',
      oldpass: 'admin@123456',
      newpass: '123456',
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'user',
        action: 'accountchange',
        userid: 'user//admin',
        account: { _id: 'user//admin', passchange: 1790558387 },
      },
    });
    await expect(password).resolves.toMatchObject({ action: 'accountchange' });

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

    const removeRights = users.setRemoveRights('user//new-user', 0x00000600);
    await Promise.resolve();
    expect(client.sent.at(-1)).toEqual({
      action: 'edituser',
      id: 'user//new-user',
      removeRights: 0x00000600,
    });
    client.emit('message', {
      action: 'event',
      event: {
        etype: 'user',
        action: 'accountchange',
        account: { _id: 'user//new-user', removeRights: 0x00000600 },
      },
    });
    await expect(removeRights).resolves.toMatchObject({ action: 'accountchange' });

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
    expect(() => groups.setUserRights(' ', 'Servers', 'user//test', 3)).toThrow(
      GatewayValidationError,
    );
    expect(() => groups.setUserRights('mesh//servers', 'Servers', 'user//test', -1)).toThrow(
      GatewayValidationError,
    );
    expect(() =>
      groups.setUserRights('mesh//servers', 'Servers', 'user//test', 0x100000000),
    ).toThrow(GatewayValidationError);
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
    expect(() => users.updateImage('user//one', 'https://example.com/avatar.jpg')).toThrow(
      GatewayValidationError,
    );
    expect(() => users.changeCurrentEmail('user//one', 'invalid')).toThrow(GatewayValidationError);
    expect(() => users.changeCurrentPassword('user//one', 'same', 'same')).toThrow(
      GatewayValidationError,
    );
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

  it('returns an empty event list on timeout without hiding other errors', async () => {
    const client = new ControllableClient();
    const events = new EventsResource(client);

    const emptyResult = events.list({ limit: 60 });
    client.pending.at(-1)?.reject(new GatewayRequestTimeoutError('No event response.'));
    await expect(emptyResult).resolves.toEqual([]);

    const failedResult = events.list({ limit: 60 });
    client.pending.at(-1)?.reject(new GatewayServerError('Access denied.'));
    await expect(failedResult).rejects.toThrow('Access denied.');
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
    client.responses.push({ ok: true }, { ok: true }, { ok: true });
    await devices.powerAction('one', 'poweroff');
    expect(client.requests.at(-1)).toEqual({
      action: 'poweraction',
      nodeids: ['one'],
      actiontype: 2,
    });
    await devices.powerAction('one', 'reset');
    expect(client.requests.at(-1)).toEqual({
      action: 'poweraction',
      nodeids: ['one'],
      actiontype: 3,
    });
    await devices.powerAction('one', 'sleep');
    expect(client.requests.at(-1)).toEqual({
      action: 'poweraction',
      nodeids: ['one'],
      actiontype: 4,
    });
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

  it('sends non-wake batch power actions in one request', async () => {
    const client = new ControllableClient();
    const devices = new DevicesResource(client);
    const operation = devices.powerMany(['one', 'two', 'three', 'four', 'five'], 'reset');

    await Promise.resolve();
    expect(client.requests).toEqual([
      {
        action: 'poweraction',
        nodeids: ['one', 'two', 'three', 'four', 'five'],
        actiontype: 3,
      },
    ]);
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
