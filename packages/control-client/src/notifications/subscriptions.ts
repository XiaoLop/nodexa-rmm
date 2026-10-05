import { MeshCentralValidationError } from '../errors';

export const enum LocalNotificationMask {
  Sound = 1,
  DeviceConnected = 2,
  DeviceDisconnected = 4,
  IntelAmt = 8,
  ShowGroupName = 16,
}

export const enum ServerNotificationMask {
  DeviceConnected = 2,
  DeviceDisconnected = 4,
  IntelAmt = 8,
  EmailConnected = 16,
  EmailDisconnected = 32,
  EmailHelpRequest = 64,
  MessagingConnected = 128,
  MessagingDisconnected = 256,
  MessagingHelpRequest = 512,
}

export const SERVER_NOTIFICATION_MASK =
  ServerNotificationMask.DeviceConnected |
  ServerNotificationMask.DeviceDisconnected |
  ServerNotificationMask.IntelAmt |
  ServerNotificationMask.EmailConnected |
  ServerNotificationMask.EmailDisconnected |
  ServerNotificationMask.EmailHelpRequest |
  ServerNotificationMask.MessagingConnected |
  ServerNotificationMask.MessagingDisconnected |
  ServerNotificationMask.MessagingHelpRequest;

export function normalizeServerNotificationMask(mask: number): number {
  if (!Number.isInteger(mask) || mask < 0 || mask > SERVER_NOTIFICATION_MASK) {
    throw new MeshCentralValidationError('Notification mask contains an unsupported value.');
  }
  if ((mask & ~SERVER_NOTIFICATION_MASK) !== 0) {
    throw new MeshCentralValidationError('Notification mask contains unsupported flags.');
  }
  return mask;
}