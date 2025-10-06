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
import type { Queue } from 'bull';

import { WriteToLogDto } from '../dto/write-to-log.dto';
import { WriteToLogResponseDto } from '../dto/write-to-log-response.dto';
//import { NamespaceStatusDto } from '../dto/namespace-status.dto';

import { NamespaceService } from '../../namespace/services/namespace.service';
import { MessageRouterService } from './message-router.service';
import { LifecycleService } from './lifecycle.service';
import { TransactionOrchestratorService } from './transaction-orchestrator.service';
import { RequestContext } from '../../../common/types/common.types';
import { IdGeneratorUtil } from '../../../common/utils/id-generator.util';
import { EnrichedMessage } from '../types/enriched-message.type';
import { DurabilityStatus } from '../enums/durability-status.enum';
import {
  NamespaceNotFoundException,
  ProducerUnavailableException,
} from '../../../common/exceptions/wal.exceptions';
import { ProducerFactoryService } from '../../producers/services/producer-factory.service';
import { NamespaceConfigDto } from '../../namespace/dto/namespace-config.dto';
import { IProducer } from '../../producers/interfaces/producer.interface';
import { LifecycleConfigDto, TargetType } from '../dto';
import { DetermineOperationType } from '../enums/operation-type.enum';
import { MessageStatus } from '../enums/message-status.enum';

@Injectable()
export class WalService {
  private readonly logger = new Logger(WalService.name);

  constructor(
    private readonly namespaceService: NamespaceService,
    private readonly messageRouterService: MessageRouterService,
    private readonly lifecycleService: LifecycleService,
    private readonly transactionOrchestratorService: TransactionOrchestratorService,
    @InjectQueue('wal-processing') private readonly walQueue: Queue,
    @InjectQueue('wal-delayed') private readonly delayedQueue: Queue,
    @InjectMetric('wal_requests_total')
    private readonly requestCounter: Counter<string>,
    @InjectMetric('wal_request_duration_seconds')
    private readonly requestDuration: Histogram<string>,
    @InjectMetric('wal_active_messages')
    private readonly activeMessages: Gauge<string>,
    private readonly producerFactory: ProducerFactoryService,
  ) {}

  /**
   * Task 1.1.2: Message Validation & Enrichment
   * Validates and enriches message according to LLD Section 7.2
   */
  async validateAndEnrichMessage(
    dto: WriteToLogDto,
    context: RequestContext,
  ): Promise<{
    enrichedMessage: EnrichedMessage;
    namespaceConfig: NamespaceConfigDto;
  }> {
    this.logger.debug(
      `Validating and enriching message for namespace: ${dto.namespace}`,
      {
        requestId: context.requestId,
        namespace: dto.namespace,
      },
    );

    // Sub-task 1: Namespace Validation (30 min)
    const namespaceConfig = await this.namespaceService.getNamespace(
      dto.namespace,
    );
    if (!namespaceConfig) {
      throw new NamespaceNotFoundException(dto.namespace);
    }

    // Sub-task 5: Access Control Validation (10 min) - validate early
    await this.validateApiKeyAccess(context.apiKey, namespaceConfig);

    // Sub-task 4: Payload Schema Validation (30 min) - validate before enrichment
    if (namespaceConfig.schemaRules) {
      await this.validatePayloadSchema(
        dto.payload,
        namespaceConfig.schemaRules,
      );
    }

    // Sub-task 2: Message ID Generation (20 min)
    const messageId = IdGeneratorUtil.generateMessageId();
    const enrichmentTimestamp = new Date();

    // Sub-task 3: Request Context Enrichment (30 min) - proper field mapping
    const enrichedMessage: EnrichedMessage = {
      // Core message data from DTO
      messageId,
      namespace: dto.namespace,
      payload: dto.payload,
      target: dto.target,
      lifecycle: dto.lifecycle,
      metadata: dto.metadata,
      priority: dto.priority,
      tags: dto.tags,

      // Context enrichment
      apiKey: context.apiKey,
      requestId: context.requestId,

      // Timestamps
      timestamp: enrichmentTimestamp, // When message was enriched

      // Processing metadata
      version: '1.0',
      attemptCount: 0,
      status: MessageStatus.PENDING,

      // Tracing
      correlationId: context.traceId || IdGeneratorUtil.generateCorrelationId(),
      traceId: context.traceId,
    };

    this.logger.debug(`Message validated and enriched successfully`, {
      messageId,
      requestId: context.requestId,
      namespace: dto.namespace,
      enrichedAt: enrichmentTimestamp,
    });

    return { enrichedMessage, namespaceConfig };
  }

