import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IProducer,
  ProducerHealthStatus,
} from '../interfaces/producer.interface';
import { RedisProducerService } from '../redis/redis-producer.service';
// import { KafkaProducerService } from '../kafka/kafka-producer.service';
// import { SqsProducerService } from '../sqs/sqs-producer.service';

@Injectable()
export class ProducerFactoryService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(ProducerFactoryService.name);
  private readonly producers = new Map<string, IProducer>();
  private readonly connectionPools = new Map<string, any>();
  private readonly healthCache = new Map<
    string,
    { status: ProducerHealthStatus; lastCheck: number }
  >();
  private readonly healthCheckInterval = 30000; // 30 seconds
  private readonly maxConnectionRetries = 3;
  private readonly connectionRetryDelay = 1000; // 1 second

  constructor(
    private readonly configService: ConfigService,
    private readonly redisProducerService: RedisProducerService,
    // TODO: Inject other producers when implemented
    // private readonly kafkaProducerService: KafkaProducerService,
    // private readonly sqsProducerService: SqsProducerService,
  ) {}

  /**
   * Initialize producer factory on module initialization
   * LLD Section 9.1 - Factory initialization
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Producer Factory Service');

    // Pre-warm producer instances for better performance
    try {
      await this.preWarmProducers();
    } catch (error) {
      this.logger.warn(`Failed to pre-warm producers: ${error.message}`);
    }

    // Start health monitoring background task
    this.startHealthMonitoring();

    this.logger.log('Producer Factory Service initialized successfully');
  }

  /**
   * Get or create a producer for the specified backend
   * LLD Section 9.1 - Producer factory with caching
   */
  getProducer(backend: 'kafka' | 'sqs' | 'redis'): IProducer {
    // Check cache first
    if (this.producers.has(backend)) {
      const cachedProducer = this.producers.get(backend)!;
      this.logger.debug(`Retrieved cached producer for backend: ${backend}`);
      return cachedProducer;
    }

    // Create new producer with retry logic
    const producer = this.createProducerWithRetry(backend);

    // Cache the producer
    this.producers.set(backend, producer);

    // Initialize connection pool for this backend
    this.initializeConnectionPool(backend);

    this.logger.log(`Created and cached producer for backend: ${backend}`);
    return producer;
  }

  /**
   * Create producer with retry logic and error handling
   * LLD Section 9.1 - Graceful degradation
   */
  private createProducerWithRetry(
    backend: 'kafka' | 'sqs' | 'redis',
  ): IProducer {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxConnectionRetries; attempt++) {
      try {
        this.logger.debug(
          `Creating producer for ${backend}, attempt ${attempt}/${this.maxConnectionRetries}`,
        );
        return this.createProducer(backend);
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(
          `Failed to create producer for ${backend} (attempt ${attempt}/${this.maxConnectionRetries}): ${error.message}`,
        );

        // Wait before retry (except for last attempt)
        if (attempt < this.maxConnectionRetries) {
          // Exponential backoff
          const delay = this.connectionRetryDelay * Math.pow(2, attempt - 1);
          // Note: In real implementation, use await new Promise(resolve => setTimeout(resolve, delay))
          // For now, just log the delay
          this.logger.debug(`Waiting ${delay}ms before retry...`);
        }
      }
    }

    // All retries failed
    const errorMessage = `Failed to create producer for ${backend} after ${this.maxConnectionRetries} attempts: ${lastError?.message}`;
    this.logger.error(errorMessage);
    throw new BadRequestException(errorMessage);
  }

  /**
   * Create a new producer instance for the specified backend
   */
  private createProducer(backend: 'kafka' | 'sqs' | 'redis'): IProducer {
    switch (backend) {
      case 'kafka':
        // TODO: Implement when KafkaProducerService is ready
        // return this.kafkaProducerService;
        return this.createMockProducer('kafka');

      case 'sqs':
        // TODO: Implement when SqsProducerService is ready
        // return this.sqsProducerService;
        return this.createMockProducer('sqs');

      case 'redis':
        // Use real Redis producer
        return this.redisProducerService;

      default:
        throw new BadRequestException(`Unsupported backend: ${backend}`);
    }
  }

  /**
   * Temporary mock producer for testing
   */
  private createMockProducer(backend: string): IProducer {
    return {
      send: async (message) => {
        this.logger.debug(`Mock ${backend} producer sending message`, {
          backend,
          topic: message.topic,
          messageSize: message.value.length,
        });

        return {
          messageId: `mock_${backend}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          partition: message.partition || 0,
          offset: Math.floor(Math.random() * 1000000).toString(),
          timestamp: new Date(),
          durable: true,
        };
      },

      healthCheck: async () => {
        // Mock health check - always returns healthy
        return true;
      },

      getHealthStatus: async () => {
        return {
          status: 'healthy',
          lastCheck: new Date(),
          details: {
            backend,
            mock: true,
            connected: true,
          },
        };
      },
    };
  }

  /**
   * Get health status for a specific producer
   */
  async getProducerHealth(
    backend: 'kafka' | 'sqs' | 'redis',
  ): Promise<ProducerHealthStatus> {
    const cacheKey = `health_${backend}`;
    const now = Date.now();

    // Check cache first
    const cached = this.healthCache.get(cacheKey);
    if (cached && now - cached.lastCheck < this.healthCheckInterval) {
      return cached.status;
    }

    try {
      const producer = this.getProducer(backend);
      const healthStatus = await producer.getHealthStatus();

      // Cache the result
      this.healthCache.set(cacheKey, {
        status: healthStatus,
        lastCheck: now,
      });

      return healthStatus;
    } catch (error) {
      this.logger.error(
        `Error checking health for ${backend} producer: ${error.message}`,
      );

      const errorStatus: ProducerHealthStatus = {
        status: 'unhealthy',
        lastCheck: new Date(),
        details: {
          error: error.message,
        },
      };

      this.healthCache.set(cacheKey, {
        status: errorStatus,
        lastCheck: now,
      });

      return errorStatus;
    }
  }

  /**
   * Get health status for all producers
   */
  async getAllProducersHealth(): Promise<Record<string, ProducerHealthStatus>> {
    const backends: ('kafka' | 'sqs' | 'redis')[] = ['kafka', 'sqs', 'redis'];
    const results: Record<string, ProducerHealthStatus> = {};

    await Promise.all(
      backends.map(async (backend) => {
        try {
          results[backend] = await this.getProducerHealth(backend);
        } catch (error) {
          results[backend] = {
            status: 'unhealthy',
            lastCheck: new Date(),
            details: { error: error.message },
          };
        }
      }),
    );

    return results;
  }

  /**
   * Test connectivity for a specific backend
   */
  async testConnection(backend: 'kafka' | 'sqs' | 'redis'): Promise<boolean> {
    try {
      const producer = this.getProducer(backend);
      return producer.healthCheck();
    } catch (error) {
      this.logger.error(
        `Connection test failed for ${backend}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Get producer metrics
   */
  async getProducerMetrics(
    backend?: 'kafka' | 'sqs' | 'redis',
  ): Promise<Record<string, any>> {
    const metrics: Record<string, any> = {};

    if (backend) {
      const producer = this.getProducer(backend);
      if (producer.getMetrics) {
        metrics[backend] = await producer.getMetrics();
      }
    } else {
      // Get metrics for all producers
      for (const [backendName, producer] of this.producers.entries()) {
        if (producer.getMetrics) {
          try {
            metrics[backendName] = await producer.getMetrics();
          } catch (error) {
            this.logger.error(
              `Error getting metrics for ${backendName}: ${error.message}`,
            );
            metrics[backendName] = { error: error.message };
          }
        }
      }
    }

    return metrics;
  }

  /**
   * Pre-warm producer instances for better performance
   */
  private async preWarmProducers(): Promise<void> {
    const backends: ('kafka' | 'sqs' | 'redis')[] = ['redis']; // Start with Redis only

    for (const backend of backends) {
      try {
        this.logger.debug(`Pre-warming ${backend} producer...`);
        const producer = this.getProducer(backend);

        // Perform health check to ensure producer is ready
        await producer.healthCheck();

        this.logger.log(`${backend} producer pre-warmed successfully`);
      } catch (error) {
        this.logger.warn(
          `Failed to pre-warm ${backend} producer: ${error.message}`,
        );
      }
    }
  }

  /**
   * Start background health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        const healthResults = await this.getAllProducersHealth();

        for (const [backend, health] of Object.entries(healthResults)) {
          if (health.status === 'unhealthy') {
            this.logger.warn(`Producer ${backend} is unhealthy`, {
              backend,
              lastCheck: health.lastCheck,
              details: health.details,
            });
          }
        }
      } catch (error) {
        this.logger.error(`Health monitoring failed: ${error.message}`);
      }
    }, this.healthCheckInterval);

    this.logger.debug('Health monitoring started');
  }

  /**
   * Initialize connection pool for backend
   */
  private initializeConnectionPool(backend: 'kafka' | 'sqs' | 'redis'): void {
    // For now, just log the initialization
    // Future implementations might include actual connection pooling
    this.logger.debug(`Initialized connection pool for ${backend}`);
    this.connectionPools.set(backend, { initialized: true, backend });
  }

  /**
   * Cleanup all producers on module destroy
   */
  async onModuleDestroy() {
    this.logger.log('Shutting down all producers...');

    const disconnectPromises = Array.from(this.producers.entries()).map(
      async ([backend, producer]) => {
        try {
          if (producer.disconnect) {
            await producer.disconnect();
            this.logger.log(`Disconnected ${backend} producer`);
          }
        } catch (error) {
          this.logger.error(
            `Error disconnecting ${backend} producer: ${error.message}`,
          );
        }
      },
    );

    await Promise.allSettled(disconnectPromises);
    this.producers.clear();
    this.healthCache.clear();
    this.connectionPools.clear();

    this.logger.log('All producers shut down');
  }
}
