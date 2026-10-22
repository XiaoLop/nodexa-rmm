import { describe, expect, it } from 'vitest';
import {
  boundedAppend,
  calcMemoryUsage,
  editLine,
  formatBytes,
  printable,
  safeTerminalText,
  KNOWN_TRACE_SOURCES,
  TRACE_SOURCE_CATALOG_VERSION,
  traceSourceOptions,
} from './model';

describe('server administration models', () => {
  it('offers all 21 versioned sources without waiting for traffic and preserves unknown categories', () => {
    expect(TRACE_SOURCE_CATALOG_VERSION).toBe('1.1.54');
    expect(KNOWN_TRACE_SOURCES).toHaveLength(21);
    expect(traceSourceOptions().map(option => option.value)).toEqual([...KNOWN_TRACE_SOURCES]);
    expect(traceSourceOptions(['custom', 'web'], ['plugin', 'custom']).map(option => option.value))
      .toEqual([...KNOWN_TRACE_SOURCES, 'custom', 'plugin']);
  });
  it('removes terminal controls, OSC links, C1, backspace and carriage return', () => {
    expect(safeTerminalText('\x1b[31mred\x1b[0m\r\b\x9b\n\x1b]8;;https://bad\x07link\x1b]8;;\x1b\\')).toBe('red\r\nlink');
    expect(safeTerminalText('safe\x1b]52;c;secret')).toBe('safe');
  });
  it('keeps only the latest 5000 packets and bounded history', () => {
    expect(boundedAppend(Array.from({ length: 5000 }, (_, i) => i), [5000, 5001])).toHaveLength(5000);
    expect(boundedAppend([1, 2, 3], [4, 5], 3)).toEqual([3, 4, 5]);
  });
  it('edits the full line at the cursor and completes only known command names', () => {
    let line = { text: 'hlo', cursor: 1 };
    line = editLine(line, 'el');
    expect(line).toEqual({ text: 'hello', cursor: 3 });
    line = editLine(line, '\x7f');
    expect(line.text).toBe('helo');
    line = editLine(line, '\x1b[3~');
    expect(line.text).toBe('heo');
    expect(editLine({ text: 'ver', cursor: 3 }, '\t').text).toBe('versions');
    expect(editLine({ text: 'unknown', cursor: 7 }, '\t').text).toBe('unknown');
    expect(editLine(line, '\x01').cursor).toBe(0);
    expect(editLine(line, '\x05').cursor).toBe(3);
  });
  it('treats multiline paste as local text and caps input', () => {
    expect(editLine({ text: '', cursor: 0 }, 'info\r\nmaintenance').text).toBe('infomaintenance');
    expect(editLine({ text: '', cursor: 0 }, 'a'.repeat(6000)).text).toHaveLength(4096);
  });
  it('handles unusual trace arguments without throwing', () => {
    const circular: unknown[] = [];
    circular.push(circular);
    expect(printable(circular)).toBe('[unserializable]');
    expect(printable({ html: '<script>' })).toBe('{"html":"<script>"}');
  });
  it('formats byte numbers into human readable units safely', () => {
    expect(formatBytes(undefined)).toBe('—');
    expect(formatBytes(-100)).toBe('—');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024 * 1536)).toBe('1.5 GB');
  });
  it('calculates memory usage and clamp percent', () => {
    expect(calcMemoryUsage(undefined)).toEqual({});
    expect(calcMemoryUsage(0)).toEqual({});
    expect(calcMemoryUsage(1000, 400)).toEqual({ used: 600, total: 1000, percent: 60 });
    // available takes precedence over free
    expect(calcMemoryUsage(1000, 600, 200)).toEqual({ used: 800, total: 1000, percent: 80 });
  });
});
