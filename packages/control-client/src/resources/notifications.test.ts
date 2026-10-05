import { describe, expect, it, vi } from 'vitest';
import { MeshCentralValidationError } from '../errors';
import { ServerNotificationMask } from '../notifications/subscriptions';
import { NotificationsResource } from './notifications';

describe('NotificationsResource', () => {
  it('sends group and device subscription updates', () => {
    const send = vi.fn();
    const resource = new NotificationsResource({ send });
    const groupMask =
      ServerNotificationMask.DeviceConnected | ServerNotificationMask.EmailHelpRequest;
    resource.updateGroupSubscription('mesh//group', groupMask);
    resource.updateDeviceSubscription('node//device', ServerNotificationMask.DeviceDisconnected);
    resource.removeAcrossSessions('notification-1');
    expect(send).toHaveBeenNthCalledWith(1, {
      action: 'changemeshnotify',
      meshid: 'mesh//group',
      notify: groupMask,
    });
    expect(send).toHaveBeenNthCalledWith(2, {
      action: 'changeusernotify',
      nodeid: 'node//device',
      notify: ServerNotificationMask.DeviceDisconnected,
    });
    expect(send).toHaveBeenNthCalledWith(3, {
      action: 'intersession',
      subaction: 'removeNotify',
      id: 'notification-1',
    });
  });

  it('rejects empty ids and unsupported mask flags', () => {
    const resource = new NotificationsResource({ send: vi.fn() });
    expect(() => resource.updateGroupSubscription('', 0)).toThrow(MeshCentralValidationError);
    expect(() => resource.updateDeviceSubscription('node//device', 1024)).toThrow(
      MeshCentralValidationError,
    );
  });
});