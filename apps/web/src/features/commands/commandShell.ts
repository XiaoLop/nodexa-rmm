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

export function prepareCommandForDevice(
  device: Device,
  shell: Exclude<CommandShell, 'auto'>,
  command: string,
) {
  const isWindows = device.platform?.toLowerCase().includes('windows') ?? false;
  if (!isWindows) return command;
  if (shell === 'powershell') {
    return `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding; ${command}`;
  }
  return `chcp 65001 >nul\r\n${command}`;
}
