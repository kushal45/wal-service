import { Test, TestingModule } from '@nestjs/testing';
import { 
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { getQueueToken } from '@nestjs/bull';
import { WalService } from '../../src/modules/wal/services/wal.service';
import { NamespaceService } from '../../src/modules/namespace/services/namespace.service';
import { MessageRouterService } from '../../src/modules/wal/services/message-router.service';
import { ProducerFactoryService } from '../../src/modules/producers/services/producer-factory.service';
import { LifecycleService } from '../../src/modules/wal/services/lifecycle.service';
import { TransactionOrchestratorService } from '../../src/modules/wal/services/transaction-orchestrator.service';
import { IdGeneratorUtil } from '../../src/common/utils/id-generator.util';
import { WriteToLogDto } from '../../src/modules/wal/dto/write-to-log.dto';
import { RequestContext } from '../../src/common/types/common.types';
import { TargetType } from '../../src/modules/wal/dto/target-config.dto';
import { IProducer } from '../../src/modules/producers/interfaces/producer.interface';

/**
 * Performance Tests for WAL Service
 * Validates LLD requirement: <50ms response time per writeToLog operation
 */
describe('WalService Performance Tests (LLD <50ms target)', () => {
  let service: WalService;
  let namespaceService: jest.Mocked<NamespaceService>;
  let producerFactoryService: jest.Mocked<ProducerFactoryService>;
  let lifecycleService: jest.Mocked<LifecycleService>;
  let transactionOrchestratorService: jest.Mocked<TransactionOrchestratorService>;

  const mockDto: WriteToLogDto = {
    namespace: 'test-namespace',
    payload: { test: 'data' },
    target: { 
      type: TargetType.CACHE, 
      identifier: 'cache-1',
      config: { host: 'localhost', port: 6379 },
    },
    lifecycle: { delay: 1000 },
  };

  const mockContext: RequestContext = {
    requestId: 'req_123456789_abc123',
    apiKey: 'test-api-key-123456789-abcdef', // 26 characters - meets 16+ requirement
    timestamp: new Date(),
  };

  const mockNamespace = {
    id: 'ns_123456789',
    name: 'test-namespace',
    apiKey: 'test-api-key-123456789-abcdef', // Match the context API key
    description: 'Test namespace for performance testing',
    enabled: true,
    backend: 'redis',
    topicName: 'test-topic',
    isActive: true,
    maxMessageSize: 1000000,
    retentionPeriod: 86400,
    config: {
      redis: {
        host: 'localhost',
        port: 6379,
        retryAttempts: 3,
        retryDelay: 1000,
      },
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

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
            routeMessage: jest.fn(),
            determineOperation: jest.fn(),
          },
        },
        {
          provide: ProducerFactoryService,
          useValue: {
            getProducer: jest.fn(),
          },
        },
        {
          provide: LifecycleService,
          useValue: {
            calculateDelay: jest.fn(),
          },
        },
        {
          provide: TransactionOrchestratorService,
          useValue: {
            beginTransaction: jest.fn(),
            commitTransaction: jest.fn(),
          },
        },
        {
          provide: IdGeneratorUtil,
          useValue: {
            generateMessageId: jest.fn(),
          },
        },
        {
          provide: getQueueToken('wal-processing'),
          useValue: {
            add: jest.fn(),
            process: jest.fn(),
          },
        },
        {
          provide: getQueueToken('wal-delayed'),
          useValue: {
            add: jest.fn(),
            process: jest.fn(),
          },
        },
        // Mock Prometheus metrics providers
        makeCounterProvider({
          name: 'wal_requests_total',
          help: 'Total number of WAL requests',
          labelNames: ['namespace', 'status', 'errorType', 'durability'],
        }),
        makeHistogramProvider({
          name: 'wal_request_duration_seconds',
          help: 'WAL request duration in seconds',
          labelNames: ['namespace', 'operation'],
        }),
        makeGaugeProvider({
          name: 'wal_active_messages',
          help: 'Number of active messages',
          labelNames: ['namespace'],
        }),
      ],
    }).compile();

    service = module.get<WalService>(WalService);
    namespaceService = module.get(NamespaceService);
    producerFactoryService = module.get(ProducerFactoryService);
    lifecycleService = module.get(LifecycleService);
    transactionOrchestratorService = module.get(TransactionOrchestratorService);

    // Setup common mocks
    namespaceService.getNamespace.mockResolvedValue(mockNamespace);
    namespaceService.validateRequest.mockResolvedValue();
    lifecycleService.calculateDelay.mockReturnValue(1000);
    jest
      .spyOn(IdGeneratorUtil, 'generateMessageId')
      .mockReturnValue('wal_123456789_abc123');

    const mockProducer: IProducer = {
      send: jest.fn().mockResolvedValue({
        success: true,
        messageId: 'wal_123456789_abc123',
        timestamp: new Date(),
        durable: true,
        partition: 0,
        offset: 'wal_123456789_abc123',
        metadata: {},
      }),
      getType: jest.fn().mockReturnValue('redis'),
      healthCheck: jest.fn().mockResolvedValue(true),
      getHealthStatus: jest.fn().mockResolvedValue({
        status: 'healthy' as const,
        lastCheck: new Date(),
        details: {},
      }),
    } as any;
    producerFactoryService.getProducer.mockReturnValue(mockProducer);

    transactionOrchestratorService.beginTransaction.mockResolvedValue();
    transactionOrchestratorService.commitTransaction.mockResolvedValue();
  });

  describe('Performance Benchmarks', () => {
    it('should process single writeToLog request within 50ms (LLD standard)', async () => {
      const startTime = process.hrtime.bigint();

      await service.writeToLog(mockDto, mockContext);

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000; // Convert nanoseconds to milliseconds

      console.log(`Single request duration: ${durationMs.toFixed(2)}ms`);
      expect(durationMs).toBeLessThan(50);
    });

    it('should maintain <50ms p95 latency under concurrent load', async () => {
      const concurrentRequests = 100;
      const durations: number[] = [];

      const promises = Array.from(
        { length: concurrentRequests },
        async (_, index) => {
          const testDto = {
            ...mockDto,
            payload: { test: 'data', index },
          };

          const startTime = process.hrtime.bigint();

          await service.writeToLog(testDto, {
            ...mockContext,
            requestId: `req_${index}`,
          });

          const endTime = process.hrtime.bigint();
          const durationMs = Number(endTime - startTime) / 1_000_000;
          durations.push(durationMs);

          return durationMs;
        },
      );

      await Promise.all(promises);

      // Calculate percentiles
      durations.sort((a, b) => a - b);
      const p50 = durations[Math.floor(durations.length * 0.5)];
      const p95 = durations[Math.floor(durations.length * 0.95)];
      const p99 = durations[Math.floor(durations.length * 0.99)];
      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const max = Math.max(...durations);

      console.log(
        `Performance Statistics for ${concurrentRequests} concurrent requests:`,
      );
      console.log(`  Average: ${avg.toFixed(2)}ms`);
      console.log(`  P50 (Median): ${p50.toFixed(2)}ms`);
      console.log(`  P95: ${p95.toFixed(2)}ms`);
      console.log(`  P99: ${p99.toFixed(2)}ms`);
      console.log(`  Max: ${max.toFixed(2)}ms`);

      expect(p95).toBeLessThan(50);
      expect(avg).toBeLessThan(25); // Average should be even better
    });

    it('should handle 1000 requests/second throughput target', async () => {
      const targetRps = 1000;
      const testDurationSeconds = 2;
      const totalRequests = targetRps * testDurationSeconds;

      const startTime = Date.now();
      let completedRequests = 0;
      const errors: Error[] = [];

      // Create batches to avoid overwhelming the system
      const batchSize = 50;
      const batches = Math.ceil(totalRequests / batchSize);

      for (let batch = 0; batch < batches; batch++) {
        const batchPromises = Array.from(
          { length: Math.min(batchSize, totalRequests - batch * batchSize) },
          async (_, index) => {
            try {
              const requestIndex = batch * batchSize + index;
              await service.writeToLog(
                {
                  ...mockDto,
                  payload: { test: 'data', batch, index: requestIndex },
                },
                { ...mockContext, requestId: `req_${requestIndex}` },
              );
              completedRequests++;
            } catch (error) {
              errors.push(error as Error);
            }
          },
        );

        await Promise.all(batchPromises);

        // Small delay between batches to simulate realistic load
        if (batch < batches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      const endTime = Date.now();
      const actualDurationSeconds = (endTime - startTime) / 1000;
      const actualRps = completedRequests / actualDurationSeconds;

      console.log(`Throughput Test Results:`);
      console.log(`  Target RPS: ${targetRps}`);
      console.log(`  Actual RPS: ${actualRps.toFixed(0)}`);
      console.log(
        `  Completed Requests: ${completedRequests}/${totalRequests}`,
      );
      console.log(`  Errors: ${errors.length}`);
      console.log(`  Duration: ${actualDurationSeconds.toFixed(2)}s`);

      expect(actualRps).toBeGreaterThanOrEqual(targetRps * 0.9); // Allow 10% variance
      expect(errors.length).toBeLessThan(totalRequests * 0.01); // Less than 1% error rate
    });

    it('should maintain performance with large payloads', async () => {
      // Test with larger payloads (up to 100KB)
      const largeSizes = [1024, 10240, 51200, 102400]; // 1KB, 10KB, 50KB, 100KB

      for (const size of largeSizes) {
        const largePayload = {
          data: 'x'.repeat(size),
          metadata: { size, timestamp: new Date() },
        };

        const testDto = {
          ...mockDto,
          payload: largePayload,
        };

        const startTime = process.hrtime.bigint();

        await service.writeToLog(testDto, mockContext);

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;

        console.log(
          `Large payload (${size} bytes) duration: ${durationMs.toFixed(2)}ms`,
        );

        // Allow slightly higher latency for larger payloads, but still reasonable
        const maxAllowedMs = Math.min(50 + size / 1024, 100); // 50ms base + 1ms per KB, max 100ms
        expect(durationMs).toBeLessThan(maxAllowedMs);
      }
    });

    it('should handle producer selection performance', async () => {
      // Test the producer selection logic performance
      const iterations = 1000;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = process.hrtime.bigint();

        await service.selectProducer(mockNamespace as any);

        const endTime = process.hrtime.bigint();
        const durationMs = Number(endTime - startTime) / 1_000_000;
        durations.push(durationMs);
      }

      const avgDuration =
        durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      console.log(`Producer Selection Performance (${iterations} iterations):`);
      console.log(`  Average: ${avgDuration.toFixed(3)}ms`);
      console.log(`  Max: ${maxDuration.toFixed(3)}ms`);

      // Producer selection should be very fast (<5ms on average)
      expect(avgDuration).toBeLessThan(5);
      expect(maxDuration).toBeLessThan(20);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not have significant memory leaks during sustained load', async () => {
      const initialMemory = process.memoryUsage();

      // Process many requests
      const totalRequests = 1000;
      const batchSize = 100;

      for (let batch = 0; batch < totalRequests / batchSize; batch++) {
        const promises = Array.from({ length: batchSize }, (_, index) =>
          service.writeToLog(
            { ...mockDto, payload: { batch, index } },
            { ...mockContext, requestId: `req_${batch}_${index}` },
          ),
        );

        await Promise.all(promises);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();
      const heapIncrease =
        (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024; // MB

      console.log(`Memory Usage Analysis:`);
      console.log(
        `  Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(
        `  Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      );
      console.log(`  Heap Increase: ${heapIncrease.toFixed(2)} MB`);

      // Heap increase should be minimal (less than 50MB for 1000 requests)
      expect(heapIncrease).toBeLessThan(50);
    });
  });
});
