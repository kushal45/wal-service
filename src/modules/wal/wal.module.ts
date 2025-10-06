import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { makeCounterProvider, makeHistogramProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';

import { WalController } from './controllers/wal.controller';
import { WalService } from './services/wal.service';
import { MessageRouterService } from './services/message-router.service';
import { LifecycleService } from './services/lifecycle.service';
import { TransactionOrchestratorService } from './services/transaction-orchestrator.service';

import { NamespaceModule } from '../namespace/namespace.module';
import { ProducersModule } from '../producers/producers.module';
// import { ConsumersModule } from '../consumers/consumers.module';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: 'wal-processing',
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      },
      {
        name: 'wal-delayed',
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 10,
        },
      },
      {
        name: 'wal-transactions',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 20,
        },
      },
    ),
    NamespaceModule.forRoot(),
    ProducersModule,
    //ConsumersModule,
  ],
  controllers: [WalController],
  providers: [
    WalService,
    MessageRouterService,
    LifecycleService,
    TransactionOrchestratorService,
    makeCounterProvider({
      name: 'wal_requests_total',
      help: 'Total number of WAL requests',
      labelNames: ['namespace', 'status', 'durability', 'errorType'],
    }),
    makeHistogramProvider({
      name: 'wal_request_duration_seconds',
      help: 'Duration of WAL requests in seconds',
      labelNames: ['namespace', 'operation'],
    }),
    makeGaugeProvider({
      name: 'wal_active_messages',
      help: 'Number of active WAL messages',
      labelNames: ['namespace'],
    }),
    // Transaction orchestrator metrics
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
  exports: [
    WalService,
    MessageRouterService,
  ],
})
export class WalModule {}
