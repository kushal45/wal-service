import {
  ProducerResult,
  MessageHeaders,
} from '../../../common/types/message.types';

export interface MessagePayload {
  topic: string;
  key?: string;
  value: string;
  headers?: MessageHeaders;
  partition?: number;
  delay?: number; // For SQS delayed messages
}

export interface ProducerHealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  details?: Record<string, any>;
}

export interface IProducer {
  /**
   * Send a message to the backend system
   */
  send(message: MessagePayload): Promise<ProducerResult>;

  /**
   * Send multiple messages in batch
   */
  sendBatch?(messages: MessagePayload[]): Promise<ProducerResult[]>;

  /**
   * Health check for the producer
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get detailed health status
   */
  getHealthStatus(): Promise<ProducerHealthStatus>;

  /**
   * Initialize the producer connection
   */
  connect?(): Promise<void>;

  /**
   * Disconnect and cleanup resources
   */
  disconnect?(): Promise<void>;

  /**
   * Get producer metrics
   */
  getMetrics?(): Promise<Record<string, any>>;
}