  /**
   * Validate API key has access to the specified namespace
   * LLD Section 8.1 - API Key validation with namespace access control
   */
  private async validateApiKeyAccess(
    apiKey: string,
    namespace: NamespaceConfigDto,
  ): Promise<void> {
    // Basic validation that API key exists and has proper format
    if (!apiKey || apiKey.trim().length === 0) {
      throw new BadRequestException('API key is required');
    }

    // Validate API key format (should be at least 16 characters)
    if (apiKey.length < 16) {
      throw new BadRequestException('Invalid API key format');
    }

    // Check if API key is in valid format (alphanumeric + hyphens)
    const apiKeyPattern = /^[a-zA-Z0-9\-_]{16,}$/;
    if (!apiKeyPattern.test(apiKey)) {
      throw new BadRequestException('Invalid API key format');
    }

    // TODO: Implement proper API key access validation against database
    // For MVP: Accept any properly formatted API key
    // Production implementation would check:
    // 1. API key exists in database
    // 2. API key is not revoked/expired
    // 3. API key has permission for this specific namespace
    // 4. Rate limits not exceeded for this API key

    this.logger.debug(
      `API key access validated for namespace: ${namespace.name}`,
      {
        apiKeyPrefix: apiKey.substring(0, 8) + '***',
        namespace: namespace.name,
      },
    );
  }

  /**
   * Validate payload schema if schema rules are defined
   * LLD Section 7.2 - Payload schema validation
   */
  private async validatePayloadSchema(
    payload: Record<string, any>,
    schemaRules: any,
  ): Promise<void> {
    // Basic validation that payload exists and is an object
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Payload must be a valid object');
    }

    // Check for null payload (null is typeof 'object' but not valid)
    if (payload === null) {
      throw new BadRequestException('Payload cannot be null');
    }

    // Validate payload size (max 1MB for MVP)
    const payloadSize = JSON.stringify(payload).length;
    const maxPayloadSize = 1024 * 1024; // 1MB
    if (payloadSize > maxPayloadSize) {
      throw new BadRequestException(
        `Payload size (${payloadSize} bytes) exceeds maximum allowed (${maxPayloadSize} bytes)`,
      );
    }

    // If schema rules are provided, validate against them
    if (schemaRules) {
      try {
        // TODO: Implement proper JSON Schema validation
        // For MVP: Basic type checking
        await this.performBasicSchemaValidation(payload, schemaRules);
      } catch (error) {
        throw new BadRequestException(
          `Payload schema validation failed: ${error.message}`,
        );
      }
    }

