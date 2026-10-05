import { MeshCentralValidationError } from '../errors';
import { normalizeServerNotificationMask } from '../notifications/subscriptions';

interface ResourceClient {
  send(payload: unknown): void;
}

function required(value: string, name: string): void {
  if (!value.trim()) throw new MeshCentralValidationError(`${name} is required.`);
}

export class NotificationsResource {
  constructor(private readonly client: ResourceClient) {}

  updateGroupSubscription(groupId: string, mask: number): void {
    required(groupId, 'Group ID');
    this.client.send({
      action: 'changemeshnotify',
      meshid: groupId,
      notify: normalizeServerNotificationMask(mask),
    });
  }

  updateDeviceSubscription(deviceId: string, mask: number): void {
    required(deviceId, 'Device ID');
    this.client.send({
      action: 'changeusernotify',
      nodeid: deviceId,
      notify: normalizeServerNotificationMask(mask),
    });
  }

  removeAcrossSessions(id: string): void {
    required(id, 'Notification ID');
    this.client.send({ action: 'intersession', subaction: 'removeNotify', id });
  }
}