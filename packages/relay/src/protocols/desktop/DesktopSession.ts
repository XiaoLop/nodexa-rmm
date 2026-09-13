import type { RelaySession } from '../../RelaySession';
import type { RelayInboundData } from '../../types';
import { RELAY_PROTOCOLS } from '../types';
import { DesktopProtocolParser } from './DesktopProtocolParser';
import { parseDesktopControlMessage } from './controlMessages';
import { createCadMessage, createKeyMessage, createMouseButtonMessage, createMouseDoubleClickMessage, createMouseMoveMessage, createMouseWheelMessage, createUnicodeMessage, parseDisplayGeometry, parseScreenSize, parseTile } from './commands';
import { DesktopSessionError, type DesktopControlMessage, type DesktopDisplayGeometry, type DesktopKeyPhase, type DesktopMouseButton, type DesktopPoint, type DesktopProtocolCommand, type DesktopScreenSize, type DesktopSessionOptions, type DesktopSessionState, type DesktopTile } from './types';

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
  private disposed = false;
  private pendingBytes = 0;
  private inboundQueue = Promise.resolve();
  private readonly parser: DesktopProtocolParser;
  private readonly removeListeners: Array<() => void> = [];
  private readonly stateListeners = new Set<(state: DesktopSessionState) => void>();
  private readonly screenListeners = new Set<(screen: DesktopScreenSize) => void>();
  private readonly geometryListeners = new Set<(geometry: DesktopDisplayGeometry) => void>();
  private readonly tileListeners = new Set<(tile: DesktopTile) => void>();
  private readonly controlListeners = new Set<(message: DesktopControlMessage) => void>();
  private readonly unknownListeners = new Set<(command: DesktopProtocolCommand) => void>();
  private readonly errorListeners = new Set<(error: DesktopSessionError) => void>();

  constructor(readonly relay: RelaySession, private readonly options: DesktopSessionOptions = {}) {
    if (relay.protocol !== RELAY_PROTOCOLS.desktop) throw new DesktopSessionError('DesktopSession requires a p=2 relay session.', 'protocol');
    if (relay.state !== 'ready') throw new DesktopSessionError('Desktop relay session is not ready.', 'connection-lost');
    this.parser = new DesktopProtocolParser(options);
    this.removeListeners.push(
      relay.onMessage((data) => this.enqueue(data)),
      relay.onError((error) => this.fail(new DesktopSessionError(error.message, 'connection-lost', { cause: error }))),
      relay.onClose(() => this.finish(relay.state === 'error' ? 'error' : 'closed')),
    );
  }

  get state(): DesktopSessionState { return this.stateValue; }
  onStateChange(listener: (state: DesktopSessionState) => void): () => void { this.stateListeners.add(listener); return () => this.stateListeners.delete(listener); }
  onScreenSize(listener: (screen: DesktopScreenSize) => void): () => void { this.screenListeners.add(listener); return () => this.screenListeners.delete(listener); }
  onDisplayGeometry(listener: (geometry: DesktopDisplayGeometry) => void): () => void { this.geometryListeners.add(listener); return () => this.geometryListeners.delete(listener); }
  onTile(listener: (tile: DesktopTile) => void): () => void { this.tileListeners.add(listener); return () => this.tileListeners.delete(listener); }
  onControlMessage(listener: (message: DesktopControlMessage) => void): () => void { this.controlListeners.add(listener); return () => this.controlListeners.delete(listener); }
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

  dispose(): void { if (!this.disposed) this.finish(this.relay.state === 'error' ? 'error' : 'closed'); }

  private sendInput(message: Uint8Array): void {
    if (!this.options.inputAllowed) throw new DesktopSessionError('Desktop input is not allowed.', 'input-not-allowed');
    if (this.disposed || this.relay.state !== 'ready') throw new DesktopSessionError('Desktop relay session is not ready.', 'connection-lost');
    this.relay.sendBinary(message);
  }

  private enqueue(data: RelayInboundData): void {
    if (this.disposed) return;
    const size = inboundSize(data);
    this.pendingBytes += size;
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
    }).finally(() => { this.pendingBytes -= size; });
  }

  private async handle(data: RelayInboundData): Promise<void> {
    if (this.disposed) return;
    if (typeof data === 'string') {
      const control = parseDesktopControlMessage(data);
      if (control) {
        this.options.onControlMessage?.(control);
        for (const listener of this.controlListeners) listener(control);
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

  private fail(error: DesktopSessionError): void {
    if (this.disposed) return;
    for (const listener of this.errorListeners) listener(error);
    this.transition('error');
  }

  private finish(state: DesktopSessionState): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stateValue = state;
    for (const remove of this.removeListeners.splice(0)) remove();
    for (const listener of this.stateListeners) listener(state);
  }
}