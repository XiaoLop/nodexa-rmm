import type {
  Device,
  DeviceGroup,
  ManagedUser,
  UserGroupLink,
} from '@meshcentral/control-client';

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Filters the user links of a user group by the member's name, real name,
 * e-mail or id. Falls back to the link name/id when the member cannot be
 * resolved. An empty query returns the original list (same reference) so
 * `useMemo` consumers keep referential identity.
 */
export function filterMemberLinks(
  links: UserGroupLink[],
  users: ManagedUser[],
  query: string,
): UserGroupLink[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return links;
  return links.filter((link) => {
    const user = users.find((item) => item.id === link.id);
    return (
      (user?.name ?? link.name ?? link.id).toLowerCase().includes(normalized) ||
      Boolean(user?.realName?.toLowerCase().includes(normalized)) ||
      Boolean(user?.email?.toLowerCase().includes(normalized)) ||
      link.id.toLowerCase().includes(normalized)
    );
  });
}

/**
 * Filters the device-group links of a user group by the target group name or
 * id, falling back to the link name/id when the group cannot be resolved.
 */
export function filterGroupLinks(
  links: UserGroupLink[],
  groups: DeviceGroup[],
  query: string,
): UserGroupLink[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return links;
  return links.filter((link) => {
    const target = groups.find((item) => item.id === link.id);
    return (
      (target?.name ?? link.name ?? link.id).toLowerCase().includes(normalized) ||
      link.id.toLowerCase().includes(normalized)
    );
  });
}

/**
 * Filters the device links of a user group by the target device name, its
 * device-group name or the link id, falling back to the link name/id when the
 * device cannot be resolved.
 */
export function filterDeviceLinks(
  links: UserGroupLink[],
  devices: Device[],
  query: string,
): UserGroupLink[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return links;
  return links.filter((link) => {
    const target = devices.find((item) => item.id === link.id);
    return (
      (target?.name ?? link.name ?? link.id).toLowerCase().includes(normalized) ||
      Boolean(target?.groupName?.toLowerCase().includes(normalized)) ||
      link.id.toLowerCase().includes(normalized)
    );
  });
}
