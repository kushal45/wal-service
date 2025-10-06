import { RedisProducerService } from './redis-producer.service';

describe('RedisProducerService', () => {
  let service: RedisProducerService;
  let mockConfigService: any;
  let mockMessagesSent: any;
  let mockSendDuration: any;
  let mockConnectionStatus: any;
  let mockRedis: any;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue({
        host: 'localhost',
        port: 6379,
        db: 0,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      }),
    };
    mockMessagesSent = { inc: jest.fn() };
    mockSendDuration = { startTimer: jest.fn(() => jest.fn()) };
    mockConnectionStatus = { set: jest.fn() };
    mockRedis = {
      xadd: jest.fn().mockResolvedValue('123-456'),
      expire: jest.fn().mockResolvedValue(1),
      zadd: jest.fn().mockResolvedValue(1),
      connect: jest.fn().mockResolvedValue(undefined),
      ping: jest.fn().mockResolvedValue('PONG'),
      info: jest
        .fn()
        .mockResolvedValue('used_memory:1024\r\nused_memory_peak:2048\r\n'),
      disconnect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
    };
    jest
      .spyOn(RedisProducerService.prototype as any, 'initializeRedisClient')
      .mockImplementation(function () {
        this.redis = mockRedis;
        this.setupEventHandlers = jest.fn();
      });
    service = new RedisProducerService(
      mockConfigService,
      mockMessagesSent,
      mockSendDuration,
      mockConnectionStatus,
    );
    service['redis'] = mockRedis;
    service['isConnected'] = true;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send message successfully', async () => {
    const message = {
      topic: 'test-topic',
      value: 'test-message',
      partition: 0,
      headers: {
        'content-type': 'application/json',
        'message-id': 'msg-1',
        namespace: 'test-ns',
        version: '1.0',
        'request-id': 'req-1',
        ttl: '60',
      },
    };
    const result = await service.send(message);
    expect(mockRedis.xadd).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.messageId).toBe('123-456');
    expect(mockMessagesSent.inc).toHaveBeenCalledWith({
      topic: 'test-topic',
      status: 'success',
    });
  });
  it('should handle errors when sending message', async () => {
    mockRedis.xadd.mockRejectedValueOnce(new Error('Redis send error'));
    const message = {
      topic: 'test-topic',
      value: 'test-message',
      partition: 0,
      headers: {
        'content-type': 'application/json',
        'message-id': 'msg-1',
        namespace: 'test-ns',
        version: '1.0',
        'request-id': 'req-1',
      },
    };
    await expect(service.send(message)).rejects.toThrow('Redis send error');
    expect(mockMessagesSent.inc).toHaveBeenCalledWith({
      topic: 'test-topic',
      status: 'error',
    });
  });

  it('should handle invalid input gracefully', async () => {
    // Missing topic
    const message = {
      value: 'test-message',
      partition: 0,
      headers: {
        'content-type': 'application/json',
        'message-id': 'msg-1',
        namespace: 'test-ns',
        version: '1.0',
        'request-id': 'req-1',
      },
    };
    await expect(service.send(message as any)).rejects.toThrow();
  });

  it('should report healthy connection status', async () => {
    const health = await service.getHealthStatus();
    expect(health.status).toBe('healthy');
    expect(health.details.connected).toBe(true);
  });

  it('should schedule delayed message', async () => {
    const message = {
      topic: 'test-topic',
      value: 'test-message',
      partition: 0,
      headers: { delay: '1000' },
    };
    await service['scheduleDelayedMessage'](message, '123-456');
    expect(mockRedis.zadd).toHaveBeenCalled();
  });
});
