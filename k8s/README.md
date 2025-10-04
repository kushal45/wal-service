# WAL Service Kubernetes Deployment

This directory contains comprehensive Kubernetes configurations and automation scripts for deploying the WAL Service in development and production environments.

## 🏗️ Architecture

The WAL Service deployment includes:
- **WAL Service API**: Main NestJS application
- **PostgreSQL**: Primary database
- **Redis**: Caching layer
- **Kafka**: Message queue (with Zookeeper)
- **LocalStack**: AWS services emulation (dev only)

## 📁 Directory Structure

```
k8s/
├── base/                          # Base Kubernetes resources
│   ├── deployment.yaml           # WAL service deployment
│   ├── service.yaml              # Services
│   ├── ingress.yaml              # Ingress configuration
│   ├── configmap.yaml            # Environment configuration
│   ├── secret.yaml               # Secrets
│   ├── rbac.yaml                 # RBAC permissions
│   ├── hpa.yaml                  # Horizontal Pod Autoscaler
│   ├── poddisruptionbudget.yaml  # Pod disruption budgets
│   ├── networkpolicy.yaml        # Network policies
│   ├── servicemonitor.yaml       # Prometheus monitoring
│   ├── postgres.yaml             # PostgreSQL deployment
│   ├── redis.yaml                # Redis deployment
│   ├── kafka.yaml                # Kafka + Zookeeper
│   ├── localstack.yaml           # AWS services emulation
│   └── kustomization.yaml        # Base kustomization
├── overlays/
│   ├── dev/                      # Development environment
│   │   ├── kustomization.yaml
│   │   ├── deployment-patch.yaml
│   │   ├── hpa-patch.yaml
│   │   ├── ingress-patch.yaml
│   │   ├── configmap-patch.yaml
│   │   └── pdb-patch.yaml
│   └── production/               # Production environment
│       ├── kustomization.yaml
│       ├── deployment-patch.yaml
│       ├── hpa-patch.yaml
│       └── ingress-patch.yaml
└── README.md                     # This file

scripts/
├── deploy.sh                     # Main deployment script
├── setup-local-k8s.sh           # Local cluster setup
└── db-migrate.sh                 # Database operations
```

## 🚀 Quick Start

### 1. Setup Local Kubernetes Cluster

Choose between kind or minikube:

```bash
# Using kind (recommended)
./scripts/setup-local-k8s.sh kind start

# Using minikube
./scripts/setup-local-k8s.sh minikube start
```

### 2. Deploy to Development

```bash
# Full deployment (build, test, deploy)
./scripts/deploy.sh dev deploy

# Skip tests and build (faster iteration)
./scripts/deploy.sh dev deploy --skip-tests --skip-build

# Dry run to see what would be deployed
./scripts/deploy.sh dev deploy --dry-run
```

### 3. Check Status

```bash
# Check deployment status
./scripts/deploy.sh dev status

# View logs
./scripts/deploy.sh dev logs
```

### 4. Access the Service

Add to your `/etc/hosts`:
```
127.0.0.1 dev.wal-service.local
```

Then access:
- API: http://dev.wal-service.local/api/v1
- Health: http://dev.wal-service.local/api/v1/health

## 🔧 Detailed Usage

### Deployment Script Options

The `deploy.sh` script supports various operations:

```bash
# Basic deployment
./scripts/deploy.sh [environment] [action] [options]

# Environments: dev, production
# Actions: deploy, undeploy, restart, status, logs, rollback
# Options: --skip-build, --skip-tests, --dry-run, --help
```

**Examples:**
```bash
# Deploy to development
./scripts/deploy.sh dev deploy

# Deploy to production with version tag
./scripts/deploy.sh production deploy

# Restart service
./scripts/deploy.sh dev restart

# Rollback deployment
./scripts/deploy.sh dev rollback

# Undeploy (remove all resources)
./scripts/deploy.sh dev undeploy
```

### Database Operations

Use the database migration script for database operations:

```bash
# Run migrations
./scripts/db-migrate.sh dev migrate

# Rollback migration
./scripts/db-migrate.sh dev rollback

# Seed database (dev only)
./scripts/db-migrate.sh dev seed

# Reset database (dev only)
./scripts/db-migrate.sh dev reset

# Check migration status
./scripts/db-migrate.sh dev status
```

### Local Cluster Management

```bash
# Start cluster
./scripts/setup-local-k8s.sh kind start

# Stop cluster
./scripts/setup-local-k8s.sh kind stop

# Reset cluster (clean start)
./scripts/setup-local-k8s.sh kind reset

# Check status
./scripts/setup-local-k8s.sh kind status
```

## 🏗️ Architecture Details

### Development Environment

**Resources:**
- 1 WAL service replica
- Reduced CPU/memory requests
- Debug logging enabled
- No SSL/TLS
- Local registry for images

**Access:**
- Host: `dev.wal-service.local`
- Port: 80 (HTTP)

### Production Environment

**Resources:**
- 5 WAL service replicas (min)
- High CPU/memory allocation
- Auto-scaling: 5-20 pods
- SSL/TLS enabled
- Production logging

**Access:**
- Host: `api.yourcompany.com` (configure in ingress-patch.yaml)
- Port: 443 (HTTPS)

