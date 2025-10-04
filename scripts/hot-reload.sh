#!/bin/bash

# Hot Reload Script for WAL Service Development
# This script automates the Docker build + kind load + deployment update workflow

set -e  # Exit on any error

# Configuration
IMAGE_NAME="kind-registry:5000/wal-service"
TAG="dev-$(date +%s)"  # Unique tag with timestamp
NAMESPACE="wal-service-dev"
DEPLOYMENT="wal-service"
CLUSTER_NAME="wal-service-dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting hot reload process...${NC}"

# Step 1: Build Docker image
echo -e "${YELLOW}📦 Building Docker image...${NC}"
docker build --target=development -t "${IMAGE_NAME}:${TAG}" .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker build completed successfully${NC}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi

# Step 2: Load image into kind cluster
echo -e "${YELLOW}📤 Loading image into kind cluster...${NC}"
kind load docker-image "${IMAGE_NAME}:${TAG}" --name "${CLUSTER_NAME}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image loaded into kind cluster${NC}"
else
    echo -e "${RED}❌ Failed to load image into kind cluster${NC}"
    exit 1
fi

# Step 3: Update deployment
echo -e "${YELLOW}🔄 Updating deployment...${NC}"
kubectl set image deployment/"${DEPLOYMENT}" wal-service="${IMAGE_NAME}:${TAG}" -n "${NAMESPACE}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Deployment updated${NC}"
else
    echo -e "${RED}❌ Failed to update deployment${NC}"
    exit 1
fi

# Step 4: Wait for rollout
echo -e "${YELLOW}⏳ Waiting for rollout to complete...${NC}"
kubectl rollout status deployment/"${DEPLOYMENT}" -n "${NAMESPACE}" --timeout=120s

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Rollout completed successfully${NC}"
else
    echo -e "${RED}❌ Rollout timed out or failed${NC}"
    exit 1
fi

# Step 5: Show pod status
echo -e "${YELLOW}📊 Current pod status:${NC}"
kubectl get pods -n "${NAMESPACE}" -l app=wal-service

# Step 6: Show service URL (if available)
echo -e "${BLUE}🌐 Service should be available at:${NC}"
echo "http://localhost:3000 (if port-forwarded)"

echo -e "${GREEN}🎉 Hot reload completed! Your changes are now live.${NC}"

# Optional: Show recent logs
read -p "Would you like to see recent logs? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}📝 Recent logs:${NC}"
    kubectl logs -n "${NAMESPACE}" -l app=wal-service --tail=20
fi