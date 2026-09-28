import {
  GatewayConnectionClosedError,
  GatewayRequestTimeoutError,
  GatewayServerError,
  GatewayValidationError,
} from '../errors';
import { isRecord } from '../protocol/normalizers';
import {
  normalizeManagedUsers,
  normalizeUserSessionCounts,
  setUserLocked,
} from '../protocol/userNormalizers';
import type {
  ConnectionStateChange,
  GatewayClientEvents,
  GatewayEventChannel,
  GatewayListener,
  ManagedUser,
  PreviousLogin,
  UserCreateOptions,
  UserSessionCounts,
  UserUpdate,
} from '../types';

interface ResourceClient {
  send(payload: unknown): void;
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
  on<K extends GatewayEventChannel>(
    channel: K,
    listener: GatewayListener<GatewayClientEvents[K]>,
  ): () => void;
}

interface UserMutationOptions {
  action:
    | 'adduser'
    | 'edituser'
    | 'deleteuser'
    | 'updateUserImage'
    | 'changeemail'
    | 'changepassword';
  payload: Record<string, unknown>;
  matchesEvent: (event: Record<string, unknown>) => boolean;
  verify: () => Promise<unknown | undefined>;
}

const mutationChains = new WeakMap<ResourceClient, Promise<void>>();
const USER_MUTATION_CONFIRMATION_TIMEOUT_MS = 5_000;

function required(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new GatewayValidationError(`${name} is required.`);
  return normalized;
}

function optional(value: string | undefined): string | undefined {
  return value === undefined ? undefined : value.trim();
}

function requiredEmail(value: string): string {
  const email = required(value, 'Email');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new GatewayValidationError('Email address is invalid.');
  }
  return email;
}

function userEvent(message: unknown): Record<string, unknown> | undefined {
  if (!isRecord(message)) return undefined;
  const event = isRecord(message.event) ? message.event : message;
  return event.etype === 'user' && typeof event.action === 'string' ? event : undefined;
}

function eventAccount(event: Record<string, unknown>): Record<string, unknown> | undefined {
  return isRecord(event.account) ? event.account : undefined;
}

function normalizePreviousLogins(value: unknown): PreviousLogin[] {
  if (!isRecord(value) || !Array.isArray(value.events)) return [];
  return value.events.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.t !== 'string') return [];
    const occurredAt = new Date(entry.t);
    if (Number.isNaN(occurredAt.getTime())) return [];
    const args = Array.isArray(entry.a) ? entry.a : [];
    return [{
      occurredAt: occurredAt.toISOString(),
      messageId:
        typeof entry.m === 'number' && Number.isInteger(entry.m) ? entry.m : undefined,
      ip: typeof args[0] === 'string' ? args[0] : undefined,
      client: typeof args[1] === 'string' ? args[1] : undefined,
      platform: typeof args[2] === 'string' ? args[2] : undefined,
    }];
  });
}

