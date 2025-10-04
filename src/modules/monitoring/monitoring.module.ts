import { Module, DynamicModule, Logger } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './controllers/health.controller';
import { HealthService } from './services/health.service';

@Module({})
export class MonitoringModule {
  static forRoot(): DynamicModule {
    const logger = new Logger('MonitoringModule');
    const skipDb = process.env.SKIP_DB === 'true';
    
    if (skipDb) {
      logger.warn('SKIP_DB enabled: MonitoringModule loaded without database dependencies.');
      return {
        module: MonitoringModule,
        imports: [TerminusModule],
        controllers: [HealthController],
        providers: [
          // Provide a simple health service without database dependencies
          {
            provide: HealthService,
            useValue: {
              checkDatabase: () => Promise.resolve({ database: { status: 'up', message: 'Database check skipped (SKIP_DB=true)' } }),
              checkMemory: () => Promise.resolve({ memory: { status: 'up' } }),
              checkStorage: () => Promise.resolve({ storage: { status: 'up' } }),
              checkKafka: () => Promise.resolve({ kafka: { status: 'up', message: 'Kafka check skipped (SKIP_DB=true)' } }),
            },
          },
        ],
        exports: [HealthService],
      };
    }

    return {
      module: MonitoringModule,
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [HealthService],
      exports: [HealthService],
    };
  }
}