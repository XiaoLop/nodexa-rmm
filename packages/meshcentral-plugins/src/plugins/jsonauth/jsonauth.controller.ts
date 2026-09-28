import type {
  MeshCentralServer,
  MeshCentralWebServer,
} from '../../types/meshcentral.types.js';
import type { LoginService } from './services/login.service.js';
import type { LogoutService } from './services/logout.service.js';

export class JsonAuthController {
  constructor(
    private readonly loginService: LoginService,
    private readonly logoutService: LogoutService,
  ) {}

  register(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
  ): void {
    if (
      webServer.bodyParser?.json == null ||
      webServer.authenticate == null ||
      webServer.checkAllowLogin == null ||
      webServer.setbadLogin == null
    ) {
      meshServer.debug?.(
        'web',
        '[jsonauth] Required MeshCentral 1.1.54 authentication APIs are unavailable',
      );
      return;
    }
    const domains = meshServer.config?.domains;
    if (domains == null) return;
    const registeredPaths = new Set<string>();
    for (const domain of Object.values(domains)) {
      const basePath = domain.dns == null ? `${domain.url}api/auth` : '/api/auth';
      const loginPath = `${basePath}/login`;
      const verifyPath = `${basePath}/login/verify-2fa`;
      const logoutPath = `${basePath}/logout`;
      if (registeredPaths.has(loginPath)) continue;
      registeredPaths.add(loginPath);
      webServer.app.post(
        loginPath,
        webServer.bodyParser.json({ limit: '16kb' }),
        this.loginService.createLoginHandler(
          webServer,
          meshServer,
          domain.dns == null ? domain : undefined,
        ),
      );
      webServer.app.post(
        verifyPath,
        webServer.bodyParser.json({ limit: '16kb' }),
        this.loginService.createVerifyTwoFactorHandler(
          webServer,
          meshServer,
          domain.dns == null ? domain : undefined,
        ),
      );
      webServer.app.post(
        logoutPath,
        webServer.bodyParser.json({ limit: '16kb' }),
        this.logoutService.createHandler(
          webServer,
          meshServer,
          domain.dns == null ? domain : undefined,
        ),
      );
    }
  }
}