import { ApiProperty } from '@nestjs/swagger';

export class PasswordLoginRequest {
  @ApiProperty({ description: 'MeshCentral 用户名。', example: 'admin', maxLength: 64 })
  username!: string;

  @ApiProperty({
    description: 'MeshCentral 用户密码。',
    example: 'password',
    maxLength: 256,
    format: 'password',
  })
  password!: string;

  @ApiProperty({
    description: '成功完成二阶段验证后，是否信任当前设备。',
    example: false,
    required: false,
  })
  rememberToken?: boolean;
}

export class TwoFactorLoginRequest {
  @ApiProperty({ description: '密码验证阶段返回的一次性认证事务。', minLength: 32 })
  transactionId!: string;

  @ApiProperty({ description: '验证方式。', enum: ['totp', 'backup'] })
  type!: 'totp' | 'backup';

  @ApiProperty({ description: 'TOTP 动态口令或备用恢复码。', maxLength: 4096 })
  code!: string;

  @ApiProperty({
    description: '验证成功后是否信任当前设备。',
    example: false,
    required: false,
  })
  rememberToken?: boolean;
}

export class LoginResponse {
  @ApiProperty({
    description: '认证状态。REQUIRE_2FA 表示客户端应提交二阶段验证码。',
    example: 'SUCCESS',
  })
  status!: string;

  @ApiProperty({ description: '适合向用户展示的认证结果。' })
  message!: string;

  @ApiProperty({ description: '认证结果附加数据。', required: false, type: Object })
  data?: Record<string, unknown>;
}

export class LoginErrorResponse extends LoginResponse {
  @ApiProperty({ description: '上游认证服务返回的 HTTP 状态。', example: 401 })
  code!: number;
}