import type { DeviceLocation } from '@meshcentral/control-client';

function languageCandidates(language: string): string[] {
  const normalized = language.toLowerCase();
  if (normalized === 'zh-cn' || normalized === 'zh-hans') return ['zh-CN', 'zh', 'en'];
  if (normalized === 'zh-tw' || normalized === 'zh-hk' || normalized === 'zh-hant') {
    return ['zh-TW', 'zh-CN', 'zh', 'en'];
  }
  const base = normalized.split('-')[0] ?? normalized;
  return [...new Set([language, normalized, base, 'en'])];
}

export function localizedLocationName(
  names: Record<string, string> | undefined,
  language: string,
): string | undefined {
  if (!names) return undefined;
  for (const candidate of languageCandidates(language)) {
    const exact = names[candidate];
    if (exact) return exact;
    const matchedKey = Object.keys(names).find(
      (key) => key.toLowerCase() === candidate.toLowerCase(),
    );
    if (matchedKey) return names[matchedKey];
  }
  return Object.values(names)[0];
}

function localizedCountryName(location: DeviceLocation, language: string): string | undefined {
  if (location.countryCode && typeof Intl.DisplayNames === 'function') {
    try {
      return new Intl.DisplayNames([language], { type: 'region' }).of(location.countryCode);
    } catch {
      // Fall through to the location-provided names.
    }
  }
  return localizedLocationName(location.countryNames, language);
}

export function formatDeviceLocation(
  location: DeviceLocation | undefined,
  language: string,
): string | undefined {
  if (!location) return undefined;
  const parts = [
    localizedCountryName(location, language),
    localizedLocationName(location.regionNames, language),
    localizedLocationName(location.cityNames, language),
  ].filter((value): value is string => Boolean(value));
  return [...new Set(parts)].join(' · ') || undefined;
}

export function deviceLocationSearchValues(location: DeviceLocation | undefined): string[] {
  if (!location) return [];
  return [
    location.countryCode,
    location.subdivisionCode,
    ...Object.values(location.countryNames ?? {}),
    ...Object.values(location.regionNames ?? {}),
    ...Object.values(location.cityNames ?? {}),
  ].filter((value): value is string => Boolean(value));
}
