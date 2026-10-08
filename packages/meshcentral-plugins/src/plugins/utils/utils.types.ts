export type LocalizedNames = Record<string, string>;

export interface GeoIpLocation {
  lookupIp: string;
  countryCode?: string;
  subdivisionCode?: string;
  countryNames?: LocalizedNames;
  regionNames?: LocalizedNames;
  cityNames?: LocalizedNames;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  source: 'geoip-mmdb';
  databaseVersion: string;
  resolvedAt: number;
}

export interface GeoIpLocationLookup {
  readonly databaseVersion?: string;
  initialize(): Promise<void>;
  lookup(ip: string): GeoIpLocation | undefined;
}

export interface MeshCentralNodeDocument extends Record<string, unknown> {
  _id: string;
  domain?: string;
  meshid?: string;
  ip?: string;
  publicip?: string;
  nodexa?: Record<string, unknown> & {
    location?: Partial<GeoIpLocation>;
  };
}
