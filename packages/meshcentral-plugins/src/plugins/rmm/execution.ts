import type { MeshCentralCommand } from '../../types/meshcentral.types.js';
import type { Script } from './script.js';

// MeshCentral 1.1.54 meshAgentsArchitectureNumbers; exclude macOS, Android and BSD.
const linuxAgents = new Set([
  5, 6, 7, 8, 9, 10, 13, 15, 18, 19, 20, 24, 25, 26, 27, 28, 32, 33, 35, 36, 40, 41, 45,
]);
export function supportsAgent(script: Script, agentId: number): boolean {
  return script.platform === 'linux' ? linuxAgents.has(agentId) : [1, 2, 3, 4].includes(agentId);
}

function buildLinuxCommand(
  id: string,
  actor: string,
  script: Script,
  values: Record<string, unknown>,
) {
  const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64');
  const error = encode('Unable to prepare Linux script execution');
  const lines = [
    '(',
    'umask 077',
    `rmm_fail() { printf '%s\\n' 'RMM-RESULT ${id} 1 0 ${error}'; exit 0; }`,
    'for rmm_tool in mktemp base64 head cat wc tr rm; do command -v "$rmm_tool" >/dev/null 2>&1 || rmm_fail; done',
    'rmm_dir=$(mktemp -d "${TMPDIR:-/tmp}/mesh-rmm.XXXXXXXX") || rmm_fail',
    'trap \'rm -rf -- "$rmm_dir"\' 0',
    `printf '%s' '${encode(script.body.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'))}' | base64 -d > "$rmm_dir/script.sh" || rmm_fail`,
    ...script.parameters.flatMap(({ name }) => [
      // The suffix preserves trailing newlines removed by shell command substitution.
      `RMM_PARAM_${name}=$(printf '%s' '${encode(String(values[name]))}' | base64 -d; printf '.')`,
      `RMM_PARAM_${name}=\${RMM_PARAM_${name}%.}; export RMM_PARAM_${name}`,
    ]),
    '(',
    '  /bin/sh "$rmm_dir/script.sh" </dev/null',
    '  printf \'%s\' "$?" > "$rmm_dir/code"',
    ') 2>&1 | { head -c 32769 > "$rmm_dir/output" || exit 1; cat >/dev/null; } || rmm_fail',
    'rmm_code=$(cat "$rmm_dir/code") || rmm_fail',
    'rmm_size=$(wc -c < "$rmm_dir/output") || rmm_fail',
    'rmm_truncated=0; if [ "$rmm_size" -gt 32768 ]; then rmm_truncated=1; fi',
    'head -c 32768 "$rmm_dir/output" > "$rmm_dir/clipped" || rmm_fail',
    'rmm_output=$(base64 < "$rmm_dir/clipped") || rmm_fail',
    "rmm_output=$(printf '%s' \"$rmm_output\" | tr -d '\\r\\n') || rmm_fail",
    `printf 'RMM-RESULT ${id} %s %s %s\\n' "$rmm_code" "$rmm_truncated" "$rmm_output"`,
    ')',
    '',
  ];
  return {
    action: 'runcommands',
    type: 3,
    runAsUser: 0,
    reply: true,
    responseid: id,
    sessionid: actor + '/rmm-' + id,
    cmds: lines.join('\n'),
  };
}

const runner = Buffer.from(
  [
    'param([string]$PayloadPath)',
    "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'",
    '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
    'try {',
    '  $payload = Get-Content -LiteralPath $PayloadPath -Raw -Encoding UTF8 | ConvertFrom-Json',
    '  $arguments = @{}',
    '  foreach ($property in $payload.values.PSObject.Properties) { $arguments[$property.Name] = $property.Value }',
    '  $global:LASTEXITCODE = 0',
    "  & ([IO.Path]::Combine([IO.Path]::GetDirectoryName($PayloadPath), 'script.ps1')) @arguments",
    '  exit $LASTEXITCODE',
    '} catch { [Console]::Error.WriteLine($_.ToString()); exit 1 }',
  ].join('\r\n'),
  'utf8',
).toString('base64');

