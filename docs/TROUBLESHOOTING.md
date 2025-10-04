# WAL Service - Troubleshooting Guide

This document provides solutions to common issues encountered during WAL Service development and deployment, including comprehensive learnings from end-to-end Kubernetes deployment and ingress configuration.

## Table of Contents

- [Environment Setup Issues](#environment-setup-issues)
- [Docker Registry Configuration](#docker-registry-configuration)
- [Image Building and Loading](#image-building-and-loading)
- [Application Startup Issues](#application-startup-issues)
- [Ingress Configuration Problems](#ingress-configuration-problems)
- [Network Policy and RBAC Issues](#network-policy-and-rbac-issues)
- [Service Dependencies](#service-dependencies)
- [Kubernetes Cluster Setup Issues](#kubernetes-cluster-setup-issues)
- [Port Conflicts](#port-conflicts)
- [Docker Issues](#docker-issues)
- [Prerequisites](#prerequisites)
- [Common Debugging Commands](#common-debugging-commands)
- [Common Error Messages](#common-error-messages)

## Environment Setup Issues

### Missing kustomize

**Problem**: Deployment failed with `kustomize: command not found`

**Solution**: 
```bash
brew install kustomize
```

**Lesson**: Always verify all required tools are installed before attempting deployment.

### Kind Registry Port Conflicts

**Problem**: Scripts assumed registry on port 5000, but kind cluster was configured for port 6000 locally.

**Root Cause**: 
- Local registry accessible at `localhost:6000`
- Inside cluster, registry accessible at `kind-registry:5000`
- Scripts and kustomization files had mismatched registry references

**Solution**:
1. Updated deployment scripts to handle correct registry URLs
2. Modified kustomization.yaml to use `kind-registry:5000` for in-cluster image pulls
3. Updated build scripts to push to `localhost:6000` for local development

**Files Changed**:
- `scripts/deploy.sh`
- `k8s/overlays/dev/kustomization.yaml`

## Docker Registry Configuration

### Registry Not Accessible from Cluster

**Problem**: Images couldn't be pulled because cluster didn't trust the insecure HTTP registry.

**Solution**: Configure all cluster nodes to treat the kind registry as insecure:

```bash
# For each node in the cluster
docker exec -it <node-name> /bin/bash
mkdir -p /etc/containerd/certs.d/kind-registry:5000
cat > /etc/containerd/certs.d/kind-registry:5000/hosts.toml << EOF
server = "http://kind-registry:5000"

[host."http://kind-registry:5000"]
  capabilities = ["pull", "resolve"]
  skip_verify = true
EOF
systemctl restart containerd
```

**Lesson**: Local development registries require explicit configuration for insecure HTTP access.

## Image Building and Loading

### Development vs Production Images

**Problem**: Development images with `nest start --watch` caused extremely slow startup times and startup probe failures.

**Root Cause**: TypeScript compilation in watch mode during container startup took too long, exceeding probe timeouts.

**Solution**:
1. Built production images for faster startup
2. Extended startup probe timeouts temporarily
3. Used production builds even in dev environment for faster iteration

**Commands Used**:
```bash
# Build production image
docker build --target production -t localhost:6000/wal-service:prod-v1 .

# Load into cluster
kind load docker-image localhost:6000/wal-service:prod-v1 --name wal-service-cluster

# Update deployment to use production image
kubectl patch deployment wal-service -n wal-service-dev -p '{"spec":{"template":{"spec":{"containers":[{"name":"wal-service","image":"localhost:6000/wal-service:prod-v1"}]}}}}'
```

**Lesson**: Use production-optimized images even in development environments for faster startup and better debugging experience.

## Application Startup Issues

### Startup Probe Failures

**Problem**: Application failed startup probes with connection refused errors.

**Root Causes**:
1. Slow TypeScript compilation in development mode
2. Application not binding to `0.0.0.0` (container networking issue)
3. Health endpoint not ready during startup

**Solutions**:
1. Extended startup probe timings:
   ```yaml
   startupProbe:
     initialDelaySeconds: 60
     periodSeconds: 10
     timeoutSeconds: 5
     failureThreshold: 12
   ```
2. Verified application binds to `0.0.0.0:8080`
3. Used production builds for consistent startup behavior

### Missing Migration Scripts

**Problem**: Database migration job failed because migration commands weren't available in the application.

**Root Cause**: Application didn't have migration scripts defined in package.json.

**Temporary Solution**: Disabled migration job until proper migration setup is implemented.

**Future Action**: Implement proper database migration scripts and job configuration.

## Ingress Configuration Problems

This was the most complex set of issues encountered during the deployment.

### Issue 1: Inherited Problematic Annotations

**Problem**: Dev overlay inherited rewrite annotations from base ingress that caused path routing issues.

**Root Cause**: 
- Base ingress had `nginx.ingress.kubernetes.io/rewrite-target: /$2` annotation
- Kustomize strategic merge patches couldn't completely remove inherited annotations
- Paths were being rewritten incorrectly, causing 404 errors

**Failed Attempts**:
1. Trying to override annotations with empty values in overlay patches
2. Using `$patchDelete` directives in Kustomize
3. Adding conflicting rewrite rules

**Final Solution**: Created a clean ingress manifest directly in the dev namespace without inheriting from base.

### Issue 2: Namespace Conflicts

**Problem**: Multiple ingresses with same hostname in different namespaces caused routing conflicts.

**Root Cause**:
- Ingress in `default` namespace: `wal-service-ingress` routing to `wal-service.default.svc.cluster.local`
- Ingress in `wal-service-dev` namespace: routing to `wal-service.wal-service-dev.svc.cluster.local`
- Same hostname `dev.wal-service.local` used by both

**Symptoms**:
- 503 Service Temporarily Unavailable errors
- Traffic routed to wrong namespace
- Inconsistent behavior

**Solution**:
```bash
# Delete conflicting ingress
kubectl delete ingress wal-service-ingress -n default

# Verify only one ingress exists for the hostname
kubectl get ingress --all-namespaces | grep wal-service
```

### Issue 3: Path Rewriting Problems

**Problem**: Complex path rewriting rules caused requests to be routed incorrectly.

**Root Cause**: 
- Regex patterns like `nginx.ingress.kubernetes.io/rewrite-target: /$2`
- Capture groups in path patterns that didn't match actual request paths
- Multiple conflicting rewrite annotations

**Solution**: Simplified ingress to use direct path matching without rewriting:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wal-service-ingress
  namespace: wal-service-dev
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
spec:
  rules:
  - host: dev.wal-service.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: wal-service
            port:
              number: 8080
```

### Issue 4: Service Discovery Problems

**Problem**: Ingress controller couldn't reach backend service.

**Debugging Steps**:
1. Verified service exists and has correct selector:
   ```bash
   kubectl get svc wal-service -n wal-service-dev -o yaml
   kubectl get endpoints wal-service -n wal-service-dev
   ```

2. Tested direct service access:
   ```bash
   kubectl port-forward svc/wal-service 8080:8080 -n wal-service-dev
   curl http://localhost:8080/api/v1/health
   ```

3. Checked ingress controller logs:
   ```bash
   kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx
   ```

**Resolution**: Service was working correctly; issue was in ingress path configuration.

## Network Policy and RBAC Issues

### Network Policy Blocking Ingress

**Problem**: Initially suspected network policies were blocking ingress traffic.

**Investigation**:
```bash
kubectl get networkpolicies -n wal-service-dev
kubectl describe networkpolicy allow-ingress -n wal-service-dev
```

**Finding**: Network policies were correctly configured to allow ingress traffic. Issue was elsewhere.

### Namespace Labels

**Problem**: Ensured proper namespace labeling for network policy selectors.

**Solution**:
```bash
kubectl label namespace wal-service-dev name=wal-service-dev
kubectl label namespace ingress-nginx name=ingress-nginx
```

## Service Dependencies

### Kafka and LocalStack Crashes

**Problem**: Kafka and LocalStack services were crashing, potentially affecting application startup.

**Temporary Solution**: Disabled problematic services in dev environment:
```yaml
# In dev configmap patch
KAFKA_ENABLED: "false"
AWS_ENABLED: "false"
```

**Result**: Application started successfully without these dependencies.

**Future Action**: Properly configure Kafka and LocalStack for development environment.

## Kubernetes Cluster Setup Issues

### Port Conflicts

**Problem**: The most common issue when starting the local Kubernetes cluster is port conflicts.

#### Error Message:
```
ERROR: failed to create cluster: command "docker run --name wal-service-dev-control-plane ..." failed with error: exit status 125
Command Output: docker: Error response from daemon: ports are not available: exposing port TCP 0.0.0.0:5000 -> 127.0.0.1:0: bind: address already in use
```

#### Root Cause:
- **Port 5000**: Often used by macOS Control Center (AirPlay Receiver)
- **Port 5001-5003**: Commonly used by Docker Desktop and other services
- The setup script tries to map these ports for the ingress controller and local Docker registry

#### Solution:

1. **Identify conflicting processes:**
   ```bash
   lsof -i :5000
   lsof -i :5001
   lsof -i :5002
   ```

2. **Find available ports:**
   ```bash
   for port in {6000..6010}; do 
     if ! lsof -i :$port > /dev/null 2>&1; then 
       echo "Port $port is available"; 
       break; 
     fi; 
   done
   ```

3. **Update the setup script** (`scripts/setup-local-k8s.sh`):
   - Change the ingress port mapping (around line 135)
   - Update the Docker registry port mapping (around line 181)
   - Update the registry host reference (around line 198)

4. **Clean up and restart:**
   ```bash
   # Remove any existing registry container
   docker rm -f kind-registry
   
   # Reset the cluster
   ./scripts/setup-local-k8s.sh kind reset
   
   # Start fresh
   make cluster-start
   ```

#### Prevention:
- Use ports in the 6000+ range to avoid common system conflicts
- Always check for available ports before configuring

### PATH Issues

**Problem**: Commands like `kubectl`, `docker`, or `kind` are not found.

#### Error Message:
```
[ERROR] Missing required tools: kubectl docker kind
```

#### Root Cause:
- Homebrew tools are not in the system PATH
- Docker Desktop CLI tools are not properly linked

#### Solution:

1. **Add required paths to your session:**
   ```bash
   export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
   ```

2. **Make it permanent** by adding to your shell profile:
   ```bash
   # For zsh (default on macOS)
   echo 'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   
   # For bash
   echo 'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"' >> ~/.bash_profile
   source ~/.bash_profile
   ```

3. **Verify tools are available:**
   ```bash
   which kubectl docker kind
   ```

## Docker Issues

### Docker Daemon Not Running

**Problem**: Docker commands fail because Docker Desktop is not running.

#### Error Message:
```
Cannot connect to the Docker daemon at unix:///var/run/docker.sock
```

#### Solution:
1. **Start Docker Desktop:**
   ```bash
   open -a Docker
   ```

2. **Wait for Docker to start** (usually takes 30-60 seconds)

3. **Verify Docker is running:**
   ```bash
   docker ps
   ```

### Container Name Conflicts

**Problem**: Registry container name is already in use.

#### Error Message:
```
docker: Error response from daemon: Conflict. The container name "/kind-registry" is already in use
```

#### Solution:
```bash
# Remove the existing container
docker rm -f kind-registry

# Or list and remove manually
docker ps -a --filter "name=kind-registry"
docker rm -f <container-id>
```

## Prerequisites

### Required Tools

| Tool | Installation | Purpose |
|------|-------------|---------|
| **Docker Desktop** | [Download](https://docs.docker.com/desktop/) | Container runtime |
| **kubectl** | `brew install kubectl` | Kubernetes CLI |
| **kind** | `brew install kind` | Local Kubernetes clusters |
| **Homebrew** | [Install](https://brew.sh/) | Package manager for macOS |

### Verification Commands

```bash
# Check all tools are available
which docker kubectl kind

# Verify Docker is running
docker ps

# Check kind version
kind version

# Check kubectl version
kubectl version --client
```

## Common Debugging Commands

### Pod Debugging
```bash
# Check pod status and events
kubectl get pods -n wal-service-dev
kubectl describe pod <pod-name> -n wal-service-dev

# View pod logs
kubectl logs <pod-name> -n wal-service-dev -f

# Execute commands in pod
kubectl exec -it <pod-name> -n wal-service-dev -- /bin/bash

# Port forward for direct testing
kubectl port-forward pod/<pod-name> 8080:8080 -n wal-service-dev
```

### Service Debugging
```bash
# Check service configuration
kubectl get svc -n wal-service-dev
kubectl describe svc wal-service -n wal-service-dev

# Check service endpoints
kubectl get endpoints -n wal-service-dev

# Test service connectivity
kubectl port-forward svc/wal-service 8080:8080 -n wal-service-dev
```

### Ingress Debugging
```bash
# Check ingress configuration
kubectl get ingress --all-namespaces
kubectl describe ingress wal-service-ingress -n wal-service-dev

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx -f

# Test ingress from inside cluster
kubectl run test-pod --image=curlimages/curl -it --rm --restart=Never -- curl -v http://dev.wal-service.local/api/v1/health
```

### Registry Debugging
```bash
# Check if image exists in registry
curl -X GET http://localhost:6000/v2/_catalog
curl -X GET http://localhost:6000/v2/wal-service/tags/list

# Verify image can be pulled
docker pull localhost:6000/wal-service:latest
```

### Networking Debugging
```bash
# Check DNS resolution
kubectl run test-dns --image=busybox -it --rm --restart=Never -- nslookup wal-service.wal-service-dev.svc.cluster.local

# Test connectivity between pods
kubectl run test-conn --image=curlimages/curl -it --rm --restart=Never -- curl -v http://wal-service.wal-service-dev.svc.cluster.local:8080/api/v1/health
```

## Key Lessons Learned

1. **Simplify First**: Start with minimal configurations and add complexity gradually
2. **Namespace Isolation**: Be very careful about namespace conflicts, especially with ingress
3. **Registry Configuration**: Local development requires proper insecure registry setup
4. **Production Images**: Use production-optimized images even in dev for better debugging
5. **Path Rewriting**: Avoid complex path rewriting rules unless absolutely necessary
6. **Incremental Debugging**: Test each layer (pod → service → ingress) independently
7. **Log Everything**: Comprehensive logging at each step is crucial for debugging
8. **Environment Parity**: Keep development environment as close to production as possible

## Quick Resolution Checklist

When encountering ingress issues:

1. ✅ Verify pod is running and healthy
2. ✅ Test service connectivity via port-forward
3. ✅ Check for namespace conflicts with same hostname
4. ✅ Verify ingress annotations are correct and minimal
5. ✅ Check ingress controller logs for errors
6. ✅ Test DNS resolution and service discovery
7. ✅ Verify network policies allow required traffic
8. ✅ Check for path rewriting issues
9. ✅ Confirm backend service is responding correctly

This systematic approach helped resolve all ingress connectivity issues efficiently.

## Common Error Messages

### "command not found"
- **Cause**: Tool not installed or not in PATH
- **Solution**: Install missing tools and update PATH

### "port is already allocated"
- **Cause**: Port conflict with existing service
- **Solution**: Use different ports or stop conflicting service

### "cluster already exists"
- **Cause**: Previous cluster setup wasn't cleaned up
- **Solution**: Use `./scripts/setup-local-k8s.sh kind reset`

### "failed to create cluster"
- **Cause**: Usually port conflicts or Docker issues
- **Solution**: Check Docker status and resolve port conflicts

## Recovery Procedures

### Complete Cluster Reset
```bash
# Export required PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

# Stop and remove everything
./scripts/setup-local-k8s.sh kind reset

# Remove registry container
docker rm -f kind-registry

# Start fresh
make cluster-start
```

### Registry-Only Reset
```bash
# Remove just the registry
docker rm -f kind-registry

# Restart registry setup manually
docker run -d --restart=always -p "127.0.0.1:6000:5000" --name "kind-registry" registry:2
docker network connect "kind" "kind-registry"

# Update ConfigMap
kubectl apply -f - << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: local-registry-hosting
  namespace: kube-public
data:
  localRegistryHosting.v1: |
    host: "localhost:6000"
    help: "https://kind.sigs.k8s.io/docs/user/local-registry/"
EOF
```

## Getting Help

If you encounter issues not covered in this guide:

1. **Check cluster status:**
   ```bash
   kubectl cluster-info
   kubectl get nodes
   ```

2. **Review setup logs** in the terminal output

3. **Check Docker logs:**
   ```bash
   docker logs kind-registry
   ```

4. **Consult official documentation:**
   - [kind Documentation](https://kind.sigs.k8s.io/docs/user/quick-start/)
   - [Docker Desktop Documentation](https://docs.docker.com/desktop/)
   - [kubectl Documentation](https://kubernetes.io/docs/reference/kubectl/)

---

*Last updated: October 4, 2025*
*This guide was created following the resolution of port conflict issues during cluster setup.*