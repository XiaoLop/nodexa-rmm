const windowsBanner =
  /^Microsoft Windows \[[^\r\n]*\]\r?\n(?:\(c\) Microsoft Corporation[^\r\n]*\r?\n)?(?:\r?\n)*/i;
const encodingSetup = /^.*>chcp 65001 >nul\r?\n(?:\r?\n)*/im;
const exitEcho = /(?:\r?\n)*.*>exit\r?\n?$/i;

export function cleanCommandOutput(output: string) {
  return output
    .replace(windowsBanner, '')
    .replace(encodingSetup, '')
    .replace(exitEcho, '')
    .replace(/^\s+/, '')
    .replace(/\s+$/, '');
}
