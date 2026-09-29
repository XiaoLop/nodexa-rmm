import {
  ApartmentOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  DesktopOutlined,
  DisconnectOutlined,
  ExclamationCircleOutlined,
  FolderOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { LineChart } from 'echarts/charts';
import * as echarts from 'echarts/core';
import type { EChartsOption } from 'echarts';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { useFormatters } from '../i18n';

echarts.use([CanvasRenderer, GridComponent, LegendComponent, LineChart, TooltipComponent]);

export type MetricTone = 'blue' | 'green' | 'purple' | 'amber' | 'red';

export function MetricCard({
  label,
  value,
  hint,
  tone,
  icon,
  chart,
  badge,
  onClick,
  extra,
}: {
  label: string;
  value: number;
  hint: ReactNode;
  tone: MetricTone;
  icon: ReactNode;
  chart?: number[];
  badge?: ReactNode;
  onClick?: () => void;
  extra?: ReactNode;
}) {
  const { number } = useFormatters();
  return (
    <section
      className={`metric-card tone-${tone} ${onClick ? 'is-clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="metric-icon">{icon}</div>
      <div className="metric-copy">
        <div className="metric-label-row">
          <span>{label}</span>
          {badge && <span className="metric-badge">{badge}</span>}
        </div>
        <strong>{number(value)}</strong>
        <div className="metric-hint-row">
          <small>{hint}</small>
          {extra}
        </div>
      </div>
      {chart && <Sparkline values={chart} />}
    </section>
  );
}

export function Sparkline({
  values,
  tone = 'green',
  ariaLabel,
}: {
  values: number[];
  tone?: MetricTone;
  ariaLabel?: string;
}) {
  const { t } = useTranslation();
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 34 - ((value - min) / span) * 28;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg
      className={`sparkline tone-${tone}`}
      viewBox="0 0 100 38"
      role="img"
      aria-label={ariaLabel ?? t('dashboard.trend.ariaTrend')}
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

export function TrendChart({
  online,
  offline,
  labels,
  loading = false,
  error = false,
  unavailable = false,
  onRetry,
}: {
  online: number[];
  offline: number[];
  labels?: string[];
  loading?: boolean;
  error?: boolean;
  unavailable?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  const hasTrend = online.length > 1 && offline.length > 1;
  const hasSample = online.length === 1 && offline.length === 1;
  const chartLabels = labels?.length
    ? labels
    : ['00:00', '06:00', '12:00', '18:00', t('common.status.now')];
  const chartRef = useRef<HTMLDivElement>(null);

  const latestOnline = online.length > 0 ? (online[online.length - 1] ?? 0) : 0;
  const latestOffline = offline.length > 0 ? (offline[offline.length - 1] ?? 0) : 0;
  const total = latestOnline + latestOffline;
  const onlineRate = total > 0 ? ((latestOnline / total) * 100).toFixed(1) : '100.0';

  useEffect(() => {
    if (!chartRef.current || !hasTrend) return;
    const chart = echarts.init(chartRef.current);
    const option: EChartsOption = {
      animation: true,
      animationDuration: 600,
      animationEasing: 'cubicOut',
      grid: {
        top: 20,
        right: 16,
        bottom: 24,
        left: 20,
        containLabel: true,
      },
      legend: { show: false },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: 'rgba(99, 146, 218, 0.45)',
            width: 1.5,
            type: 'dashed',
          },
        },
        backgroundColor: 'rgba(10, 22, 40, 0.94)',
        borderColor: 'rgba(84, 133, 214, 0.32)',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: '#c9d8ec', fontSize: 11 },
        extraCssText:
          'backdrop-filter: blur(12px); border-radius: 8px; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55); min-width: 155px;',
        formatter: (params) => {
          const values = Array.isArray(params) ? params : [params];
          const index = values[0]?.dataIndex ?? 0;
          const onCount = online[index] ?? 0;
          const offCount = offline[index] ?? 0;
          const curTotal = onCount + offCount;
          const curRate = curTotal > 0 ? ((onCount / curTotal) * 100).toFixed(1) : '100.0';
          const time = chartLabels[index] ?? t('common.status.now');

          return [
            `<div style="font-size: 11px; font-weight: 600; color: #8fa5c2; margin-bottom: 8px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 4px;">${time}</div>`,
            `<div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 5px;">`,
            `  <span style="display: inline-flex; align-items: center; gap: 6px; color: #d0deef; font-size: 11px;">`,
            `    <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #25d990; box-shadow: 0 0 6px rgba(37, 217, 144, 0.8);"></span>`,
            `    ${t('common.status.online')}`,
            `  </span>`,
            `  <strong style="color: #25d990; font-weight: 600; font-size: 12px;">${onCount}</strong>`,
            `</div>`,
            `<div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 6px;">`,
            `  <span style="display: inline-flex; align-items: center; gap: 6px; color: #d0deef; font-size: 11px;">`,
            `    <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #8da6ca;"></span>`,
            `    ${t('common.status.offline')}`,
            `  </span>`,
            `  <strong style="color: #8da6ca; font-weight: 600; font-size: 12px;">${offCount}</strong>`,
            `</div>`,
            `<div style="border-top: 1px solid rgba(255, 255, 255, 0.06); padding-top: 5px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #7287a3;">`,
            `  <span>${t('dashboard.metrics.onlineRate', { rate: curRate })}</span>`,
            `</div>`,
          ].join('');
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: chartLabels,
        axisLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.08)' } },
        axisTick: { show: false },
        axisLabel: {
          color: '#768ca8',
          fontSize: 11,
          margin: 12,
          interval: Math.max(Math.ceil(chartLabels.length / 5) - 1, 0),
          showMinLabel: true,
          showMaxLabel: true,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        minInterval: 1,
        splitNumber: 4,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#687e9b', fontSize: 11, margin: 10 },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: t('common.status.online'),
          type: 'line',
          data: online,
          smooth: 0.35,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 6,
          emphasis: {
            scale: 1.5,
            itemStyle: {
              color: '#25d990',
              borderColor: '#ffffff',
              borderWidth: 2,
              shadowColor: 'rgba(37, 217, 144, 0.6)',
              shadowBlur: 8,
            },
          },
          lineStyle: {
            color: '#25d990',
            width: 2.5,
            shadowColor: 'rgba(37, 217, 144, 0.35)',
            shadowBlur: 10,
            shadowOffsetY: 4,
          },
          itemStyle: { color: '#25d990' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(37, 217, 144, 0.32)' },
                { offset: 0.65, color: 'rgba(37, 217, 144, 0.08)' },
                { offset: 1, color: 'rgba(37, 217, 144, 0.00)' },
              ],
            },
          },
        },
        {
          name: t('common.status.offline'),
          type: 'line',
          data: offline,
          smooth: 0.35,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 6,
          emphasis: {
            scale: 1.5,
            itemStyle: {
              color: '#8da6ca',
              borderColor: '#ffffff',
              borderWidth: 2,
              shadowColor: 'rgba(141, 166, 202, 0.6)',
              shadowBlur: 8,
            },
          },
          lineStyle: {
            color: '#8da6ca',
            width: 2,
            shadowColor: 'rgba(141, 166, 202, 0.3)',
            shadowBlur: 8,
            shadowOffsetY: 3,
          },
          itemStyle: { color: '#8da6ca' },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(141, 166, 202, 0.24)' },
                { offset: 0.65, color: 'rgba(141, 166, 202, 0.06)' },
                { offset: 1, color: 'rgba(141, 166, 202, 0.00)' },
              ],
            },
          },
        },
      ],
    };
    chart.setOption(option);
    const resizeObserver = new ResizeObserver(() => chart.resize());
    resizeObserver.observe(chartRef.current);
    return () => {
      resizeObserver.disconnect();
      chart.dispose();
    };
  }, [chartLabels, hasTrend, offline, online, t]);

  return (
    <div className="trend-chart">
      {(hasTrend || hasSample) && (
        <div className="trend-summary-bar chart-legend">
          <div className="trend-stat-pill online">
            <span className="indicator-dot" />
            <span className="pill-label">{t('common.status.online')}</span>
            <strong>{latestOnline}</strong>
            <span className="rate-badge">{onlineRate}%</span>
          </div>
          <div className="trend-stat-pill offline">
            <span className="indicator-dot" />
            <span className="pill-label">{t('common.status.offline')}</span>
            <strong>{latestOffline}</strong>
          </div>
        </div>
      )}
      <div className="trend-plot">
        {hasTrend ? (
          <div
            ref={chartRef}
            className="trend-echarts"
            role="img"
            aria-label={t('dashboard.trend.ariaDeviceTrend')}
          />
        ) : !loading ? (
          <div className="trend-state" role="status">
            <strong>
              {error
                ? t('dashboard.trend.loadFailed')
                : unavailable
                  ? t('dashboard.trend.unavailable')
                : hasSample
                  ? t('dashboard.trend.singleSample')
                  : t('dashboard.trend.noData')}
            </strong>
            <span>
              {error
                ? t('dashboard.trend.loadFailedDescription')
                : unavailable
                  ? t('dashboard.trend.unavailableDescription')
                : hasSample
                  ? t('dashboard.trend.singleSampleDescription')
                  : t('dashboard.trend.noDataDescription')}
            </span>
            {error && onRetry ? (
              <button type="button" onClick={onRetry}>
                {t('common.actions.retry')}
              </button>
            ) : null}
          </div>
        ) : null}
        {loading && (
          <div className="trend-loading" role="status" aria-live="polite">
            <span className="trend-loading-spinner" />
            <span>{t('dashboard.trend.loading')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function DonutChart({
  data,
  total,
  totalLabel,
}: {
  data: Array<{ label: string; value: number; color: string }>;
  total: number;
  totalLabel?: string;
}) {
  const { t } = useTranslation();
  const { number, percent } = useFormatters();
  const denominator = Math.max(
    data.reduce((sum, item) => sum + item.value, 0),
    1,
  );
  let cursor = 0;
  const gradient = data
    .map((item) => {
      const start = cursor;
      cursor += (item.value / denominator) * 100;
      return `${item.color} ${start}% ${cursor}%`;
    })
    .join(', ');

  return (
    <div className="donut-layout">
      <div
        className="donut"
        style={{ background: `conic-gradient(${gradient || '#253348 0 100%'})` }}
      >
        <div>
          <strong>{number(total)}</strong>
          <span>{totalLabel ?? t('dashboard.platforms.totalDevices')}</span>
        </div>
      </div>
      <div className="donut-legend">
        {data.map((item) => (
          <div key={item.label}>
            <i style={{ background: item.color }} />
            <span>{item.label}</span>
            <b>{percent(item.value / denominator, 0)}</b>
            <em>({number(item.value)})</em>
          </div>
        ))}
      </div>
    </div>
  );
}

export function iconForMetric(kind: 'total' | 'online' | 'groups' | 'offline' | 'events') {
  const icons = {
    total: <CloudServerOutlined />,
    online: <DesktopOutlined />,
    groups: <FolderOutlined />,
    offline: <ExclamationCircleOutlined />,
    events: <SafetyCertificateOutlined />,
  };
  return icons[kind];
}

export function deviceIcon(platform?: string) {
  const value = platform?.toLowerCase() ?? '';
  if (value.includes('server') || value.includes('linux')) return <CloudServerOutlined />;
  if (value.includes('mobile') || value.includes('android') || value.includes('ios')) {
    return <ApartmentOutlined />;
  }
  return <DesktopOutlined />;
}

export function connectionIcon(connected: boolean) {
  return connected ? <CheckCircleOutlined /> : <DisconnectOutlined />;
}
