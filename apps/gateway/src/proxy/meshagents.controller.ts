import { Controller, Head, Get, Inject, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { MeshCentralProxyService } from './meshcentral-proxy.service';

@Controller('api/meshagents')
@ApiTags('MeshAgent 下载')
export class MeshAgentsController {
  constructor(
    @Inject(MeshCentralProxyService) private readonly proxyService: MeshCentralProxyService,
  ) {}

  @Get()
  @ApiOperation({
    summary: '代理下载 MeshAgent',
    description: '将下载参数和请求转发到 MeshCentral，并以二进制流返回 MeshAgent 安装包。',
  })
  @ApiProduces('application/octet-stream')
  @ApiOkResponse({ description: 'MeshCentral 返回的 MeshAgent 二进制文件。' })
  get(@Req() request: Request, @Res() response: Response): void {
    this.proxyService.proxyMeshAgents(request, response);
  }

  @Head()
  @ApiOperation({
    summary: '查询 MeshAgent 下载响应头',
    description: '将 HEAD 请求转发到 MeshCentral，用于获取文件类型、大小等下载元数据。',
  })
  @ApiOkResponse({ description: 'MeshCentral 返回的 MeshAgent 下载响应头。' })
  head(@Req() request: Request, @Res() response: Response): void {
    this.proxyService.proxyMeshAgents(request, response);
  }
}
