import type { MeshCentralCommand } from '../../types/meshcentral.types.js';
import type { Script } from './script.js';

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
