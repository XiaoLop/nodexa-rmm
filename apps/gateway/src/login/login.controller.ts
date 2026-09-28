import { Body, Controller, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiGatewayTimeoutResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { LoginService } from './login.service';
import { LoginErrorResponse, LoginResponse } from './login.types';
import type {
  PasswordLoginRequest,
  TwoFactorLoginRequest,
} from './login.types';

type LoginBody = Partial<PasswordLoginRequest & TwoFactorLoginRequest>;

function isValidString(value: unknown, maxLength: number, minLength = 1): value is string {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

function isBooleanOrUndefined(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === 'boolean';
}

function selectTrustedDeviceCookie(cookieHeader: string | undefined): string | undefined {
  const cookie = cookieHeader
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('twofactor='));
  return cookie || undefined;
}

@Controller('api/login')
@ApiTags('用户认证')
export class LoginController {
  constructor(@Inject(LoginService) private readonly loginService: LoginService) {}

  @Post()
  @ApiOperation({
    summary: '登录 MeshCentral',
    description:
      '提交用户名密码，或提交密码阶段返回的认证事务和 TOTP/备用码。SUCCESS 后客户端仍需连接 control.ashx 验证原生 MeshCentral Session。',
  })
  @ApiBody({
    description: '用户名密码请求或二阶段验证请求。',
    schema: {
      oneOf: [
        { $ref: '#/components/schemas/PasswordLoginRequest' },
        { $ref: '#/components/schemas/TwoFactorLoginRequest' },
      ],
    },
  })
  @ApiOkResponse({ description: '登录成功。', type: LoginResponse })
  @ApiBadRequestResponse({ description: '请求参数无效。', type: LoginErrorResponse })
  @ApiUnauthorizedResponse({ description: '凭据或二阶段验证码无效。', type: LoginErrorResponse })
  @ApiBadGatewayResponse({ description: 'MeshCentral 返回无效响应或不可用。', type: LoginErrorResponse })
  @ApiGatewayTimeoutResponse({ description: '等待 MeshCentral 响应超时。', type: LoginErrorResponse })
  async login(
    @Body() body: LoginBody | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const rememberToken = body?.rememberToken === true;
    const passwordLogin =
      isValidString(body?.username, 64) &&
      isValidString(body?.password, 256) &&
      isBooleanOrUndefined(body?.rememberToken) &&
      body?.transactionId === undefined;
    const twoFactorLogin =
      isValidString(body?.transactionId, 256, 32) &&
      (body?.type === 'totp' || body?.type === 'backup') &&
      isValidString(body?.code, 4096) &&
      isBooleanOrUndefined(body?.rememberToken) &&
      body?.username === undefined &&
      body?.password === undefined;

    if (!passwordLogin && !twoFactorLogin) {
      response.status(HttpStatus.BAD_REQUEST).json({
        code: HttpStatus.BAD_REQUEST,
        status: 'PARAM_ERROR',
        message: 'Invalid login request.',
      });
      return;
    }

    try {
      const result = passwordLogin
        ? await this.loginService.login(
            body.username!,
            body.password!,
            rememberToken,
            selectTrustedDeviceCookie(request.headers.cookie),
          )
        : await this.loginService.verifyTwoFactor(
            body.transactionId!,
            body.type!,
            body.code!,
            rememberToken,
          );
      if (result.cookies.length > 0) response.setHeader('Set-Cookie', result.cookies);
      response.status(result.status).json(result.response);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      response.status(timedOut ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY).json({
        code: timedOut ? HttpStatus.GATEWAY_TIMEOUT : HttpStatus.BAD_GATEWAY,
        status: 'SERVER_UNAVAILABLE',
        message: timedOut
          ? 'Authentication service timed out.'
          : 'Authentication service is unavailable.',
      });
    }
  }
}