import { randomBytes } from 'crypto';

export class IdGeneratorUtil {
  /**
   * Generates a unique message ID
   * Format: wal_{timestamp}_{randomHex}
   */
  static generateMessageId(): string {
    const timestamp = Date.now();
    const randomHex = randomBytes(8).toString('hex');
    return `wal_${timestamp}_${randomHex}`;
  }

  /**
   * Generates a unique transaction ID
   * Format: txn_{timestamp}_{randomHex}
   */
  static generateTransactionId(): string {
    const timestamp = Date.now();
    const randomHex = randomBytes(12).toString('hex');
    return `txn_${timestamp}_${randomHex}`;
  }

  /**
   * Generates a unique request ID
   * Format: req_{timestamp}_{randomHex}
   */
  static generateRequestId(): string {
    const timestamp = Date.now();
    const randomHex = randomBytes(6).toString('hex');
    return `req_${timestamp}_${randomHex}`;
  }

  /**
   * Generates a correlation ID for tracing
   * Format: cor_{timestamp}_{randomHex}
   */
  static generateCorrelationId(): string {
    const timestamp = Date.now();
    const randomHex = randomBytes(8).toString('hex');
    return `cor_${timestamp}_${randomHex}`;
  }

  /**
   * Generates a shard key based on input string
   */
  static generateShardKey(input: string, shardCount: number): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % shardCount;
  }

  /**
   * Validates if a given ID follows our ID format
   */
  static isValidMessageId(id: string): boolean {
    return /^wal_\d{13}_[a-f0-9]{16}$/.test(id);
  }

  static isValidTransactionId(id: string): boolean {
    return /^txn_\d{13}_[a-f0-9]{24}$/.test(id);
  }
}