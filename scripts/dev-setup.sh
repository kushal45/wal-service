#!/bin/bash

# WAL Service Development Environment Management Script
# Usage: ./dev-setup.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.dev.yml"
PROJECT_NAME="wal-service-dev"
BUILD_CACHE_DIR=".dev-cache"
CACHE_FILE="$BUILD_CACHE_DIR/build-cache.json"

print_usage() {
    echo -e "${BLUE}WAL Service Development Environment Management${NC}"
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start         Start all development services"
    echo "  stop          Stop all development services"
    echo "  restart       Restart all development services"
    echo "  rebuild       Rebuild and restart WAL service"
    echo "  logs          Show logs for all services"
    echo "  logs-app      Show logs for WAL service only"
    echo "  logs-db       Show logs for database services"
    echo "  status        Show status of all services"
    echo "  clean         Stop and remove all containers, networks, and volumes"
    echo "  debug         Start services and attach debugger info"
    echo "  shell         Get shell access to WAL service container"
    echo "  db-shell      Get shell access to PostgreSQL"
    echo "  redis-cli     Access Redis CLI"
    echo "  kafka-topics  List Kafka topics"
    echo "  health        Check health of all services"
    echo "  setup         Initial setup (create directories, pull images)"
    echo "  clean-cache   Clear build cache (force rebuild on next start)"
    echo ""
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Build cache functions
setup_build_cache() {
    mkdir -p "$BUILD_CACHE_DIR"
    if [ ! -f "$CACHE_FILE" ]; then
        echo '{}' > "$CACHE_FILE"
    fi
}

# Calculate file hash for tracking changes
calculate_file_hash() {
    local file="$1"
    if [ -f "$file" ]; then
        if command -v shasum >/dev/null 2>&1; then
            shasum -a 256 "$file" | cut -d' ' -f1
        elif command -v sha256sum >/dev/null 2>&1; then
            sha256sum "$file" | cut -d' ' -f1
        else
            # Fallback to basic checksum
            cksum "$file" | cut -d' ' -f1
        fi
    else
        echo "missing"
    fi
}

# Check if rebuild is needed
need_rebuild() {
    setup_build_cache
    
    # Files that trigger rebuild when changed
    local trigger_files=(
        "package.json"
        "package-lock.json"
        "Dockerfile"
        "tsconfig.json"
        "nest-cli.json"
    )
    
    # Check if cache file is readable
    if [ ! -r "$CACHE_FILE" ]; then
        log_warn "Cache file not readable, rebuilding..."
        return 0  # Need rebuild
    fi
    
    # Check if docker image exists
    if ! docker images "*wal-service-dev*" --format "table {{.ID}}" | grep -q .; then
        log_info "Docker image not found, rebuild required"
        return 0  # Need rebuild
    fi
    
    # Calculate current hashes
    local current_hashes="{"
    local first=true
    
    for file in "${trigger_files[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            current_hashes="${current_hashes},"
        fi
        local hash=$(calculate_file_hash "$file")
        current_hashes="${current_hashes}\"${file}\":\"${hash}\""
    done
    current_hashes="${current_hashes}}"
    
    # Read cached hashes
    local cached_hashes
    if command -v jq >/dev/null 2>&1; then
        cached_hashes=$(cat "$CACHE_FILE" 2>/dev/null || echo '{}')
    else
        # Fallback without jq
        cached_hashes=$(cat "$CACHE_FILE" 2>/dev/null || echo '{}')
    fi
    
    # Compare hashes
    if [ "$current_hashes" != "$cached_hashes" ]; then
        log_info "Changes detected in build dependencies, rebuild required"
        log_info "Changed files:"
        
        # Show which files changed (simple approach without jq dependency)
        for file in "${trigger_files[@]}"; do
            local current_hash=$(calculate_file_hash "$file")
            if ! echo "$cached_hashes" | grep -q "\"${file}\":\"${current_hash}\""; then
                echo "  - $file (hash: ${current_hash})"
            fi
        done
        
        # Update cache
        echo "$current_hashes" > "$CACHE_FILE"
        return 0  # Need rebuild
    fi
    
    log_info "No changes detected in build dependencies, skipping rebuild"
    return 1  # No rebuild needed
}

# Smart rebuild function
smart_rebuild() {
    local force_rebuild="${1:-false}"
    
    if [ "$force_rebuild" = "true" ] || need_rebuild; then
        log_info "Rebuilding WAL service container..."
        docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build --no-cache wal-service-dev
        
        # Update cache after successful build
        setup_build_cache
        local trigger_files=("package.json" "package-lock.json" "Dockerfile" "tsconfig.json" "nest-cli.json")
        local current_hashes="{"
        local first=true
        
        for file in "${trigger_files[@]}"; do
            if [ "$first" = true ]; then
                first=false
            else
                current_hashes="${current_hashes},"
            fi
            local hash=$(calculate_file_hash "$file")
            current_hashes="${current_hashes}\"${file}\":\"${hash}\""
        done
        current_hashes="${current_hashes}}"
        echo "$current_hashes" > "$CACHE_FILE"
        
        log_info "WAL service rebuilt successfully"
        return 0
    else
        log_info "Using existing WAL service image (no rebuild needed)"
        return 1  # No rebuild was done
    fi
}

# Ensure required directories exist
setup_directories() {
    log_info "Creating required directories..."
    mkdir -p logs
    chmod 755 logs
    log_info "Directories created successfully"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
}

# Check if docker-compose file exists
check_compose_file() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Docker compose file '$COMPOSE_FILE' not found!"
        exit 1
    fi
}