function matchesUserId(event: Record<string, unknown>, userId: string): boolean {
  const account = eventAccount(event);
  return event.userid === userId || account?._id === userId || account?.id === userId;
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

export class UsersResource {
  constructor(private readonly client: ResourceClient) {}

  async list(): Promise<ManagedUser[]> {
    const response = await this.client.request<unknown>({ action: 'users' });
    return normalizeManagedUsers(isRecord(response) ? (response.users ?? response) : response);
  }

  async listSessionCounts(): Promise<UserSessionCounts> {
    const response = await this.client.request<unknown>({ action: 'wssessioncount' });
    return normalizeUserSessionCounts(response);
  }

  async listPreviousLogins(): Promise<PreviousLogin[]> {
    const response = await this.client.request<unknown>({ action: 'previousLogins' });
    return normalizePreviousLogins(response);
  }

  async create(options: UserCreateOptions): Promise<unknown> {
    const username = required(options.username, 'Username');
    const randomPassword = options.randomPassword === true;
    if (!randomPassword) required(options.password ?? '', 'Password');
    const existing = (await this.list()).some(
      (user) => user.name.toLowerCase() === username.toLowerCase(),
    );
    if (existing) throw new GatewayValidationError(`User ${username} already exists.`);
    return this.mutate({
      action: 'adduser',
      payload: {
        action: 'adduser',
        username,
        pass: randomPassword ? '' : options.password,
        email: optional(options.email),
        realname: optional(options.realName),
        phone: optional(options.phone),
        resetNextLogin: options.resetNextLogin ?? false,
        randomPassword,
        removeEvents: false,
      },
      matchesEvent: (event) => {
        if (event.action !== 'accountcreate') return false;
        const account = eventAccount(event);
        return event.username === username || account?.name === username;
      },
      verify: async () =>
        (await this.list()).find((user) => user.name.toLowerCase() === username.toLowerCase()),
    });
  }

  update(userId: string, updates: UserUpdate): Promise<unknown> {
    const userid = required(userId, 'User ID');
    const payload = {
      email: optional(updates.email),
      realname: optional(updates.realName),
      phone: optional(updates.phone),
    };
    if (Object.values(payload).every((value) => value === undefined)) {
      throw new GatewayValidationError('At least one user update is required.');
    }
    return this.mutate({
      action: 'edituser',
      payload: { action: 'edituser', id: userid, ...payload },
      matchesEvent: (event) => event.action === 'accountchange' && matchesUserId(event, userid),
      verify: async () => {
        const user = (await this.list()).find((item) => item.id === userid);
        if (!user) return undefined;
        if (updates.email !== undefined && user.email !== optional(updates.email)) return undefined;
        if (updates.realName !== undefined && user.realName !== optional(updates.realName))
          return undefined;
        if (updates.phone !== undefined && user.phone !== optional(updates.phone)) return undefined;
        return user;
      },
    });
  }

  updateImage(userId: string, image: string): void {
    const userid = required(userId, 'User ID');
    if (!/^data:image\/(?:jpeg|png|gif|webp);base64,[a-z\d+/]+=*$/i.test(image)) {
      throw new GatewayValidationError('User image must be a base64 image data URL.');
    }
    this.client.send({ action: 'updateUserImage', userid, image });
  }

  updateCurrentImage(userId: string, image: string): Promise<unknown> {
    const userid = required(userId, 'User ID');
    if (!/^data:image\/(?:jpeg|png|gif|webp);base64,[a-z\d+/]+=*$/i.test(image)) {
      throw new GatewayValidationError('User image must be a base64 image data URL.');
    }
    return this.mutate({
      action: 'updateUserImage',
      payload: { action: 'updateUserImage', image, userid },
      matchesEvent: (event) =>
        event.action === 'accountchange' &&
        matchesUserId(event, userid) &&
        event.accountImageChange === 1,
      verify: async () => undefined,
    });
  }

  changeCurrentEmail(userId: string, email: string): Promise<unknown> {
    const userid = required(userId, 'User ID');
    const normalizedEmail = requiredEmail(email);
    return this.mutate({
      action: 'changeemail',
      payload: { action: 'changeemail', email: normalizedEmail },
      matchesEvent: (event) => {
        const account = eventAccount(event);
        return event.action === 'accountchange' &&
          matchesUserId(event, userid) &&
          account?.email === normalizedEmail;
      },
      verify: async () => undefined,
    });
  }

  changeCurrentPassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<unknown> {
    const userid = required(userId, 'User ID');
    const oldpass = required(oldPassword, 'Current password');
    const newpass = required(newPassword, 'New password');
    if (oldpass === newpass) {
      throw new GatewayValidationError('New password must differ from the current password.');
    }
    return this.mutate({
      action: 'changepassword',
      payload: { action: 'changepassword', oldpass, newpass },
      matchesEvent: (event) =>
        event.action === 'accountchange' &&
        matchesUserId(event, userid) &&
        Boolean(eventAccount(event)?.passchange),
      verify: async () => undefined,
    });
  }

  setLocked(userId: string, locked: boolean, currentSiteRights: number): Promise<unknown> {
    const id = required(userId, 'User ID');
    return this.mutate({
      action: 'edituser',
      payload: {
        action: 'edituser',
        id,
        siteadmin: setUserLocked(currentSiteRights, locked),
      },
      matchesEvent: (event) => event.action === 'accountchange' && matchesUserId(event, id),
      verify: async () => {
        const user = (await this.list()).find((item) => item.id === id);
        return user?.locked === locked ? user : undefined;
      },
    });
  }

  setSiteRights(userId: string, siteRights: number): Promise<unknown> {
    const id = required(userId, 'User ID');
    if (!Number.isInteger(siteRights) || siteRights < 0 || siteRights > 0xffffffff) {
      throw new GatewayValidationError('Site rights must be an unsigned 32-bit integer.');
    }
    return this.mutate({
      action: 'edituser',
      payload: { action: 'edituser', id, siteadmin: siteRights >>> 0 },
      matchesEvent: (event) => event.action === 'accountchange' && matchesUserId(event, id),
      verify: async () => {
        const user = (await this.list()).find((item) => item.id === id);
        return user?.siteRights === (siteRights >>> 0) ? user : undefined;
      },
    });
  }

  setRemoveRights(userId: string, removeRights: number): Promise<unknown> {
    const id = required(userId, 'User ID');
    if (!Number.isInteger(removeRights) || removeRights < 0 || removeRights > 0xffffffff) {
      throw new GatewayValidationError('Remove rights must be an unsigned 32-bit integer.');
    }
    const normalizedRemoveRights = removeRights >>> 0;
    return this.mutate({
      action: 'edituser',
      payload: { action: 'edituser', id, removeRights: normalizedRemoveRights },
      matchesEvent: (event) => event.action === 'accountchange' && matchesUserId(event, id),
      verify: async () => {
        const user = (await this.list()).find((item) => item.id === id);
        return user?.removeRights === normalizedRemoveRights ? user : undefined;
      },
    });
  }

  remove(userId: string, username?: string): Promise<unknown> {
    const userid = required(userId, 'User ID');
    const normalizedUsername = required(
      username ?? userid.replace(/^user\/\/[^/]*\//, '').replace(/^user\/\//, ''),
      'Username',
    );
    return this.mutate({
      action: 'deleteuser',
      payload: { action: 'deleteuser', userid, username: normalizedUsername },
      matchesEvent: (event) =>
        event.action === 'accountremove' &&
        (matchesUserId(event, userid) || event.username === normalizedUsername),
      verify: async () => {
        const exists = (await this.list()).some((user) => user.id === userid);
        return exists
          ? undefined
          : { action: 'accountremove', userid, username: normalizedUsername };
      },
    });
  }

  private mutate(options: UserMutationOptions): Promise<unknown> {
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

  private mutateNow(options: UserMutationOptions): Promise<unknown> {
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
        const event = userEvent(message);
        if (event && options.matchesEvent(event)) finish(() => resolve(event));
      });
      const unsubscribeConnection = this.client.on(
        'connection',
        (change: ConnectionStateChange) => {
          if (change.current === 'disconnected' || change.current === 'error') {
            finish(() =>
              reject(
                new GatewayConnectionClosedError(
                  'Gateway connection closed during user operation.',
                  {
                    action: options.action,
                    retryable: true,
                  },
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
                    `User operation was not confirmed: ${options.action}`,
                    { action: options.action, retryable: true },
                  ),
                ),
              );
          },
          (error) => finish(() => reject(error)),
        );
      }, USER_MUTATION_CONFIRMATION_TIMEOUT_MS);

      try {
        this.client.send(options.payload);
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))));
      }
    });
  }
}
