import type { ReportColumn, ReportEntry, ReportGroup } from '@meshcentral/control-client';

export interface ReportPresentationContext {
  locale: string;
  devices?: Record<string, string>;
  deviceGroups?: Record<string, string>;
  translate?: (key: string, options?: Record<string, unknown>) => string;
}

export interface ReportSummary {
  columnId: string;
  value?: number;
  valuesByKey?: Record<string, number>;
}

const protocolNames: Record<number, string> = {
  1: 'terminal',
  2: 'desktop',
  5: 'files',
  6: 'tcp',
  7: 'udp',
  8: 'message',
};

const twoFactorNames: Record<string, string> = {
  email: 'email',
  sms: 'sms',
  authenticator: 'authenticator',
  duo: 'duo',
  yubikey: 'securityKey',
  'security-key': 'securityKey',
};

const knownFormats = new Set([
  'datetime',
  'time',
  'node',
  'mesh',
  'user',
  'protocol',
  'seconds',
  'bytes',
  '2fa',
  'records',
]);

function translate(
  context: ReportPresentationContext,
  key: string,
  fallback: string,
  options?: Record<string, unknown>,
): string {
  if (!context.translate) return fallback;
  const value = context.translate(key, { defaultValue: fallback, ...options });
  return value || fallback;
}

function formatBytes(value: number, locale: string): string {
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(Math.abs(value)) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** Math.max(index, 0);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(amount)} ${units[Math.max(index, 0)]}`;
}

function formatDuration(value: number): string {
  const totalSeconds = Math.max(0, Math.round(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, '0')))
    .join(':');
}

function identifierName(value: string): string {
  const segments = value.split('/');
  return segments[segments.length - 1] || value;
}

export function getReportColumnTitle(
  column: ReportColumn,
  context: ReportPresentationContext,
): string {
  return translate(context, `reports.columns.${column.title}`, column.title);
}

export function formatReportValue(
  value: unknown,
  column: ReportColumn,
  context: ReportPresentationContext,
): string {
  if (value === undefined || value === null || value === '') return '-';
  if (!column.format || !knownFormats.has(column.format)) return String(value);

  switch (column.format) {
    case 'datetime':
      return typeof value === 'number' && Number.isFinite(value)
        ? new Intl.DateTimeFormat(context.locale, {
            dateStyle: 'medium',
            timeStyle: 'medium',
          }).format(value)
        : String(value);
    case 'time':
      return typeof value === 'number' && Number.isFinite(value)
        ? new Intl.DateTimeFormat(context.locale, { timeStyle: 'medium' }).format(value)
        : String(value);
    case 'node':
      return context.devices?.[String(value)] ?? String(value);
    case 'mesh':
      return context.deviceGroups?.[String(value)] ?? String(value);
    case 'user':
      return identifierName(String(value));
    case 'protocol': {
      const protocol = protocolNames[Number(value)];
      return protocol
        ? translate(context, `reports.protocols.${protocol}`, protocol)
        : String(value);
    }
    case 'seconds':
      return typeof value === 'number' && Number.isFinite(value)
        ? formatDuration(value)
        : String(value);
    case 'bytes':
      return typeof value === 'number' && Number.isFinite(value)
        ? formatBytes(value, context.locale)
        : String(value);
    case '2fa': {
      const method = twoFactorNames[String(value).toLowerCase()];
      return method ? translate(context, `reports.twoFactor.${method}`, method) : String(value);
    }
    case 'records':
      return translate(context, `reports.records.${String(value)}`, String(value));
  }
  return String(value);
}

export function getReportGroupTitle(
  groupKey: string,
  groupFormat: 'user' | 'nodemesh' | undefined,
  context: ReportPresentationContext,
): string | undefined {
  if (groupKey === '0') return undefined;
  if (groupFormat === 'user') return identifierName(groupKey);
  if (groupFormat === 'nodemesh') {
    return context.devices?.[groupKey] ?? context.deviceGroups?.[groupKey] ?? groupKey;
  }
  return groupKey;
}

export function sortReportEntries(entries: ReportEntry[]): ReportEntry[] {
  return [...entries].sort((left, right) => {
    const leftTime = typeof left.time === 'number' ? left.time : 0;
    const rightTime = typeof right.time === 'number' ? right.time : 0;
    return rightTime - leftTime;
  });
}

export function summarizeReportGroup(
  columns: ReportColumn[],
  group: ReportGroup,
): ReportSummary[] {
  return columns.flatMap<ReportSummary>((column) => {
    if (!column.sumBy) return [];
    if (column.sumBy === true) {
      const value = group.entries.reduce((total, entry) => {
        const item = entry[column.id];
        return typeof item === 'number' && Number.isFinite(item) ? total + item : total;
      }, 0);
      return [{ columnId: column.id, value }];
    }
    const sumKey = column.sumBy;
    const valuesByKey: Record<string, number> = {};
    for (const entry of group.entries) {
      const item = entry[column.id];
      const key = entry[sumKey];
      if (typeof item !== 'number' || !Number.isFinite(item) || key === undefined || key === null) {
        continue;
      }
      const normalizedKey = String(key);
      valuesByKey[normalizedKey] = (valuesByKey[normalizedKey] ?? 0) + item;
    }
    return [{ columnId: column.id, valuesByKey }];
  });
}