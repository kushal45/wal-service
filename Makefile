# WAL Service Makefile
# Provides convenient shortcuts for common development and deployment tasks

.PHONY: help dev-start dev-stop dev-deploy dev-status dev-logs prod-deploy db-migrate db-reset test build clean

# Default target
help: ## Show this help message
	@echo "WAL Service - Available Commands:"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make \033[36m<target>\033[0m\n\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Local Cluster Management
cluster-start: ## Start local Kubernetes cluster (kind)
	@echo "🚀 Starting local Kubernetes cluster..."
	./scripts/setup-local-k8s.sh kind start

cluster-stop: ## Stop local Kubernetes cluster
	@echo "🛑 Stopping local Kubernetes cluster..."
	./scripts/setup-local-k8s.sh kind stop

cluster-reset: ## Reset local Kubernetes cluster
	@echo "🔄 Resetting local Kubernetes cluster..."
	./scripts/setup-local-k8s.sh kind reset

cluster-status: ## Show cluster status
	@echo "📊 Checking cluster status..."
	./scripts/setup-local-k8s.sh kind status

##@ Local Development (Recommended for debugging)
local-dev: ## Start local development with Docker Compose (hot reload + debugging)
	@echo "🚀 Starting local development environment..."
	./scripts/dev-local.sh start

local-stop: ## Stop local development environment
	@echo "🛑 Stopping local development environment..."
	./scripts/dev-local.sh stop

local-clean: ## Clean local development environment (removes data)
	@echo "🧹 Cleaning local development environment..."
	./scripts/dev-local.sh clean

local-logs: ## Show local development logs
	@echo "📝 Showing local development logs..."
	./scripts/dev-local.sh logs

local-shell: ## Open shell in local WAL service container
	@echo "🐚 Opening shell in local container..."
	./scripts/dev-local.sh shell

local-migrate: ## Run migrations in local environment
	@echo "📦 Running local migrations..."
	./scripts/dev-local.sh migrate

##@ Skaffold Development
dev-start: ## Start development with Skaffold (hot reload)
	@echo "🔥 Starting development with hot reload..."
	@export PATH="/opt/homebrew/bin:/usr/local/bin:$$PATH" && skaffold dev --port-forward --auto-build --auto-deploy --trigger=polling


dev-run: ## Run development build once
	@echo "🏃 Running development build..."
	@export PATH="/opt/homebrew/bin:/usr/local/bin:$$PATH" && skaffold run

dev-debug: ## Start development with debug mode
	@echo "🐛 Starting development with debug mode..."
	@export PATH="/opt/homebrew/bin:/usr/local/bin:$$PATH" && skaffold dev --port-forward -p debug

dev-build: ## Build development image
	@echo "🔨 Building development image..."
	@export PATH="/opt/homebrew/bin:/usr/local/bin:$$PATH" && skaffold build

dev-delete: ## Delete Skaffold deployment
	@echo "🗑️ Deleting Skaffold deployment..."
	@export PATH="/opt/homebrew/bin:/usr/local/bin:$$PATH" && skaffold delete

skaffold-clean-config: ## Remove any default-repo config & env overrides for Skaffold
	@echo "🧼 Cleaning Skaffold default-repo configuration..."
	@chmod +x ./scripts/skaffold-clear-default-repo.sh || true
	./scripts/skaffold-clear-default-repo.sh

dev-skaffold: ## Build+load (custom) and run skaffold dev (custom builder)
	@echo "🧪 Starting Skaffold dev with custom builder..."
	@chmod +x ./scripts/skaffold-build.sh || true
	@export PATH="/opt/homebrew/bin:/usr/local/bin:$$PATH" && skaffold dev --port-forward

dev-loop: ## Fast loop: rebuild & redeploy once (custom builder)
	@echo "🔁 Running one Skaffold build+deploy cycle..."
	@chmod +x ./scripts/skaffold-build.sh || true
	@export PATH="/opt/homebrew/bin:/usr/local/bin:$$PATH" && skaffold run

##@ Legacy Development Environment
dev-deploy: ## Deploy to development environment
	@echo "🚀 Deploying to development environment..."
	./scripts/deploy.sh dev deploy

dev-deploy-fast: ## Deploy to dev (skip tests and build)
	@echo "⚡ Fast deploy to development environment..."
	./scripts/deploy.sh dev deploy --skip-tests --skip-build

dev-status: ## Check development deployment status
	@echo "📊 Checking development deployment status..."
	./scripts/deploy.sh dev status

dev-logs: ## Show development environment logs
	@echo "📝 Showing development environment logs..."
	./scripts/deploy.sh dev logs

dev-restart: ## Restart development deployment
	@echo "🔄 Restarting development deployment..."
	./scripts/deploy.sh dev restart

dev-undeploy: ## Remove development deployment
	@echo "🗑️ Removing development deployment..."
	./scripts/deploy.sh dev undeploy

dev-rollback: ## Rollback development deployment
	@echo "⏪ Rolling back development deployment..."
	./scripts/deploy.sh dev rollback

##@ Production Environment
prod-deploy: ## Deploy to production environment
	@echo "🚀 Deploying to production environment..."
	./scripts/deploy.sh production deploy

prod-status: ## Check production deployment status
	@echo "📊 Checking production deployment status..."
	./scripts/deploy.sh production status

prod-logs: ## Show production environment logs
	@echo "📝 Showing production environment logs..."
	./scripts/deploy.sh production logs

prod-restart: ## Restart production deployment
	@echo "🔄 Restarting production deployment..."
	./scripts/deploy.sh production restart

prod-rollback: ## Rollback production deployment
	@echo "⏪ Rolling back production deployment..."
	./scripts/deploy.sh production rollback

##@ Database Operations
db-migrate: ## Run database migrations (development)
	@echo "📦 Running database migrations..."
	@echo "� Restarting WAL service deployment to trigger migration initContainer..."
	export PATH="/opt/homebrew/bin:/usr/local/bin:$$PATH" && kubectl rollout restart deployment wal-service -n wal-service-dev
	@echo "⏳ Waiting for deployment to be ready..."
	export PATH="/opt/homebrew/bin:/usr/local/bin:$$PATH" && kubectl rollout status deployment wal-service -n wal-service-dev --timeout=300s
	@echo "✅ Database migrations completed and application is ready!"

db-migrate-prod: ## Run database migrations (production)
	@echo "📦 Running database migrations (production)..."
	./scripts/db-migrate.sh production migrate

db-rollback: ## Rollback database migration (development)
	@echo "⏪ Rolling back database migration..."
	./scripts/db-migrate.sh dev rollback

db-seed: ## Seed database with sample data (development)
	@echo "🌱 Seeding database..."
	@echo "ℹ️  Seeding is now included in db-migrate command"

db-reset: ## Reset database (development only)
	@echo "🗑️ Resetting database..."
	@echo "⚠️  To reset database, delete the postgres PVC and restart deployment"
	@echo "   kubectl delete pvc postgres-pvc -n wal-service-dev"

db-status: ## Check database migration status
	@echo "📊 Checking database migration status..."
	./scripts/db-migrate.sh dev status

##@ Application Development
install: ## Install dependencies
	@echo "📦 Installing dependencies..."
	npm ci

test: ## Run tests
	@echo "🧪 Running tests..."
	npm test

test-watch: ## Run tests in watch mode
	@echo "🔍 Running tests in watch mode..."
	npm run test:watch

test-e2e: ## Run end-to-end tests
	@echo "🎯 Running e2e tests..."
	npm run test:e2e

build: ## Build the application
	@echo "🏗️ Building application..."
	npm run build

build-docker: ## Build Docker image
	@echo "🐳 Building Docker image..."
	docker build -t wal-service:latest .

lint: ## Run linting
	@echo "🔍 Running linter..."
	npm run lint

lint-fix: ## Fix linting issues
	@echo "🔧 Fixing linting issues..."
	npm run lint:fix

format: ## Format code
	@echo "💅 Formatting code..."
	npm run format

##@ Monitoring & Debugging
port-forward: ## Port forward to development service
	@echo "🔌 Port forwarding to service (localhost:3000)..."
	kubectl port-forward -n wal-service-dev svc/wal-service 3000:80

port-forward-db: ## Port forward to PostgreSQL
	@echo "🔌 Port forwarding to database (localhost:5432)..."
	kubectl port-forward -n wal-service-dev svc/postgres-service 5432:5432

port-forward-redis: ## Port forward to Redis
	@echo "🔌 Port forwarding to Redis (localhost:6379)..."
	kubectl port-forward -n wal-service-dev svc/redis-service 6379:6379

shell: ## Get shell access to development pod
	@echo "🐚 Opening shell in development pod..."
	kubectl exec -it -n wal-service-dev deployment/wal-service -- /bin/sh

describe: ## Describe development deployment
	@echo "📝 Describing development deployment..."
	kubectl describe deployment wal-service -n wal-service-dev

events: ## Show recent Kubernetes events
	@echo "📅 Showing recent events..."
	kubectl get events -n wal-service-dev --sort-by='.lastTimestamp'

##@ Utilities
clean: ## Clean up local development environment
	@echo "🧹 Cleaning up..."
	docker system prune -f
	npm run clean || true

dry-run: ## Show what would be deployed (dry run)
	@echo "👀 Dry run - showing what would be deployed..."
	./scripts/deploy.sh dev deploy --dry-run

validate: ## Validate Kubernetes configurations
	@echo "✅ Validating Kubernetes configurations..."
	kubectl --dry-run=client apply -k k8s/overlays/dev

##@ Documentation
docs: ## Open documentation
	@echo "📖 Opening documentation..."
	@if command -v open >/dev/null 2>&1; then \
		open k8s/README.md; \
	else \
		echo "Please open k8s/README.md in your preferred editor"; \
	fi

##@ Quick Workflows
dev-full: cluster-start dev-deploy db-migrate ## Full development setup (cluster + deploy + migrate)
	@echo "✅ Full development environment is ready!"
	@echo "🌐 Access your service at: http://dev.wal-service.local/api/v1/health"

dev-quick: dev-deploy-fast ## Quick development deployment
	@echo "⚡ Quick development deployment completed!"

local-dev: ## Start local development (no Kubernetes)
	@echo "🏠 Starting local development server..."
	npm run start:dev

##@ CI/CD Simulation
ci-test: install lint test ## Run CI pipeline tests locally
	@echo "✅ CI pipeline tests completed successfully!"

cd-staging: ## Simulate CD pipeline for staging
	@echo "🚀 Simulating CD pipeline for staging..."
	./scripts/deploy.sh dev deploy --dry-run

cd-production: ## Simulate CD pipeline for production
	@echo "🚀 Simulating CD pipeline for production..."
	./scripts/deploy.sh production deploy --dry-run