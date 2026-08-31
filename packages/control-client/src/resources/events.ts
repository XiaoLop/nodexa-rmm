import { GatewayValidationError } from '../errors';
import { isRecord, normalizeEvent } from '../protocol/normalizers';
import type { EventListOptions, GatewayEvent } from '../types';

interface ResourceClient {
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
}

export class EventsResource {
  constructor(private readonly client: ResourceClient) {}
  list(options: EventListOptions = {}): Promise<GatewayEvent[]> {
    return this.fetch({ limit: options.limit ?? 100 });
  }
  listByDevice(deviceId: string, options: EventListOptions = {}): Promise<GatewayEvent[]> {
    if (!deviceId.trim()) throw new GatewayValidationError('Device ID is required.');
    return this.fetch({ nodeid: deviceId, limit: options.limit ?? 100 });
  }
  listByUser(userId: string, options: EventListOptions = {}): Promise<GatewayEvent[]> {
    if (!userId.trim()) throw new GatewayValidationError('User ID is required.');
    return this.fetch({ user: userId, limit: options.limit ?? 100 });
  }
  private async fetch(filter: Record<string, unknown>): Promise<GatewayEvent[]> {
    const response = await this.client.request<unknown>({ action: 'events', ...filter });
    const events = isRecord(response) && Array.isArray(response.events) ? response.events : [];
    return events.map(normalizeEvent).filter((event): event is GatewayEvent => Boolean(event));
  }
}
