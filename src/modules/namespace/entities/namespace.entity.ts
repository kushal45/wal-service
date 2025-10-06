import { TargetType } from '../../../modules/wal/dto/target-config.dto';
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('namespaces')
@Index(['enabled'])
export class Namespace {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'enum', enum: ['kafka', 'sqs', 'redis'], default: 'kafka' })
  backend: 'kafka' | 'sqs' | 'redis';

  @Column({ type: 'varchar', length: 200 })
  topicName: string;

  @Column({ type: 'jsonb' })
  retryPolicy: {
    maxAttempts: number;
    backoffStrategy: 'exponential' | 'linear' | 'constant';
    backoffMultiplier: number;
    maxDelay: number;
  };

  @Column({ type: 'jsonb' })
  shardConfig: {
    strategy: 'hash' | 'round_robin' | 'random' | 'custom';
    partitionCount: number;
    customLogic?: any;
  };

  @Column({ type: 'jsonb', nullable: true })
  targetConfig: {
    type: TargetType;
    config: Record<string, any>;
  };

  @Column({ type: 'jsonb', nullable: true })
  rateLimitConfig: {
    enabled: boolean;
    requestsPerSecond: number;
    burstLimit: number;
  };

  @Column({ type: 'integer', default: 1048576 }) // 1MB
  maxMessageSize: number;

  @Column({ type: 'integer', default: 86400 }) // 24 hours
  maxDelaySeconds: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  updatedBy: string;

  @Column({ type: 'jsonb', nullable: true })
  schemaRules: Record<string, any>;
}
