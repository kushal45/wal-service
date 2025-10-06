
import { ProducerFactoryService } from './producer-factory.service';
import { ConfigService } from '@nestjs/config';
import { RedisProducerService } from '../redis/redis-producer.service';

describe('ProducerFactoryService', () => {
  let service: ProducerFactoryService;
  let mockConfigService: any;
  let mockRedisProducer: any;

  beforeEach(() => {
    mockConfigService = { get: jest.fn() };
    mockRedisProducer = {
      send: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue(true),
      getHealthStatus: jest.fn().mockResolvedValue({ status: 'healthy', lastCheck: new Date(), details: { backend: 'redis', connected: true } }),
      getMetrics: jest.fn().mockResolvedValue({ connected: true }),
      disconnect: jest.fn(),
    };
    service = new ProducerFactoryService(
      mockConfigService,
      mockRedisProducer,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return a healthy redis producer', () => {
    const producer = service.getProducer('redis');
    expect(producer).toBe(mockRedisProducer);
  });

  it('should handle all producers unhealthy', async () => {
    mockRedisProducer.getHealthStatus.mockResolvedValueOnce({ status: 'unhealthy', lastCheck: new Date(), details: { backend: 'redis', connected: false } });
    const health = await service.getProducerHealth('redis');
    expect(health.status).toBe('unhealthy');
  });

  it('should throw error for unknown producer type', () => {
    expect(() => service.getProducer('unknown' as any)).toThrow('Unsupported backend: unknown');
  });
});
