#!/usr/bin/env bash
# Shell for the sonarless-web job. Each argument is one workflow step.
set -eo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
# shellcheck disable=SC1091
source .github/scripts/sonarless-api.sh

verify_lcov() {
  if [ ! -f "apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular/lcov.info" ]; then
    echo "⚠️ lcov.info no está en apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular/, buscando en subcarpetas..."
    FOUND=$(find apps/web/Web.Solventa.Angular -name "lcov.info" | head -n 1)
    if [ -n "$FOUND" ]; then
      mkdir -p apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular
      mv "$FOUND" apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular/lcov.info
      echo "✅ lcov.info movido a apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular/"
    fi
  fi

  if [ ! -f "apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular/lcov.info" ]; then
    echo "❌ apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular/lcov.info no encontrado. No se ejecuta Sonarless Web sin coverage."
    exit 1
  fi

  echo "✅ apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular/lcov.info listo"
  ls -lh apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular/lcov.info
}

normalize_lcov() {
  set -u
  LCOV="apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular/lcov.info"
  PREFIX="apps/web/Web.Solventa.Angular"

  if [ ! -f "$LCOV" ]; then
    echo "❌ $LCOV no encontrado"
    exit 1
  fi

  echo "SF antes:"
  grep -m 3 '^SF:' "$LCOV"

  tmp="$(mktemp)"
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      SF:*)
        path="${line#SF:}"
        path="${path//\\//}"
        if [ -f "$path" ]; then
          resolved="$path"
        elif [[ "$path" != "$PREFIX/"* ]] && [ -f "$PREFIX/$path" ]; then
          resolved="$PREFIX/$path"
        else
          resolved="$path"
        fi
        printf 'SF:%s\n' "$resolved"
        ;;
      *)
        printf '%s\n' "$line"
        ;;
    esac
  done < "$LCOV" > "$tmp"
  mv "$tmp" "$LCOV"
  chmod 644 "$LCOV"
  stat -c '%a %n' "$LCOV"
  test -r "$LCOV"

  echo "SF después:"
  grep -m 3 '^SF:' "$LCOV"

  total=0
  resolved_count=0
  unresolved=0
  unresolved_list=""
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    path="${line#SF:}"
    total=$((total + 1))
    if [ -f "$path" ]; then
      resolved_count=$((resolved_count + 1))
    else
      unresolved=$((unresolved + 1))
      unresolved_list="${unresolved_list}${path}"$'\n'
    fi
  done < <(grep '^SF:' "$LCOV")

  echo ""
  echo "LCOV path validation"
  echo "--------------------"
  echo "Total SF entries: ${total}"
  echo "Resolved: ${resolved_count}"
  echo "Unresolved: ${unresolved}"
  if [ "$unresolved" -ne 0 ]; then
    echo "Rutas sin resolver:"
    printf '%s' "$unresolved_list"
    exit 1
  fi
}

configure_sonar() {
  cat > sonar-project.properties <<'EOF'
sonar.javascript.lcov.reportPaths=apps/web/Web.Solventa.Angular/coverage/Web.Solventa.Angular/lcov.info
sonar.tests=apps/web/Web.Solventa.Angular/src
sonar.test.inclusions=apps/web/Web.Solventa.Angular/src/**/*.spec.ts
sonar.exclusions=apps/web/Web.Solventa.Angular/src/**/*.spec.ts
sonar.coverage.exclusions=apps/web/Web.Solventa.Angular/src/**/*.spec.ts
EOF
}

