import {
  GatewayConnectionClosedError,
  GatewayRequestTimeoutError,
  GatewayServerError,
  GatewayValidationError,
} from '../errors';
import {
  isRecord,
  normalizeDevice,
  normalizeDevices,
  normalizeLastConnects,
} from '../protocol/normalizers';
import type {
  AgentEmailInviteOptions,
  AgentInviteLinkResult,
  AgentInviteResult,
  AgentLinkInviteOptions,
  BatchDeviceResult,
  BatchDeviceTarget,
  BatchOperationResult,
  Device,
  DeviceDetails,
  DeviceUpdate,
  ConnectionStateChange,
  GatewayClientEvents,
  GatewayEventChannel,
  GatewayListener,
  PowerAction,
} from '../types';

interface ResourceClient {
  send(payload: unknown): void;
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
  on<K extends GatewayEventChannel>(
    channel: K,
    listener: GatewayListener<GatewayClientEvents[K]>,
  ): () => void;
}
const DEVICE_USER_GROUP_CONFIRMATION_TIMEOUT_MS = 5_000;
const DEVICE_USER_RIGHTS_MASK =
  0x00000008 |
  0x00000010 |
  0x00000020 |
  0x00000040 |
  0x00000080 |
  0x00004000 |
  0x00008000;
const required = (value: string, name: string) => {
  if (!value.trim()) throw new GatewayValidationError(`${name} is required.`);
};

async function runWithConcurrency<T>(items: T[], task: (item: T) => Promise<void>, limit = 4) {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const item = items[index++]!;
        await task(item);
      }
    }),
  );
}

function normalizeBatchTargets(targets: Array<string | BatchDeviceTarget>): BatchDeviceTarget[] {
  if (!targets.length)
    throw new GatewayValidationError('At least one valid device ID is required.');
  const seen = new Set<string>();
  const normalized: BatchDeviceTarget[] = [];
  for (const target of targets) {
    const id = typeof target === 'string' ? target : target.id;
    if (!id?.trim()) throw new GatewayValidationError('At least one valid device ID is required.');
    if (!seen.has(id)) {
      seen.add(id);
      normalized.push({ id, name: typeof target === 'string' ? undefined : target.name });
    }
  }
  return normalized;
}

function batchResult(
  target: BatchDeviceTarget,
  status: BatchDeviceResult['status'],
  startedAt: number,
  message?: string,
): BatchDeviceResult {
  return {
    deviceId: target.id,
    deviceName: target.name || target.id,
    status,
    message,
    startedAt,
    finishedAt: Date.now(),
  };
}

export class DevicesResource {
  constructor(private readonly client: ResourceClient) {}

  async list(): Promise<Device[]> {
    const response = await this.client.request<unknown>({ action: 'nodes' });
    return normalizeDevices(isRecord(response) ? (response.nodes ?? response.devices) : undefined);
  }

  async listByGroup(groupId: string): Promise<Device[]> {
    required(groupId, 'Group ID');
    const response = await this.client.request<unknown>({ action: 'nodes', meshid: groupId });
    return normalizeDevices(isRecord(response) ? (response.nodes ?? response.devices) : undefined);
  }

  systemInfo<T = unknown>(deviceId: string, timeoutMs?: number): Promise<T> {
    required(deviceId, 'Device ID');
    return this.client.request<T>(
      { action: 'getsysinfo', nodeid: deviceId, nodeinfo: true },
      timeoutMs,
    );
  }

  networkInfo<T = unknown>(deviceId: string, timeoutMs?: number): Promise<T> {
    required(deviceId, 'Device ID');
    return this.client.request<T>({ action: 'getnetworkinfo', nodeid: deviceId }, timeoutMs);
  }

  lastConnect<T = unknown>(deviceId: string, timeoutMs?: number): Promise<T> {
    required(deviceId, 'Device ID');
    return this.client.request<T>({ action: 'lastconnect', nodeid: deviceId }, timeoutMs);
  }

  async lastConnects(): Promise<Record<string, string>> {
    const response = await this.client.request<unknown>({ action: 'lastconnects' });
    return normalizeLastConnects(isRecord(response) ? response.lastconnects : undefined);
  }

