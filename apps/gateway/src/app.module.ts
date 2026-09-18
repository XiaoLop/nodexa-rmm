import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';

import { GATEWAY_CONFIG, loadGatewayConfig } from './config/gateway-config';
import { HealthController } from './health/health.controller';
import { LoginController } from './login/login.controller';
import { LoginService } from './login/login.service';
import { MeshAgentsController } from './proxy/meshagents.controller';
import { MeshCentralProxyService } from './proxy/meshcentral-proxy.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '.env'),
    }),
  ],
  controllers: [HealthController, LoginController, MeshAgentsController],
  providers: [
    {
      provide: GATEWAY_CONFIG,
      useFactory: () => loadGatewayConfig(),
    },
    LoginService,
    MeshCentralProxyService,
  ],
})
export class AppModule {}
