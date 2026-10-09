function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function connectionFlags(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value);
  return undefined;
}

export function normalizeDeviceRouteId(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function deviceOnlineFromMessage(
  message: unknown,
  deviceId: string,
): boolean | undefined {
  const envelope = record(message);
  if (!envelope) return undefined;
  const event = record(envelope.event) ?? envelope;
  const eventDevice = record(event.device);
  const node = record(event.node);
  const eventDeviceId =
    stringValue(event.nodeid) ??
    stringValue(event.deviceId) ??
    stringValue(node?._id) ??
    stringValue(eventDevice?._id);
  if (eventDeviceId !== deviceId) return undefined;

  const action = stringValue(event.action)?.toLowerCase();
  if (action === 'nodedisconnect' || action === 'disconnect' || action === 'disconnected') {
    return false;
  }
  if (action !== 'nodeconnect' && action !== 'connect' && action !== 'connected') {
    return undefined;
  }

  const flags = connectionFlags(event.conn ?? node?.conn ?? eventDevice?.conn);
  return flags === undefined ? true : (flags & 1) !== 0;
}