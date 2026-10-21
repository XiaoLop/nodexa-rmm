import type { Device, DeviceGroup, MeshCentralEvent } from './types';

/**
 * Semantic category of a normalized event message.
 *
 * The category is language-neutral: presentation layers decide how to render it,
 * including any wording and interpolation parameters.
 */
export type EventMessageKind =
  | 'deviceOnline'
  | 'deviceOffline'
  | 'deviceChanged'
  | 'deviceRemoved'
  | 'unknown'
  | 'raw';

export interface RedactedEventMessage {
  kind: EventMessageKind;
  /**
   * Server message with `node//`, `mesh//` and `user//` identifiers replaced.
   *
   * Known identifiers become display names; unknown ones become {@link REDACTED_ID}.
   * This keeps identifiers out of the UI without introducing presentation text.
   */
  text: string;
  /** Original event type, useful when {@link RedactedEventMessage.kind} is `unknown`. */
  eventType: MeshCentralEvent['type'];
}

/** Language-neutral placeholder used when an identifier cannot be resolved to a name. */
export const REDACTED_ID = '…';

/**
 * 判断字符串是否看起来像 Node/Mesh/User 的 ID
 * 例如: node//..., mesh//..., user//...
 */
export function isIdString(str?: string): boolean {
  if (!str) return false;
  return /^(node|mesh|user)\/\//i.test(str.trim());
}

/**
 * 获取事件目标节点的显示名称
 * 如果 event.deviceName 为有效节点名称且非 ID，优先返回；
 * 否则尝试从 devices 列表中根据 deviceId 找到对应的节点名称；
 * 若解析出的名称为 ID，则返回 undefined（绝不泄漏 ID）。
 */
export function getEventTargetName(
  event: MeshCentralEvent,
  devices?: Device[] | Record<string, Device>,
): string | undefined {
  if (event.deviceName && !isIdString(event.deviceName)) {
    return event.deviceName;
  }

  if (event.deviceId && devices) {
    const devMap = Array.isArray(devices)
      ? Object.fromEntries(devices.map((d) => [d.id, d]))
      : devices;
    const dev = devMap[event.deviceId];
    if (dev?.name && !isIdString(dev.name)) {
      return dev.name;
    }
  }

  return undefined;
}

function toDeviceMap(devices?: Device[] | Record<string, Device>): Record<string, Device> {
  if (!devices) return {};
  return Array.isArray(devices) ? Object.fromEntries(devices.map((d) => [d.id, d])) : devices;
}

function toGroupMap(
  groups?: DeviceGroup[] | Record<string, DeviceGroup>,
): Record<string, DeviceGroup> {
  if (!groups) return {};
  return Array.isArray(groups)
    ? Object.fromEntries(groups.map((g) => [g.id, g]))
    : groups;
}

function detectEventMessageKind(
  event: MeshCentralEvent,
  rawMessage: string,
): EventMessageKind {
  if (event.type === 'deviceOnline' || /^(nodeconnect|connected)$/i.test(rawMessage)) {
    return 'deviceOnline';
  }
  if (event.type === 'deviceOffline' || /^(nodedisconnect|disconnected)$/i.test(rawMessage)) {
    return 'deviceOffline';
  }
  if (event.type === 'deviceChanged' || /^changenode$/i.test(rawMessage)) {
    return 'deviceChanged';
  }
  if (event.type === 'deviceRemoved' || /^(removenode|deletenode)$/i.test(rawMessage)) {
    return 'deviceRemoved';
  }
  return rawMessage ? 'raw' : 'unknown';
}

/**
 * Normalizes an event message for display without embedding any localized wording.
 *
 * 1. Classifies the message (`deviceOnline`, `raw`, `unknown`, …).
 * 2. Replaces `node//…` with the device name, `mesh//…` with the device group name,
 *    and `user//…` with the user name.
 * 3. Falls back to {@link REDACTED_ID} so raw identifiers never reach the UI.
 *
 * Presentation layers (web, mobile) map {@link RedactedEventMessage.kind} to their own
 * translation keys and interpolate the resolved name.
 */
export function redactEventMessage(
  event: MeshCentralEvent,
  devices?: Device[] | Record<string, Device>,
  groups?: DeviceGroup[] | Record<string, DeviceGroup>,
): RedactedEventMessage {
  const rawMessage = (event.message || '').trim();
  const deviceMap = toDeviceMap(devices);
  const groupMap = toGroupMap(groups);

  const text = rawMessage
    .replace(/node\/\/([a-zA-Z0-9_\-./]+)/gi, (fullMatch) => {
      const device = deviceMap[fullMatch];
      if (device?.name && !isIdString(device.name)) {
        return device.name;
      }
      if (
        event.deviceId === fullMatch &&
        event.deviceName &&
        !isIdString(event.deviceName)
      ) {
        return event.deviceName;
      }
      return REDACTED_ID;
    })
    .replace(/mesh\/\/([a-zA-Z0-9_\-./]+)/gi, (fullMatch) => {
      const group = groupMap[fullMatch];
      if (group?.name && !isIdString(group.name)) {
        return group.name;
      }
      return REDACTED_ID;
    })
    .replace(/user\/\/([a-zA-Z0-9_\-./]+)/gi, '$1');

  return {
    kind: detectEventMessageKind(event, rawMessage),
    text,
    eventType: event.type,
  };
}

/**
 * @deprecated Use {@link redactEventMessage} and localize the `kind` in the presentation
 * layer. This compatibility shim returns the redacted server message without any
 * Chinese wording and will be removed in a future major version.
 */
export function formatEventMessage(
  event: MeshCentralEvent,
  devices?: Device[] | Record<string, Device>,
  groups?: DeviceGroup[] | Record<string, DeviceGroup>,
): string {
  return redactEventMessage(event, devices, groups).text || '—';
}
