import { ConfigService } from '@nestjs/config';
import { RedisProducerService } from '../modules/producers/redis/redis-producer.service';
import Redis from 'ioredis';
import { Counter, Histogram, Gauge, register } from 'prom-client';

describe('RedisProducerService (integration)', () => {
  let service: RedisProducerService;
  let redis: Redis;

  beforeAll(async () => {
    register.clear();
    const redisUrl = process.env.REDIS_URL;
    redis = redisUrl ? new Redis(redisUrl) : new Redis({ host: 'localhost', port: 6379, db: 0 });
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error('Redis not reachable');

    const configService = { get: () => ({ host: 'localhost', port: 6379, db: 0 }) } as unknown as ConfigService;
    const messagesSent = new Counter({ name: 'redis_messages_sent_total', help: 'Total messages sent' });
    const sendDuration = new Histogram({ name: 'redis_send_duration_seconds', help: 'Send duration' });
    const connectionStatus = new Gauge({ name: 'redis_connection_status', help: 'Connection status' });
    service = new RedisProducerService(configService, messagesSent, sendDuration, connectionStatus);
    (service as any).redis = redis;
    (service as any).isConnected = true;
    await redis.del('wal:test-topic:messages', 'wal:test-delayed:delayed');
  });

  afterAll(async () => {
    if (redis) {
      await redis.del('wal:test-topic:messages', 'wal:test-delayed:delayed');
      await redis.quit();
    }
    await service.disconnect();
  });

  it('should send a message to Redis stream and retrieve it', async () => {
    const message = {
      topic: 'test-topic',
      value: 'integration-test-message',
      partition: 0,
      headers: {
        ttl: '60',
        delay: '0',
        'content-type': 'text/plain',
        'message-id': 'msg-1',
        namespace: 'test-ns',
        version: '1.0',
        'request-id': 'req-1',
      },
    };
    const result = await service.send(message as any);
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
    const streamKey = `wal:${message.topic}:messages`;
    const messages = await redis.xrange(streamKey, '-', '+');
    const found = messages.find((m) => m[1].includes('integration-test-message'));
    expect(found).toBeDefined();
    const ttl = await redis.ttl(streamKey);
    expect(ttl).toBeGreaterThan(0);
  });

  it('should report healthy status when Redis is up', async () => {
    const health = await service.getHealthStatus();
    expect(health.status).toBe('healthy');
    expect(health.details?.connected).toBe(true);
  });

  it('should handle delayed message scheduling', async () => {
    const message = {
      topic: 'test-delayed',
      value: 'delayed-message',
      partition: 0,
      headers: {
        delay: '1000',
        'content-type': 'text/plain',
        'message-id': 'msg-2',
        namespace: 'test-ns',
        version: '1.0',
        'request-id': 'req-2',
      },
    };
    const result = await service.send(message as any);
    expect(result.success).toBe(true);
    const delayedKey = `wal:${message.topic}:delayed`;
    const delayedMessages = await redis.zrange(delayedKey, 0, -1);
    const found = delayedMessages.find((m) => m.includes('delayed-message'));
    expect(found).toBeDefined();
    const parsed = JSON.parse(found!);
    expect(parsed.scheduledFor).toBeGreaterThan(Date.now());
  });

  it('should report unhealthy status when Redis is down', async () => {
    await service.disconnect();
    const health = await service.getHealthStatus();
    expect(health.status).toBe('unhealthy');
    await redis.connect();
    (service as any).isConnected = true;
  });
});
