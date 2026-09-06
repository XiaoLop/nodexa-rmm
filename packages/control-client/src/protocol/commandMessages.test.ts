import { describe, expect, it } from 'vitest';
import { isCommandConsoleEnd, normalizeCommandMessage } from './commandMessages';

describe('normalizeCommandMessage', () => {
  it('normalizes wrapped command output without inventing completion', () => {
    expect(
      normalizeCommandMessage({
        data: {
          action: 'runcommands',
          responseid: 'command-1',
          nodeid: 'node-1',
          stdout: 'hello\n',
        },
      }),
    ).toMatchObject({
      requestId: 'command-1',
      deviceId: 'node-1',
      kind: 'output',
      stream: 'stdout',
      content: 'hello\n',
    });
  });

  it('normalizes accepted, completed, failed and cancelled messages', () => {
    expect(
      normalizeCommandMessage({ action: 'runcommands', responseid: 'command-1', result: 'ok' })
        ?.kind,
    ).toBe('accepted');
    expect(
      normalizeCommandMessage({
        action: 'runcommands',
        responseid: 'command-1',
        done: true,
        exitCode: 0,
      }),
    ).toMatchObject({ kind: 'completed', exitCode: 0 });
    expect(
      normalizeCommandMessage({ action: 'runcommands', responseid: 'command-1', error: 'Denied' }),
    ).toMatchObject({ kind: 'failed', error: 'Denied' });
    expect(
      normalizeCommandMessage({
        action: 'runcommands',
        responseid: 'command-1',
        status: 'cancelled',
      })?.kind,
    ).toBe('cancelled');
  });

  it('ignores unrelated messages', () => {
    expect(normalizeCommandMessage({ action: 'nodes', responseid: 'nodes-1' })).toBeUndefined();
  });

  it('normalizes MeshCentral console output without a response ID', () => {
    expect(
      normalizeCommandMessage({
        action: 'msg',
        type: 'console',
        value: 'C:\\Program Files\\Mesh Agent>df -h\r\n',
        nodeid: 'node-1',
      }),
    ).toMatchObject({
      deviceId: 'node-1',
      kind: 'output',
      stream: 'output',
    });
  });

  it('keeps the Mesh Agent exit echo as console output while waiting for the final result', () => {
    expect(
      normalizeCommandMessage({
        action: 'msg',
        type: 'console',
        value: 'C:\\Program Files\\Mesh Agent>exit\r\n',
        nodeid: 'node-1',
      }),
    ).toMatchObject({ deviceId: 'node-1', kind: 'output' });
  });

  it('recognizes a split console exit marker after chunks are joined', () => {
    expect(isCommandConsoleEnd('C:\\Program Files\\Mesh Agent>ex' + 'it\r\n')).toBe(true);
    expect(isCommandConsoleEnd('output only\r\n')).toBe(false);
  });

  it('normalizes msg/runcommands as the authoritative final result', () => {
    expect(
      normalizeCommandMessage({
        action: 'msg',
        type: 'runcommands',
        result: '\r\nName  Free (GB)\r\nC     415.93\r\n',
        responseid: 'command-1',
        nodeid: 'node-1',
      }),
    ).toMatchObject({
      requestId: 'command-1',
      deviceId: 'node-1',
      kind: 'completed',
      finalResult: true,
      content: '\r\nName  Free (GB)\r\nC     415.93\r\n',
    });
  });
});
