import { GatewayValidationError } from '../errors';
import type { CommandRunOptions, CommandSubmission } from '../types';

interface ResourceClient {
  request<T>(payload: Record<string, unknown>, timeoutMs?: number): Promise<T>;
}

const required = (value: string, name: string) => {
  if (!value.trim()) throw new GatewayValidationError(`${name} is required.`);
};

export class CommandsResource {
  constructor(private readonly client: ResourceClient) {}

  async run(
    deviceIds: string[],
    command: string,
    options: CommandRunOptions = {},
  ): Promise<CommandSubmission> {
    if (!deviceIds.length || deviceIds.some((id) => !id.trim()))
      throw new GatewayValidationError('At least one valid device ID is required.');
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