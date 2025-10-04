import { Module } from '@nestjs/common';

import { WalController } from './controllers/wal.controller';
// import { WalService } from './services/wal.service';
// import { MessageRouterService } from './services/message-router.service';
// import { LifecycleService } from './services/lifecycle.service';
// import { TransactionOrchestratorService } from './services/transaction-orchestrator.service';

import { NamespaceModule } from '../namespace/namespace.module';
import { ProducersModule } from '../producers/producers.module';
// import { ConsumersModule } from '../consumers/consumers.module';

@Module({
  imports: [
    // TODO: Add when implemented
    // BullModule.registerQueue(
    //   {
    //     name: 'wal-processing',
    //     defaultJobOptions: {
    //       removeOnComplete: 10,
    //       removeOnFail: 5,
    //     },
    //   },
    //   {
    //     name: 'wal-delayed',
    //     defaultJobOptions: {
    //       removeOnComplete: 50,
    //       removeOnFail: 10,
    //     },
    //   },
    //   {
    //     name: 'wal-transactions',
    //     defaultJobOptions: {
    //       removeOnComplete: 100,
    //       removeOnFail: 20,
    //     },
    //   },
    // ),
    NamespaceModule,
    ProducersModule,
    // ConsumersModule,
  ],
  controllers: [WalController],
  providers: [
    // TODO: Add when implemented
    // WalService,
    // MessageRouterService,
    // LifecycleService,
    // TransactionOrchestratorService,
  ],
  exports: [
    // TODO: Add when implemented
    // WalService,
    // MessageRouterService,
  ],
})
export class WalModule {}
