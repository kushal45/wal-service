import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DurabilityStatus } from '../enums/durability-status.enum';

export class WriteToLogResponseDto {
  @ApiProperty({
    description: 'Durability status of the message',
    enum: DurabilityStatus,
    example: DurabilityStatus.PERSISTED,
  })
  durable: DurabilityStatus;

  @ApiProperty({
    description: 'Unique message identifier',
    example: 'wal_1696291200000_abc123def',
  })
  messageId: string;

  @ApiPropertyOptional({
    description: 'Transaction identifier for multi-partition operations',
    example: 'txn_1696291200000_xyz789',
  })
  transactionId?: string;

  @ApiProperty({
    description: 'Response message',
    example: 'Message accepted for processing',
  })
  message: string;

  @ApiProperty({
    description: 'Response timestamp',
    example: '2025-10-03T10:30:00.000Z',
  })
  timestamp: Date;

  @ApiPropertyOptional({
    description: 'Estimated processing time in milliseconds',
    example: 2000,
  })
  estimatedProcessingTimeMs?: number;

  @ApiPropertyOptional({
    description: 'Queue position for delayed messages',
    example: 15,
  })
  queuePosition?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata about the request processing',
    example: {
      requestId: 'req_1696291200000_abc123',
      namespace: 'user-cache-replication',
      durabilityStatus: 'persisted',
      hasDelay: false,
      processingMode: 'immediate'
    },
  })
  metadata?: Record<string, any>;
}
