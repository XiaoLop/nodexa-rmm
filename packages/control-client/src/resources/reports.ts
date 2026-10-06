import { MeshCentralProtocolError, MeshCentralValidationError } from '../errors';
import { isRecord } from '../protocol/normalizers';
import type {
  ReportAlign,
  ReportColumn,
  ReportEntry,
  ReportGroupBy,
  ReportQuery,
  ReportResult,
  ReportType,
  ReportValue,
} from '../reports.types';

interface ResourceClient {
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
}

const REPORT_TIMEOUT_MS = 15_000;
const validGroupsByType: Record<ReportType, readonly ReportGroupBy[]> = {
  1: [1, 2, 3],
  2: [1],
  3: [1, 3],
  4: [1],
};
const validAlignments = new Set<ReportAlign>(['center', 'left', 'right']);

function isReportType(value: number): value is ReportType {
  return Number.isInteger(value) && value >= 1 && value <= 4;
}

function isReportGroupBy(value: number): value is ReportGroupBy {
  return Number.isInteger(value) && value >= 1 && value <= 3;
}

function normalizeColumn(value: unknown): ReportColumn {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') {
    throw new MeshCentralProtocolError('Report response contains an invalid column.');
  }
  const column: ReportColumn = { id: value.id, title: value.title };
  if (typeof value.format === 'string') column.format = value.format;
  if (typeof value.align === 'string' && validAlignments.has(value.align as ReportAlign)) {
    column.align = value.align as ReportAlign;
  }
  if (typeof value.sumBy === 'boolean' || typeof value.sumBy === 'string') {
    column.sumBy = value.sumBy;
  }
  return column;
}

function normalizeEntry(value: unknown): ReportEntry | undefined {
  if (!isRecord(value)) return undefined;
  const entry: ReportEntry = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      item !== null &&
      typeof item !== 'string' &&
      typeof item !== 'boolean' &&
      typeof item !== 'number'
    ) {
      return undefined;
    }
    if (typeof item === 'number' && !Number.isFinite(item)) return undefined;
    entry[key] = item as ReportValue;
  }
  return entry;
}

function normalizeResult(response: unknown): ReportResult {
  if (!isRecord(response) || !isRecord(response.data)) {
    throw new MeshCentralProtocolError('Report response does not contain data.');
  }
  const data = response.data;
  if (!Array.isArray(data.columns) || !isRecord(data.groups)) {
    throw new MeshCentralProtocolError('Report response has an invalid structure.');
  }
  const columns = data.columns.map(normalizeColumn);
  const groups: ReportResult['groups'] = {};
  for (const [key, value] of Object.entries(data.groups)) {
    if (!isRecord(value) || !Array.isArray(value.entries)) {
      throw new MeshCentralProtocolError('Report response contains an invalid group.');
    }
    groups[key] = {
      entries: value.entries
        .map(normalizeEntry)
        .filter((entry): entry is ReportEntry => entry !== undefined),
    };
  }
  const result: ReportResult = { columns, groups };
  if (data.groupFormat === 'user' || data.groupFormat === 'nodemesh') {
    result.groupFormat = data.groupFormat;
  }
  return result;
}

export class ReportsResource {
  constructor(private readonly client: ResourceClient) {}

  async query(query: ReportQuery): Promise<ReportResult> {
    const payload = this.createPayload(query);
    const response = await this.client.request<unknown>(payload, REPORT_TIMEOUT_MS);
    return normalizeResult(response);
  }

  private createPayload(query: ReportQuery): Record<string, unknown> {
    if (!isReportType(query.type)) {
      throw new MeshCentralValidationError('Report type must be an integer between 1 and 4.');
    }
    if (!isReportGroupBy(query.groupBy) || !validGroupsByType[query.type].includes(query.groupBy)) {
      throw new MeshCentralValidationError('Report grouping is not valid for this report type.');
    }
    if (!Number.isFinite(query.start) || !Number.isFinite(query.end) || query.start >= query.end) {
      throw new MeshCentralValidationError('Report start time must be before end time.');
    }
    if (query.deviceGroupId !== undefined && query.type !== 1 && query.type !== 2) {
      throw new MeshCentralValidationError('Device group filtering is not valid for this report type.');
    }
    if (query.showTraffic !== undefined && query.type !== 1) {
      throw new MeshCentralValidationError('Traffic details are only valid for session reports.');
    }

    const payload: Record<string, unknown> = {
      action: 'report',
      type: query.type,
      groupBy: query.groupBy,
      start: Math.trunc(query.start),
      end: Math.trunc(query.end),
      devGroup: query.deviceGroupId ?? null,
    };
    if (query.showTraffic !== undefined) payload.showTraffic = query.showTraffic;
    if (query.groupBy === 3) {
      payload.tz = query.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
      payload.tf = query.timezoneOffset ?? new Date().getTimezoneOffset();
      payload.l = query.language ?? 'en';
    }
    return payload;
  }
}