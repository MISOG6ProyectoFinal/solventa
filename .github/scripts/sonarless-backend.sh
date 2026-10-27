#!/usr/bin/env bash
# Shell for the sonarless-backend job. Each argument is one workflow step.
set -eo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
# shellcheck disable=SC1091
source .github/scripts/sonarless-api.sh

verify_reports() {
  echo "📄 Contenido actual de apps/backend:"
  ls -lh apps/backend || true
  echo ""
  if [ ! -f "apps/backend/coverage.xml" ]; then
    echo "⚠️ coverage.xml no encontrado, buscando en subcarpetas..."
    FOUND=$(find apps/backend -name "coverage.xml" | head -n 1)
    if [ -n "$FOUND" ]; then
      mv "$FOUND" ./apps/backend/coverage.xml
      echo "✅ coverage.xml movido a apps/backend/"
    else
      echo "❌ coverage.xml no encontrado en ninguna carpeta"
    fi
  fi

  if [ ! -f "apps/backend/test-results.xml" ]; then
    echo "⚠️ test-results.xml no encontrado, buscando en subcarpetas..."
    FOUND=$(find apps/backend -name "test-results.xml" | head -n 1)
    if [ -n "$FOUND" ]; then
      mv "$FOUND" ./apps/backend/test-results.xml
      echo "✅ test-results.xml movido a apps/backend/"
    else
      echo "❌ test-results.xml no encontrado en ninguna carpeta"
    fi
  fi

  echo ""
  echo "📊 Archivos listos para Sonarless:"
  ls -lh apps/backend/coverage.xml apps/backend/test-results.xml || true
}

show_issues() {
  echo "🔍 === INTENTANDO OBTENER DETALLES DE PROBLEMAS ==="

  # Wait until the local SonarQube from the scan step is ready.
  sleep 10

  SONAR_URL="http://localhost:9234"
  SONAR_AUTH='admin:Son@rless123'

  echo "Intentando conectar a SonarQube local en ${SONAR_URL}..."

  PROJECT_KEY=$(jq -r '.component.key // empty' sonar-metrics.json)
  if [ -z "$PROJECT_KEY" ]; then
    echo "❌ PROJECT_KEY vacío: no se pudo leer .component.key desde sonar-metrics.json"
    exit 1
  fi

  echo "🔍 Obteniendo issues desde SonarQube para ${PROJECT_KEY}..."
  fetch_sonar_issues "$PROJECT_KEY" sonar-issues.json
  echo ""
  echo "🔍 === DETALLES DE PROBLEMAS ==="
  print_sonar_issues sonar-issues.json

  echo ""
  echo "🔍 === DETALLES DE HOTSPOTS ==="
  fetch_sonar_hotspots "$PROJECT_KEY" sonar-hotspots.json
  print_sonar_hotspots sonar-hotspots.json
}

