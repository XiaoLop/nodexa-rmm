import { describe, expect, it } from 'vitest';
import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';

type Dict = { [key: string]: string | Dict };

function flatten(dictionary: Dict, prefix = '', entries = new Map<string, string>()): Map<string, string> {
  for (const [key, value] of Object.entries(dictionary)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      entries.set(path, value);
    } else {
      flatten(value, path, entries);
    }
  }
  return entries;
}

const zhEntries = flatten(zhCN as unknown as Dict);
const enEntries = flatten(enUS as unknown as Dict);

describe('i18n locale parity', () => {
  it('keeps the Chinese and English dictionaries structurally identical', () => {
    const missingInEnglish = [...zhEntries.keys()].filter((key) => !enEntries.has(key)).sort();
    const missingInChinese = [...enEntries.keys()].filter((key) => !zhEntries.has(key)).sort();

    expect(missingInEnglish, 'keys present in zh-CN but missing in en-US').toEqual([]);
    expect(missingInChinese, 'keys present in en-US but missing in zh-CN').toEqual([]);
  });

  it('never ships empty translations', () => {
    const emptyChinese = [...zhEntries.entries()]
      .filter(([, value]) => value.trim().length === 0)
      .map(([key]) => key);
    const emptyEnglish = [...enEntries.entries()]
      .filter(([, value]) => value.trim().length === 0)
      .map(([key]) => key);

    expect(emptyChinese, 'empty zh-CN translations').toEqual([]);
    expect(emptyEnglish, 'empty en-US translations').toEqual([]);
  });

  it('ships server administration warnings and sent-only wording in both languages', () => {
    for (const key of ['diagnostics', 'console', 'trace', 'logs', 'consoleHint', 'globalWarning', 'clearSent', 'absent', 'empty', 'eventSearch', 'eventDetails', 'redactionNotice']) {
      const path = `serverAdmin.${key}`;
      expect(enEntries.get(path)).toBeTruthy();
      expect(zhEntries.get(path)).toBeTruthy();
      expect(zhEntries.get(path)).not.toBe(enEntries.get(path));
      expect(zhEntries.get(path)).not.toMatch(/^\?+$/);
    }
  });

  it('ships localized event message wording', () => {
    const requiredKeys = [
      'events.messages.deviceOnline',
      'events.messages.deviceOffline',
      'events.messages.deviceChanged',
      'events.messages.deviceRemoved',
      'events.messages.unknown',
    ];

    for (const key of requiredKeys) {
      expect(zhEntries.get(key), `zh-CN: ${key}`).toBeTruthy();
      expect(enEntries.get(key), `en-US: ${key}`).toBeTruthy();
    }
  });
});
