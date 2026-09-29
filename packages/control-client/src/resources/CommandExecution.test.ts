import { describe, expect, it, vi } from 'vitest';
import type { MeshCentralClientEvents, MeshCentralEventChannel, MeshCentralListener } from '../types';
import { CommandExecution } from './CommandExecution';

class FakeExecutionClient {
  connectionStatus = 'connected';
  sent: unknown[] = [];
  listeners = new Map<MeshCentralEventChannel, Set<MeshCentralListener<never>>>();

  send(payload: unknown) {
    this.sent.push(payload);
  }

  on<K extends MeshCentralEventChannel>(channel: K, listener: MeshCentralListener<MeshCentralClientEvents[K]>) {
    const listeners = this.listeners.get(channel) ?? new Set();
    listeners.add(listener as MeshCentralListener<never>);
    this.listeners.set(channel, listeners);
    return () => listeners.delete(listener as MeshCentralListener<never>);
  }

  emit<K extends MeshCentralEventChannel>(channel: K, value: MeshCentralClientEvents[K]) {
    for (const listener of this.listeners.get(channel) ?? []) listener(value as never);
  }
}

describe('CommandExecution', () => {
  it('tracks output and completes a single device command', async () => {
    const client = new FakeExecutionClient();
    const execution = new CommandExecution(client, ['node-1'], 'hostname', { timeoutMs: 1_000 });
    const requestId = execution.requestId;

    expect(client.sent[0]).toMatchObject({
      action: 'runcommands',
      nodeids: ['node-1'],
      responseid: requestId,
    });
    client.emit('message', {
      action: 'runcommands',
      responseid: requestId,
      nodeid: 'node-1',
      output: 'host\n',
    });
    client.emit('message', {
      action: 'runcommands',
      responseid: requestId,
      nodeid: 'node-1',
      done: true,
      exitCode: 0,
    });

    await expect(execution.completed).resolves.toMatchObject({
      status: 'succeeded',
      results: [
        { deviceId: 'node-1', status: 'succeeded', exitCode: 0, output: [{ content: 'host\n' }] },
      ],
    });
    expect(client.listeners.get('message')?.size).toBe(0);
    expect(client.listeners.get('connection')?.size).toBe(0);
  });

  it('marks unfinished devices unknown on disconnect without resending', async () => {
    const client = new FakeExecutionClient();
    const execution = new CommandExecution(client, ['node-1', 'node-2'], 'hostname');
    client.emit('connection', {
      previous: 'connected',
      current: 'reconnecting',
      reconnectAttempt: 1,
    });

    await expect(execution.completed).resolves.toMatchObject({
      status: 'unknown',
      results: [{ status: 'unknown' }, { status: 'unknown' }],
    });
    expect(client.sent).toHaveLength(1);
  });

  it('times out unfinished commands', async () => {
    vi.useFakeTimers();
    const client = new FakeExecutionClient();
    const execution = new CommandExecution(client, ['node-1'], 'hostname', { timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(50);
    await expect(execution.completed).resolves.toMatchObject({ status: 'timedOut' });
    vi.useRealTimers();
  });

  it('uses the final msg/runcommands result and replaces console output', async () => {
    const client = new FakeExecutionClient();
    const execution = new CommandExecution(client, ['node-1'], 'df -h');

    client.emit('message', {
      action: 'msg',
      type: 'console',
      value: 'C:\\Program Files\\Mesh Agent>df -h\r\n',
      nodeid: 'node-1',
    });
    client.emit('message', {
      action: 'msg',
      type: 'console',
      value: 'C:\\Program Files\\Mesh Agent>exit\r\n',
      nodeid: 'node-1',
    });
    client.emit('message', {
      action: 'msg',
      type: 'runcommands',
      result: 'Filesystem result\r\n',
      responseid: execution.requestId,
      nodeid: 'node-1',
    });

    await expect(execution.completed).resolves.toMatchObject({
      status: 'succeeded',
      results: [
        {
          deviceId: 'node-1',
          status: 'succeeded',
          output: [{ content: 'Filesystem result\r\n' }],
        },
      ],
    });
  });

  it('does not finish on a split console exit echo before the final result', async () => {
    const client = new FakeExecutionClient();
    const execution = new CommandExecution(client, ['node-1'], 'hostname');

    client.emit('message', {
      action: 'msg',
      type: 'console',
      value: 'C:\\Program Files\\Mesh Agent>ex',
      nodeid: 'node-1',
    });
    client.emit('message', {
      action: 'msg',
      type: 'console',
      value: 'it\r\n',
      nodeid: 'node-1',
    });

    expect(execution.getSnapshot().status).toBe('running');
    client.emit('message', {
      action: 'msg',
      type: 'runcommands',
      result: 'host\r\n',
      nodeid: 'node-1',
    });
    await expect(execution.completed).resolves.toMatchObject({ status: 'succeeded' });
  });

  it('tracks the final result by device ID even when a different response ID is present', async () => {
    const client = new FakeExecutionClient();
    const execution = new CommandExecution(client, ['node-1'], 'hostname');

    client.emit('message', {
      action: 'msg',
      type: 'runcommands',
      responseid: 'ignored-by-device-tracking',
      result: 'host\r\n',
      nodeid: 'node-1',
    });

    await expect(execution.completed).resolves.toMatchObject({ status: 'succeeded' });
  });

  it('rejects concurrent tracked commands for the same device', () => {
    const client = new FakeExecutionClient();
    const execution = new CommandExecution(client, ['node-1'], 'hostname');

    expect(() => new CommandExecution(client, ['node-1'], 'whoami')).toThrow(
      'already has an active tracked command',
    );
    execution.stopTracking();
    expect(() => new CommandExecution(client, ['node-1'], 'whoami')).not.toThrow();
  });
});
