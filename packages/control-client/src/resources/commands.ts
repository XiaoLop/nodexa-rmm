import { MeshCentralValidationError } from '../errors';
import type {
  CommandExecuteOptions,
  CommandExecutionHandle,
  CommandRunOptions,
  CommandSubmission,
  MeshCentralClientEvents,
  MeshCentralEventChannel,
  MeshCentralListener,
} from '../types';
import { CommandExecution } from './CommandExecution';

interface ResourceClient {
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
  readonly connectionStatus?: string;
  send?(payload: unknown): void;
  on?<K extends MeshCentralEventChannel>(
    channel: K,
    listener: MeshCentralListener<MeshCentralClientEvents[K]>,
  ): () => void;
}

interface TrackedExecutionClient {
  readonly connectionStatus: string;
  send(payload: unknown): void;
  on<K extends MeshCentralEventChannel>(
    channel: K,
    listener: MeshCentralListener<MeshCentralClientEvents[K]>,
  ): () => void;
}

const required = (value: string, name: string) => {
  if (!value.trim()) throw new MeshCentralValidationError(`${name} is required.`);
};

export class CommandsResource {
  private executionClient?: TrackedExecutionClient;

  constructor(private readonly client: ResourceClient) {}

  execute(
    deviceIds: string[],
    command: string,
    options: CommandExecuteOptions = {},
  ): CommandExecutionHandle {
    if (!deviceIds.length || deviceIds.some((id) => !id.trim()))
      throw new MeshCentralValidationError('At least one valid device ID is required.');
    required(command, 'Command');
    const sourceSend = this.client.send;
    const sourceOn = this.client.on;
    if (!sourceSend || !sourceOn)
      throw new MeshCentralValidationError('This client does not support tracked command execution.');
    const source = this.client;
    const send = sourceSend.bind(source);
    const on = sourceOn.bind(source);
    const executionClient =
      this.executionClient ??
      ({
        get connectionStatus() {
          return source.connectionStatus ?? 'unknown';
        },
        send,
        on,
      } satisfies TrackedExecutionClient);
    this.executionClient = executionClient;
    return new CommandExecution(executionClient, [...new Set(deviceIds)], command, options);
  }

  async run(
    deviceIds: string[],
    command: string,
    options: CommandRunOptions = {},
  ): Promise<CommandSubmission> {
    if (!deviceIds.length || deviceIds.some((id) => !id.trim()))
      throw new MeshCentralValidationError('At least one valid device ID is required.');
    required(command, 'Command');
    const requestId = `command-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const raw = await this.client.request({
      action: 'runcommands',
      nodeids: [...new Set(deviceIds)],
      cmds: command,
      type: options.shell === 'powershell' ? 2 : 0,
      runAsUser: options.runAsUser ?? 0,
      reply: options.reply ?? true,
      responseid: requestId,
    });
    return { requestId, raw };
  }
}
