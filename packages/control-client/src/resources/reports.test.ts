import { describe, expect, it, vi } from 'vitest';
import type { ReportQuery } from '../reports.types';
import { ReportsResource } from './reports';

function setup(response: unknown = { action: 'report', data: { columns: [], groups: {} } }) {
  const request = vi.fn().mockResolvedValue(response);
  return { reports: new ReportsResource({ request }), request };
}

const baseQuery: ReportQuery = {
  type: 1,
  groupBy: 1,
  start: 100,
  end: 200,
};

describe('ReportsResource', () => {
  it('maps query fields and uses the report timeout', async () => {
    const { reports, request } = setup();
    await reports.query({
      ...baseQuery,
      groupBy: 3,
      timezone: 'Asia/Shanghai',
      timezoneOffset: -480,
      language: 'zh-CN',
      deviceGroupId: 'mesh//one',
      showTraffic: true,
    });

    expect(request).toHaveBeenCalledWith(
      {
        action: 'report',
        type: 1,
        groupBy: 3,
        start: 100,
        end: 200,
        devGroup: 'mesh//one',
        showTraffic: true,
        tz: 'Asia/Shanghai',
        tf: -480,
        l: 'zh-CN',
      },
      15_000,
    );
  });

  it.each([
    { type: 1, groupBy: 2 },
    { type: 2, groupBy: 1 },
    { type: 3, groupBy: 3 },
    { type: 4, groupBy: 1 },
  ] as const)('accepts report type $type with grouping $groupBy', async (value) => {
    const { reports } = setup();
    await expect(reports.query({ ...baseQuery, ...value })).resolves.toEqual({
      columns: [],
      groups: {},
    });
  });

  it.each([
    { ...baseQuery, start: 200, end: 200 },
    { ...baseQuery, type: 2 as const, groupBy: 2 as const },
    { ...baseQuery, type: 3 as const, groupBy: 2 as const },
    { ...baseQuery, type: 4 as const, groupBy: 3 as const },
    { ...baseQuery, type: 3 as const, deviceGroupId: 'mesh//one' },
    { ...baseQuery, type: 2 as const, showTraffic: true },
  ])('rejects an invalid query combination', async (query) => {
    const { reports, request } = setup();
    await expect(reports.query(query)).rejects.toMatchObject({
      name: 'MeshCentralValidationError',
    });
    expect(request).not.toHaveBeenCalled();
  });

  it('normalizes columns, groups, and valid entries', async () => {
    const { reports } = setup({
      action: 'report',
      data: {
        groupFormat: 'user',
        columns: [
          { id: 'time', title: 'time', format: 'datetime' },
          { id: 'length', title: 'length', align: 'center', sumBy: 'protocol' },
        ],
        groups: {
          'user//admin': {
            entries: [
              { time: 1_790_000_000_000, length: 10, protocol: 2 },
              { time: 1_790_000_001_000, length: Number.POSITIVE_INFINITY },
            ],
          },
        },
      },
    });

    await expect(reports.query(baseQuery)).resolves.toEqual({
      groupFormat: 'user',
      columns: [
        { id: 'time', title: 'time', format: 'datetime' },
        { id: 'length', title: 'length', align: 'center', sumBy: 'protocol' },
      ],
      groups: {
        'user//admin': {
          entries: [{ time: 1_790_000_000_000, length: 10, protocol: 2 }],
        },
      },
    });
  });

  it.each([
    {},
    { action: 'report', data: { columns: {}, groups: {} } },
    { action: 'report', data: { columns: [], groups: { invalid: {} } } },
    { action: 'report', data: { columns: [{ id: 'time' }], groups: {} } },
  ])('rejects a malformed response', async (response) => {
    const { reports } = setup(response);
    await expect(reports.query(baseQuery)).rejects.toMatchObject({
      name: 'MeshCentralProtocolError',
    });
  });
});