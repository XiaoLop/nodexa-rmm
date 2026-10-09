import { CalendarOutlined, ReloadOutlined } from '@ant-design/icons';
import type { MeshCentralClient } from '@meshcentral/control-client';
import { Button, Spin, Tag, Tooltip } from 'antd';
import { CustomChart } from 'echarts/charts';
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import type { CustomSeriesRenderItem, EChartsOption } from 'echarts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildSevenDaysTimeline,
  formatDuration,
  isPowerStateOnline,
  type PowerTimelineSummary,
} from '../../features/device-workspace/powerTimelineModel';

echarts.use([CanvasRenderer, GridComponent, TooltipComponent, MarkLineComponent, CustomChart]);

interface DevicePowerTimelineCardProps {
  deviceId: string;
  client?: MeshCentralClient;
  deviceOnline?: boolean;
  controlConnected?: boolean;
}

export function DevicePowerTimelineCard({
  deviceId,
  client,
  controlConnected = true,
}: DevicePowerTimelineCardProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [rawTimeline, setRawTimeline] = useState<number[]>();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  // Keep current time updated every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const loadTimeline = useCallback(async () => {
    if (!client || !controlConnected || !deviceId) return;
    setLoading(true);
    try {
      if (typeof client.devices.powerTimeline === 'function') {
        const result = await client.devices.powerTimeline(deviceId);
        setRawTimeline(result);
      } else {
        const response = await client.request<{
          action?: string;
          nodeid?: string;
          timeline?: number[];
        }>({ action: 'powertimeline', nodeid: deviceId });
        if (Array.isArray(response?.timeline)) {
          setRawTimeline(response.timeline);
        }
      }
    } catch {
      // If server does not have power events yet, keep undefined/fallback
    } finally {
      setLoading(false);
    }
  }, [client, controlConnected, deviceId]);

  // Initial fetch on mount or deviceId change
  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  // Listen for realtime push updates
  useEffect(() => {
    if (!client || !deviceId) return;
    return client.on('message', (msg: unknown) => {
      if (
        typeof msg === 'object' &&
        msg !== null &&
        (msg as Record<string, unknown>).action === 'powertimeline' &&
        (msg as Record<string, unknown>).nodeid === deviceId &&
        Array.isArray((msg as Record<string, unknown>).timeline)
      ) {
        setRawTimeline((msg as Record<string, unknown>).timeline as number[]);
      }
    });
  }, [client, deviceId]);

  const summary: PowerTimelineSummary = useMemo(() => {
    return buildSevenDaysTimeline(rawTimeline, currentTime);
  }, [currentTime, rawTimeline]);

  // ECharts Option for Daily 24H Gantt Chart
  const dailyOption = useMemo<EChartsOption>(() => {
    const yCategories = summary.days.map((item) => item.dateLabel);

    // Track background rectangles for each day (0 to 24h)
    const trackData: Array<[number, number, number]> = summary.days.map((d) => [
      d.dayIndex,
      0,
      d.isToday ? (currentTime - d.dayStartMs) / 3_600_000 : 24,
    ]);

    // Segment items for custom series
    const segmentData: Array<{
      value: [number, number, number, number]; // [dayIndex, startHour, endHour, powerState]
      itemStyle: { color: string };
      extra: {
        dateLabel: string;
        startTimeFormatted: string;
        endTimeFormatted: string;
        durationFormatted: string;
        stateLabel: string;
        isOnline: boolean;
      };
    }> = [];

    summary.days.forEach((day) => {
      day.segments.forEach((seg) => {
        segmentData.push({
          value: [seg.dayIndex, seg.startHour, seg.endHour, seg.powerState],
          itemStyle: { color: seg.color },
          extra: {
            dateLabel: day.dateLabel,
            startTimeFormatted: seg.startTimeFormatted,
            endTimeFormatted: seg.endTimeFormatted,
            durationFormatted: seg.durationFormatted,
            stateLabel: t(seg.stateLabel),
            isOnline: isPowerStateOnline(seg.powerState),
          },
        });
      });
    });

    const renderTrack: CustomSeriesRenderItem = (_params, api) => {
      const dayIndex = api.value(0) as number;
      const startHour = api.value(1) as number;
      const endHour = api.value(2) as number;

      const startCoord = api.coord([startHour, dayIndex]) ?? [0, 0];
      const endCoord = api.coord([endHour, dayIndex]) ?? [0, 0];
      const startX = startCoord[0] ?? 0;
      const endX = endCoord[0] ?? 0;
      const centerY = startCoord[1] ?? 0;
      const bandHeight = (api.size?.([0, 1]) as number[])?.[1] ?? 36;
      const barHeight = Math.max(12, Math.min(22, bandHeight * 0.52));

      return {
        type: 'rect',
        shape: {
          x: startX,
          y: centerY - barHeight / 2,
          width: Math.max(0, endX - startX),
          height: barHeight,
          r: 4,
        },
        style: {
          fill: 'rgba(30, 48, 77, 0.45)',
          stroke: 'rgba(56, 82, 118, 0.3)',
          lineWidth: 1,
        },
      };
    };

    const renderSegment: CustomSeriesRenderItem = (_params, api) => {
      const dayIndex = api.value(0) as number;
      const startHour = api.value(1) as number;
      const endHour = api.value(2) as number;

      const startCoord = api.coord([startHour, dayIndex]) ?? [0, 0];
      const endCoord = api.coord([endHour, dayIndex]) ?? [0, 0];
      const startX = startCoord[0] ?? 0;
      const endX = endCoord[0] ?? 0;
      const centerY = startCoord[1] ?? 0;
      const bandHeight = (api.size?.([0, 1]) as number[])?.[1] ?? 36;
      const barHeight = Math.max(12, Math.min(22, bandHeight * 0.52));
      const width = Math.max(2, endX - startX);

      return {
        type: 'rect',
        shape: {
          x: startX,
          y: centerY - barHeight / 2,
          width,
          height: barHeight,
          r: 3,
        },
        style: {
          fill: (api.visual('color') as string) ?? '#10b981',
        },
      };
    };

    const todayDate = new Date(currentTime);
    const todayHour = todayDate.getHours() + todayDate.getMinutes() / 60;

    return {
      grid: {
        top: 24,
        right: 28,
        bottom: 30,
        left: 10,
        containLabel: true,
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(10, 22, 40, 0.94)',
        borderColor: 'rgba(84, 133, 214, 0.35)',
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: '#c9d8ec', fontSize: 11 },
        extraCssText:
          'backdrop-filter: blur(12px); border-radius: 8px; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.55); min-width: 170px;',
        formatter: (params) => {
          const item = params as {
            data?: {
              extra?: {
                dateLabel: string;
                startTimeFormatted: string;
                endTimeFormatted: string;
                durationFormatted: string;
                stateLabel: string;
                isOnline: boolean;
              };
            };
          };
          const extra = item.data?.extra;
          if (!extra) return '';

          const dotColor = extra.isOnline ? '#10b981' : '#64748b';
          const glow = extra.isOnline ? 'box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);' : '';

          return [
            `<div style="font-size: 11px; font-weight: 600; color: #94a3b8; margin-bottom: 6px; border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding-bottom: 4px;">${extra.dateLabel}</div>`,
            `<div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 4px;">`,
            `  <span style="display: inline-flex; align-items: center; gap: 6px; color: #e2e8f0; font-size: 11px;">`,
            `    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; ${glow}"></span>`,
            `    ${extra.stateLabel}`,
            `  </span>`,
            `  <strong style="color: ${extra.isOnline ? '#34d399' : '#94a3b8'}; font-weight: 600; font-size: 11px;">${extra.durationFormatted}</strong>`,
            `</div>`,
            `<div style="font-size: 10px; color: #7f95ae; margin-top: 3px;">`,
            `  ${extra.startTimeFormatted} - ${extra.endTimeFormatted}`,
            `</div>`,
          ].join('');
        },
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 24,
        interval: 3,
        axisLine: { lineStyle: { color: 'rgba(99, 146, 218, 0.25)' } },
        splitLine: {
          lineStyle: {
            color: 'rgba(99, 146, 218, 0.12)',
            type: 'dashed',
          },
        },
        axisLabel: {
          color: '#8da6ca',
          fontSize: 10,
          formatter: (val: number) => `${String(Math.floor(val)).padStart(2, '0')}:00`,
        },
      },
      yAxis: {
        type: 'category',
        data: yCategories,
        inverse: false,
        axisLine: { lineStyle: { color: 'rgba(99, 146, 218, 0.25)' } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          color: '#cbd5e1',
          fontSize: 11,
          margin: 12,
        },
      },
      series: [
        {
          name: 'Track',
          type: 'custom',
          renderItem: renderTrack,
          silent: true,
          encode: { x: [1, 2], y: 0 },
          data: trackData,
        },
        {
          name: 'PowerState',
          type: 'custom',
          renderItem: renderSegment,
          encode: { x: [1, 2], y: 0 },
          data: segmentData,
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            data: [
              {
                xAxis: todayHour,
                lineStyle: {
                  color: '#38bdf8',
                  type: 'dotted',
                  width: 1.5,
                },
                label: {
                  show: true,
                  formatter: t('deviceWorkspace.timeline.currentTime'),
                  position: 'start',
                  fontSize: 9,
                  color: '#38bdf8',
                },
              },
            ],
          },
        },
      ],
    };
  }, [currentTime, summary.days, t]);


  // Initialize and update ECharts instance
  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    chartInstanceRef.current = chart;
    chart.setOption(dailyOption, true);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(chartRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [dailyOption]);

  return (
    <section className="console-card workspace-panel workspace-power-timeline-card">
      <div className="card-header">
        <div>
          <div className="timeline-title-row">
            <CalendarOutlined />
            <h2>{t('deviceWorkspace.timeline.title')}</h2>
          </div>
          <span>{t('deviceWorkspace.timeline.subtitle')}</span>
        </div>

        <div className="timeline-actions">
          <Tooltip title={t('deviceWorkspace.timeline.refresh')}>
            <Button
              size="small"
              icon={<ReloadOutlined spin={loading} />}
              onClick={() => void loadTimeline()}
              disabled={loading}
            />
          </Tooltip>
        </div>
      </div>

      <div className="timeline-summary-tags">
        <Tag>
          {t('deviceWorkspace.timeline.onlineRate7d')}：<strong>{summary.overallOnlineRate}%</strong>
          <span>{formatDuration(summary.totalOnlineMs)}</span>
        </Tag>
        <Tag>
          {t('deviceWorkspace.timeline.todayOnlineRate')}：<strong>{summary.todayOnlineRate}%</strong>
          <span>{formatDuration(summary.todayOnlineMs)}</span>
        </Tag>
        <Tag>
          {t('deviceWorkspace.timeline.stateChanges')}：<strong>{summary.transitionCount} {t('deviceWorkspace.timeline.times')}</strong>
          <span>{t('common.status.offline')} {summary.offlineCount} {t('deviceWorkspace.timeline.times')}</span>
        </Tag>
      </div>

      <div className="timeline-chart-container">
        {loading && (
          <div className="timeline-loading-overlay">
            <Spin size="small" />
            <span>{t('deviceWorkspace.timeline.loading')}</span>
          </div>
        )}
        <div
          ref={chartRef}
          className="timeline-echarts"
          style={{ height: 260 }}
          role="img"
          aria-label={t('deviceWorkspace.timeline.title')}
        />
      </div>

      <div className="timeline-footer">
        <div className="timeline-legend">
          <span className="legend-item">
            <i style={{ backgroundColor: '#10b981' }} />
            <span>{t('deviceWorkspace.timeline.legendOnline')} (S0)</span>
          </span>
          <span className="legend-item">
            <i style={{ backgroundColor: '#38bdf8' }} />
            <span>{t('deviceWorkspace.timeline.legendSleep')} (S1-S4)</span>
          </span>
          <span className="legend-item">
            <i style={{ backgroundColor: '#64748b' }} />
            <span>{t('deviceWorkspace.timeline.legendOffline')} (S5)</span>
          </span>
        </div>

        <div className="timeline-hint">
          {t('deviceWorkspace.timeline.subtitle')}
        </div>
      </div>
    </section>
  );
}
