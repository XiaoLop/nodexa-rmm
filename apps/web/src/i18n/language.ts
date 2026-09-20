export const supportedLanguages = ['zh-CN', 'en-US'] as const;

export type AppLanguage = (typeof supportedLanguages)[number];

export const defaultLanguage: AppLanguage = 'zh-CN';
export const languageStorageKey = 'meshcentral.language';

export function resolveLanguage(value?: string | null): AppLanguage {
  return value?.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
}