export type ReportType = 1 | 2 | 3 | 4;
export type ReportGroupBy = 1 | 2 | 3;
export type ReportAlign = 'center' | 'left' | 'right';
export type ReportValue = string | number | boolean | null;
export type ReportEntry = Record<string, ReportValue>;

export interface ReportQuery {
  type: ReportType;
  groupBy: ReportGroupBy;
  start: number;
  end: number;
  timezone?: string;
  timezoneOffset?: number;
  language?: string;
  deviceGroupId?: string;
  showTraffic?: boolean;
}

export interface ReportColumn {
  id: string;
  title: string;
  format?: string;
  align?: ReportAlign;
  sumBy?: boolean | string;
}

export interface ReportGroup<TEntry extends ReportEntry = ReportEntry> {
  entries: TEntry[];
}

export interface ReportResult<TEntry extends ReportEntry = ReportEntry> {
  groupFormat?: 'user' | 'nodemesh';
  columns: ReportColumn[];
  groups: Record<string, ReportGroup<TEntry>>;
}

export type RemoteSessionReportEntry = ReportEntry & {
  time: number;
  userid?: string;
  nodeid?: string;
  meshid?: string;
  guestname?: string;
  protocol?: number;
  length?: number;
  bytesin?: number;
  bytesout?: number;
};

export type UserTrafficReportEntry = ReportEntry & {
  userid: string;
  length: number;
  bytesin: number;
  bytesout: number;
};

export type UserLoginReportEntry = ReportEntry & {
  time: number;
  userid?: string;
  ip?: string;
  browser?: string;
  os?: string;
  twofactor?: string;
  msg?: number;
};

export type DatabaseRecordReportEntry = ReportEntry & {
  record: string;
  recordcount: number;
};