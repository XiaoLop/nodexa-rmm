import {
  MeshCentralConnectionClosedError,
  MeshCentralRequestTimeoutError,
  MeshCentralServerError,
  MeshCentralValidationError,
} from '../errors';
import { isRecord, normalizeGroups } from '../protocol/normalizers';
import type {
  ConnectionStateChange,
  DeviceGroup,
  MeshCentralClientEvents,
  MeshCentralEventChannel,
  MeshCentralListener,
  GroupCreateOptions,
  GroupUpdate,
} from '../types';

interface ResourceClient {
  send(payload: unknown): void;
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
  on<K extends MeshCentralEventChannel>(
    channel: K,
    listener: MeshCentralListener<MeshCentralClientEvents[K]>,
  ): () => void;
}

const GROUP_MEMBERSHIP_CONFIRMATION_TIMEOUT_MS = 5_000;

const required = (value: string, name: string) => {
  if (!value.trim()) throw new MeshCentralValidationError(`${name} is required.`);
};

function membershipError(message: unknown, action: string): string | undefined {
  if (!isRecord(message) || message.action !== action) return undefined;
  const error = message.error ?? message.err;
  if (typeof error === 'string' && error) return error;
  if (
    typeof message.result === 'string' &&
    !['ok', 'success'].includes(message.result.toLowerCase())
  ) {
    return message.result;
  }
  return undefined;
}

function membershipEvent(message: unknown): Record<string, unknown> | undefined {
  if (!isRecord(message)) return undefined;
  const event = isRecord(message.event) ? message.event : message;
  if (event.etype === 'user' && event.action === 'accountchange') return event;
  if (event.etype === 'ugrp' && event.action === 'usergroupchange') return event;
  return undefined;
}

function eventUserId(event: Record<string, unknown>): string | undefined {
  const account = isRecord(event.account) ? event.account : undefined;
  return typeof account?._id === 'string'
    ? account._id
    : typeof event.userid === 'string'
      ? event.userid
      : undefined;
}

export class GroupsResource {
  constructor(private readonly client: ResourceClient) {}
  async list(): Promise<DeviceGroup[]> {
    const response = await this.client.request<unknown>({ action: 'meshes' });
    return normalizeGroups(isRecord(response) ? (response.meshes ?? response.groups) : undefined);
  }
  create(name: string, options: GroupCreateOptions = {}): Promise<unknown> {
    required(name, 'Group name');
    return this.client.request({
      action: 'createmesh',
      meshname: name,
      meshtype: options.type ?? 2,
      desc: options.description,
    });
  }
  update(groupId: string, updates: GroupUpdate): Promise<unknown> {
    required(groupId, 'Group ID');
    if (!updates.name && updates.description === undefined)
      throw new MeshCentralValidationError('At least one group update is required.');
    return this.client.request({
      action: 'editmesh',
      meshid: groupId,
      meshname: updates.name,
      desc: updates.description,
    });
  }
  remove(groupId: string): Promise<unknown> {
    required(groupId, 'Group ID');
    return this.client.request({ action: 'deletemesh', meshid: groupId });
  }

  setUserRights(groupId: string, groupName: string, userId: string, rights: number): Promise<unknown> {
    required(groupId, 'Group ID');
    required(groupName, 'Group name');
    required(userId, 'User ID');
    if (!Number.isInteger(rights) || rights < 0 || rights > 0xffffffff) {
      throw new MeshCentralValidationError('Rights must be an unsigned 32-bit integer.');
    }
    return this.mutateMembership(
      {
        action: 'addmeshuser',
        meshid: groupId,
        meshname: groupName,
        userids: [userId],
        meshadmin: rights >>> 0,
        remove: false,
      },
      (event) => eventUserId(event) === userId,
    );
  }

  removeUser(groupId: string, userId: string): Promise<unknown> {
    required(groupId, 'Group ID');
    required(userId, 'User ID');
    return this.mutateMembership(
      { action: 'removemeshuser', meshid: groupId, userid: userId },
      (event) => eventUserId(event) === userId,
    );
  }

  setUserGroupRights(
    groupId: string,
    groupName: string,
    userGroupId: string,
    rights: number,
  ): Promise<unknown> {
    required(groupId, 'Group ID');
    required(groupName, 'Group name');
    required(userGroupId, 'User group ID');
    if (!userGroupId.startsWith('ugrp//')) {
      throw new MeshCentralValidationError('User group ID must start with ugrp//.');
    }
    if (!Number.isInteger(rights) || rights < 0 || rights > 0xffffffff) {
      throw new MeshCentralValidationError('Rights must be an unsigned 32-bit integer.');
    }
    return this.mutateMembership(
      {
        action: 'addmeshuser',
        meshid: groupId,
        meshname: groupName,
        userids: [userGroupId],
        meshadmin: rights >>> 0,
        remove: false,
      },
      (event) => event.ugrpid === userGroupId,
    );
  }

  removeUserGroup(groupId: string, userGroupId: string): Promise<unknown> {
    required(groupId, 'Group ID');
    required(userGroupId, 'User group ID');
    if (!userGroupId.startsWith('ugrp//')) {
      throw new MeshCentralValidationError('User group ID must start with ugrp//.');
    }
    return this.mutateMembership(
      { action: 'removemeshuser', meshid: groupId, userid: userGroupId },
      (event) => event.ugrpid === userGroupId,
    );
  }

  private mutateMembership(
    payload: Record<string, unknown>,
    matchesEvent: (event: Record<string, unknown>) => boolean,
  ): Promise<unknown> {
    const action = payload.action as string;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        unsubscribeMessage();
        unsubscribeConnection();
        callback();
      };
      const unsubscribeMessage = this.client.on('message', (message) => {
        const error = membershipError(message, action);
        if (error) {
          finish(() => reject(new MeshCentralServerError(error, { action })));
          return;
        }
        const event = membershipEvent(message);
        if (event && matchesEvent(event)) finish(() => resolve(event));
      });
      const unsubscribeConnection = this.client.on(
        'connection',
        (change: ConnectionStateChange) => {
          if (change.current === 'disconnected' || change.current === 'error') {
            finish(() =>
              reject(new MeshCentralConnectionClosedError('Connection closed during membership update.')),
            );
          }
        },
      );
      const timeout = setTimeout(
        () =>
          finish(() =>
            reject(
              new MeshCentralRequestTimeoutError(`Timed out waiting for ${action} confirmation.`, {
                action,
              }),
            ),
          ),
        GROUP_MEMBERSHIP_CONFIRMATION_TIMEOUT_MS,
      );
      try {
        this.client.send(payload);
      } catch (error) {
        finish(() => reject(error));
      }
    });
  }
}
