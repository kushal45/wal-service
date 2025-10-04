# WAL Service - Generic Write-Ahead Log Service

A comprehensive, production-ready Write-Ahead Log (WAL) service built with NestJS that provides reliable, durable, and scalable message processing across different backend systems.

## Features

- **Unified API**: Single `WriteToLog` endpoint for all WAL operations
- **Pluggable Backends**: Support for Kafka, SQS, Redis Streams
- **Namespace Isolation**: Logical separation with dedicated configurations
- **Delayed Processing**: Configurable message delays with jitter
- **Cross-Region Replication**: Automatic replication across geographic regions
- **Multi-Partition Transactions**: Orchestrated mutations across multiple systems
- **Dead Letter Queue (DLQ)**: Automated failure handling and recovery
- **Horizontal Scaling**: Shard-based scaling model
- **Monitoring & Metrics**: Built-in health checks and Prometheus metrics

## Architecture

The service is built using a modular NestJS architecture with the following key components:

### Directory Structure

```
src/
├── common/                          # Shared utilities, decorators, guards
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── pipes/
│   ├── types/
│   └── utils/
├── config/                          # Configuration management
│   └── configuration.ts             # Environment-based configuration
├── modules/
│   ├── wal/                         # Core WAL functionality
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── dto/
│   │   ├── types/
│   │   └── enums/
│   ├── namespace/                   # Namespace management
│   ├── producers/                   # Message producers (Kafka, SQS, Redis)
│   ├── consumers/                   # Message consumers
│   ├── targets/                     # Target adapters (DB, Cache, HTTP)
│   └── monitoring/                  # Health checks and metrics
└── database/                        # Database migrations and seeds
    ├── migrations/
    ├── seeds/
    └── factories/
```

## Quick Start

### Prerequisites

- Node.js 18+
- TypeScript
- PostgreSQL (for namespace configuration)
- At least one of: Apache Kafka, Redis, or AWS SQS

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd wal-service
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.template .env
   # Edit .env with your configuration
   ```

4. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb wal_service
   
   # Run migrations (when implemented)
   npm run migration:run
   
   # Seed initial data (when implemented)
   npm run seed
   ```

5. **Start the service**
   ```bash
   # Development mode
   npm run start:dev
   
   # Production mode
   npm run build
   npm run start:prod
   ```

### API Documentation

Once the service is running, visit:
- **Swagger UI**: `http://localhost:3000/api/docs`
- **Health Check**: `http://localhost:3000/api/v1/health`

## Current Implementation Status

✅ **Completed**
- [x] Project structure and directory setup
- [x] Common utilities (ID generation, hashing, error handling)
- [x] Configuration management with environment variables
- [x] WAL controller with placeholder endpoints
- [x] DTOs for request/response validation
- [x] Database entity for namespace configuration
- [x] Database migration for namespace table
- [x] Seed data for example namespaces
- [x] Main application bootstrap with security and validation
- [x] Swagger documentation setup

🚧 **In Progress / TODO**
- [ ] Namespace service implementation
- [ ] Producer factory and backend implementations (Kafka, SQS, Redis)
- [ ] Consumer framework and message processing
- [ ] Target adapters for different systems
- [ ] Monitoring and health check services
- [ ] Complete WAL service business logic
- [ ] Unit and integration tests
- [ ] Docker configuration
- [ ] Kubernetes manifests

## Environment Variables

Key configuration options (see `.env.template` for complete list):

| Variable | Description | Default |
|----------|-------------|----------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 3000 |
| `DATABASE_HOST` | PostgreSQL host | localhost |
| `KAFKA_BROKERS` | Kafka broker addresses | localhost:9092 |
| `REDIS_HOST` | Redis host | localhost |
| `VALID_API_KEYS` | Comma-separated API keys | default-api-key |

## API Usage

### Write to Log

```bash
curl -X POST http://localhost:3000/api/v1/wal/write \
  -H "Content-Type: application/json" \
  -H "X-API-Key: default-api-key" \
  -d '{
    "namespace": "user-cache-replication",
    "payload": {
      "operation": "SET",
      "key": "user:123",
      "value": {"name": "John Doe"}
    },
    "target": {
      "type": "cache",
      "config": {"regions": ["us-east-1", "eu-west-1"]}
    }
  }'
```

### Get Namespace Status

```bash
curl -X GET http://localhost:3000/api/v1/wal/namespace/user-cache-replication/status \
  -H "X-API-Key: default-api-key"
```

## Development

### Available Scripts

```bash
npm run start:dev     # Start in development mode
npm run build         # Build the application
npm run test          # Run tests
npm run test:e2e      # Run end-to-end tests
npm run lint          # Lint the code
npm run format        # Format code with Prettier
```

### Design Documents

Refer to the design documents for detailed architecture:
- `docs/HLD.md` - High-Level Design
- `docs/LLD.md` - Low-Level Design
- `docs/PRD.md` - Product Requirements Document

## Contributing

1. Follow the existing code structure and patterns
2. Add appropriate tests for new features
3. Update documentation for API changes
4. Ensure all environment variables are documented

## License

MIT License - see LICENSE file for details