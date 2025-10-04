export enum ErrorCode {
  // Validation Errors
  INVALID_NAMESPACE = 'INVALID_NAMESPACE',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',
  INVALID_TARGET = 'INVALID_TARGET',
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // Authentication/Authorization Errors  
  INVALID_API_KEY = 'INVALID_API_KEY',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Business Logic Errors
  NAMESPACE_NOT_FOUND = 'NAMESPACE_NOT_FOUND',
  NAMESPACE_DISABLED = 'NAMESPACE_DISABLED',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',

  // Infrastructure Errors
  PRODUCER_UNAVAILABLE = 'PRODUCER_UNAVAILABLE',
  CONSUMER_ERROR = 'CONSUMER_ERROR',
  TARGET_SYSTEM_ERROR = 'TARGET_SYSTEM_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  QUEUE_ERROR = 'QUEUE_ERROR',

  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // General Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT = 'TIMEOUT',
}

export interface ErrorContext {
  requestId?: string;
  namespace?: string;
  messageId?: string;
  transactionId?: string;
  userId?: string;
  apiKey?: string;
  timestamp?: Date;
  [key: string]: any;
}

export class WALError extends Error {
  public readonly code: ErrorCode;
  public readonly context: ErrorContext;
  public readonly isRetryable: boolean;
  public readonly statusCode: number;

  constructor(
    message: string,
    code: ErrorCode,
    context: ErrorContext = {},
    isRetryable = false,
    statusCode = 500,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.context = context;
    this.isRetryable = isRetryable;
    this.statusCode = statusCode;
  }
}

export class ValidationError extends WALError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, ErrorCode.VALIDATION_FAILED, context, false, 400);
  }
}

export class NamespaceError extends WALError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, ErrorCode.NAMESPACE_NOT_FOUND, context, false, 404);
  }
}

export class ProducerError extends WALError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, ErrorCode.PRODUCER_UNAVAILABLE, context, true, 503);
  }
}

export class TargetSystemError extends WALError {
  constructor(message: string, context: ErrorContext = {}) {
    super(message, ErrorCode.TARGET_SYSTEM_ERROR, context, true, 502);
  }
}