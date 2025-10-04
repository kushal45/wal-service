# Kubernetes Deployment Guide

This comprehensive guide documents the complete end-to-end Kubernetes deployment process for the WAL Service, including all the learnings, scripts, and automation built during the implementation.

## Table of Contents

- [Overview](#overview)
- [Local Development Environment Setup](#local-development-environment-setup)
- [Docker Registry Configuration](#docker-registry-configuration)
- [Kubernetes Configuration Structure](#kubernetes-configuration-structure)
- [Deployment Process](#deployment-process)
- [Image Building and Management](#image-building-and-management)
- [Environment-Specific Overlays](#environment-specific-overlays)
- [Automation Scripts](#automation-scripts)
- [Monitoring and Observability](#monitoring-and-observability)
- [Security Configuration](#security-configuration)
- [Best Practices](#best-practices)

## Overview

The WAL Service Kubernetes deployment consists of:

- **Base Configuration**: Core Kubernetes manifests in `k8s/base/`
- **Environment Overlays**: Environment-specific configurations in `k8s/overlays/`
- **Automation Scripts**: Deployment and management scripts in `scripts/`
- **Local Development**: Kind cluster with local registry setup
- **Multi-environment Support**: Dev, staging, and production configurations

## Local Development Environment Setup

### Prerequisites

```bash
# Required tools
brew install docker
brew install kubectl
brew install kind
brew install kustomize
```

### Kind Cluster with Registry Setup

The local development environment uses a Kind cluster with an integrated Docker registry:

```bash
# Start complete local environment
make cluster-start

# Or manually
./scripts/setup-local-k8s.sh kind start
```

**Key Configuration Details**:
- **Cluster Name**: `wal-service-cluster`
- **Registry**: `localhost:6000` (external) / `kind-registry:5000` (internal)
- **Ingress Controller**: NGINX ingress controller
- **Load Balancer**: MetalLB for service exposure

### Registry Port Configuration

**Critical Learning**: The registry accessibility differs between local and cluster contexts:

- **Local Host**: `localhost:6000` (for pushing images)
- **Inside Cluster**: `kind-registry:5000` (for pulling images)

This dual addressing is handled automatically by the deployment scripts.

## Docker Registry Configuration

### Insecure Registry Setup

Local development requires configuring the cluster nodes to trust the insecure HTTP registry:

```bash
# Applied automatically during cluster setup
for node in $(kind get nodes --name wal-service-cluster); do
  docker exec "$node" mkdir -p /etc/containerd/certs.d/kind-registry:5000
  docker exec "$node" bash -c 'cat > /etc/containerd/certs.d/kind-registry:5000/hosts.toml << EOF
server = "http://kind-registry:5000"

[host."http://kind-registry:5000"]
  capabilities = ["pull", "resolve"]
  skip_verify = true
EOF'
  docker exec "$node" systemctl restart containerd
done
```

### Registry Verification

```bash
# Check registry contents
curl -X GET http://localhost:6000/v2/_catalog
curl -X GET http://localhost:6000/v2/wal-service/tags/list

# Test image pull
docker pull localhost:6000/wal-service:latest
```

## Kubernetes Configuration Structure

### Base Configuration (`k8s/base/`)

```
k8s/base/
├── kustomization.yaml          # Base resource definitions
├── deployment.yaml             # Main application deployment
├── service.yaml               # Service definition
├── configmap.yaml             # Configuration map
├── secret.yaml                # Secrets (sealed)
├── rbac.yaml                  # Service account and RBAC
├── postgres/                  # Database components
│   ├── deployment.yaml
│   ├── service.yaml
│   └── pvc.yaml
├── redis/                     # Cache components
├── kafka/                     # Message queue components
├── localstack/                # AWS simulation
├── ingress.yaml               # Base ingress configuration
├── hpa.yaml                   # Horizontal Pod Autoscaler
├── network-policy.yaml        # Network policies
└── pod-disruption-budget.yaml # PDB for availability
```

### Environment Overlays (`k8s/overlays/`)

```
k8s/overlays/
├── dev/
│   ├── kustomization.yaml     # Dev-specific overrides
│   ├── configmap-patch.yaml   # Environment config
│   ├── resource-patch.yaml    # Resource adjustments
│   └── ingress-patch.yaml     # Dev domain configuration
├── staging/
│   └── [similar structure]
└── production/
    ├── kustomization.yaml     # Production-specific config
    ├── resource-patch.yaml    # Higher resource limits
    ├── replica-patch.yaml     # Multiple replicas
    └── tls-patch.yaml         # SSL/TLS configuration
```

## Deployment Process

### Automated Deployment

```bash
# Deploy to development environment
./scripts/deploy.sh deploy dev

# Deploy to production
./scripts/deploy.sh deploy production

# Deploy with options
./scripts/deploy.sh deploy dev --skip-build --dry-run
```

### Manual Deployment Steps

1. **Build and Push Image**:
   ```bash
   docker build --target production -t localhost:6000/wal-service:$(git rev-parse --short HEAD) .
   docker push localhost:6000/wal-service:$(git rev-parse --short HEAD)
   ```

2. **Apply Kubernetes Manifests**:
   ```bash
   kubectl apply -k k8s/overlays/dev
   ```

3. **Verify Deployment**:
   ```bash
   kubectl get pods -n wal-service-dev
   kubectl get svc -n wal-service-dev
   kubectl get ingress -n wal-service-dev
   ```

### Deployment Verification

```bash
# Check all resources
kubectl get all -n wal-service-dev

# Test health endpoint via ingress
curl http://dev.wal-service.local/api/v1/health

# Test via port-forward (direct service access)
kubectl port-forward svc/wal-service 8080:8080 -n wal-service-dev
curl http://localhost:8080/api/v1/health
```

## Image Building and Management

### Multi-stage Dockerfile

The application uses a multi-stage Dockerfile with distinct targets:

```dockerfile
# Development target (with watch mode)
FROM node:18-alpine as development
# ... development setup with nest start --watch

# Production target (optimized build)
FROM node:18-alpine as production  
# ... production build with compiled output
```

### Image Tagging Strategy

```bash
# Git-based tagging
COMMIT_HASH=$(git rev-parse --short HEAD)
BRANCH_NAME=$(git branch --show-current)

# Development images
docker build --target development -t localhost:6000/wal-service:dev-${COMMIT_HASH} .

# Production images
docker build --target production -t localhost:6000/wal-service:${COMMIT_HASH} .
docker build --target production -t localhost:6000/wal-service:latest .
```

### Image Loading to Cluster

```bash
# Load image into kind cluster
kind load docker-image localhost:6000/wal-service:${TAG} --name wal-service-cluster

# Verify image is available
kubectl describe pod <pod-name> -n wal-service-dev | grep Image
```

## Environment-Specific Overlays

### Development Environment

**Characteristics**:
- Single replica for faster iteration
- Debug logging enabled
- Development dependencies included
- Local service endpoints

**Key Configuration**:
```yaml
# k8s/overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- ../../base

images:
- name: wal-service
  newName: kind-registry:5000/wal-service
  newTag: latest

patchesStrategicMerge:
- configmap-patch.yaml
- resource-patch.yaml

# Namespace configuration
namespace: wal-service-dev
```

### Production Environment  

**Characteristics**:
- Multiple replicas for high availability
- Resource limits and requests defined
- Production logging configuration
- SSL/TLS enabled
- Monitoring enabled

**Key Features**:
- **High Availability**: Multiple replicas with pod disruption budgets
- **Resource Management**: CPU/memory limits and requests
- **Security**: Network policies and RBAC
- **Monitoring**: ServiceMonitor for Prometheus

## Automation Scripts

### Main Deployment Script (`scripts/deploy.sh`)

**Features**:
- Multi-environment deployment
- Build and push automation
- Health checking
- Rollback capability
- Dry-run mode

**Usage**:
```bash
./scripts/deploy.sh <command> [environment] [options]

Commands:
  deploy      Deploy to environment
  undeploy    Remove deployment
  restart     Restart services
  status      Show deployment status
  logs        Show service logs
  rollback    Rollback to previous version
  health      Check service health

Options:
  --skip-build    Skip Docker image build
  --skip-tests    Skip running tests
  --dry-run       Show what would be deployed
  --force         Force deployment without checks
```

**Example Workflows**:
```bash
# Full deployment with build and tests
./scripts/deploy.sh deploy dev

# Quick deployment (skip build and tests)
./scripts/deploy.sh deploy dev --skip-build --skip-tests

# Check deployment status
./scripts/deploy.sh status dev

# View logs
./scripts/deploy.sh logs dev

# Rollback if needed
./scripts/deploy.sh rollback dev
```

### Database Migration Script (`scripts/migrate.sh`)

**Features**:
- Database schema migration
- Data seeding
- Rollback capability
- Environment-specific migrations

### Utility Scripts

- **`scripts/build.sh`**: Standardized image building
- **`scripts/setup-local-k8s.sh`**: Complete local environment setup
- **`scripts/cleanup.sh`**: Environment cleanup

## Monitoring and Observability

### Health Checks

**Kubernetes Probes**:
```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/v1/ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5

startupProbe:
  httpGet:
    path: /api/v1/health
    port: 8080
  initialDelaySeconds: 60
  periodSeconds: 10
  failureThreshold: 12
```

### Logging

**Centralized Logging Setup**:
- Structured JSON logging
- Correlation IDs for request tracing
- Log aggregation via Fluentd/Fluent Bit
- Integration with monitoring systems

### Metrics and Monitoring

**Prometheus Integration**:
```yaml
# ServiceMonitor for Prometheus
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: wal-service
spec:
  selector:
    matchLabels:
      app: wal-service
  endpoints:
  - port: http
    path: /metrics
```

## Security Configuration

### RBAC (Role-Based Access Control)

```yaml
# k8s/base/rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: wal-service-account
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: wal-service-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]
```

### Network Policies

```yaml
# k8s/base/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: wal-service-netpol
spec:
  podSelector:
    matchLabels:
      app: wal-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
```

### Secrets Management

**Sealed Secrets Integration**:
```bash
# Create sealed secret
echo -n 'mysecret' | kubectl create secret generic db-password --dry-run=client --from-file=password=/dev/stdin -o yaml | kubeseal -o yaml > k8s/base/sealed-secret.yaml
```

## Best Practices

### 1. Image Management

**Production Images for All Environments**:
- Use production-optimized images even in development
- Avoid watch mode in containers for faster startup
- Use consistent base images across environments

### 2. Resource Management

**Define Limits and Requests**:
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### 3. Configuration Management

**Environment-Specific Config**:
- Use ConfigMaps for non-sensitive configuration
- Use Secrets for sensitive data
- Keep environment-specific values in overlays

### 4. Health Checks

**Comprehensive Health Endpoints**:
- Implement liveness, readiness, and startup probes
- Include dependency health checks
- Use appropriate timeouts and failure thresholds

### 5. Namespace Isolation

**Environment Separation**:
- Use dedicated namespaces per environment
- Apply network policies for isolation
- Use consistent naming conventions

### 6. Ingress Configuration

**Simple and Clear Routing**:
- Avoid complex path rewriting unless necessary
- Use consistent hostname patterns
- Minimize annotations for clarity

### 7. Deployment Strategy

**Rolling Updates**:
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 25%
    maxSurge: 25%
```

### 8. Monitoring

**Comprehensive Observability**:
- Implement metrics collection
- Use structured logging
- Set up alerting for critical issues
- Monitor resource usage

## Makefile Integration

The project includes a comprehensive Makefile for common operations:

```bash
# Cluster management
make cluster-start          # Start local cluster
make cluster-stop           # Stop cluster
make cluster-reset          # Reset cluster completely

# Deployment
make deploy-dev             # Deploy to development
make deploy-prod            # Deploy to production

# Development
make build                  # Build Docker images
make test                   # Run tests
make logs                   # Show application logs

# Database
make db-migrate             # Run database migrations
make db-seed                # Seed database with test data

# Debugging
make debug-pod              # Get shell access to pod
make port-forward           # Set up port forwarding
```

## Continuous Integration

### GitHub Actions Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy to Kubernetes
on:
  push:
    branches: [main]
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Build and push image
      run: |
        docker build --target production -t ${{ env.REGISTRY }}/wal-service:${{ github.sha }} .
        docker push ${{ env.REGISTRY }}/wal-service:${{ github.sha }}
    
    - name: Deploy to staging
      run: |
        ./scripts/deploy.sh deploy staging --skip-build
        
    - name: Run health checks
      run: |
        ./scripts/deploy.sh health staging
```

## Troubleshooting Quick Reference

### Common Issues and Solutions

1. **Images Not Found**: Check registry configuration and image tags
2. **Ingress 404/503 Errors**: Verify namespace conflicts and service endpoints
3. **Pod Startup Failures**: Check resource limits and health probe timeouts
4. **Registry Access Issues**: Verify insecure registry configuration on nodes

### Quick Debugging Commands

```bash
# Pod status and logs
kubectl get pods -n wal-service-dev
kubectl logs -f deployment/wal-service -n wal-service-dev

# Service connectivity
kubectl port-forward svc/wal-service 8080:8080 -n wal-service-dev

# Ingress status
kubectl get ingress --all-namespaces
kubectl describe ingress wal-service-ingress -n wal-service-dev
```

## Future Enhancements

### Planned Improvements

1. **GitOps Integration**: ArgoCD for automated deployments
2. **Service Mesh**: Istio for advanced traffic management
3. **Advanced Monitoring**: Distributed tracing with Jaeger
4. **Security Scanning**: Integration with security scanning tools
5. **Multi-cluster Support**: Cross-cluster deployments

This guide represents the complete Kubernetes deployment knowledge accumulated through hands-on implementation and troubleshooting of the WAL Service deployment infrastructure.