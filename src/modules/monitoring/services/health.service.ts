import { Injectable } from '@nestjs/common';
import {
  HealthIndicatorResult,
  HealthIndicator,
  HealthCheckError,
} from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// import { ProducerFactoryService } from '../../producers/services/producer-factory.service';

@Injectable()
export class HealthService extends HealthIndicator {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    // TODO: Enable when ProducerFactoryService is available in the module
    // private readonly producerFactory: ProducerFactoryService,
  ) {
    super();
  }

  /**
   * Check database connectivity
   */
  async checkDatabase(key: string): Promise<HealthIndicatorResult> {
    try {
      if (!this.dataSource) {
        throw new Error('DataSource not available');
      }

      if (!this.dataSource.isInitialized) {
        throw new Error('Database connection not initialized');
      }

      // Simple query to test connectivity
      await this.dataSource.query('SELECT 1');

      return this.getStatus(key, true, {
        connection: 'active',
        database: this.dataSource.options.database,
      });
    } catch (error) {
      const result = this.getStatus(key, false, {
        message: error.message,
      });
      throw new HealthCheckError('Database check failed', result);
    }
  }

  /**
   * Check producers health
   */
  async checkProducers(key: string): Promise<HealthIndicatorResult> {
    try {
      // TODO: Enable when ProducerFactoryService is available
      // const health = await this.producerFactory.getAllProducersHealth();
      
      // Mock health status for now
      const health = {
        kafka: { status: 'healthy' as const, lastCheck: new Date() },
        sqs: { status: 'healthy' as const, lastCheck: new Date() },
        redis: { status: 'healthy' as const, lastCheck: new Date() },
      };

      const allHealthy = Object.values(health).every(
        (status) => status.status === 'healthy',
      );

      const details = Object.entries(health).reduce(
        (acc, [backend, status]) => {
          acc[backend] = {
            status: status.status,
            lastCheck: status.lastCheck,
          };
          return acc;
        },
        {} as Record<string, any>,
      );

      if (!allHealthy) {
        const result = this.getStatus(key, false, details);
        throw new HealthCheckError('Producers check failed', result);
      }

      return this.getStatus(key, true, details);
    } catch (error) {
      const result = this.getStatus(key, false, {
        message: error.message,
      });
      throw new HealthCheckError('Producers check failed', result);
    }
  }

  /**
   * Check memory usage
   */
  async checkMemory(key: string): Promise<HealthIndicatorResult> {
    const memoryUsage = process.memoryUsage();
    
    // Memory thresholds
    const maxHeapUsed = 1024 * 1024 * 1024; // 1GB
    const maxRssUsed = 2 * 1024 * 1024 * 1024; // 2GB

    const details = {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      external: memoryUsage.external,
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
    };

    let isHealthy = true;
    const issues: string[] = [];

    if (key === 'memory_heap' && memoryUsage.heapUsed > maxHeapUsed) {
      isHealthy = false;
      issues.push(`Heap usage ${details.heapUsedMB}MB exceeds threshold`);
    }

    if (key === 'memory_rss' && memoryUsage.rss > maxRssUsed) {
      isHealthy = false;
      issues.push(`RSS usage ${details.rssMB}MB exceeds threshold`);
    }

    if (!isHealthy) {
      const result = this.getStatus(key, false, {
        ...details,
        issues,
      });
      throw new HealthCheckError('Memory check failed', result);
    }

    return this.getStatus(key, true, details);
  }

  /**
   * Check disk space (placeholder for future implementation)
   */
  async checkDiskSpace(key: string, path: string, thresholdPercent: number = 90): Promise<HealthIndicatorResult> {
    try {
      // Placeholder implementation
      // In a real scenario, you would check actual disk usage
      const mockDiskUsage = {
        path,
        total: 1000 * 1024 * 1024 * 1024, // 1TB
        used: 500 * 1024 * 1024 * 1024,   // 500GB
        available: 500 * 1024 * 1024 * 1024, // 500GB
      };

      const usagePercent = (mockDiskUsage.used / mockDiskUsage.total) * 100;

      const details = {
        path: mockDiskUsage.path,
        usagePercent: Math.round(usagePercent * 100) / 100,
        totalGB: Math.round(mockDiskUsage.total / 1024 / 1024 / 1024),
        usedGB: Math.round(mockDiskUsage.used / 1024 / 1024 / 1024),
        availableGB: Math.round(mockDiskUsage.available / 1024 / 1024 / 1024),
      };

      if (usagePercent > thresholdPercent) {
        const result = this.getStatus(key, false, {
          ...details,
          threshold: thresholdPercent,
          message: `Disk usage ${details.usagePercent}% exceeds threshold ${thresholdPercent}%`,
        });
        throw new HealthCheckError('Disk space check failed', result);
      }

      return this.getStatus(key, true, details);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      const result = this.getStatus(key, false, {
        message: error.message,
      });
      throw new HealthCheckError('Disk space check failed', result);
    }
  }
}