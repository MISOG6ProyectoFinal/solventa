#!/usr/bin/env bash
# Corre las pruebas de la librería común y de cada servicio, cada uno con su pythonpath.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
status=0
run_coverage="${RUN_COVERAGE:-1}"

if [ "$run_coverage" = "1" ]; then
  export COVERAGE_FILE="${ROOT}/.coverage"
  rm -f "${COVERAGE_FILE}" "${ROOT}/coverage.xml" "${ROOT}/.coverage."*
fi

for dir in libs/solventa_common services/*/; do
  echo "== ${dir}"
  if [ "$run_coverage" = "1" ]; then
    (
      cd "$ROOT"
      PYTHONPATH="${ROOT}/${dir}${PYTHONPATH:+:${PYTHONPATH}}" \
        python -m pytest -q "${dir%/}/tests" \
          --cov \
          --cov-append \
          --cov-config="${ROOT}/pyproject.toml" \
          --cov-fail-under=0
    ) || status=1
  else
    (cd "$dir" && python -m pytest -q) || status=1
  fi
done

if [ "$run_coverage" = "1" ] && [ "$status" -eq 0 ]; then
  cd "$ROOT"
  python -m coverage combine --keep 2>/dev/null || true
  python -m coverage report --fail-under=80 || status=1
  python -m coverage xml -o coverage.xml
fi

exit "$status"
