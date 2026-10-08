import { describe, expect, it } from 'vitest';
import { formatDeviceLocation, localizedLocationName } from './formatDeviceLocation';

const location = {
  lookupIp: '8.8.8.8',
  countryCode: 'US',
  countryNames: { en: 'United States', 'zh-CN': '美国' },
  regionNames: { en: 'California', 'zh-CN': '加利福尼亚州' },
  cityNames: { en: 'Mountain View', 'zh-CN': '山景城' },
  source: 'geoip-mmdb' as const,
  databaseVersion: '2026-10',
};

describe('formatDeviceLocation', () => {
  it('formats location using the selected language', () => {
    expect(formatDeviceLocation(location, 'zh-CN')).toBe('美国 · 加利福尼亚州 · 山景城');
    expect(formatDeviceLocation(location, 'en-US')).toBe(
      'United States · California · Mountain View',
    );
  });

  it('falls back across Chinese locales and English', () => {
    expect(localizedLocationName({ 'zh-CN': '香港', en: 'Hong Kong' }, 'zh-HK')).toBe('香港');
    expect(localizedLocationName({ en: 'London' }, 'fr-FR')).toBe('London');
  });

  it('removes duplicate administrative levels', () => {
    expect(
      formatDeviceLocation(
        {
          ...location,
          countryCode: undefined,
          countryNames: { 'zh-CN': '中国' },
          regionNames: { 'zh-CN': '香港' },
          cityNames: { 'zh-CN': '香港' },
        },
        'zh-CN',
      ),
    ).toBe('中国 · 香港');
  });
});