  async details(deviceId: string): Promise<DeviceDetails> {
    required(deviceId, 'Device ID');
    const [nodes, networkInfo, lastConnect, systemInfo] = await Promise.all([
      this.client.request<unknown>({ action: 'nodes' }),
      this.networkInfo(deviceId),
      this.lastConnect(deviceId),
      this.systemInfo(deviceId),
    ]);
    const devices = normalizeDevices(isRecord(nodes) ? (nodes.nodes ?? nodes.devices) : undefined);
    return {
      device: devices.find((device) => device.id === deviceId),
      networkInfo,
      lastConnect,
      systemInfo,
      raw: { nodes, networkInfo, lastConnect, systemInfo },
    };
  }

  async update(deviceId: string, updates: DeviceUpdate): Promise<unknown> {
    required(deviceId, 'Device ID');
    if (!updates.name && !updates.desc && !updates.groupId && !updates.tags)
      throw new GatewayValidationError('At least one device update is required.');
    return this.client.request({
      action: 'changedevice',
      nodeid: deviceId,
      name: updates.name,
      desc: updates.desc,
      meshid: updates.groupId,
      tags: updates.tags,
    });
  }

  async remove(deviceId: string): Promise<unknown> {
    required(deviceId, 'Device ID');
    return this.client.request({ action: 'removedevices', nodeids: [deviceId] });
  }

  setUserRights(deviceId: string, username: string, rights: number): Promise<unknown> {
    required(deviceId, 'Device ID');
    required(username, 'Username');
    if (!Number.isInteger(rights) || rights < 0 || rights > 0xffffffff) {
      throw new GatewayValidationError('Rights must be an unsigned 32-bit integer.');
    }
    if ((rights & ~DEVICE_USER_RIGHTS_MASK) !== 0) {
      throw new GatewayValidationError(
        'Device user rights contain permissions that are not valid for a single device.',
      );
    }
    return this.client.request({
      action: 'adddeviceuser',
      nodeid: deviceId,
      usernames: [username],
      rights: rights >>> 0,
    });
  }

  removeUser(deviceId: string, username: string): Promise<unknown> {
    required(deviceId, 'Device ID');
    required(username, 'Username');
    return this.client.request({
      action: 'adddeviceuser',
      nodeid: deviceId,
      usernames: [username],
      rights: 0,
      remove: true,
    });
  }

  setUserGroupRights(
    deviceId: string,
    deviceName: string,
    userGroupId: string,
    rights: number,
  ): Promise<unknown> {
    required(deviceId, 'Device ID');
    required(deviceName, 'Device name');
    required(userGroupId, 'User group ID');
    if (!userGroupId.startsWith('ugrp//')) {
      throw new GatewayValidationError('User group ID must start with ugrp//.');
    }
    if (!Number.isInteger(rights) || rights < 0 || rights > 0xffffffff) {
      throw new GatewayValidationError('Rights must be an unsigned 32-bit integer.');
    }
    if ((rights & ~DEVICE_USER_RIGHTS_MASK) !== 0) {
      throw new GatewayValidationError(
        'Device user group rights contain permissions that are not valid for a single device.',
      );
    }
    return this.mutateUserGroupRights({
      action: 'adddeviceuser',
      nodeid: deviceId,
      nodename: deviceName,
      userids: [userGroupId],
      rights: rights >>> 0,
      remove: false,
    }, userGroupId);
  }

  removeUserGroup(deviceId: string, userGroupId: string): Promise<unknown> {
    required(deviceId, 'Device ID');
    required(userGroupId, 'User group ID');
    if (!userGroupId.startsWith('ugrp//')) {
      throw new GatewayValidationError('User group ID must start with ugrp//.');
    }
    return this.mutateUserGroupRights(
      {
        action: 'adddeviceuser',
        nodeid: deviceId,
        userids: [userGroupId],
        rights: 0,
        remove: true,
      },
      userGroupId,
    );
  }

