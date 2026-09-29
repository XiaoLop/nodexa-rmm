import {
  MeshPlugin,
  PluginHook,
} from '../../decorators/plugin.drcorator.js';
import type {
  MeshCentralCommand,
  MeshCentralConnection,
  MeshCentralDomain,
  MeshCentralServer,
  MeshCentralServerActionContext,
  MeshCentralUser,
} from '../../types/meshcentral.types.js';

const SETTINGS_LOCKED = 0x00000400;

export interface TwoFactorMethodCapability {
  enabled: boolean;
  canConfigure: boolean;
  configured: boolean;
}

export interface TwoFactorCapabilities {
  supported: boolean;
  locked: boolean;
  forced: boolean;
  domainId: string;
  maxFidoKeys: number | null;
  messagingProviders: number;
  methods: {
    totp: TwoFactorMethodCapability;
    webauthn: TwoFactorMethodCapability;
    email: TwoFactorMethodCapability;
    sms: TwoFactorMethodCapability;
    messaging: TwoFactorMethodCapability;
    duo: TwoFactorMethodCapability;
    devicePush: TwoFactorMethodCapability;
    backupCodes: TwoFactorMethodCapability;
  };
}

function methodCapability(
  enabled: boolean,
  mutable: boolean,
  userReady = true,
  configured = false,
): TwoFactorMethodCapability {
  return { enabled, canConfigure: enabled && mutable && userReady, configured };
}

@MeshPlugin()
export class UtilsPlugin {
  constructor(private readonly meshServer: MeshCentralServer) {}

  @PluginHook('server_startup')
  serverStartup(): void {
    console.log('[utils] Plugin started');
  }

  @PluginHook('serveraction')
  serverAction(
    command: MeshCentralCommand,
    connection: MeshCentralConnection,
    _server: MeshCentralServerActionContext,
  ): void {
    void _server;
    if (
      command.action !== 'plugin' ||
      command.plugin !== 'utils' ||
      command.subAction !== 'getTwoFactorCapabilities'
    ) {
      return;
    }

    const user = connection.user;
    const domain = connection.domain;
    if (user == null || domain == null) {
      connection.send({
        action: 'plugin',
        plugin: 'utils',
        subAction: command.subAction,
        requestId: command.requestId,
        success: false,
        error: 'AUTHENTICATED_USER_REQUIRED',
      });
      return;
    }

    connection.send({
      action: 'plugin',
      plugin: 'utils',
      subAction: command.subAction,
      requestId: command.requestId,
      success: true,
      capabilities: this.getTwoFactorCapabilities(domain, user),
    });
  }

  getTwoFactorCapabilities(
    domain: MeshCentralDomain,
    user: MeshCentralUser,
  ): TwoFactorCapabilities {
    const requirements = domain.passwordrequirements ?? {};
    const commonName = this.meshServer.certificates?.CommonName;
    const supported =
      this.meshServer.config?.settings?.no2factorauth !== true &&
      domain.auth !== 'sspi' &&
      typeof commonName === 'string' &&
      commonName.includes('.');
    const locked =
      requirements.lock2factor === true ||
      (user.siteadmin !== 0xffffffff &&
        ((user.siteadmin ?? 0) & SETTINGS_LOCKED) !== 0);
    const mutable = supported && !locked;
    const messagingProviders = this.meshServer.msgserver?.providers ?? 0;
    const maxFidoKeys = requirements.maxfidokeys ?? null;
    const fidoKeyCount = user.otphkeys?.length ?? 0;
    const webAuthnKeyCount =
      user.otphkeys?.filter((key) => key.type === 3).length ?? 0;
    const emailEnabled =
      supported &&
      domain.mailserver != null &&
      requirements.email2factor !== false;
    const smsEnabled =
      supported &&
      this.meshServer.smsserver != null &&
      requirements.sms2factor !== false;
    const messagingEnabled =
      supported &&
      messagingProviders !== 0 &&
      requirements.msg2factor !== false;
    const duo = domain.duo2factor;
    const duoEnabled =
      supported &&
      requirements.duo2factor !== false &&
      typeof duo === 'object' &&
      duo != null &&
      typeof duo.integrationkey === 'string' &&
      typeof duo.secretkey === 'string' &&
      typeof duo.apihostname === 'string';

    return {
      supported,
      locked,
      forced: requirements.force2factor === true,
      domainId: domain.id,
      maxFidoKeys,
      messagingProviders,
      methods: {
        totp: methodCapability(
          supported && requirements.otp2factor !== false,
          mutable,
          true,
          typeof user.otpsecret === 'string' && user.otpsecret.length > 0,
        ),
        webauthn: methodCapability(
          supported,
          mutable,
          webAuthnKeyCount > 0 || maxFidoKeys == null || fidoKeyCount < maxFidoKeys,
          webAuthnKeyCount > 0,
        ),
        email: methodCapability(
          emailEnabled,
          mutable,
          typeof user.email === 'string' && user.emailVerified === true,
          user.otpekey != null,
        ),
        sms: methodCapability(
          smsEnabled,
          mutable,
          typeof user.phone === 'string',
        ),
        messaging: methodCapability(
          messagingEnabled,
          mutable,
          typeof user.msghandle === 'string',
        ),
        duo: methodCapability(duoEnabled, mutable),
        devicePush: methodCapability(
          supported &&
            this.meshServer.firebase != null &&
            requirements.push2factor !== false,
          mutable,
        ),
        backupCodes: methodCapability(
          supported && requirements.backupcode2factor !== false,
          mutable,
          true,
          user.otpkeys?.keys?.some((key) => key.u === true) === true,
        ),
      },
    };
  }
}