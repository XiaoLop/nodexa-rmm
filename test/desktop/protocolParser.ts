export interface DesktopProtocolCommand {
  command: number;
  size: number;
  bytes: Uint8Array;
  jumbo: boolean;
  outerBytes?: Uint8Array;
}

export interface DesktopScreenSize {
  width: number;
  height: number;
}

export interface DesktopTile {
  x: number;
  y: number;
  image: Uint8Array;
  imageFormat: 'jpeg' | 'png' | 'webp' | 'unknown';
}

function concat(first: Uint8Array, second: Uint8Array): Uint8Array<ArrayBufferLike> {
  const result = new Uint8Array(first.byteLength + second.byteLength);
  result.set(first);
  result.set(second, first.byteLength);
  return result;
}

function readUint24(bytes: Uint8Array, offset: number): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, 3);
  return (view.getUint16(0) << 8) | view.getUint8(2);
}

export class DesktopProtocolParser {
  private buffered: Uint8Array<ArrayBufferLike> = new Uint8Array();

  push(chunk: Uint8Array): DesktopProtocolCommand[] {
    this.buffered = concat(this.buffered, chunk);
    const commands: DesktopProtocolCommand[] = [];
    let offset = 0;

    while (this.buffered.byteLength - offset >= 4) {
      const remaining = this.buffered.subarray(offset);
      if (remaining.byteLength <= 7 && remaining.every((value) => value === 0)) {
        offset = this.buffered.byteLength;
        break;
      }
      const view = new DataView(
        this.buffered.buffer,
        this.buffered.byteOffset + offset,
        this.buffered.byteLength - offset,
      );
      const command = view.getUint16(0);
      const headerSize = view.getUint16(2);
      if (headerSize < 4) throw new Error(`Invalid desktop command size ${headerSize}.`);

      if (command === 27 && headerSize === 8) {
        if (this.buffered.byteLength - offset < 8) break;
        const innerSize = readUint24(this.buffered, offset + 5);
        if (innerSize < 4) throw new Error(`Invalid jumbo desktop command size ${innerSize}.`);
        const outerSize = innerSize + 8;
        if (this.buffered.byteLength - offset < outerSize) break;
        const outerBytes = this.buffered.slice(offset, offset + outerSize);
        const bytes = outerBytes.slice(8);
        commands.push({
          command: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(0),
          size: innerSize,
          bytes,
          jumbo: true,
          outerBytes,
        });
        offset += outerSize;
        continue;
      }

      if (this.buffered.byteLength - offset < headerSize) break;
      commands.push({
        command,
        size: headerSize,
        bytes: this.buffered.slice(offset, offset + headerSize),
        jumbo: false,
      });
      offset += headerSize;
    }

    this.buffered = this.buffered.slice(offset);
    return commands;
  }

  get pendingByteLength(): number {
    return this.buffered.byteLength;
  }
}

export function parseScreenSize(command: DesktopProtocolCommand): DesktopScreenSize {
  if (command.command !== 7 || command.bytes.byteLength < 8) {
    throw new Error('Desktop screen-size command must be command 7 with at least 8 bytes.');
  }
  const view = new DataView(command.bytes.buffer, command.bytes.byteOffset, command.bytes.byteLength);
  return { width: view.getUint16(4), height: view.getUint16(6) };
}

export function detectImageFormat(bytes: Uint8Array): DesktopTile['imageFormat'] {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])) return 'png';
  if (
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
    && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  ) return 'webp';
  return 'unknown';
}

export function parseTile(command: DesktopProtocolCommand): DesktopTile {
  if (command.command !== 3 || command.bytes.byteLength < 8) {
    throw new Error('Desktop tile command must be command 3 with at least 8 bytes.');
  }
  const view = new DataView(command.bytes.buffer, command.bytes.byteOffset, command.bytes.byteLength);
  const image = command.bytes.slice(8);
  return {
    x: view.getUint16(4),
    y: view.getUint16(6),
    image,
    imageFormat: detectImageFormat(image),
  };
}