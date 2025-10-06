import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';
import Redis from 'ioredis';
import {
  IProducer,
  ProducerHealthStatus,
  MessagePayload,
} from '../interfaces/producer.interface';
import { ProducerResult } from '../../../common/types/message.types';

@Injectable()
export class RedisProducerService implements IProducer, OnModuleDestroy {
  private readonly logger = new Logger(RedisProducerService.name);
  private redis: Redis;
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 1000; // 1 second base delay

  constructor(
    private readonly configService: ConfigService,
    @InjectMetric('redis_messages_sent_total')
    private readonly messagesSent: Counter<string>,
    @InjectMetric('redis_send_duration_seconds')
    private readonly sendDuration: Histogram<string>,
    @InjectMetric('redis_connection_status')
    private readonly connectionStatus: Gauge<string>,
  ) {
    this.initializeRedisClient();
  }

  /**
   * Initialize Redis client with configuration
   * LLD Section 9.1 - Redis client configuration
   */
  private initializeRedisClient(): void {
    const redisConfig = this.configService.get('redis', {
      host: 'localhost',
      port: 6379,
      db: 0,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });

    this.logger.log('Initializing Redis client', {
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
    });

    this.redis = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      db: redisConfig.db,
      maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
      lazyConnect: redisConfig.lazyConnect,
      keepAlive: redisConfig.keepAlive,
      connectTimeout: redisConfig.connectTimeout,
      commandTimeout: redisConfig.commandTimeout,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        this.logger.warn(`Redis connection retry ${times}, delay: ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        return err.message.includes(targetError);
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Set up Redis event handlers for monitoring
   */
  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.logger.log('Redis client connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.connectionStatus.set({ status: 'connected' }, 1);
    });

    this.redis.on('ready', () => {
      this.logger.log('Redis client ready');
    });

    this.redis.on('error', (error) => {
      this.logger.error(`Redis client error: ${error.message}`, {
        error: error.stack,
      });
      this.isConnected = false;
      this.connectionStatus.set({ status: 'error' }, 0);
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.isConnected = false;
      this.connectionStatus.set({ status: 'disconnected' }, 0);
    });

    this.redis.on('reconnecting', (delay) => {
      this.reconnectAttempts++;
      this.logger.log(
        `Redis reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
      );
    });
  }

  /**
   * Send message to Redis streams
   * LLD Section 9.1 - Redis streams message production
   */
  async send(message: MessagePayload): Promise<ProducerResult> {
    // Validate required fields
    if (!message.topic) {
      throw new Error('Topic is required for Redis producer');
    }
    if (!message.value) {
      throw new Error('Message value is required for Redis producer');
    }

    const timer = this.sendDuration.startTimer({
      topic: message.topic,
    });

    try {
      this.logger.debug('Sending message to Redis stream', {
        topic: message.topic,
        messageSize: message.value?.length || 0,
        partition: message.partition,
        headers: Object.keys(message.headers || {}),
      });

      // Ensure connection is established
      await this.ensureConnection();

      // Prepare stream key and message data
      const streamKey = `wal:${message.topic}:messages`;
      const messageData = this.prepareMessageData(message);

      // Send to Redis stream
      const messageId = await this.redis.xadd(
        streamKey,
        '*', // Let Redis generate timestamp-based ID
        ...Object.entries(messageData).flat(),
      );

      // Set TTL if specified in headers
      if (message.headers?.ttl) {
        const ttlSeconds = parseInt(message.headers.ttl as string, 10);
        if (ttlSeconds > 0) {
          await this.redis.expire(streamKey, ttlSeconds);
        }
      }

      // Handle delayed messages
      if (
        message.headers?.delay &&
        parseInt(message.headers.delay as string, 10) > 0
      ) {
        await this.scheduleDelayedMessage(message, messageId as string);
      }

      // Update metrics
      this.messagesSent.inc({
        topic: message.topic,
        status: 'success',
      });

      const result: ProducerResult = {
        messageId: messageId as string,
        success: true,
        partition: message.partition || 0,
        offset: messageId as string, // Redis stream ID serves as offset
        timestamp: new Date(),
        durable: true,
        metadata: {
          streamKey,
          redisMessageId: messageId,
        },
      };

      this.logger.debug('Message sent to Redis stream successfully', {
        topic: message.topic,
        messageId,
        streamKey,
      });

      return result;
    } catch (error) {
      // Update error metrics
      this.messagesSent.inc({
        topic: message.topic,
        status: 'error',
      });

      this.logger.error(`Failed to send message to Redis: ${error.message}`, {
        topic: message.topic,
        error: error.stack,
      });

      throw error;
    } finally {
      timer();
    }
  }

  /**
   * Schedule delayed message processing
   */
  private async scheduleDelayedMessage(
    message: MessagePayload,
    messageId: string,
  ): Promise<void> {
    const delay = parseInt(message.headers?.delay as string, 10);
    const executeAt = Date.now() + delay;
    const delayedKey = `wal:${message.topic}:delayed`;

    const delayedData = {
      messageId,
      originalMessage: message,
      scheduledFor: executeAt,
      createdAt: Date.now(),
    };

    await this.redis.zadd(delayedKey, executeAt, JSON.stringify(delayedData));

    this.logger.debug(`Scheduled delayed message`, {
      messageId,
      delay,
      executeAt: new Date(executeAt),
      delayedKey,
    });
  }

  /**
   * Prepare message data for Redis stream
   */
  private prepareMessageData(message: MessagePayload): Record<string, string> {
    const data: Record<string, string> = {
      value: message.value,
    };

    // Add headers as individual fields
    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        data[`header_${key}`] = String(value);
      }
    }

    // Add metadata
    data.partition = String(message.partition || 0);
    data.timestamp = new Date().toISOString();
    data.producer = 'redis-producer';

    return data;
  }

  /**
   * Ensure Redis connection is established
   */
  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.redis.connect();
        this.isConnected = true;
      } catch (error) {
        this.logger.error(
          `Failed to establish Redis connection: ${error.message}`,
        );
        throw error;
      }
    }
  }

  /**
   * Health check for Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Simple ping to check connection
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.warn(`Redis health check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get detailed health status
   */
  async getHealthStatus(): Promise<ProducerHealthStatus> {
    try {
      const isHealthy = await this.healthCheck();
      const info = await this.redis.info('memory');

      // Parse memory info for basic metrics
      const memoryUsed = this.parseInfoValue(info, 'used_memory');
      const memoryPeak = this.parseInfoValue(info, 'used_memory_peak');

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        lastCheck: new Date(),
        details: {
          connected: this.isConnected,
          reconnectAttempts: this.reconnectAttempts,
          memoryUsed: memoryUsed
            ? `${Math.round(parseInt(memoryUsed) / 1024 / 1024)}MB`
            : 'unknown',
          memoryPeak: memoryPeak
            ? `${Math.round(parseInt(memoryPeak) / 1024 / 1024)}MB`
            : 'unknown',
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        details: {
          error: error.message,
          connected: this.isConnected,
        },
      };
    }
  }

  /**
   * Parse value from Redis INFO command output
   */
  private parseInfoValue(info: string, key: string): string | null {
    const lines = info.split('\r\n');
    const line = lines.find((l) => l.startsWith(`${key}:`));
    return line ? line.split(':')[1] : null;
  }

  /**
   * Get producer metrics
   */
  async getMetrics(): Promise<Record<string, any>> {
    try {
      const info = await this.redis.info();
      const keyspaceInfo = await this.redis.info('keyspace');

      return {
        connected: this.isConnected,
        reconnectAttempts: this.reconnectAttempts,
        info: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspaceInfo),
        lastMetricsCheck: new Date(),
      };
    } catch (error) {
      return {
        error: error.message,
        connected: this.isConnected,
        lastMetricsCheck: new Date(),
      };
    }
  }

  /**
   * Parse Redis INFO command output into object
   */
  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line.includes(':') && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      this.logger.log('Disconnecting from Redis...');
      await this.redis.disconnect();
      this.isConnected = false;
      this.connectionStatus.set({ status: 'disconnected' }, 0);
      this.logger.log('Disconnected from Redis');
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }
}
