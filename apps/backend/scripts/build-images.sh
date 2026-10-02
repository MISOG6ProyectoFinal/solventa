#!/usr/bin/env bash
# Construye (y opcionalmente publica) la imagen de cada servicio.
#   ./scripts/build-images.sh                       -> imágenes locales solventa/<servicio>:<tag>
#   REGISTRY=<cuenta>.dkr.ecr.us-east-1.amazonaws.com PUSH=1 ./scripts/build-images.sh
set -euo pipefail
cd "$(dirname "$0")/.."
REGISTRY="${REGISTRY:-solventa}"
TAG="${TAG:-$(git rev-parse --short HEAD)}"
PLATFORM="${PLATFORM:-linux/amd64}"
for dir in services/*/; do
  pkg="$(basename "$dir")"
  image="${REGISTRY}/${pkg//_/-}:${TAG}"
  echo "== ${image}"
  if [[ "${PUSH:-0}" == "1" ]]; then
    docker buildx build --platform "$PLATFORM" --build-arg SERVICE="$pkg" -t "$image" --push .
  else
    docker build --build-arg SERVICE="$pkg" -t "$image" .
  fi
done
