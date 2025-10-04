import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NamespaceConfigDto {
  @ApiProperty({
    description: 'Namespace identifier',
    example: 'user-cache-replication',
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Namespace description',
    example: 'Cross-region user cache replication',
  })
  description?: string;

  @ApiProperty({
    description: 'Whether the namespace is enabled',
    example: true,
  })
  enabled: boolean;

  @ApiProperty({
    description: 'Backend type for message processing',
    enum: ['kafka', 'sqs', 'redis'],
    example: 'kafka',
  })
  backend: 'kafka' | 'sqs' | 'redis';

  @ApiProperty({
    description: 'Topic/Queue name for backend',
    example: 'user-cache-replication-topic',
  })
  topicName: string;

  @ApiProperty({
    description: 'Retry policy configuration',
  })
  retryPolicy: {
    maxAttempts: number;
    backoffStrategy: 'exponential' | 'linear' | 'constant';
    backoffMultiplier: number;
    maxDelay: number;
  };

  @ApiProperty({
    description: 'Sharding configuration',
  })
  shardConfig: {
    strategy: 'hash' | 'round_robin' | 'random' | 'custom';
    partitionCount: number;
    customLogic?: any;
  };

  @ApiPropertyOptional({
    description: 'Target system configuration',
  })
  targetConfig?: {
    type: string;
    config: Record<string, any>;
  };

  @ApiPropertyOptional({
    description: 'Rate limiting configuration',
  })
  rateLimitConfig?: {
    enabled: boolean;
    requestsPerSecond: number;
    burstLimit: number;
  };

  @ApiProperty({
    description: 'Maximum message size in bytes',
    example: 1048576,
  })
  maxMessageSize: number;

  @ApiProperty({
    description: 'Maximum delay in seconds',
    example: 86400,
  })
  maxDelaySeconds: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: 'Created by user',
  })
  createdBy?: string;

  @ApiPropertyOptional({
    description: 'Last updated by user',
  })
  updatedBy?: string;
}