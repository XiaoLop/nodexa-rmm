import { isFullRights, normalizeRights } from './bitmask';
import { canUseDeviceFiles, canUseTerminal, getDesktopAccess } from './capabilities';
import { hasMeshRight, MeshRight } from './meshRights';
import { hasSiteRight, isSiteAdministrator, SiteRight } from './siteRights';

export interface UiPermission {
  visible: boolean;
  enabled: boolean;
  reason?:
    | 'permission-denied'
    | 'permission-unknown'
    | 'gateway-disconnected'
    | 'device-offline'
    | 'feature-disabled'
    | 'agent-unsupported';
  message?: string;
}

export interface ServerRuntimeCapabilities {
  guestDeviceSharing?: boolean;
}

export interface DeviceRuntimeCapabilities {
  controlConnected: boolean;
  agentOnline: boolean;
  amtOnline: boolean;
  amtReady?: boolean;
  amtSku?: number;
  agentCapabilities?: number;
  isWindows: boolean;
}

export interface DeviceUiCapabilities {
  desktop: UiPermission;
  desktopInput: UiPermission;
  clipboardWrite: UiPermission;
  terminal: UiPermission;
  files: UiPermission;
  console: UiPermission;
  registry: UiPermission;
  software: UiPermission;
  command: UiPermission;
  power: UiPermission;
  wake: UiPermission;
  guestShare: UiPermission;
  uninstall: UiPermission;
  edit: UiPermission;
}

export interface DeviceGroupUiCapabilities {
  edit: UiPermission;
  remove: UiPermission;
  manageUsers: UiPermission;
  manageComputers: UiPermission;
}

export interface ApplicationUiCapabilities {
  manageUsers: boolean;
  manageUserGroups: boolean;
  viewAllEvents: boolean;
  manageSettings: boolean;
  createDeviceGroups: boolean;
  addDevices: boolean;
}

const hidden = (): UiPermission => ({ visible: false, enabled: false });

function available(
  enabled: boolean,
  reason?: UiPermission['reason'],
  message?: string,
): UiPermission {
  return {
    visible: true,
    enabled,
    reason: enabled ? undefined : reason,
    message: enabled ? undefined : message,
  };
}

function gatewayPermission(permitted: boolean, controlConnected: boolean): UiPermission {
  if (!permitted) return hidden();
  return available(controlConnected, 'gateway-disconnected', '控制通道未连接');
}

function runtimePermission(
  permitted: boolean,
  runtime: DeviceRuntimeCapabilities,
  online: boolean,
  supported = true,
): UiPermission {
  if (!permitted) return hidden();
  if (!runtime.controlConnected)
    return available(false, 'gateway-disconnected', '控制通道未连接');
  if (!online) return available(false, 'device-offline', '设备当前离线');
  if (!supported) return available(false, 'agent-unsupported', '设备 Agent 不支持此功能');
  return available(true);
}

function hasAgentCapability(runtime: DeviceRuntimeCapabilities, capability: number): boolean {
  return (
    runtime.agentCapabilities !== undefined &&
    (runtime.agentCapabilities & capability) !== 0
  );
}

function hasAmtCapability(runtime: DeviceRuntimeCapabilities, capability: number): boolean {
  return runtime.amtSku !== undefined && (runtime.amtSku & capability) !== 0;
}

