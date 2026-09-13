import { DesktopSessionError, type DesktopProtocolCommand } from './types';

const HEADER_BYTES = 4;
const JUMBO_HEADER_BYTES = 8;
const DEFAULT_MAX_PENDING_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_COMMAND_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_JUMBO_BYTES = 32 * 1024 * 1024;

function concat(first: Uint8Array, second: Uint8Array): Uint8Array {
  const result = new Uint8Array(first.byteLength + second.byteLength);
  result.set(first);
  result.set(second, first.byteLength);
  return result;
}

function readUint24(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! << 16) | (bytes[offset + 1]! << 8) | bytes[offset + 2]!;
}

export interface DesktopProtocolParserOptions {
  maxPendingBytes?: number;
  maxCommandBytes?: number;
  maxJumboBytes?: number;
}

export class DesktopProtocolParser {
  private buffered: Uint8Array<ArrayBufferLike> = new Uint8Array();
  private readonly maxPendingBytes: number;
  private readonly maxCommandBytes: number;
  private readonly maxJumboBytes: number;

  constructor(options: DesktopProtocolParserOptions = {}) {
    this.maxPendingBytes = options.maxPendingBytes ?? DEFAULT_MAX_PENDING_BYTES;
    this.maxCommandBytes = options.maxCommandBytes ?? DEFAULT_MAX_COMMAND_BYTES;
    this.maxJumboBytes = options.maxJumboBytes ?? DEFAULT_MAX_JUMBO_BYTES;
  }

  push(chunk: Uint8Array): DesktopProtocolCommand[] {
    if (chunk.byteLength > this.maxPendingBytes || this.buffered.byteLength + chunk.byteLength > this.maxPendingBytes) {
      throw new DesktopSessionError('Desktop protocol buffer exceeded its limit.', 'output-overflow');
    }
    this.buffered = concat(this.buffered, chunk);
    const commands: DesktopProtocolCommand[] = [];
    let offset = 0;

    while (this.buffered.byteLength - offset >= HEADER_BYTES) {
      const remaining = this.buffered.subarray(offset);
      if (remaining.byteLength <= 7 && remaining.every((value) => value === 0)) {
        offset = this.buffered.byteLength;
        break;
      }
      const command = (remaining[0]! << 8) | remaining[1]!;
      const declaredSize = (remaining[2]! << 8) | remaining[3]!;
      if (declaredSize < HEADER_BYTES) {
        throw new DesktopSessionError(`Invalid desktop command size ${declaredSize}.`, 'invalid-command-size');
      }

      if (command === 27 && declaredSize === JUMBO_HEADER_BYTES) {
        if (this.buffered.byteLength - offset < JUMBO_HEADER_BYTES) break;
        const innerSize = readUint24(this.buffered, offset + 5);
        if (innerSize < HEADER_BYTES) {
          throw new DesktopSessionError(`Invalid jumbo desktop command size ${innerSize}.`, 'invalid-command-size');
        }
        if (innerSize > this.maxCommandBytes || innerSize + JUMBO_HEADER_BYTES > this.maxJumboBytes) {
          throw new DesktopSessionError('Jumbo desktop command exceeded its limit.', 'command-too-large');
        }
        const outerSize = innerSize + JUMBO_HEADER_BYTES;
        if (this.buffered.byteLength - offset < outerSize) break;
        const outerBytes = this.buffered.slice(offset, offset + outerSize);
        const bytes = outerBytes.slice(JUMBO_HEADER_BYTES);
        const innerCommand = (bytes[0]! << 8) | bytes[1]!;
        if (innerCommand === 27) {
          throw new DesktopSessionError('Nested jumbo desktop commands are not supported.', 'protocol');
        }
        commands.push({ command: innerCommand, size: innerSize, bytes, jumbo: true, outerBytes });
        offset += outerSize;
        continue;
      }

      if (declaredSize > this.maxCommandBytes) {
        throw new DesktopSessionError('Desktop command exceeded its limit.', 'command-too-large');
      }
      if (this.buffered.byteLength - offset < declaredSize) break;
      commands.push({ command, size: declaredSize, bytes: this.buffered.slice(offset, offset + declaredSize), jumbo: false });
      offset += declaredSize;
    }

    this.buffered = this.buffered.slice(offset);
    return commands;
  }

  get pendingByteLength(): number {
    return this.buffered.byteLength;
  }
}