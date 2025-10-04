import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { HealthService } from '../services/health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthCheckService: HealthCheckService,
    private readonly healthService: HealthService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the overall health status of the WAL service',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is unhealthy',
  })
  check(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () => this.healthService.checkDatabase('database'),
      () => this.healthService.checkProducers('producers'),
      () => this.healthService.checkMemory('memory_heap'),
      () => this.healthService.checkMemory('memory_rss'),
    ]);
  }

  @Get('readiness')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness check',
    description: 'Returns whether the service is ready to accept requests',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is ready',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready',
  })
  readiness(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () => this.healthService.checkDatabase('database'),
      () => this.healthService.checkProducers('producers'),
    ]);
  }

  @Get('liveness')
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness check',
    description: 'Returns whether the service is alive and responsive',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is alive',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not responsive',
  })
  liveness(): Promise<HealthCheckResult> {
    return this.healthCheckService.check([
      () => this.healthService.checkMemory('memory_heap'),
    ]);
  }
}