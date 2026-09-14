import { describe, expect, it } from 'vitest';
import { createDesktopRttMessage, parseDesktopControlMessage } from './controlMessages';

describe('desktop control messages', () => {
  it('creates and parses RTT control-channel messages', () => {
    expect(createDesktopRttMessage(1_000)).toEqual({
      ctrlChannel: '102938',
      type: 'rtt',
      time: 1_000,
    });
    expect(parseDesktopControlMessage('{"ctrlChannel":102938,"type":"rtt","time":1000}')).toEqual({
      ctrlChannel: 102938,
      type: 'rtt',
      time: 1_000,
    });
  });

  it('keeps metadata and rejects unrelated control messages', () => {
    expect(
      parseDesktopControlMessage('{"ctrlChannel":"102938","type":"metadata","users":{}}'),
    ).toEqual({ ctrlChannel: '102938', type: 'metadata', users: {} });
    expect(
      parseDesktopControlMessage('{"ctrlChannel":"other","type":"rtt","time":1000}'),
    ).toBeUndefined();
    expect(parseDesktopControlMessage('{"ctrlChannel":"102938","type":"ping"}')).toBeUndefined();
  });
});
