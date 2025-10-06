import { DataSource } from 'typeorm';
import { Namespace } from '../../modules/namespace/entities/namespace.entity';
import { TargetType } from '../../modules/wal/dto/target-config.dto';

export async function seedNamespaces(dataSource: DataSource): Promise<void> {
  const namespaceRepository = dataSource.getRepository(Namespace);

  const now = new Date();
  const namespaces = [
    {
      name: 'user-cache-replication',
      description: 'Cross-region user cache replication',
      enabled: true,
      backend: 'kafka' as const,
      topicName: 'user-cache-replication-topic',
      retryPolicy: {
        maxAttempts: 5,
        backoffStrategy: 'exponential',
        backoffMultiplier: 2,
        maxDelay: 120000, // 2 minutes
      } as const,
      shardConfig: {
        strategy: 'hash',
        partitionCount: 6,
        customLogic: null,
      } as const,
      targetConfig: {
        type: TargetType.CACHE,
        config: {
          regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
          operation: 'SET',
          cacheType: 'redis',
        },
      },
      rateLimitConfig: {
        enabled: true,
        requestsPerSecond: 2000,
        burstLimit: 3000,
      },
      maxMessageSize: 2097152, // 2MB
      maxDelaySeconds: 43200, // 12 hours
      metadata: {
        owner: 'team-data-platform',
        tags: ['replication', 'cache', 'critical'],
        environment: process.env.NODE_ENV || 'development',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
      schemaRules: {
        requiredFields: ['name', 'topicName', 'backend'],
        maxLength: {
          name: 100,
          topicName: 200,
        },
        allowedBackends: ['kafka', 'sqs', 'redis'],
      },
    },
    {
      name: 'transaction-logging',
      description: 'Centralized transaction log for audit and compliance',
      enabled: true,
      backend: 'sqs' as const,
      topicName: 'transaction-log-topic',
      retryPolicy: {
        maxAttempts: 10,
        backoffStrategy: 'linear',
        backoffMultiplier: 1,
        maxDelay: 300000, // 5 minutes
      } as const,
      shardConfig: {
        strategy: 'round_robin',
        partitionCount: 4,
      } as const,
      targetConfig: {
        type: TargetType.DATABASE,
        config: {
          table: 'transactions',
          region: 'us-east-1',
        },
      },
      rateLimitConfig: {
        enabled: false,
        requestsPerSecond: 0,
        burstLimit: 0,
      },
      maxMessageSize: 1048576, // 1MB
      maxDelaySeconds: 86400, // 24 hours
      metadata: {
        owner: 'team-compliance',
        tags: ['audit', 'logging'],
        environment: process.env.NODE_ENV || 'development',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
      schemaRules: {
        requiredFields: ['name', 'topicName', 'backend'],
        allowedBackends: ['kafka', 'sqs', 'redis'],
      },
    },
    {
      name: 'notification-events',
      description: 'Event-driven notifications for user actions',
      enabled: true,
      backend: 'redis' as const,
      topicName: 'notification-events-topic',
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'constant',
        backoffMultiplier: 1,
        maxDelay: 60000, // 1 minute
      } as const,
      shardConfig: {
        strategy: 'random',
        partitionCount: 2,
      } as const,
      targetConfig: {
        type: TargetType.HTTP_SERVICE,
        config: {
          endpoint: 'https://api.example.com/notify',
          method: 'POST',
        },
      },
      rateLimitConfig: {
        enabled: true,
        requestsPerSecond: 500,
        burstLimit: 700,
      },
      maxMessageSize: 524288, // 512KB
      maxDelaySeconds: 3600, // 1 hour
      metadata: {
        owner: 'team-notifications',
        tags: ['notifications', 'events'],
        environment: process.env.NODE_ENV || 'development',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
      schemaRules: {
        requiredFields: ['name', 'topicName', 'backend'],
        allowedBackends: ['kafka', 'sqs', 'redis'],
      },
    },
    {
      name: 'bulk-delete',
      description: 'Delayed bulk delete operations',
      enabled: true,
      backend: 'sqs' as const,
      topicName: 'bulk-delete-queue',
      retryPolicy: {
        maxAttempts: 5,
        backoffStrategy: 'exponential',
        backoffMultiplier: 1.5,
        maxDelay: 300000, // 5 minutes
      } as const,
      shardConfig: {
        strategy: 'round_robin',
        partitionCount: 2,
      } as const,
      targetConfig: {
        type: TargetType.DATABASE,
        config: {
          operation: 'DELETE',
          batchSize: 100,
        },
      },
      rateLimitConfig: {
        enabled: true,
        requestsPerSecond: 100,
        burstLimit: 200,
      },
      maxMessageSize: 524288, // 512KB
      maxDelaySeconds: 86400, // 24 hours
      metadata: {
        owner: 'team-ops',
        tags: ['bulk', 'delete', 'maintenance'],
        environment: process.env.NODE_ENV || 'development',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
      schemaRules: {
        requiredFields: ['name', 'topicName', 'backend'],
        allowedBackends: ['kafka', 'sqs', 'redis'],
      },
    },
    {
      name: 'multi-partition-transaction',
      description: 'Multi-partition transaction orchestration',
      enabled: true,
      backend: 'kafka' as const,
      topicName: 'multi-partition-transaction-topic',
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'linear',
        backoffMultiplier: 1,
        maxDelay: 30000, // 30 seconds
      } as const,
      shardConfig: {
        strategy: 'custom',
        partitionCount: 6,
        customLogic: {
          extractKey: 'payload.partitionKey',
        },
      } as const,
      targetConfig: {
        type: TargetType.DATABASE,
        config: {
          transactional: true,
          partitions: ['A', 'B', 'C'],
        },
      },
      rateLimitConfig: {
        enabled: true,
        requestsPerSecond: 50,
        burstLimit: 100,
      },
      maxMessageSize: 2097152, // 2MB
      maxDelaySeconds: 3600, // 1 hour
      metadata: {
        owner: 'team-transactions',
        tags: ['multi-partition', 'transaction'],
        environment: process.env.NODE_ENV || 'development',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
      schemaRules: {
        requiredFields: ['name', 'topicName', 'backend'],
        allowedBackends: ['kafka', 'sqs', 'redis'],
      },
    },
    {
      name: 'webhook-notifications',
      description: 'External webhook notifications',
      enabled: true,
      backend: 'redis' as const,
      topicName: 'webhook-notifications-stream',
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'constant',
        backoffMultiplier: 1,
        maxDelay: 10000, // 10 seconds
      } as const,
      shardConfig: {
        strategy: 'hash',
        partitionCount: 1,
      } as const,
      targetConfig: {
        type: TargetType.HTTP_SERVICE,
        config: {
          method: 'POST',
          timeout: 5000,
          retryOnTimeout: true,
        },
      },
      rateLimitConfig: {
        enabled: true,
        requestsPerSecond: 200,
        burstLimit: 300,
      },
      maxMessageSize: 262144, // 256KB
      maxDelaySeconds: 1800, // 30 minutes
      metadata: {
        owner: 'team-notifications',
        tags: ['webhook', 'notifications'],
        environment: process.env.NODE_ENV || 'development',
      },
      createdAt: now,
      updatedAt: now,
      createdBy: 'seed-script',
      updatedBy: 'seed-script',
      schemaRules: {
        requiredFields: ['name', 'topicName', 'backend'],
        allowedBackends: ['kafka', 'sqs', 'redis'],
      },
    },
  ];

  for (const namespaceData of namespaces) {
    const existingNamespace = await namespaceRepository.findOne({
      where: { name: namespaceData.name },
    });

    if (!existingNamespace) {
      const namespace = namespaceRepository.create(namespaceData);
      await namespaceRepository.save(namespace);
      console.log(`Created namespace: ${namespaceData.name}`);
    } else {
      console.log(`Namespace already exists: ${namespaceData.name}`);
    }
  }
}

// Main execution for seeding
async function main(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'wal_user',
    password: process.env.DATABASE_PASSWORD || 'wal_password',
    database: process.env.DATABASE_NAME || 'wal_service_db',
    entities: [Namespace],
    synchronize: false,
    logging: true,
  });

  try {
    await dataSource.initialize();
    console.log('Database connected for seeding...');
    await seedNamespaces(dataSource);
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

if (require.main === module) {
  void main();
}
