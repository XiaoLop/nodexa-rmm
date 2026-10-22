// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useServerErrorLog, useServerStats, useServerTrace } from './hooks';

const state = vi.hoisted(() => ({ client: undefined as any }));
vi.mock('../gateway', () => ({ useMeshCentralControl: () => ({ client: state.client }) }));
let connection: (event: { current: string }) => void;
let packet: (value: { source: string; args: unknown[]; time: number }) => void;
let sources: (value: readonly string[]) => void;
let statsListener: (stats: any) => void;
const unsubscribeTrace = vi.fn();
const unsubscribeSources = vi.fn();
const unsubscribeStats = vi.fn();
const settle = async () => { await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  vi.useFakeTimers();
  state.client = {
    connectionStatus: 'connected',
    on: vi.fn((_event, listener) => { connection = listener; return vi.fn(); }),
    server: {
      getTraceSources: vi.fn(() => ['web']),
      subscribeTraceSources: vi.fn(listener => { sources = listener; return unsubscribeSources; }),
      subscribeTrace: vi.fn(listener => { packet = listener; return unsubscribeTrace; }),
      subscribeStats: vi.fn(listener => { statsListener = listener; return unsubscribeStats; }),
      setTraceSources: vi.fn(async () => {}),
      fetchErrorLog: vi.fn(async () => ({ content: 'errors' })),
      clearErrorLog: vi.fn(async () => {}),
    },
  };
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('server trace hook', () => {
  it('initializes cache, subscribes, batches, bounds and never writes global settings', () => {
    const { result, unmount } = renderHook(useServerTrace);
    expect(result.current.sources).toEqual(['web']);
    act(() => sources(['agent']));
    expect(result.current.sources).toEqual(['agent']);
    act(() => { for (let i = 0; i < 5100; i++) packet({ source: 'agent', args: [i], time: i }); });
    expect(result.current.records).toHaveLength(0);
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.records).toHaveLength(5000);
    expect(result.current.records[0]?.time).toBe(100);
    act(() => result.current.setPaused(true));
    act(() => { packet({ source: 'agent', args: [], time: 9999 }); vi.advanceTimersByTime(100); });
    expect(result.current.records.at(-1)?.time).toBe(9999);
    expect(result.current.records).toHaveLength(5000);
    act(() => packet({ source: 'agent', args: [], time: 10000 }));
    act(() => result.current.clearRecords());
    act(() => vi.advanceTimersByTime(100));
    expect(result.current.records).toEqual([]);
    act(() => { packet({ source: 'agent', args: [], time: 10001 }); vi.advanceTimersByTime(100); });
    expect(result.current.records.map(record => record.time)).toEqual([10001]);
    act(() => { state.client.connectionStatus = 'disconnected'; connection({ current: 'disconnected' }); });
    act(() => { state.client.connectionStatus = 'connected'; connection({ current: 'connected' }); });
    unmount();
    expect(unsubscribeTrace).toHaveBeenCalled();
    expect(unsubscribeSources).toHaveBeenCalled();
    expect(state.client.server.setTraceSources).not.toHaveBeenCalled();
  });
});

describe('error log hook', () => {
  it('sends clear once and does one delayed read without claiming missing content is success', async () => {
    const { result } = renderHook(useServerErrorLog);
    await settle();
    expect(result.current.content).toBe('errors');
    state.client.server.fetchErrorLog.mockResolvedValue({});
    await act(async () => result.current.clear());
    expect(result.current.clearSent).toBe(true);
    expect(result.current.content).toBeUndefined();
    expect(state.client.server.clearErrorLog).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(state.client.server.fetchErrorLog).toHaveBeenCalledTimes(2);
    await act(async () => vi.advanceTimersByTimeAsync(10000));
    expect(state.client.server.fetchErrorLog).toHaveBeenCalledTimes(2);
    expect(state.client.server.clearErrorLog).toHaveBeenCalledTimes(1);
  });
  it('distinguishes empty content, disables disconnected writes, initializes on reconnect', async () => {
    state.client.server.fetchErrorLog.mockResolvedValue({ content: '' });
    const { result } = renderHook(useServerErrorLog);
    await settle();
    expect(result.current.content).toBe('');
    act(() => { state.client.connectionStatus = 'disconnected'; connection({ current: 'disconnected' }); });
    await act(async () => result.current.clear());
    expect(state.client.server.clearErrorLog).not.toHaveBeenCalled();
    act(() => { state.client.connectionStatus = 'connected'; connection({ current: 'connected' }); });
    await settle();
    expect(state.client.server.fetchErrorLog).toHaveBeenCalledTimes(2);
  });
  it('ignores stale responses after disconnect', async () => {
    let resolve!: (value: { content: string }) => void;
    state.client.server.fetchErrorLog.mockReturnValue(new Promise(done => { resolve = done; }));
    const { result } = renderHook(useServerErrorLog);
    act(() => { state.client.connectionStatus = 'disconnected'; connection({ current: 'disconnected' }); });
    await act(async () => resolve({ content: 'stale' }));
    expect(result.current.content).toBeUndefined();
    expect(result.current.connected).toBe(false);
  });
  it('cancels delayed reread on unmount', async () => {
    const { result, unmount } = renderHook(useServerErrorLog);
    await settle();
    await act(async () => result.current.clear());
    unmount();
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(state.client.server.fetchErrorLog).toHaveBeenCalledTimes(1);
  });
});

describe('server stats hook', () => {
  it('subscribes when connected and clears stats on disconnect', () => {
    const { result, unmount } = renderHook(() => useServerStats(5000));
    expect(state.client.server.subscribeStats).toHaveBeenCalledWith(expect.any(Function), 5000);
    act(() => {
      statsListener({ cpuAverage: [0.5, 0.4, 0.3], totalMemory: 1000, freeMemory: 400 });
    });
    expect(result.current.stats?.totalMemory).toBe(1000);

    act(() => {
      state.client.connectionStatus = 'disconnected';
      connection({ current: 'disconnected' });
    });
    expect(result.current.stats).toBeUndefined();

    unmount();
    expect(unsubscribeStats).toHaveBeenCalled();
  });
});