  private mutateUserGroupRights(
    payload: Record<string, unknown>,
    userGroupId: string,
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
        if (!isRecord(message)) return;
        if (message.action === action) {
          const error = message.error ?? message.err;
          const result = message.result;
          if (typeof error === 'string' && error) {
            finish(() => reject(new GatewayServerError(error, { action })));
            return;
          }
          if (
            typeof result === 'string' &&
            !['ok', 'success'].includes(result.toLowerCase())
          ) {
            finish(() => reject(new GatewayServerError(result, { action })));
            return;
          }
        }
        const event = isRecord(message.event) ? message.event : message;
        if (
          event.etype === 'ugrp' &&
          event.action === 'usergroupchange' &&
          event.ugrpid === userGroupId
        ) {
          finish(() => resolve(event));
        }
      });
      const unsubscribeConnection = this.client.on(
        'connection',
        (change: ConnectionStateChange) => {
          if (change.current === 'disconnected' || change.current === 'error') {
            finish(() =>
              reject(
                new GatewayConnectionClosedError(
                  'Connection closed during device user group permission update.',
                  { action, retryable: true },
                ),
              ),
            );
          }
        },
      );
      const timeout = setTimeout(
        () =>
          finish(() =>
            reject(
              new GatewayRequestTimeoutError(`Timed out waiting for ${action} confirmation.`, {
                action,
                retryable: true,
              }),
            ),
          ),
        DEVICE_USER_GROUP_CONFIRMATION_TIMEOUT_MS,
      );
      try {
        this.client.send(payload);
      } catch (error) {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))));
      }
    });
  }

  async powerAction(deviceId: string, action: PowerAction): Promise<unknown> {
    required(deviceId, 'Device ID');
    return action === 'wake'
      ? this.client.request({ action: 'wakenode', nodeid: deviceId })
      : this.client.request({ action: 'poweraction', nodeid: deviceId, subaction: action });
  }

  async updateManyGroup(
    deviceIds: Array<string | BatchDeviceTarget>,
    groupId: string,
  ): Promise<BatchOperationResult> {
    required(groupId, 'Group ID');
    const targets = normalizeBatchTargets(deviceIds);
    const results = new Map<string, BatchDeviceResult>();
    await runWithConcurrency(targets, async (target) => {
        const startedAt = Date.now();
        try {
          await this.update(target.id, { groupId });
          results.set(target.id, batchResult(target, 'submitted', startedAt));
        } catch (error) {
          results.set(
            target.id,
            batchResult(
              target,
              'failed',
              startedAt,
              error instanceof Error ? error.message : 'Device update failed.',
            ),
          );
        }
      });
    const ordered = targets.map((target) => results.get(target.id)!);
    return { results: ordered, raw: ordered };
  }

  async powerMany(
    deviceIds: Array<string | BatchDeviceTarget>,
    action: PowerAction,
  ): Promise<BatchOperationResult> {
    if (!['wake', 'reset', 'poweroff', 'sleep'].includes(action))
      throw new GatewayValidationError('A valid power action is required.');
    const targets = normalizeBatchTargets(deviceIds);
    if (action === 'wake') {
      const startedAt = Date.now();
      try {
        const raw = await this.client.request({ action: 'wakedevices', nodeids: targets.map(({ id }) => id) });
        return { results: targets.map((target) => batchResult(target, 'submitted', startedAt)), raw };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Wake request failed.';
        const results = targets.map((target) => batchResult(target, 'failed', startedAt, message));
        return { results, raw: error };
      }
    }
    const results = new Map<string, BatchDeviceResult>();
    await runWithConcurrency(targets, async (target) => {
      const startedAt = Date.now();
      try {
        await this.powerAction(target.id, action);
        results.set(target.id, batchResult(target, 'submitted', startedAt));
      } catch (error) {
        results.set(
          target.id,
          batchResult(
            target,
            'failed',
            startedAt,
            error instanceof Error ? error.message : 'Power request failed.',
          ),
        );
      }
    });
    const ordered = targets.map((target) => results.get(target.id)!);
    return {
      results: ordered,
      raw: ordered,
    };
  }

  async inviteByEmail(options: AgentEmailInviteOptions): Promise<AgentInviteResult> {
    required(options.groupId, 'Group ID');
    if (!/^\S+@\S+\.\S+$/.test(options.email))
      throw new GatewayValidationError('A valid email address is required.');
    const raw = await this.client.request({
      action: 'inviteAgent',
      meshid: options.groupId,
      email: options.email.trim(),
      name: options.name?.trim(),
      msg: options.message?.trim(),
      os: options.os ?? '0',
    });
    return { raw };
  }

  async createInviteLink(options: AgentLinkInviteOptions): Promise<AgentInviteLinkResult> {
    required(options.groupId, 'Group ID');
    const expire = options.expireHours ?? 24;
    if (!Number.isInteger(expire) || expire < 0)
      throw new GatewayValidationError('Expiration must be a non-negative number of hours.');
    const raw = await this.client.request<Record<string, unknown>>({
      action: 'createInviteLink',
      meshid: options.groupId,
      expire,
      flags: options.flags ?? 0,
    });
    const url = [raw.url, raw.link, raw.inviteLink].find(
      (value): value is string => typeof value === 'string',
    );
    return { url, raw };
  }

  normalize(value: unknown): Device | undefined {
    return normalizeDevice(value);
  }
}
