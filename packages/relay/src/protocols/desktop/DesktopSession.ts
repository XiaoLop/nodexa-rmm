import type { RelaySession } from '../../RelaySession';
import type { RelayInboundData } from '../../types';
import { RELAY_PROTOCOLS } from '../types';
import { DesktopProtocolParser } from './DesktopProtocolParser';
import { DesktopWebRtcSignaler } from './DesktopWebRtcSignaler';
import { createDesktopRttMessage, parseDesktopControlMessage } from './controlMessages';
import { createCadMessage, createCompressionMessage, createKeyMessage, createMouseButtonMessage, createMouseDoubleClickMessage, createMouseMoveMessage, createMouseWheelMessage, createUnicodeMessage, parseDisplayGeometry, parseScreenSize, parseTile } from './commands';
import { DesktopSessionError, type DesktopCompressionOptions, type DesktopControlMessage, type DesktopDisplayGeometry, type DesktopKeyPhase, type DesktopMouseButton, type DesktopPoint, type DesktopProtocolCommand, type DesktopScreenSize, type DesktopSessionOptions, type DesktopSessionStats, type DesktopSessionState, type DesktopTile, type DesktopTransportType, type DesktopWebRtcState } from './types';

function inboundSize(data: RelayInboundData): number {
  if (typeof data === 'string') return new TextEncoder().encode(data).byteLength;
  if (data instanceof ArrayBuffer) return data.byteLength;
  if (ArrayBuffer.isView(data)) return data.byteLength;
  return data.size;
}

async function toBytes(data: Exclude<RelayInboundData, string>): Promise<Uint8Array> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new Uint8Array(await data.arrayBuffer());
}

export class DesktopSession {
  private stateValue: DesktopSessionState = 'ready';
  private transportTypeValue: DesktopTransportType = 'websocket';
  private disposed = false;
  private pendingBytes = 0;
  private receivedBytes = 0;
  private receivedTiles = 0;
  private readonly statsListeners = new Set<(stats: DesktopSessionStats) => void>();
  get stats(): DesktopSessionStats {
    return Object.freeze({
      receivedBytes: this.receivedBytes,
      receivedTiles: this.receivedTiles,
      pendingProtocolBytes: this.pendingBytes,
    });
  }
  onStats(listener: (stats: DesktopSessionStats) => void): () => void {
    this.statsListeners.add(listener);
    return () => {
      this.statsListeners.delete(listener);
    };
  }
  private emitStats(): void {
    if (!this.disposed) for (const listener of this.statsListeners) listener(this.stats);
  }
  private inboundQueue = Promise.resolve();
  private rttTimer?: ReturnType<typeof setInterval>;
  private rttTimeout?: ReturnType<typeof setTimeout>;
  private pendingRtt?: number;
  private readonly parser: DesktopProtocolParser;
  private readonly signaler?: DesktopWebRtcSignaler;
  private readonly removeListeners: Array<() => void> = [];
  private readonly stateListeners = new Set<(state: DesktopSessionState) => void>();
  private readonly transportListeners = new Set<(transport: DesktopTransportType) => void>();
  private readonly webrtcStateListeners = new Set<(state: DesktopWebRtcState) => void>();
  private readonly screenListeners = new Set<(screen: DesktopScreenSize) => void>();
  private readonly geometryListeners = new Set<(geometry: DesktopDisplayGeometry) => void>();
  private readonly tileListeners = new Set<(tile: DesktopTile) => void>();
  private readonly controlListeners = new Set<(message: DesktopControlMessage) => void>();
  private readonly latencyListeners = new Set<(latencyMs: number | undefined) => void>();
  private readonly unknownListeners = new Set<(command: DesktopProtocolCommand) => void>();
  private readonly errorListeners = new Set<(error: DesktopSessionError) => void>();
  private readonly now: () => number;

  constructor(readonly relay: RelaySession, private readonly options: DesktopSessionOptions = {}) {
    if (relay.protocol !== RELAY_PROTOCOLS.desktop) throw new DesktopSessionError('DesktopSession requires a p=2 relay session.', 'protocol');
    if (relay.state !== 'ready') throw new DesktopSessionError('Desktop relay session is not ready.', 'connection-lost');
    this.parser = new DesktopProtocolParser(options);
    this.now = options.now ?? Date.now;

    if (options.webrtc?.enabled !== false) {
      this.signaler = new DesktopWebRtcSignaler(options.webrtc, {
        stateChange: (webrtcState) => {
          for (const listener of this.webrtcStateListeners) listener(webrtcState);
        },
        sendSignal: (signalText) => {
          if (!this.disposed && this.relay.state === 'ready') {
            this.relay.sendText(signalText);
          }
        },
        message: (data) => {
          this.enqueue(data);
        },
        switched: () => {
          this.setTransport('webrtc');
        },
        fallback: () => {
          this.setTransport('websocket');
        },
      });
    }

    this.removeListeners.push(
      relay.onMessage((data) => this.enqueue(data)),
      relay.onError((error) => this.fail(new DesktopSessionError(error.message, 'connection-lost', { cause: error }))),
      relay.onClose(() => this.finish(relay.state === 'error' ? 'error' : 'closed')),
    );
    this.startRtt();
    this.signaler?.start();
  }

