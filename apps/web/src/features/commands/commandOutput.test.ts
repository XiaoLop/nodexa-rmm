import { describe, expect, it } from 'vitest';
import { cleanCommandOutput, repairLegacyWindowsEncoding } from './commandOutput';

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

  it('repairs Chinese Windows output transported as Latin-1-like GBK bytes', () => {
    expect(
      repairLegacyWindowsEncoding(
        'Windows IP ÅäÖÃ\r\nIPv4 µØÖ· : 192.168.1.4\r\nÄ¬ÈÏÍø¹Ø : 192.168.1.1',
      ),
    ).toBe('Windows IP 配置\r\nIPv4 地址 : 192.168.1.4\r\n默认网关 : 192.168.1.1');
  });

  it('preserves valid Unicode and ordinary accented text', () => {
    expect(repairLegacyWindowsEncoding('Windows IP 配置\r\nIPv4 地址')).toBe(
      'Windows IP 配置\r\nIPv4 地址',
    );
    expect(repairLegacyWindowsEncoding('café résumé')).toBe('café résumé');
  });
});
