#!/bin/bash

# WAL Service Deployment Script
# This script automates the entire deployment process for the WAL service
# Usage: ./deploy.sh [dev|production] [options]

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default values
ENVIRONMENT=${1:-dev}
ACTION=${2:-deploy}
SKIP_BUILD=${3:-false}
SKIP_TESTS=${4:-false}
DRY_RUN=${5:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="localhost:5000"
APP_NAME="wal-service"
NAMESPACE_DEV="wal-service-dev"
NAMESPACE_PROD="wal-service"

# Detect if we're using kind with existing registry
if docker ps --format "{{.Names}}" | grep -q "kind-registry"; then
    # Use kind's registry port mapping
    KIND_REGISTRY_PORT=$(docker port kind-registry 5000/tcp | cut -d: -f2)
    if [ -n "$KIND_REGISTRY_PORT" ]; then
        REGISTRY="localhost:$KIND_REGISTRY_PORT"
    fi
fi

# Logging functions
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

# Help function
show_help() {
    cat << EOF
WAL Service Deployment Script

Usage: $0 [ENVIRONMENT] [ACTION] [OPTIONS]

ENVIRONMENTS:
    dev         Deploy to development environment (default)
    production  Deploy to production environment

ACTIONS:
    deploy      Build and deploy the application (default)
    undeploy    Remove the application from cluster
    restart     Restart the application
    status      Show deployment status
    logs        Show application logs
    rollback    Rollback to previous version

OPTIONS:
    --skip-build    Skip Docker build step
    --skip-tests    Skip running tests
    --dry-run       Show what would be deployed without applying
    --help          Show this help message

Examples:
    $0 dev deploy
    $0 production deploy --skip-tests
    $0 dev status
    $0 dev logs
    $0 production rollback

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if ! command -v kubectl &> /dev/null; then
        missing_tools+=("kubectl")
    fi
    
    if ! command -v kustomize &> /dev/null; then
        missing_tools+=("kustomize")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install the missing tools and try again."
        exit 1
    fi
    
    # Check if Kubernetes cluster is accessible
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Setup local registry for development
setup_local_registry() {
    if [ "$ENVIRONMENT" != "dev" ]; then
        return
    fi
    
    log_info "Setting up local registry for development..."
    
    # Check if kind-registry is already running (from kind setup)
    if docker ps --format "{{.Names}}" | grep -q "kind-registry"; then
        log_info "Using existing kind registry..."
        log_success "Local registry is running"
        return
    fi
    
    # Check if registry is running
    if ! docker ps --filter "name=registry" --format "{{.Names}}" | grep -q "^registry$"; then
        log_info "Starting local Docker registry..."
        docker run -d --name registry --restart=always -p 5000:5000 registry:2
        sleep 2
    fi
    
    log_success "Local registry is running"
}

# Run tests
run_tests() {
    if [ "$SKIP_TESTS" = "true" ]; then
        log_warning "Skipping tests"
        return
    fi
    
    log_info "Running tests..."
    cd "$PROJECT_ROOT"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm ci
    fi
    
    # Run unit tests
    npm test
    
    # Run integration tests if available
    if npm run | grep -q "test:integration"; then
        npm run test:integration
    fi
    
    log_success "Tests passed"
}

# Build Docker image
build_image() {
    if [ "$SKIP_BUILD" = "true" ]; then
        log_warning "Skipping Docker build"
        return
    fi
    
    log_info "Building Docker image..."
    cd "$PROJECT_ROOT"
    
    local tag
    if [ "$ENVIRONMENT" = "dev" ]; then
        tag="${REGISTRY}/${APP_NAME}:dev-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')"
    else
        tag="${REGISTRY}/${APP_NAME}:v$(jq -r .version package.json 2>/dev/null || echo '1.0.0')"
    fi
    
    # Build for development or production
    if [ "$ENVIRONMENT" = "dev" ]; then
        docker build --target development -t "$tag" .
    else
        docker build --target production -t "$tag" .
    fi
    
    # Push to registry
    docker push "$tag"
    
    # Update kustomization with new image tag
    local overlay_dir="k8s/overlays/$ENVIRONMENT"
    local kustomization_file="$overlay_dir/kustomization.yaml"
    
    if [ -f "$kustomization_file" ]; then
        # Extract just the tag part after the last colon
        local image_tag=$(echo "$tag" | rev | cut -d':' -f1 | rev)
        
        log_info "Updating image tag to: $image_tag"
        
        # Use yq if available, otherwise sed with proper escaping
        if command -v yq &> /dev/null; then
            yq eval ".images[0].newTag = \"$image_tag\"" -i "$kustomization_file"
        else
            # Use a more robust sed approach
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS sed
                sed -i '' "s/newTag: .*/newTag: $image_tag/" "$kustomization_file"
            else
                # GNU sed
                sed -i "s/newTag: .*/newTag: $image_tag/" "$kustomization_file"
            fi
        fi
    fi
    
    export DOCKER_IMAGE_TAG="$tag"
    log_success "Image built and pushed: $tag"
}

# Deploy to Kubernetes
deploy_k8s() {
    log_info "Deploying to Kubernetes ($ENVIRONMENT environment)..."
    
    local namespace
    local overlay_dir="k8s/overlays/$ENVIRONMENT"
    
    if [ "$ENVIRONMENT" = "dev" ]; then
        namespace="$NAMESPACE_DEV"
    else
        namespace="$NAMESPACE_PROD"
    fi
    
    # Create namespace if it doesn't exist
    if ! kubectl get namespace "$namespace" &> /dev/null; then
        log_info "Creating namespace: $namespace"
        kubectl create namespace "$namespace"
    fi
    
    cd "$PROJECT_ROOT"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "Dry run - showing what would be applied:"
        kustomize build "$overlay_dir"
        return
    fi
    
    # Apply configurations
    log_info "Applying Kubernetes configurations..."
    kustomize build "$overlay_dir" | kubectl apply -f -
    
    # Wait for deployment to complete
    log_info "Waiting for deployment to complete..."
    kubectl rollout status deployment/${APP_NAME} -n "$namespace" --timeout=300s
    
    log_success "Deployment completed successfully"
}

# Check deployment status
check_status() {
    local namespace
    if [ "$ENVIRONMENT" = "dev" ]; then
        namespace="$NAMESPACE_DEV"
    else
        namespace="$NAMESPACE_PROD"
    fi
    
    log_info "Checking deployment status for $ENVIRONMENT environment..."
    
    echo "=== Deployment Status ==="
    kubectl get deployment "${APP_NAME}" -n "$namespace" -o wide 2>/dev/null || echo "Deployment not found"
    
    echo -e "\n=== Pod Status ==="
    kubectl get pods -l app.kubernetes.io/name="${APP_NAME}" -n "$namespace" -o wide 2>/dev/null || echo "No pods found"
    
    echo -e "\n=== Service Status ==="
    kubectl get service "${APP_NAME}" -n "$namespace" -o wide 2>/dev/null || echo "Service not found"
    
    echo -e "\n=== Ingress Status ==="
    kubectl get ingress "${APP_NAME}-ingress" -n "$namespace" -o wide 2>/dev/null || echo "Ingress not found"
    
    # Show recent events
    echo -e "\n=== Recent Events ==="
    kubectl get events -n "$namespace" --sort-by='.lastTimestamp' | tail -10
}

# Show application logs
show_logs() {
    local namespace
    if [ "$ENVIRONMENT" = "dev" ]; then
        namespace="$NAMESPACE_DEV"
    else
        namespace="$NAMESPACE_PROD"
    fi
    
    log_info "Showing logs for $ENVIRONMENT environment..."
    kubectl logs -l app.kubernetes.io/name="${APP_NAME}" -n "$namespace" --tail=100 -f
}

# Rollback deployment
rollback_deployment() {
    local namespace
    if [ "$ENVIRONMENT" = "dev" ]; then
        namespace="$NAMESPACE_DEV"
    else
        namespace="$NAMESPACE_PROD"
    fi
    
    log_info "Rolling back deployment in $ENVIRONMENT environment..."
    kubectl rollout undo deployment/"${APP_NAME}" -n "$namespace"
    kubectl rollout status deployment/"${APP_NAME}" -n "$namespace" --timeout=300s
    log_success "Rollback completed"
}

# Undeploy application
undeploy() {
    local namespace
    local overlay_dir="k8s/overlays/$ENVIRONMENT"
    
    if [ "$ENVIRONMENT" = "dev" ]; then
        namespace="$NAMESPACE_DEV"
    else
        namespace="$NAMESPACE_PROD"
    fi
    
    log_warning "Undeploying from $ENVIRONMENT environment..."
    
    cd "$PROJECT_ROOT"
    
    if [ "$DRY_RUN" = "true" ]; then
        log_info "Dry run - showing what would be removed:"
        kustomize build "$overlay_dir"
        return
    fi
    
    # Delete resources
    kustomize build "$overlay_dir" | kubectl delete -f - --ignore-not-found=true
    
    log_success "Application undeployed"
}

# Restart deployment
restart_deployment() {
    local namespace
    if [ "$ENVIRONMENT" = "dev" ]; then
        namespace="$NAMESPACE_DEV"
    else
        namespace="$NAMESPACE_PROD"
    fi
    
    log_info "Restarting deployment in $ENVIRONMENT environment..."
    kubectl rollout restart deployment/"${APP_NAME}" -n "$namespace"
    kubectl rollout status deployment/"${APP_NAME}" -n "$namespace" --timeout=300s
    log_success "Restart completed"
}

# Health check
health_check() {
    local namespace
    if [ "$ENVIRONMENT" = "dev" ]; then
        namespace="$NAMESPACE_DEV"
    else
        namespace="$NAMESPACE_PROD"
    fi
    
    log_info "Performing health check..."
    
    # Get service endpoint
    local service_ip
    service_ip=$(kubectl get service "${APP_NAME}" -n "$namespace" -o jsonpath='{.spec.clusterIP}' 2>/dev/null || echo "")
    
    if [ -n "$service_ip" ]; then
        # Try to reach health endpoint
        if kubectl run health-check --rm -i --restart=Never --image=curlimages/curl -- curl -f "http://${service_ip}/api/v1/health" &> /dev/null; then
            log_success "Health check passed"
        else
            log_error "Health check failed"
            return 1
        fi
    else
        log_error "Cannot find service IP"
        return 1
    fi
}

# Main execution
main() {
    # Parse remaining arguments
    parse_args "$@"
    
    # Validate environment
    if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "production" ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Use 'dev' or 'production'"
        exit 1
    fi
    
    log_info "Starting $ACTION for $ENVIRONMENT environment"
    
    case "$ACTION" in
        deploy)
            check_prerequisites
            setup_local_registry
            run_tests
            build_image
            deploy_k8s
            sleep 5
            health_check
            log_success "Deployment pipeline completed successfully!"
            ;;
        undeploy)
            check_prerequisites
            undeploy
            ;;
        status)
            check_prerequisites
            check_status
            ;;
        logs)
            check_prerequisites
            show_logs
            ;;
        rollback)
            check_prerequisites
            rollback_deployment
            ;;
        restart)
            check_prerequisites
            restart_deployment
            ;;
        *)
            log_error "Invalid action: $ACTION"
            show_help
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"