import { randomBytes } from 'node:crypto';
import type { MeshCentralPluginHandler } from '../../types/meshcentral.types.js';
import { AuthEventService } from './services/auth-event.service.js';
import { AuthTransactionService } from './services/auth-transaction.service.js';
import { JsonAuthController } from './jsonauth.controller.js';
import { JsonAuthPlugin } from './jsonauth.plugin.js';
import type { HandlerDependencies } from './jsonauth.types.js';
import { LoginService } from './services/login.service.js';
import { LogoutService } from './services/logout.service.js';
import { SessionService } from './services/session.service.js';
import { TwoFactorService } from './services/two-factor.service.js';

export const defaultDependencies: HandlerDependencies = {
  delay(callback, milliseconds) {
    setTimeout(callback, milliseconds);
  },
  randomDelay() {
    return 2000 + randomBytes(2).readUInt16BE(0) % 4095;
  },
  randomToken() {
    return randomBytes(32).toString('base64url');
  },
  now() {
    return Date.now();
  },
};

export interface JsonAuthModuleRef {
  loginService: LoginService;
  logoutService: LogoutService;
  plugin: JsonAuthPlugin;
}

export function createJsonAuthModule(
  _pluginHandler: MeshCentralPluginHandler,
  dependencies: HandlerDependencies = defaultDependencies,
): JsonAuthModuleRef {
  const twoFactorService = new TwoFactorService();
  const authTransactionService = new AuthTransactionService(
    dependencies.now,
    dependencies.randomToken,
  );
  const sessionService = new SessionService();
  const authEventService = new AuthEventService();
  const loginService = new LoginService(
    twoFactorService,
    authTransactionService,
    sessionService,
    authEventService,
    dependencies,
  );
  const logoutService = new LogoutService();
  const controller = new JsonAuthController(loginService, logoutService);
  return {
    loginService,
    logoutService,
    plugin: new JsonAuthPlugin(controller),
  };
}