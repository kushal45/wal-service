export enum MessageStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  DEAD_LETTER = 'dead_letter',
}

export enum RoutingStrategy {
  HASH = 'hash',
  ROUND_ROBIN = 'round_robin',
  RANDOM = 'random',
  CUSTOM = 'custom',
}