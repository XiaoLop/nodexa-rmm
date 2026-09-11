import { isRecord, stringValue } from '../protocol/normalizers';
import type { UserGroup } from '../types';

interface ResourceClient {
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
}

function normalizeUserGroup(value: unknown, fallbackId?: string): UserGroup | undefined {
  if (!isRecord(value)) return undefined;
  const id = stringValue(value._id) ?? stringValue(value.id) ?? fallbackId;
  if (!id) return undefined;
  return {
    id,
    name: stringValue(value.name) ?? id,
    description: stringValue(value.description) ?? stringValue(value.desc),
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
}
