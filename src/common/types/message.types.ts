export interface MessageHeaders {
  'content-type': string;
  'message-id': string;
  'namespace': string;
  'version': string;
  'request-id': string;
  'routing-key'?: string;
  'correlation-id'?: string;
  'retry-count'?: string;
  'delay-until'?: string;
  [key: string]: string | undefined;
}

export interface ProducerResult {
  messageId: string;
  partition?: number;
  offset?: string;
  timestamp?: Date;
  durable: boolean;
}

export interface ConsumerMessage {
  messageId: string;
  namespace: string;
  payload: Record<string, any>;
  headers: MessageHeaders;
  timestamp: Date;
  attemptCount: number;
}

export interface MessageProcessingResult {
  success: boolean;
  messageId: string;
  processingTime: number;
  error?: Error;
  retryable?: boolean;
}