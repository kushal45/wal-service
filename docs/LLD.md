# Generic Write-Ahead Log (WAL) Service - Low-Level Design (LLD)

**Version:** 1.0  
**Date:** October 3, 2025  
**Authors:** Senior Software Engineer, Senior Software Architect  
**Technology Stack:** NestJS, TypeScript, Node.js

---

## Table of Contents

1. [NestJS Application Structure](#1-nestjs-application-structure)
2. [Module Architecture](#2-module-architecture)
3. [Controllers Implementation](#3-controllers-implementation)
4. [Services Implementation](#4-services-implementation)
5. [Data Transfer Objects (DTOs)](#5-data-transfer-objects-dtos)
6. [Entity Models](#6-entity-models)
7. [Interfaces and Types](#7-interfaces-and-types)
8. [Error Handling & Validation](#8-error-handling--validation)
9. [Dependency Injection Strategy](#9-dependency-injection-strategy)
10. [Configuration Management](#10-configuration-management)
11. [Testing Strategy](#11-testing-strategy)

---

## 1. NestJS Application Structure

### 1.1 Project Directory Structure

```
src/
├── app.module.ts                    # Root module with all imports
├── main.ts                          # Application bootstrap with global pipes
├── common/                          # Shared utilities across modules
│   ├── decorators/
│   │   ├── api-key-auth.decorator.ts
│   │   ├── namespace-validation.decorator.ts
│   │   └── metrics.decorator.ts
│   ├── filters/
│   │   ├── all-exceptions.filter.ts
│   │   ├── validation-exception.filter.ts
│   │   └── business-logic-exception.filter.ts
│   ├── guards/
│   │   ├── api-key.guard.ts
│   │   ├── namespace-access.guard.ts
│   │   └── rate-limit.guard.ts
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   ├── metrics.interceptor.ts
│   │   ├── request-id.interceptor.ts
│   │   └── timeout.interceptor.ts
│   ├── pipes/
│   │   ├── validation.pipe.ts
│   │   └── transform.pipe.ts
│   ├── types/
│   │   ├── common.types.ts
│   │   ├── message.types.ts
│   │   └── error.types.ts
│   └── utils/
│       ├── id-generator.util.ts
│       ├── hash.util.ts
│       └── retry.util.ts
├── config/
│   ├── configuration.ts             # Environment-based configuration
│   ├── database.config.ts           # Database connection settings
│   ├── kafka.config.ts              # Kafka cluster configuration
│   ├── sqs.config.ts                # AWS SQS configuration
│   ├── redis.config.ts              # Redis configuration
│   └── validation.schema.ts         # Joi validation schemas
├── modules/
│   ├── wal/                         # Core WAL functionality
│   │   ├── wal.module.ts
│   │   ├── controllers/
│   │   │   ├── wal.controller.ts
│   │   │   └── wal.controller.spec.ts
│   │   ├── services/
│   │   │   ├── wal.service.ts
│   │   │   ├── wal.service.spec.ts
│   │   │   ├── message-router.service.ts
│   │   │   ├── lifecycle.service.ts
│   │   │   └── transaction-orchestrator.service.ts
│   │   ├── dto/
│   │   │   ├── write-to-log.dto.ts
│   │   │   ├── write-to-log-response.dto.ts
│   │   │   ├── lifecycle-config.dto.ts
│   │   │   └── target-config.dto.ts
│   │   ├── types/
│   │   │   ├── enriched-message.type.ts
│   │   │   ├── routing-result.type.ts
│   │   │   └── transaction.types.ts
│   │   └── enums/
│   │       ├── durability-status.enum.ts
│   │       └── message-status.enum.ts
│   ├── namespace/
│   │   ├── namespace.module.ts
│   │   ├── services/
│   │   │   ├── namespace.service.ts
│   │   │   ├── namespace-config-loader.service.ts
│   │   │   └── namespace-validator.service.ts
│   │   ├── entities/
│   │   │   └── namespace.entity.ts
│   │   ├── dto/
│   │   │   ├── namespace-config.dto.ts
│   │   │   └── namespace-status.dto.ts
│   │   └── repositories/
│   │       └── namespace.repository.ts
│   ├── producers/
│   │   ├── producers.module.ts
│   │   ├── services/
│   │   │   └── producer-factory.service.ts
│   │   ├── kafka/
│   │   │   ├── kafka-producer.service.ts
│   │   │   └── kafka-admin.service.ts
│   │   ├── sqs/
│   │   │   └── sqs-producer.service.ts
│   │   ├── redis/
│   │   │   └── redis-producer.service.ts
│   │   └── interfaces/
│   │       ├── producer.interface.ts
│   │       └── producer-config.interface.ts
│   ├── consumers/
│   │   ├── consumers.module.ts
│   │   ├── services/
│   │   │   ├── consumer-orchestrator.service.ts
│   │   │   └── dlq-manager.service.ts
│   │   ├── handlers/
│   │   │   ├── kafka-consumer.service.ts
│   │   │   ├── sqs-consumer.service.ts
│   │   │   └── redis-consumer.service.ts
│   │   ├── processors/
│   │   │   ├── wal-message.processor.ts
│   │   │   ├── dlq.processor.ts
│   │   │   ├── retry.processor.ts
│   │   │   └── transaction.processor.ts
│   │   └── interfaces/
│   │       ├── consumer.interface.ts
│   │       └── message-handler.interface.ts
│   ├── targets/
│   │   ├── targets.module.ts
│   │   ├── services/
│   │   │   └── target-adapter-factory.service.ts
│   │   ├── database/
│   │   │   ├── database-target-adapter.service.ts
│   │   │   ├── postgres-adapter.service.ts
│   │   │   ├── mongodb-adapter.service.ts
│   │   │   └── cassandra-adapter.service.ts
│   │   ├── cache/
│   │   │   ├── cache-target-adapter.service.ts
│   │   │   ├── redis-adapter.service.ts
│   │   │   └── memcached-adapter.service.ts
│   │   ├── http/
│   │   │   ├── http-target-adapter.service.ts
│   │   │   └── grpc-adapter.service.ts
│   │   └── interfaces/
│   │       ├── target-adapter.interface.ts
│   │       └── target-config.interface.ts
│   └── monitoring/
│       ├── monitoring.module.ts
│       ├── controllers/
│       │   ├── health.controller.ts
│       │   └── metrics.controller.ts
│       ├── services/
│       │   ├── health.service.ts
│       │   ├── metrics.service.ts
│       │   └── alerting.service.ts
│       └── indicators/
│           ├── database-health.indicator.ts
│           ├── kafka-health.indicator.ts
│           ├── sqs-health.indicator.ts
│           └── memory-health.indicator.ts
└── database/
    ├── migrations/
    ├── seeds/
    └── factories/
```

### 1.2 Application Bootstrap

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as compression from 'compression';
import * as helmet from 'helmet';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Winston logger configuration
  const winstonLogger = WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(({ level, message, timestamp, context, trace }) => {
            return `${timestamp} [${context}] ${level}: ${message}${trace ? `\n${trace}` : ''}`;
          }),
        ),
      }),
      new winston.transports.File({
        filename: 'logs/wal-service.log',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    ],
  });

  const app = await NestFactory.create(AppModule, {
    logger: winstonLogger,
  });

  const configService = app.get(ConfigService);

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Global pipes for validation and transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: configService.get('NODE_ENV') === 'production',
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // Global filters for exception handling
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors
  app.useGlobalInterceptors(
    new RequestIdInterceptor(),
    new LoggingInterceptor(),
    new TimeoutInterceptor(30000), // 30 second timeout
  );

  // Swagger documentation
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('WAL Service API')
      .setDescription('Generic Write-Ahead Log Service for reliable message processing')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, 'api-key')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Enable CORS for cross-origin requests
  app.enableCors({
    origin: configService.get('CORS_ORIGINS')?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  });

  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  logger.log(`WAL Service is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
```

---

## 2. Module Architecture

### 2.1 Root Application Module

```typescript
// app.module.ts
import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';
import { BullModule } from '@nestjs/bull';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

import { WalModule } from './modules/wal/wal.module';
import { NamespaceModule } from './modules/namespace/namespace.module';
import { ProducersModule } from './modules/producers/producers.module';
import { ConsumersModule } from './modules/consumers/consumers.module';
import { TargetsModule } from './modules/targets/targets.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';

import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    // Configuration management
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      cache: true,
    }),

    // Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST'),
        port: configService.get('DATABASE_PORT'),
        username: configService.get('DATABASE_USERNAME'),
        password: configService.get('DATABASE_PASSWORD'),
        database: configService.get('DATABASE_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('DATABASE_LOGGING') === 'true',
        ssl: configService.get('DATABASE_SSL') === 'true',
        extra: {
          max: configService.get('DATABASE_MAX_CONNECTIONS') || 10,
          min: configService.get('DATABASE_MIN_CONNECTIONS') || 2,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
      inject: [ConfigService],
    }),

    // Bull queue for background job processing
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          db: configService.get('REDIS_DB') || 0,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ttl: configService.get('THROTTLE_TTL') || 60,
        limit: configService.get('THROTTLE_LIMIT') || 100,
      }),
      inject: [ConfigService],
    }),

    // Prometheus metrics
    PrometheusModule.register({
      defaultLabels: {
        service: 'wal-service',
        version: process.env.npm_package_version || '1.0.0',
      },
    }),

    // Health checks
    TerminusModule,

    // Scheduled tasks
    ScheduleModule.forRoot(),

    // Application modules
    WalModule,
    NamespaceModule,
    ProducersModule.forRoot(),
    ConsumersModule,
    TargetsModule,
    MonitoringModule,
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
```

### 2.2 WAL Core Module

```typescript
// modules/wal/wal.module.ts
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { WalController } from './controllers/wal.controller';
import { WalService } from './services/wal.service';
import { MessageRouterService } from './services/message-router.service';
import { LifecycleService } from './services/lifecycle.service';
import { TransactionOrchestratorService } from './services/transaction-orchestrator.service';

import { NamespaceModule } from '../namespace/namespace.module';
import { ProducersModule } from '../producers/producers.module';
import { ConsumersModule } from '../consumers/consumers.module';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'wal-processing',
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      },
      {
        name: 'wal-delayed',
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 10,
        },
      },
      {
        name: 'wal-transactions',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 20,
        },
      },
    ),
    NamespaceModule,
    ProducersModule,
    ConsumersModule,
  ],
  controllers: [WalController],
  providers: [
    WalService,
    MessageRouterService,
    LifecycleService,
    TransactionOrchestratorService,
  ],
  exports: [WalService, MessageRouterService],
})
export class WalModule {}
```

---

## 3. Controllers Implementation

### 3.1 WAL Controller

```typescript
// modules/wal/controllers/wal.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UsePipes,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';

import { WalService } from '../services/wal.service';
import { WriteToLogDto } from '../dto/write-to-log.dto';
import { WriteToLogResponseDto } from '../dto/write-to-log-response.dto';
import { NamespaceStatusDto } from '../dto/namespace-status.dto';
import { TransactionStatusDto } from '../dto/transaction-status.dto';

import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { NamespaceAccessGuard } from '../../common/guards/namespace-access.guard';
import { LoggingInterceptor } from '../../common/interceptors/logging.interceptor';
import { MetricsInterceptor } from '../../common/interceptors/metrics.interceptor';
import { ValidationPipe } from '../../common/pipes/validation.pipe';
import { RequestId } from '../../common/decorators/request-id.decorator';
import { ApiKeyAuth } from '../../common/decorators/api-key-auth.decorator';

@ApiTags('WAL Service')
@Controller('wal')
@UseGuards(ThrottlerGuard, ApiKeyGuard)
@UseInterceptors(LoggingInterceptor, MetricsInterceptor)
@ApiBearerAuth()
@ApiSecurity('api-key')
export class WalController {
  private readonly logger = new Logger(WalController.name);

  constructor(private readonly walService: WalService) {}

  @Post('write')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(NamespaceAccessGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Write message to WAL',
    description: 'Submits a message for processing through the Write-Ahead Log system',
  })
  @ApiResponse({
    status: 202,
    description: 'Message accepted for processing',
    type: WriteToLogResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request format or namespace not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid API key',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - no access to namespace',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async writeToLog(
    @Body() writeToLogDto: WriteToLogDto,
    @RequestId() requestId: string,
    @ApiKeyAuth() apiKey: string,
  ): Promise<WriteToLogResponseDto> {
    this.logger.log(
      `Processing WriteToLog request for namespace: ${writeToLogDto.namespace}`,
      { requestId, namespace: writeToLogDto.namespace },
    );

    try {
      const result = await this.walService.writeToLog(writeToLogDto, {
        requestId,
        apiKey,
        timestamp: new Date(),
      });

      this.logger.log(
        `WriteToLog request processed successfully: ${result.messageId}`,
        { requestId, messageId: result.messageId },
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error processing WriteToLog request: ${error.message}`,
        { requestId, namespace: writeToLogDto.namespace, error: error.stack },
      );
      throw error;
    }
  }

  @Get('namespace/:namespace/status')
  @UseGuards(NamespaceAccessGuard)
  @ApiOperation({
    summary: 'Get namespace status',
    description: 'Retrieves the current status and health of a specific namespace',
  })
  @ApiParam({
    name: 'namespace',
    description: 'Namespace identifier',
    example: 'user-cache-replication',
  })
  @ApiResponse({
    status: 200,
    description: 'Namespace status retrieved successfully',
    type: NamespaceStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Namespace not found',
  })
  async getNamespaceStatus(
    @Param('namespace') namespace: string,
    @RequestId() requestId: string,
  ): Promise<NamespaceStatusDto> {
    this.logger.log(`Fetching status for namespace: ${namespace}`, {
      requestId,
      namespace,
    });

    return this.walService.getNamespaceStatus(namespace);
  }

  @Get('transaction/:transactionId/status')
  @ApiOperation({
    summary: 'Get transaction status',
    description: 'Retrieves the status of a multi-partition transaction',
  })
  @ApiParam({
    name: 'transactionId',
    description: 'Transaction identifier',
    example: 'txn_1696291200000_abc123',
  })
  @ApiResponse({
    status: 200,
    description: 'Transaction status retrieved successfully',
    type: TransactionStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found',
  })
  async getTransactionStatus(
    @Param('transactionId') transactionId: string,
    @RequestId() requestId: string,
  ): Promise<TransactionStatusDto> {
    this.logger.log(`Fetching status for transaction: ${transactionId}`, {
      requestId,
      transactionId,
    });

    return this.walService.getTransactionStatus(transactionId);
  }

  @Get('namespace/:namespace/metrics')
  @UseGuards(NamespaceAccessGuard)
  @ApiOperation({
    summary: 'Get namespace metrics',
    description: 'Retrieves performance metrics for a specific namespace',
  })
  @ApiParam({
    name: 'namespace',
    description: 'Namespace identifier',
  })
  @ApiQuery({
    name: 'from',
    description: 'Start time for metrics (ISO 8601)',
    required: false,
  })
  @ApiQuery({
    name: 'to',
    description: 'End time for metrics (ISO 8601)',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Namespace metrics retrieved successfully',
  })
  async getNamespaceMetrics(
    @Param('namespace') namespace: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @RequestId() requestId: string,
  ): Promise<any> {
    this.logger.log(`Fetching metrics for namespace: ${namespace}`, {
      requestId,
      namespace,
      from,
      to,
    });

    return this.walService.getNamespaceMetrics(namespace, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }
}
```

---

## 4. Services Implementation

### 4.1 WAL Core Service

```typescript
// modules/wal/services/wal.service.ts
import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

import { WriteToLogDto } from '../dto/write-to-log.dto';
import { WriteToLogResponseDto } from '../dto/write-to-log-response.dto';
import { NamespaceStatusDto } from '../dto/namespace-status.dto';
import { TransactionStatusDto } from '../dto/transaction-status.dto';
import { DurabilityStatus } from '../enums/durability-status.enum';
import { EnrichedMessage } from '../types/enriched-message.type';
import { RequestContext } from '../types/request-context.type';

import { NamespaceService } from '../../namespace/services/namespace.service';
import { MessageRouterService } from './message-router.service';
import { LifecycleService } from './lifecycle.service';
import { TransactionOrchestratorService } from './transaction-orchestrator.service';
import { IdGeneratorUtil } from '../../common/utils/id-generator.util';

@Injectable()
export class WalService {
  private readonly logger = new Logger(WalService.name);

  constructor(
    private readonly namespaceService: NamespaceService,
    private readonly messageRouter: MessageRouterService,
    private readonly lifecycleService: LifecycleService,
    private readonly transactionOrchestrator: TransactionOrchestratorService,
    @InjectQueue('wal-processing') private readonly walQueue: Queue,
    @InjectQueue('wal-delayed') private readonly delayedQueue: Queue,
    @InjectMetric('wal_requests_total')
    private readonly requestCounter: Counter<string>,
    @InjectMetric('wal_request_duration_seconds')
    private readonly requestDuration: Histogram<string>,
    @InjectMetric('wal_active_messages')
    private readonly activeMessages: Gauge<string>,
  ) {}

  async writeToLog(
    dto: WriteToLogDto,
    context: RequestContext,
  ): Promise<WriteToLogResponseDto> {
    const timer = this.requestDuration.startTimer({
      namespace: dto.namespace,
      operation: this.determineOperation(dto),
    });

    try {
      this.logger.log(
        `Processing WriteToLog request for namespace: ${dto.namespace}`,
        {
          requestId: context.requestId,
          namespace: dto.namespace,
          hasDelay: !!dto.lifecycle?.delay,
          isTransaction: this.isTransactionRequest(dto),
        },
      );

      // Validate namespace existence and configuration
      const namespaceConfig = await this.namespaceService.getNamespace(dto.namespace);
      if (!namespaceConfig) {
        throw new BadRequestException(`Namespace '${dto.namespace}' not found`);
      }

      // Validate request against namespace rules
      await this.namespaceService.validateRequest(dto.namespace, dto);

      // Generate unique message ID
      const messageId = IdGeneratorUtil.generateMessageId();

      // Enrich message with metadata
      const enrichedMessage: EnrichedMessage = {
        ...dto,
        messageId,
        timestamp: context.timestamp,
        requestId: context.requestId,
        version: '1.0',
        attemptCount: 0,
        status: 'pending',
      };

      let durabilityStatus: DurabilityStatus;
      let transactionId: string | undefined;

      // Determine processing strategy based on request type
      if (this.isTransactionRequest(dto)) {
        // Multi-partition transaction processing
        transactionId = await this.transactionOrchestrator.createTransaction(
          enrichedMessage,
        );
        durabilityStatus = DurabilityStatus.TRUE;
      } else if (dto.lifecycle?.delay && dto.lifecycle.delay > 0) {
        // Delayed processing
        await this.lifecycleService.scheduleDelayed(
          enrichedMessage,
          dto.lifecycle.delay,
        );
        durabilityStatus = DurabilityStatus.UNKNOWN;
      } else {
        // Immediate processing
        const result = await this.messageRouter.route(dto.namespace, enrichedMessage);
        durabilityStatus = result.durable
          ? DurabilityStatus.TRUE
          : DurabilityStatus.FALSE;
      }

      // Update metrics
      this.requestCounter.inc({
        namespace: dto.namespace,
        status: 'success',
        operation: this.determineOperation(dto),
      });

      this.activeMessages.inc({
        namespace: dto.namespace,
      });

      const response: WriteToLogResponseDto = {
        durable: durabilityStatus,
        messageId,
        transactionId,
        message: 'Message accepted for processing',
        timestamp: context.timestamp,
      };

      this.logger.log(
        `WriteToLog request processed successfully: ${messageId}`,
        {
          requestId: context.requestId,
          messageId,
          transactionId,
          durabilityStatus,
        },
      );

      return response;
    } catch (error) {
      this.requestCounter.inc({
        namespace: dto.namespace,
        status: 'error',
        operation: this.determineOperation(dto),
      });

      this.logger.error(
        `Error processing WriteToLog request: ${error.message}`,
        {
          requestId: context.requestId,
          namespace: dto.namespace,
          error: error.stack,
        },
      );

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to process WAL request');
    } finally {
      timer();
    }
  }

  async getNamespaceStatus(namespace: string): Promise<NamespaceStatusDto> {
    const namespaceConfig = await this.namespaceService.getNamespace(namespace);
    if (!namespaceConfig) {
      throw new NotFoundException(`Namespace '${namespace}' not found`);
    }

    // Gather status from various components
    const [producerStatus, consumerStatus, queueStatus] = await Promise.all([
      this.messageRouter.getProducerHealth(namespace),
      this.lifecycleService.getConsumerHealth(namespace),
      this.getQueueStatus(namespace),
    ]);

    return {
      namespace,
      status: this.aggregateHealthStatus([producerStatus, consumerStatus, queueStatus]),
      components: {
        producer: producerStatus,
        consumer: consumerStatus,
        queue: queueStatus,
      },
      configuration: {
        backend: namespaceConfig.backend,
        enabled: namespaceConfig.enabled,
        maxRetries: namespaceConfig.retryPolicy.maxAttempts,
      },
      lastUpdated: new Date(),
    };
  }

  async getTransactionStatus(transactionId: string): Promise<TransactionStatusDto> {
    return this.transactionOrchestrator.getTransactionStatus(transactionId);
  }

  async getNamespaceMetrics(
    namespace: string,
    timeRange: { from?: Date; to?: Date },
  ): Promise<any> {
    // Implementation would gather metrics from Prometheus or internal stores
    return {
      namespace,
      timeRange,
      metrics: {
        totalRequests: 1000,
        successRate: 0.995,
        averageLatency: 45,
        errorRate: 0.005,
        throughput: 100,
      },
    };
  }

  private determineOperation(dto: WriteToLogDto): string {
    if (this.isTransactionRequest(dto)) {
      return 'transaction';
    } else if (dto.lifecycle?.delay && dto.lifecycle.delay > 0) {
      return 'delayed';
    } else if (dto.target?.type === 'cache' && dto.target?.config?.regions?.length > 1) {
      return 'replication';
    }
    return 'immediate';
  }

  private isTransactionRequest(dto: WriteToLogDto): boolean {
    return Array.isArray(dto.payload?.transactions) && dto.payload.transactions.length > 1;
  }

  private aggregateHealthStatus(statuses: string[]): string {
    if (statuses.every(status => status === 'healthy')) {
      return 'healthy';
    } else if (statuses.some(status => status === 'healthy')) {
      return 'degraded';
    }
    return 'unhealthy';
  }

  private async getQueueStatus(namespace: string): Promise<string> {
    try {
      const [processingCount, delayedCount] = await Promise.all([
        this.walQueue.getWaiting(),
        this.delayedQueue.getWaiting(),
      ]);

      const totalWaiting = processingCount.length + delayedCount.length;
      
      if (totalWaiting < 100) {
        return 'healthy';
      } else if (totalWaiting < 1000) {
        return 'degraded';
      }
      return 'unhealthy';
    } catch (error) {
      this.logger.error(`Error checking queue status: ${error.message}`);
      return 'unknown';
    }
  }
}
```

### 4.2 Message Router Service

```typescript
// modules/wal/services/message-router.service.ts
import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

import { EnrichedMessage } from '../types/enriched-message.type';
import { RoutingResult } from '../types/routing-result.type';
import { RoutingStrategy } from '../enums/routing-strategy.enum';

import { NamespaceService } from '../../namespace/services/namespace.service';
import { ProducerFactory } from '../../producers/services/producer-factory.service';
import { HashUtil } from '../../common/utils/hash.util';

@Injectable()
export class MessageRouterService {
  private readonly logger = new Logger(MessageRouterService.name);
  private readonly routingCounters = new Map<string, number>();

  constructor(
    private readonly namespaceService: NamespaceService,
    private readonly producerFactory: ProducerFactory,
    @InjectMetric('wal_routing_duration_seconds')
    private readonly routingDuration: Histogram<string>,
    @InjectMetric('wal_routing_total')
    private readonly routingCounter: Counter<string>,
  ) {}

  async route(namespace: string, message: EnrichedMessage): Promise<RoutingResult> {
    const timer = this.routingDuration.startTimer({
      namespace,
      backend: await this.getBackendType(namespace),
    });

    try {
      this.logger.log(`Routing message ${message.messageId} for namespace: ${namespace}`, {
        messageId: message.messageId,
        namespace,
        requestId: message.requestId,
      });

      // Get namespace configuration
      const namespaceConfig = await this.namespaceService.getNamespace(namespace);
      
      // Get appropriate producer
      const producer = this.producerFactory.getProducer(namespaceConfig.backend);

      // Calculate routing key based on strategy
      const routingKey = this.calculateRoutingKey(message, namespaceConfig.shardConfig);
      
      // Prepare message for publishing
      const messagePayload = {
        topic: namespaceConfig.topicName,
        key: routingKey,
        value: JSON.stringify({
          messageId: message.messageId,
          namespace: message.namespace,
          payload: message.payload,
          target: message.target,
          lifecycle: message.lifecycle,
          metadata: {
            ...message.metadata,
            requestId: message.requestId,
            version: message.version,
            timestamp: message.timestamp,
            attemptCount: message.attemptCount,
          },
        }),
        headers: {
          'content-type': 'application/json',
          'message-id': message.messageId,
          'namespace': namespace,
          'version': message.version,
          'request-id': message.requestId,
          'routing-key': routingKey,
        },
      };

      // Send message to backend
      const result = await producer.send(messagePayload);

      this.routingCounter.inc({
        namespace,
        backend: namespaceConfig.backend,
        status: 'success',
      });

      this.logger.log(`Message routed successfully: ${message.messageId}`, {
        messageId: message.messageId,
        namespace,
        partitionId: result.partition,
        offset: result.offset,
        routingKey,
      });

      return {
        durable: true,
        messageId: message.messageId,
        partitionId: result.partition,
        offset: result.offset,
        routingKey,
        backend: namespaceConfig.backend,
      };
    } catch (error) {
      this.routingCounter.inc({
        namespace,
        backend: await this.getBackendType(namespace),
        status: 'error',
      });

      this.logger.error(
        `Error routing message ${message.messageId}: ${error.message}`,
        {
          messageId: message.messageId,
          namespace,
          error: error.stack,
        },
      );

      throw new InternalServerErrorException(
        `Failed to route message: ${error.message}`,
      );
    } finally {
      timer();
    }
  }

  async getProducerHealth(namespace: string): Promise<string> {
    try {
      const namespaceConfig = await this.namespaceService.getNamespace(namespace);
      const producer = this.producerFactory.getProducer(namespaceConfig.backend);
      
      const isHealthy = await producer.healthCheck();
      return isHealthy ? 'healthy' : 'unhealthy';
    } catch (error) {
      this.logger.error(`Error checking producer health for namespace ${namespace}: ${error.message}`);
      return 'error';
    }
  }

  private calculateRoutingKey(
    message: EnrichedMessage,
    shardConfig: any,
  ): string {
    const strategy = shardConfig?.strategy || RoutingStrategy.HASH;

    switch (strategy) {
      case RoutingStrategy.HASH:
        return this.hashBasedRouting(message.payload, shardConfig.partitionCount);
        
      case RoutingStrategy.ROUND_ROBIN:
        return this.roundRobinRouting(message.namespace, shardConfig.partitionCount);
        
      case RoutingStrategy.RANDOM:
        return this.randomRouting(shardConfig.partitionCount);
        
      case RoutingStrategy.CUSTOM:
        return this.customRouting(message, shardConfig);
        
      default:
        return message.messageId;
    }
  }

  private hashBasedRouting(payload: any, partitionCount: number): string {
    const payloadHash = HashUtil.hash(JSON.stringify(payload));
    const partition = payloadHash % partitionCount;
    return partition.toString();
  }

  private roundRobinRouting(namespace: string, partitionCount: number): string {
    const currentCount = this.routingCounters.get(namespace) || 0;
    const nextCount = (currentCount + 1) % partitionCount;
    this.routingCounters.set(namespace, nextCount);
    return nextCount.toString();
  }

  private randomRouting(partitionCount: number): string {
    return Math.floor(Math.random() * partitionCount).toString();
  }

  private customRouting(message: EnrichedMessage, shardConfig: any): string {
    // Implementation of custom routing logic based on shardConfig.customLogic
    // This could include business-specific routing rules
    const customKey = shardConfig.customLogic?.extractKey?.(message.payload);
    if (customKey) {
      return HashUtil.hash(customKey).toString();
    }
    return this.hashBasedRouting(message.payload, shardConfig.partitionCount);
  }

  private async getBackendType(namespace: string): Promise<string> {
    try {
      const config = await this.namespaceService.getNamespace(namespace);
      return config?.backend || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
```

---

## 5. Data Transfer Objects (DTOs)

### 5.1 Core Request/Response DTOs

```typescript
// modules/wal/dto/write-to-log.dto.ts
import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  IsNotEmpty,
  IsArray,
  ArrayNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { LifecycleConfigDto } from './lifecycle-config.dto';
import { TargetConfigDto } from './target-config.dto';

export class WriteToLogDto {
  @ApiProperty({
    description: 'Namespace identifier for WAL configuration',
    example: 'user-cache-replication',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value?.trim().toLowerCase())
  namespace: string;

  @ApiPropertyOptional({
    description: 'Lifecycle configuration for message processing',
    type: LifecycleConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LifecycleConfigDto)
  lifecycle?: LifecycleConfigDto;

  @ApiProperty({
    description: 'Message payload to be processed',
    example: {
      operation: 'SET',
      key: 'user:123',
      value: { name: 'John Doe', email: 'john@example.com' },
    },
  })
  @IsObject()
  @IsNotEmpty()
  payload: Record<string, any>;

  @ApiProperty({
    description: 'Target configuration for message destination',
    oneOf: [
      { $ref: '#/components/schemas/TargetConfigDto' },
      { type: 'array', items: { $ref: '#/components/schemas/TargetConfigDto' } },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => TargetConfigDto)
  target: TargetConfigDto | TargetConfigDto[];

  @ApiPropertyOptional({
    description: 'Additional metadata for message processing',
    example: {
      'user-id': '123',
      'trace-id': 'abc-def-ghi',
      'correlation-id': 'req-456-789',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Message priority (1-10, higher number = higher priority)',
    example: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  priority?: number;

  @ApiPropertyOptional({
    description: 'Tags for message categorization and filtering',
    example: ['user-operation', 'cache-update', 'priority-medium'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
```

```typescript
// modules/wal/dto/write-to-log-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DurabilityStatus } from '../enums/durability-status.enum';

export class WriteToLogResponseDto {
  @ApiProperty({
    description: 'Durability status of the message',
    enum: DurabilityStatus,
    example: DurabilityStatus.TRUE,
  })
  durable: DurabilityStatus;

  @ApiProperty({
    description: 'Unique message identifier',
    example: 'wal_1696291200000_abc123def',
  })
  messageId: string;

  @ApiPropertyOptional({
    description: 'Transaction identifier for multi-partition operations',
    example: 'txn_1696291200000_xyz789',
  })
  transactionId?: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Message accepted for processing',
  })
  message: string;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2025-10-03T10:30:00.000Z',
  })
  timestamp: Date;

  @ApiPropertyOptional({
    description: 'Estimated processing time in milliseconds',
    example: 2000,
  })
  estimatedProcessingTimeMs?: number;

  @ApiPropertyOptional({
    description: 'Queue position for delayed messages',
    example: 15,
  })
  queuePosition?: number;
}
```

### 5.2 Configuration DTOs

```typescript
// modules/wal/dto/lifecycle-config.dto.ts
import {
  IsOptional,
  IsNumber,
  IsPositive,
  IsString,
  IsEnum,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum DelayUnit {
  SECONDS = 'seconds',
  MINUTES = 'minutes',
  HOURS = 'hours',
  DAYS = 'days',
}

export enum BackoffStrategy {
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  CONSTANT = 'constant',
  CUSTOM = 'custom',
}

export class RetryPolicyDto {
  @ApiPropertyOptional({
    description: 'Maximum number of retry attempts',
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  @Transform(({ value }) => parseInt(value, 10))
  maxAttempts?: number;

  @ApiPropertyOptional({
    description: 'Backoff strategy for retries',
    enum: BackoffStrategy,
    example: BackoffStrategy.EXPONENTIAL,
  })
  @IsOptional()
  @IsEnum(BackoffStrategy)
  backoffStrategy?: BackoffStrategy;

  @ApiPropertyOptional({
    description: 'Initial delay in milliseconds',
    example: 1000,
    minimum: 100,
    maximum: 60000,
  })
  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(60000)
  @Transform(({ value }) => parseInt(value, 10))
  initialDelayMs?: number;

  @ApiPropertyOptional({
    description: 'Maximum delay in milliseconds',
    example: 30000,
    minimum: 1000,
    maximum: 300000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  @Transform(({ value }) => parseInt(value, 10))
  maxDelayMs?: number;

  @ApiPropertyOptional({
    description: 'Random jitter in milliseconds',
    example: 500,
    minimum: 0,
    maximum: 5000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5000)
  @Transform(({ value }) => parseInt(value, 10))
  jitterMs?: number;
}

export class LifecycleConfigDto {
  @ApiPropertyOptional({
    description: 'Delay before processing message',
    example: 300,
    minimum: 0,
    maximum: 86400, // 24 hours in seconds
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(86400)
  @Transform(({ value }) => parseInt(value, 10))
  delay?: number;

  @ApiPropertyOptional({
    description: 'Unit for delay specification',
    enum: DelayUnit,
    example: DelayUnit.SECONDS,
  })
  @IsOptional()
  @IsEnum(DelayUnit)
  delayUnit?: DelayUnit;

  @ApiPropertyOptional({
    description: 'Message time-to-live in seconds',
    example: 86400,
    minimum: 60,
    maximum: 604800, // 7 days
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Min(60)
  @Max(604800)
  @Transform(({ value }) => parseInt(value, 10))
  ttl?: number;

  @ApiPropertyOptional({
    description: 'Retry policy configuration',
    type: RetryPolicyDto,
  })
  @IsOptional()
  @Type(() => RetryPolicyDto)
  retryPolicy?: RetryPolicyDto;

  @ApiPropertyOptional({
    description: 'Enable dead letter queue routing',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  enableDLQ?: boolean;

  @ApiPropertyOptional({
    description: 'Message compression enabled',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  compression?: boolean;
}
```

```typescript
// modules/wal/dto/target-config.dto.ts
import {
  IsString,
  IsEnum,
  IsObject,
  IsOptional,
  IsNotEmpty,
  IsUrl,
  IsNumber,
  IsBoolean,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TargetType {
  DATABASE = 'database',
  CACHE = 'cache',
  HTTP_SERVICE = 'http_service',
  GRPC_SERVICE = 'grpc_service',
  QUEUE = 'queue',
  FILE_SYSTEM = 'file_system',
  WEBHOOK = 'webhook',
}

export enum DatabaseType {
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  MONGODB = 'mongodb',
  CASSANDRA = 'cassandra',
  DYNAMODB = 'dynamodb',
  REDIS = 'redis',
}

export enum CacheType {
  REDIS = 'redis',
  MEMCACHED = 'memcached',
  ELASTICACHE = 'elasticache',
  IN_MEMORY = 'in_memory',
}

export class DatabaseConfigDto {
  @ApiProperty({
    description: 'Database type',
    enum: DatabaseType,
    example: DatabaseType.POSTGRESQL,
  })
  @IsEnum(DatabaseType)
  type: DatabaseType;

  @ApiProperty({
    description: 'Database host',
    example: 'localhost',
  })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiProperty({
    description: 'Database port',
    example: 5432,
  })
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  port: number;

  @ApiProperty({
    description: 'Database name',
    example: 'wal_targets',
  })
  @IsString()
  @IsNotEmpty()
  database: string;

  @ApiPropertyOptional({
    description: 'Table or collection name',
    example: 'user_events',
  })
  @IsOptional()
  @IsString()
  table?: string;

  @ApiPropertyOptional({
    description: 'Connection timeout in milliseconds',
    example: 5000,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  timeoutMs?: number;
}

export class CacheConfigDto {
  @ApiProperty({
    description: 'Cache type',
    enum: CacheType,
    example: CacheType.REDIS,
  })
  @IsEnum(CacheType)
  type: CacheType;

  @ApiProperty({
    description: 'Cache server host',
    example: 'redis.example.com',
  })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiProperty({
    description: 'Cache server port',
    example: 6379,
  })
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  port: number;

  @ApiPropertyOptional({
    description: 'Cache database number',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  database?: number;

  @ApiPropertyOptional({
    description: 'Key prefix for cache operations',
    example: 'wal:user:',
  })
  @IsOptional()
  @IsString()
  keyPrefix?: string;

  @ApiPropertyOptional({
    description: 'Default TTL in seconds',
    example: 3600,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  ttlSeconds?: number;
}

export class HttpConfigDto {
  @ApiProperty({
    description: 'HTTP endpoint URL',
    example: 'https://api.example.com/webhooks/wal',
  })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({
    description: 'HTTP method',
    example: 'POST',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  method?: string;

  @ApiPropertyOptional({
    description: 'HTTP headers',
    example: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123',
    },
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Request timeout in milliseconds',
    example: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value, 10))
  timeoutMs?: number;

  @ApiPropertyOptional({
    description: 'Enable request retries',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  retries?: boolean;
}

export class TargetConfigDto {
  @ApiProperty({
    description: 'Type of target system',
    enum: TargetType,
    example: TargetType.CACHE,
  })
  @IsEnum(TargetType)
  type: TargetType;

  @ApiProperty({
    description: 'Target identifier or name',
    example: 'user-cache-primary',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    description: 'Target-specific configuration',
    oneOf: [
      { $ref: '#/components/schemas/DatabaseConfigDto' },
      { $ref: '#/components/schemas/CacheConfigDto' },
      { $ref: '#/components/schemas/HttpConfigDto' },
    ],
  })
  @ValidateNested()
  @Type(() => Object)
  config: DatabaseConfigDto | CacheConfigDto | HttpConfigDto | Record<string, any>;

  @ApiPropertyOptional({
    description: 'Target region for cross-region operations',
    example: 'us-east-1',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: 'Target weight for load balancing (0-100)',
    example: 100,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  weight?: number;

  @ApiPropertyOptional({
    description: 'Enable target for processing',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Target-specific tags',
    example: ['primary', 'high-availability'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
```

---

## 6. Entity Models

### 6.1 Namespace Entity

```typescript
// modules/namespace/entities/namespace.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { TransactionEntity } from '../../wal/entities/transaction.entity';

export enum BackendType {
  KAFKA = 'kafka',
  SQS = 'sqs',
  REDIS_STREAMS = 'redis_streams',
  PULSAR = 'pulsar',
}

export enum RoutingStrategy {
  HASH = 'hash',
  ROUND_ROBIN = 'round_robin',
  RANDOM = 'random',
  CUSTOM = 'custom',
}

@Entity('namespaces')
@Index(['name'], { unique: true })
@Index(['backend', 'enabled'])
@Index(['created_at'])
export class NamespaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: BackendType,
    default: BackendType.KAFKA,
  })
  backend: BackendType;

  @Column({ name: 'topic_name', length: 200 })
  topicName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb' })
  dlqConfig: {
    enabled: boolean;
    topicName?: string;
    maxRetries: number;
    retryBackoffMs: number;
    alertOnDLQ: boolean;
  };

  @Column({ type: 'jsonb' })
  retryPolicy: {
    maxAttempts: number;
    backoffStrategy: 'exponential' | 'linear' | 'constant' | 'custom';
    initialDelayMs: number;
    maxDelayMs: number;
    jitterMs?: number;
    retryableErrorCodes?: string[];
  };

  @Column({ type: 'jsonb' })
  shardConfig: {
    strategy: RoutingStrategy;
    partitionCount: number;
    replicationFactor?: number;
    customLogic?: Record<string, any>;
  };

  @Column({ type: 'jsonb' })
  targetConfigs: Array<{
    type: string;
    identifier: string;
    config: Record<string, any>;
    region?: string;
    weight?: number;
    enabled: boolean;
    tags?: string[];
  }>;

  @Column({ type: 'jsonb', nullable: true })
  backendConfig?: {
    brokers?: string[];
    securityProtocol?: string;
    saslMechanism?: string;
    batchSize?: number;
    lingerMs?: number;
    compressionType?: string;
    acks?: 'all' | 0 | 1;
    maxRequestSize?: number;
    queueUrl?: string;
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    messageRetentionPeriod?: number;
  };

  @Column({ type: 'jsonb', nullable: true })
  accessControl?: {
    allowedApiKeys: string[];
    rateLimits: {
      requestsPerMinute: number;
      requestsPerHour: number;
      burstLimit: number;
    };
    ipWhitelist?: string[];
  };

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'max_message_size', default: 1048576 }) // 1MB default
  maxMessageSize: number;

  @Column({ name: 'message_ttl_seconds', default: 86400 }) // 24 hours default
  messageTtlSeconds: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'created_by', length: 100 })
  createdBy: string;

  @Column({ name: 'updated_by', length: 100 })
  updatedBy: string;

  // Relationships
  @OneToMany(() => TransactionEntity, transaction => transaction.namespace)
  transactions: TransactionEntity[];
}
```

### 6.2 Transaction Entity

```typescript
// modules/wal/entities/transaction.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { NamespaceEntity } from '../../namespace/entities/namespace.entity';
import { TransactionMutationEntity } from './transaction-mutation.entity';

export enum TransactionStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATION_REQUIRED = 'compensation_required',
  COMPENSATED = 'compensated',
  CANCELLED = 'cancelled',
}

@Entity('transactions')
@Index(['status', 'created_at'])
@Index(['namespace_id', 'status'])
@Index(['transaction_id'], { unique: true })
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id', unique: true, length: 100 })
  transactionId: string;

  @Column({ name: 'namespace_id' })
  namespaceId: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.INITIATED,
  })
  status: TransactionStatus;

  @Column({ name: 'total_mutations' })
  totalMutations: number;

  @Column({ name: 'completed_mutations', default: 0 })
  completedMutations: number;

  @Column({ name: 'failed_mutations', default: 0 })
  failedMutations: number;

  @Column({ type: 'jsonb' })
  metadata: {
    requestId: string;
    correlationId?: string;
    userId?: string;
    clientId?: string;
    tags?: string[];
  };

  @Column({ type: 'jsonb', nullable: true })
  compensationData?: {
    compensationStrategy: 'rollback' | 'saga' | 'custom';
    compensationSteps: Array<{
      mutationId: string;
      compensationAction: Record<string, any>;
      status: 'pending' | 'completed' | 'failed';
    }>;
  };

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'timeout_at' })
  timeoutAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => NamespaceEntity, namespace => namespace.transactions)
  @JoinColumn({ name: 'namespace_id' })
  namespace: NamespaceEntity;

  @OneToMany(() => TransactionMutationEntity, mutation => mutation.transaction)
  mutations: TransactionMutationEntity[];
}
```

### 6.3 Transaction Mutation Entity

```typescript
// modules/wal/entities/transaction-mutation.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TransactionEntity } from './transaction.entity';

export enum MutationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated',
}

@Entity('transaction_mutations')
@Index(['transaction_id', 'mutation_order'])
@Index(['status', 'updated_at'])
@Index(['partition_key'])
export class TransactionMutationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mutation_id', unique: true, length: 100 })
  mutationId: string;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @Column({ name: 'mutation_order' })
  mutationOrder: number;

  @Column({ name: 'partition_key', length: 100 })
  partitionKey: string;

  @Column({
    type: 'enum',
    enum: MutationStatus,
    default: MutationStatus.PENDING,
  })
  status: MutationStatus;

  @Column({ type: 'jsonb' })
  payload: {
    operation: string;
    target: Record<string, any>;
    data: Record<string, any>;
    conditions?: Record<string, any>;
  };

  @Column({ type: 'jsonb', nullable: true })
  result?: {
    success: boolean;
    data?: any;
    error?: string;
    executionTimeMs: number;
    retryCount: number;
  };

  @Column({ name: 'attempt_count', default: 0 })
  attemptCount: number;

  @Column({ name: 'max_attempts', default: 3 })
  maxAttempts: number;

  @Column({ name: 'next_retry_at', nullable: true })
  nextRetryAt?: Date;

  @Column({ name: 'started_at', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => TransactionEntity, transaction => transaction.mutations)
  @JoinColumn({ name: 'transaction_id' })
  transaction: TransactionEntity;
}
```

---

## 7. Interfaces and Types

### 7.1 Core Interfaces

```typescript
// modules/producers/interfaces/producer.interface.ts
export interface Producer {
  /**
   * Send a single message to the backend
   */
  send(message: ProducerMessage): Promise<SendResult>;

  /**
   * Send multiple messages in a batch
   */
  sendBatch(messages: ProducerMessage[]): Promise<SendResult[]>;

  /**
   * Send a message with delay
   */
  sendDelayed(message: ProducerMessage, delayMs: number): Promise<SendResult>;

  /**
   * Check if the producer is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get producer metrics
   */
  getMetrics(): Promise<ProducerMetrics>;

  /**
   * Close the producer and clean up resources
   */
  close(): Promise<void>;
}

export interface ProducerMessage {
  topic: string;
  key: string;
  value: string;
  headers?: Record<string, string>;
  partition?: number;
  timestamp?: Date;
}

export interface SendResult {
  messageId: string;
  partition?: number;
  offset?: string | number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ProducerMetrics {
  messagesSent: number;
  messagesFailedToSend: number;
  averageLatencyMs: number;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  lastError?: string;
}
```

```typescript
// modules/consumers/interfaces/consumer.interface.ts
export interface Consumer {
  /**
   * Start consuming messages
   */
  start(): Promise<void>;

  /**
   * Stop consuming messages
   */
  stop(): Promise<void>;

  /**
   * Register a message handler
   */
  registerHandler(handler: MessageHandler): void;

  /**
   * Get consumer health status
   */
  getHealth(): Promise<ConsumerHealth>;

  /**
   * Get consumer metrics
   */
  getMetrics(): Promise<ConsumerMetrics>;
}

export interface MessageHandler {
  /**
   * Handle a received message
   */
  handle(context: MessageContext): Promise<HandleResult>;

  /**
   * Handle errors during message processing
   */
  handleError(context: MessageContext, error: Error): Promise<ErrorHandleResult>;
}

export interface MessageContext {
  messageId: string;
  namespace: string;
  payload: any;
  headers: Record<string, string>;
  metadata: {
    topic: string;
    partition?: number;
    offset?: string | number;
    timestamp: Date;
    attemptCount: number;
  };
}

export interface HandleResult {
  success: boolean;
  data?: any;
  shouldRetry?: boolean;
  retryDelayMs?: number;
}

export interface ErrorHandleResult {
  shouldRetry: boolean;
  retryDelayMs?: number;
  sendToDLQ?: boolean;
  errorMetadata?: Record<string, any>;
}

export interface ConsumerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lag?: number;
  lastProcessedAt?: Date;
  errorRate?: number;
}

export interface ConsumerMetrics {
  messagesProcessed: number;
  messagesSucceeded: number;
  messagesFailed: number;
  averageProcessingTimeMs: number;
  currentLag: number;
  lastProcessedAt: Date;
}
```

### 7.2 Type Definitions

```typescript
// modules/wal/types/enriched-message.type.ts
import { WriteToLogDto } from '../dto/write-to-log.dto';

export interface EnrichedMessage extends WriteToLogDto {
  messageId: string;
  timestamp: Date;
  requestId: string;
  version: string;
  attemptCount: number;
  status: MessageStatus;
  lastAttemptAt?: Date;
  errors?: MessageError[];
  processingTimeMs?: number;
}

export enum MessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  DLQ = 'dlq',
}

export interface MessageError {
  attemptNumber: number;
  error: string;
  timestamp: Date;
  retryable: boolean;
  errorCode?: string;
}
```

---

## 8. Error Handling & Validation

### 8.1 Custom Exception Classes

```typescript
// common/exceptions/wal.exceptions.ts
import { HttpException, HttpStatus } from '@nestjs/common';

export class NamespaceNotFoundException extends HttpException {
  constructor(namespace: string) {
    super(
      {
        error: 'NAMESPACE_NOT_FOUND',
        message: `Namespace '${namespace}' not found`,
        namespace,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class MessageSizeLimitExceededException extends HttpException {
  constructor(actualSize: number, maxSize: number) {
    super(
      {
        error: 'MESSAGE_SIZE_LIMIT_EXCEEDED',
        message: `Message size ${actualSize} bytes exceeds limit of ${maxSize} bytes`,
        actualSize,
        maxSize,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class ProducerUnavailableException extends HttpException {
  constructor(backend: string, error: string) {
    super(
      {
        error: 'PRODUCER_UNAVAILABLE',
        message: `Producer for backend '${backend}' is unavailable: ${error}`,
        backend,
        details: error,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
```

### 8.2 Global Exception Filter

```typescript
// common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.headers['x-request-id'] as string;
    const timestamp = new Date().toISOString();

    let status: number;
    let errorResponse: any;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      errorResponse = {
        success: false,
        error: {
          code: typeof exceptionResponse === 'object' 
            ? (exceptionResponse as any).error || 'HTTP_EXCEPTION'
            : 'HTTP_EXCEPTION',
          message: typeof exceptionResponse === 'object'
            ? (exceptionResponse as any).message || exception.message
            : exceptionResponse,
          details: typeof exceptionResponse === 'object'
            ? exceptionResponse
            : undefined,
        },
        metadata: {
          requestId,
          timestamp,
          path: request.url,
          method: request.method,
        },
      };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
        metadata: {
          requestId,
          timestamp,
          path: request.url,
          method: request.method,
        },
      };
    }

    response.status(status).json(errorResponse);
  }
}
```

---

## 9. Dependency Injection Strategy

### 9.1 Service Factory Pattern

```typescript
// modules/producers/services/producer-factory.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';

import { Producer } from '../interfaces/producer.interface';
import { BackendType } from '../../namespace/entities/namespace.entity';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { SqsProducerService } from '../sqs/sqs-producer.service';

@Injectable()
export class ProducerFactory implements OnModuleInit {
  private readonly logger = new Logger(ProducerFactory.name);
  private readonly producers = new Map<BackendType, Producer>();

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initializeProducers();
  }

  getProducer(backend: BackendType): Producer {
    const producer = this.producers.get(backend);
    if (!producer) {
      throw new Error(`Producer for backend '${backend}' not found`);
    }
    return producer;
  }

  private async initializeProducers() {
    const enabledBackends = this.configService.get<string[]>('ENABLED_BACKENDS') || [
      BackendType.KAFKA,
    ];

    for (const backend of enabledBackends) {
      try {
        let producer: Producer;

        switch (backend) {
          case BackendType.KAFKA:
            producer = this.moduleRef.get(KafkaProducerService, { strict: false });
            break;
          case BackendType.SQS:
            producer = this.moduleRef.get(SqsProducerService, { strict: false });
            break;
          default:
            this.logger.warn(`Unknown backend type: ${backend}`);
            continue;
        }

        this.producers.set(backend as BackendType, producer);
        this.logger.log(`Initialized producer for backend: ${backend}`);
      } catch (error) {
        this.logger.error(`Failed to initialize producer for ${backend}: ${error.message}`);
      }
    }
  }
}
```

---

## 10. Configuration Management

### 10.1 Environment Configuration

```typescript
// config/configuration.ts
import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT, 10) || 5432,
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    name: process.env.DATABASE_NAME || 'wal_service',
    ssl: process.env.DATABASE_SSL === 'true',
  },

  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'wal-service',
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    ssl: process.env.KAFKA_SSL === 'true',
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
  },

  security: {
    apiKeys: process.env.API_KEYS?.split(',') || [],
    jwtSecret: process.env.JWT_SECRET || 'default-secret',
  },
}));
```

---

## 11. Testing Strategy

### 11.1 Unit Test Example

```typescript
// modules/wal/services/wal.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { WalService } from './wal.service';
import { NamespaceService } from '../../namespace/services/namespace.service';
import { MessageRouterService } from './message-router.service';

describe('WalService', () => {
  let service: WalService;
  let namespaceService: jest.Mocked<NamespaceService>;
  let messageRouter: jest.Mocked<MessageRouterService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalService,
        {
          provide: NamespaceService,
          useValue: {
            getNamespace: jest.fn(),
            validateRequest: jest.fn(),
          },
        },
        {
          provide: MessageRouterService,
          useValue: {
            route: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WalService>(WalService);
    namespaceService = module.get(NamespaceService);
    messageRouter = module.get(MessageRouterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should process message successfully', async () => {
    const dto = {
      namespace: 'test-namespace',
      payload: { key: 'value' },
      target: { type: 'cache', identifier: 'redis', config: {} },
    };

    namespaceService.getNamespace.mockResolvedValue({ enabled: true } as any);
    messageRouter.route.mockResolvedValue({ durable: true, messageId: 'test' });

    const result = await service.writeToLog(dto, {
      requestId: 'req-123',
      apiKey: 'key-123',
      timestamp: new Date(),
    });

    expect(result.durable).toBe('true');
    expect(result.messageId).toBeDefined();
  });
});
```

---

**End of Low-Level Design Document**

```

---
