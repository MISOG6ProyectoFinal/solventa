#!/usr/bin/env bash
# Corre las pruebas de la librería común y de cada servicio, cada uno con su pythonpath.
set -euo pipefail
cd "$(dirname "$0")/.."
status=0
for dir in libs/solventa_common services/*/; do
  echo "== ${dir}"
  (cd "$dir" && python -m pytest -q) || status=1
done
exit $status
