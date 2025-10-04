export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // API Configuration
  api: {
    prefix: 'api/v1',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['*'],
    timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
  },

  // Database Configuration
  database: {
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || 'wal_service',
    ssl: process.env.DATABASE_SSL === 'true',
    logging: process.env.DATABASE_LOGGING === 'true',
    synchronize: process.env.NODE_ENV === 'development',
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10', 10),
    minConnections: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '2', 10),
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
  },

  // Kafka Configuration
  kafka: {
    brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
    clientId: process.env.KAFKA_CLIENT_ID || 'wal-service',
    groupId: process.env.KAFKA_GROUP_ID || 'wal-service-consumer-group',
    ssl: process.env.KAFKA_SSL === 'true',
    sasl: process.env.KAFKA_SASL_USERNAME ? {
      mechanism: 'plain' as const,
      username: process.env.KAFKA_SASL_USERNAME,
      password: process.env.KAFKA_SASL_PASSWORD,
    } : undefined,
    connectionTimeout: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || '3000', 10),
    requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000', 10),
    retry: {
      initialRetryTime: 100,
      retries: 8,
    },
  },

  // AWS SQS Configuration
  sqs: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: process.env.SQS_ENDPOINT, // For LocalStack
    queueUrlPrefix: process.env.SQS_QUEUE_URL_PREFIX || 'https://sqs.us-east-1.amazonaws.com/123456789012/',
    maxReceiveCount: parseInt(process.env.SQS_MAX_RECEIVE_COUNT || '3', 10),
    visibilityTimeout: parseInt(process.env.SQS_VISIBILITY_TIMEOUT || '30', 10),
    messageRetentionPeriod: parseInt(process.env.SQS_MESSAGE_RETENTION_PERIOD || '1209600', 10), // 14 days
  },

  // Security Configuration
  security: {
    apiKeys: process.env.VALID_API_KEYS?.split(',') || ['default-api-key'],
    jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key',
    hashSalt: process.env.HASH_SALT || 'super-secret-salt',
  },

  // Rate Limiting
  rateLimit: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  // Monitoring
  monitoring: {
    metricsEnabled: process.env.METRICS_ENABLED === 'true',
    healthCheckEnabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT || '9090', 10),
  },

  // WAL Service Specific
  wal: {
    defaultBackend: process.env.WAL_DEFAULT_BACKEND || 'kafka',
    maxMessageSize: parseInt(process.env.WAL_MAX_MESSAGE_SIZE || '1048576', 10), // 1MB
    defaultDelaySeconds: parseInt(process.env.WAL_DEFAULT_DELAY_SECONDS || '0', 10),
    maxDelaySeconds: parseInt(process.env.WAL_MAX_DELAY_SECONDS || '86400', 10), // 24 hours
    retryAttempts: parseInt(process.env.WAL_RETRY_ATTEMPTS || '3', 10),
    retryBackoffMs: parseInt(process.env.WAL_RETRY_BACKOFF_MS || '1000', 10),
    transactionTimeoutMs: parseInt(process.env.WAL_TRANSACTION_TIMEOUT_MS || '300000', 10), // 5 minutes
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    fileEnabled: process.env.LOG_FILE_ENABLED === 'true',
    filePath: process.env.LOG_FILE_PATH || 'logs/wal-service.log',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
  },
});