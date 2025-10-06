#!/bin/bash
set -euo pipefail

echo "🚀 Setting up WAL Service for local development..."

# Function to wait for service
wait_for_service() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service to be ready..."
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose.dev.yml ps $service | grep -q "healthy\|Up"; then
            echo "✅ $service is ready!"
            return 0
        fi
        echo "   Attempt $attempt/$max_attempts - waiting 2s..."
        sleep 2
        ((attempt++))
    done
    echo "❌ $service failed to become ready"
    return 1
}

# Function to run migrations
run_migrations() {
    echo "📦 Running database migrations..."
    docker-compose -f docker-compose.dev.yml exec -T wal-service-dev npm run migration:run || {
        echo "⚠️  Migration failed, but continuing (might be first run)"
    }
    
    echo "🌱 Running database seeding..."
    docker-compose -f docker-compose.dev.yml exec -T wal-service-dev npm run db:seed || {
        echo "⚠️  Seeding failed, but continuing"
    }
}

# Main setup flow
main() {
    echo "🧹 Cleaning up any existing containers..."
    docker-compose -f docker-compose.dev.yml down -v 2>/dev/null || true
    
    echo "🏗️  Building development images..."
    docker-compose -f docker-compose.dev.yml build
    
    echo "🚀 Starting infrastructure services..."
    docker-compose -f docker-compose.dev.yml up -d postgres-dev redis-dev zookeeper-dev kafka-dev
    
    # Wait for infrastructure
    wait_for_service postgres-dev
    wait_for_service redis-dev
    wait_for_service kafka-dev
    
    echo "🎯 Starting WAL service..."
    docker-compose -f docker-compose.dev.yml up -d wal-service-dev
    
    # Wait for WAL service
    sleep 10
    wait_for_service wal-service-dev
    
    # Run migrations and seeding
    run_migrations
    
    echo ""
    echo "🎉 Development environment ready!"
    echo ""
    echo "📍 Service endpoints:"
    echo "   WAL Service:  http://localhost:3000"
    echo "   Health Check: http://localhost:3000/api/v1/health"
    echo "   Debug Port:   localhost:9229"
    echo "   PostgreSQL:   localhost:5432"
    echo "   Redis:        localhost:6379"
    echo "   Kafka:        localhost:9092"
    echo ""
    echo "🔧 Development commands:"
    echo "   View logs:    docker-compose -f docker-compose.dev.yml logs -f wal-service-dev"
    echo "   Restart app:  docker-compose -f docker-compose.dev.yml restart wal-service-dev"
    echo "   Stop all:     docker-compose -f docker-compose.dev.yml down"
    echo "   Clean reset:  docker-compose -f docker-compose.dev.yml down -v"
    echo ""
    echo "🐛 Debugging:"
    echo "   Attach debugger to localhost:9229"
    echo "   Edit files in ./src for hot reload"
    echo "   App will auto-restart on file changes"
}

# Handle script arguments
case "${1:-start}" in
    "start")
        main
        ;;
    "stop")
        echo "🛑 Stopping development environment..."
        docker-compose -f docker-compose.dev.yml down
        ;;
    "clean")
        echo "🧹 Cleaning development environment (removes data)..."
        docker-compose -f docker-compose.dev.yml down -v
        docker system prune -f
        ;;
    "logs")
        docker-compose -f docker-compose.dev.yml logs -f "${2:-wal-service-dev}"
        ;;
    "shell")
        docker-compose -f docker-compose.dev.yml exec wal-service-dev /bin/sh
        ;;
    "migrate")
        run_migrations
        ;;
    *)
        echo "Usage: $0 {start|stop|clean|logs|shell|migrate}"
        echo ""
        echo "Commands:"
        echo "  start   - Start development environment"
        echo "  stop    - Stop all services"
        echo "  clean   - Stop and remove all data"
        echo "  logs    - Show logs (optional service name)"
        echo "  shell   - Open shell in WAL service container"
        echo "  migrate - Run migrations and seeding"
        exit 1
        ;;
esac