function encodedBytes(value: string): string {
  return (
    "[Convert]::FromBase64String(('" + (value.match(/.{1,4096}/g) ?? ['']).join("' +\r\n'") + "'))"
  );
}

export function buildCommand(
  id: string,
  actor: string,
  script: Script,
  values: Record<string, unknown>,
) {
  if (script.platform === 'linux') return buildLinuxCommand(id, actor, script, values);
  const body = Buffer.from('\uFEFF' + script.body, 'utf8').toString('base64');
  const payload = Buffer.from(JSON.stringify({ values }), 'utf8').toString('base64');
  const lines = [
    '& {',
    "$ProgressPreference = 'SilentlyContinue'; $ErrorActionPreference = 'Stop'",
    '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
    "$dir = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('MeshRmm-' + [Guid]::NewGuid())",
    '$result = [Text.StringBuilder]::new(); $truncated = $false; $code = 1',
    'try {',
    '  [void][IO.Directory]::CreateDirectory($dir)',
    "  $runnerPath = Join-Path $dir 'runner.ps1'; $payloadPath = Join-Path $dir 'payload.json'",
    '  [IO.File]::WriteAllBytes($runnerPath, ' + encodedBytes(runner) + ')',
    '  [IO.File]::WriteAllBytes($payloadPath, ' + encodedBytes(payload) + ')',
    "  [IO.File]::WriteAllBytes((Join-Path $dir 'script.ps1'), " + encodedBytes(body) + ')',
    "  $ErrorActionPreference = 'Continue'",
    '  & "$PSHOME\\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $runnerPath $payloadPath 2>&1 | ForEach-Object {',
    '    $line = $_.ToString() + [Environment]::NewLine',
    '    $remaining = 32768 - $result.Length',
    '    if ($line.Length -gt $remaining) { $truncated = $true; $line = $line.Substring(0, $remaining) }',
    '    [void]$result.Append($line)',
    '  }',
    '  $code = $LASTEXITCODE',
    '} catch {',
    '  $detail = $_.ToString(); if ($result.Length -eq 0) { [void]$result.Append($detail.Substring(0, [Math]::Min(32768, $detail.Length))) }',
    '} finally {',
    '  Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue',
    '}',
    "  [Console]::WriteLine('RMM-RESULT " +
      id +
      " ' + $code + ' ' + [int]$truncated + ' ' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($result.ToString())))",
    '}',
    '',
  ];
  return {
    action: 'runcommands',
    type: 2,
    runAsUser: 0,
    reply: true,
    responseid: id,
    sessionid: actor + '/rmm-' + id,
    cmds: lines.join('\r\n'),
  };
}

export function readResult(command: MeshCentralCommand) {
  if (
    command.action !== 'msg' ||
    command.type !== 'runcommands' ||
    typeof command.result !== 'string' ||
    command.result.length > 200_000
  )
    return undefined;
  const matches = [
    ...command.result.matchAll(
      /^RMM-RESULT ([\da-f-]{36}) (-?\d{1,10}) ([01]) ([A-Za-z0-9+/=]*)\r?$/gm,
    ),
  ];
  const match = matches.length === 1 ? matches[0] : undefined;
  if (!match?.[1] || match[1] !== command.responseid || match[4] === undefined) return undefined;
  const exitCode = Number(match[2]);
  if (exitCode < -2147483648 || exitCode > 2147483647) return undefined;
  const bytes = Buffer.from(match[4], 'base64');
  if (bytes.toString('base64') !== match[4]) return undefined;
  const output = new TextDecoder().decode(bytes.subarray(0, 32768), { stream: true });
  return { id: match[1], exitCode, output, truncated: match[3] === '1' || bytes.length > 32768 };
}
