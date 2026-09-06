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

  it('forces UTF-8 output for Windows PowerShell', () => {
    expect(
      prepareCommandForDevice(device('Windows 10'), 'powershell', 'Get-NetIPConfiguration'),
    ).toContain('[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)');
  });

  it('switches the Windows command prompt to UTF-8', () => {
    expect(prepareCommandForDevice(device('Windows Server'), 'shell', 'ipconfig')).toBe(
      'chcp 65001 >nul\r\nipconfig',
    );
  });

  it('does not alter commands for non-Windows devices', () => {
    expect(prepareCommandForDevice(device('Linux'), 'shell', 'df -h')).toBe('df -h');
  });
});
