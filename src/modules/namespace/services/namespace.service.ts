import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NamespaceRepository } from '../repositories/namespace.repository';
import { Namespace } from '../entities/namespace.entity';
import { NamespaceConfigDto } from '../dto/namespace-config.dto';
import { WriteToLogDto } from '../../wal/dto/write-to-log.dto';
import { ValidationError } from '../../../common/types/error.types';

@Injectable()
export class NamespaceService {
  private readonly logger = new Logger(NamespaceService.name);

  constructor(
    private readonly namespaceRepository: NamespaceRepository,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get namespace configuration by name
   */
  async getNamespace(name: string): Promise<Namespace | null> {
    try {
      const namespace = await this.namespaceRepository.findByName(name);

      if (!namespace) {
        this.logger.warn(`Namespace not found: ${name}`);
        return null;
      }

      this.logger.debug(`Retrieved namespace configuration: ${name}`, {
        namespace: name,
        backend: namespace.backend,
        enabled: namespace.enabled,
      });

      return namespace;
    } catch (error) {
      const errorAnnotated = error as Error;
      this.logger.error(
        `Error retrieving namespace ${name}: ${errorAnnotated.message}`,
        {
          error: errorAnnotated.stack,
        },
      );
      throw error;
    }
  }

  /**
   * Validate a WriteToLog request against namespace configuration
   */
  async validateRequest(
    namespaceName: string,
    request: WriteToLogDto,
  ): Promise<void> {
    const namespace = await this.getNamespace(namespaceName);

    if (!namespace) {
      throw new NotFoundException(`Namespace '${namespaceName}' not found`);
    }

    if (!namespace.enabled) {
      throw new BadRequestException(`Namespace '${namespaceName}' is disabled`);
    }

    // Validate message size
    const messageSize = JSON.stringify(request.payload).length;
    if (messageSize > namespace.maxMessageSize) {
      throw new ValidationError(
        `Message size ${messageSize} exceeds maximum allowed size ${namespace.maxMessageSize} for namespace '${namespaceName}'`,
        { namespaceName, messageSize, maxSize: namespace.maxMessageSize },
      );
    }

    // Validate delay if specified
    if (
      request.lifecycle?.delay &&
      request.lifecycle.delay > namespace.maxDelaySeconds
    ) {
      throw new ValidationError(
        `Delay ${request.lifecycle.delay}s exceeds maximum allowed delay ${namespace.maxDelaySeconds}s for namespace '${namespaceName}'`,
        {
          namespaceName,
          delay: request.lifecycle.delay,
          maxDelay: namespace.maxDelaySeconds,
        },
      );
    }

    // Validate target configuration compatibility
    if (namespace.targetConfig && request.target) {
      const targets = Array.isArray(request.target)
        ? request.target
        : [request.target];

      for (const target of targets) {
        if (target.type !== namespace.targetConfig.type) {
          throw new ValidationError(
            `Target type '${target.type}' is not compatible with namespace configuration '${namespace.targetConfig.type}'`,
            {
              namespaceName,
              requestTargetType: target.type,
              namespaceTargetType: namespace.targetConfig.type,
            },
          );
        }
      }
    }

    this.logger.debug(
      `Request validation passed for namespace: ${namespaceName}`,
      {
        namespaceName,
        messageSize,
        delay: request.lifecycle?.delay,
      },
    );
  }

  /**
   * Get all enabled namespaces
   */
  async getEnabledNamespaces(): Promise<Namespace[]> {
    return this.namespaceRepository.findEnabled();
  }

  /**
   * Get namespaces by backend type
   */
  async getNamespacesByBackend(
    backend: 'kafka' | 'sqs' | 'redis',
  ): Promise<Namespace[]> {
    return this.namespaceRepository.findByBackend(backend);
  }

  /**
   * Create a new namespace
   */
  async createNamespace(namespaceData: Partial<Namespace>): Promise<Namespace> {
    if (!namespaceData.name) {
      throw new BadRequestException('Namespace name is required');
    }

    const exists = await this.namespaceRepository.exists(namespaceData.name);
    if (exists) {
      throw new ConflictException(
        `Namespace '${namespaceData.name}' already exists`,
      );
    }

    // Set defaults from configuration
    const defaultMaxMessageSize = this.configService.get<number>(
      'wal.maxMessageSize',
      1048576,
    );
    const defaultMaxDelaySeconds = this.configService.get<number>(
      'wal.maxDelaySeconds',
      86400,
    );

    const namespace = await this.namespaceRepository.create({
      ...namespaceData,
      maxMessageSize: namespaceData.maxMessageSize || defaultMaxMessageSize,
      maxDelaySeconds: namespaceData.maxDelaySeconds || defaultMaxDelaySeconds,
      enabled:
        namespaceData.enabled !== undefined ? namespaceData.enabled : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(`Created namespace: ${namespace.name}`, {
      namespace: namespace.name,
      backend: namespace.backend,
    });

    return namespace;
  }

  /**
   * Update an existing namespace
   */
  async updateNamespace(
    name: string,
    updateData: Partial<Namespace>,
  ): Promise<Namespace> {
    const exists = await this.namespaceRepository.exists(name);
    if (!exists) {
      throw new NotFoundException(`Namespace '${name}' not found`);
    }

    const updatedNamespace = await this.namespaceRepository.update(name, {
      ...updateData,
      updatedAt: new Date(),
    });

    this.logger.log(`Updated namespace: ${name}`, {
      namespace: name,
      enabled: updatedNamespace.enabled,
    });

    return updatedNamespace;
  }

  /**
   * Delete a namespace
   */
  async deleteNamespace(name: string): Promise<boolean> {
    const exists = await this.namespaceRepository.exists(name);
    if (!exists) {
      throw new NotFoundException(`Namespace '${name}' not found`);
    }

    const deleted = await this.namespaceRepository.delete(name);

    if (deleted) {
      this.logger.log(`Deleted namespace: ${name}`);
    }

    return deleted;
  }

  /**
   * Get namespace statistics
   */
  async getNamespaceStats(): Promise<{
    total: number;
    enabled: number;
    disabled: number;
    byBackend: Record<string, number>;
  }> {
    const [total, enabled] = await Promise.all([
      this.namespaceRepository.count(),
      this.namespaceRepository.count({ enabled: true }),
    ]);

    const [kafkaCount, sqsCount, redisCount] = await Promise.all([
      this.namespaceRepository.count({ backend: 'kafka' }),
      this.namespaceRepository.count({ backend: 'sqs' }),
      this.namespaceRepository.count({ backend: 'redis' }),
    ]);

    return {
      total,
      enabled,
      disabled: total - enabled,
      byBackend: {
        kafka: kafkaCount,
        sqs: sqsCount,
        redis: redisCount,
      },
    };
  }

  /**
   * Convert Namespace entity to DTO
   */
  toDto(namespace: Namespace): NamespaceConfigDto {
    return {
      name: namespace.name,
      description: namespace.description,
      enabled: namespace.enabled,
      backend: namespace.backend,
      topicName: namespace.topicName,
      retryPolicy: namespace.retryPolicy,
      shardConfig: namespace.shardConfig,
      targetConfig: namespace.targetConfig,
      rateLimitConfig: namespace.rateLimitConfig,
      maxMessageSize: namespace.maxMessageSize,
      maxDelaySeconds: namespace.maxDelaySeconds,
      metadata: namespace.metadata,
      createdAt: namespace.createdAt,
      updatedAt: namespace.updatedAt,
      createdBy: namespace.createdBy,
      updatedBy: namespace.updatedBy,
    };
  }
}
