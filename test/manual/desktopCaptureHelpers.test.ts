import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DesktopCaptureRecorder, type DesktopCaptureMessage } from './desktopCaptureHelpers';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createRecorder(caseId = 'helper-test'): Promise<DesktopCaptureRecorder> {
  const directory = await mkdtemp(join(tmpdir(), 'meshcentral-desktop-capture-'));
  temporaryDirectories.push(directory);
  return new DesktopCaptureRecorder(
    {
      schemaVersion: 1,
      caseId,
      scenario: 'test',
      protocol: 2,
      transport: 'websocket',
      expectedActions: [],
      expectedObservations: [],
    },
    directory,
  );
}

async function readMessages(directory: string): Promise<DesktopCaptureMessage[]> {
  const text = await readFile(join(directory, 'messages.jsonl'), 'utf8');
  return text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as DesktopCaptureMessage);
}

describe('DesktopCaptureRecorder', () => {
  it('writes only the selected TypedArray bytes with stable sequence and hash metadata', async () => {
    const recorder = await createRecorder();
    const backing = new Uint8Array([91, 92, 1, 2, 3, 4, 93]);

    const firstSeq = recorder.recordMessage('relay', 'relay-to-browser', backing.subarray(2, 6));
    backing.fill(255);
    const secondSeq = recorder.recordMessage('relay', 'browser-to-relay', new Uint8Array([5, 6]));
    const directory = await recorder.write();

    expect([firstSeq, secondSeq]).toEqual([1, 2]);
    const messages = await readMessages(directory);
    expect(messages.map((message) => message.seq)).toEqual([1, 2]);
    expect(messages[0]).toMatchObject({
      byteLength: 4,
      payloadFile: 'payloads/000001.bin',
      sha256: createHash('sha256').update(Uint8Array.from([1, 2, 3, 4])).digest('hex'),
    });
    expect([...await readFile(join(directory, 'payloads', '000001.bin'))]).toEqual([1, 2, 3, 4]);
  });

  it('redacts credentials while preserving original UTF-8 length and hash', async () => {
    const recorder = await createRecorder('text-redaction');
    const text = JSON.stringify({
      cookie: 'cookie-secret',
      token: 'token-secret',
      value: '*/meshrelay.ashx?p=2&auth=relay-secret',
    });

    recorder.recordMessage('gateway', 'browser-to-gateway', text);
    const directory = await recorder.write();

    const [message] = await readMessages(directory);
    expect(message).toBeDefined();
    expect(message!.byteLength).toBe(new TextEncoder().encode(text).byteLength);
    expect(message!.sha256).toBe(createHash('sha256').update(text).digest('hex'));
    expect(message!.text).not.toContain('cookie-secret');
    expect(message!.text).not.toContain('token-secret');
    expect(message!.text).not.toContain('relay-secret');
  });

  it('links action intent to the messages sent for that action', async () => {
    const recorder = await createRecorder('action-link');
    const action = recorder.startAction('refresh-01', 'refresh');
    const seq = recorder.recordMessage('relay', 'browser-to-relay', new Uint8Array([0, 6, 0, 4]));
    recorder.linkAction(action, seq);
    const directory = await recorder.write();

    const actionText = await readFile(join(directory, 'actions.jsonl'), 'utf8');
    expect(JSON.parse(actionText)).toMatchObject({
      actionId: 'refresh-01',
      kind: 'refresh',
      firstMessageSeq: 1,
      lastMessageSeq: 1,
    });
  });
});