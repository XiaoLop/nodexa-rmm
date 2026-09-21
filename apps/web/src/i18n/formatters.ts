import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { defaultLanguage, resolveLanguage, type AppLanguage } from './language';

export interface LocalizedIssue {
  code: string;
  params?: Record<string, string | number>;
  detail?: string;
}

export function formatDateTime(
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
  lang?: AppLanguage,
): string {
  const date = typeof value === 'object' ? value : new Date(value);
  if (isNaN(date.getTime())) return '';
  const resolved = resolveLanguage(lang ?? defaultLanguage);
  return new Intl.DateTimeFormat(resolved, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    ...options,
  }).format(date);
}

export function formatDate(
  value: Date | number | string,
  lang?: AppLanguage,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatDateTime(
    value,
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: undefined,
      minute: undefined,
      second: undefined,
      ...options,
    },
    lang,
  );
}

export function formatTime(
  value: Date | number | string,
  lang?: AppLanguage,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatDateTime(
    value,
    {
      year: undefined,
      month: undefined,
      day: undefined,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      ...options,
    },
    lang,
  );
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  lang?: AppLanguage,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  const resolved = resolveLanguage(lang ?? defaultLanguage);
  return new Intl.RelativeTimeFormat(resolved, {
    numeric: 'auto',
    ...options,
  }).format(value, unit);
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
  lang?: AppLanguage,
): string {
  if (typeof value !== 'number' || isNaN(value)) return '0';
  const resolved = resolveLanguage(lang ?? defaultLanguage);
  return new Intl.NumberFormat(resolved, options).format(value);
}

export function formatPercent(
  value: number,
  digits: number = 0,
  lang?: AppLanguage,
): string {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  const resolved = resolveLanguage(lang ?? defaultLanguage);
  return new Intl.NumberFormat(resolved, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function createCollator(
  lang?: AppLanguage,
  options?: Intl.CollatorOptions,
): Intl.Collator {
  const resolved = resolveLanguage(lang ?? defaultLanguage);
  return new Intl.Collator(resolved, options);
}

export function compareStrings(
  a: string,
  b: string,
  lang?: AppLanguage,
  options?: Intl.CollatorOptions,
): number {
  return createCollator(lang, options).compare(a, b);
}

export function getErrorMessage(
  t: (key: string, options?: Record<string, unknown>) => string,
  error: LocalizedIssue | Error | string | unknown,
  fallbackKey = 'errors.unknown',
): string {
  if (!error) return t(fallbackKey);

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const issue = error as LocalizedIssue;
    const key = `errors.${issue.code}`;
    const translated = t(key, issue.params);
    if (translated && translated !== key) {
      return translated;
    }
    return issue.detail || t(fallbackKey);
  }

  if (error instanceof Error) {
    return error.message || t(fallbackKey);
  }

  if (typeof error === 'string') {
    return error;
  }

  return t(fallbackKey);
}

export function useFormatters() {
  const { i18n, t } = useTranslation();
  const currentLang = resolveLanguage(i18n.resolvedLanguage ?? i18n.language);

  return useMemo(
    () => ({
      language: currentLang,
      dateTime: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
        formatDateTime(value, options, currentLang),
      date: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
        formatDate(value, currentLang, options),
      time: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) =>
        formatTime(value, currentLang, options),
      relativeTime: (
        value: number,
        unit: Intl.RelativeTimeFormatUnit,
        options?: Intl.RelativeTimeFormatOptions,
      ) => formatRelativeTime(value, unit, currentLang, options),
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(value, options, currentLang),
      percent: (value: number, digits?: number) =>
        formatPercent(value, digits, currentLang),
      compare: (a: string, b: string, options?: Intl.CollatorOptions) =>
        compareStrings(a, b, currentLang, options),
      errorMessage: (err: LocalizedIssue | Error | string | unknown, fallback?: string) =>
        getErrorMessage(t, err, fallback),
    }),
    [currentLang, t],
  );
}
