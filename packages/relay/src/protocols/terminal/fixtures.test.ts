import { describe, expect, it } from 'vitest';
import binaryFlow from '../../testing/fixtures/terminal/windows-binary-flow.json';
import handshake from '../../testing/fixtures/terminal/handshake-connected.json';
import protocolSelection from '../../testing/fixtures/terminal/protocol-selection.json';
import relaylogEnd from '../../testing/fixtures/terminal/relaylog-end.json';
import relaylogStart from '../../testing/fixtures/terminal/relaylog-start.json';
import rttRequest from '../../testing/fixtures/terminal/rtt-request.json';
import startupOptions from '../../testing/fixtures/terminal/windows-startup-options.json';
import { createTerminalOptionsMessage, createTerminalRttMessage } from './controlMessages';

describe('confirmed terminal protocol fixtures', () => {
  it('preserves the confirmed handshake and startup frame directions', () => {
    expect(handshake).toMatchObject({ direction: 'server-to-client', payload: 'c' });
    expect(startupOptions.direction).toBe('client-to-server');
    expect(createTerminalOptionsMessage(1, { cols: 120, rows: 30 })).toBe(
      JSON.stringify(startupOptions.payload),
    );
    expect(protocolSelection).toMatchObject({ direction: 'client-to-server', payload: '1' });
  });

  it('matches the confirmed RTT request shape', () => {
    expect(rttRequest.direction).toBe('client-to-server');
    expect(createTerminalRttMessage(1_000)).toEqual(rttRequest.payload);
  });

  it('records binary flow and relay audit facts without terminal content', () => {
    expect(binaryFlow).toEqual(
      expect.objectContaining({
        clientInput: { frameType: 'binary', frameLengths: [4] },
        serverOutput: { frameType: 'binary', frameLengths: [16, 96, 140] },
        rawBytesRetained: false,
      }),
    );
    expect(relaylogStart).toMatchObject({ msgid: 14, protocol: 1 });
    expect(relaylogEnd).toMatchObject({
      msgid: 10,
      protocol: 1,
      bytesin: 2049,
      bytesout: 685,
      structuredReasonAvailable: false,
    });
  });
});