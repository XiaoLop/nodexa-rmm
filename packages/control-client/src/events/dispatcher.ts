import type { MeshCentralClientEvents, MeshCentralEventChannel, MeshCentralListener } from '../types';

export class EventDispatcher {
  private readonly listeners = new Map<MeshCentralEventChannel, Set<MeshCentralListener<never>>>();
  private reportingListenerError = false;

  on<K extends MeshCentralEventChannel>(
    channel: K,
    listener: MeshCentralListener<MeshCentralClientEvents[K]>,
  ): () => void {
    const listeners = this.listeners.get(channel) ?? new Set<MeshCentralListener<never>>();
    listeners.add(listener as MeshCentralListener<never>);
    this.listeners.set(channel, listeners);
    return () => listeners.delete(listener as MeshCentralListener<never>);
  }

  emit<K extends MeshCentralEventChannel>(channel: K, value: MeshCentralClientEvents[K]): void {
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
