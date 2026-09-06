import { GatewayValidationError } from '../errors';
import { normalizeCommandMessage } from '../protocol/commandMessages';
import type {
  CommandBatchSnapshot,
  CommandDeviceResult,
  CommandExecuteOptions,
  CommandExecutionHandle,
  CommandExecutionStatus,
  ConnectionStateChange,
  GatewayClientEvents,
  GatewayEventChannel,
  GatewayListener,
} from '../types';

interface ExecutionClient {
  readonly connectionStatus: string;
  send(payload: unknown): void;
  on<K extends GatewayEventChannel>(
    channel: K,
    listener: GatewayListener<GatewayClientEvents[K]>,
  ): () => void;
}

const MAX_OUTPUT_CHUNKS = 10_000;
const MAX_OUTPUT_CHARACTERS = 1024 * 1024;
const activeDevicesByClient = new WeakMap<ExecutionClient, Set<string>>();

const terminalStatuses = new Set<CommandExecutionStatus>([
  'succeeded',
  'failed',
  'cancelled',
  'timedOut',
  'unknown',
]);

function copyResult(result: CommandDeviceResult): CommandDeviceResult {
  return { ...result, output: result.output.map((chunk) => ({ ...chunk })) };
}

export class CommandExecution implements CommandExecutionHandle {
  readonly requestId: string;
  readonly completed: Promise<CommandBatchSnapshot>;
  private readonly listeners = new Set<(snapshot: CommandBatchSnapshot) => void>();
  private readonly results = new Map<string, CommandDeviceResult>();
  private readonly truncatedDevices = new Set<string>();
  private readonly startedAt = Date.now();
  private sequence = 0;
  private trackingStopped = false;
  private settled = false;
  private sent = false;
  private timeout?: ReturnType<typeof setTimeout>;
  private unsubscribeMessage?: () => void;
  private unsubscribeConnection?: () => void;
  private resolveCompleted!: (snapshot: CommandBatchSnapshot) => void;
  private readonly activeDevices: Set<string>;

