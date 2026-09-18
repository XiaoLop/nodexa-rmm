import { ApiProperty } from '@nestjs/swagger';

export class LoginRequest {
  @ApiProperty({ example: 'login', enum: ['login'] })
  action!: 'login';

  @ApiProperty({ example: 'admin', maxLength: 256 })
  username!: string;

  @ApiProperty({ example: 'password', maxLength: 4096, format: 'password' })
  password!: string;
}

export class LoginCandidateResponse {
  @ApiProperty({ example: null, nullable: true, type: String })
  authenticated!: null;

  @ApiProperty({ example: 'Login response accepted; control channel validation is required.' })
  message!: string;
}

export class LoginErrorResponse {
  @ApiProperty({ example: false, enum: [false] })
  authenticated!: false;

  @ApiProperty({
    enum: [
      'VALIDATION_ERROR',
      'UPSTREAM_UNAVAILABLE',
      'UPSTREAM_TIMEOUT',
      'UPSTREAM_PROTOCOL_ERROR',
    ],
    example: 'VALIDATION_ERROR',
  })
  code!:
    'VALIDATION_ERROR' | 'UPSTREAM_UNAVAILABLE' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_PROTOCOL_ERROR';

  @ApiProperty({ example: 'Invalid login request.' })
  message!: string;

  @ApiProperty({ example: false })
  retryable!: boolean;
}
