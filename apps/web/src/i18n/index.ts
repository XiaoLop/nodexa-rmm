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

const initialLanguage = resolveLanguage(
  localStorage.getItem(languageStorageKey) ?? navigator.language,
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

document.documentElement.lang = initialLanguage;

i18n.on('languageChanged', (language) => {
  const resolvedLanguage = resolveLanguage(language);
  localStorage.setItem(languageStorageKey, resolvedLanguage);
  document.documentElement.lang = resolvedLanguage;
});

export { default as i18n } from 'i18next';
export * from './language';