show_baseline() {
  METRICS_FILE="sonar-metrics-web.json"
  if [ ! -f "$METRICS_FILE" ]; then
    echo "❌ No se generó ${METRICS_FILE}"
    exit 1
  fi

  if ! jq -e '
    .component.measures
    | map(select(.metric == "coverage"))
    | length > 0
  ' "$METRICS_FILE" >/dev/null; then
    echo "❌ Sonarless Web no produjo métricas válidas"
    cat "$METRICS_FILE"
    exit 1
  fi

  echo "📋 === ARCHIVO DE MÉTRICAS ==="
  cat "$METRICS_FILE"

  get_metric() {
    jq -r --arg key "$1" '.component.measures[]? | select(.metric == $key) | .value // empty' "$METRICS_FILE"
  }

  show_metric() {
    local label=$1
    local key=$2
    local suffix=${3:-}
    local value
    value=$(get_metric "$key")
    if [ -z "$value" ]; then
      echo "${label}: no disponible (métrica '${key}' ausente)"
    else
      echo "${label}: ${value}${suffix}"
    fi
  }

  echo ""
  echo "Web Sonar Baseline"
  echo "------------------"
  show_metric "Coverage" "coverage" "%"
  show_metric "Duplication" "duplicated_lines_density" "%"
  show_metric "Code Smells" "code_smells"
  show_metric "Violations" "violations"
  show_metric "Open issues" "open_issues"
  show_metric "Bugs" "bugs"
  show_metric "Vulnerabilities" "vulnerabilities"
  show_metric "Security Hotspots" "security_hotspots"
  show_metric "Security Rating" "security_rating"
  echo ""
  echo "Métricas devueltas por Sonarless:"
  jq -r '.component.measures[]? | "\(.metric)=\(.value)"' "$METRICS_FILE"
}

show_issues() {
  set -u
  # Sonarless v1.3 does not export these to the next step.
  # They are the local URL and user that the action leaves running.
  SONAR_URL="http://localhost:9234"
  SONAR_AUTH='admin:Son@rless123'

  PROJECT_KEY=$(jq -r '.component.key // empty' sonar-metrics-web.json)
  if [ -z "$PROJECT_KEY" ]; then
    echo "❌ PROJECT_KEY vacío: no se pudo leer .component.key desde sonar-metrics-web.json"
    exit 1
  fi

  fetch_sonar_issues "$PROJECT_KEY" sonar-issues-web.json
  echo ""
  print_sonar_group "Web Sonar Issues" issues sonar-issues-web.json

  fetch_sonar_hotspots "$PROJECT_KEY" sonar-hotspots-web.json
  echo ""
  print_sonar_group "Web Sonar Hotspots" hotspots sonar-hotspots-web.json
}

