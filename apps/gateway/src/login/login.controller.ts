import { Body, Controller, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiGatewayTimeoutResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { type LoginErrorCode, LoginService } from './login.service';
import { LoginCandidateResponse, LoginErrorResponse, LoginRequest } from './login.types';

interface LoginBody {
  action?: unknown;
  username?: unknown;
  password?: unknown;
  token?: unknown;
  hwtoken?: unknown;
}

function isValidCredential(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function selectMeshSessionCookies(cookieHeader: string | undefined): string {
  if (!cookieHeader) return '';
  return cookieHeader
    .split(';')
    .map((value) => value.trim())
    .filter((value) => value.startsWith('xid=') || value.startsWith('xid.sig='))
    .join('; ');
}

const loginErrorResponses: Record<
  LoginErrorCode,
  { status: HttpStatus; message: string }
> = {
  INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Invalid credentials or account unavailable.',
  },
  MFA_REQUIRED: { status: HttpStatus.UNAUTHORIZED, message: 'Multi-factor authentication required.' },
  MFA_INVALID: { status: HttpStatus.UNAUTHORIZED, message: 'Invalid or expired authentication token.' },
  PASSWORD_CHANGE_REQUIRED: {
    status: HttpStatus.CONFLICT,
    message: 'Password change required.',
  },
  AUTH_METHOD_REQUIRED: {
    status: HttpStatus.CONFLICT,
    message: 'A different authentication method is required.',
  },
  RATE_LIMITED: { status: HttpStatus.TOO_MANY_REQUESTS, message: 'Too many login attempts.' },
  UPSTREAM_UNAVAILABLE: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Authentication service is unavailable.',
  },
  UPSTREAM_PROTOCOL_ERROR: {
    status: HttpStatus.BAD_GATEWAY,
    message: 'Authentication service returned an invalid response.',
  },
  UNKNOWN_AUTH_ERROR: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Unable to complete authentication.',
  },
};

@Controller('api/login')
@ApiTags('用户认证')
export class LoginController {
  constructor(@Inject(LoginService) private readonly loginService: LoginService) {}

  @Post()
  @ApiOperation({
    summary: '登录 MeshCentral',
    description:
      '提交账号密码或二次验证码。账号密码登录使用 action=login、username 和 password；二次验证使用 action=tokenlogin 和 token，并自动携带第一步设置的 HttpOnly 会话 Cookie。HTTP 200 仅表示已获得候选会话，客户端仍需连接 control.ashx 控制 WebSocket 完成最终认证。',
  })
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiBody({ description: '账号密码登录或二次验证表单。', type: LoginRequest })
  @ApiOkResponse({
    description: 'MeshCentral 已接受登录响应并设置候选会话 Cookie，等待控制通道验证。',
    type: LoginCandidateResponse,
  })
  @ApiBadRequestResponse({
    description: '请求参数无效，例如缺少必填字段或字段长度超限。',
    type: LoginErrorResponse,
  })
  @ApiUnauthorizedResponse({
    description: '凭据错误、账号不可用、需要二次验证、验证码无效或其他认证失败。',
    type: LoginErrorResponse,
  })
  @ApiConflictResponse({
    description: '需要修改密码，或当前账号必须使用其他认证方式。',
    type: LoginErrorResponse,
  })
  @ApiTooManyRequestsResponse({
    description: '登录尝试过于频繁，已触发 MeshCentral 或反向代理的限制。',
    type: LoginErrorResponse,
  })
  @ApiBadGatewayResponse({
    description: 'MeshCentral 不可用、处于维护状态，或返回了无法识别的响应。',
    type: LoginErrorResponse,
  })
  @ApiGatewayTimeoutResponse({
    description: '等待 MeshCentral 登录响应超时。',
    type: LoginErrorResponse,
  })
  async login(
    @Body() body: LoginBody | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const passwordLogin =
      body?.action === 'login' &&
      isValidCredential(body.username, 64) &&
      isValidCredential(body.password, 256);
    const tokenLogin =
      body?.action === 'tokenlogin' &&
      isValidCredential(body.token, 50) &&
      (body.hwtoken === undefined ||
        (typeof body.hwtoken === 'string' && body.hwtoken.length <= 512));
    if (!passwordLogin && !tokenLogin) {
      const error: LoginErrorResponse = {
        authenticated: false,
        code: 'VALIDATION_ERROR',
        message: 'Invalid login request.',
        retryable: false,
      };
      response.status(HttpStatus.BAD_REQUEST).json(error);
      return;
    }

    try {
      const result = passwordLogin
        ? await this.loginService.login(body.username as string, body.password as string)
        : await this.loginService.verifyMfa(
            body.token as string,
            body.hwtoken as string | undefined,
            selectMeshSessionCookies(request.headers.cookie),
          );
      if (result.cookies.length > 0) response.setHeader('Set-Cookie', result.cookies);
      if (!result.outcome.accepted) {
        const mapped = loginErrorResponses[result.outcome.code];
        const error: LoginErrorResponse = {
          authenticated: false,
          code: result.outcome.code,
          message: mapped.message,
          retryable: result.outcome.retryable,
        };
        response.status(mapped.status).json(error);
        return;
      }

      const candidate: LoginCandidateResponse = {
        authenticated: null,
        message: 'Login response accepted; control channel validation is required.',
      };
      response.status(HttpStatus.OK).json(candidate);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      const result: LoginErrorResponse = {
        authenticated: false,
        code: timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
        message: timedOut
          ? 'Authentication service timed out.'
          : 'Authentication service is unavailable.',
        retryable: true,
      };
      response.status(timedOut ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY).json(result);
    }
  }
}
