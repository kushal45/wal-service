# Skaffold Development Workflow

This document describes the enhanced development workflow using Skaffold for hot reload and rapid development.

## Overview

Skaffold provides automatic file watching, hot reload, and seamless development workflow for the WAL Service. It watches your source code changes and automatically syncs them to your running Kubernetes pods.

## Prerequisites

- Local Kubernetes cluster running (use `make cluster-start`)
- Skaffold installed (automatically installed via Homebrew)
- Docker registry running on `localhost:6000`

## Quick Start

### Start Development with Hot Reload

```bash
# Start development environment with hot reload
make dev-start

# OR directly with skaffold
skaffold dev --port-forward
```

This will:
1. Build the development Docker image
2. Deploy to your local Kubernetes cluster
3. Set up port forwarding to access services locally
4. Watch for file changes and sync them automatically
5. Restart the application when needed

### Debug Mode

```bash
# Start with debugging enabled
make dev-debug

# OR directly with skaffold
skaffold dev --port-forward -p debug
```

This enables:
- Node.js debug mode on port 9229
- Additional debug logging
- Debug port forwarding for IDE connection

### Build Only

```bash
# Build development image without deploying
make dev-build
```

### Clean Up

```bash
# Remove Skaffold deployment
make dev-delete
```

## Configuration

### Skaffold Configuration (`skaffold.yaml`)

The Skaffold configuration includes:

- **File Sync**: Automatically syncs TypeScript, JavaScript, and config files
- **Port Forwarding**: Forwards essential ports for local development
- **Profiles**: Different configurations for dev and debug modes
- **Build Optimization**: Uses development Docker target

### Key Features

#### File Synchronization

These files are automatically synced to the running container:
- `src/**/*.ts` - TypeScript source files
- `src/**/*.js` - JavaScript files  
- `package*.json` - Package configuration
- `tsconfig*.json` - TypeScript configuration
- `nest-cli.json` - NestJS CLI configuration

#### Port Forwarding

Automatically forwards these ports to localhost:
- `3000` - WAL Service API
- `5432` - PostgreSQL database
- `6379` - Redis cache
- `9229` - Node.js debugger (debug profile only)

#### Memory Configuration

Development pods are configured with:
- **Memory Request**: 512Mi
- **Memory Limit**: 1Gi (prevents OOMKilled errors)
- **CPU Request**: 100m
- **CPU Limit**: 500m

## Development Workflow

### 1. Initial Setup

```bash
# Start cluster if not running
make cluster-start

# Start development
make dev-start
```

### 2. Code Changes

1. Edit your TypeScript files in `src/`
2. Skaffold automatically detects changes
3. Files are synced to the running container
4. NestJS automatically reloads the application
5. Changes are immediately available

### 3. Testing Changes

```bash
# API is available at localhost:3000
curl http://localhost:3000/api/v1/health

# View logs in real-time
kubectl logs -f -n wal-service-dev -l app.kubernetes.io/component=api

# Or in a separate terminal
kubectl logs -n wal-service-dev -l app.kubernetes.io/component=api --follow
```

### 4. Database/Cache Access

```bash
# PostgreSQL (forwarded to localhost:5432)
psql -h localhost -p 5432 -U postgres

# Redis (forwarded to localhost:6379)  
redis-cli -h localhost -p 6379
```

## Debugging

### VS Code Debug Configuration

Add this to your `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug WAL Service",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "address": "localhost",
      "localRoot": "${workspaceFolder}",
      "remoteRoot": "/app",
      "protocol": "inspector",
      "restart": true
    }
  ]
}
```

### Debug Workflow

1. Start in debug mode: `make dev-debug`
2. Wait for port forwarding to be established
3. Attach your debugger to `localhost:9229`
4. Set breakpoints in your TypeScript code
5. Debug as normal

## Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Check what's using the ports
lsof -i :3000
lsof -i :5432
lsof -i :6379

# Stop conflicting processes or use different ports
```

#### File Sync Not Working
```bash
# Check if container is running
kubectl get pods -n wal-service-dev

# Check Skaffold logs
skaffold dev --verbosity=debug
```

#### Build Failures
```bash
# Check Docker build
docker build --target development -t test-image .

# Check registry connectivity
curl http://localhost:6000/v2/_catalog
```

#### Memory Issues
```bash
# Check pod status
kubectl describe pod -n wal-service-dev -l app.kubernetes.io/component=api

# View pod logs
kubectl logs -n wal-service-dev -l app.kubernetes.io/component=api
```

### Recovery Procedures

#### Reset Development Environment
```bash
# Delete current deployment
make dev-delete

# Clean up any stuck resources
kubectl delete namespace wal-service-dev --force --grace-period=0

# Restart cluster if needed
make cluster-reset

# Start fresh
make dev-start
```

#### Registry Issues
```bash
# Restart registry
docker restart kind-registry

# Verify registry
docker ps --filter "name=kind-registry"
curl http://localhost:6000/v2/_catalog
```

## Performance Tips

### Faster Builds
- Keep `.dockerignore` updated to exclude unnecessary files
- Use layer caching effectively
- Consider using `skaffold run` for one-time deployments

### Faster Sync
- Only edit files that are included in sync patterns
- Avoid large file changes that might trigger full rebuilds
- Use `--assume-yes` flag to skip confirmations

### Resource Optimization
- Adjust memory limits based on your application needs
- Use resource requests to ensure predictable performance
- Monitor resource usage with `kubectl top pods`

## Integration with IDEs

### VS Code
- Install Kubernetes extension for cluster management
- Use Docker extension for container management
- Configure debug settings as shown above

### IntelliJ/WebStorm
- Configure remote debugging to `localhost:9229`
- Use Kubernetes plugin for cluster visualization
- Set up file watchers for TypeScript compilation

## Next Steps

Once comfortable with the development workflow:
1. Explore production deployment with Skaffold
2. Set up CI/CD pipelines using Skaffold
3. Configure remote debugging for staging environments
4. Implement automated testing in the workflow

---

*This workflow provides rapid development iteration while maintaining production-like environment characteristics.*