## 🛡️ Security Features

### Network Policies
- Ingress: Only from ingress controller and monitoring
- Egress: Only to required services (DB, Redis, Kafka)
- Namespace isolation

### RBAC
- Minimal permissions for service account
- Read-only access to pods, services, endpoints
- Metrics collection permissions

### Pod Security
- Non-root user (UID 1001)
- Security contexts applied
- No privileged containers

## 📊 Monitoring & Observability

### Metrics
- Prometheus ServiceMonitor configured
- Custom metrics at `/api/v1/metrics`
- Health checks at `/api/v1/health`

### Health Checks
- Liveness probe: HTTP GET /api/v1/health
- Readiness probe: HTTP GET /api/v1/health
- Startup probe: HTTP GET /api/v1/health

### High Availability
- Pod Disruption Budgets
- Horizontal Pod Autoscaler
- Rolling updates with zero downtime

## 🔧 Configuration

### Environment Variables

Key environment variables are managed through ConfigMaps and Secrets:

**ConfigMap (wal-service-config):**
- `NODE_ENV`: Environment (development/production)
- `DATABASE_HOST`, `DATABASE_PORT`: Database connection
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `KAFKA_BROKERS`: Kafka brokers

**Secret (wal-service-secrets):**
- `DATABASE_USERNAME`, `DATABASE_PASSWORD`: DB credentials
- `API_MASTER_KEY`: API authentication
- `JWT_SECRET`: JWT signing secret

### Scaling Configuration

**Development:**
- Min replicas: 1
- Max replicas: 3
- CPU threshold: 70%

**Production:**
- Min replicas: 5
- Max replicas: 20
- CPU threshold: 70%
- Memory threshold: 80%

## 🔨 Development Workflow

### 1. Code Changes
```bash
# Make your code changes
git add .
git commit -m "Your changes"
```

### 2. Local Testing
```bash
# Deploy to local cluster
./scripts/deploy.sh dev deploy

# Check status
./scripts/deploy.sh dev status

# View logs
./scripts/deploy.sh dev logs
```

### 3. Database Changes
```bash
# Create migration
npm run migration:generate -- --name YourMigrationName

# Apply migration
./scripts/db-migrate.sh dev migrate
```

### 4. Debugging
```bash
# Port forward to service
kubectl port-forward -n wal-service-dev svc/wal-service 3000:80

# Exec into pod
kubectl exec -it -n wal-service-dev deployment/wal-service -- /bin/sh

# Check pod logs
kubectl logs -n wal-service-dev -l app.kubernetes.io/name=wal-service -f
```

## 🚀 Production Deployment

### Prerequisites
- Kubernetes cluster with ingress controller
- Cert-manager for SSL certificates
- Monitoring stack (Prometheus/Grafana)
- Container registry

### Steps
```bash
# 1. Update production image tag
# Edit k8s/overlays/production/kustomization.yaml

# 2. Update ingress domains
# Edit k8s/overlays/production/ingress-patch.yaml

# 3. Deploy
./scripts/deploy.sh production deploy

# 4. Verify deployment
./scripts/deploy.sh production status

# 5. Run database migrations
./scripts/db-migrate.sh production migrate
```

## 🛠️ Troubleshooting

For comprehensive troubleshooting guides, see:
- **[../docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)** - Complete troubleshooting guide with real-world solutions
- **[../docs/KUBERNETES_DEPLOYMENT_GUIDE.md](../docs/KUBERNETES_DEPLOYMENT_GUIDE.md)** - Comprehensive deployment guide
- **[../docs/DEPLOYMENT_LESSONS_LEARNED.md](../docs/DEPLOYMENT_LESSONS_LEARNED.md)** - Key insights and best practices

### Common Issues

**1. Pod not starting:**
```bash
kubectl describe pod -n wal-service-dev <pod-name>
kubectl logs -n wal-service-dev <pod-name>
```

**2. Service not accessible:**
```bash
kubectl get svc -n wal-service-dev
kubectl get ingress -n wal-service-dev
```

**3. Database connection issues:**
```bash
kubectl exec -n wal-service-dev deployment/postgres -- pg_isready
```

**4. Registry issues (development):**
```bash
docker ps | grep registry
curl http://localhost:6000/v2/_catalog  # Updated port
```

### Useful Commands

```bash
# Get all resources
kubectl get all -n wal-service-dev

# Describe deployment
kubectl describe deployment wal-service -n wal-service-dev

# Check events
kubectl get events -n wal-service-dev --sort-by='.lastTimestamp'

# Scale manually
kubectl scale deployment wal-service -n wal-service-dev --replicas=2

# Restart deployment
kubectl rollout restart deployment/wal-service -n wal-service-dev
```

## 📝 Notes

- Always test changes in development first
- Use `--dry-run` flag to preview changes
- Monitor resource usage and adjust limits accordingly
- Keep secrets encrypted and never commit them to version control
- Regular backup of production databases
- Review and update network policies as needed

## 🤝 Contributing

When adding new resources:
1. Add to `k8s/base/` directory
2. Update `k8s/base/kustomization.yaml`
3. Add environment-specific patches if needed
4. Update this README
5. Test in development environment