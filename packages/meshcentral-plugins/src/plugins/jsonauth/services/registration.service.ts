import { pbkdf2, randomBytes } from 'node:crypto';
import type {
  MeshCentralDomain,
  MeshCentralHttpHandler,
  MeshCentralHttpResponse,
  MeshCentralServer,
  MeshCentralUser,
  MeshCentralWebServer,
} from '../../../types/meshcentral.types.js';

interface RegistrationBody {
  username: string;
  password: string;
  email: string;
  token: string;
}

export interface RegistrationDependencies {
  hashPassword(
    password: string,
    callback: (error: unknown, salt?: string, hash?: string) => void,
  ): void;
  now(): number;
}

const defaultDependencies: RegistrationDependencies = {
  hashPassword(password, callback) {
    randomBytes(128, (saltError, saltBuffer) => {
      if (saltError) {
        callback(saltError);
        return;
      }
      const salt = saltBuffer.toString('base64');
      pbkdf2(password, salt, 12_000, 128, 'sha384', (hashError, hashBuffer) => {
        callback(hashError, salt, hashBuffer?.toString('base64'));
      });
    });
  },
  now() {
    return Date.now();
  },
};

export class RegistrationService {
  constructor(private readonly dependencies = defaultDependencies) {}

  createHandler(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
    routeDomain?: MeshCentralDomain,
  ): MeshCentralHttpHandler {
    return (request, response) => {
      response.set({ 'Cache-Control': 'no-store' });
      const domain = routeDomain ?? request.xdomain ?? meshServer.config?.domains?.[''];
      if (domain == null) {
        response.status(503).json({
          allowed: false,
          isFirstUser: false,
          reason: 'Domain configuration is unavailable.',
        });
        return;
      }

      if (meshServer.config?.settings?.maintenancemode != null) {
        response.json({
          allowed: false,
          isFirstUser: false,
          reason: 'Server is in maintenance mode.',
        });
        return;
      }

      if (
        domain.auth === 'sspi' ||
        domain.auth === 'ldap' ||
        domain.authstrategies != null ||
        webServer.args?.nousers === true
      ) {
        response.json({
          allowed: false,
          isFirstUser: false,
          reason: 'External authentication is in use or local users are disabled.',
        });
        return;
      }

      const domainId = domain.id ?? '';
      const userCount = Object.values(webServer.users ?? {}).filter(
        (user) => user.domain === domainId,
      ).length;
      const isFirstUser = userCount === 0;
      const allowed =
        isFirstUser || domain.newaccounts === true || domain.newaccounts === 1;

      response.json({
        allowed,
        isFirstUser,
        domain: domainId,
        userCount,
        requiresToken:
          domain.newaccountspass != null && domain.newaccountspass !== '',
        requiresCaptcha:
          domain.newaccountscaptcha != null && domain.newaccountscaptcha !== false,
      });
    };
  }

