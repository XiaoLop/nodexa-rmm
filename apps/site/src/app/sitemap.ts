import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/config/site';
import { locales } from '@/i18n/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, new URL(`/${locale}`, siteUrl).toString()]),
  );

  return locales.map((locale) => ({
    url: new URL(`/${locale}`, siteUrl).toString(),
    changeFrequency: 'monthly',
    priority: locale === 'zh-CN' ? 1 : 0.9,
    alternates: { languages },
  }));
}
