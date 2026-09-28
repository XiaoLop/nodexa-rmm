import { randomBytes } from 'node:crypto';
import type {
  MeshCentralHttpRequest,
  MeshCentralWebServer,
} from '../../../types/meshcentral.types.js';

export class SessionService {
  establish(
    webServer: MeshCentralWebServer,
    request: MeshCentralHttpRequest,
    userId: string,
  ): void {
    this.clean(request);
    request.session.userid = userId;
    request.session.ip = request.clientIp;
    this.setRandom(webServer, request);
  }

  private clean(request: MeshCentralHttpRequest): void {
    for (const key of [
      'e', 'u2f', 'loginmode', 'tuserid', 'tuser', 'tpass', 'temail', 'tsms',
      'tmsg', 'tduo', 'tpush', 'messageid', 'passhint', 'cuserid', 'expire',
      'currentNode',
    ]) {
      delete request.session[key];
    }
  }

  private setRandom(
    webServer: MeshCentralWebServer,
    request: MeshCentralHttpRequest,
  ): void {
    if (webServer.setSessionRandom != null) {
      webServer.setSessionRandom(request);
      return;
    }
    if (request.session.userid == null || request.session.x != null) return;
    let value = randomBytes(6).toString('base64');
    while (
      webServer.destroyedSessions?.[`${request.session.userid}/${value}`] != null
    ) {
      value = randomBytes(6).toString('base64');
    }
    request.session.x = value;
  }
}