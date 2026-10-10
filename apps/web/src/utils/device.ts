import type { Device } from '@meshcentral/shared-state';

export function rawDeviceString(device: Device, key: string): string | undefined {
  const raw = device.raw as Record<string, unknown> | undefined;
  const value = raw?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function rawDeviceNumber(device: Device, key: string): number | undefined {
  const raw = device.raw as Record<string, unknown> | undefined;
  const value = raw?.[key];
  return typeof value === 'number' ? value : undefined;
}

export function deviceDescription(device: Device): string | undefined {
  return rawDeviceString(device, 'desc') ?? rawDeviceString(device, 'description');
}

export function deviceTags(device: Device): string[] {
  const raw = device.raw as Record<string, unknown> | undefined;
  const tagsSource = (device as unknown as { tags?: unknown }).tags ?? raw?.tags;
  if (Array.isArray(tagsSource)) {
    const list = tagsSource
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean);
    return Array.from(new Set(list));
  }
  if (typeof tagsSource === 'string') {
    const list = tagsSource
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    return Array.from(new Set(list));
  }
  return [];
}
