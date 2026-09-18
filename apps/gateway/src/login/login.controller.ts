import { Body, Controller, HttpStatus, Inject, Post, Res } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiGatewayTimeoutResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { LoginService } from './login.service';
import { LoginCandidateResponse, LoginErrorResponse, LoginRequest } from './login.types';

interface LoginBody {
  action?: unknown;
  username?: unknown;
  password?: unknown;
}

function isValidCredential(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

@Controller('api/login')
@ApiTags('Authentication')
export class LoginController {
  constructor(@Inject(LoginService) private readonly loginService: LoginService) {}

  @Post()
  @ApiOperation({
    summary: 'Submit MeshCentral credentials',
    description: 'A successful response is provisional until the control WebSocket validates it.',
  })
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiBody({ type: LoginRequest })
  @ApiOkResponse({ type: LoginCandidateResponse })
  @ApiBadRequestResponse({ type: LoginErrorResponse })
  @ApiBadGatewayResponse({ type: LoginErrorResponse })
  @ApiGatewayTimeoutResponse({ type: LoginErrorResponse })
  async login(@Body() body: LoginBody | undefined, @Res() response: Response): Promise<void> {
    if (
      body?.action !== 'login' ||
      !isValidCredential(body?.username, 256) ||
      !isValidCredential(body?.password, 4096)
    ) {
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
      const result = await this.loginService.login(body.username, body.password);
      if (result.cookies.length > 0) response.setHeader('Set-Cookie', result.cookies);
      if (result.status >= 500) {
        const error: LoginErrorResponse = {
          authenticated: false,
          code: 'UPSTREAM_UNAVAILABLE',
          message: 'Authentication service is unavailable.',
          retryable: true,
        };
        response.status(HttpStatus.BAD_GATEWAY).json(error);
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
