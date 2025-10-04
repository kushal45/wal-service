# WAL Service - Local Development Setup

This guide walks you through setting up a complete local development environment for the WAL Service.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Verification](#verification)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **macOS** (primary support) or Linux
- **8GB+ RAM** recommended
- **10GB+ free disk space**
- **Docker Desktop** with Kubernetes support
- **Internet connection** for downloading images

### Required Tools

Install these tools before proceeding:

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install kubectl kind

# Install Docker Desktop
# Download from: https://docs.docker.com/desktop/
```

### Environment Setup

Add the following to your shell profile (`~/.zshrc` for zsh or `~/.bash_profile` for bash):

```bash
# Add Homebrew and Docker to PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
```

Apply the changes:
```bash
source ~/.zshrc  # or source ~/.bash_profile
```

## Quick Start

For experienced developers who want to get up and running quickly:

```bash
# Clone and navigate to the project
cd /path/to/wal-service

# Ensure Docker Desktop is running
open -a Docker

# Start the local Kubernetes cluster
make cluster-start

# Verify the setup
kubectl get nodes
```

If you encounter any issues, refer to the [Troubleshooting](#troubleshooting) section or the detailed setup below.

## Detailed Setup

### Step 1: Verify Prerequisites

```bash
# Check that all tools are available
which docker kubectl kind

# Verify Docker is running
docker ps

# Check tool versions
docker --version
kubectl version --client
kind version
```

Expected output:
- All `which` commands should return paths
- `docker ps` should show an empty container list (not an error)
- Version commands should display version information

### Step 2: Understanding the Setup Script

The local Kubernetes setup is managed by `scripts/setup-local-k8s.sh`. This script:

1. **Creates a kind cluster** with 3 nodes (1 control-plane, 2 workers)
2. **Installs NGINX Ingress Controller** for routing traffic
3. **Sets up a local Docker registry** for container images
4. **Configures networking** between components

### Step 3: Port Configuration

The setup uses these ports:

| Port | Service | Purpose |
|------|---------|---------|
| 80 | Ingress | HTTP traffic to services |
| 443 | Ingress | HTTPS traffic to services |
| 6000 | Registry | Local Docker registry |

> **Note**: Port 6000 is used instead of the common 5000 to avoid conflicts with macOS services.

### Step 4: Start the Cluster

```bash
# Navigate to project directory
cd /path/to/wal-service

# Start the cluster
make cluster-start
```

This command will:
1. Check prerequisites
2. Create the kind cluster configuration
3. Start the cluster with 3 nodes
4. Install the ingress controller
5. Set up the local registry
6. Configure networking

### Step 5: Alternative Commands

You can also use the setup script directly:

```bash
# Start cluster
./scripts/setup-local-k8s.sh kind start

# Stop cluster (keeps configuration)
./scripts/setup-local-k8s.sh kind stop

# Reset cluster (complete cleanup and restart)
./scripts/setup-local-k8s.sh kind reset

# Check status
./scripts/setup-local-k8s.sh kind status
```

## Verification

### Cluster Health

```bash
# Check cluster info
kubectl cluster-info

# Verify all nodes are ready
kubectl get nodes

# Check system pods
kubectl get pods -A
```

Expected output:
- Cluster info should show control plane and CoreDNS URLs
- All 3 nodes should be in "Ready" status
- System pods should be "Running" or "Completed"

### Registry Health

```bash
# Check registry container
docker ps --filter "name=kind-registry"

# Test registry connectivity
curl -X GET http://localhost:6000/v2/_catalog
```

Expected output:
- Registry container should be running
- Catalog request should return JSON response (may be empty initially)

### Ingress Controller

```bash
# Check ingress controller pods
kubectl get pods -n ingress-nginx

# Check ingress class
kubectl get ingressclass
```

Expected output:
- Ingress controller pod should be "Running"
- Should see "nginx" ingress class

## Development Workflow

### Hot Reload for Fast Development

For the fastest development experience, use the automated hot reload script:

```bash
# Quick command using npm script
npm run hot-reload
# or the shorter alias
npm run hr

# Or run the script directly
./scripts/hot-reload.sh
```

This script automates the complete workflow:
1. 🏗️ **Build** - Creates a fresh Docker image with your latest code changes
2. 📤 **Load** - Loads the image into the kind cluster 
3. 🔄 **Deploy** - Updates the Kubernetes deployment with the new image
4. ⏳ **Wait** - Waits for the rollout to complete
5. 📊 **Status** - Shows current pod status and optional logs

**Typical hot reload time: ~30-45 seconds** from code change to running container.

### Manual Development Workflow

If you prefer manual control or need to troubleshoot:

```bash
# 1. Build Docker image with unique tag
docker build --target=development -t kind-registry:5000/wal-service:dev-$(date +%s) .

# 2. Load image into kind cluster
kind load docker-image kind-registry:5000/wal-service:dev-$(date +%s) --name wal-service-dev

# 3. Update deployment
kubectl set image deployment/wal-service wal-service=kind-registry:5000/wal-service:dev-$(date +%s) -n wal-service-dev

# 4. Monitor rollout
kubectl rollout status deployment/wal-service -n wal-service-dev
```

### Building and Pushing Images

```bash
# Build your application image
docker build -t localhost:6000/wal-service:latest .

# Push to local registry
docker push localhost:6000/wal-service:latest

# Verify image is in registry
curl -X GET http://localhost:6000/v2/wal-service/tags/list
```

### Deploying to Cluster

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods
kubectl get services
kubectl get ingress
```

### Accessing Services

Services can be accessed through:

1. **Port forwarding** (for development):
   ```bash
   kubectl port-forward service/wal-service 8080:80
   ```

2. **Ingress** (for testing):
   ```bash
   # Add to /etc/hosts if using custom domains
   echo "127.0.0.1 wal-service.local" | sudo tee -a /etc/hosts
   
   # Access via browser or curl
   curl http://wal-service.local
   ```

### Cleanup

```bash
# Remove deployments
kubectl delete -f k8s/

# Stop cluster (preserves configuration)
./scripts/setup-local-k8s.sh kind stop

# Complete cleanup
./scripts/setup-local-k8s.sh kind reset
```

## Development Tips

### Faster Development Loop

1. **Use the hot reload script** for automatic rebuilds:
   ```bash
   npm run hot-reload  # or npm run hr
   ```
2. **Use kubectl logs** to stream application logs:
   ```bash
   kubectl logs -f deployment/wal-service -n wal-service-dev
   ```
3. **Test changes quickly** by making small code modifications and running hot reload

### Code Change Testing

To verify your hot reload is working:

1. Make a change to any source file (e.g., `src/app.controller.ts`)
2. Run `npm run hot-reload`
3. Check the updated code in the container:
   ```bash
   kubectl exec -it $(kubectl get pod -l app=wal-service -n wal-service-dev -o jsonpath='{.items[0].metadata.name}') -n wal-service-dev -- cat /app/src/app.controller.ts
   ```

### Debugging

```bash
# Exec into a pod
kubectl exec -it <pod-name> -- /bin/bash

# Check pod events
kubectl describe pod <pod-name>

# View cluster events
kubectl get events --sort-by=.metadata.creationTimestamp
```

### Resource Management

```bash
# Monitor resource usage
kubectl top nodes
kubectl top pods

# Scale deployments
kubectl scale deployment wal-service --replicas=3
```

## Configuration Files

### Key Files

- `scripts/setup-local-k8s.sh` - Cluster setup script
- `kind-config.yaml` - Kind cluster configuration  
- `k8s/` - Kubernetes manifests directory
- `Makefile` - Development commands

### Customization

To modify the cluster configuration:

1. Edit `scripts/setup-local-k8s.sh` for ports or registry settings
2. Modify the kind configuration section for cluster topology
3. Update `Makefile` targets for custom workflows

## Troubleshooting

For common issues and solutions, see: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

Quick diagnostic commands:

```bash
# Check Docker
docker ps
docker system info

# Check kind
kind get clusters
kubectl config current-context

# Check networking
kubectl get svc -A
kubectl get endpoints -A
```

## Next Steps

Once your local environment is set up:

1. **Deploy the WAL Service**: Follow the deployment guides in the `k8s/` directory
2. **Run tests**: Use `make test` or similar commands
3. **Set up monitoring**: Configure observability tools
4. **Read the architecture docs**: Review `HLD.md` and `LLD.md`

---

*Last updated: October 4, 2025*
*This guide reflects the current cluster setup with port 6000 for the registry.*