export type RightsMask = number;

export const FULL_RIGHTS = 0xffffffff;

export function normalizeRights(value: number | undefined): RightsMask {
  return typeof value === 'number' && Number.isFinite(value) ? value >>> 0 : 0;
}

export function isFullRights(rights: number): boolean {
  return normalizeRights(rights) === FULL_RIGHTS;
}

export function hasAllRights(rights: number, required: number): boolean {
  const normalized = normalizeRights(rights);
  const expected = normalizeRights(required);
  return normalized === FULL_RIGHTS || (normalized & expected) === expected;
}

export function hasAnyRight(rights: number, required: number): boolean {
  const normalized = normalizeRights(rights);
  return normalized === FULL_RIGHTS || (normalized & normalizeRights(required)) !== 0;
}

export function composeRights(flags: readonly number[]): RightsMask {
  return flags.reduce((rights, flag) => (rights | normalizeRights(flag)) >>> 0, 0);
}