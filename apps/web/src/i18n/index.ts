import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';
import {
  defaultLanguage,
  languageStorageKey,
  resolveLanguage,
  supportedLanguages,
} from './language';

function getSafeStorageItem(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function setSafeStorageItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore storage errors
  }
}

const initialLanguage = resolveLanguage(
  getSafeStorageItem(languageStorageKey) ??
    (typeof navigator !== 'undefined' ? navigator.language : undefined),
);

void i18n.use(initReactI18next).init({
  lng: initialLanguage,
  fallbackLng: defaultLanguage,
  supportedLngs: [...supportedLanguages],
  resources: {
    'zh-CN': { translation: zhCN },
    'en-US': { translation: enUS },
  },
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage;
}

i18n.on('languageChanged', (language) => {
  const resolvedLanguage = resolveLanguage(language);
  setSafeStorageItem(languageStorageKey, resolvedLanguage);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = resolvedLanguage;
  }
});

export { default as i18n } from 'i18next';
export * from './language';
export * from './formatters';
export * from './language';