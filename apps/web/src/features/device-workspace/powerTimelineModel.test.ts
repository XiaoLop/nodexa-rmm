import { describe, expect, it } from 'vitest';
import {
  buildSevenDaysTimeline,
  formatDuration,
  parsePowerTimeline,
} from './powerTimelineModel';

describe('powerTimelineModel', () => {
  it('parses empty or short raw timeline', () => {
    expect(parsePowerTimeline(undefined)).toEqual([]);
    expect(parsePowerTimeline([])).toEqual([]);
    expect(parsePowerTimeline([1])).toEqual([]);
  });

  it('parses standard MeshCentral compressed timeline [0, 1791548099, 1, 977, 0]', () => {
    const now = (1791548099 + 977 + 500) * 1000;
    const intervals = parsePowerTimeline([0, 1791548099, 1, 977, 0], now);

    expect(intervals).toHaveLength(3);
    // Interval 0: from 0 to startTimeUTC with powerState = 0
    expect(intervals[0]).toEqual({
      start: 0,
      end: 1791548099 * 1000,
      powerState: 0,
    });
    // Interval 1: from startTimeUTC for 977 seconds with powerState = 1
    expect(intervals[1]).toEqual({
      start: 1791548099 * 1000,
      end: (1791548099 + 977) * 1000,
      powerState: 1,
    });
    // Interval 2: from end of Interval 1 to now with powerState = 0
    expect(intervals[2]).toEqual({
      start: (1791548099 + 977) * 1000,
      end: now,
      powerState: 0,
    });
  });

  it('formats duration correctly', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45_000)).toBe('45s');
    expect(formatDuration(120_000)).toBe('2m');
    expect(formatDuration(3_600_000)).toBe('1h');
    expect(formatDuration(3_720_000)).toBe('1h 2m');
    expect(formatDuration(25 * 3_600_000 + 15 * 60_000)).toBe('25h 15m');
  });

  it('builds 7 days summary with correct day segmentation', () => {
    // Current time: 2026-10-09 12:00:00
    const now = new Date('2026-10-09T12:00:00Z').getTime();
    // Device was powered on for 4 hours earlier today
    const fourHoursAgo = now - 4 * 3_600_000;
    const timeline = [0, Math.floor(fourHoursAgo / 1000), 1, 3600 * 2, 0];

    const summary = buildSevenDaysTimeline(timeline, now, false);
    expect(summary.days).toHaveLength(7);
    expect(summary.days[6]?.isToday).toBe(true);
    expect(summary.totalOnlineMs).toBeGreaterThan(0);
    expect(summary.overallOnlineRate).toBeGreaterThanOrEqual(0);
    expect(summary.overallOnlineRate).toBeLessThanOrEqual(100);
  });

  it('does not let the current device connection overwrite historical statistics', () => {
    const now = new Date('2026-10-09T12:00:00Z').getTime();
    const twoHoursAgo = now - 2 * 3_600_000;
    const timeline = [0, Math.floor(twoHoursAgo / 1000), 1];

    const onlineSummary = buildSevenDaysTimeline(timeline, now, true);
    const offlineSummary = buildSevenDaysTimeline(timeline, now, false);

    expect(offlineSummary.totalOnlineMs).toBe(onlineSummary.totalOnlineMs);
    expect(offlineSummary.overallOnlineRate).toBe(onlineSummary.overallOnlineRate);
    expect(offlineSummary.todayOnlineRate).toBe(onlineSummary.todayOnlineRate);
  });
});
