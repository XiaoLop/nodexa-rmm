import { describe, expect, it } from 'vitest';
import {
  compareStrings,
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  formatTime,
  getErrorMessage,
} from './formatters';

describe('i18n formatters', () => {
  const timestamp = new Date('2026-09-20T14:30:45Z').getTime();

  describe('date and time formatters', () => {
    it('formats date according to language', () => {
      const zh = formatDate(timestamp, 'zh-CN');
      const en = formatDate(timestamp, 'en-US');

      expect(zh).toBeTruthy();
      expect(en).toBeTruthy();
      expect(formatDate('invalid-date', 'zh-CN')).toBe('');
    });

    it('formats time according to language', () => {
      const zh = formatTime(timestamp, 'zh-CN');
      const en = formatTime(timestamp, 'en-US');

      expect(zh).toBeTruthy();
      expect(en).toBeTruthy();
    });

    it('formats full dateTime', () => {
      const formatted = formatDateTime(timestamp, undefined, 'zh-CN');
      expect(formatted).toBeTruthy();
    });

    it('formats relative time', () => {
      const zhPast = formatRelativeTime(-1, 'minute', 'zh-CN');
      const enPast = formatRelativeTime(-1, 'minute', 'en-US');

      expect(zhPast).toBe('1分钟前');
      expect(enPast).toBe('1 minute ago');

      const zhFuture = formatRelativeTime(2, 'hour', 'zh-CN');
      const enFuture = formatRelativeTime(2, 'hour', 'en-US');

      expect(zhFuture).toBe('2小时后');
      expect(enFuture).toBe('in 2 hours');
    });
  });

  describe('number and percent formatters', () => {
    it('formats numbers with grouping', () => {
      expect(formatNumber(1234567, undefined, 'zh-CN')).toBe('1,234,567');
      expect(formatNumber(1234567, undefined, 'en-US')).toBe('1,234,567');
      expect(formatNumber(NaN, undefined, 'zh-CN')).toBe('0');
    });

    it('formats percentages correctly', () => {
      expect(formatPercent(0.856, 1, 'zh-CN')).toBe('85.6%');
      expect(formatPercent(0.856, 0, 'en-US')).toBe('86%');
      expect(formatPercent(NaN, 0, 'zh-CN')).toBe('0%');
    });
  });

  describe('string comparison', () => {
    it('compares strings using locale collator', () => {
      const listZh = ['张三', '李四', '王五'];
      const sortedZh = [...listZh].sort((a, b) => compareStrings(a, b, 'zh-CN'));
      expect(sortedZh.length).toBe(3);

      const listEn = ['banana', 'apple', 'cherry'];
      const sortedEn = [...listEn].sort((a, b) => compareStrings(a, b, 'en-US'));
      expect(sortedEn).toEqual(['apple', 'banana', 'cherry']);
    });
  });

  describe('getErrorMessage', () => {
    const mockT = (key: string, params?: Record<string, unknown>) => {
      if (key === 'errors.gatewayDisconnected') return '业务网关未连接';
      if (key === 'errors.permissionDenied') return '无权执行此操作';
      if (key === 'errors.unknown') return '发生未知错误，请稍后重试。';
      if (key === 'errors.fileTooLarge' && params?.max) return `文件超出 ${params.max}MB 限制`;
      return key;
    };

    it('translates structured LocalizedIssue', () => {
      expect(
        getErrorMessage(mockT, {
          code: 'gatewayDisconnected',
        }),
      ).toBe('业务网关未连接');

      expect(
        getErrorMessage(mockT, {
          code: 'fileTooLarge',
          params: { max: 100 },
        }),
      ).toBe('文件超出 100MB 限制');
    });

    it('falls back to detail if code translation is missing', () => {
      expect(
        getErrorMessage(mockT, {
          code: 'unmappedCode',
          detail: 'Specific technical reason',
        }),
      ).toBe('Specific technical reason');
    });

    it('handles standard Error instances and strings', () => {
      expect(getErrorMessage(mockT, new Error('Network timeout'))).toBe('Network timeout');
      expect(getErrorMessage(mockT, 'Raw error message')).toBe('Raw error message');
      expect(getErrorMessage(mockT, null)).toBe('发生未知错误，请稍后重试。');
    });
  });
});
