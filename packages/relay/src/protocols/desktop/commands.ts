import type {
  DesktopDisplayGeometry,
  DesktopCompressionOptions,
  DesktopKeyPhase,
  DesktopMouseButton,
  DesktopPoint,
  DesktopProtocolCommand,
  DesktopScreenSize,
  DesktopTile,
} from './types';

const MOUSE_FLAGS: Record<DesktopMouseButton, { down: number; up: number }> = {
  left: { down: 2, up: 4 },
  right: { down: 8, up: 16 },
  middle: { down: 32, up: 64 },
};

const IMAGE_FORMAT_CODES: Record<NonNullable<DesktopCompressionOptions['imageFormat']>, number> = {
  jpeg: 1,
  png: 2,
  webp: 4,
};

function outboundCommand(command: number, body: number[] = []): Uint8Array {
  const bytes = new Uint8Array(4 + body.length);
  const data = new DataView(bytes.buffer);
  data.setUint16(0, command);
  data.setUint16(2, bytes.byteLength);
  bytes.set(body, 4);
  return bytes;
}

function assertUint16(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff)
    throw new RangeError(`${name} must be an unsigned 16-bit integer.`);
}

function uint16(value: number): [number, number] {
  return [(value >> 8) & 0xff, value & 0xff];
}

export function createMouseMoveMessage(point: DesktopPoint): Uint8Array {
  return createMouseMessage(0, point);
}

export function createMouseButtonMessage(
  button: DesktopMouseButton,
  phase: DesktopKeyPhase,
  point: DesktopPoint,
): Uint8Array {
  return createMouseMessage(MOUSE_FLAGS[button][phase], point);
}

export function createMouseDoubleClickMessage(point: DesktopPoint): Uint8Array {
  return createMouseMessage(0x88, point);
}

export function createMouseWheelMessage(point: DesktopPoint, delta: number): Uint8Array {
  assertUint16(point.x, 'Mouse x');
  assertUint16(point.y, 'Mouse y');
  if (!Number.isInteger(delta) || delta < -0x7fff || delta > 0x7fff)
    throw new RangeError('Mouse wheel delta is outside the supported range.');
  const encoded = delta < 0 ? ~Math.abs(delta) & 0xffff : delta;
  return outboundCommand(2, [0, 0, ...uint16(point.x), ...uint16(point.y), ...uint16(encoded)]);
}

export function createKeyMessage(
  keyCode: number,
  phase: DesktopKeyPhase,
  extended = false,
): Uint8Array {
  if (!Number.isInteger(keyCode) || keyCode < 0 || keyCode > 0xff)
    throw new RangeError('Desktop key code must be an unsigned byte.');
  const flag = extended ? (phase === 'down' ? 4 : 3) : phase === 'down' ? 0 : 1;
  return outboundCommand(1, [flag, keyCode]);
}

export function createUnicodeMessage(codeUnit: number, phase: DesktopKeyPhase): Uint8Array {
  assertUint16(codeUnit, 'Unicode code unit');
  return outboundCommand(85, [phase === 'down' ? 0 : 1, ...uint16(codeUnit)]);
}

export function createCadMessage(): Uint8Array {
  return outboundCommand(10);
}

export function createCompressionMessage({
  imageFormat = 'jpeg',
  quality,
  scaling = 1024,
  frameTimer = 100,
}: DesktopCompressionOptions): Uint8Array {
  if (!Number.isInteger(quality) || quality < 1 || quality > 100)
    throw new RangeError('Desktop image quality must be an integer from 1 to 100.');
  assertUint16(scaling, 'Desktop scaling');
  assertUint16(frameTimer, 'Desktop frame timer');
  return outboundCommand(5, [
    IMAGE_FORMAT_CODES[imageFormat],
    quality,
    ...uint16(scaling),
    ...uint16(frameTimer),
  ]);
}

function createMouseMessage(flags: number, point: DesktopPoint): Uint8Array {
  assertUint16(point.x, 'Mouse x');
  assertUint16(point.y, 'Mouse y');
  return outboundCommand(2, [0, flags, ...uint16(point.x), ...uint16(point.y)]);
}

function view(command: DesktopProtocolCommand): DataView {
  return new DataView(command.bytes.buffer, command.bytes.byteOffset, command.bytes.byteLength);
}

export function parseScreenSize(command: DesktopProtocolCommand): DesktopScreenSize {
  if (command.command !== 7 || command.bytes.byteLength !== 8)
    throw new Error('Invalid desktop screen-size command.');
  const data = view(command);
  const width = data.getUint16(4);
  const height = data.getUint16(6);
  if (width === 0 || height === 0) throw new Error('Desktop screen size must be positive.');
  return { width, height };
}

export function detectImageFormat(bytes: Uint8Array): DesktopTile['imageFormat'] {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'jpeg';
  if (
    bytes.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)
  )
    return 'png';
  if (
    bytes.length >= 12 &&
    new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
    new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  )
    return 'webp';
  return 'unknown';
}

export function parseTile(command: DesktopProtocolCommand): DesktopTile {
  if (command.command !== 3 || command.bytes.byteLength < 8)
    throw new Error('Invalid desktop tile command.');
  const data = view(command);
  const image = command.bytes.subarray(8);
  return {
    x: data.getUint16(4),
    y: data.getUint16(6),
    image,
    imageFormat: detectImageFormat(image),
  };
}

export function parseDisplayGeometry(command: DesktopProtocolCommand): DesktopDisplayGeometry {
  if (command.command !== 82 || command.bytes.byteLength !== 14)
    throw new Error('Invalid desktop display geometry command.');
  const data = view(command);
  return {
    id: data.getUint16(4),
    x: data.getInt16(6),
    y: data.getInt16(8),
    width: data.getUint16(10),
    height: data.getUint16(12),
    bytes: command.bytes.slice(),
  };
}