enforce_gate() {
  set -u
  # Web quality baseline.
  # Do not raise these limits to make the pipeline pass.
  # If this job fails, fix the regression. The baseline should stay the same or improve.
  if [ ! -f sonar-metrics-web.json ]; then
    echo "❌ Missing Sonar metrics file: sonar-metrics-web.json"
    exit 1
  fi
  if [ ! -f sonar-issues-web.json ] || [ ! -f sonar-hotspots-web.json ]; then
    echo "❌ Falta el listado de issues o hotspots."
    exit 1
  fi

  echo "Web Sonar Issues"
  echo "----------------"
  print_sonar_issues sonar-issues-web.json
  echo ""
  print_sonar_group "Web Sonar Hotspots" hotspots sonar-hotspots-web.json
  echo ""

  metric() {
    jq -r --arg metric "$1" '
      [.component.measures[]?
        | select(.metric == $metric)
        | .value
        | select(. != null and . != "")][0] // empty
    ' sonar-metrics-web.json
  }

  COVERAGE=$(metric coverage)
  DUPLICATION=$(metric duplicated_lines_density)
  CODE_SMELLS=$(metric code_smells)
  VIOLATIONS=$(metric violations)
  OPEN_ISSUES=$(metric open_issues)
  BUGS=$(metric bugs)
  VULNERABILITIES=$(metric vulnerabilities)
  SECURITY_HOTSPOTS=$(metric security_hotspots)
  SECURITY_RATING=$(metric security_rating)

  present() {
    [ -n "$1" ] && [ "$1" != "null" ]
  }

  echo "Web Quality Gate"
  echo "----------------"
  if present "$COVERAGE"; then echo "Coverage: ${COVERAGE}% (minimum 90.8%)"; else echo "Coverage: missing"; fi
  if present "$DUPLICATION"; then echo "Duplication: ${DUPLICATION}% (maximum 0.0%)"; else echo "Duplication: missing"; fi
  if present "$CODE_SMELLS"; then echo "Code Smells: ${CODE_SMELLS} (maximum 8)"; else echo "Code Smells: missing"; fi
  if present "$VIOLATIONS"; then echo "Violations: ${VIOLATIONS} (maximum 10)"; else echo "Violations: missing"; fi
  if present "$OPEN_ISSUES"; then echo "Open Issues: ${OPEN_ISSUES} (maximum 10)"; else echo "Open Issues: missing"; fi
  if present "$BUGS"; then echo "Bugs: ${BUGS} (maximum 2)"; else echo "Bugs: missing"; fi
  if present "$VULNERABILITIES"; then echo "Vulnerabilities: ${VULNERABILITIES} (maximum 0)"; else echo "Vulnerabilities: missing"; fi
  if present "$SECURITY_HOTSPOTS"; then echo "Security Hotspots: ${SECURITY_HOTSPOTS} (maximum 2)"; else echo "Security Hotspots: missing"; fi
  if present "$SECURITY_RATING"; then echo "Security Rating: ${SECURITY_RATING} (maximum 1.0)"; else echo "Security Rating: missing"; fi

  failed=0
  require_metric() {
    if ! present "$2"; then
      echo "❌ Missing Sonar metric: $1"
      failed=1
    fi
  }
  exceeds() {
    echo "$1 > $2" | bc -l
  }
  below() {
    echo "$1 < $2" | bc -l
  }

  require_metric coverage "$COVERAGE"
  require_metric duplicated_lines_density "$DUPLICATION"
  require_metric code_smells "$CODE_SMELLS"
  require_metric violations "$VIOLATIONS"
  require_metric open_issues "$OPEN_ISSUES"
  require_metric bugs "$BUGS"
  require_metric vulnerabilities "$VULNERABILITIES"
  require_metric security_hotspots "$SECURITY_HOTSPOTS"
  require_metric security_rating "$SECURITY_RATING"

  if present "$COVERAGE" && [ "$(below "$COVERAGE" 90.8)" -eq 1 ]; then
    echo "❌ Coverage (${COVERAGE}%) is below baseline (90.8%)"
    failed=1
  fi
  if present "$DUPLICATION" && [ "$(exceeds "$DUPLICATION" 0.0)" -eq 1 ]; then
    echo "❌ Duplication (${DUPLICATION}%) exceeds baseline (0.0%)"
    failed=1
  fi
  if present "$CODE_SMELLS" && [ "$(exceeds "$CODE_SMELLS" 8)" -eq 1 ]; then
    echo "❌ Code Smells (${CODE_SMELLS}) exceed baseline (8)"
    failed=1
  fi
  if present "$VIOLATIONS" && [ "$(exceeds "$VIOLATIONS" 10)" -eq 1 ]; then
    echo "❌ Violations (${VIOLATIONS}) exceed baseline (10)"
    failed=1
  fi
  if present "$OPEN_ISSUES" && [ "$(exceeds "$OPEN_ISSUES" 10)" -eq 1 ]; then
    echo "❌ Open Issues (${OPEN_ISSUES}) exceed baseline (10)"
    failed=1
  fi
  if present "$BUGS" && [ "$(exceeds "$BUGS" 2)" -eq 1 ]; then
    echo "❌ Bugs (${BUGS}) exceed baseline (2)"
    failed=1
  fi
  if present "$VULNERABILITIES" && [ "$(exceeds "$VULNERABILITIES" 0)" -eq 1 ]; then
    echo "❌ Vulnerabilities (${VULNERABILITIES}) exceed baseline (0)"
    failed=1
  fi
  if present "$SECURITY_HOTSPOTS" && [ "$(exceeds "$SECURITY_HOTSPOTS" 2)" -eq 1 ]; then
    echo "❌ Security Hotspots (${SECURITY_HOTSPOTS}) exceed baseline (2)"
    failed=1
  fi
  if present "$SECURITY_RATING" && [ "$(exceeds "$SECURITY_RATING" 1.0)" -eq 1 ]; then
    echo "❌ Security Rating (${SECURITY_RATING}) exceeds baseline (1.0)"
    failed=1
  fi

  if [ "$failed" -ne 0 ]; then
    exit 1
  fi
  echo "✅ Web Quality Gate passed"
}

case "${1:-}" in
  verify-lcov) verify_lcov ;;
  normalize-lcov) normalize_lcov ;;
  configure) configure_sonar ;;
  show-baseline) show_baseline ;;
  show-issues) show_issues ;;
  enforce-gate) enforce_gate ;;
  *)
    echo "Uso: $0 verify-lcov|normalize-lcov|configure|show-baseline|show-issues|enforce-gate" >&2
    exit 1
    ;;
esac
