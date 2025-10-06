import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';
import { EnrichedMessage } from '../types/enriched-message.type';
import { DurabilityStatus } from '../enums/durability-status.enum';
import { RequestContext } from '../../../common/types/common.types';
import { IProducer } from '../../producers/interfaces/producer.interface';

export interface TransactionContext {
  transactionId: string;
  messageId: string;
  namespace: string;
  producer: IProducer;
  context: RequestContext;
  startTime?: Date;
}

export interface TransactionResult {
  success: boolean;
  transactionId: string;
  durabilityStatus: DurabilityStatus;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface CommitData {
  messageId: string;
  sendResult: any;
  durabilityStatus: DurabilityStatus;
}

export interface RollbackData {
  messageId: string;
  reason: string;
  timestamp: Date;
}

@Injectable()
export class TransactionOrchestratorService {
  private readonly logger = new Logger(TransactionOrchestratorService.name);
  private readonly activeTransactions = new Map<string, TransactionContext>();
  private readonly transactionTimeoutMs = 30000; // 30 seconds

  constructor(
    @InjectMetric('wal_transactions_total')
    private readonly transactionCounter: Counter<string>,
    @InjectMetric('wal_transaction_duration_seconds')
    private readonly transactionDuration: Histogram<string>,
    @InjectMetric('wal_active_transactions')
    private readonly activeTransactionsGauge: Gauge<string>,
  ) {
    // Start cleanup task for orphaned transactions
    this.startTransactionCleanup();
  }

  /**
   * Begin a new transaction for message processing
   * LLD Section 4.4 - Transaction initiation
   */
  async beginTransaction(context: TransactionContext): Promise<void> {
    this.logger.debug(
      `Beginning transaction ${context.transactionId} for message ${context.messageId}`,
      {
        transactionId: context.transactionId,
        messageId: context.messageId,
        namespace: context.namespace,
      },
    );

    // Add start time to context
    const transactionContext: TransactionContext = {
      ...context,
      startTime: new Date(),
    };

    // Store active transaction
    this.activeTransactions.set(context.transactionId, transactionContext);

    // Update metrics
    this.activeTransactionsGauge.inc({ namespace: context.namespace });
    this.transactionCounter.inc({
      namespace: context.namespace,
      status: 'started',
    });

    this.logger.log(
      `Transaction ${context.transactionId} started successfully`,
      {
        transactionId: context.transactionId,
        messageId: context.messageId,
        namespace: context.namespace,
      },
    );
  }

  /**
   * Commit a transaction after successful processing
   * LLD Section 4.4 - Transaction commit
   */
  async commitTransaction(
    transactionId: string,
    commitData: CommitData,
  ): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      this.logger.warn(
        `Attempted to commit non-existent transaction ${transactionId}`,
      );
      return;
    }

    const timer = this.transactionDuration.startTimer({
      namespace: transaction.namespace,
    });

