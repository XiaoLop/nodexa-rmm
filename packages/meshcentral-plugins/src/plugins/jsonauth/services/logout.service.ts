import type {
  MeshCentralDomain,
  MeshCentralHttpHandler,
  MeshCentralServer,
  MeshCentralWebServer,
} from '../../../types/meshcentral.types.js';

export class LogoutService {
  createHandler(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
    routeDomain?: MeshCentralDomain,
  ): MeshCentralHttpHandler {
    return (request, response) => {
      response.set({ 'Cache-Control': 'no-store' });
      const domain = request.xdomain ?? routeDomain;
      const session = request.session;
      const userId = session?.userid;
      const user = userId == null ? undefined : webServer.users?.[userId];

      if (userId != null && session?.x != null && webServer.destroyedSessions != null) {
        webServer.clearDestroyedSessions?.();
        webServer.destroyedSessions[`${userId}/${session.x}`] = Date.now();
      }

      if (userId != null && user != null) {
        meshServer.authLog?.(
          'https',
          `User ${user.name ?? userId} JSON logout from ${request.clientIp ?? 'unknown'}`,
          { sessionid: session?.x, useragent: request.headers['user-agent'] },
        );
        meshServer.DispatchEvent?.(['*'], webServer, {
          etype: 'user',
          userid: user._id ?? userId,
          username: user.name,
          action: 'logout',
          msgid: 2,
          msg: 'Account logout via JSON API',
          domain: domain?.id ?? user.domain ?? '',
        });
      }

      request.session = null!;
      response.clearCookie?.('connect.sid', { path: '/' });
      response.status(200).json({
        code: 200,
        status: 'SUCCESS',
        message: userId == null ? '当前未处于登录状态' : '退出登录成功',
        data: { redirectUrl: `${domain?.url ?? '/'}login` },
      });
    };
  }
}