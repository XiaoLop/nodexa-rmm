import type { CommandShell } from '@meshcentral/control-client';

export type CommandRisk = 'normal' | 'sensitive' | 'dangerous';

const dangerousPatterns = [
  /\b(shutdown|reboot|restart-computer|stop-computer)\b/i,
  /\b(rm\s+-[^\n]*r|format|diskpart|mkfs|remove-item\s+[^\n]*-recurse)\b/i,
  /\b(net\s+user|useradd|passwd|set-executionpolicy\s+bypass)\b/i,
];

const sensitivePatterns = [
  /\b(curl|wget|invoke-webrequest|invoke-restmethod)\b/i,
  /\b(netsh|iptables|ufw|firewall|chmod|chown|taskkill|stop-process)\b/i,
  /\b(powershell|pwsh|cmd|bash|sh)\s+(-enc|-encodedcommand|-c|\/c)\b/i,
];

export function classifyCommandRisk(command: string, shell: CommandShell): CommandRisk {
  void shell;
  const executable = command
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(echo|write-output)\s+/i, ''))
    .join('\n');
  if (dangerousPatterns.some((pattern) => pattern.test(executable))) return 'dangerous';
  if (sensitivePatterns.some((pattern) => pattern.test(executable))) return 'sensitive';
  return 'normal';
}

export function mayContainSecret(command: string) {
  return /\b(password|passwd|token|secret|api[_-]?key|private[_-]?key)\b\s*[:=]/i.test(command);
}
