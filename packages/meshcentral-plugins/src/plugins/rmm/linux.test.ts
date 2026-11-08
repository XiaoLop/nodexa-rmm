import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildCommand, readResult, supportsAgent } from './execution.js';
import { parseScript, parseValues } from './script.js';

const shell = process.env.RMM_TEST_SH ?? (process.platform === 'linux' ? '/bin/sh' : undefined);
const draft = {
  platform: 'linux',
  name: 'Linux test',
  description: '',
  body: 'exit 0',
  parameters: [],
};

describe('Linux platform validation', () => {
  it('preserves old Windows scripts and accepts only explicit supported platforms', () => {
    expect(parseScript({ ...draft, platform: undefined }).platform).toBe('windows');
    expect(() => parseScript({ ...draft, platform: 'macos' })).toThrow('INVALID_SCRIPT');
    expect(supportsAgent(parseScript(draft), 6)).toBe(true);
    expect(supportsAgent(parseScript(draft), 32)).toBe(true);
    for (const id of [0, 2, 11, 12, 14, 16, 17, 29, 30, 37, 10005])
      expect(supportsAgent(parseScript(draft), id)).toBe(false);
    expect(supportsAgent(parseScript({ ...draft, platform: undefined }), 6)).toBe(false);
  });
  it('rejects NUL bytes which shell source or environment variables cannot represent', () => {
    expect(() => parseScript({ ...draft, body: 'printf "\0"' })).toThrow('INVALID_SCRIPT');
    const script = parseScript({ ...draft, parameters: [{ name: 'Value', type: 'string' }] });
    expect(() => parseValues(script, { Value: 'a\0b' })).toThrow('INVALID_PARAMETER');
  });
});

// On Windows use a local POSIX shell, e.g. Git's sh.exe, via RMM_TEST_SH.
// This exercises the wrapper; it does not replace a real Linux Agent acceptance test.
describe.skipIf(!shell)('Linux shell wrapper', () => {
  function run(
    body: string,
    parameters: unknown[] = [],
    input: Record<string, unknown> = {},
    prefix = '',
  ) {
    const script = parseScript({ ...draft, body, parameters });
    const values = parseValues(script, input);
    const id = randomUUID();
    const command = buildCommand(id, 'user//admin', script, values);
    expect(command).toMatchObject({ type: 3, reply: true, runAsUser: 0, responseid: id });
    const inputCommand =
      (process.platform === 'win32' ? 'PATH=/usr/bin:/bin:$PATH\n' : '') + prefix + command.cmds;
    const result = spawnSync(shell!, ['-s'], {
      input: inputCommand.replace(/\r/g, ''),
      encoding: 'utf8',
      timeout: 15000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    const parsed = readResult({
      action: 'msg',
      type: 'runcommands',
      responseid: id,
      result: result.stdout,
    });
    expect(parsed, result.stderr).toBeDefined();
    return parsed!;
  }

  it('captures combined stdout/stderr and the actual nonzero exit code', () => {
    expect(run("printf 'out'; printf 'err' >&2; exit 7")).toMatchObject({
      exitCode: 7,
      output: 'outerr',
      truncated: false,
    });
  });
  it('reports failed preparation without executing the script when required utilities are missing', () => {
    expect(run('printf should-not-run', [], {}, 'PATH=/missing\n')).toMatchObject({
      exitCode: 1,
      output: 'Unable to prepare Linux script execution',
    });
  });
  it('preserves quotes, shell metacharacters, Unicode and trailing CR/newlines as literal parameters', () => {
    const value = '"double" \'single\' ; $() $(printf injected) `printf injected` & | 中文\r\n\n';
    const result = run('printf \'%s\' "$RMM_PARAM_Value"', [{ name: 'Value', type: 'string' }], {
      Value: value,
    });
    expect(result.output).toBe(value);
    expect(result.exitCode).toBe(0);
  });
  it('passes integer, boolean and enum values without interpreting them as commands', () => {
    const result = run(
      'printf \'%s %s\' "$RMM_PARAM_Enabled" "$RMM_PARAM_Mode"; exit "$RMM_PARAM_Code"',
      [
        { name: 'Enabled', type: 'boolean' },
        { name: 'Mode', type: 'enum', options: ['check', 'report'] },
        { name: 'Code', type: 'integer' },
      ],
      { Enabled: false, Mode: 'report', Code: 7 },
    );
    expect(result).toMatchObject({ exitCode: 7, output: 'false report' });
  });
  it('normalizes BOM and CRLF script files and reads no interactive input', () => {
    expect(
      run('\uFEFFprintf "中文"\r\nread value\r\nprintf \'%s\' "${value:-empty}"\r\n').output,
    ).toBe('中文empty');
  });
  it('drains large output without SIGPIPE, preserves exit status and clips UTF-8 safely', () => {
    const result = run('i=0; while [ "$i" -lt 12000 ]; do printf "验"; i=$((i+1)); done; exit 7');
    expect(result).toMatchObject({ exitCode: 7, truncated: true, output: '验'.repeat(10922) });
  });
  it('does not mark exactly 32 KiB of output as truncated', () => {
    const result = run("head -c 32768 /dev/zero | tr '\\000' x");
    expect(result).toMatchObject({ exitCode: 0, truncated: false, output: 'x'.repeat(32768) });
  });
  it('isolates user output that looks like a receipt and removes temporary script files', () => {
    const fake = `RMM-RESULT ${randomUUID()} 0 0 b2s=`;
    expect(run(`printf '%s' '${fake}'`).output).toBe(fake);
    const result = run('printf \'%s\' "$0"');
    const exists = spawnSync(shell!, ['-c', 'test -e "$1"', 'test', result.output], {
      encoding: 'utf8',
    });
    expect(exists.status).toBe(1);
  });
});
