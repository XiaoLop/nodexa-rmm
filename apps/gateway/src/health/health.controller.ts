import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { GATEWAY_CONFIG, type GatewayConfig } from '../config/gateway-config';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  @Get('live')
  @ApiOperation({ summary: 'Check whether the Gateway process is running' })
  @ApiOkResponse({
    schema: { type: 'object', properties: { status: { type: 'string', enum: ['ok'] } } },
  })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check Gateway readiness and report the configured upstream' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['ready'] },
        upstream: { type: 'string', format: 'uri', example: 'https://mesh.example.com' },
      },
    },
  })
  ready(): { status: 'ready'; upstream: string } {
    return { status: 'ready', upstream: this.config.upstreamBaseUrl.origin };
  }
}
