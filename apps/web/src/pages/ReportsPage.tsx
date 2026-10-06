import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  CalendarOutlined,
  ClearOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  FieldTimeOutlined,
  FolderOutlined,
  GlobalOutlined,
  LaptopOutlined,
  LoginOutlined,
  MessageOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Badge,
  Button,
  DatePicker,
  Empty,
  Select,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import type {
  ReportColumn,
  ReportEntry,
  ReportGroupBy,
  ReportResult,
  ReportType,
} from '@meshcentral/control-client';
import { MeshCentralRequestTimeoutError } from '@meshcentral/control-client';
import dayjs, { type Dayjs } from 'dayjs';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMeshCentralControlData } from '../features/gateway/useMeshCentralControlData';
import { useApplicationUiCapabilities } from '../features/permissions/useUiCapabilities';
import {
  formatReportValue,
  getReportColumnTitle,
  getReportGroupTitle,
  sortReportEntries,
  summarizeReportGroup,
} from '../features/reports/reportPresentation';
import '../assets/styles/reports.css';

const DAY_MS = 24 * 60 * 60 * 1_000;

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function defaultRange() {
  const end = new Date();
  return {
    start: toLocalInputValue(new Date(end.getTime() - DAY_MS)),
    end: toLocalInputValue(end),
  };
}

