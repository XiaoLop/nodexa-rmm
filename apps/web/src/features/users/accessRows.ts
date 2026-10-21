import type { UserLink } from '@meshcentral/control-client';
import { summarizeMeshRights } from './meshPermissions';

/** Translator signature shared by the access-row helpers and page mutations. */
export type Translator = (key: string, options?: Record<string, unknown>) => string;

export interface AccessRow {
  id: string;
  name: string;
  permission: string;
  rights: number;
}

/**
 * Localized permission summary for one access link. The translator must be
 * forwarded to `summarizeMeshRights` so the table text is localized instead of
 * falling back to the deprecated built-in Chinese labels.
 */
export function permissionLabel(rights: number, t: Translator): string {
  return summarizeMeshRights(rights, t);
}

/**
 * Resolves the links of a single type into table rows, keeping the server order
 * and falling back to the link id when no matching resource is loaded anymore.
 */
export function resolveAccessRows<T extends { id: string; name: string }>(
  links: UserLink[],
  type: UserLink['type'],
  resources: T[],
  t: Translator,
): AccessRow[] {
  const names = new Map(resources.map((resource) => [resource.id, resource.name]));
  return links
    .filter((link) => link.type === type)
    .map((link) => ({
      id: link.id,
      name: names.get(link.id) ?? link.id,
      permission: permissionLabel(link.rights, t),
      rights: link.rights,
    }));
}

/** Maps known server error messages to localized user-facing text. */
export function errorMessage(error: unknown, t: Translator): string {
  if (!(error instanceof Error)) return t('userDetails.errors.unknown');
  const serverMessages: Record<string, string> = {
    'Invalid rights': 'userDetails.errors.invalidRights',
    'Access denied': 'userDetails.errors.accessDenied',
    'Invalid user': 'userDetails.errors.invalidUser',
    'Invalid device': 'userDetails.errors.invalidDevice',
  };
  const key = serverMessages[error.message];
  return key ? t(key) : error.message;
}
