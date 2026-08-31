import { GatewayValidationError } from '../errors';
import {
  isRecord,
  normalizeDevice,
  normalizeDevices,
  normalizeLastConnects,
} from '../protocol/normalizers';
import type { Device, DeviceDetails, DeviceUpdate, PowerAction } from '../types';

interface ResourceClient {
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
}
const required = (value: string, name: string) => {
  if (!value.trim()) throw new GatewayValidationError(`${name} is required.`);
};

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

  async powerAction(deviceId: string, action: PowerAction): Promise<unknown> {
    required(deviceId, 'Device ID');
    return action === 'wake'
      ? this.client.request({ action: 'wakenode', nodeid: deviceId })
      : this.client.request({ action: 'poweraction', nodeid: deviceId, subaction: action });
  }

  normalize(value: unknown): Device | undefined {
    return normalizeDevice(value);
  }
}
