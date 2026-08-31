import { GatewayValidationError } from '../errors';
import { isRecord, normalizeGroups } from '../protocol/normalizers';
import type { DeviceGroup, GroupCreateOptions, GroupUpdate } from '../types';

interface ResourceClient {
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
}
const required = (value: string, name: string) => {
  if (!value.trim()) throw new GatewayValidationError(`${name} is required.`);
};

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
      throw new GatewayValidationError('At least one group update is required.');
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
}
