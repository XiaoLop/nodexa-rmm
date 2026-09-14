import {
  GatewayConnectionClosedError,
  GatewayRequestTimeoutError,
  GatewayServerError,
  GatewayValidationError,
} from '../errors';
import { isRecord, stringValue } from '../protocol/normalizers';
import {
  normalizeUserGroupConsent,
  normalizeUserGroupMemberRights,
  normalizeUserGroupTargetRights,
} from '../permissions/userGroupRights';
import type {
  ConnectionStateChange,
  GatewayClientEvents,
  GatewayEventChannel,
  GatewayListener,
  UserGroup,
  UserGroupCreateOptions,
  UserGroupLink,
  UserGroupLinkType,
  UserGroupUpdate,
} from '../types';

interface ResourceClient {
  send(payload: unknown): void;
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
  on<K extends GatewayEventChannel>(
    channel: K,
    listener: GatewayListener<GatewayClientEvents[K]>,
  ): () => void;
}

interface UserGroupMutationOptions {
  action:
    | 'createusergroup'
    | 'editusergroup'
    | 'deleteusergroup'
    | 'addusertousergroup'
    | 'removeuserfromusergroup';
  payload: Record<string, unknown>;
  matchesMessage: (message: Record<string, unknown>) => boolean;
  verify: () => Promise<unknown | undefined>;
}

const mutationChains = new WeakMap<ResourceClient, Promise<void>>();
const USER_GROUP_CONFIRMATION_TIMEOUT_MS = 5_000;

function required(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new GatewayValidationError(`${name} is required.`);
  return normalized;
}

function requiredId(value: string, prefix: string, name: string): string {
  const normalized = required(value, name);
  if (!normalized.startsWith(prefix)) {
    throw new GatewayValidationError(`${name} must start with ${prefix}.`);
  }
  return normalized;
}

function optional(value: string | undefined): string | undefined {
  return value === undefined ? undefined : value.trim();
}

function messageRecord(message: unknown): Record<string, unknown> | undefined {
  if (!isRecord(message)) return undefined;
  return isRecord(message.event) ? message.event : message;
}

function mutationError(message: unknown, action: string): string | undefined {
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

function successfulResponse(message: Record<string, unknown>, action: string): boolean {
  return (
    message.action === action &&
    typeof message.result === 'string' &&
    ['ok', 'success'].includes(message.result.toLowerCase())
  );
}

function eventUserGroupId(message: Record<string, unknown>): string | undefined {
  return stringValue(message.ugrpid);
}

function linkType(id: string): UserGroupLinkType {
  if (id.startsWith('user//')) return 'user';
  if (id.startsWith('mesh//')) return 'device-group';
  if (id.startsWith('node//')) return 'device';
  return 'unknown';
}

function normalizeUserGroupLinks(value: unknown): UserGroupLink[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([id, link]) => {
    const record = isRecord(link) ? link : {};
    const type = linkType(id);
    const rawRights = typeof record.rights === 'number' ? record.rights : undefined;
    return {
      id,
      type,
      rights:
        type === 'user'
          ? normalizeUserGroupMemberRights(rawRights)
          : normalizeUserGroupTargetRights(rawRights ?? 0),
      name: stringValue(record.name),
      raw: link,
    };
  });
}

function normalizeUserGroup(value: unknown, fallbackId?: string): UserGroup | undefined {
  if (!isRecord(value)) return undefined;
  const id = stringValue(value._id) ?? stringValue(value.id) ?? fallbackId;
  if (!id) return undefined;
  return {
    id,
    name: stringValue(value.name) ?? id,
    description: stringValue(value.description) ?? stringValue(value.desc),
    domain: stringValue(value.domain),
    flags: normalizeUserGroupMemberRights(
      typeof value.flags === 'number' ? value.flags : undefined,
    ),
    consent: normalizeUserGroupConsent(
      typeof value.consent === 'number' ? value.consent : undefined,
    ),
    links: normalizeUserGroupLinks(value.links),
    raw: value,
  };
}

function normalizeUserGroups(value: unknown): UserGroup[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeUserGroup(item))
      .filter((item): item is UserGroup => Boolean(item));
  }
  if (!isRecord(value)) return [];
  return Object.entries(value)
    .map(([id, item]) => normalizeUserGroup(item, id))
    .filter((item): item is UserGroup => Boolean(item));
}

export class UserGroupsResource {
  constructor(private readonly client: ResourceClient) {}

  async list(): Promise<UserGroup[]> {
    const response = await this.client.request<unknown>({ action: 'usergroups' });
    return normalizeUserGroups(isRecord(response) ? (response.ugroups ?? response.usergroups) : undefined);
  }

  create(options: UserGroupCreateOptions): Promise<unknown> {
    const name = required(options.name, 'User group name');
    const cloneUserGroupId = options.cloneUserGroupId
      ? requiredId(options.cloneUserGroupId, 'ugrp//', 'Clone user group ID')
      : undefined;
    return this.mutate({
      action: 'createusergroup',
      payload: {
        action: 'createusergroup',
        name,
        desc: optional(options.description),
        ...(cloneUserGroupId ? { clone: cloneUserGroupId } : {}),
      },
      matchesMessage: (message) =>
        (successfulResponse(message, 'createusergroup') &&
          typeof message.ugrpid === 'string') ||
        (message.etype === 'ugrp' &&
          message.action === 'createusergroup' &&
          message.name === name),
      verify: async () =>
        (await this.list()).find((group) => group.name.toLowerCase() === name.toLowerCase()),
    });
  }

