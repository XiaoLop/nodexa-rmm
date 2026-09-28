import type {
  MeshCentralDomain,
  MeshCentralHttpHandler,
  MeshCentralHttpRequest,
  MeshCentralHttpResponse,
  MeshCentralServer,
  MeshCentralUser,
  MeshCentralWebServer,
} from '../../../types/meshcentral.types.js';
import type { AuthEventService } from './auth-event.service.js';
import type { AuthTransactionService } from './auth-transaction.service.js';
import type {
  HandlerDependencies,
  LoginBody,
  LoginStatus,
  TwoFactorMethodDescription,
  VerifyTwoFactorBody,
} from '../jsonauth.types.js';
import type { SessionService } from './session.service.js';
import type { TwoFactorService } from './two-factor.service.js';

export class LoginService {
  constructor(
    private readonly twoFactorService: TwoFactorService,
    private readonly authTransactionService: AuthTransactionService,
    private readonly sessionService: SessionService,
    private readonly authEventService: AuthEventService,
    private readonly dependencies: HandlerDependencies,
  ) {}

  createLoginHandler(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
    routeDomain?: MeshCentralDomain,
  ): MeshCentralHttpHandler {
    return (request, response) => {
      response.set({ 'Cache-Control': 'no-store' });
      const body = this.parseBody(request.body);
      if (body == null) {
        this.send(response, 400, 'PARAM_ERROR', '用户名和密码不能为空或格式不正确');
        return;
      }
      const domain = request.xdomain ?? routeDomain;
      if (domain == null || request.session == null) {
        this.send(response, 503, 'SERVER_UNAVAILABLE', '认证服务暂不可用');
        return;
      }
      if (
        domain.auth === 'sspi' ||
        domain.auth === 'ldap' ||
        domain.authstrategies != null ||
        webServer.args?.nousers === true
      ) {
        this.send(response, 403, 'ACCESS_DENIED', '此域不支持用户名密码 JSON 登录');
        return;
      }
      if (
        domain.loginkey != null &&
        (typeof request.query.key !== 'string' ||
          !domain.loginkey.includes(request.query.key))
      ) {
        this.send(response, 403, 'ACCESS_DENIED', '登录访问密钥无效');
        return;
      }
      if (webServer.checkAllowLogin?.(request) === false) {
        this.dependencies.delay(() => {
          this.send(response, 423, 'ACCOUNT_LOCKED', '登录尝试次数过多，请稍后再试');
        }, this.dependencies.randomDelay());
        return;
      }
      webServer.authenticate?.(
        body.username,
        body.password,
        domain,
        (error, userId, _hint, loginOptions) => {
          if (userId == null) {
            webServer.setbadLogin?.(request);
            meshServer.authLog?.(
              'https',
              `Failed JSON password for ${body.username} from ${request.clientIp ?? 'unknown'}`,
              { useragent: request.headers['user-agent'] },
            );
            const failedUserId = `user/${domain.id}/${body.username.toLowerCase()}`;
            this.authEventService.failure(
              webServer,
              meshServer,
              request,
              domain,
              failedUserId,
              body.username,
              error === 'locked'
                ? `User login attempt on locked account from ${request.clientIp ?? 'unknown'}`
                : `Invalid user login attempt from ${request.clientIp ?? 'unknown'}`,
              error === 'locked' ? 109 : 110,
            );
            this.dependencies.delay(() => {
              this.send(
                response,
                error === 'locked' ? 423 : 401,
                error === 'locked' ? 'ACCOUNT_LOCKED' : 'BAD_PASSWORD',
                error === 'locked' ? '账号已被锁定' : '用户名或密码不正确',
              );
            }, this.dependencies.randomDelay());
            return;
          }
          const user = webServer.users?.[userId];
          if (user == null || user.domain !== domain.id) {
            this.send(response, 503, 'SERVER_UNAVAILABLE', '用户数据不可用');
            return;
          }
          if (
            meshServer.config?.settings?.maintenancemode != null &&
            user.siteadmin !== 0xffffffff
          ) {
            this.send(response, 503, 'MAINTENANCE_MODE', '服务器正在维护');
            return;
          }
          const methods = this.twoFactorService.getMethods(meshServer, domain, user);
          const twoFactorType = this.twoFactorService.getSkipReason(
            meshServer,
            request,
            domain,
            user,
            loginOptions,
          );
          const nowSeconds = Math.floor(this.dependencies.now() / 1000);
          if (!this.checkAccountPolicy(webServer, meshServer, response, domain, user, nowSeconds)) {
            return;
          }
          if (
            twoFactorType == null &&
            this.twoFactorService.requires(meshServer, domain, user)
          ) {
            const allowedMethods = [...methods.supported, ...methods.unsupported];
            const transaction = this.authTransactionService.create(
              request,
              userId,
              domain.id,
              allowedMethods,
            );
            const twoFactorMethods: TwoFactorMethodDescription[] = [
              ...methods.supported.map((type) => ({ type, supported: true })),
              ...methods.unsupported.map((type) => ({ type, supported: false })),
            ];
            this.send(response, 202, 'REQUIRE_2FA', '密码验证通过，请完成二阶段验证', {
              transactionId: transaction.id,
              expiresIn: Math.floor((transaction.expiresAt - transaction.issuedAt) / 1000),
              methods: twoFactorMethods,
            });
            return;
          }
          this.completeLogin(
            webServer,
            meshServer,
            request,
            response,
            domain,
            userId,
            user,
            twoFactorType,
            body.rememberToken === true,
            nowSeconds,
          );
        },
      );
    };
  }

