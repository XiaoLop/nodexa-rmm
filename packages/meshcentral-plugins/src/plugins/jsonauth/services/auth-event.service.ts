import type {
  MeshCentralDomain,
  MeshCentralHttpRequest,
  MeshCentralServer,
  MeshCentralUser,
  MeshCentralWebServer,
} from '../../../types/meshcentral.types.js';

export class AuthEventService {
  failure(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
    request: MeshCentralHttpRequest,
    domain: MeshCentralDomain,
    userId: string,
    username: string,
    message: string,
    messageId: number,
  ): void {
    const userAgent = webServer.getUserAgentInfo?.(request) ?? {};
    meshServer.DispatchEvent?.(['*', 'server-users', userId], webServer, {
      action: 'authfail',
      userid: userId,
      username,
      domain: domain.id,
      msg: message,
      msgid: messageId,
      msgArgs: [request.clientIp, userAgent.browserStr, userAgent.osStr],
    });
  }

  success(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
    request: MeshCentralHttpRequest,
    domain: MeshCentralDomain,
    userId: string,
    user: MeshCentralUser,
    twoFactorType: string | null,
  ): void {
    const userAgent = webServer.getUserAgentInfo?.(request) ?? {};
    const targets = ['*', 'server-users', userId];
    for (const group of user.groups ?? []) targets.push(`server-users:${group}`);
    meshServer.DispatchEvent?.(targets, webServer, {
      etype: 'user', userid: userId, username: user.name,
      account: webServer.CloneSafeUser?.(user) ?? {}, action: 'login', msgid: 107,
      msgArgs: [request.clientIp, userAgent.browserStr, userAgent.osStr],
      msg: `Account login from ${request.clientIp ?? 'unknown'}`,
      domain: domain.id, ip: request.clientIp,
      userAgent: request.headers['user-agent'], twoFactorType,
    });
  }
}