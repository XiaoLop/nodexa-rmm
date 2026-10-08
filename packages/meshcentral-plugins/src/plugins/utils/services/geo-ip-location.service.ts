import ipaddr from 'ipaddr.js';
import maxmind, { type CityResponse, type Reader } from 'maxmind';
import type { GeoIpLocation, GeoIpLocationLookup, LocalizedNames } from '../utils.types.js';

const DEFAULT_MMDB_PATH = '/data/GeoLite2-City.mmdb';
const SUPPORTED_LANGUAGES = ['en', 'zh-CN', 'zh-TW'] as const;

function localizedNames(value: object | undefined): LocalizedNames | undefined {
  if (!value) return undefined;
  const names: LocalizedNames = {};
  for (const language of SUPPORTED_LANGUAGES) {
    const name = Reflect.get(value, language);
    if (typeof name === 'string' && name.trim()) names[language] = name;
  }
  return Object.keys(names).length > 0 ? names : undefined;
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
  private reader?: Reader<CityResponse>;
  private initialization?: Promise<void>;
  private version?: string;

  constructor(
    private readonly databasePath = process.env.NODEXA_GEOIP_MMDB_PATH ?? DEFAULT_MMDB_PATH,
    private readonly openDatabase = maxmind.open<CityResponse>,
  ) {}

  get databaseVersion(): string | undefined {
    return this.version;
  }

  initialize(): Promise<void> {
    if (this.reader) return Promise.resolve();
    this.initialization ??= this.openDatabase(this.databasePath, { watchForUpdates: false })
      .then((reader) => {
        this.reader = reader;
        this.version = reader.metadata.buildEpoch.toISOString();
        console.log(
          `[utils] GeoIP database loaded: ${reader.metadata.databaseType} (${this.version})`,
        );
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[utils] GeoIP database unavailable at ${this.databasePath}: ${message}`);
      });
    return this.initialization;
  }

  lookup(ip: string): GeoIpLocation | undefined {
    if (!this.reader || !this.version) return undefined;
    const normalizedIp = publicIp(ip);
    if (!normalizedIp) return undefined;
    const result = this.reader.get(normalizedIp);
    if (!result) return undefined;

    const country = result.country ?? result.registered_country;
    const subdivision = result.subdivisions?.[0];
    const countryNames = localizedNames(country?.names);
    const regionNames = localizedNames(subdivision?.names);
    const cityNames = localizedNames(result.city?.names);
    if (!country?.iso_code && !countryNames && !regionNames && !cityNames) return undefined;

    return {
      lookupIp: normalizedIp,
      countryCode: country?.iso_code,
      subdivisionCode: subdivision?.iso_code,
      countryNames,
      regionNames,
      cityNames,
      latitude: result.location?.latitude,
      longitude: result.location?.longitude,
      timezone: result.location?.time_zone,
      source: 'geoip-mmdb',
      databaseVersion: this.version,
      resolvedAt: Math.floor(Date.now() / 1000),
    };
  }
}
