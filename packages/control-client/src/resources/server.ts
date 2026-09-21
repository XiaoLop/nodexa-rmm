import { GatewayValidationError } from '../errors';
import type {
  GatewayClientEvents,
  GatewayEventChannel,
  GatewayListener,
  ServerStats,
} from '../types';

interface ResourceClient {
  send(payload: unknown): void;
  on<K extends GatewayEventChannel>(
    channel: K,
    listener: GatewayListener<GatewayClientEvents[K]>,
  ): () => void;
}

export class ServerResource {
  constructor(private readonly client: ResourceClient) {}

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
