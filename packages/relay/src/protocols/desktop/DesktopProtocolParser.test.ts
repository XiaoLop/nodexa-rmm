import { describe, expect, it } from 'vitest';
import { DesktopProtocolParser } from './DesktopProtocolParser';
import { DesktopSessionError } from './types';

function command(id: number, body: number[]): Uint8Array {
  const bytes = new Uint8Array(4 + body.length);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, id);
  view.setUint16(2, bytes.length);
  bytes.set(body, 4);
  return bytes;
}

describe('DesktopProtocolParser', () => {
  it('parses split commands and preserves typed-array offsets', () => {
    const source = command(7, [7, 128, 4, 56]);
    const parser = new DesktopProtocolParser();
    const padded = Uint8Array.from([9, ...source, 9]);
    expect(parser.push(padded.subarray(1, source.length - 1))).toEqual([]);
    expect(parser.push(source.subarray(source.length - 2))).toHaveLength(1);
  });

  it('unwraps jumbo commands and rejects recursive jumbo envelopes', () => {
    const inner = command(3, [0, 0, 0, 0, 0xff, 0xd8, 0xff]);
    const jumbo = new Uint8Array(inner.length + 8);
    const view = new DataView(jumbo.buffer);
    view.setUint16(0, 27);
    view.setUint16(2, 8);
    jumbo[5] = (inner.length >> 16) & 0xff;
    jumbo[6] = (inner.length >> 8) & 0xff;
    jumbo[7] = inner.length & 0xff;
    jumbo.set(inner, 8);
    expect(new DesktopProtocolParser().push(jumbo)[0]).toMatchObject({ command: 3, jumbo: true });

    const recursive = jumbo.slice();
    recursive.set([0, 27], 8);
    expect(() => new DesktopProtocolParser().push(recursive)).toThrow(DesktopSessionError);
  });

  it('enforces pending and command size limits', () => {
    expect(() => new DesktopProtocolParser({ maxPendingBytes: 4 }).push(new Uint8Array(5))).toThrow('buffer exceeded');
    expect(() => new DesktopProtocolParser({ maxCommandBytes: 8 }).push(new Uint8Array([0, 6, 0, 10]))).toThrow('exceeded its limit');
  });
});