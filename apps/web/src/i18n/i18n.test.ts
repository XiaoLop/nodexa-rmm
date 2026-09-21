import { describe, expect, it } from 'vitest';
import { resolveLanguage, defaultLanguage, supportedLanguages } from './language';
import { zhCN } from './locales/zh-CN';
import { enUS } from './locales/en-US';
import { createTestI18n } from './testI18n';

function collectKeyPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeyPaths(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('i18n locale integrity and language resolution', () => {
  it('has perfectly symmetric translation keys between zh-CN and en-US', () => {
    const zhKeys = collectKeyPaths(zhCN);
    const enKeys = collectKeyPaths(enUS);

    const missingInEn = zhKeys.filter((key) => !enKeys.includes(key));
    const missingInZh = enKeys.filter((key) => !zhKeys.includes(key));

    expect(missingInEn, `Keys present in zh-CN but missing in en-US: ${missingInEn.join(', ')}`).toEqual([]);
    expect(missingInZh, `Keys present in en-US but missing in zh-CN: ${missingInZh.join(', ')}`).toEqual([]);
    expect(zhKeys).toEqual(enKeys);
  });

  describe('resolveLanguage', () => {
    it('resolves English locales correctly', () => {
      expect(resolveLanguage('en')).toBe('en-US');
      expect(resolveLanguage('en-US')).toBe('en-US');
      expect(resolveLanguage('en-GB')).toBe('en-US');
      expect(resolveLanguage('en-ca')).toBe('en-US');
      expect(resolveLanguage('EN-US')).toBe('en-US');
    });

    it('resolves Chinese locales to zh-CN', () => {
      expect(resolveLanguage('zh')).toBe('zh-CN');
      expect(resolveLanguage('zh-CN')).toBe('zh-CN');
      expect(resolveLanguage('zh-TW')).toBe('zh-CN');
      expect(resolveLanguage('zh-HK')).toBe('zh-CN');
    });

    it('falls back to default language for unknown languages, empty strings, and null/undefined', () => {
      expect(resolveLanguage(null)).toBe(defaultLanguage);
      expect(resolveLanguage(undefined)).toBe(defaultLanguage);
      expect(resolveLanguage('')).toBe(defaultLanguage);
      expect(resolveLanguage('ja-JP')).toBe(defaultLanguage);
      expect(resolveLanguage('fr')).toBe(defaultLanguage);
      expect(resolveLanguage('de-DE')).toBe(defaultLanguage);
    });

    it('supports defined supportedLanguages', () => {
      expect(supportedLanguages).toContain('zh-CN');
      expect(supportedLanguages).toContain('en-US');
    });
  });

  describe('createTestI18n', () => {
    it('initializes and translates in zh-CN', () => {
      const i18n = createTestI18n('zh-CN');
      expect(i18n.t('common.simplifiedChinese')).toBe('简体中文');
      expect(i18n.t('login.title')).toBe('系统登录');
    });

    it('initializes and translates in en-US', () => {
      const i18n = createTestI18n('en-US');
      expect(i18n.t('common.simplifiedChinese')).toBe('简体中文');
      expect(i18n.t('login.title')).toBe('Sign in');
    });

    it('changes language dynamically in test instance', async () => {
      const i18n = createTestI18n('zh-CN');
      expect(i18n.t('navigation.dashboard')).toBe('仪表盘');
      await i18n.changeLanguage('en-US');
      expect(i18n.t('navigation.dashboard')).toBe('Dashboard');
    });
  });
});
