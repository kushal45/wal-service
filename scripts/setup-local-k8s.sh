#!/bin/bash

# Local Kubernetes Setup Script for WAL Service
# This script sets up a local Kubernetes cluster using kind or minikube
# Usage: ./setup-local-k8s.sh [kind|minikube] [start|stop|reset]

set -euo pipefail

# Default values
CLUSTER_TYPE=${1:-kind}
ACTION=${2:-start}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
CLUSTER_NAME="wal-service-dev"
KIND_CONFIG_FILE="/tmp/kind-config.yaml"

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    cat << EOF
Local Kubernetes Setup Script for WAL Service

Usage: $0 [CLUSTER_TYPE] [ACTION]

CLUSTER_TYPES:
    kind        Use kind (Kubernetes in Docker) - default
    minikube    Use minikube

ACTIONS:
    start       Start the cluster (default)
    stop        Stop the cluster
    reset       Delete and recreate the cluster
    status      Show cluster status

Examples:
    $0 kind start
    $0 minikube start
    $0 kind reset

EOF
}

# Check prerequisites
check_prerequisites() {
    local missing_tools=()
    
    # Common tools
    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    # Cluster-specific tools
    if [ "$CLUSTER_TYPE" = "kind" ]; then
        if ! command -v kind &> /dev/null; then
            missing_tools+=("kind")
        fi
    elif [ "$CLUSTER_TYPE" = "minikube" ]; then
        if ! command -v minikube &> /dev/null; then
            missing_tools+=("minikube")
        fi
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_info "Install missing tools:"
        for tool in "${missing_tools[@]}"; do
            case $tool in
                kind)
                    echo "  kind: go install sigs.k8s.io/kind@latest"
                    echo "  or: brew install kind"
                    ;;
                minikube)
                    echo "  minikube: brew install minikube"
                    echo "  or: https://minikube.sigs.k8s.io/docs/start/"
                    ;;
                kubectl)
                    echo "  kubectl: brew install kubectl"
                    ;;
                docker)
                    echo "  docker: https://docs.docker.com/desktop/"
                    ;;
            esac
        done
        exit 1
    fi
}

# Create kind configuration
create_kind_config() {
    log_info "Creating kind configuration..."
    cat << EOF > "$KIND_CONFIG_FILE"
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: $CLUSTER_NAME
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP
  - containerPort: 5000
    hostPort: 6000
    protocol: TCP
- role: worker
- role: worker
networking:
  disableDefaultCNI: false
  podSubnet: 10.244.0.0/16
EOF
}

# Start kind cluster
start_kind_cluster() {
    log_info "Starting kind cluster..."
    
    # Check if cluster already exists
    if kind get clusters 2>/dev/null | grep -q "^$CLUSTER_NAME$"; then
        log_warning "Cluster $CLUSTER_NAME already exists"
        return 0
    fi
    
    create_kind_config
    kind create cluster --config="$KIND_CONFIG_FILE"
    
    # Install nginx ingress controller
    log_info "Installing NGINX Ingress Controller..."
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
    
    # Wait for ingress controller to be ready
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=90s
    
    # Setup local registry integration
    setup_kind_registry
    
    log_success "Kind cluster started successfully"
}

# Setup kind registry integration
setup_kind_registry() {
    log_info "Setting up registry integration..."
    
    # Start local registry if not running
    if ! docker ps --filter "name=kind-registry" --format "{{.Names}}" | grep -q "^kind-registry$"; then
        docker run -d --restart=always -p "127.0.0.1:6000:5000" --name "kind-registry" registry:2
    fi
    
    # Connect registry to cluster network
    if [ "$(docker inspect -f='{{json .NetworkSettings.Networks.kind}}' "kind-registry")" = 'null' ]; then
        docker network connect "kind" "kind-registry"
    fi
    
    # Document registry
    cat <<EOF | kubectl apply -f -
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
}

# Stop kind cluster
stop_kind_cluster() {
    log_info "Stopping kind cluster..."
    kind delete cluster --name="$CLUSTER_NAME"
    
    # Stop local registry
    if docker ps --filter "name=kind-registry" --format "{{.Names}}" | grep -q "^kind-registry$"; then
        docker stop kind-registry
        docker rm kind-registry
    fi
    
    log_success "Kind cluster stopped"
}

# Start minikube cluster
start_minikube_cluster() {
    log_info "Starting minikube cluster..."
    
    # Start minikube with specific configuration
    minikube start \
        --profile="$CLUSTER_NAME" \
        --cpus=4 \
        --memory=8192 \
        --disk-size=20g \
        --kubernetes-version=stable \
        --driver=docker \
        --addons=ingress,registry,metrics-server
    
    # Set context
    kubectl config use-context "$CLUSTER_NAME"
    
    log_success "Minikube cluster started successfully"
}

# Stop minikube cluster
stop_minikube_cluster() {
    log_info "Stopping minikube cluster..."
    minikube stop --profile="$CLUSTER_NAME"
    minikube delete --profile="$CLUSTER_NAME"
    log_success "Minikube cluster stopped"
}

# Show cluster status
show_status() {
    log_info "Checking cluster status..."
    
    if [ "$CLUSTER_TYPE" = "kind" ]; then
        if kind get clusters 2>/dev/null | grep -q "^$CLUSTER_NAME$"; then
            log_success "Kind cluster '$CLUSTER_NAME' is running"
            kubectl cluster-info --context "kind-$CLUSTER_NAME"
        else
            log_warning "Kind cluster '$CLUSTER_NAME' is not running"
        fi
    elif [ "$CLUSTER_TYPE" = "minikube" ]; then
        if minikube status --profile="$CLUSTER_NAME" &>/dev/null; then
            log_success "Minikube cluster '$CLUSTER_NAME' is running"
            minikube status --profile="$CLUSTER_NAME"
        else
            log_warning "Minikube cluster '$CLUSTER_NAME' is not running"
        fi
    fi
    
    echo -e "\n=== Kubernetes Nodes ==="
    kubectl get nodes -o wide 2>/dev/null || echo "No cluster available"
    
    echo -e "\n=== Kubernetes Namespaces ==="
    kubectl get namespaces 2>/dev/null || echo "No cluster available"
}

# Main execution
main() {
    case "$ACTION" in
        start)
            check_prerequisites
            if [ "$CLUSTER_TYPE" = "kind" ]; then
                start_kind_cluster
            elif [ "$CLUSTER_TYPE" = "minikube" ]; then
                start_minikube_cluster
            fi
            ;;
        stop)
            if [ "$CLUSTER_TYPE" = "kind" ]; then
                stop_kind_cluster
            elif [ "$CLUSTER_TYPE" = "minikube" ]; then
                stop_minikube_cluster
            fi
            ;;
        reset)
            log_warning "Resetting cluster..."
            if [ "$CLUSTER_TYPE" = "kind" ]; then
                stop_kind_cluster
                start_kind_cluster
            elif [ "$CLUSTER_TYPE" = "minikube" ]; then
                stop_minikube_cluster
                start_minikube_cluster
            fi
            ;;
        status)
            show_status
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            log_error "Invalid action: $ACTION"
            show_help
            exit 1
            ;;
    esac
}

# Validate inputs
if [[ "$CLUSTER_TYPE" != "kind" && "$CLUSTER_TYPE" != "minikube" ]]; then
    log_error "Invalid cluster type: $CLUSTER_TYPE. Use 'kind' or 'minikube'"
    exit 1
fi

main "$@"