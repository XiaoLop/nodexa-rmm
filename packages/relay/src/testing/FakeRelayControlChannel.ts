import type { RelayControlChannel } from '../types';

export class FakeRelayControlChannel implements RelayControlChannel {
  readonly requests: Record<string, unknown>[] = [];
  readonly sent: unknown[] = [];
  response: unknown = {
    action: 'authcookie',
    cookie: 'browser-cookie',
    rcookie: 'agent-cookie',
  };
  responses: unknown[] = [];
  error?: Error;

  async request<T = unknown>(payload: Record<string, unknown>): Promise<T> {
    this.requests.push(payload);
    if (this.error) throw this.error;
    if (this.responses.length > 0) return this.responses.shift() as T;
    return this.response as T;
  }

  send(payload: unknown): void {
    this.sent.push(payload);
  }
}