  createRegisterHandler(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
    routeDomain?: MeshCentralDomain,
  ): MeshCentralHttpHandler {
    return (request, response) => {
      response.set({ 'Cache-Control': 'no-store' });
      const domain = routeDomain ?? request.xdomain ?? meshServer.config?.domains?.[''];
      const body = this.parseBody(request.body);
      if (domain == null || body == null) {
        this.send(response, 400, 'PARAM_ERROR', '注册参数格式不正确');
        return;
      }
      if (meshServer.config?.settings?.maintenancemode != null) {
        this.send(response, 503, 'MAINTENANCE_MODE', '服务器正在维护');
        return;
      }
      if (
        domain.auth === 'sspi' ||
        domain.auth === 'ldap' ||
        domain.authstrategies != null ||
        webServer.args?.nousers === true
      ) {
        this.send(response, 403, 'ACCESS_DENIED', '此域不支持本地账号注册');
        return;
      }
      if (domain.newaccountscaptcha != null && domain.newaccountscaptcha !== false) {
        this.send(response, 501, 'CAPTCHA_REQUIRED', '此域要求验证码，当前接口暂不支持');
        return;
      }

      const domainId = domain.id ?? '';
      const userCount = this.countUsers(webServer, domainId);
      const isFirstUser = userCount === 0;
      if (!isFirstUser && domain.newaccounts !== true && domain.newaccounts !== 1) {
        this.send(response, 403, 'REGISTRATION_CLOSED', '当前域已关闭新账号注册');
        return;
      }
      if (
        domain.newaccountspass != null &&
        domain.newaccountspass !== '' &&
        body.token !== domain.newaccountspass
      ) {
        this.send(response, 400, 'INVALID_REGISTRATION_TOKEN', '注册邀请码无效');
        return;
      }

      const common = meshServer.common;
      if (
        common?.validateUsername == null ||
        common.validateEmail == null ||
        common.checkPasswordRequirements == null ||
        meshServer.db?.isMaxType == null ||
        meshServer.db.SetUser == null
      ) {
        this.send(response, 503, 'SERVER_UNAVAILABLE', '注册服务暂不可用');
        return;
      }
      if (
        body.username.startsWith('~') ||
        !common.validateUsername(body.username, 1, 64)
      ) {
        this.send(response, 400, 'INVALID_USERNAME', '用户名格式不正确');
        return;
      }
      if (!common.validateEmail(body.email, 1, 256)) {
        this.send(response, 400, 'INVALID_EMAIL', '邮箱格式不正确');
        return;
      }
      if (
        Array.isArray(domain.newaccountemaildomains) &&
        domain.newaccountemaildomains.length > 0 &&
        !domain.newaccountemaildomains.some(
          (allowedDomain) => allowedDomain.toLowerCase() === body.email.split('@')[1],
        )
      ) {
        this.send(response, 400, 'EMAIL_DOMAIN_NOT_ALLOWED', '此邮箱域名不允许注册');
        return;
      }
      if (
        body.password.length < 1 ||
        body.password.length > 256 ||
        !common.checkPasswordRequirements(body.password, domain.passwordrequirements)
      ) {
        this.send(response, 400, 'INVALID_PASSWORD', '密码不符合安全策略');
        return;
      }

      const userId = `user/${domainId}/${body.username.toLowerCase()}`;
      if (webServer.users?.[userId] != null) {
        this.send(response, 409, 'USERNAME_EXISTS', '用户名已存在');
        return;
      }
      meshServer.db.isMaxType(
        domain.limits?.maxuseraccounts,
        'user',
        domainId,
        (maximumExceeded) => {
          if (maximumExceeded) {
            this.send(response, 403, 'ACCOUNT_LIMIT_REACHED', '用户数量已达到上限');
            return;
          }
          this.dependencies.hashPassword(body.password, (error, salt, hash) => {
            if (error != null || salt == null || hash == null) {
              this.send(response, 500, 'PASSWORD_HASH_FAILED', '密码处理失败');
              return;
            }
            if (webServer.users?.[userId] != null) {
              this.send(response, 409, 'USERNAME_EXISTS', '用户名已存在');
              return;
            }
            const isCurrentFirstUser = this.countUsers(webServer, domainId) === 0;
            if (
              !isCurrentFirstUser &&
              domain.newaccounts !== true &&
              domain.newaccounts !== 1
            ) {
              this.send(response, 403, 'REGISTRATION_CLOSED', '当前域已关闭新账号注册');
              return;
            }
            const nowSeconds = Math.floor(this.dependencies.now() / 1000);
            const user: MeshCentralUser = {
              type: 'user',
              _id: userId,
              name: body.username,
              email: body.email,
              creation: nowSeconds,
              login: nowSeconds,
              access: nowSeconds,
              domain: domainId,
              salt,
              hash,
            };
            if (domain.newaccountsrights != null) {
              user.siteadmin = domain.newaccountsrights;
            }
            if (isCurrentFirstUser) user.siteadmin = 0xffffffff;

            meshServer.db?.SetUser?.(user);
            if (webServer.users == null) webServer.users = {};
            webServer.users[userId] = user;
            const event: Record<string, unknown> = {
              etype: 'user',
              userid: userId,
              username: body.username,
              account: webServer.CloneSafeUser?.(user) ?? user,
              action: 'accountcreate',
              msg: `Account created: ${body.username}`,
              domain: domainId,
            };
            if (meshServer.db?.changeStream != null) event.noact = 1;
            meshServer.DispatchEvent?.(['*', 'server-users'], webServer, event);

            const mailServer = domain.mailserver as {
              sendAccountCheckMail?(
                mailDomain: MeshCentralDomain,
                username: string,
                registeredUserId: string,
                email: string,
                languageCodes: string[],
              ): void;
            } | undefined;
            try {
              mailServer?.sendAccountCheckMail?.(
                domain,
                body.username,
                userId,
                body.email,
                webServer.getLanguageCodes?.(request) ?? [],
              );
            } catch (mailError) {
              meshServer.debug?.(
                'web',
                `[jsonauth] Failed to send verification email: ${String(mailError)}`,
              );
            }

            this.send(response, 201, 'SUCCESS', '注册成功', {
              id: userId,
              username: body.username,
              email: body.email,
              isAdmin: user.siteadmin === 0xffffffff,
            });
          });
        },
      );
    };
  }

  private parseBody(value: unknown): RegistrationBody | undefined {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const body = value as Record<string, unknown>;
    if (
      typeof body.username !== 'string' ||
      typeof body.password !== 'string' ||
      typeof body.email !== 'string' ||
      (body.token != null && typeof body.token !== 'string')
    ) {
      return undefined;
    }
    return {
      username: body.username.trim(),
      password: body.password,
      email: body.email.trim().toLowerCase(),
      token: body.token?.trim() ?? '',
    };
  }

  private countUsers(webServer: MeshCentralWebServer, domainId: string): number {
    return Object.values(webServer.users ?? {}).filter(
      (user) => user.domain === domainId,
    ).length;
  }

  private send(
    response: MeshCentralHttpResponse,
    code: number,
    status: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    response.status(code).json({ code, status, message, ...(data == null ? {} : { data }) });
  }
}