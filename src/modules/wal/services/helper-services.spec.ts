import { Test, TestingModule } from '@nestjs/testing';
import {
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';

import { MessageRouterService } from './message-router.service';
import { LifecycleService } from './lifecycle.service';
import { TransactionOrchestratorService } from './transaction-orchestrator.service';
import { EnrichedMessage } from '../types/enriched-message.type';
import { LifecycleConfigDto } from '../dto/lifecycle-config.dto';
import { MessageStatus } from '../enums/message-status.enum';
import { DurabilityStatus } from '../enums/durability-status.enum';
import { IProducer } from '../../producers/interfaces/producer.interface';

describe('Helper Services', () => {
  let messageRouterService: MessageRouterService;
  let lifecycleService: LifecycleService;
  let transactionOrchestratorService: TransactionOrchestratorService;

  const mockEnrichedMessage: EnrichedMessage = {
    messageId: 'wal_123456789_abc123',
    namespace: 'test-namespace',
    apiKey: 'test-api-key',
    payload: { key: 'value' },
    target: {
      type: 'http',
      config: { url: 'https://api.example.com/webhook' },
    },
    timestamp: new Date(),
    requestId: 'req_123456789_abc123',
    version: '1.0',
    attemptCount: 0,
    status: MessageStatus.PENDING,
    correlationId: 'cor_123456789_def456',
    traceId: 'trace_123456789_def456',
  };

  const mockProducer: IProducer = {
    send: jest.fn(),
    getType: jest.fn().mockReturnValue('redis'),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageRouterService,
        LifecycleService,
        TransactionOrchestratorService,
        // Mock Prometheus metrics providers
        makeCounterProvider({
          name: 'wal_transactions_total',
          help: 'Total number of transactions',
          labelNames: ['namespace', 'status', 'durability', 'reason'],
        }),
        makeHistogramProvider({
          name: 'wal_transaction_duration_seconds',
          help: 'Transaction duration in seconds',
          labelNames: ['namespace'],
        }),
        makeGaugeProvider({
          name: 'wal_active_transactions',
          help: 'Number of active transactions',
          labelNames: ['namespace'],
        }),
      ],
    }).compile();

    messageRouterService =
      module.get<MessageRouterService>(MessageRouterService);
    lifecycleService = module.get<LifecycleService>(LifecycleService);
    transactionOrchestratorService = module.get<TransactionOrchestratorService>(
      TransactionOrchestratorService,
    );
  });

  describe('MessageRouterService', () => {
    it('should be defined', () => {
      expect(messageRouterService).toBeDefined();
    });

    it('should route message to producer successfully', async () => {
      await expect(
        messageRouterService.routeMessage(mockEnrichedMessage, mockProducer),
      ).resolves.not.toThrow();
    });

    it('should return healthy status', async () => {
      const healthStatus = await messageRouterService.getHealthStatus();

      expect(healthStatus).toEqual({
        status: 'healthy',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('LifecycleService', () => {
    it('should be defined', () => {
      expect(lifecycleService).toBeDefined();
    });

    it('should manage lifecycle successfully', async () => {
      const lifecycleConfig: LifecycleConfigDto = {
        delay: 1000,
        retryPolicy: {
          maxAttempts: 3,
          backoffStrategy: 'exponential',
          backoffMultiplier: 2,
          maxDelay: 60000,
        },
      };

      await expect(
        lifecycleService.manageLifecycle(mockEnrichedMessage, lifecycleConfig),
      ).resolves.not.toThrow();
    });

    it('should calculate delay correctly', () => {
      const lifecycleConfig: LifecycleConfigDto = {
        delay: 5000,
      };

      const delay = lifecycleService.calculateDelay(lifecycleConfig);
      expect(delay).toBe(5000);
    });

    it('should return 0 delay when no config provided', () => {
      const delay = lifecycleService.calculateDelay();
      expect(delay).toBe(0);
    });

    it('should return 0 delay when config has no delay', () => {
      const lifecycleConfig: LifecycleConfigDto = {};
      const delay = lifecycleService.calculateDelay(lifecycleConfig);
      expect(delay).toBe(0);
    });

    it('should return healthy status', async () => {
      const healthStatus = await lifecycleService.getHealthStatus();

      expect(healthStatus).toEqual({
        status: 'healthy',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('TransactionOrchestratorService', () => {
    it('should be defined', () => {
      expect(transactionOrchestratorService).toBeDefined();
    });

    it('should orchestrate transaction successfully', async () => {
      const transactionContext = {
        transactionId: 'txn_123456789_abc123',
        messageId: mockEnrichedMessage.messageId,
        namespace: mockEnrichedMessage.namespace,
        producer: mockProducer,
        context: {
          requestId: mockEnrichedMessage.requestId,
          apiKey: mockEnrichedMessage.apiKey,
          timestamp: mockEnrichedMessage.timestamp,
        },
      };

      // Test begin transaction
      await expect(
        transactionOrchestratorService.beginTransaction(transactionContext),
      ).resolves.not.toThrow();

      // Test commit transaction
      const commitData = {
        messageId: mockEnrichedMessage.messageId,
        sendResult: { success: true },
        durabilityStatus: DurabilityStatus.PERSISTED,
      };

      await expect(
        transactionOrchestratorService.commitTransaction(
          'txn_123456789_abc123',
          commitData,
        ),
      ).resolves.not.toThrow();
    });

    it('should rollback transaction successfully', async () => {
      const rollbackData = {
        messageId: mockEnrichedMessage.messageId,
        reason: 'Test rollback',
        timestamp: new Date(),
      };

      await expect(
        transactionOrchestratorService.rollbackTransaction(
          'txn_123456789_abc123',
          rollbackData,
        ),
      ).resolves.not.toThrow();
    });

    it('should return healthy status', async () => {
      const healthStatus =
        await transactionOrchestratorService.getHealthStatus();

      expect(healthStatus).toEqual({
        status: 'healthy',
        timestamp: expect.any(Date),
        activeTransactions: 0,
        details: {
          maxConcurrentTransactions: 1000,
          transactionTimeoutMs: 30000,
        },
      });
    });
  });
});
