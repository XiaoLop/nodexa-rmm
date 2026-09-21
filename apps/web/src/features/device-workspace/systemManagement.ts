export interface DeviceProcess {
  key: string;
  pid: number;
  command: string;
  path?: string;
  user?: string;
}

export interface DeviceServiceStatus {
  state: string;
  rawState?: number;
  pid?: number;
  controlsAccepted: string[];
}

export interface DeviceService {
  name: string;
  displayName: string;
  status: DeviceServiceStatus;
}

interface DeviceMessageEnvelope {
  action?: unknown;
  type?: unknown;
  nodeid?: unknown;
  value?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error('device-response-invalid-json');
  }
}

function readMessageValue(message: unknown, type: 'ps' | 'services', deviceId: string) {
  if (!isRecord(message)) return undefined;
  const envelope = message as DeviceMessageEnvelope;
  if (envelope.action !== 'msg' || envelope.type !== type || envelope.nodeid !== deviceId) {
    return undefined;
  }
  return parseJsonValue(envelope.value);
}

export function parseProcessMessage(message: unknown, deviceId: string): DeviceProcess[] | undefined {
  const value = readMessageValue(message, 'ps', deviceId);
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('device-process-list-invalid');

  return Object.entries(value).flatMap(([key, item]) => {
    if (!isRecord(item)) return [];
    const pid = typeof item.pid === 'number' && Number.isFinite(item.pid) ? item.pid : Number(key);
    if (!Number.isFinite(pid)) return [];
    return [{
      key,
      pid,
      command: typeof item.cmd === 'string' && item.cmd ? item.cmd : '—',
      path: typeof item.path === 'string' && item.path ? item.path : undefined,
      user: typeof item.user === 'string' && item.user ? item.user : undefined,
    }];
  });
}

export function parseServicesMessage(message: unknown, deviceId: string): DeviceService[] | undefined {
  const value = readMessageValue(message, 'services', deviceId);
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error('device-service-list-invalid');

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.name !== 'string') return [];
    const status = isRecord(item.status) ? item.status : {};
    return [{
      name: item.name,
      displayName: typeof item.displayName === 'string' && item.displayName ? item.displayName : item.name,
      status: {
        state: typeof status.state === 'string' && status.state ? status.state : 'UNKNOWN',
        rawState: typeof status.rawState === 'number' ? status.rawState : undefined,
        pid: typeof status.pid === 'number' ? status.pid : undefined,
        controlsAccepted: Array.isArray(status.controlsAccepted)
          ? status.controlsAccepted.filter((control): control is string => typeof control === 'string')
          : [],
      },
    }];
  });
}