  constructor(
    private readonly client: ExecutionClient,
    private readonly deviceIds: string[],
    command: string,
    options: CommandExecuteOptions = {},
  ) {
    this.activeDevices = activeDevicesByClient.get(client) ?? new Set<string>();
    const duplicateDevice = deviceIds.find((deviceId) => this.activeDevices.has(deviceId));
    if (duplicateDevice)
      throw new GatewayValidationError(
        `Device ${duplicateDevice} already has an active tracked command.`,
      );
    for (const deviceId of deviceIds) this.activeDevices.add(deviceId);
    activeDevicesByClient.set(client, this.activeDevices);
    this.requestId = `command-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.completed = new Promise((resolve) => {
      this.resolveCompleted = resolve;
    });
    for (const deviceId of deviceIds) {
      this.results.set(deviceId, {
        deviceId,
        status: 'submitting',
        output: [],
        startedAt: this.startedAt,
      });
    }

    this.unsubscribeMessage = client.on('message', (message) => this.handleMessage(message));
    this.unsubscribeConnection = client.on('connection', (change) => this.handleConnection(change));
    this.timeout = setTimeout(() => this.finishUnresolved('timedOut'), options.timeoutMs ?? 60_000);

    try {
      client.send({
        action: 'runcommands',
        nodeids: deviceIds,
        cmds: command,
        type: options.shell === 'powershell' ? 2 : 0,
        runAsUser: options.runAsUser ?? 0,
        reply: true,
        responseid: this.requestId,
      });
      this.sent = true;
      this.updateUnresolved('running');
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.updateUnresolved('failed', detail);
      this.finish();
      throw error;
    }
  }

  getSnapshot(): CommandBatchSnapshot {
    const results = this.deviceIds.map((deviceId) => copyResult(this.results.get(deviceId)!));
    const statuses = results.map((result) => result.status);
    const status: CommandExecutionStatus = statuses.every((value) => value === 'succeeded')
      ? 'succeeded'
      : statuses.some((value) => value === 'running')
        ? 'running'
        : statuses.some((value) => value === 'submitting')
          ? 'submitting'
          : statuses.some((value) => value === 'failed')
            ? 'failed'
            : statuses.some((value) => value === 'timedOut')
              ? 'timedOut'
              : statuses.some((value) => value === 'unknown')
                ? 'unknown'
                : (statuses[0] ?? 'unknown');
    return { requestId: this.requestId, status, results, trackingStopped: this.trackingStopped };
  }

  subscribe(listener: (snapshot: CommandBatchSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  stopTracking(): void {
    if (this.settled) return;
    this.trackingStopped = true;
    this.finishUnresolved('unknown');
  }

  cancelRemote(): Promise<void> {
    return Promise.reject(
      new GatewayValidationError(
        'The gateway protocol does not support remote command cancellation.',
      ),
    );
  }

  private handleMessage(raw: unknown): void {
    if (this.settled) return;
    const message = normalizeCommandMessage(raw);
    if (!message?.deviceId) return;
    const targets = this.results.has(message.deviceId) ? [message.deviceId] : [];
    if (!targets.length) return;

    for (const deviceId of targets) {
      const result = this.results.get(deviceId)!;
      if (terminalStatuses.has(result.status)) continue;
      if (message.finalResult) result.output = [];
      if (message.content !== undefined)
        this.appendOutput(result, message.stream ?? 'output', message.content);
      if (message.exitCode !== undefined) result.exitCode = message.exitCode;
      if (message.error) result.error = message.error;
      if (message.kind === 'failed') this.completeResult(result, 'failed');
      else if (message.kind === 'cancelled') this.completeResult(result, 'cancelled');
      else if (message.kind === 'completed')
        this.completeResult(
          result,
          message.finalResult
            ? 'succeeded'
            : message.exitCode === undefined
              ? 'unknown'
              : message.exitCode === 0
                ? 'succeeded'
                : 'failed',
        );
      else result.status = 'running';
    }
    this.publish();
    if ([...this.results.values()].every((result) => terminalStatuses.has(result.status)))
      this.finish();
  }

  private handleConnection(change: ConnectionStateChange): void {
    if (!this.settled && this.sent && change.current !== 'connected')
      this.finishUnresolved('unknown');
  }

  private appendOutput(
    result: CommandDeviceResult,
    stream: 'stdout' | 'stderr' | 'output' | 'system',
    content: string,
  ): void {
    result.output.push({ sequence: ++this.sequence, stream, content, receivedAt: Date.now() });
    let characters = result.output.reduce((total, chunk) => total + chunk.content.length, 0);
    let truncated = false;
    while (result.output.length > MAX_OUTPUT_CHUNKS || characters > MAX_OUTPUT_CHARACTERS) {
      const removed = result.output.shift();
      if (!removed) break;
      characters -= removed.content.length;
      truncated = true;
    }
    if (truncated && !this.truncatedDevices.has(result.deviceId)) {
      this.truncatedDevices.add(result.deviceId);
      result.output.unshift({
        sequence: ++this.sequence,
        stream: 'system',
        content: 'Earlier command output was truncated.',
        receivedAt: Date.now(),
      });
    }
  }

  private completeResult(result: CommandDeviceResult, status: CommandExecutionStatus): void {
    result.status = status;
    result.finishedAt = Date.now();
    result.durationMs = result.finishedAt - result.startedAt;
  }

  private updateUnresolved(status: CommandExecutionStatus, error?: string): void {
    for (const result of this.results.values()) {
      if (terminalStatuses.has(result.status)) continue;
      result.status = status;
      if (error) result.error = error;
      if (terminalStatuses.has(status)) this.completeResult(result, status);
    }
    this.publish();
  }

  private finishUnresolved(status: CommandExecutionStatus): void {
    this.updateUnresolved(status);
    this.finish();
  }

  private publish(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) listener(snapshot);
  }

  private finish(): void {
    if (this.settled) return;
    this.settled = true;
    if (this.timeout) clearTimeout(this.timeout);
    this.unsubscribeMessage?.();
    this.unsubscribeConnection?.();
    this.timeout = undefined;
    this.unsubscribeMessage = undefined;
    this.unsubscribeConnection = undefined;
    for (const deviceId of this.deviceIds) this.activeDevices.delete(deviceId);
    if (!this.activeDevices.size) activeDevicesByClient.delete(this.client);
    const snapshot = this.getSnapshot();
    this.resolveCompleted(snapshot);
    this.publish();
  }
}
