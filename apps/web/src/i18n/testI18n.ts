import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';
import {
  defaultLanguage,
  resolveLanguage,
  supportedLanguages,
  type AppLanguage,
} from './language';

export function createTestI18n(initialLang: AppLanguage = defaultLanguage) {
  const testInstance = i18n.createInstance();
  const resolved = resolveLanguage(initialLang);

  void testInstance.use(initReactI18next).init({
    lng: resolved,
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

  return testInstance;
}