  createVerifyTwoFactorHandler(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
    routeDomain?: MeshCentralDomain,
  ): MeshCentralHttpHandler {
    return (request, response) => {
      response.set({ 'Cache-Control': 'no-store' });
      const body = this.parseVerifyBody(request.body);
      if (body == null) {
        this.send(response, 400, 'PARAM_ERROR', '认证事务或二阶段验证参数不正确');
        return;
      }
      const domain = request.xdomain ?? routeDomain;
      if (domain == null || request.session == null) {
        this.send(response, 503, 'SERVER_UNAVAILABLE', '认证服务暂不可用');
        return;
      }
      const lookup = this.authTransactionService.lookup(
        request,
        body.transactionId,
        domain.id,
        body.type,
      );
      if (lookup.status === 'expired') {
        this.send(response, 401, 'AUTH_TRANSACTION_EXPIRED', '认证事务已过期，请重新登录');
        return;
      }
      if (lookup.status === 'blocked') {
        this.send(response, 423, 'ACCOUNT_LOCKED', '二阶段验证尝试次数过多，请重新登录');
        return;
      }
      if (lookup.status !== 'valid') {
        this.send(response, 401, 'INVALID_AUTH_TRANSACTION', '认证事务无效');
        return;
      }
      const { transaction } = lookup;
      const user = webServer.users?.[transaction.userId];
      if (user == null || user.domain !== domain.id) {
        this.authTransactionService.consume(transaction);
        this.send(response, 503, 'SERVER_UNAVAILABLE', '用户数据不可用');
        return;
      }
      if (!this.authTransactionService.isSupportedMethod(body.type)) {
        this.send(
          response,
          501,
          'UNSUPPORTED_2FA_METHOD',
          '此二阶段验证方式暂不支持 JSON 登录',
          { method: body.type },
        );
        return;
      }
      if (
        meshServer.config?.settings?.maintenancemode != null &&
        user.siteadmin !== 0xffffffff
      ) {
        this.authTransactionService.consume(transaction);
        this.send(response, 503, 'MAINTENANCE_MODE', '服务器正在维护');
        return;
      }
      const nowSeconds = Math.floor(this.dependencies.now() / 1000);
      if (!this.checkAccountPolicy(webServer, meshServer, response, domain, user, nowSeconds)) {
        this.authTransactionService.consume(transaction);
        return;
      }
      if (body.code == null || webServer.checkAllow2Fa?.(request) === false) {
        if (body.code == null) {
          this.send(response, 400, 'PARAM_ERROR', '二阶段验证码不能为空');
        } else {
          this.send(response, 423, 'ACCOUNT_LOCKED', '二阶段验证尝试次数过多，请稍后再试');
        }
        return;
      }
      const twoFactorType = this.twoFactorService.verify(
        user,
        body.type,
        body.code,
        this.dependencies.now(),
      );
      if (twoFactorType == null) {
        const transactionBlocked = this.authTransactionService.recordFailure(transaction);
        webServer.setbad2Fa?.(request);
        meshServer.authLog?.(
          'https',
          `Failed JSON 2FA for ${user.name ?? transaction.userId} from ${request.clientIp ?? 'unknown'}`,
          { useragent: request.headers['user-agent'] },
        );
        this.authEventService.failure(
          webServer,
          meshServer,
          request,
          domain,
          transaction.userId,
          user.name ?? transaction.userId,
          `User login attempt with incorrect 2nd factor from ${request.clientIp ?? 'unknown'}`,
          108,
        );
        this.dependencies.delay(() => {
          if (transactionBlocked) {
            this.send(response, 423, 'ACCOUNT_LOCKED', '二阶段验证尝试次数过多，请重新登录');
          } else {
            this.send(response, 401, 'INVALID_2FA_TOKEN', '二阶段验证码错误');
          }
        }, this.dependencies.randomDelay());
        return;
      }
      this.authTransactionService.consume(transaction);
      this.completeLogin(
        webServer,
        meshServer,
        request,
        response,
        domain,
        transaction.userId,
        user,
        twoFactorType,
        body.rememberToken === true,
        nowSeconds,
      );
    };
  }

