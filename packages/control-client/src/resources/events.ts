import { GatewayValidationError } from '../errors';
import { isRecord, normalizeEvent } from '../protocol/normalizers';
import type { EventListOptions, GatewayEvent } from '../types';

interface ResourceClient {
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
}

const HISTORY_REQUEST_TIMEOUT_MS = 30_000;

export class EventsResource {
  constructor(private readonly client: ResourceClient) {}
  list(options: EventListOptions = {}): Promise<GatewayEvent[]> {
    return this.fetch(this.createOptions(options));
  }
  listByDevice(deviceId: string, options: EventListOptions = {}): Promise<GatewayEvent[]> {
    if (!deviceId.trim()) throw new GatewayValidationError('Device ID is required.');
    return this.fetch({ nodeid: deviceId, ...this.createOptions(options) });
  }
  listByUser(userId: string, options: EventListOptions = {}): Promise<GatewayEvent[]> {
    if (!userId.trim()) throw new GatewayValidationError('User ID is required.');
    return this.fetch({ user: userId, ...this.createOptions(options) });
  }
  private createOptions(options: EventListOptions): Record<string, unknown> {
    const limit = options.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new GatewayValidationError('Event limit must be an integer between 1 and 200.');
    }
    return { limit, ...(options.filter ? { filter: options.filter } : {}) };
  }
  private async fetch(filter: Record<string, unknown>): Promise<GatewayEvent[]> {
    const response = await this.client.request<unknown>(
      { action: 'events', ...filter },
      HISTORY_REQUEST_TIMEOUT_MS,
    );
    const events = isRecord(response) && Array.isArray(response.events) ? response.events : [];
    return events.map(normalizeEvent).filter((event): event is GatewayEvent => Boolean(event));
  }
}
