import { describe, expect, it } from 'vitest';
import { MeshRight } from './meshRights';
import { SiteRight } from './siteRights';
import {
  getApplicationUiCapabilities,
  getDeviceGroupUiCapabilities,
  getDeviceUiCapabilities,
} from './uiCapabilities';

const onlineRuntime = {
  controlConnected: true,
  agentOnline: true,
  amtOnline: false,
  agentCapabilities: 1 | 2 | 4 | 8,
  isWindows: true,
};

describe('getDeviceUiCapabilities', () => {
  it('hides operations without the required device rights', () => {
    const capabilities = getDeviceUiCapabilities(MeshRight.RemoteControl, onlineRuntime);

    expect(capabilities.desktop).toMatchObject({ visible: true, enabled: true });
    expect(capabilities.terminal).toMatchObject({ visible: true, enabled: true });
    expect(capabilities.command).toEqual({ visible: false, enabled: false });
    expect(capabilities.edit).toEqual({ visible: false, enabled: false });
  });

  it('keeps permitted operations visible but disabled while offline', () => {
    const capabilities = getDeviceUiCapabilities(MeshRight.RemoteCommand | MeshRight.ResetOff, {
      ...onlineRuntime,
      agentOnline: false,
    });

    expect(capabilities.command).toEqual({
      visible: true,
      enabled: false,
      reason: 'device-offline',
      message: '设备当前离线',
    });
    expect(capabilities.power.enabled).toBe(false);
  });

  it('applies desktop and file restriction bits', () => {
    const capabilities = getDeviceUiCapabilities(
      MeshRight.RemoteControl | MeshRight.RemoteViewOnly | MeshRight.NoFiles | MeshRight.NoTerminal,
      onlineRuntime,
    );

    expect(capabilities.desktop.visible).toBe(true);
    expect(capabilities.desktopInput.visible).toBe(false);
    expect(capabilities.clipboardWrite.visible).toBe(false);
    expect(capabilities.terminal.visible).toBe(false);
    expect(capabilities.files.visible).toBe(false);
  });

  it('hides features that the device does not advertise', () => {
    const capabilities = getDeviceUiCapabilities(MeshRight.RemoteControl, {
      ...onlineRuntime,
      agentCapabilities: 1 | 2,
    });

    expect(capabilities.desktop).toMatchObject({ visible: true, enabled: true });
    expect(capabilities.terminal).toMatchObject({ visible: true, enabled: true });
    expect(capabilities.files).toEqual({ visible: false, enabled: false });
    expect(capabilities.console).toEqual({ visible: false, enabled: false });
  });

  it('uses activated Intel AMT capabilities for desktop and terminal visibility', () => {
    const capabilities = getDeviceUiCapabilities(MeshRight.RemoteControl, {
      ...onlineRuntime,
      agentOnline: false,
      amtOnline: true,
      amtReady: true,
      amtSku: 8,
      agentCapabilities: undefined,
    });

    expect(capabilities.desktop).toMatchObject({ visible: true, enabled: true });
    expect(capabilities.terminal).toMatchObject({ visible: true, enabled: true });
    expect(capabilities.files).toEqual({ visible: false, enabled: false });
  });

  it('hides desktop when AMT does not include KVM support', () => {
    const capabilities = getDeviceUiCapabilities(MeshRight.RemoteControl, {
      ...onlineRuntime,
      agentOnline: false,
      amtOnline: true,
      amtReady: true,
      amtSku: 16,
      agentCapabilities: undefined,
    });

    expect(capabilities.desktop).toEqual({ visible: false, enabled: false });
    expect(capabilities.terminal).toMatchObject({ visible: true, enabled: true });
  });

  it('disables guest sharing when the server explicitly disables it', () => {
    const capabilities = getDeviceUiCapabilities(MeshRight.GuestSharing, onlineRuntime, {
      guestDeviceSharing: false,
    });
    expect(capabilities.guestShare).toEqual({
      visible: true,
      enabled: false,
      reason: 'feature-disabled',
      message: '服务器未启用访客分享',
    });
  });
});

describe('getDeviceGroupUiCapabilities', () => {
  it('maps device-group management rights to operations', () => {
    const capabilities = getDeviceGroupUiCapabilities(
      MeshRight.EditMesh | MeshRight.ManageComputers,
      true,
    );

    expect(capabilities.edit).toMatchObject({ visible: true, enabled: true });
    expect(capabilities.remove).toMatchObject({ visible: true, enabled: true });
    expect(capabilities.manageComputers).toMatchObject({ visible: true, enabled: true });
    expect(capabilities.manageUsers).toEqual({ visible: false, enabled: false });
  });

  it('fails closed while rights are unknown', () => {
    expect(getDeviceGroupUiCapabilities(undefined, true).edit).toMatchObject({
      visible: true,
      enabled: false,
      reason: 'permission-unknown',
    });
  });

  it('keeps allowed operations disabled while disconnected', () => {
    expect(getDeviceGroupUiCapabilities(MeshRight.EditMesh, false).edit).toMatchObject({
      visible: true,
      enabled: false,
      reason: 'gateway-disconnected',
    });
  });
});

describe('getApplicationUiCapabilities', () => {
  it('fails closed while site rights are unknown', () => {
    expect(Object.values(getApplicationUiCapabilities(undefined))).not.toContain(true);
  });

  it('derives management routes from site rights', () => {
    const capabilities = getApplicationUiCapabilities(
      SiteRight.ManageUsers | SiteRight.ManageUserGroups | SiteRight.NoNewDevices,
    );

    expect(capabilities.manageUsers).toBe(true);
    expect(capabilities.manageUserGroups).toBe(true);
    expect(capabilities.manageSettings).toBe(false);
    expect(capabilities.addDevices).toBe(false);
    expect(capabilities.createDeviceGroups).toBe(true);
  });

  it('restricts server status to site administrators', () => {
    expect(getApplicationUiCapabilities(0).manageSettings).toBe(false);
    expect(getApplicationUiCapabilities(SiteRight.Administrator).manageSettings).toBe(true);
  });

  it('derives report access from site rights', () => {
    const regular = getApplicationUiCapabilities(0);
    const eventViewer = getApplicationUiCapabilities(SiteRight.AllEvents);
    const administrator = getApplicationUiCapabilities(SiteRight.Administrator);

    expect(regular.viewUserTrafficReports).toBe(false);
    expect(regular.viewDatabaseRecordReports).toBe(false);
    expect(eventViewer.viewUserTrafficReports).toBe(true);
    expect(eventViewer.viewDatabaseRecordReports).toBe(false);
    expect(administrator.viewUserTrafficReports).toBe(true);
    expect(administrator.viewDatabaseRecordReports).toBe(true);
  });

  it('grants all application capabilities to a site administrator', () => {
    expect(Object.values(getApplicationUiCapabilities(SiteRight.Administrator))).not.toContain(
      false,
    );
  });
});
