import { describe, expect, it } from 'vitest';
import { parseProcessMessage, parseServicesMessage } from './systemManagement';

const deviceId = 'node//device';

describe('device system management messages', () => {
  it('parses stringified process maps and skips incomplete entries', () => {
    expect(parseProcessMessage({
      action: 'msg',
      type: 'ps',
      nodeid: deviceId,
      value: JSON.stringify({
        0: { pid: 0, cmd: '[System Process]' },
        868: { pid: 868, cmd: 'explorer.exe', path: 'C:\\Windows\\explorer.exe', user: 'Administrator' },
        8024: null,
      }),
    }, deviceId)).toEqual([
      { key: '0', pid: 0, command: '[System Process]', path: undefined, user: undefined },
      { key: '868', pid: 868, command: 'explorer.exe', path: 'C:\\Windows\\explorer.exe', user: 'Administrator' },
    ]);
  });

  it('parses services and ignores malformed trailing values', () => {
    expect(parseServicesMessage({
      action: 'msg',
      type: 'services',
      nodeid: deviceId,
      value: JSON.stringify([
        {
          name: 'Appinfo',
          displayName: 'Application Information',
          status: {
            rawState: 4,
            state: 'RUNNING',
            controlsAccepted: ['SERVICE_CONTROL_STOP'],
            pid: 2484,
          },
        },
        ['SERVICE_CONTROL_PRESHUTDOWN'],
      ]),
    }, deviceId)).toEqual([
      {
        name: 'Appinfo',
        displayName: 'Application Information',
        status: {
          rawState: 4,
          state: 'RUNNING',
          controlsAccepted: ['SERVICE_CONTROL_STOP'],
          pid: 2484,
        },
      },
    ]);
  });

  it('does not consume messages for another device or message type', () => {
    expect(parseProcessMessage({ action: 'msg', type: 'services', nodeid: deviceId, value: '[]' }, deviceId)).toBeUndefined();
    expect(parseServicesMessage({ action: 'msg', type: 'services', nodeid: 'node//other', value: '[]' }, deviceId)).toBeUndefined();
  });
});