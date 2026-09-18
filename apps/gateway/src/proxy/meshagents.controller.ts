import { Controller, Head, Get, Inject, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { MeshCentralProxyService } from './meshcentral-proxy.service';

@Controller('api/meshagents')
@ApiTags('MeshAgents')
export class MeshAgentsController {
  constructor(
    @Inject(MeshCentralProxyService) private readonly proxyService: MeshCentralProxyService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Proxy a MeshAgent download request to MeshCentral' })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'Upstream MeshAgent response.' })
  get(@Req() request: Request, @Res() response: Response): void {
    this.proxyService.proxyMeshAgents(request, response);
  }

  @Head()
  @ApiOperation({ summary: 'Proxy MeshAgent response headers from MeshCentral' })
  @ApiOkResponse({ description: 'Upstream MeshAgent response headers.' })
  head(@Req() request: Request, @Res() response: Response): void {
    this.proxyService.proxyMeshAgents(request, response);
  }
}
