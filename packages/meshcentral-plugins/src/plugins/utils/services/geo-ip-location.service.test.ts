import { describe, expect, it, vi } from 'vitest';
import type { MeshCentralDatabase } from '../../../types/meshcentral.types.js';
import { GeoIpLocationService, publicIp } from './geo-ip-location.service.js';

function databaseReturning(document: unknown): MeshCentralDatabase {
  return {
    Get: vi.fn((_id: string, callback: (error: unknown, documents: unknown[]) => void) => {
      callback(undefined, [document]);
    }),
  };
}

describe('GeoIpLocationService', () => {
  it('reads the city and country from the iploc database record', async () => {
    const database = databaseReturning({
      _id: 'iploc_8.8.8.8',
      ip: '8.8.8.8',
      city: 'Mountain View',
      region: 'California',
      country: 'US',
      loc: '37.4056,-122.0775',
      timezone: 'America/Los_Angeles',
    });

    const location = await new GeoIpLocationService(database).lookup('8.8.8.8');

    expect(database.Get).toHaveBeenCalledWith('iploc_8.8.8.8', expect.any(Function));
    expect(location).toMatchObject({
      lookupIp: '8.8.8.8',
      countryCode: 'US',
      regionNames: { en: 'California' },
      cityNames: { en: 'Mountain View' },
      latitude: 37.4056,
      longitude: -122.0775,
      timezone: 'America/Los_Angeles',
      source: 'iploc-db',
    });
    expect(location?.countryNames).toBeUndefined();
  });

  it('reads a nested iplocation payload', async () => {
    const database = databaseReturning({
      _id: 'iploc_1.1.1.1',
      ip: '1.1.1.1',
      iplocation: { city: 'Sydney', region: 'New South Wales', country: 'AU' },
    });

    const location = await new GeoIpLocationService(database).lookup('1.1.1.1');

    expect(location).toMatchObject({
      countryCode: 'AU',
      regionNames: { en: 'New South Wales' },
      cityNames: { en: 'Sydney' },
    });
  });

  it('skips the database for non-public addresses', async () => {
    const database = databaseReturning({
      city: 'Internal',
      country: 'US',
    });

    expect(await new GeoIpLocationService(database).lookup('192.168.1.10')).toBeUndefined();
    expect(await new GeoIpLocationService(database).lookup('not-an-ip')).toBeUndefined();
    expect(database.Get).not.toHaveBeenCalled();
  });

  it('returns undefined when the record or database is unavailable', async () => {
    expect(await new GeoIpLocationService(databaseReturning({ _id: 'iploc_8.8.8.8' })).lookup('8.8.8.8'))
      .toBeUndefined();
    expect(await new GeoIpLocationService().lookup('8.8.8.8')).toBeUndefined();
  });
});

describe('publicIp', () => {
  it('normalizes IPv4-mapped IPv6 addresses', () => {
    expect(publicIp('::ffff:8.8.8.8')).toBe('8.8.8.8');
  });
});
