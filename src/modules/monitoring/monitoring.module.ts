import { Module, DynamicModule } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './controllers/health.controller';
import { HealthService } from './services/health.service';

@Module({})
export class MonitoringModule {
  static forRoot(): DynamicModule {
    return {
      module: MonitoringModule,
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [HealthService],
      exports: [HealthService],
    };
  }
}