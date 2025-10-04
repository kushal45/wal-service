#!/usr/bin/env bash
set -euo pipefail
IMAGE_NAME="wal-service"
DEFAULT_TAG="latest"
CLUSTER_NAME="wal-service-dev"
# Skaffold sets $IMAGE for custom builders; it MAY already include a tag (e.g. kind-registry:5000/wal-service:latest)
# We must NOT append another :latest if a tag is already present.
RAW_IMAGE_REF=${IMAGE:-}

# Determine effective image reference used for the build
if [ -n "$RAW_IMAGE_REF" ]; then
	EFFECTIVE_REF="$RAW_IMAGE_REF"
else
	EFFECTIVE_REF="${IMAGE_NAME}:${DEFAULT_TAG}"
fi

# Split EFFECTIVE_REF into repo and optional tag
EFFECTIVE_REPO="${EFFECTIVE_REF%:*}"
EFFECTIVE_TAG_PART="${EFFECTIVE_REF##*:}"
if [[ "$EFFECTIVE_REPO" == "$EFFECTIVE_TAG_PART" ]]; then
	# No tag actually present (edge case where no colon), add default
	EFFECTIVE_REF="${EFFECTIVE_REF}:${DEFAULT_TAG}"
	EFFECTIVE_REPO="${EFFECTIVE_REF%:*}"
	EFFECTIVE_TAG_PART="$DEFAULT_TAG"
fi

# Guardrail: detect unexpected default-repo rewriting that causes imagePull errors
KUBE_CONTEXT=$(kubectl config current-context 2>/dev/null || echo "")
DEFAULT_REPO_ENV=${SKAFFOLD_DEFAULT_REPO:-}
DEFAULT_REPO_CFG=$(skaffold config list --kube-context "$KUBE_CONTEXT" 2>/dev/null | grep -i default-repo || true)

if [ -n "$DEFAULT_REPO_ENV" ] || echo "$DEFAULT_REPO_CFG" | grep -q "default-repo"; then
	echo "[skaffold-build][ERROR] A Skaffold default-repo is configured (env or config)." >&2
	echo "This forces image rewrite e.g. kind-registry:5000/... and breaks kind load unless a registry is running." >&2
	echo "Detected:" >&2
	[ -n "$DEFAULT_REPO_ENV" ] && echo "  SKAFFOLD_DEFAULT_REPO env: $DEFAULT_REPO_ENV" >&2
	[ -n "$DEFAULT_REPO_CFG" ] && echo "  Config entry: $DEFAULT_REPO_CFG" >&2
	echo "Resolve by running:" >&2
	echo "  skaffold config unset default-repo --kube-context $KUBE_CONTEXT || true" >&2
	echo "  skaffold config unset default-repo --global || true" >&2
	echo "  unset SKAFFOLD_DEFAULT_REPO" >&2
	echo "Then retry: make dev-skaffold" >&2
	exit 1
fi

# Ensure docker is available
if ! command -v docker >/dev/null 2>&1; then
	echo "[skaffold-build][ERROR] 'docker' command not found in PATH. Install Docker Desktop or ensure docker CLI is available." >&2
	exit 1
fi
if ! command -v kind >/dev/null 2>&1; then
	echo "[skaffold-build][ERROR] 'kind' command not found; required to load image into cluster." >&2
	exit 1
fi
if ! command -v kubectl >/dev/null 2>&1; then
	echo "[skaffold-build][ERROR] 'kubectl' command not found; required for context detection." >&2
	exit 1
fi

echo "[skaffold-build] Effective image reference: ${EFFECTIVE_REF}"
echo "[skaffold-build] Repo: ${EFFECTIVE_REPO}  Tag: ${EFFECTIVE_TAG_PART}"
echo "[skaffold-build] Building ${EFFECTIVE_REF} (development target)"
docker build --target=development -t "${EFFECTIVE_REF}" .

# If the effective repo includes a registry/prefix and differs from bare IMAGE_NAME, add helper tags locally
if [[ "$EFFECTIVE_REPO" != "$IMAGE_NAME" ]]; then
	docker tag "${EFFECTIVE_REF}" "${IMAGE_NAME}:${DEFAULT_TAG}" || true
	docker tag "${EFFECTIVE_REF}" "${IMAGE_NAME}:dev" || true
fi

echo "[skaffold-build] Loading image into kind cluster: ${CLUSTER_NAME} (${EFFECTIVE_REF})"
kind load docker-image "${EFFECTIVE_REF}" --name ${CLUSTER_NAME}

# Also load the image with the SHA digest that Skaffold might use in deployment
IMAGE_DIGEST=$(docker inspect "${EFFECTIVE_REF}" --format='{{index .RepoDigests 0}}' 2>/dev/null | cut -d'@' -f2 || echo "")
if [[ -z "$IMAGE_DIGEST" ]]; then
  # If no repo digest, get the image ID and use it as digest
  IMAGE_ID=$(docker images --format "table {{.ID}}" "${EFFECTIVE_REF}" | tail -n +2 | head -1)
  IMAGE_DIGEST="$IMAGE_ID"
fi

if [[ -n "$IMAGE_DIGEST" && "$EFFECTIVE_REPO" == *"kind-registry"* ]]; then
  DIGEST_TAG="${EFFECTIVE_REPO}:${IMAGE_DIGEST}"
  echo "[skaffold-build] Also loading digest reference: ${DIGEST_TAG}"
  docker tag "${EFFECTIVE_REF}" "${DIGEST_TAG}" || true
  kind load docker-image "${DIGEST_TAG}" --name ${CLUSTER_NAME} || true
fi

if [[ "$EFFECTIVE_REPO" != "$IMAGE_NAME" ]]; then
  kind load docker-image "${IMAGE_NAME}:${DEFAULT_TAG}" --name ${CLUSTER_NAME} || true
  kind load docker-image "${IMAGE_NAME}:dev" --name ${CLUSTER_NAME} || true
fi

echo "[skaffold-build] Done"