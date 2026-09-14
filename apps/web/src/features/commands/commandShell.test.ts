import { describe, expect, it } from 'vitest';
import type { Device } from '@meshcentral/shared-state';
import { resolveCommandShell } from './commandShell';

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
});
