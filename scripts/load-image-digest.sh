#!/bin/bash
set -euo pipefail

# This script is called as a post-build hook by Skaffold to load the image
# with the exact digest that Skaffold will use in the deployment

IMAGE_NAME="kind-registry:5000/wal-service"
CLUSTER_NAME="wal-service-dev"

echo "[load-image-digest] Loading image and digest variants for: $IMAGE_NAME"

# Load the main image
kind load docker-image "${IMAGE_NAME}:latest" --name "$CLUSTER_NAME"

# Get the actual image digest/ID that Skaffold will use
IMAGE_ID=$(docker images --no-trunc --format "table {{.ID}}" "${IMAGE_NAME}:latest" | tail -n +2 | head -1 | cut -c8-)

if [[ -n "$IMAGE_ID" ]]; then
    echo "[load-image-digest] Found full image ID: $IMAGE_ID"
    
    # Create a tag with the full image ID as the tag (this is what Skaffold uses as digest)
    DIGEST_TAG="${IMAGE_NAME}:${IMAGE_ID}"
    echo "[load-image-digest] Creating digest tag: $DIGEST_TAG"
    
    docker tag "${IMAGE_NAME}:latest" "$DIGEST_TAG" || true
    kind load docker-image "$DIGEST_TAG" --name "$CLUSTER_NAME" || true
else
    echo "[load-image-digest] Warning: Could not find image ID"
fi

echo "[load-image-digest] Done loading image variants"