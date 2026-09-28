import type {
  MeshCentralDomain,
  MeshCentralHttpHandler,
  MeshCentralPluginHandler,
  MeshCentralServer,
  MeshCentralWebServer,
} from '../../types/meshcentral.types.js';
import { createPluginFactory } from '../../common/plugin-factory.js';
import {
  createJsonAuthModule,
  defaultDependencies,
} from './jsonauth.module.js';
import type { HandlerDependencies } from './jsonauth.types.js';
import {
  RegistrationService,
  type RegistrationDependencies,
} from './services/registration.service.js';
import { JsonAuthPlugin } from './jsonauth.plugin.js';

export function createJsonAuthHandler(
  webServer: MeshCentralWebServer,
  meshServer: MeshCentralServer,
  routeDomain?: MeshCentralDomain,
  dependencies: HandlerDependencies = defaultDependencies,
): MeshCentralHttpHandler {
  return createJsonAuthModule(
    {} as MeshCentralPluginHandler,
    dependencies,
  ).loginService.createLoginHandler(webServer, meshServer, routeDomain);
}

export function createCanRegisterHandler(
  webServer: MeshCentralWebServer,
  meshServer: MeshCentralServer,
  routeDomain?: MeshCentralDomain,
): MeshCentralHttpHandler {
  return createJsonAuthModule(
    {} as MeshCentralPluginHandler,
  ).registrationService.createHandler(webServer, meshServer, routeDomain);
}

export function createRegisterHandler(
  webServer: MeshCentralWebServer,
  meshServer: MeshCentralServer,
  routeDomain?: MeshCentralDomain,
  dependencies?: RegistrationDependencies,
): MeshCentralHttpHandler {
  return new RegistrationService(dependencies).createRegisterHandler(
    webServer,
    meshServer,
    routeDomain,
  );
}

export function createJsonAuthHandlers(
  webServer: MeshCentralWebServer,
  meshServer: MeshCentralServer,
  routeDomain?: MeshCentralDomain,
  dependencies: HandlerDependencies = defaultDependencies,
): {
  login: MeshCentralHttpHandler;
  verifyTwoFactor: MeshCentralHttpHandler;
  logout: MeshCentralHttpHandler;
  canRegister: MeshCentralHttpHandler;
} {
  const module = createJsonAuthModule(
    {} as MeshCentralPluginHandler,
    dependencies,
  );
  return {
    login: module.loginService.createLoginHandler(webServer, meshServer, routeDomain),
    verifyTwoFactor: module.loginService.createVerifyTwoFactorHandler(
      webServer,
      meshServer,
      routeDomain,
    ),
    logout: module.logoutService.createHandler(webServer, meshServer, routeDomain),
    canRegister: module.registrationService.createHandler(
      webServer,
      meshServer,
      routeDomain,
    ),
  };
}

export const jsonauth = createPluginFactory(
  JsonAuthPlugin,
  (pluginHandler) => createJsonAuthModule(pluginHandler).plugin,
);
