import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import type { Server } from 'node:http';

import { AppModule } from './app.module';
import { GATEWAY_CONFIG, type GatewayConfig } from './config/gateway-config';
import { MeshCentralProxyService } from './proxy/meshcentral-proxy.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get<GatewayConfig>(GATEWAY_CONFIG);
  app.set('trust proxy', config.trustProxy);
  app.use('/api/login', express.urlencoded({ extended: false, limit: '16kb' }));
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MeshCentral 网关 API')
    .setDescription(
      'MeshCentral Web 控制台网关接口，提供用户认证、服务健康检查、MeshAgent 下载代理等能力。登录接口返回的成功结果仅表示已获得候选会话，最终认证状态需要由控制 WebSocket 验证。',
    )
    .setVersion('0.1.0')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    jsonDocumentUrl: 'api/docs-json',
  });

  const server = app.getHttpServer() as Server;
  const proxyService = app.get(MeshCentralProxyService);
  server.on('upgrade', (request, socket, head) =>
    proxyService.handleUpgrade(request, socket, head),
  );
  await app.listen(config.port);
}

void bootstrap();