  get state(): DesktopSessionState { return this.stateValue; }
  get transport(): DesktopTransportType { return this.transportTypeValue; }
  get webrtcState(): DesktopWebRtcState | undefined { return this.signaler?.state; }
  onStateChange(listener: (state: DesktopSessionState) => void): () => void { this.stateListeners.add(listener); return () => this.stateListeners.delete(listener); }
  onTransportChange(listener: (transport: DesktopTransportType) => void): () => void { this.transportListeners.add(listener); return () => this.transportListeners.delete(listener); }
  onWebRtcStateChange(listener: (state: DesktopWebRtcState) => void): () => void { this.webrtcStateListeners.add(listener); return () => this.webrtcStateListeners.delete(listener); }
  onScreenSize(listener: (screen: DesktopScreenSize) => void): () => void { this.screenListeners.add(listener); return () => this.screenListeners.delete(listener); }
  onDisplayGeometry(listener: (geometry: DesktopDisplayGeometry) => void): () => void { this.geometryListeners.add(listener); return () => this.geometryListeners.delete(listener); }
  onTile(listener: (tile: DesktopTile) => void): () => void { this.tileListeners.add(listener); return () => this.tileListeners.delete(listener); }
  onControlMessage(listener: (message: DesktopControlMessage) => void): () => void { this.controlListeners.add(listener); return () => this.controlListeners.delete(listener); }
  onLatencyChange(listener: (latencyMs: number | undefined) => void): () => void { this.latencyListeners.add(listener); return () => this.latencyListeners.delete(listener); }
  onUnknownCommand(listener: (command: DesktopProtocolCommand) => void): () => void { this.unknownListeners.add(listener); return () => this.unknownListeners.delete(listener); }
  onError(listener: (error: DesktopSessionError) => void): () => void { this.errorListeners.add(listener); return () => this.errorListeners.delete(listener); }

  close(code = 1000, reason = 'Desktop session closed.'): void {
    if (this.disposed) return;
    this.finish('closed');
    this.relay.close(code, reason);
  }

  sendMouseMove(point: DesktopPoint): void { this.sendInput(createMouseMoveMessage(point)); }
  sendMouseButton(button: DesktopMouseButton, phase: DesktopKeyPhase, point: DesktopPoint): void { this.sendInput(createMouseButtonMessage(button, phase, point)); }
  sendMouseDoubleClick(point: DesktopPoint): void { this.sendInput(createMouseDoubleClickMessage(point)); }
  sendMouseWheel(point: DesktopPoint, delta: number): void { this.sendInput(createMouseWheelMessage(point, delta)); }
  sendKey(keyCode: number, phase: DesktopKeyPhase, extended = false): void { this.sendInput(createKeyMessage(keyCode, phase, extended)); }
  sendUnicode(codeUnit: number, phase: DesktopKeyPhase): void { this.sendInput(createUnicodeMessage(codeUnit, phase)); }
  sendCad(): void { this.sendInput(createCadMessage()); }
  setCompression(options: DesktopCompressionOptions): void { this.sendCommand(createCompressionMessage(options)); }

  dispose(): void {
    if (!this.disposed) this.finish(this.relay.state === 'error' ? 'error' : 'closed');
  }

  private setTransport(transport: DesktopTransportType): void {
    if (this.disposed || this.transportTypeValue === transport) return;
    this.transportTypeValue = transport;
    for (const listener of this.transportListeners) listener(transport);
  }

  private sendInput(message: Uint8Array): void {
    if (!this.options.inputAllowed) throw new DesktopSessionError('Desktop input is not allowed.', 'input-not-allowed');
    this.sendCommand(message);
  }

  private sendCommand(message: Uint8Array): void {
    if (this.disposed || this.relay.state !== 'ready') throw new DesktopSessionError('Desktop relay session is not ready.', 'connection-lost');
    if (this.signaler?.isSwitched) {
      if (this.signaler.send(message)) return;
    }
    this.relay.sendBinary(message);
  }

