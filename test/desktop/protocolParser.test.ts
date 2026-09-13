import { describe, expect, it } from 'vitest';
import {
  DesktopProtocolParser,
  detectImageFormat,
  parseScreenSize,
  parseTile,
} from './protocolParser';

function command(commandId: number, body: number[]): Uint8Array {
  const bytes = new Uint8Array(4 + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, commandId);
  view.setUint16(2, bytes.byteLength);
  bytes.set(body, 4);
  return bytes;
}

describe('DesktopProtocolParser', () => {
  it('parses multiple commands and retains an incomplete command across messages', () => {
    const parser = new DesktopProtocolParser();
    const screen = command(7, [0x07, 0x80, 0x04, 0x38]);
    const refresh = command(6, []);
    const combined = new Uint8Array(screen.byteLength + refresh.byteLength);
    combined.set(screen);
    combined.set(refresh, screen.byteLength);

    expect(parser.push(combined.slice(0, 10)).map((item) => item.command)).toEqual([7]);
    expect(parser.pendingByteLength).toBe(2);
    expect(parser.push(combined.slice(10)).map((item) => item.command)).toEqual([6]);
    const parsedScreen = new DesktopProtocolParser().push(screen)[0];
    expect(parsedScreen).toBeDefined();
    expect(parseScreenSize(parsedScreen!)).toEqual({ width: 1920, height: 1080 });
  });

  it('unwraps a jumbo envelope while retaining the complete outer message', () => {
    const parser = new DesktopProtocolParser();
    const tile = command(3, [0, 10, 0, 20, 0xff, 0xd8, 0xff, 0xd9]);
    const jumbo = new Uint8Array(tile.byteLength + 8);
    const view = new DataView(jumbo.buffer);
    view.setUint16(0, 27);
    view.setUint16(2, 8);
    jumbo[5] = (tile.byteLength >> 16) & 0xff;
    jumbo[6] = (tile.byteLength >> 8) & 0xff;
    jumbo[7] = tile.byteLength & 0xff;
    jumbo.set(tile, 8);

    const [parsed] = parser.push(jumbo);
    expect(parsed).toBeDefined();
    expect(parsed).toMatchObject({ command: 3, size: tile.byteLength, jumbo: true });
    expect(parsed!.outerBytes).toEqual(jumbo);
    expect(parseTile(parsed!)).toMatchObject({ x: 10, y: 20, imageFormat: 'jpeg' });
  });

  it('detects image formats from payload magic instead of requested encoding', () => {
    expect(detectImageFormat(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(detectImageFormat(new TextEncoder().encode('RIFF1234WEBP'))).toBe('webp');
    expect(detectImageFormat(Uint8Array.from([1, 2, 3]))).toBe('unknown');
  });

  it('discards zero alignment padding at the end of an application message', () => {
    const parser = new DesktopProtocolParser();
    const refreshWithPadding = Uint8Array.from([0, 6, 0, 4, 0, 0, 0, 0]);

    expect(parser.push(refreshWithPadding).map((item) => item.command)).toEqual([6]);
    expect(parser.pendingByteLength).toBe(0);
  });
});