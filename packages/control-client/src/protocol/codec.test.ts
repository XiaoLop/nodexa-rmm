import { describe, expect, it } from 'vitest';
import { decodePush, inspectConnectionMessage, requiredConnectionSignals } from './codec';

describe('gateway connection inspection', () => {
  it('treats serverinfo and userinfo as the required legacy connection signals', () => {
    expect(requiredConnectionSignals).toEqual(['serverinfo', 'userinfo']);
    expect(inspectConnectionMessage({ action: 'serverinfo' })).toEqual({
      status: 'pending',
      signal: 'serverinfo',
    });
    expect(
      inspectConnectionMessage({ action: 'userinfo', userinfo: { _id: 'user//operator' } }),
    ).toEqual({ status: 'pending', signal: 'userinfo' });
  });

  it('decodes server information for downstream capability checks', () => {
    expect(
      decodePush({
        action: 'serverinfo',
        features: -1,
        features2: 2,
        guestdevicesharing: 1,
        managealldevicegroups: true,
      }),
    ).toMatchObject({
      serverInfo: {
        features: 0xffffffff,
        features2: 2,
        guestDeviceSharing: true,
        manageAllDeviceGroups: true,
      },
    });
  });

  it('still accepts and rejects explicit authentication results', () => {
    expect(inspectConnectionMessage({ type: 'authenticated' })).toEqual({ status: 'accepted' });
    expect(inspectConnectionMessage({ type: 'authenticationFailed', message: 'Denied' })).toEqual({
      status: 'rejected',
      error: 'Denied',
    });
  });
});