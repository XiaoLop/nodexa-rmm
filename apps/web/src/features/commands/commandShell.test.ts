import { describe, expect, it } from 'vitest';
import type { Device } from '@meshcentral/shared-state';
import { prepareCommandForDevice, resolveCommandShell } from './commandShell';

const device = (platform: string): Device => ({
  id: `node-${platform}`,
  name: platform,
  online: true,
  platform,
});

describe('command shell preparation', () => {
  it('selects PowerShell automatically for Windows', () => {
    expect(resolveCommandShell(device('Windows 11'), 'auto')).toBe('powershell');
    expect(resolveCommandShell(device('Linux'), 'auto')).toBe('shell');
  });

  it('prepares PowerShell commands with UTF-8 console and pipeline encodings', () => {
    const command = prepareCommandForDevice(device('Windows 11'), 'powershell', 'ipconfig');

    expect(command).toContain('chcp.com 65001');
    expect(command).toContain('[Console]::OutputEncoding = $utf8');
    expect(command).toContain('$OutputEncoding = $utf8');
    expect(command).toMatch(/; ipconfig$/);
  });

  it('prepares Windows command prompt commands with UTF-8 code page', () => {
    expect(prepareCommandForDevice(device('Windows Server'), 'shell', 'ipconfig')).toBe(
      'chcp 65001 >nul & ipconfig',
    );
  });

  it('does not modify non-Windows commands', () => {
    expect(prepareCommandForDevice(device('Linux'), 'shell', 'ip addr')).toBe('ip addr');
  });
});
