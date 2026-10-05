const windowsBanner =
  /^Microsoft Windows \[[^\r\n]*\]\r?\n(?:\(c\) Microsoft Corporation[^\r\n]*\r?\n)?(?:\r?\n)*/i;
const encodingSetup = /^.*>chcp 65001 >nul\r?\n(?:\r?\n)*/im;
const exitEcho = /(?:\r?\n)*.*>exit\r?\n?$/i;

const windows1252Bytes = new Map<number, number>([
  [0x20ac, 0x80],
  [0x201a, 0x82],
  [0x0192, 0x83],
  [0x201e, 0x84],
  [0x2026, 0x85],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x02c6, 0x88],
  [0x2030, 0x89],
  [0x0160, 0x8a],
  [0x2039, 0x8b],
  [0x0152, 0x8c],
  [0x017d, 0x8e],
  [0x2018, 0x91],
  [0x2019, 0x92],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2022, 0x95],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x02dc, 0x98],
  [0x2122, 0x99],
  [0x0161, 0x9a],
  [0x203a, 0x9b],
  [0x0153, 0x9c],
  [0x017e, 0x9e],
  [0x0178, 0x9f],
]);

function legacyBytes(value: string): Uint8Array | undefined {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    const byte = codePoint <= 0xff ? codePoint : windows1252Bytes.get(codePoint);
    if (byte === undefined) return undefined;
    bytes[index] = byte;
  }
  return bytes;
}

function validGbkPairCount(bytes: Uint8Array): number {
  let count = 0;
  for (let index = 0; index < bytes.length - 1; index += 1) {
    const lead = bytes[index]!;
    const trail = bytes[index + 1]!;
    if (lead >= 0x81 && lead <= 0xfe && trail >= 0x40 && trail <= 0xfe && trail !== 0x7f) {
      count += 1;
      index += 1;
    }
  }
  return count;
}

export function repairLegacyWindowsEncoding(output: string): string {
  const bytes = legacyBytes(output);
  if (!bytes || validGbkPairCount(bytes) < 2) return output;

  try {
    const decoded = new TextDecoder('gb18030').decode(bytes);
    const sourceHanCount = output.match(/[\u3400-\u9fff]/g)?.length ?? 0;
    const decodedHanCount = decoded.match(/[\u3400-\u9fff]/g)?.length ?? 0;
    return decodedHanCount >= sourceHanCount + 2 ? decoded : output;
  } catch {
    return output;
  }
}

export function cleanCommandOutput(output: string) {
  return repairLegacyWindowsEncoding(output)
    .replace(windowsBanner, '')
    .replace(encodingSetup, '')
    .replace(exitEcho, '')
    .replace(/^\s+/, '')
    .replace(/\s+$/, '');
}
