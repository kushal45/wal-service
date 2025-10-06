import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';

@Module({
  imports: [PrometheusModule],
  providers: [
    // WAL service metrics
    makeCounterProvider({
      name: 'wal_requests_total',
      help: 'Total number of WAL requests',
      labelNames: ['namespace', 'status', 'durability', 'errorType'],
    }),
    makeHistogramProvider({
      name: 'wal_request_duration_seconds',
      help: 'WAL request duration in seconds',
      labelNames: ['namespace', 'operation'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    }),
    makeGaugeProvider({
      name: 'wal_active_messages',
      help: 'Number of active messages being processed',
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
      buckets: [0.001, 0.01, 0.1, 1, 10, 30],
    }),
    makeGaugeProvider({
      name: 'wal_active_transactions',
      help: 'Number of active transactions',
      labelNames: ['namespace'],
    }),
    
    // Redis producer metrics
    makeCounterProvider({
      name: 'redis_messages_sent_total',
      help: 'Total number of messages sent to Redis',
      labelNames: ['topic', 'status'],
    }),
    makeHistogramProvider({
      name: 'redis_send_duration_seconds',
      help: 'Redis send operation duration in seconds',
      labelNames: ['topic'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    }),
    makeGaugeProvider({
      name: 'redis_connection_status',
      help: 'Redis connection status (1=connected, 0=disconnected)',
      labelNames: ['status'],
    }),
  ],
  exports: [
    // The providers are automatically available for injection via @InjectMetric decorator
    // No need to export them as they are registered in the Prometheus registry
  ],
})
export class MetricsModule {}
