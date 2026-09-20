import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { GATEWAY_CONFIG, type GatewayConfig } from '../config/gateway-config';

@Controller('health')
@ApiTags('健康检查')
export class HealthController {
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}

  @Get('live')
  @ApiOperation({
    summary: '检查网关进程是否存活',
    description: '仅检查 NestJS 网关进程是否能够响应，不检查 MeshCentral 上游连接。',
  })
  @ApiOkResponse({
    description: '网关进程正在运行。',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: '存活状态。', enum: ['ok'] },
      },
    },
  })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({
    summary: '检查网关就绪状态',
    description: '返回网关就绪状态和当前配置的 MeshCentral 上游地址。',
  })
  @ApiOkResponse({
    description: '网关配置已加载并可以接收请求。',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: '就绪状态。', enum: ['ready'] },
        upstream: {
          type: 'string',
          description: '当前配置的 MeshCentral 上游 Origin。',
          format: 'uri',
          example: 'https://mesh.example.com',
        },
      },
    },
  })
  ready(): { status: 'ready'; upstream: string } {
    return { status: 'ready', upstream: this.config.upstreamBaseUrl.origin };
  }
}