    this.logger.debug('Payload schema validation completed', {
      payloadKeys: Object.keys(payload),
      payloadSize,
      hasSchemaRules: !!schemaRules,
    });
  }

  /**
   * Perform basic schema validation (MVP implementation)
   * TODO: Replace with proper JSON Schema validator in production
   */
  private async performBasicSchemaValidation(
    payload: Record<string, any>,
    schemaRules: any,
  ): Promise<void> {
    // Basic type validation
    if (schemaRules.type && schemaRules.type === 'object') {
      if (typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Expected object type');
      }
    }

    // Required fields validation
    if (schemaRules.required && Array.isArray(schemaRules.required)) {
      for (const requiredField of schemaRules.required) {
        if (!(requiredField in payload)) {
          throw new Error(`Required field '${requiredField}' is missing`);
        }
      }
    }

    // Properties validation (basic)
    if (schemaRules.properties) {
      for (const [key, value] of Object.entries(payload)) {
        if (schemaRules.properties[key]) {
          const fieldSchema = schemaRules.properties[key];
          if (fieldSchema.type) {
            const expectedType = fieldSchema.type;
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== expectedType) {
              throw new Error(
                `Field '${key}' expected type '${expectedType}' but got '${actualType}'`,
              );
            }
          }
        }
      }
    }
  }

  /**
   * Task 1.1.4: Transaction Management
   * Main writeToLog method with transactional logic, durability status, and audit trail
   * LLD Section 4.1 - Transaction orchestration
   */
  async writeToLog(
    dto: WriteToLogDto,
    context: RequestContext,
  ): Promise<WriteToLogResponseDto> {
    const timer = this.requestDuration.startTimer({
      namespace: dto.namespace,
      operation: this.determineOperation(dto),
    });

    let enrichedMessage: EnrichedMessage;
    let namespaceConfig: NamespaceConfigDto | undefined = undefined;

    try {
      this.logger.log(
        `Processing WriteToLog request for namespace: ${dto.namespace}`,
        {
          requestId: context.requestId,
          namespace: dto.namespace,
          hasDelay: !!dto.lifecycle?.delay,
          payloadSize: JSON.stringify(dto.payload).length,
        },
      );

      // Task 1.1.2: Validate and enrich message
      const validationResult = await this.validateAndEnrichMessage(
        dto,
        context,
      );
      enrichedMessage = validationResult.enrichedMessage;
      namespaceConfig = validationResult.namespaceConfig;

      // Additional namespace validation
      await this.namespaceService.validateRequest(dto.namespace, dto);

      // Task 1.1.3: Select producer with health checks and fallback
      const producer = await this.selectProducer(namespaceConfig);

      // Start transaction orchestration
      const transactionId = IdGeneratorUtil.generateMessageId();

      try {
        // Begin transaction
        await this.transactionOrchestratorService.beginTransaction({
          transactionId,
          messageId: enrichedMessage.messageId,
          namespace: dto.namespace,
          producer: producer,
          context,
        });

        // Send message through producer
        const sendResult = await producer.send({
          topic: dto.namespace,
          value: JSON.stringify(enrichedMessage),
          partition: this.calculatePartition(enrichedMessage),
          headers: {
            'content-type': 'application/json',
            'message-id': enrichedMessage.messageId,
            'request-id': context.requestId,
            'api-key': context.apiKey.substring(0, 8) + '***',
            namespace: dto.namespace,
            version: '1.0',
          },
        });
        if (!sendResult.success) {
          const errorMessage = `Failed to send message via producer: ${namespaceConfig?.backend}`;
          const exception = new ProducerUnavailableException(
            namespaceConfig.backend,
            errorMessage,
          );
          await this.rollbackTransaction(
            transactionId,
            enrichedMessage,
            exception,
          );
        }
        // Determine durability status based on send result
        const durabilityStatus = this.determineDurabilityStatus(sendResult);

        // Commit transaction
        await this.transactionOrchestratorService.commitTransaction(
          transactionId,
          {
            messageId: enrichedMessage.messageId,
            sendResult,
            durabilityStatus,
          },
        );

        // Update metrics - success
        this.requestCounter.inc({
          namespace: dto.namespace,
          status: 'success',
          durability: durabilityStatus,
        });

        this.activeMessages.inc({
          namespace: dto.namespace,
        });

        // Audit trail logging
        await this.logAuditTrail({
          messageId: enrichedMessage.messageId,
          requestId: context.requestId,
          apiKey: context.apiKey,
          namespace: dto.namespace,
          operation: 'write',
          status: 'success',
          transactionId,
          durabilityStatus,
          timestamp: new Date(),
        });

        this.logger.log(`WriteToLog request processed successfully`, {
          requestId: context.requestId,
          messageId: enrichedMessage.messageId,
          transactionId,
          durabilityStatus,
        });

        // Task 1.1.5: Generate response
        return this.generateSuccessResponse(
          enrichedMessage.messageId,
          durabilityStatus,
          enrichedMessage.timestamp,
          dto.lifecycle,
          context,
          dto.namespace,
        );
      } catch (producerError) {
        // Rollback transaction on producer failure
        this.logger.warn(
          `Transaction rollback due to producer error: ${producerError.message}`,
          {
            transactionId,
            messageId: enrichedMessage.messageId,
            error: producerError.stack,
          },
        );

        await this.rollbackTransaction(
          transactionId,
          enrichedMessage,
          producerError,
        );
        throw producerError;
      }
    } catch (error) {
      // Update metrics - error
      this.requestCounter.inc({
        namespace: dto.namespace,
        status: 'error',
        errorType: error.constructor.name,
      });

      // Log error with full context
      this.logger.error(
        `Error processing WriteToLog request: ${error.message}`,
        {
          requestId: context.requestId,
          namespace: dto.namespace,
          messageId: enrichedMessage?.messageId,
          error: error.stack,
          payloadSize: JSON.stringify(dto.payload).length,
        },
      );

      // Audit trail for failures
      if (enrichedMessage) {
        await this.logAuditTrail({
          messageId: enrichedMessage.messageId,
          requestId: context.requestId,
          apiKey: context.apiKey,
          namespace: dto.namespace,
          operation: 'write',
          status: 'failed',
          error: error.message,
          timestamp: new Date(),
        });
      }

      // Re-throw known exceptions
      if (
        error instanceof BadRequestException ||
        error instanceof NamespaceNotFoundException
      ) {
        throw error;
      }

      if (error instanceof ProducerUnavailableException) {
        throw new InternalServerErrorException(error.message);
      }

      // Wrap unknown errors
      throw new InternalServerErrorException(
        `Failed to process WAL request: ${error.message}`,
      );
    } finally {
      timer();
    }
  }

  /**
   * Determines the operation type for metrics based on the WriteToLogDto.
   * Returns a string describing the operation.
   */
  private determineOperation(dto: WriteToLogDto): DetermineOperationType {
    if (this.isTransactionRequest(dto)) {
      return DetermineOperationType.TRANSACTION;
    } else if (dto.lifecycle?.delay && dto.lifecycle.delay > 0) {
      return DetermineOperationType.DELAYED;
    } else if (
      Array.isArray(dto.target)
        ? dto.target.some(
            (t) =>
              t.type === TargetType.CACHE &&
              Array.isArray(t.config?.regions) &&
              t.config.regions.length > 1,
          )
        : dto.target?.type === TargetType.CACHE &&
          Array.isArray(dto.target?.config?.regions) &&
          dto.target?.config?.regions.length > 1
    ) {
      return DetermineOperationType.REPLICATION;
    }
    return DetermineOperationType.IMMEDIATE;
  }

  private isTransactionRequest(dto: WriteToLogDto): boolean {
    return (
      Array.isArray(dto.payload?.transactions) &&
      dto.payload.transactions.length > 1
    );
  }

  /**
   * Task 1.1.3: Producer Selection Logic
   * Select producer with health-check integration and fallback logic
   */
  async selectProducer(
    namespaceConfig: NamespaceConfigDto,
  ): Promise<IProducer> {
    this.logger.debug(
      `Selecting producer for backend: ${namespaceConfig.backend}`,
      {
        namespace: namespaceConfig.name,
        backend: namespaceConfig.backend,
      },
    );

    try {
      // Get primary producer
      let producer: IProducer | null = null;
      try {
        producer = this.producerFactory.getProducer(namespaceConfig.backend);
      } catch (error) {
        this.logger.warn(
          `Failed to get primary producer for ${namespaceConfig.backend}: ${error.message}`,
        );
        producer = null;
      }

      // Validate producer health
      const isHealthy = await this.validateProducerHealth(producer);

      if (producer && isHealthy) {
        this.logger.debug(`Primary producer is healthy`, {
          backend: namespaceConfig.backend,
          namespace: namespaceConfig.name,
        });
        return producer;
      }

      // Primary producer is unhealthy or unavailable, try fallback
      this.logger.warn(
        `Primary producer is ${producer ? 'unhealthy' : 'unavailable'}, attempting fallback`,
        {
          backend: namespaceConfig.backend,
          namespace: namespaceConfig.name,
        },
      );

      return await this.getFallbackProducer(namespaceConfig);
    } catch (error) {
      this.logger.error(`Error selecting producer: ${error.message}`, {
        namespace: namespaceConfig.name,
        backend: namespaceConfig.backend,
        error: error.stack,
      });
      throw new InternalServerErrorException(
        `Producer selection failed: ${error.message}`,
      );
    }
  }

  /**
   * Validate producer health status
   * LLD Section 9.1 - Producer health monitoring
   */
  private async validateProducerHealth(
    producer: IProducer | null,
  ): Promise<boolean> {
    try {
      // Check if producer exists
      if (!producer) {
        this.logger.debug('Producer health check failed: producer is null');
        return false;
      }

      // Call producer's health check method
      if (typeof producer.healthCheck === 'function') {
        const isHealthy = await producer.healthCheck();
        this.logger.debug(`Producer health check result: ${isHealthy}`);
        return isHealthy;
      }

      // If no health check method, assume healthy if producer exists
      this.logger.debug(
        'Producer has no health check method, assuming healthy',
      );
      return true;
    } catch (error) {
      this.logger.warn(`Producer health check failed: ${error.message}`, {
        error: error.stack,
      });
      return false;
    }
  }

  /**
   * Get fallback producer when primary is unavailable
   * LLD Section 9.1 - Fallback producer logic with graceful degradation
   */
  private async getFallbackProducer(
    namespaceConfig: NamespaceConfigDto,
  ): Promise<IProducer> {
    // Define fallback order based on backend type
    const fallbackOrder = this.getFallbackOrder(namespaceConfig.backend);

    this.logger.debug(
      `Attempting fallback producers in order: ${fallbackOrder.join(', ')}`,
      {
        namespace: namespaceConfig.name,
        originalBackend: namespaceConfig.backend,
        fallbackOrder,
      },
    );

    for (const fallbackBackend of fallbackOrder) {
      try {
        this.logger.debug(`Trying fallback producer: ${fallbackBackend}`, {
          namespace: namespaceConfig.name,
          originalBackend: namespaceConfig.backend,
          fallbackBackend,
        });

        // Attempt to get the fallback producer
        let fallbackProducer: IProducer | null = null;
        try {
          fallbackProducer = this.producerFactory.getProducer(fallbackBackend);
        } catch (error) {
          this.logger.warn(
            `Failed to get fallback producer ${fallbackBackend}: ${error.message}`,
          );
          continue; // Try next fallback
        }

        // Validate fallback producer health
        const isHealthy = await this.validateProducerHealth(fallbackProducer);

        if (fallbackProducer && isHealthy) {
          this.logger.log(
            `Successfully using fallback producer: ${fallbackBackend}`,
            {
              namespace: namespaceConfig.name,
              originalBackend: namespaceConfig.backend,
              fallbackBackend,
            },
          );
          if (!fallbackProducer) {
            throw new ProducerUnavailableException(
              fallbackBackend,
              'Producer instance is null',
            );
          }
          return fallbackProducer;
        } else {
          this.logger.warn(
            `Fallback producer ${fallbackBackend} is ${fallbackProducer ? 'unhealthy' : 'unavailable'}`,
            {
              namespace: namespaceConfig.name,
              fallbackBackend,
              hasProducer: !!fallbackProducer,
              isHealthy,
            },
          );
        }
      } catch (error) {
        this.logger.warn(
          `Error with fallback producer ${fallbackBackend}: ${error.message}`,
          {
            fallbackBackend,
            error: error.stack,
          },
        );
        continue; // Try next fallback
      }
    }

    // All producers failed
    const errorMessage = `All producers are unavailable. Attempted: primary (${namespaceConfig.backend}) and fallbacks (${fallbackOrder.join(', ')})`;
    this.logger.error(errorMessage, {
      namespace: namespaceConfig.name,
      primaryBackend: namespaceConfig.backend,
      attemptedFallbacks: fallbackOrder,
    });
    throw new InternalServerErrorException(errorMessage);
  }

  /**
   * Get fallback order for different backend types
   */
  private getFallbackOrder(
    primaryBackend: string,
  ): ('kafka' | 'sqs' | 'redis')[] {
    // Define fallback priorities based on characteristics
    switch (primaryBackend.toLowerCase()) {
      case 'redis':
        return ['kafka', 'sqs']; // Fast alternatives
      case 'kafka':
        return ['redis', 'sqs']; // Redis for speed, SQS for reliability
      case 'sqs':
        return ['kafka', 'redis']; // Kafka for throughput, Redis for speed
      default:
        return ['redis', 'kafka', 'sqs']; // Default fallback order
    }
  }

  /**
   * Calculate partition for message distribution
   * LLD Section 9.1 - Message partitioning strategy
   */
  private calculatePartition(enrichedMessage: any): number {
    // Simple hash-based partitioning using message ID
    if (!enrichedMessage.messageId) {
      return 0;
    }

    // Use a simple hash of the message ID to determine partition
    let hash = 0;
    for (let i = 0; i < enrichedMessage.messageId.length; i++) {
      const char = enrichedMessage.messageId.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Return positive partition number (assuming max 10 partitions for MVP)
    return Math.abs(hash) % 10;
  }

  /**
   * Determine durability status based on producer send result
   * LLD Section 5.1 - Durability status determination
   */
  private determineDurabilityStatus(sendResult: any): DurabilityStatus {
    if (!sendResult) {
      return DurabilityStatus.FAILED;
    }

    // Check if message was successfully persisted
    if (sendResult.durable === true || sendResult.messageId) {
      return DurabilityStatus.PERSISTED;
    }

    // Check if message is scheduled (for delayed messages)
    if (sendResult.scheduled === true) {
      return DurabilityStatus.SCHEDULED;
    }

    // Default to acknowledged if we have a successful response
    return DurabilityStatus.ACKNOWLEDGED;
  }

  /**
   * Log audit trail for compliance and monitoring
   * LLD Section 8.1 - Audit logging
   */
  private async logAuditTrail(auditData: {
    messageId: string;
    requestId: string;
    apiKey: string;
    namespace: string;
    operation: string;
    status: string;
    transactionId?: string;
    durabilityStatus?: DurabilityStatus;
    error?: string;
    timestamp: Date;
  }): Promise<void> {
    try {
      // Log structured audit data
      this.logger.log('AUDIT_TRAIL', {
        ...auditData,
        apiKey: auditData.apiKey.substring(0, 8) + '***', // Mask API key
      });

      // TODO: Send to dedicated audit service/database in production
      // await this.auditService.logEvent(auditData);
    } catch (error) {
      this.logger.error(`Failed to log audit trail: ${error.message}`, {
        messageId: auditData.messageId,
        error: error.stack,
      });
    }
  }

  /**
   * Rollback transaction on failure
   * LLD Section 4.1 - Transaction rollback
   */
  private async rollbackTransaction(
    transactionId: string,
    enrichedMessage: EnrichedMessage,
    error: Error,
  ): Promise<void> {
    try {
      await this.transactionOrchestratorService.rollbackTransaction(
        transactionId,
        {
          messageId: enrichedMessage?.messageId,
          reason: error.message,
          timestamp: new Date(),
        },
      );

      this.logger.log(`Transaction rolled back successfully`, {
        transactionId,
        messageId: enrichedMessage?.messageId,
        reason: error.message,
      });
    } catch (rollbackError) {
      this.logger.error(
        `Failed to rollback transaction: ${rollbackError.message}`,
        {
          transactionId,
          messageId: enrichedMessage?.messageId,
          originalError: error.message,
          rollbackError: rollbackError.stack,
        },
      );
    }
  }

  /**
   * Task 1.1.5: Generate success response with proper formatting
   * LLD Section 5.1 - Response generation
   */
  private generateSuccessResponse(
    messageId: string,
    durabilityStatus: DurabilityStatus,
    timestamp: Date,
    lifecycle: LifecycleConfigDto | undefined,
    context: RequestContext,
    namespace: string,
  ): WriteToLogResponseDto {
    const estimatedProcessingTime =
      lifecycle?.delay ||
      this.lifecycleService.calculateDelay(lifecycle) ||
      1000;

    return {
      durable: durabilityStatus,
      messageId,
      message: 'Message accepted for processing',
      timestamp,
      estimatedProcessingTimeMs: estimatedProcessingTime,
      // Additional metadata for enhanced observability
      metadata: {
        requestId: context.requestId,
        namespace,
        durabilityStatus,
        hasDelay: !!lifecycle?.delay,
        processingMode: (lifecycle?.delay || 0) > 0 ? 'delayed' : 'immediate',
      },
    };
  }
}
