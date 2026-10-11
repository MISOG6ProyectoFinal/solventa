#!/usr/bin/env bash
# Fija en el overlay aws la imagen de cada servicio: registro de ECR y versión.
# Lo ejecuta Backend CD con el tag del release, justo antes de aplicar el overlay.
#   set-image-tag.sh <registro> <versión>
#   set-image-tag.sh 123456789012.dkr.ecr.us-east-1.amazonaws.com v1.2.0
set -euo pipefail
cd "$(dirname "$0")/../.."  # apps/backend

HOST="${1:?Falta el registro de ECR}"
TAG="${2:?Falta el tag}"
FILE=deploy/k8s/overlays/aws/kustomization.yaml
MARKER="# --- Imágenes desplegadas. Bloque generado por set-image-tag.sh: no editar a mano."

# Todo lo que sigue al marcador se regenera.
content="$(awk -v marker="$MARKER" '$0 == marker { exit } { print }' "$FILE")"
{
  printf '%s\n' "$content"
  [[ -n "$(tail -n 1 <<<"$content")" ]] && echo
  echo "$MARKER"
  echo "images:"
  for dir in services/*/; do
    name="$(basename "$dir")"
    name="${name//_/-}"
    echo "  - name: solventa/${name}"
    echo "    newName: ${HOST}/solventa/${name}"
    echo "    newTag: \"${TAG}\""
  done
} > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