  private enqueue(data: RelayInboundData): void {
    if (this.disposed) return;
    const size = inboundSize(data);
    this.pendingBytes += size;
    this.receivedBytes += size;
    this.emitStats();
    const limit = this.options.maxPendingProtocolBytes ?? 8 * 1024 * 1024;
    if (this.pendingBytes > limit) {
      this.fail(new DesktopSessionError('Desktop inbound data exceeded its pending limit.', 'output-overflow'));
      this.relay.close(4009, 'Desktop output exceeded the pending output limit.');
      return;
    }
    this.inboundQueue = this.inboundQueue.then(() => this.handle(data)).catch((error) => {
      this.options.onUnhandledMessage?.(data);
      this.fail(error instanceof DesktopSessionError ? error : new DesktopSessionError('Desktop protocol processing failed.', 'protocol', { cause: error }));
      this.relay.close(4002, 'Desktop protocol processing failed.');
    }).finally(() => { this.pendingBytes = Math.max(0, this.pendingBytes - size); this.emitStats(); });
  }

  private async handle(data: RelayInboundData): Promise<void> {
    if (this.disposed) return;
    if (typeof data === 'string') {
      const control = parseDesktopControlMessage(data);
      if (control) {
        // 如果是 WebRTC 相关的控制信号（answer, webrtc0, webrtc1 等），让 signaler 处理
        this.signaler?.handleControlMessage(control as Record<string, unknown>);
        this.options.onControlMessage?.(control);
        for (const listener of this.controlListeners) listener(control);
        if (control.type === 'rtt' && control.time === this.pendingRtt) {
          const latency = Math.max(0, this.now() - control.time);
          this.pendingRtt = undefined;
          if (this.rttTimeout) clearTimeout(this.rttTimeout);
          this.rttTimeout = undefined;
          for (const listener of this.latencyListeners) listener(latency);
        }
      } else this.options.onUnhandledMessage?.(data);
      return;
    }
    for (const command of this.parser.push(await toBytes(data))) this.dispatch(command);
  }

  private dispatch(command: DesktopProtocolCommand): void {
    try {
      if (command.command === 7) {
        const screen = parseScreenSize(command);
        this.transition('screen-known');
        for (const listener of this.screenListeners) listener(screen);
      } else if (command.command === 3) {
        const tile = parseTile(command);
        if (tile.imageFormat === 'unknown') throw new DesktopSessionError('Unsupported desktop image format.', 'unsupported-image');
        this.receivedTiles += 1;
        for (const listener of this.tileListeners) listener(tile);
      } else if (command.command === 82) {
        const geometry = parseDisplayGeometry(command);
        for (const listener of this.geometryListeners) listener(geometry);
      } else {
        this.options.onUnknownCommand?.(command);
        for (const listener of this.unknownListeners) listener(command);
      }
    } catch (error) {
      this.fail(error instanceof DesktopSessionError ? error : new DesktopSessionError('Invalid desktop command.', command.command === 7 ? 'invalid-screen-size' : 'protocol', { cause: error }));
    }
  }

  private transition(state: DesktopSessionState): void {
    if (this.disposed || this.stateValue === state) return;
    this.stateValue = state;
    for (const listener of this.stateListeners) listener(state);
  }

  private startRtt(): void {
    const interval = this.options.rttIntervalMs ?? 5_000;
    if (interval <= 0) return;
    this.sendRtt();
    this.rttTimer = setInterval(() => this.sendRtt(), interval);
  }

  private sendRtt(): void {
    if (this.disposed || this.pendingRtt !== undefined) return;
    const time = this.now();
    this.pendingRtt = time;
    this.relay.sendJson(createDesktopRttMessage(time));
    const timeout = this.options.rttTimeoutMs ?? 15_000;
    this.rttTimeout = setTimeout(() => {
      this.pendingRtt = undefined;
      this.rttTimeout = undefined;
      for (const listener of this.latencyListeners) listener(undefined);
    }, timeout);
  }

  private fail(error: DesktopSessionError): void {
    if (this.disposed) return;
    for (const listener of this.errorListeners) listener(error);
    this.transition('error');
  }

  private finish(state: DesktopSessionState): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stateValue = state;
    if (this.rttTimer) clearInterval(this.rttTimer);
    if (this.rttTimeout) clearTimeout(this.rttTimeout);
    this.signaler?.dispose();
    this.pendingBytes = 0;
    this.statsListeners.clear();
    for (const remove of this.removeListeners.splice(0)) remove();
    for (const listener of this.stateListeners) listener(state);
  }
}
