import { Module, DynamicModule } from '@nestjs/common';
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
      // TypeORM (PostgreSQL) configuration
      TypeOrmModule.forRootAsync({
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          type: 'postgres',
          host: configService.get<string>('database.host'),
          port: configService.get<number>('database.port'),
          username: configService.get<string>('database.username'),
          password: configService.get<string>('database.password'),
          database: configService.get<string>('database.database'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
          synchronize: configService.get<boolean>('database.synchronize'),
          logging: configService.get<boolean>('database.logging'),
          ssl: configService.get('database.ssl'),
          autoLoadEntities: true,
        }),
        inject: [ConfigService],
      }),
      WalModule,
      NamespaceModule.forRoot(),
      ProducersModule.forRoot({ isGlobal: true }),
      MonitoringModule.forRoot(),
    ];

    return {
      module: AppModule,
      imports,
    };
  }
}
