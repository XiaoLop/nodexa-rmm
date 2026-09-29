import { MeshCentralRequestTimeoutError, MeshCentralValidationError } from '../errors';
import { isRecord, normalizeEvent } from '../protocol/normalizers';
import type { EventListOptions, MeshCentralEvent } from '../types';

interface ResourceClient {
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
}

export class EventsResource {
  constructor(private readonly client: ResourceClient) {}
  list(options: EventListOptions = {}): Promise<MeshCentralEvent[]> {
    return this.fetch(this.createOptions(options));
  }
  listByDevice(deviceId: string, options: EventListOptions = {}): Promise<MeshCentralEvent[]> {
    if (!deviceId.trim()) throw new MeshCentralValidationError('Device ID is required.');
    return this.fetch({ nodeid: deviceId, ...this.createOptions(options) });
  }
  listByUser(userId: string, options: EventListOptions = {}): Promise<MeshCentralEvent[]> {
    if (!userId.trim()) throw new MeshCentralValidationError('User ID is required.');
    return this.fetch({ userid: userId, ...this.createOptions(options) });
  }
  private createOptions(options: EventListOptions): Record<string, unknown> {
    const limit = options.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new MeshCentralValidationError('Event limit must be an integer between 1 and 200.');
    }
    return { limit, ...(options.filter ? { filter: options.filter } : {}) };
  }
  private async fetch(filter: Record<string, unknown>): Promise<MeshCentralEvent[]> {
    let response: unknown;
    try {
      response = await this.client.request<unknown>({ action: 'events', ...filter });
    } catch (error) {
      if (error instanceof MeshCentralRequestTimeoutError) return [];
      throw error;
    }
    const events = isRecord(response) && Array.isArray(response.events) ? response.events : [];
    return events.map(normalizeEvent).filter((event): event is MeshCentralEvent => Boolean(event));
  }
}
