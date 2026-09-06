import { describe, expect, it } from 'vitest';
import { cleanCommandOutput } from './commandOutput';

describe('cleanCommandOutput', () => {
  it('removes a corrupted Windows banner and internal command plumbing', () => {
    const output = [
      'Microsoft Windows [°汾 10.0.19045.7291]\r\n',
      '(c) Microsoft Corporation¡£±£t˹ӐȨ;¡£\r\n',
      '\r\n',
      'C:\\Program Files\\Mesh Agent>chcp 65001 >nul\r\n',
      '\r\n',
      'C:\\Program Files\\Mesh Agent>ipconfig\r\n',
      'Windows IP Configuration\r\n',
      '\r\n',
      'C:\\Program Files\\Mesh Agent>exit\r\n',
    ].join('');

    expect(cleanCommandOutput(output)).toBe(
      'C:\\Program Files\\Mesh Agent>ipconfig\r\nWindows IP Configuration',
    );
  });

  it('preserves ordinary command output', () => {
    expect(cleanCommandOutput('Filesystem  Size  Used\n/dev/sda  100G  20G\n')).toBe(
      'Filesystem  Size  Used\n/dev/sda  100G  20G',
    );
  });
});