    try {
      this.logger.debug(`Committing transaction ${transactionId}`, {
        transactionId,
        messageId: commitData.messageId,
        durabilityStatus: commitData.durabilityStatus,
      });

      // Validate commit data
      await this.validateCommitData(commitData, transaction);

      // Clean up transaction
      this.activeTransactions.delete(transactionId);

      // Update metrics
      this.activeTransactionsGauge.dec({ namespace: transaction.namespace });
      this.transactionCounter.inc({
        namespace: transaction.namespace,
        status: 'committed',
        durability: commitData.durabilityStatus,
      });

      this.logger.log(`Transaction ${transactionId} committed successfully`, {
        transactionId,
        messageId: commitData.messageId,
        durabilityStatus: commitData.durabilityStatus,
        duration: Date.now() - (transaction.startTime?.getTime() || 0),
      });
    } catch (error) {
      this.logger.error(
        `Failed to commit transaction ${transactionId}: ${error.message}`,
        {
          transactionId,
          error: error.stack,
        },
      );

      // Attempt rollback on commit failure
      await this.rollbackTransaction(transactionId, {
        messageId: commitData.messageId,
        reason: `Commit failed: ${error.message}`,
        timestamp: new Date(),
      });

      throw error;
    } finally {
      timer();
    }
  }

  /**
   * Rollback transaction on failure
   * LLD Section 4.4 - Transaction rollback
   */
  async rollbackTransaction(
    transactionId: string,
    rollbackData: RollbackData,
  ): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);

    if (!transaction) {
      this.logger.warn(
        `Attempted to rollback non-existent transaction ${transactionId}`,
      );
      return;
    }

    try {
      this.logger.warn(`Rolling back transaction ${transactionId}`, {
        transactionId,
        messageId: rollbackData.messageId,
        reason: rollbackData.reason,
      });

      // Perform any necessary cleanup operations
      await this.performRollbackOperations(transaction, rollbackData);

      // Clean up transaction
      this.activeTransactions.delete(transactionId);

      // Update metrics
      this.activeTransactionsGauge.dec({ namespace: transaction.namespace });
      this.transactionCounter.inc({
        namespace: transaction.namespace,
        status: 'rolled_back',
        reason: this.categorizeRollbackReason(rollbackData.reason),
      });

      this.logger.log(`Transaction ${transactionId} rolled back successfully`, {
        transactionId,
        messageId: rollbackData.messageId,
        reason: rollbackData.reason,
        duration: Date.now() - (transaction.startTime?.getTime() || 0),
      });
    } catch (error) {
      this.logger.error(
        `Failed to rollback transaction ${transactionId}: ${error.message}`,
        {
          transactionId,
          error: error.stack,
        },
      );

      // Force cleanup even if rollback operations failed
      this.activeTransactions.delete(transactionId);
      this.activeTransactionsGauge.dec({ namespace: transaction.namespace });

      throw new InternalServerErrorException(
        `Transaction rollback failed: ${error.message}`,
      );
    }
  }

  /**
   * Get transaction status
   */
  getTransactionStatus(transactionId: string): TransactionContext | null {
    return this.activeTransactions.get(transactionId) || null;
  }

  /**
   * Get all active transactions for monitoring
   */
  getActiveTransactions(): TransactionContext[] {
    return Array.from(this.activeTransactions.values());
  }

  /**
   * Get health status of transaction orchestrator
   */
  async getHealthStatus(): Promise<{
    status: string;
    timestamp: Date;
    activeTransactions: number;
    details?: any;
  }> {
    const activeCount = this.activeTransactions.size;
    const status = activeCount < 1000 ? 'healthy' : 'degraded';

    return {
      status,
      timestamp: new Date(),
      activeTransactions: activeCount,
      details: {
        maxConcurrentTransactions: 1000,
        transactionTimeoutMs: this.transactionTimeoutMs,
      },
    };
  }

  /**
   * Validate commit data consistency
   */
  private async validateCommitData(
    commitData: CommitData,
    transaction: TransactionContext,
  ): Promise<void> {
    if (commitData.messageId !== transaction.messageId) {
      throw new Error(
        `Message ID mismatch: expected ${transaction.messageId}, got ${commitData.messageId}`,
      );
    }

    if (!commitData.sendResult) {
      throw new Error('Send result is required for commit');
    }

    if (
      !Object.values(DurabilityStatus).includes(commitData.durabilityStatus)
    ) {
      throw new Error(
        `Invalid durability status: ${commitData.durabilityStatus}`,
      );
    }
  }

  /**
   * Perform actual rollback operations
   */
  private async performRollbackOperations(
    transaction: TransactionContext,
    rollbackData: RollbackData,
  ): Promise<void> {
    try {
      // TODO: Implement specific rollback operations based on producer type
      // For now, just log the rollback attempt
      this.logger.debug(
        `Performing rollback operations for transaction ${transaction.transactionId}`,
        {
          transactionId: transaction.transactionId,
          messageId: rollbackData.messageId,
          producerType: transaction.producer.constructor.name,
        },
      );

      // Future implementations might include:
      // - Compensating transactions for database operations
      // - Message deletion from queues if supported
      // - Cache invalidation
      // - External service notifications
    } catch (error) {
      this.logger.error(`Rollback operations failed: ${error.message}`, {
        transactionId: transaction.transactionId,
        error: error.stack,
      });
      throw error;
    }
  }

  /**
   * Categorize rollback reason for metrics
   */
  private categorizeRollbackReason(reason: string): string {
    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes('timeout')) return 'timeout';
    if (lowerReason.includes('producer')) return 'producer_error';
    if (lowerReason.includes('validation')) return 'validation_error';
    if (lowerReason.includes('connection')) return 'connection_error';

    return 'unknown';
  }

  /**
   * Start background cleanup task for orphaned transactions
   */
  private startTransactionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const orphanedTransactions: string[] = [];

      for (const [
        transactionId,
        transaction,
      ] of this.activeTransactions.entries()) {
        if (transaction.startTime) {
          const age = now - transaction.startTime.getTime();
          if (age > this.transactionTimeoutMs) {
            orphanedTransactions.push(transactionId);
          }
        }
      }

      // Clean up orphaned transactions
      for (const transactionId of orphanedTransactions) {
        this.logger.warn(`Cleaning up orphaned transaction ${transactionId}`, {
          transactionId,
        });

        const transaction = this.activeTransactions.get(transactionId);
        if (transaction) {
          this.rollbackTransaction(transactionId, {
            messageId: transaction.messageId,
            reason: 'Transaction timeout - orphaned cleanup',
            timestamp: new Date(),
          }).catch((error) => {
            this.logger.error(
              `Failed to cleanup orphaned transaction ${transactionId}: ${error.message}`,
            );
          });
        }
      }
    }, this.transactionTimeoutMs / 2); // Check every 15 seconds
  }
}
