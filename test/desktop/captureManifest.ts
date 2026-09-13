import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  DesktopCaptureAction,
  DesktopCaptureManifest,
  DesktopCaptureMessage,
} from '../manual/desktopCaptureHelpers';

async function readJsonLines<T>(path: string): Promise<T[]> {
  const text = await readFile(path, 'utf8');
  return text.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
}

export async function validateDesktopCaptureCase(caseDirectory: string): Promise<void> {
  const manifest = JSON.parse(
    await readFile(resolve(caseDirectory, 'manifest.json'), 'utf8'),
  ) as DesktopCaptureManifest;
  if (manifest.schemaVersion !== 1 || manifest.protocol !== 2 || manifest.transport !== 'websocket') {
    throw new Error('Desktop capture manifest has an unsupported protocol or schema.');
  }
  if (resolve(caseDirectory).split(/[\\/]/).at(-1) !== manifest.caseId) {
    throw new Error('Desktop capture case directory must match manifest.caseId.');
  }

  const messages = await readJsonLines<DesktopCaptureMessage>(resolve(caseDirectory, 'messages.jsonl'));
  const actions = await readJsonLines<DesktopCaptureAction>(resolve(caseDirectory, 'actions.jsonl'));
  await readJsonLines(resolve(caseDirectory, 'closes.jsonl'));
  const messageSeqs = new Set(messages.map((message) => message.seq));

  let expectedSeq = 1;
  for (const message of messages) {
    if (message.seq !== expectedSeq) throw new Error(`Desktop message sequence is not contiguous at ${message.seq}.`);
    expectedSeq += 1;
    if (message.kind === 'binary') {
      if (!message.payloadFile || !/^payloads\/\d{6}\.bin$/.test(message.payloadFile)) {
        throw new Error(`Desktop binary message ${message.seq} has an invalid payload reference.`);
      }
      const payloadPath = resolve(caseDirectory, message.payloadFile);
      const payload = await readFile(payloadPath);
      if ((await stat(payloadPath)).size !== message.byteLength) {
        throw new Error(`Desktop binary message ${message.seq} length does not match its payload.`);
      }
      const hash = createHash('sha256').update(payload).digest('hex');
      if (hash !== message.sha256) {
        throw new Error(`Desktop binary message ${message.seq} hash does not match its payload.`);
      }
    } else if (message.payloadFile || typeof message.text !== 'string') {
      throw new Error(`Desktop text message ${message.seq} has an invalid text payload.`);
    }
  }

  for (const action of actions) {
    const hasFirst = action.firstMessageSeq !== undefined;
    const hasLast = action.lastMessageSeq !== undefined;
    if (hasFirst !== hasLast) throw new Error(`Desktop action ${action.actionId} has a partial message range.`);
    if (hasFirst && hasLast) {
      if (!messageSeqs.has(action.firstMessageSeq!) || !messageSeqs.has(action.lastMessageSeq!)) {
        throw new Error(`Desktop action ${action.actionId} references a missing message.`);
      }
      if (action.firstMessageSeq! > action.lastMessageSeq!) {
        throw new Error(`Desktop action ${action.actionId} has a reversed message range.`);
      }
    }
  }
}