  update(userGroupId: string, updates: UserGroupUpdate): Promise<unknown> {
    const ugrpid = requiredId(userGroupId, 'ugrp//', 'User group ID');
    const name = required(updates.name, 'User group name');
    const description = optional(updates.description);
    return this.mutate({
      action: 'editusergroup',
      payload: { action: 'editusergroup', ugrpid, name, desc: description },
      matchesMessage: (message) =>
        (successfulResponse(message, 'editusergroup') && message.ugrpid === ugrpid) ||
        (message.etype === 'ugrp' &&
          message.action === 'usergroupchange' &&
          eventUserGroupId(message) === ugrpid &&
          message.name === name),
      verify: async () => {
        const group = (await this.list()).find((item) => item.id === ugrpid);
        return group?.name === name && group.description === description ? group : undefined;
      },
    });
  }

  remove(userGroupId: string): Promise<unknown> {
    const ugrpid = requiredId(userGroupId, 'ugrp//', 'User group ID');
    return this.mutate({
      action: 'deleteusergroup',
      payload: { action: 'deleteusergroup', ugrpid },
      matchesMessage: (message) =>
        (successfulResponse(message, 'deleteusergroup') && message.ugrpid === ugrpid) ||
        (message.etype === 'ugrp' &&
          message.action === 'deleteusergroup' &&
          eventUserGroupId(message) === ugrpid),
      verify: async () =>
        (await this.list()).some((group) => group.id === ugrpid)
          ? undefined
          : { action: 'deleteusergroup', ugrpid },
    });
  }

  addUsers(userGroupId: string, usernames: readonly string[]): Promise<unknown> {
    const ugrpid = requiredId(userGroupId, 'ugrp//', 'User group ID');
    const normalizedUsernames = [...new Set(usernames.map((name) => name.trim()).filter(Boolean))];
    if (normalizedUsernames.length === 0) {
      throw new GatewayValidationError('At least one username is required.');
    }
    return this.mutate({
      action: 'addusertousergroup',
      payload: { action: 'addusertousergroup', ugrpid, usernames: normalizedUsernames },
      matchesMessage: (message) =>
        successfulResponse(message, 'addusertousergroup') ||
        (message.etype === 'ugrp' &&
          message.action === 'usergroupchange' &&
          eventUserGroupId(message) === ugrpid &&
          normalizedUsernames.every((username) =>
            Object.values(isRecord(message.links) ? message.links : {}).some(
              (link) => isRecord(link) && link.name === username && link.rights === 1,
            ),
          )),
      verify: async () => {
        const group = (await this.list()).find((item) => item.id === ugrpid);
        return group &&
          normalizedUsernames.every((username) =>
            group.links.some(
              (link) => link.type === 'user' && link.name === username && link.rights === 1,
            ),
          )
          ? group
          : undefined;
      },
    });
  }

  removeUser(userGroupId: string, userId: string): Promise<unknown> {
    const ugrpid = requiredId(userGroupId, 'ugrp//', 'User group ID');
    const userid = requiredId(userId, 'user//', 'User ID');
    return this.mutate({
      action: 'removeuserfromusergroup',
      payload: { action: 'removeuserfromusergroup', ugrpid, userid },
      matchesMessage: (message) =>
        successfulResponse(message, 'removeuserfromusergroup') ||
        (message.etype === 'ugrp' &&
          message.action === 'usergroupchange' &&
          eventUserGroupId(message) === ugrpid &&
          (!isRecord(message.links) || !Object.hasOwn(message.links, userid))),
      verify: async () => {
        const group = (await this.list()).find((item) => item.id === ugrpid);
        return group && !group.links.some((link) => link.id === userid) ? group : undefined;
      },
    });
  }

  private mutate(options: UserGroupMutationOptions): Promise<unknown> {
    const previous = mutationChains.get(this.client) ?? Promise.resolve();
    const operation = previous.then(() => this.mutateNow(options));
    mutationChains.set(
      this.client,
      operation.then(
        () => undefined,
        () => undefined,
      ),
    );
    return operation;
  }

  private mutateNow(options: UserGroupMutationOptions): Promise<unknown> {
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
        const error = mutationError(message, options.action);
        if (error) {
          finish(() => reject(new GatewayServerError(error, { action: options.action })));
          return;
        }
        const record = messageRecord(message);
        if (record && options.matchesMessage(record)) finish(() => resolve(record));
      });
      const unsubscribeConnection = this.client.on(
        'connection',
        (change: ConnectionStateChange) => {
          if (change.current === 'disconnected' || change.current === 'error') {
            finish(() =>
              reject(
                new GatewayConnectionClosedError(
                  'Gateway connection closed during user group operation.',
                  { action: options.action, retryable: true },
                ),
              ),
            );
          }
        },
      );
      const timeout = setTimeout(() => {
        void options.verify().then(
          (verified) => {
            if (verified !== undefined) finish(() => resolve(verified));
            else
              finish(() =>
                reject(
                  new GatewayRequestTimeoutError(
                    `User group operation was not confirmed: ${options.action}`,
                    { action: options.action, retryable: true },
                  ),
                ),
              );
          },
          (error) => finish(() => reject(error)),
        );
      }, USER_GROUP_CONFIRMATION_TIMEOUT_MS);

      try {
        this.client.send(options.payload);
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))));
      }
    });
  }
}
