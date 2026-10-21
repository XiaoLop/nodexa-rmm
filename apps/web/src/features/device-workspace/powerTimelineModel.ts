export interface PowerTimelineInterval {
  start: number;
  end: number;
  powerState: number;
}

export interface GanttSegment {
  dayIndex: number;
  startHour: number;
  endHour: number;
  powerState: number;
  startMs: number;
  endMs: number;
  durationMs: number;
  startTimeFormatted: string;
  endTimeFormatted: string;
  durationFormatted: string;
  stateLabel: string;
  color: string;
}

export interface DayTimelineItem {
  dayIndex: number;
  dateKey: string;
  dateLabel: string;
  dayStartMs: number;
  dayEndMs: number;
  isToday: boolean;
  onlineDurationMs: number;
  effectiveDurationMs: number;
  onlineRate: number;
  segments: GanttSegment[];
}

export interface PowerTimelineSummary {
  intervals: PowerTimelineInterval[];
  days: DayTimelineItem[];
  totalOnlineMs: number;
  totalSpanMs: number;
  overallOnlineRate: number;
  todayOnlineMs: number;
  todayOnlineRate: number;
  transitionCount: number;
  offlineCount: number;
  currentState: number;
  currentStreakMs: number;
}

export const POWER_STATE_NAMES: Record<number, string> = {
  0: 'common.status.offline',
  1: 'deviceWorkspace.timeline.statePowered',
  2: 'deviceWorkspace.timeline.stateSleepS1',
  3: 'deviceWorkspace.timeline.stateSleepS2',
  4: 'deviceWorkspace.timeline.stateSleepS3',
  5: 'deviceWorkspace.timeline.stateHibernate',
  6: 'deviceWorkspace.timeline.stateSoftOff',
  7: 'deviceWorkspace.timeline.statePresent',
  8: 'deviceWorkspace.timeline.statePoweredOff',
};

export const POWER_STATE_COLORS: Record<number, string> = {
  0: 'rgba(100, 116, 139, 0.45)', // Offline (slate)
  1: '#10b981',                    // Powered / Online (emerald green)
  2: '#38bdf8',                    // S1 Sleep (sky blue)
  3: '#60a5fa',                    // S2 Sleep (blue)
  4: '#818cf8',                    // S3 Deep Sleep (indigo)
  5: '#a855f7',                    // S4 Hibernate (purple)
  6: '#64748b',                    // S5 Soft Off (slate)
  7: '#14b8a6',                    // Present (teal)
  8: '#475569',                    // Powered off
};

export function isPowerStateOnline(state: number): boolean {
  return state === 1 || state === 7;
}

