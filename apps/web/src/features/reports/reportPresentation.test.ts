import { describe, expect, it } from 'vitest';
import type { ReportEntry } from '@meshcentral/control-client';
import {
  formatReportValue,
  getReportColumnTitle,
  getReportGroupTitle,
  sortReportEntries,
  summarizeReportGroup,
} from './reportPresentation';

const context = {
  locale: 'en-US',
  devices: { 'node//one': 'Office PC' },
  deviceGroups: { 'mesh//one': 'Office' },
  translate: (key: string, options?: Record<string, unknown>) =>
    key === 'reports.columns.time' ? 'Started' : String(options?.defaultValue ?? key),
};

describe('report presentation', () => {
  it('localizes known column titles and preserves unknown titles', () => {
    expect(getReportColumnTitle({ id: 'time', title: 'time' }, context)).toBe('Started');
    expect(getReportColumnTitle({ id: 'custom', title: 'Custom value' }, context)).toBe(
      'Custom value',
    );
  });

  it('formats allowed formats and safely falls back to text', () => {
    expect(formatReportValue('node//one', { id: 'nodeid', title: 'node', format: 'node' }, context)).toBe(
      'Office PC',
    );
    expect(formatReportValue('user//admin', { id: 'userid', title: 'user', format: 'user' }, context)).toBe(
      'admin',
    );
    expect(formatReportValue(3661, { id: 'length', title: 'length', format: 'seconds' }, context)).toBe(
      '1:01:01',
    );
    expect(formatReportValue(1536, { id: 'bytes', title: 'bytes', format: 'bytes' }, context)).toBe(
      '1.5 KB',
    );
    expect(formatReportValue('<b>raw</b>', { id: 'custom', title: 'custom', format: 'html' }, context)).toBe(
      '<b>raw</b>',
    );
  });

  it('resolves meaningful group titles', () => {
    expect(getReportGroupTitle('0', undefined, context)).toBeUndefined();
    expect(getReportGroupTitle('user//admin', 'user', context)).toBe('admin');
    expect(getReportGroupTitle('mesh//one', 'nodemesh', context)).toBe('Office');
    expect(getReportGroupTitle('2026-04-01', undefined, context)).toBe('2026-04-01');
  });

  it('sorts timed entries newest first without mutating the source', () => {
    const entries: ReportEntry[] = [{ time: 100 }, { value: 'untimed' }, { time: 300 }];
    expect(sortReportEntries(entries)).toEqual([
      { time: 300 },
      { time: 100 },
      { value: 'untimed' },
    ]);
    expect(entries[0]).toEqual({ time: 100 });
  });

  it('sums finite values globally and by another column', () => {
    expect(
      summarizeReportGroup(
        [
          { id: 'length', title: 'length', sumBy: true },
          { id: 'bytes', title: 'bytes', sumBy: 'protocol' },
        ],
        {
          entries: [
            { length: 10, bytes: 100, protocol: 2 },
            { length: 20, bytes: 40, protocol: 2 },
            { length: 5, bytes: 30, protocol: 1 },
            { length: null, bytes: null, protocol: 1 },
          ],
        },
      ),
    ).toEqual([
      { columnId: 'length', value: 35 },
      { columnId: 'bytes', valuesByKey: { '1': 30, '2': 140 } },
    ]);
  });
});