export function getDeviceUiCapabilities(
  rights: number | undefined,
  runtime: DeviceRuntimeCapabilities,
  server: ServerRuntimeCapabilities = {},
): DeviceUiCapabilities {
  if (rights === undefined) {
    const unknown = available(false, 'permission-unknown', '正在确认设备权限');
    return {
      desktop: unknown,
      desktopInput: unknown,
      clipboardWrite: unknown,
      terminal: unknown,
      files: unknown,
      console: unknown,
      registry: unknown,
      software: unknown,
      command: unknown,
      power: unknown,
      wake: unknown,
      guestShare: unknown,
      uninstall: unknown,
      edit: unknown,
    };
  }

  const normalized = normalizeRights(rights);
  const administrator = isFullRights(normalized);
  const desktopAccess = getDesktopAccess(normalized);
  const desktopSupported =
    hasAgentCapability(runtime, 1) ||
    (hasAmtCapability(runtime, 8) && runtime.amtReady !== false);
  const terminalSupported = hasAgentCapability(runtime, 2) || runtime.amtReady === true;
  const desktopOnline =
    (runtime.agentOnline && hasAgentCapability(runtime, 1)) ||
    (runtime.amtOnline && hasAmtCapability(runtime, 8) && runtime.amtReady !== false);
  const terminalOnline =
    (runtime.agentOnline && hasAgentCapability(runtime, 2)) ||
    (runtime.amtOnline && runtime.amtReady === true);

  return {
    desktop: desktopSupported
      ? runtimePermission(desktopAccess !== 'denied', runtime, desktopOnline)
      : hidden(),
    desktopInput: desktopSupported
      ? runtimePermission(
          desktopAccess === 'control' || desktopAccess === 'limited-input',
          runtime,
          desktopOnline,
        )
      : hidden(),
    clipboardWrite: hasAgentCapability(runtime, 1)
      ? runtimePermission(desktopAccess === 'control', runtime, runtime.agentOnline)
      : hidden(),
    terminal: terminalSupported
      ? runtimePermission(canUseTerminal(normalized), runtime, terminalOnline)
      : hidden(),
    files: hasAgentCapability(runtime, 4)
      ? runtimePermission(canUseDeviceFiles(normalized), runtime, runtime.agentOnline)
      : hidden(),
    console: hasAgentCapability(runtime, 8)
      ? runtimePermission(
          administrator || hasMeshRight(normalized, MeshRight.AgentConsole),
          runtime,
          runtime.agentOnline,
        )
      : hidden(),
    registry:
      runtime.isWindows && runtime.agentCapabilities !== undefined
        ? runtimePermission(
            administrator ||
              (hasMeshRight(normalized, MeshRight.RemoteControl) &&
                !hasMeshRight(normalized, MeshRight.NoRegistry)),
            runtime,
            runtime.agentOnline,
          )
        : hidden(),
    software: runtimePermission(
      administrator ||
        (hasMeshRight(normalized, MeshRight.RemoteControl) &&
          !hasMeshRight(normalized, MeshRight.NoSoftware)),
      runtime,
      runtime.agentOnline,
    ),
    command: runtimePermission(
      administrator || hasMeshRight(normalized, MeshRight.RemoteCommand),
      runtime,
      runtime.agentOnline,
    ),
    power: runtimePermission(
      administrator || hasMeshRight(normalized, MeshRight.ResetOff),
      runtime,
      runtime.agentOnline || runtime.amtOnline,
    ),
    wake: gatewayPermission(
      administrator || hasMeshRight(normalized, MeshRight.WakeDevice),
      runtime.controlConnected,
    ),
    guestShare:
      server.guestDeviceSharing === false
        ? available(false, 'feature-disabled', '服务器未启用访客分享')
        : gatewayPermission(
            administrator || hasMeshRight(normalized, MeshRight.GuestSharing),
            runtime.controlConnected,
          ),
    uninstall: runtimePermission(
      administrator || hasMeshRight(normalized, MeshRight.Uninstall),
      runtime,
      runtime.agentOnline,
    ),
    edit: gatewayPermission(
      administrator || hasMeshRight(normalized, MeshRight.ManageComputers),
      runtime.controlConnected,
    ),
  };
}

export function getDeviceGroupUiCapabilities(
  rights: number | undefined,
  controlConnected: boolean,
): DeviceGroupUiCapabilities {
  if (rights === undefined) {
    const unknown = available(false, 'permission-unknown', '正在确认设备组权限');
    return {
      edit: unknown,
      remove: unknown,
      manageUsers: unknown,
      manageComputers: unknown,
    };
  }

  const normalized = normalizeRights(rights);
  const administrator = isFullRights(normalized);
  return {
    edit: gatewayPermission(
      administrator || hasMeshRight(normalized, MeshRight.EditMesh),
      controlConnected,
    ),
    remove: gatewayPermission(
      administrator || hasMeshRight(normalized, MeshRight.EditMesh),
      controlConnected,
    ),
    manageUsers: gatewayPermission(
      administrator || hasMeshRight(normalized, MeshRight.ManageUsers),
      controlConnected,
    ),
    manageComputers: gatewayPermission(
      administrator || hasMeshRight(normalized, MeshRight.ManageComputers),
      controlConnected,
    ),
  };
}

export function getApplicationUiCapabilities(
  siteRights: number | undefined,
): ApplicationUiCapabilities {
  if (siteRights === undefined) {
    return {
      manageUsers: false,
      manageUserGroups: false,
      viewAllEvents: false,
      manageSettings: false,
      createDeviceGroups: false,
      addDevices: false,
    };
  }
  const normalized = normalizeRights(siteRights);
  const administrator = isSiteAdministrator(normalized);
  return {
    manageUsers: administrator || hasSiteRight(normalized, SiteRight.ManageUsers),
    manageUserGroups: administrator || hasSiteRight(normalized, SiteRight.ManageUserGroups),
    viewAllEvents: administrator || hasSiteRight(normalized, SiteRight.AllEvents),
    manageSettings: administrator,
    createDeviceGroups: administrator || !hasSiteRight(normalized, SiteRight.NoNewGroups),
    addDevices: administrator || !hasSiteRight(normalized, SiteRight.NoNewDevices),
  };
}
