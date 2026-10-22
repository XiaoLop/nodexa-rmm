import ipaddr from 'ipaddr.js';
import type { MeshCentralDatabase } from '../../../types/meshcentral.types.js';
import type { GeoIpLocation, GeoIpLocationLookup, LocalizedNames } from '../utils.types.js';

const IP_LOCATION_KEY_PREFIX = 'iploc_';
const LOOKUP_TIMEOUT_MS = 10_000;
const NESTED_LOCATION_FIELDS = ['iplocation', 'iploc', 'location', 'data', 'value', 'result'] as const;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function firstText(source: UnknownRecord, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = asText(source[key]);
    if (value) return value;
  }
  return undefined;
}

function firstNumber(source: UnknownRecord, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    const numeric = typeof value === 'number' ? value : Number(asText(value));
    if (Number.isFinite(numeric)) return numeric;
  }
  return undefined;
}

function localizedNames(value: string | undefined): LocalizedNames | undefined {
  return value ? { en: value } : undefined;
}

function hasLocationFields(value: UnknownRecord): boolean {
  return (
    ['city', 'country', 'country_code', 'countryCode', 'region', 'loc'].some(
      (key) => asText(value[key]) !== undefined,
    ) ||
    firstNumber(value, ['latitude', 'lat']) !== undefined ||
    firstNumber(value, ['longitude', 'lon', 'lng']) !== undefined
  );
}

function parseJson(value: unknown): unknown {
  const text = asText(value);
  if (!text || !text.startsWith('{')) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function locationRecord(value: unknown, depth = 0): UnknownRecord | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  if (hasLocationFields(record)) return record;
  if (depth >= NESTED_LOCATION_FIELDS.length) return undefined;
  for (const key of NESTED_LOCATION_FIELDS) {
    const found =
      locationRecord(record[key], depth + 1) ?? locationRecord(parseJson(record[key]), depth + 1);
    if (found) return found;
  }
  return undefined;
}

function coordinates(record: UnknownRecord): { latitude?: number; longitude?: number } {
  const loc = firstText(record, ['loc']);
  if (loc) {
    const [latitudeText, longitudeText] = loc.split(',');
    const latitude = Number(latitudeText);
    const longitude = Number(longitudeText);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude };
  }
  return {
    latitude: firstNumber(record, ['latitude', 'lat']),
    longitude: firstNumber(record, ['longitude', 'lon', 'lng']),
  };
}

export function publicIp(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim() || !ipaddr.isValid(value.trim())) return undefined;
  let address = ipaddr.parse(value.trim());
  if (address.kind() === 'ipv6') {
    const ipv6Address = address as ipaddr.IPv6;
    if (ipv6Address.isIPv4MappedAddress()) address = ipv6Address.toIPv4Address();
  }
  if (address.range() !== 'unicast') return undefined;
  return address.toString();
}

export class GeoIpLocationService implements GeoIpLocationLookup {
  constructor(private readonly database?: MeshCentralDatabase) {}

  async lookup(ip: string): Promise<GeoIpLocation | undefined> {
    const normalizedIp = publicIp(ip);
    if (!normalizedIp) return undefined;

    const document = await this.getLocationDocument(normalizedIp);
    const record = locationRecord(document);
    if (!record) return undefined;

    const countryCode = firstText(record, ['country', 'country_code', 'countryCode']);
    const countryNames = localizedNames(firstText(record, ['country_name', 'countryName']));
    const regionNames = localizedNames(firstText(record, ['region_name', 'regionName', 'region']));
    const cityNames = localizedNames(firstText(record, ['city']));
    if (!countryCode && !countryNames && !regionNames && !cityNames) return undefined;

    return {
      lookupIp: normalizedIp,
      countryCode,
      subdivisionCode: firstText(record, ['region_code', 'regionCode', 'subdivisionCode']),
      countryNames,
      regionNames,
      cityNames,
      ...coordinates(record),
      timezone: firstText(record, ['timezone', 'time_zone']),
      source: 'iploc-db',
      resolvedAt: Math.floor(Date.now() / 1000),
    };
  }

  private getLocationDocument(ip: string): Promise<unknown> {
    const get = this.database?.Get;
    if (!get) return Promise.resolve(undefined);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(undefined), LOOKUP_TIMEOUT_MS);
      try {
        get(`${IP_LOCATION_KEY_PREFIX}${ip}`, (error, documents) => {
          if (error || !Array.isArray(documents) || documents.length === 0) {
            finish(undefined);
            return;
          }
          finish(documents[0]);
        });
      } catch {
        finish(undefined);
      }
    });
  }
}