export function formatDuration(durationMs: number): string {
  if (durationMs <= 0) return '0m';
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

function padTwo(val: number): string {
  return String(val).padStart(2, '0');
}

export function formatTimeOfDay(date: Date): string {
  return `${padTwo(date.getHours())}:${padTwo(date.getMinutes())}:${padTwo(date.getSeconds())}`;
}

export function formatDateTime(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())} ${formatTimeOfDay(date)}`;
}

export function parsePowerTimeline(
  rawTimeline: number[] | undefined,
  now = Date.now(),
): PowerTimelineInterval[] {
  if (!rawTimeline || !Array.isArray(rawTimeline) || rawTimeline.length < 2) {
    return [];
  }

  // MeshCentral compresses time in odd indices into seconds
  // Multiply by 1000 to convert seconds to milliseconds if value is in seconds (< 1e11)
  const timeline = rawTimeline.map((val, idx) => {
    if (idx % 2 === 1) {
      return val < 1e11 ? val * 1000 : val;
    }
    return val;
  });

  const intervals: PowerTimelineInterval[] = [];
  const startPower = timeline[0] ?? 0;
  const firstTime = timeline[1] ?? now;

  if (firstTime > 0) {
    intervals.push({
      start: 0,
      end: firstTime,
      powerState: startPower,
    });
  }

  let ct = firstTime;
  for (let i = 2; i < timeline.length; i += 2) {
    const power = timeline[i] ?? 0;
    let dt = now - ct;
    if (timeline.length > i + 1) {
      dt = timeline[i + 1]!;
    }
    const end = Math.min(ct + dt, now);
    if (end > ct) {
      intervals.push({
        start: ct,
        end,
        powerState: power,
      });
    }
    ct = ct + dt;
  }

  // Extend the last state up to `now`
  if (ct < now && timeline.length >= 3) {
    const lastPower = timeline[timeline.length - 1] ?? 0;
    intervals.push({
      start: ct,
      end: now,
      powerState: lastPower,
    });
  }

  return intervals;
}

export function buildSevenDaysTimeline(
  rawTimeline: number[] | undefined,
  now = Date.now(),
): PowerTimelineSummary {
  const intervals = parsePowerTimeline(rawTimeline, now);

  const nowDate = new Date(now);
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();

  // 7 days window: from 6 days ago 00:00:00 to today end
  const days: DayTimelineItem[] = [];
  const msPerDay = 86_400_000;
  const sevenDaysStartMs = todayStart - 6 * msPerDay;

  let totalOnlineMs = 0;
  let todayOnlineMs = 0;
  let offlineCount = 0;
  let transitionCount = 0;

  for (let d = 0; d < 7; d++) {
    const dayStartMs = sevenDaysStartMs + d * msPerDay;
    const dayEndMs = dayStartMs + msPerDay;
    const isToday = d === 6;
    const effectiveDayEndMs = isToday ? now : dayEndMs;
    const effectiveDurationMs = Math.max(0, effectiveDayEndMs - dayStartMs);

    const dateObj = new Date(dayStartMs);
    const dateKey = `${dateObj.getFullYear()}-${padTwo(dateObj.getMonth() + 1)}-${padTwo(dateObj.getDate())}`;
    const weekdayStr = ['日', '一', '二', '三', '四', '五', '六'][dateObj.getDay()];
    const dateLabel = isToday
      ? `今天 (${padTwo(dateObj.getMonth() + 1)}-${padTwo(dateObj.getDate())})`
      : `${padTwo(dateObj.getMonth() + 1)}-${padTwo(dateObj.getDate())} 周${weekdayStr}`;

    const segments: GanttSegment[] = [];
    let dayOnlineMs = 0;

    for (const interval of intervals) {
      const segStart = Math.max(dayStartMs, interval.start);
      const segEnd = Math.min(effectiveDayEndMs, interval.end);

      if (segEnd > segStart) {
        const segDurationMs = segEnd - segStart;
        if (isPowerStateOnline(interval.powerState)) {
          dayOnlineMs += segDurationMs;
        }

        const startHour = (segStart - dayStartMs) / 3_600_000;
        const endHour = (segEnd - dayStartMs) / 3_600_000;
        const color = POWER_STATE_COLORS[interval.powerState] ?? POWER_STATE_COLORS[0]!;
        const stateLabelKey = POWER_STATE_NAMES[interval.powerState] ?? 'common.status.unknown';

        segments.push({
          dayIndex: d,
          startHour,
          endHour,
          powerState: interval.powerState,
          startMs: segStart,
          endMs: segEnd,
          durationMs: segDurationMs,
          startTimeFormatted: formatTimeOfDay(new Date(segStart)),
          endTimeFormatted: formatTimeOfDay(new Date(segEnd)),
          durationFormatted: formatDuration(segDurationMs),
          stateLabel: stateLabelKey,
          color,
        });
      }
    }

    const onlineRate =
      effectiveDurationMs > 0
        ? Math.min(100, Math.round((dayOnlineMs / effectiveDurationMs) * 1000) / 10)
        : 0;

    totalOnlineMs += dayOnlineMs;
    if (isToday) {
      todayOnlineMs = dayOnlineMs;
    }

    days.push({
      dayIndex: d,
      dateKey,
      dateLabel,
      dayStartMs,
      dayEndMs,
      isToday,
      onlineDurationMs: dayOnlineMs,
      effectiveDurationMs,
      onlineRate,
      segments,
    });
  }

  // Count transitions & offline occurrences in the 7-day window
  const recentIntervals = intervals.filter(
    (item) => item.end > sevenDaysStartMs && item.start < now,
  );
  for (let i = 0; i < recentIntervals.length; i++) {
    const cur = recentIntervals[i]!;
    if (!isPowerStateOnline(cur.powerState)) {
      offlineCount++;
    }
    if (i > 0 && cur.powerState !== recentIntervals[i - 1]?.powerState) {
      transitionCount++;
    }
  }

  const totalSpanMs = Math.max(1, now - sevenDaysStartMs);
  const overallOnlineRate = Math.min(
    100,
    Math.round((totalOnlineMs / totalSpanMs) * 1000) / 10,
  );

  const todayItem = days[6];
  const todaySpanMs = todayItem ? todayItem.effectiveDurationMs : 1;
  const todayOnlineRate =
    todaySpanMs > 0 ? Math.min(100, Math.round((todayOnlineMs / todaySpanMs) * 1000) / 10) : 0;

  const lastInterval = intervals[intervals.length - 1];
  const currentState = lastInterval ? lastInterval.powerState : 0;
  const currentStreakMs = lastInterval ? Math.max(0, now - lastInterval.start) : 0;

  return {
    intervals,
    days,
    totalOnlineMs,
    totalSpanMs,
    overallOnlineRate,
    todayOnlineMs,
    todayOnlineRate,
    transitionCount,
    offlineCount,
    currentState,
    currentStreakMs,
  };
}
