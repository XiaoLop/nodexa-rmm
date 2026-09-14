import type { CommandShell } from '@meshcentral/control-client';
import type { Device } from '@meshcentral/shared-state';

export function supportsRemoteCommand(device: Device) {
  const platform = device.platform?.toLowerCase() ?? '';
  return !['android', 'ios', 'mobile'].some((value) => platform.includes(value));
}

export function resolveCommandShell(device: Device, shell: CommandShell) {
  if (shell !== 'auto') return shell;
  return device.platform?.toLowerCase().includes('windows') ? 'powershell' : 'shell';
}
