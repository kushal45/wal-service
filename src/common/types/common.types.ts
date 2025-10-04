export interface RequestContext {
  requestId: string;
  apiKey: string;
  timestamp: Date;
  userId?: string;
  traceId?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  timestamp: Date;
  details?: Record<string, any>;
}

export interface ServiceMetrics {
  totalRequests: number;
  successRate: number;
  averageLatency: number;
  errorRate: number;
  throughput: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}