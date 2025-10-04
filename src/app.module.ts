import { Module, Logger, DynamicModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { WalModule } from './modules/wal/wal.module';
import { NamespaceModule } from './modules/namespace/namespace.module';
import { ProducersModule } from './modules/producers/producers.module';
// import { ConsumersModule } from './modules/consumers/consumers.module';
// import { TargetsModule } from './modules/targets/targets.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';

import configuration from './config/configuration';

@Module({})
export class AppModule {
  static register(): DynamicModule {
    const logger = new Logger('AppModule');
    const skipDb = process.env.SKIP_DB === 'true';
    if (skipDb) {
      logger.warn('SKIP_DB enabled: Database initialization will be skipped.');
    }

    const imports: DynamicModule['imports'] = [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [configuration],
        cache: true,
      }),
      // Rate limiting
      ThrottlerModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => [
          {
            ttl: configService.get('rateLimit.ttl') || 60000,
            limit: configService.get('rateLimit.limit') || 100,
          },
        ],
        inject: [ConfigService],
      }),
      TerminusModule,
      ScheduleModule.forRoot(),
      WalModule,
      NamespaceModule.forRoot(),
      ProducersModule.forRoot({ isGlobal: true }),
      MonitoringModule.forRoot(),
    ];

    if (!skipDb) {
  void imports.splice(
        1,
        0,
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get('database.host'),
            port: configService.get('database.port'),
            username: configService.get('database.username'),
            password: configService.get('database.password'),
            database: configService.get('database.database'),
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
            synchronize: configService.get('database.synchronize'),
            logging: configService.get('database.logging'),
            ssl: configService.get('database.ssl'),
            autoLoadEntities: true,
          }),
          inject: [ConfigService],
        }),
      );
    } else {
      logger.warn('TypeORM module not loaded (SKIP_DB=true).');
    }

    return {
      module: AppModule,
      imports,
    };
  }
}
