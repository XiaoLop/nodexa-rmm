import type { GatewayClientEvents, GatewayEventChannel, GatewayListener } from '../types';

export class EventDispatcher {
  private readonly listeners = new Map<GatewayEventChannel, Set<GatewayListener<never>>>();
  private reportingListenerError = false;

  on<K extends GatewayEventChannel>(
    channel: K,
    listener: GatewayListener<GatewayClientEvents[K]>,
  ): () => void {
    const listeners = this.listeners.get(channel) ?? new Set<GatewayListener<never>>();
    listeners.add(listener as GatewayListener<never>);
    this.listeners.set(channel, listeners);
    return () => listeners.delete(listener as GatewayListener<never>);
  }

  emit<K extends GatewayEventChannel>(channel: K, value: GatewayClientEvents[K]): void {
    for (const listener of [...(this.listeners.get(channel) ?? [])]) {
      try {
        listener(value as never);
      } catch (error) {
        if (channel === 'diagnostic' || this.reportingListenerError) continue;
        this.reportingListenerError = true;
        this.emit('diagnostic', {
          type: 'listener-error',
          message: `A ${channel} listener failed.`,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        this.reportingListenerError = false;
      }
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