# Start development services
start_services() {
    log_info "Starting WAL Service development environment..."
    setup_directories
    
    # Smart rebuild - only rebuild if needed
    smart_rebuild || true  # Don't exit if no rebuild needed
    
    # Start all services
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
    
    log_info "Waiting for services to be ready..."
    sleep 5
    
    log_info "Services starting up. Use '$0 logs' to monitor startup."
    log_info "Debug port available at: localhost:9229"
    log_info "Application will be available at: http://localhost:3000"
    log_info "Health check: http://localhost:3000/api/v1/health"
}

# Stop development services
stop_services() {
    log_info "Stopping WAL Service development environment..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
    log_info "Services stopped successfully"
}

# Restart development services
restart_services() {
    log_info "Restarting WAL Service development environment..."
    stop_services
    start_services
}

# Rebuild WAL service
rebuild_service() {
    log_info "Force rebuilding WAL service..."
    
    # Force rebuild regardless of cache
    smart_rebuild "true"
    
    # Restart the specific service
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d wal-service-dev
    log_info "WAL service rebuilt and restarted"
}

# Show logs
show_logs() {
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" logs -f "$@"
}

# Show service status
show_status() {
    log_info "Development environment status:"
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
}

# Clean everything
clean_environment() {
    log_warn "This will remove all containers, networks, and volumes!"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "Cleaning development environment..."
        docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v --remove-orphans
        docker system prune -f
        
        # Also clean build cache
        if [ -d "$BUILD_CACHE_DIR" ]; then
            rm -rf "$BUILD_CACHE_DIR"
            log_info "Build cache cleaned"
        fi
        
        log_info "Environment cleaned successfully"
    else
        log_info "Clean operation cancelled"
    fi
}

# Clean just the build cache
clean_cache() {
    if [ -d "$BUILD_CACHE_DIR" ]; then
        log_info "Cleaning build cache..."
        rm -rf "$BUILD_CACHE_DIR"
        log_info "Build cache cleaned successfully"
    else
        log_info "Build cache is already clean"
    fi
}

# Debug information
debug_info() {
    log_info "Debug configuration:"
    echo "  Debug Port: 9229"
    echo "  Debug URL: chrome://inspect or vscode://vscode-remote"
    echo "  Container: wal-service-dev"
    echo ""
    log_info "VS Code Debug Configuration:"
    cat << EOF
{
  "type": "node",
  "request": "attach",
  "name": "Docker Debug",
  "address": "localhost",
  "port": 9229,
  "localRoot": "\${workspaceFolder}/src",
  "remoteRoot": "/app/src",
  "restart": true
}
EOF
    echo ""
    start_services
}

# Get shell access
get_shell() {
    log_info "Opening shell in WAL service container..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec wal-service-dev sh
}

# Database shell
get_db_shell() {
    log_info "Opening PostgreSQL shell..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec postgres-dev psql -U wal_user -d wal_service_db
}

# Redis CLI
redis_cli() {
    log_info "Opening Redis CLI..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec redis-dev redis-cli
}

# Kafka topics
kafka_topics() {
    log_info "Listing Kafka topics..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec kafka-dev kafka-topics --bootstrap-server localhost:9092 --list
}

# Health check
health_check() {
    log_info "Checking service health..."
    
    services=("postgres-dev" "redis-dev" "zookeeper-dev" "kafka-dev" "wal-service-dev")
    
    for service in "${services[@]}"; do
        echo -n "  $service: "
        if docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps "$service" | grep -q "Up (healthy)"; then
            echo -e "${GREEN}Healthy${NC}"
        elif docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps "$service" | grep -q "Up"; then
            echo -e "${YELLOW}Running (health check pending)${NC}"
        else
            echo -e "${RED}Down${NC}"
        fi
    done
}

# Initial setup
initial_setup() {
    log_info "Setting up development environment..."
    setup_directories
    
    log_info "Pulling required Docker images..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" pull
    
    log_info "Building WAL service image..."
    docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" build
    
    log_info "Setup completed successfully!"
    log_info "Run '$0 start' to start the development environment"
}

# Main command processing
main() {
    check_docker
    check_compose_file
    
    case "${1:-}" in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        rebuild)
            rebuild_service
            ;;
        logs)
            show_logs "${@:2}"
            ;;
        logs-app)
            show_logs wal-service-dev
            ;;
        logs-db)
            show_logs postgres-dev redis-dev
            ;;
        status)
            show_status
            ;;
        clean)
            clean_environment
            ;;
        clean-cache)
            clean_cache
            ;;
        debug)
            debug_info
            ;;
        shell)
            get_shell
            ;;
        db-shell)
            get_db_shell
            ;;
        redis-cli)
            redis_cli
            ;;
        kafka-topics)
            kafka_topics
            ;;
        health)
            health_check
            ;;
        setup)
            initial_setup
            ;;
        help|--help|-h)
            print_usage
            ;;
        "")
            log_error "No command specified"
            print_usage
            exit 1
            ;;
        *)
            log_error "Unknown command: $1"
            print_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"