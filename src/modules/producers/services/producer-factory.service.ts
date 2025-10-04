import {
  Injectable,
  Logger,
  BadRequestException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IProducer, ProducerHealthStatus } from '../interfaces/producer.interface';
// import { KafkaProducerService } from '../kafka/kafka-producer.service';
// import { SqsProducerService } from '../sqs/sqs-producer.service';
// import { RedisProducerService } from '../redis/redis-producer.service';

@Injectable()
export class ProducerFactoryService implements OnModuleDestroy {
  private readonly logger = new Logger(ProducerFactoryService.name);
  private readonly producers = new Map<string, IProducer>();
  private readonly healthCache = new Map<string, { status: ProducerHealthStatus; lastCheck: number }>();
  private readonly healthCheckInterval = 30000; // 30 seconds

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get or create a producer for the specified backend
   */
  getProducer(backend: 'kafka' | 'sqs' | 'redis'): IProducer {
    if (this.producers.has(backend)) {
      return this.producers.get(backend)!;
    }

    const producer = this.createProducer(backend);
    this.producers.set(backend, producer);
    
    this.logger.log(`Created producer for backend: ${backend}`);
    return producer;
  }

  /**
   * Create a new producer instance for the specified backend
   */
  private createProducer(backend: 'kafka' | 'sqs' | 'redis'): IProducer {
    switch (backend) {
      case 'kafka':
        // TODO: Implement when KafkaProducerService is ready
        // return new KafkaProducerService(this.configService);
        return this.createMockProducer('kafka');

      case 'sqs':
        // TODO: Implement when SqsProducerService is ready
        // return new SqsProducerService(this.configService);
        return this.createMockProducer('sqs');

      case 'redis':
        // TODO: Implement when RedisProducerService is ready
        // return new RedisProducerService(this.configService);
        return this.createMockProducer('redis');

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
  async getProducerHealth(backend: 'kafka' | 'sqs' | 'redis'): Promise<ProducerHealthStatus> {
    const cacheKey = `health_${backend}`;
    const now = Date.now();
    
    // Check cache first
    const cached = this.healthCache.get(cacheKey);
    if (cached && (now - cached.lastCheck) < this.healthCheckInterval) {
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
      this.logger.error(`Error checking health for ${backend} producer: ${error.message}`);
      
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
      this.logger.error(`Connection test failed for ${backend}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get producer metrics
   */
  async getProducerMetrics(backend?: 'kafka' | 'sqs' | 'redis'): Promise<Record<string, any>> {
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
            this.logger.error(`Error getting metrics for ${backendName}: ${error.message}`);
            metrics[backendName] = { error: error.message };
          }
        }
      }
    }

    return metrics;
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
          this.logger.error(`Error disconnecting ${backend} producer: ${error.message}`);
        }
      },
    );

    await Promise.allSettled(disconnectPromises);
    this.producers.clear();
    this.healthCache.clear();
    
    this.logger.log('All producers shut down');
  }
}