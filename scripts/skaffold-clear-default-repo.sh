#!/usr/bin/env bash
set -euo pipefail
CTX=$(kubectl config current-context 2>/dev/null || echo "")
echo "[cleanup] Current context: $CTX"

echo "[cleanup] Unsetting per-context and global default-repo (ignore errors)"
skaffold config unset default-repo --kube-context "$CTX" || true
skaffold config unset default-repo --global || true

if [ -n "${SKAFFOLD_DEFAULT_REPO:-}" ]; then
  echo "[cleanup] Unsetting SKAFFOLD_DEFAULT_REPO env var (session only)"
  unset SKAFFOLD_DEFAULT_REPO || true
fi

echo "[cleanup] Remaining config (context):"
skaffold config list --kube-context "$CTX" || true

echo "[cleanup] Remaining config (global):"
skaffold config list --global || true

echo "[cleanup] Done. Re-run: make dev-skaffold"
