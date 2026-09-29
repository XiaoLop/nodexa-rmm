import {
  getApplicationUiCapabilities,
  getDeviceUiCapabilities,
  resolveEffectiveDeviceRights,
  type ApplicationUiCapabilities,
  type Device,
  type DeviceGroup,
  type DeviceUiCapabilities,
  type ServerInfo,
  type UserInfo,
} from '@meshcentral/control-client';
import { useMeshCentralControlData } from '../gateway/useMeshCentralControlData';

export type ApplicationCapability = keyof ApplicationUiCapabilities;

export function useApplicationUiCapabilities(): ApplicationUiCapabilities {
  const { userInfo } = useMeshCentralControlData();
  return getApplicationUiCapabilities(userInfo?.siteadmin);
}

export function getDeviceCapabilities(
  device: Device,
  controlConnected: boolean,
  context?: { group?: DeviceGroup; userInfo?: UserInfo; serverInfo?: ServerInfo },
): DeviceUiCapabilities {
  const connectionFlags = device.connectionFlags ?? (device.online ? 1 : 0);
  const rights = resolveEffectiveDeviceRights(device, context?.group, context?.userInfo);
  return getDeviceUiCapabilities(
    rights,
    {
      controlConnected,
      agentOnline: (connectionFlags & 1) !== 0,
      amtOnline: (connectionFlags & 6) !== 0,
      amtReady: device.amtState === undefined || device.amtState === 2,
      agentCapabilities: device.agentCapabilities,
      isWindows: device.isWindows ?? /win/i.test(device.platform ?? ''),
    },
    { guestDeviceSharing: context?.serverInfo?.guestDeviceSharing },
  );
}
