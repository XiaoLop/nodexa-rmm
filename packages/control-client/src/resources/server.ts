import { GatewayValidationError } from '../errors';
import { isRecord, normalizeServerTimelineStats } from '../protocol/normalizers';
import type {
  GatewayClientEvents,
  GatewayEventChannel,
  GatewayListener,
  ServerStats,
  ServerTimelineStats,
} from '../types';

interface ResourceClient {
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
  send(payload: unknown): void;
  on<K extends GatewayEventChannel>(
    channel: K,
    listener: GatewayListener<GatewayClientEvents[K]>,
  ): () => void;
}

export class ServerResource {
  constructor(private readonly client: ResourceClient) {}

  async getTimelineStats(hours: number): Promise<ServerTimelineStats[]> {
    if (!Number.isInteger(hours) || hours < 0 || hours > 720) {
      throw new GatewayValidationError('Server timeline stats hours must be an integer from 0 to 720.');
    }
    const response = await this.client.request<unknown>({
      action: 'servertimelinestats',
      hours,
    });
    const events = isRecord(response) && Array.isArray(response.events) ? response.events : response;
    return (Array.isArray(events) ? events : [])
      .map(normalizeServerTimelineStats)
      .filter((event): event is ServerTimelineStats => Boolean(event));
  }

  subscribeStats(listener: GatewayListener<ServerStats>, intervalMs = 10_000): () => void {
    if (!Number.isInteger(intervalMs) || intervalMs < 1) {
      throw new GatewayValidationError('Server stats interval must be a positive integer.');
    }
    const unsubscribe = this.client.on('serverStats', listener);
    try {
      this.client.send({ action: 'serverstats', interval: intervalMs });
    } catch (error) {
      unsubscribe();
      throw error;
    }
    return unsubscribe;
  }
}
