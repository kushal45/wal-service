import { MessageStatus } from '../enums/message-status.enum';

export interface EnrichedMessage {
  messageId: string;
  namespace: string;
  payload: Record<string, any>;
  target: any; // Will be properly typed with TargetConfigDto
  lifecycle?: {
    delay?: number;
    retryPolicy?: {
      maxAttempts?: number;
      backoffStrategy?: string;
      backoffMultiplier?: number;
      maxDelay?: number;
    };
  };
  metadata?: Record<string, string>;
  priority?: number;
  tags?: string[];
  
  // Enriched fields
  timestamp: Date;
  requestId: string;
  version: string;
  attemptCount: number;
  status: MessageStatus | string;
  correlationId?: string;
  traceId?: string;
  checksum?: string;
}