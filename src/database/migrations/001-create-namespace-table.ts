import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateNamespaceTable1696291200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'namespaces',
        columns: [
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isPrimary: true,
          },
          {
            name: 'description',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'backend',
            type: 'enum',
            enum: ['kafka', 'sqs', 'redis'],
            default: "'kafka'",
          },
          {
            name: 'topicName',
            type: 'varchar',
            length: '200',
          },
          {
            name: 'retryPolicy',
            type: 'jsonb',
          },
          {
            name: 'shardConfig',
            type: 'jsonb',
          },
          {
            name: 'targetConfig',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'rateLimitConfig',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'maxMessageSize',
            type: 'integer',
            default: 1048576, // 1MB
          },
          {
            name: 'maxDelaySeconds',
            type: 'integer',
            default: 86400, // 24 hours
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'createdBy',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'updatedBy',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create index on enabled column for faster queries
    await queryRunner.createIndex(
      'namespaces',
      new TableIndex({
        name: 'IDX_NAMESPACES_ENABLED',
        columnNames: ['enabled'],
      }),
    );

    // Create index on backend column for filtering by backend type
    await queryRunner.createIndex(
      'namespaces',
      new TableIndex({
        name: 'IDX_NAMESPACES_BACKEND',
        columnNames: ['backend'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('namespaces', 'IDX_NAMESPACES_ENABLED');
    await queryRunner.dropIndex('namespaces', 'IDX_NAMESPACES_BACKEND');
    await queryRunner.dropTable('namespaces');
  }
}