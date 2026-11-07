import type { MeshCentralClient } from '../client/MeshCentralClient';

export type RmmParameter = {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'enum';
  options?: string[];
};
export type RmmScriptDraft = {
  name: string;
  description: string;
  body: string;
  parameters: RmmParameter[];
};
export type RmmScript = Omit<RmmScriptDraft, 'body'> & {
  id: string;
  version: number;
  archived: boolean;
  builtin: boolean;
  body?: string;
};
export type RmmTarget = { id: string; name: string; reason?: string };
export type RmmPreview = { id: string; targets: RmmTarget[] };
export type RmmStatus =
  'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'timeout' | 'unknown';
export type RmmResult = {
  id: string;
  name: string;
  status: RmmStatus;
  reason: string | null;
  exitCode: number | null;
  output: string | null;
  truncated: boolean;
};
export type RmmTask = {
  id: string;
  actor: string;
  scriptId: string;
  version: number;
  name: string;
  created: number;
  counts: Partial<Record<RmmStatus, number>>;
  active: boolean;
};

export class RmmResource {
  constructor(private readonly client: MeshCentralClient) {}

  listScripts() {
    return this.request<RmmScript[]>('listScripts');
  }

  saveScript(script: RmmScriptDraft, current?: Pick<RmmScript, 'id' | 'version'>) {
    return this.request<{ id: string; version: number }>('saveScript', {
      script,
      scriptId: current?.id,
      version: current?.version,
    });
  }

  archiveScript(scriptId: string) {
    return this.request<object>('archiveScript', { scriptId });
  }

  preview(script: Pick<RmmScript, 'id' | 'version'>, nodeIds: string[], groupIds: string[]) {
    return this.request<RmmPreview>('preview', {
      scriptId: script.id,
      version: script.version,
      nodeIds,
      groupIds,
    });
  }

  submit(previewId: string, key: string, params: Record<string, string | number | boolean>) {
    return this.request<{ id: string }>('submit', { previewId, key, params });
  }

  listTasks(before?: number) {
    return this.request<{ tasks: RmmTask[]; before?: number }>('listTasks', { before });
  }

  getTask(taskId: string) {
    return this.request<RmmTask & { results: RmmResult[] }>('getTask', { taskId });
  }

  private request<T>(subAction: string, data: Record<string, unknown> = {}): Promise<T> {
    const requestId = globalThis.crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const finish = () => {
        clearTimeout(timer);
        unsubscribe();
      };
      const unsubscribe = this.client.on('message', (message) => {
        const response = message as Record<string, unknown> | undefined;
        if (
          !response ||
          response.action !== 'plugin' ||
          response.plugin !== 'rmm' ||
          response.subAction !== subAction ||
          response.requestId !== requestId
        )
          return;
        finish();
        if (typeof response.error === 'string') reject(new Error(response.error));
        else if (!Object.hasOwn(response, 'data')) reject(new Error('INVALID_RESPONSE'));
        else resolve(response.data as T);
      });
      const timer = setTimeout(() => {
        finish();
        reject(new Error('REQUEST_TIMEOUT'));
      }, 10_000);
      try {
        this.client.send({ action: 'plugin', plugin: 'rmm', subAction, requestId, ...data });
      } catch (error) {
        finish();
        reject(error);
      }
    });
  }
}