  private checkAccountPolicy(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
    response: MeshCentralHttpResponse,
    domain: MeshCentralDomain,
    user: MeshCentralUser,
    nowSeconds: number,
  ): boolean {
    const resetDays = domain.passwordrequirements?.reset;
    if (
      user.passchange === -1 ||
      (typeof resetDays === 'number' &&
        typeof user.passchange === 'number' &&
        user.passchange + resetDays * 86400 < nowSeconds)
    ) {
      this.send(response, 403, 'PASSWORD_EXPIRED', '密码已过期，需要修改密码');
      return false;
    }
    const emailCheck =
      domain.mailserver != null &&
      meshServer.certificates?.CommonName?.includes('.') === true &&
      webServer.args?.lanonly !== true;
    if (emailCheck && user.emailVerified !== true) {
      this.send(response, 403, 'EMAIL_NOT_VERIFIED', '邮箱尚未验证');
      return false;
    }
    return true;
  }

  private completeLogin(
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
    request: MeshCentralHttpRequest,
    response: MeshCentralHttpResponse,
    domain: MeshCentralDomain,
    userId: string,
    user: MeshCentralUser,
    twoFactorType: string | null,
    rememberToken: boolean,
    nowSeconds: number,
  ): void {
    user.pastlogin = user.login;
    user.login = user.access = nowSeconds;
    meshServer.db?.SetUser?.(user);
    this.sessionService.establish(webServer, request, userId);
    if (
      rememberToken &&
      twoFactorType != null &&
      twoFactorType !== 'disabled' &&
      domain.twofactorcookiedurationdays !== 0 &&
      meshServer.encodeCookie != null &&
      response.cookie != null
    ) {
      const durationDays = domain.twofactorcookiedurationdays ?? 30;
      const trustedCookie = meshServer.encodeCookie(
        { userid: userId, expire: durationDays * 24 * 60 },
        meshServer.loginCookieEncryptionKey,
      );
      response.cookie('twofactor', trustedCookie, {
        maxAge: durationDays * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: meshServer.config?.settings?.sessionsamesite,
        secure: true,
      });
    }
    this.authEventService.success(
      webServer,
      meshServer,
      request,
      domain,
      userId,
      user,
      twoFactorType,
    );
    meshServer.authLog?.(
      'https',
      `Accepted JSON authentication for ${user.name ?? userId} from ${request.clientIp ?? 'unknown'}`,
      { useragent: request.headers['user-agent'], sessionid: request.session.x },
    );
    this.send(response, 200, 'SUCCESS', '登录成功', {
      userid: user._id,
      username: user.name,
      siteadmin: user.siteadmin === 0xffffffff,
      redirectUrl: domain.url || '/',
    });
  }

  private send(
    response: MeshCentralHttpResponse,
    code: number,
    status: LoginStatus,
    message: string,
    data?: Record<string, unknown>,
  ): unknown {
    return response.status(code).json({
      code,
      status,
      message,
      ...(data ? { data } : {}),
    });
  }

  private parseBody(value: unknown): LoginBody | null {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
    const body = value as Record<string, unknown>;
    if (
      typeof body.username !== 'string' ||
      typeof body.password !== 'string' ||
      body.username.length < 1 ||
      body.username.length > 64 ||
      body.password.length < 1 ||
      body.password.length > 256 ||
      (body.rememberToken != null && typeof body.rememberToken !== 'boolean')
    ) {
      return null;
    }
    return {
      username: body.username,
      password: body.password,
      ...(typeof body.rememberToken === 'boolean'
        ? { rememberToken: body.rememberToken }
        : {}),
    };
  }

  private parseVerifyBody(value: unknown): VerifyTwoFactorBody | null {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
    const body = value as Record<string, unknown>;
    if (
      typeof body.transactionId !== 'string' ||
      body.transactionId.length < 32 ||
      body.transactionId.length > 256 ||
      typeof body.type !== 'string' ||
      body.type.length < 1 ||
      body.type.length > 32 ||
      (body.code != null && (typeof body.code !== 'string' || body.code.length > 4096)) ||
      (body.rememberToken != null && typeof body.rememberToken !== 'boolean')
    ) {
      return null;
    }
    return {
      transactionId: body.transactionId,
      type: body.type,
      ...(typeof body.code === 'string' ? { code: body.code } : {}),
      ...(typeof body.rememberToken === 'boolean'
        ? { rememberToken: body.rememberToken }
        : {}),
    };
  }
}