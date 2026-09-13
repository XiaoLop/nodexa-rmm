import type { DesktopProtocolCommand, DesktopScreenSize, DesktopTile, DesktopDisplayGeometry } from './types';

function view(command: DesktopProtocolCommand): DataView {
  return new DataView(command.bytes.buffer, command.bytes.byteOffset, command.bytes.byteLength);
}

export function parseScreenSize(command: DesktopProtocolCommand): DesktopScreenSize {
  if (command.command !== 7 || command.bytes.byteLength !== 8) throw new Error('Invalid desktop screen-size command.');
  const data = view(command);
  const width = data.getUint16(4);
  const height = data.getUint16(6);
  if (width === 0 || height === 0) throw new Error('Desktop screen size must be positive.');
  return { width, height };
}

export function detectImageFormat(bytes: Uint8Array): DesktopTile['imageFormat'] {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'png';
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP') return 'webp';
  return 'unknown';
}

export function parseTile(command: DesktopProtocolCommand): DesktopTile {
  if (command.command !== 3 || command.bytes.byteLength < 8) throw new Error('Invalid desktop tile command.');
  const data = view(command);
  const image = command.bytes.slice(8);
  return { x: data.getUint16(4), y: data.getUint16(6), image, imageFormat: detectImageFormat(image) };
}

export function parseDisplayGeometry(command: DesktopProtocolCommand): DesktopDisplayGeometry {
  if (command.command !== 82 || command.bytes.byteLength !== 14) throw new Error('Invalid desktop display geometry command.');
  const data = view(command);
  return { id: data.getUint16(4), x: data.getInt16(6), y: data.getInt16(8), width: data.getUint16(10), height: data.getUint16(12), bytes: command.bytes.slice() };
}