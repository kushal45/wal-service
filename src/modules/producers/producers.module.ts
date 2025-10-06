import { Module, DynamicModule, ModuleMetadata } from '@nestjs/common';
import { makeCounterProvider, makeHistogramProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { ProducerFactoryService } from './services/producer-factory.service';
import { RedisProducerService } from './redis/redis-producer.service';

export interface ProducersModuleOptions {
  isGlobal?: boolean;
}

@Module({})
export class ProducersModule {
  static forRoot(options: ProducersModuleOptions = {}): DynamicModule {
    const module: DynamicModule = {
      module: ProducersModule,
      providers: [
        ProducerFactoryService,
        RedisProducerService,
        // Redis producer metrics
        makeCounterProvider({
          name: 'redis_messages_sent_total',
          help: 'Total number of messages sent to Redis',
          labelNames: ['topic', 'status'],
        }),
        makeHistogramProvider({
          name: 'redis_send_duration_seconds',
          help: 'Redis send operation duration in seconds',
          labelNames: ['topic'],
        }),
        makeGaugeProvider({
          name: 'redis_connection_status',
          help: 'Redis connection status (1=connected, 0=disconnected)',
          labelNames: ['status'],
        }),
      ],
      exports: [
        ProducerFactoryService,
        RedisProducerService,
      ],
    };

    if (options.isGlobal) {
      module.global = true;
    }

    return module;
  }
}