const groupingsByType: Record<ReportType, ReportGroupBy[]> = {
  1: [1, 2, 3],
  2: [1],
  3: [1, 3],
  4: [1],
};

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const data = useMeshCentralControlData();
  const capabilities = useApplicationUiCapabilities();
  const initialRange = useMemo(defaultRange, []);
  const [type, setType] = useState<ReportType>(1);
  const [groupBy, setGroupBy] = useState<ReportGroupBy>(1);
  const [start, setStart] = useState(initialRange.start);
  const [end, setEnd] = useState(initialRange.end);
  const [deviceGroupId, setDeviceGroupId] = useState<string>();
  const [showTraffic, setShowTraffic] = useState(true);
  const [result, setResult] = useState<ReportResult>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [queried, setQueried] = useState(false);
  const requestSequence = useRef(0);

  const typeOptions = useMemo(
    () => [
      { value: 1 as const, label: t('reports.types.remoteSessions'), icon: <FieldTimeOutlined /> },
      ...(capabilities.viewUserTrafficReports
        ? [{ value: 2 as const, label: t('reports.types.userTraffic'), icon: <BarChartOutlined /> }]
        : []),
      { value: 3 as const, label: t('reports.types.userLogins'), icon: <LoginOutlined /> },
      ...(capabilities.viewDatabaseRecordReports
        ? [{ value: 4 as const, label: t('reports.types.databaseRecords'), icon: <DatabaseOutlined /> }]
        : []),
    ],
    [capabilities.viewDatabaseRecordReports, capabilities.viewUserTrafficReports, t],
  );
  const groupingOptions = groupingsByType[type].map((value) => ({
    value,
    label: t(`reports.groupBy.${value === 1 ? 'user' : value === 2 ? 'device' : 'date'}`),
  }));
  const deviceNames = useMemo(
    () => Object.fromEntries(data.devices.map((device) => [device.id, device.name])),
    [data.devices],
  );
  const groupNames = useMemo(
    () => Object.fromEntries(data.groups.map((group) => [group.id, group.name])),
    [data.groups],
  );
  const presentationContext = useMemo(
    () => ({
      locale: i18n.resolvedLanguage ?? i18n.language,
      devices: deviceNames,
      deviceGroups: groupNames,
      translate: t,
    }),
    [deviceNames, groupNames, i18n.language, i18n.resolvedLanguage, t],
  );
  const resultGroups = useMemo(
    () =>
      result
        ? Object.entries(result.groups).map(([key, group]) => ({
            key,
            title: getReportGroupTitle(key, result.groupFormat, presentationContext),
            group,
            entries: sortReportEntries(group.entries),
          }))
        : [],
    [presentationContext, result],
  );
  const totalEntries = resultGroups.reduce((total, group) => total + group.entries.length, 0);

  const handleTypeChange = (nextType: ReportType) => {
    setType(nextType);
    setGroupBy(groupingsByType[nextType][0] ?? 1);
    if (nextType !== 1 && nextType !== 2) setDeviceGroupId(undefined);
  };

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    const [startDate, endDate] = dates ?? [];
    if (!startDate || !endDate) return;
    setStart(toLocalInputValue(startDate.toDate()));
    setEnd(toLocalInputValue(endDate.toDate()));
  };

  const handleResetFilters = () => {
    const range = defaultRange();
    setStart(range.start);
    setEnd(range.end);
    setGroupBy(groupingsByType[type][0] ?? 1);
    setDeviceGroupId(undefined);
    setShowTraffic(true);
    setError(undefined);
  };

  const queryReports = async (range?: { start: string; end: string }) => {
    if (!data.client) {
      setError(t('reports.states.disconnected'));
      return;
    }
    const startTime = new Date(range?.start ?? start).getTime();
    const endTime = new Date(range?.end ?? end).getTime();
    if (type !== 4 && (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime)) {
      setError(t('reports.errors.invalidRange'));
      return;
    }
    const sequence = ++requestSequence.current;
    const now = Date.now();
    setLoading(true);
    setError(undefined);
    setQueried(true);
    try {
      const nextResult = await data.client.reports.query({
        type,
        groupBy,
        start: Math.trunc((type === 4 ? now - DAY_MS : startTime) / 1_000),
        end: Math.trunc((type === 4 ? now : endTime) / 1_000),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
        language: i18n.resolvedLanguage ?? i18n.language,
        deviceGroupId,
        showTraffic: type === 1 ? showTraffic : undefined,
      });
      if (sequence === requestSequence.current) setResult(nextResult);
    } catch (queryError) {
      if (sequence !== requestSequence.current) return;
      setResult(undefined);
      setError(
        queryError instanceof MeshCentralRequestTimeoutError
          ? t('reports.errors.timeout')
          : queryError instanceof Error
            ? queryError.message
            : t('reports.errors.unknown'),
      );
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  };

  const applyQuickRange = (hours: number) => {
    const endNow = new Date();
    const startPast = new Date(endNow.getTime() - hours * 60 * 60 * 1_000);
    const nextRange = {
      start: toLocalInputValue(startPast),
      end: toLocalInputValue(endNow),
    };
    setStart(nextRange.start);
    setEnd(nextRange.end);
    void queryReports(nextRange);
  };

  const columns = (result?.columns ?? []).map((column) => ({
    key: column.id,
    dataIndex: column.id,
    title: getReportColumnTitle(column, presentationContext),
    align: column.align,
    render: (value: unknown) => renderReportCell(value, column, presentationContext),
    sorter: (left: ReportEntry, right: ReportEntry) => compareReportValues(left[column.id], right[column.id]),
  }));

  return (
    <div className="page-stack reports-page">
      <div className="page-heading reports-heading">
        <div className="reports-title-area">
          <div className="reports-title-icon">
            <BarChartOutlined />
          </div>
          <div>
            <div className="reports-title-row">
              <h1>{t('reports.title')}</h1>
              <Tag
                className="reports-status-tag"
                color={data.status === 'connected' ? 'success' : 'warning'}
              >
                <span
                  className={`status-indicator-dot ${
                    data.status === 'connected' ? 'dot-online' : 'dot-offline'
                  }`}
                />
                {t(`common.status.${data.status}`)}
              </Tag>
            </div>
            <p>{t('reports.subtitle')}</p>
          </div>
        </div>
      </div>

      <section className="console-card reports-filter-panel">
        <div className="reports-filter-top-bar">
          <div className="reports-type-selector" role="group" aria-label={t('reports.filters.type')}>
            {typeOptions.map((option) => {
              const active = type === option.value;
              return (
                <Button
                  key={option.value}
                  type={active ? 'primary' : 'default'}
                  className={`reports-type-btn ${active ? 'is-active' : ''}`}
                  icon={option.icon}
                  onClick={() => handleTypeChange(option.value)}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>

          {type !== 4 && (
            <div className="reports-quick-ranges-bar">
              <span className="reports-quick-label">
                <ClockCircleOutlined />
                {t('reports.filters.quickRange')}:
              </span>
              <Button
                size="small"
                type="text"
                className="reports-quick-btn"
                onClick={() => applyQuickRange(24)}
              >
                {t('reports.filters.last24Hours')}
              </Button>
              <Button
                size="small"
                type="text"
                className="reports-quick-btn"
                onClick={() => applyQuickRange(24 * 7)}
              >
                {t('reports.filters.last7Days')}
              </Button>
              <Button
                size="small"
                type="text"
                className="reports-quick-btn"
                onClick={() => applyQuickRange(24 * 30)}
              >
                {t('reports.filters.last30Days')}
              </Button>
            </div>
          )}
        </div>

        <div className="reports-filters">
          {type !== 4 && (
            <div className="reports-filter-field reports-date-range-field">
              <span className="reports-filter-label">
                <CalendarOutlined />
                {t('reports.filters.dateRange')}
              </span>
              <DatePicker.RangePicker
                className="reports-date-range-picker"
                value={[dayjs(start), dayjs(end)]}
                allowClear={false}
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                onChange={handleDateRangeChange}
              />
            </div>
          )}

          <div className="reports-filter-field reports-select-field">
            <span className="reports-filter-label">{t('reports.filters.groupBy')}</span>
            <Select value={groupBy} options={groupingOptions} onChange={setGroupBy} />
          </div>

          {(type === 1 || type === 2) && (
            <div className="reports-filter-field reports-select-field">
              <span className="reports-filter-label">{t('reports.filters.deviceGroup')}</span>
              <Select
                allowClear
                value={deviceGroupId}
                placeholder={t('reports.filters.allDeviceGroups')}
                options={data.groups.map((group) => ({ value: group.id, label: group.name }))}
                onChange={setDeviceGroupId}
              />
            </div>
          )}

          {type === 1 && (
            <div className="reports-filter-field reports-switch-field">
              <span className="reports-filter-label">{t('reports.filters.showTraffic')}</span>
              <div className="reports-switch-container">
                <Switch size="small" checked={showTraffic} onChange={setShowTraffic} />
              </div>
            </div>
          )}

          <div className="reports-filter-actions">
            <Button
              type="primary"
              className="reports-query-btn"
              icon={queried ? <ReloadOutlined /> : <BarChartOutlined />}
              loading={loading}
              disabled={data.status !== 'connected'}
              onClick={() => void queryReports()}
            >
              {queried ? t('reports.actions.queryAgain') : t('reports.actions.query')}
            </Button>
            <Button
              className="reports-reset-btn"
              icon={<ClearOutlined />}
              onClick={handleResetFilters}
            >
              {t('reports.filters.reset')}
            </Button>
          </div>
        </div>
      </section>

      {data.status !== 'connected' && (
        <Alert showIcon type="warning" title={t('reports.states.disconnected')} />
      )}
      {error && (
        <Alert
          showIcon
          type="error"
          title={t('reports.states.failed')}
          description={error}
          action={<Button size="small" onClick={() => void queryReports()}>{t('common.actions.retry')}</Button>}
        />
      )}

      {!queried && !error && (
        <section className="console-card reports-empty-state">
          <div className="reports-empty-inner">
            <div className="reports-empty-icon-box">
              <BarChartOutlined />
            </div>
            <Typography.Title level={4} className="reports-empty-title">
              {t('reports.states.notQueried')}
            </Typography.Title>
            <Typography.Text type="secondary" className="reports-empty-desc">
              {t('reports.subtitle')}
            </Typography.Text>
            <Button
              type="primary"
              icon={<BarChartOutlined />}
              disabled={data.status !== 'connected'}
              onClick={() => void queryReports()}
              style={{ marginTop: 16 }}
            >
              {t('reports.actions.query')}
            </Button>
          </div>
        </section>
      )}

      {queried && !loading && !error && totalEntries === 0 && (
        <section className="console-card reports-empty-state">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('reports.states.empty')} />
        </section>
      )}

      {resultGroups.map(({ key, title, group, entries }) => (
        <section className="console-card reports-result-group" key={key}>
          <div className="reports-group-heading">
            <div className="reports-group-title-box">
              <div className="reports-group-avatar">
                {result?.groupFormat === 'user' ? (
                  <UserOutlined />
                ) : result?.groupFormat === 'nodemesh' ? (
                  <LaptopOutlined />
                ) : (
                  <CalendarOutlined />
                )}
              </div>
              <div>
                <Typography.Title level={4} className="reports-group-name">
                  {title || t('common.status.unknown')}
                </Typography.Title>
                <Typography.Text type="secondary" className="reports-group-sub">
                  {t('reports.states.entryCount', { count: entries.length })}
                </Typography.Text>
              </div>
            </div>
            <Badge
              count={entries.length}
              overflowCount={9999}
              style={{ backgroundColor: '#2563eb' }}
            />
          </div>
          <Table<ReportEntry>
            rowKey={(_, index) => `${key}-${index}`}
            columns={columns}
            dataSource={entries}
            loading={loading}
            pagination={{ pageSize: 25, hideOnSinglePage: true }}
            scroll={{ x: Math.max(760, columns.length * 150) }}
          />
          <ReportSummaries columns={result?.columns ?? []} group={group} context={presentationContext} />
        </section>
      ))}
    </div>
  );
}

function compareReportValues(left: unknown, right: unknown): number {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left ?? '').localeCompare(String(right ?? ''));
}

function renderReportCell(
  value: unknown,
  column: ReportColumn,
  context: Parameters<typeof formatReportValue>[2],
): React.ReactNode {
  const formatted = formatReportValue(value, column, context);
  if (value === undefined || value === null || value === '' || formatted === '-') {
    return <span className="report-cell-empty">-</span>;
  }

  if (column.format === 'protocol') {
    const protocolId = Number(value);
    const colorMap: Record<number, string> = {
      1: 'cyan',
      2: 'blue',
      5: 'orange',
      6: 'purple',
      7: 'gold',
      8: 'green',
    };
    const iconMap: Record<number, React.ReactNode> = {
      1: <CodeOutlined />,
      2: <DesktopOutlined />,
      5: <FolderOutlined />,
      6: <GlobalOutlined />,
      7: <GlobalOutlined />,
      8: <MessageOutlined />,
    };
    return (
      <Tag
        color={colorMap[protocolId] || 'default'}
        className="report-protocol-tag"
        icon={iconMap[protocolId]}
      >
        {formatted}
      </Tag>
    );
  }

  if (column.format === 'bytes') {
    const isOut = column.id.toLowerCase().includes('out');
    const isIn = column.id.toLowerCase().includes('in');
    return (
      <span className={`report-cell-bytes ${isOut ? 'bytes-out' : isIn ? 'bytes-in' : ''}`}>
        {isIn && <ArrowDownOutlined className="report-bytes-arrow in" />}
        {isOut && <ArrowUpOutlined className="report-bytes-arrow out" />}
        <span>{formatted}</span>
      </span>
    );
  }

  if (column.format === 'seconds') {
    return (
      <span className="report-cell-duration">
        <FieldTimeOutlined className="report-duration-icon" />
        <span>{formatted}</span>
      </span>
    );
  }

  if (column.format === '2fa') {
    return (
      <Tag color="cyan" icon={<SafetyCertificateOutlined />}>
        {formatted}
      </Tag>
    );
  }

  if (column.format === 'user') {
    return (
      <span className="report-cell-entity">
        <UserOutlined className="report-entity-icon" />
        <span>{formatted}</span>
      </span>
    );
  }

  if (column.format === 'node') {
    return (
      <span className="report-cell-entity">
        <LaptopOutlined className="report-entity-icon" />
        <span>{formatted}</span>
      </span>
    );
  }

  return formatted;
}

function ReportSummaries({
  columns,
  group,
  context,
}: {
  columns: ReportColumn[];
  group: { entries: ReportEntry[] };
  context: Parameters<typeof formatReportValue>[2];
}) {
  const { t } = useTranslation();
  const summaries = summarizeReportGroup(columns, group);
  if (summaries.length === 0) return null;
  return (
    <div className="reports-summaries">
      <div className="reports-summaries-header">
        <BarChartOutlined />
        <span>{t('reports.summary.title')}</span>
      </div>
      <div className="reports-summary-cards">
        {summaries.flatMap((summary) => {
          const column = columns.find((item) => item.id === summary.columnId);
          if (!column) return [];
          const title = getReportColumnTitle(column, context);
          if (summary.value !== undefined) {
            return (
              <div key={summary.columnId} className="reports-summary-chip">
                <span className="summary-chip-label">{title}</span>
                <span className="summary-chip-value">
                  {formatReportValue(summary.value, column, context)}
                </span>
              </div>
            );
          }
          return Object.entries(summary.valuesByKey ?? {}).map(([key, value]) => {
            const protoTitle = formatReportValue(
              Number(key),
              { id: 'protocol', title: 'protocol', format: 'protocol' },
              context,
            );
            return (
              <div key={`${summary.columnId}-${key}`} className="reports-summary-chip">
                <span className="summary-chip-label">{title} · {protoTitle}</span>
                <span className="summary-chip-value">
                  {formatReportValue(value, column, context)}
                </span>
              </div>
            );
          });
        })}
      </div>
    </div>
  );
}