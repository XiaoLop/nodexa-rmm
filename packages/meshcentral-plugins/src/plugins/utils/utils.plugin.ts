import {
  MeshPlugin,
  PluginHook,
} from '../../decorators/plugin.drcorator.js';
import type {
  MeshCentralAgentConnection,
  MeshCentralAgentServer,
  MeshCentralCommand,
  MeshCentralConnection,
  MeshCentralDomain,
  MeshCentralServer,
  MeshCentralServerActionContext,
  MeshCentralUser,
} from '../../types/meshcentral.types.js';
import { publicIp } from './services/geo-ip-location.service.js';
import type { GeoIpLocation, GeoIpLocationLookup, MeshCentralNodeDocument } from './utils.types.js';

const SETTINGS_LOCKED = 0x00000400;
const LOCATION_COMPARE_FIELDS = [
  'lookupIp',
  'countryCode',
  'subdivisionCode',
  'countryNames',
  'regionNames',
  'cityNames',
  'latitude',
  'longitude',
  'timezone',
  'source',
] as const satisfies readonly (keyof GeoIpLocation)[];

function sameLocation(current: Partial<GeoIpLocation> | undefined, next: GeoIpLocation): boolean {
  if (!current) return false;
  return LOCATION_COMPARE_FIELDS.every(
    (field) => JSON.stringify(current[field]) === JSON.stringify(next[field]),
  );
}

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
  private readonly pendingLocationUpdates = new Map<string, Promise<void>>();

  constructor(
    private readonly meshServer: MeshCentralServer,
    private readonly geoIpLocation: GeoIpLocationLookup,
  ) {}

  @PluginHook('server_startup')
  serverStartup(): void {
    console.log('[utils] Plugin started');
  }

  @PluginHook('hook_agentCoreIsStable')
  agentCoreIsStable(agent: MeshCentralAgentConnection, agentServer: MeshCentralAgentServer): void {
    const nodeId = agent.dbNodeKey;
    if (!nodeId || this.pendingLocationUpdates.has(nodeId)) return;
    const update = this.updateNodeLocation(nodeId, agentServer)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.meshServer.debug?.('utils', `IP location update failed for ${nodeId}: ${message}`);
      })
      .finally(() => this.pendingLocationUpdates.delete(nodeId));
    this.pendingLocationUpdates.set(nodeId, update);
  }

  private async updateNodeLocation(nodeId: string, agentServer: MeshCentralAgentServer): Promise<void> {
    const node = await this.getNode(nodeId);
    if (!node) return;
    const lookupIp = publicIp(node.publicip) ?? publicIp(node.ip);
    if (!lookupIp) return;

    const location = await this.geoIpLocation.lookup(lookupIp);
    if (!location) return;
    const latestNode = await this.getNode(nodeId);
    if (!latestNode) return;
    const latestIp = publicIp(latestNode.publicip) ?? publicIp(latestNode.ip);
    if (latestIp !== lookupIp) return;
    if (sameLocation(latestNode.nodexa?.location, location)) return;

    latestNode.nodexa = { ...(latestNode.nodexa ?? {}), location };
    this.meshServer.db?.Set?.(latestNode);

    const cloneSafeNode = agentServer.CloneSafeNode ?? this.meshServer.webserver?.CloneSafeNode;
    const createTargets = agentServer.CreateMeshDispatchTargets ?? this.meshServer.webserver?.CreateMeshDispatchTargets;
    if (!cloneSafeNode || !createTargets || !latestNode.meshid) return;
    const event: Record<string, unknown> = {
      etype: 'node', action: 'changenode', nodeid: latestNode._id, domain: latestNode.domain,
      node: cloneSafeNode(latestNode), nolog: 1,
    };
    if (this.meshServer.db?.changeStream) event.noact = 1;
    this.meshServer.DispatchEvent?.(createTargets(latestNode.meshid, [latestNode._id]), this, event);
  }

  private getNode(nodeId: string): Promise<MeshCentralNodeDocument | undefined> {
    return new Promise((resolve) => {
      const get = this.meshServer.db?.Get;
      if (!get) { resolve(undefined); return; }
      get(nodeId, (error, documents) => {
        if (error || documents.length !== 1) { resolve(undefined); return; }
        const document = documents[0];
        resolve(document && typeof document === 'object' ? document as MeshCentralNodeDocument : undefined);
      });
    });
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