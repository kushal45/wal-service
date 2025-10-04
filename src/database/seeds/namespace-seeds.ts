import { DataSource } from 'typeorm';
import { Namespace } from '../../modules/namespace/entities/namespace.entity';

export async function seedNamespaces(dataSource: DataSource): Promise<void> {
  const namespaceRepository = dataSource.getRepository(Namespace);

  const namespaces = [
    {
      name: 'user-cache-replication',
      description: 'Cross-region user cache replication',
      enabled: true,
      backend: 'kafka' as const,
      topicName: 'user-cache-replication-topic',
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential' as const,
        backoffMultiplier: 2,
        maxDelay: 60000, // 1 minute
      },
      shardConfig: {
        strategy: 'hash' as const,
        partitionCount: 3,
      },
      targetConfig: {
        type: 'cache',
        config: {
          regions: ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
          operation: 'SET',
        },
      },
      rateLimitConfig: {
        enabled: true,
        requestsPerSecond: 1000,
        burstLimit: 1500,
      },
      maxMessageSize: 1048576, // 1MB
      maxDelaySeconds: 86400, // 24 hours
      createdBy: 'system',
    },
    {
      name: 'bulk-delete',
      description: 'Delayed bulk delete operations',
      enabled: true,
      backend: 'sqs' as const,
      topicName: 'bulk-delete-queue',
      retryPolicy: {
        maxAttempts: 5,
        backoffStrategy: 'exponential' as const,
        backoffMultiplier: 1.5,
        maxDelay: 300000, // 5 minutes
      },
      shardConfig: {
        strategy: 'round_robin' as const,
        partitionCount: 2,
      },
      targetConfig: {
        type: 'database',
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
      createdBy: 'system',
    },
    {
      name: 'multi-partition-transaction',
      description: 'Multi-partition transaction orchestration',
      enabled: true,
      backend: 'kafka' as const,
      topicName: 'multi-partition-transaction-topic',
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'linear' as const,
        backoffMultiplier: 1,
        maxDelay: 30000, // 30 seconds
      },
      shardConfig: {
        strategy: 'custom' as const,
        partitionCount: 6,
        customLogic: {
          extractKey: 'payload.partitionKey',
        },
      },
      targetConfig: {
        type: 'database',
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
      createdBy: 'system',
    },
    {
      name: 'webhook-notifications',
      description: 'External webhook notifications',
      enabled: true,
      backend: 'redis' as const,
      topicName: 'webhook-notifications-stream',
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'constant' as const,
        backoffMultiplier: 1,
        maxDelay: 10000, // 10 seconds
      },
      shardConfig: {
        strategy: 'hash' as const,
        partitionCount: 1,
      },
      targetConfig: {
        type: 'http',
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
      createdBy: 'system',
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