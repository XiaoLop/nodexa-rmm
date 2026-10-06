import { MeshRight, type DeviceUiCapabilities } from '@meshcentral/control-client';
import { describe, expect, it } from 'vitest';
import { createDeviceWorkspaceModel } from '../../features/device-workspace/deviceWorkspaceModel';
import { workspaceTabPermission } from './WorkspaceTabs';

const hidden = { visible: false, enabled: false };
const enabled = { visible: true, enabled: true };

function capabilities(overrides: Partial<DeviceUiCapabilities> = {}): DeviceUiCapabilities {
  return {
    desktop: hidden,
    desktopInput: hidden,
    clipboardWrite: hidden,
    terminal: hidden,
    files: hidden,
    console: hidden,
    registry: hidden,
    software: hidden,
    command: hidden,
    power: hidden,
    wake: hidden,
    guestShare: hidden,
    uninstall: hidden,
    edit: hidden,
    ...overrides,
  };
}

describe('workspaceTabPermission', () => {
  it('keeps a feature hidden when the user does not have access', () => {
    const model = createDeviceWorkspaceModel({
      id: 'restricted',
      name: 'Restricted',
      online: true,
      effectiveRights: MeshRight.NoFiles,
    });

    expect(workspaceTabPermission('files', capabilities(), {
      model,
      remoteControlAllowed: false,
      agentPresent: false,
      controlConnected: true,
    })).toEqual(hidden);
  });

  it('keeps an authorized but unsupported feature visible and disabled', () => {
    const model = createDeviceWorkspaceModel({
      id: 'unsupported',
      name: 'Unsupported',
      online: true,
      effectiveRights: MeshRight.RemoteControl,
    });

    expect(workspaceTabPermission('files', capabilities(), {
      model,
      remoteControlAllowed: true,
      agentPresent: false,
      controlConnected: true,
    })).toEqual({ visible: true, enabled: false, reason: 'agent-unsupported' });
  });

  it('explains why process management is unavailable', () => {
    const model = createDeviceWorkspaceModel({
      id: 'processes',
      name: 'Processes',
      online: true,
      effectiveRights: MeshRight.RemoteControl,
    });

    expect(workspaceTabPermission('processes', capabilities(), {
      model,
      remoteControlAllowed: true,
      agentPresent: false,
      controlConnected: true,
    })).toMatchObject({ visible: true, enabled: false, reason: 'agent-unsupported' });
    expect(workspaceTabPermission('processes', capabilities(), {
      model,
      remoteControlAllowed: true,
      agentPresent: true,
      controlConnected: false,
    })).toMatchObject({ visible: true, enabled: false, reason: 'gateway-disconnected' });
  });

  it('preserves runtime capability results when the feature is supported', () => {
    const model = createDeviceWorkspaceModel({
      id: 'desktop',
      name: 'Desktop',
      online: true,
      effectiveRights: MeshRight.RemoteControl,
    });

    expect(workspaceTabPermission('desktop', capabilities({ desktop: enabled }), {
      model,
      remoteControlAllowed: true,
      agentPresent: true,
      controlConnected: true,
    })).toEqual(enabled);
  });
});