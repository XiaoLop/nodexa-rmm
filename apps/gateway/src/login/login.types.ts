import { ApiProperty } from '@nestjs/swagger';

export class LoginRequest {
  @ApiProperty({
    description: '登录动作。login 表示账号密码登录，tokenlogin 表示提交二次验证码。',
    example: 'login',
    enum: ['login', 'tokenlogin'],
  })
  action!: 'login' | 'tokenlogin';

  @ApiProperty({
    description: 'MeshCentral 用户名。action=login 时必填，最长 64 个字符。',
    example: 'admin',
    maxLength: 64,
    required: false,
  })
  username?: string;

  @ApiProperty({
    description: 'MeshCentral 用户密码。action=login 时必填，最长 256 个字符。',
    example: 'password',
    maxLength: 256,
    format: 'password',
    required: false,
  })
  password?: string;

  @ApiProperty({
    description: '二次验证码。action=tokenlogin 时必填，最长 50 个字符。',
    example: '123456',
    maxLength: 50,
    required: false,
  })
  token?: string;

  @ApiProperty({
    description: '可选的硬件令牌或 WebAuthn 相关值，由 MeshCentral 登录流程提供。',
    example: '',
    maxLength: 512,
    required: false,
  })
  hwtoken?: string;
}

export class LoginCandidateResponse {
  @ApiProperty({
    description: '候选会话尚未完成最终认证，因此固定为 null。',
    example: null,
    nullable: true,
    type: String,
  })
  authenticated!: null;

  @ApiProperty({
    description: '候选登录结果说明。客户端必须继续连接控制 WebSocket 验证会话。',
    example: 'Login response accepted; control channel validation is required.',
  })
  message!: string;
}

export class LoginErrorResponse {
  @ApiProperty({
    description: '认证失败时固定为 false。',
    example: false,
    enum: [false],
  })
  authenticated!: false;

  @ApiProperty({
    description:
      '稳定的认证错误码。客户端应根据此字段展示提示或决定是否允许重试，不应解析 message 文本。',
    enum: [
      'VALIDATION_ERROR',
      'INVALID_CREDENTIALS',
      'MFA_REQUIRED',
      'MFA_INVALID',
      'PASSWORD_CHANGE_REQUIRED',
      'AUTH_METHOD_REQUIRED',
      'RATE_LIMITED',
      'SESSION_REJECTED',
      'UPSTREAM_UNAVAILABLE',
      'UPSTREAM_TIMEOUT',
      'UPSTREAM_PROTOCOL_ERROR',
      'GATEWAY_UNAVAILABLE',
      'UNKNOWN_AUTH_ERROR',
    ],
    example: 'VALIDATION_ERROR',
  })
  code!:
    | 'VALIDATION_ERROR'
    | 'INVALID_CREDENTIALS'
    | 'MFA_REQUIRED'
    | 'MFA_INVALID'
    | 'PASSWORD_CHANGE_REQUIRED'
    | 'AUTH_METHOD_REQUIRED'
    | 'RATE_LIMITED'
    | 'SESSION_REJECTED'
    | 'UPSTREAM_UNAVAILABLE'
    | 'UPSTREAM_TIMEOUT'
    | 'UPSTREAM_PROTOCOL_ERROR'
    | 'GATEWAY_UNAVAILABLE'
    | 'UNKNOWN_AUTH_ERROR';

  @ApiProperty({
    description: '适合展示或记录的错误摘要，不包含密码、Cookie 或二次验证码。',
    example: 'Invalid login request.',
  })
  message!: string;

  @ApiProperty({
    description: '是否适合在不修改请求参数的情况下重试。',
    example: false,
  })
  retryable!: boolean;
}
