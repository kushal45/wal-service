#!/bin/bash

# WAL Service Database Migration Script
# Usage: ./db-migrate.sh [dev|production] [migrate|rollback|seed|reset]

set -euo pipefail

# Default values
ENVIRONMENT=${1:-dev}
ACTION=${2:-migrate}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
NAMESPACE_DEV="wal-service-dev"
NAMESPACE_PROD="wal-service"

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
WAL Service Database Migration Script

Usage: $0 [ENVIRONMENT] [ACTION]

ENVIRONMENTS:
    dev         Target development environment (default)
    production  Target production environment

ACTIONS:
    migrate     Run database migrations (default)
    rollback    Rollback last migration
    seed        Seed database with sample data
    reset       Reset database (drop and recreate)
    status      Show migration status
    create      Create new migration file

Examples:
    $0 dev migrate
    $0 production migrate
    $0 dev seed
    $0 dev status

EOF
}

# Get namespace based on environment
get_namespace() {
    if [ "$ENVIRONMENT" = "dev" ]; then
        echo "$NAMESPACE_DEV"
    else
        echo "$NAMESPACE_PROD"
    fi
}

# Get postgres pod name
get_postgres_pod() {
    local namespace=$(get_namespace)
    kubectl get pods -n "$namespace" -l app.kubernetes.io/name=postgres -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo ""
}

# Execute SQL command
execute_sql() {
    local sql_command="$1"
    local namespace=$(get_namespace)
    local pod_name=$(get_postgres_pod)
    
    if [ -z "$pod_name" ]; then
        log_error "PostgreSQL pod not found in namespace $namespace"
        return 1
    fi
    
    kubectl exec -n "$namespace" "$pod_name" -- psql -U wal_user -d wal_service_db -c "$sql_command"
}

# Run migrations
run_migrations() {
    log_info "Running database migrations for $ENVIRONMENT environment..."
    
    local namespace=$(get_namespace)
    local pod_name
    pod_name=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=wal-service,app.kubernetes.io/component=api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$pod_name" ]; then
        log_error "WAL service pod not found in namespace $namespace"
        return 1
    fi
    
    # Run TypeORM migrations
    kubectl exec -n "$namespace" "$pod_name" -- npm run migration:run
    
    log_success "Migrations completed successfully"
}

# Rollback migration
rollback_migration() {
    log_warning "Rolling back last migration for $ENVIRONMENT environment..."
    
    local namespace=$(get_namespace)
    local pod_name
    pod_name=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=wal-service,app.kubernetes.io/component=api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$pod_name" ]; then
        log_error "WAL service pod not found in namespace $namespace"
        return 1
    fi
    
    kubectl exec -n "$namespace" "$pod_name" -- npm run migration:revert
    
    log_success "Migration rollback completed"
}

# Seed database
seed_database() {
    log_info "Seeding database for $ENVIRONMENT environment..."
    
    local namespace=$(get_namespace)
    local pod_name
    pod_name=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=wal-service,app.kubernetes.io/component=api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$pod_name" ]; then
        log_error "WAL service pod not found in namespace $namespace"
        return 1
    fi
    
    # Run database seeder
    kubectl exec -n "$namespace" "$pod_name" -- npm run seed
    
    log_success "Database seeded successfully"
}

# Reset database
reset_database() {
    if [ "$ENVIRONMENT" = "production" ]; then
        log_error "Database reset is not allowed in production environment"
        return 1
    fi
    
    log_warning "Resetting database for $ENVIRONMENT environment..."
    read -p "This will DELETE ALL DATA. Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Operation cancelled"
        return 0
    fi
    
    # Drop and recreate database
    execute_sql "DROP DATABASE IF EXISTS wal_service_db;"
    execute_sql "CREATE DATABASE wal_service_db OWNER wal_user;"
    
    # Run migrations
    run_migrations
    
    log_success "Database reset completed"
}

# Show migration status
show_migration_status() {
    log_info "Checking migration status for $ENVIRONMENT environment..."
    
    local namespace=$(get_namespace)
    local pod_name
    pod_name=$(kubectl get pods -n "$namespace" -l app.kubernetes.io/name=wal-service,app.kubernetes.io/component=api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$pod_name" ]; then
        log_error "WAL service pod not found in namespace $namespace"
        return 1
    fi
    
    kubectl exec -n "$namespace" "$pod_name" -- npm run migration:show
}

# Create new migration
create_migration() {
    local migration_name="$1"
    if [ -z "$migration_name" ]; then
        log_error "Migration name is required"
        return 1
    fi
    
    log_info "Creating new migration: $migration_name"
    npm run migration:generate -- --name "$migration_name"
    
    log_success "Migration file created"
}

# Main execution
main() {
    case "$ACTION" in
        migrate)
            run_migrations
            ;;
        rollback)
            rollback_migration
            ;;
        seed)
            seed_database
            ;;
        reset)
            reset_database
            ;;
        status)
            show_migration_status
            ;;
        create)
            create_migration "${3:-}"
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

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment: $ENVIRONMENT. Use 'dev' or 'production'"
    exit 1
fi

main "$@"