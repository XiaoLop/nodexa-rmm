import { describe, expect, it } from 'vitest';
import { decodePush, inspectConnectionMessage, requiredConnectionSignals } from './codec';

describe('MeshCentral control connection inspection', () => {
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

  it('decodes server statistics pushes', () => {
    expect(
      decodePush({
        action: 'serverstats',
        totalmem: 3669323776,
        freemem: 1795055616,
        cpuavg: [0.02, 0.05, 0.06],
        availablemem: 1795055616,
        values: {
          ServerState: {
            UserAccounts: 6,
            DeviceGroups: 13,
            AgentSessions: 74,
            ConnectedUsers: 1,
            UsersSessions: 3,
            RelaySessions: 0,
            RelayCount: 0,
            ConnectedIntelAMT: 0,
            ConnectedIntelAMTCira: 0,
          },
        },
      }),
    ).toMatchObject({
      serverStats: {
        totalMemory: 3669323776,
        freeMemory: 1795055616,
        availableMemory: 1795055616,
        cpuAverage: [0.02, 0.05, 0.06],
        serverState: {
          userAccounts: 6,
          deviceGroups: 13,
          agentSessions: 74,
          connectedUsers: 1,
          userSessions: 3,
        },
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
