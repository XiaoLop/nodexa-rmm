import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DesktopCaptureRecorder } from '../manual/desktopCaptureHelpers';
import { validateDesktopCaptureCase } from './captureManifest';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function createCapture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'meshcentral-desktop-manifest-'));
  temporaryDirectories.push(root);
  const recorder = new DesktopCaptureRecorder({
    schemaVersion: 1,
    caseId: 'manifest-test',
    scenario: 'connection',
    protocol: 2,
    transport: 'websocket',
    expectedActions: ['refresh'],
    expectedObservations: ['relay-handshake'],
  }, root);
  const action = recorder.startAction('refresh-01', 'refresh');
  const seq = recorder.recordMessage('relay', 'browser-to-relay', Uint8Array.from([0, 6, 0, 4]));
  recorder.linkAction(action, seq);
  recorder.recordClose({ channel: 'relay', direction: 'browser-to-relay', kind: 'intent', code: 1000 });
  return recorder.write();
}

describe('validateDesktopCaptureCase', () => {
  it('accepts a complete capture with valid payload references', async () => {
    await expect(validateDesktopCaptureCase(await createCapture())).resolves.toBeUndefined();
  });

  it('rejects a capture whose payload no longer matches its hash', async () => {
    const directory = await createCapture();
    const messagesPath = join(directory, 'messages.jsonl');
    const message = JSON.parse(await readFile(messagesPath, 'utf8')) as Record<string, unknown>;
    message.sha256 = '0'.repeat(64);
    await writeFile(messagesPath, `${JSON.stringify(message)}\n`, 'utf8');

    await expect(validateDesktopCaptureCase(directory)).rejects.toThrow('hash does not match');
  });
});