show_metrics() {
  METRICS_FILE="sonar-metrics.json"

  echo "📊 === MÉTRICAS DE CALIDAD ==="
  cat "$METRICS_FILE"

  get_metric() {
    local key=$1
    jq -r ".component.measures[] | select(.metric == \"$key\").value" "$METRICS_FILE"
  }

  DUPLICATION=$(get_metric "duplicated_lines_density")
  CODE_SMELLS=$(get_metric "code_smells")
  VIOLATIONS=$(get_metric "violations")
  OPEN_ISSUES=$(get_metric "open_issues")
  SECURITY_RATING=$(get_metric "security_rating")
  SECURITY_HOTSPOTS=$(get_metric "security_hotspots")
  BUGS=$(get_metric "bugs")
  VULNERABILITIES=$(get_metric "vulnerabilities")
  COVERAGE=$(get_metric "coverage")
  LINES=$(get_metric "lines")
  NCLOC=$(get_metric "ncloc")

  echo ""
  echo "🔍 === RESUMEN DE MÉTRICAS ==="
  echo "Líneas de código (ncloc): ${NCLOC}"
  echo "Cobertura de pruebas: ${COVERAGE}%"
  echo "Duplicación: ${DUPLICATION}%"
  echo "Code Smells: ${CODE_SMELLS}"
  echo "Violaciones: ${VIOLATIONS}"
  echo "Issues abiertos: ${OPEN_ISSUES}"
  echo "Rating de seguridad: ${SECURITY_RATING}"
  echo "Security Hotspots: ${SECURITY_HOTSPOTS}"
  echo "Bugs: ${BUGS}"
  echo "Vulnerabilidades: ${VULNERABILITIES}"

  echo ""
  echo "📋 === ARCHIVO DE MÉTRICAS COMPLETO ==="
  cat "sonar-metrics.json"

  MEASURES_COUNT=$(jq '.component.measures | length' "$METRICS_FILE")
  if [ "$MEASURES_COUNT" -gt 0 ]; then
    echo ""
    echo "✅ Se encontraron $MEASURES_COUNT métricas de calidad"
    echo "   El detalle de cada issue está en el listado siguiente."
  else
    echo ""
    echo "⚠️  No se encontraron métricas de calidad"
    echo "   Esto puede indicar que el scan falló o no hay problemas detectados"
  fi

  echo ""
  echo "🔍 === DETALLES DE PROBLEMAS ==="
  if [ ! -f sonar-issues.json ] || [ ! -f sonar-hotspots.json ]; then
    echo "❌ Falta el listado de issues o hotspots."
    exit 1
  fi
  print_sonar_issues sonar-issues.json
  echo ""
  echo "🔍 === DETALLES DE HOTSPOTS ==="
  print_sonar_hotspots sonar-hotspots.json

  echo ""
  echo "🚪 === VALIDACIÓN DE QUALITY GATES ==="

  if [[ -z "$DUPLICATION" || -z "$CODE_SMELLS" || -z "$VIOLATIONS" || -z "$OPEN_ISSUES" || -z "$SECURITY_RATING" || -z "$SECURITY_HOTSPOTS" || -z "$BUGS" || -z "$VULNERABILITIES" || -z "$COVERAGE" ]]; then
    echo "❌ Error: alguna métrica está vacía"
    exit 1
  fi

  # Project quality baseline.
  # Do not raise these limits to make the pipeline pass.
  # If this job fails, read the issue details in the same run and fix the
  # regression. The baseline should stay the same or go down.

  if (( $(echo "$DUPLICATION > 0.0" | bc -l) )); then
    echo "❌ Duplication density (${DUPLICATION}%) exceeds limit (0.0%)"
    exit 1
  else
    echo "✅ Duplication density: ${DUPLICATION}% (OK)"
  fi

  if (( CODE_SMELLS > 0 )); then
    echo "❌ Code smells (${CODE_SMELLS}) exceed limit (0)"
    exit 1
  else
    echo "✅ Code smells: ${CODE_SMELLS} (OK)"
  fi

  if (( VIOLATIONS > 0 )); then
    echo "❌ Violations (${VIOLATIONS}) exceed limit (0)"
    exit 1
  else
    echo "✅ Violations: ${VIOLATIONS} (OK)"
  fi

  if (( OPEN_ISSUES > 0 )); then
    echo "❌ Open issues (${OPEN_ISSUES}) exceed limit (0)"
    exit 1
  else
    echo "✅ Open issues: ${OPEN_ISSUES} (OK)"
  fi

  if (( BUGS != 0 )); then
    echo "❌ Bugs (${BUGS}) exceed limit (0)"
    exit 1
  else
    echo "✅ Bugs: ${BUGS} (OK)"
  fi

  if (( $(echo "$SECURITY_RATING > 1.0" | bc -l) )); then
    echo "❌ Security rating (${SECURITY_RATING}) exceeds limit (1.0)"
    exit 1
  else
    echo "✅ Security rating: ${SECURITY_RATING} (OK)"
  fi

  # Congelado en el conteo medido (19). El tope anterior era 20.
  # No subirlo: un hotspot nuevo debe fallar mientras se revisan los existentes.
  if (( SECURITY_HOTSPOTS > 19 )); then
    echo "❌ Security hotspots (${SECURITY_HOTSPOTS}) exceed limit (19)"
    exit 1
  else
    echo "✅ Security hotspots: ${SECURITY_HOTSPOTS} (OK)"
  fi

  if (( VULNERABILITIES != 0 )); then
    echo "❌ Vulnerabilities (${VULNERABILITIES}) exceed limit (0)"
    exit 1
  else
    echo "✅ Vulnerabilities: ${VULNERABILITIES} (OK)"
  fi

  if (( $(echo "$COVERAGE < 89.0" | bc -l) )); then
    echo "❌ Coverage (${COVERAGE}%) is below limit (89.0%)"
    exit 1
  else
    echo "✅ Coverage: ${COVERAGE}% (OK)"
  fi

  echo ""
  echo "🎉 === TODOS LOS QUALITY GATES PASARON ==="
  echo "✅ === ANÁLISIS DE SONARLESS COMPLETADO ==="
  echo "   Los detalles de problemas se muestran arriba para revisión"
}

case "${1:-}" in
  verify-reports) verify_reports ;;
  show-issues) show_issues ;;
  show-metrics) show_metrics ;;
  *)
    echo "Uso: $0 verify-reports|show-issues|show-metrics" >&2
    exit 1
    ;;
esac
