#!/usr/bin/env bash
# Shell for the sonarless-mobile job. Each argument is one workflow step.
set -eo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$root"
# shellcheck disable=SC1091
source .github/scripts/sonarless-api.sh

verify_lcov() {
  if [ ! -f "apps/mobile/coverage/lcov.info" ]; then
    echo "⚠️ lcov.info no está en apps/mobile/coverage/, buscando en subcarpetas..."
    FOUND=$(find apps/mobile -name "lcov.info" | head -n 1)
    if [ -n "$FOUND" ]; then
      mkdir -p apps/mobile/coverage
      mv "$FOUND" apps/mobile/coverage/lcov.info
      echo "✅ lcov.info movido a apps/mobile/coverage/"
    fi
  fi

  if [ ! -f "apps/mobile/coverage/lcov.info" ]; then
    echo "❌ apps/mobile/coverage/lcov.info no encontrado. No se ejecuta Sonarless Mobile sin coverage."
    exit 1
  fi

  echo "✅ apps/mobile/coverage/lcov.info listo"
  ls -lh apps/mobile/coverage/lcov.info
}

configure_sonar() {
  cat > sonar-project.properties <<'EOF'
sonar.javascript.lcov.reportPaths=apps/mobile/coverage/lcov.info
sonar.tests=apps/mobile/src
sonar.test.inclusions=apps/mobile/src/**/*.spec.tsx,apps/mobile/src/test-setup.ts,apps/mobile/src/test-file-stub.js
sonar.exclusions=apps/mobile/src/**/*.spec.tsx,apps/mobile/src/test-setup.ts,apps/mobile/src/test-file-stub.js
sonar.coverage.exclusions=apps/mobile/src/**/*.spec.tsx,apps/mobile/src/test-setup.ts,apps/mobile/src/test-file-stub.js
EOF
}

show_baseline() {
  METRICS_FILE="sonar-metrics-mobile.json"
  if [ ! -f "$METRICS_FILE" ]; then
    echo "❌ No se generó ${METRICS_FILE}"
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
  echo "Mobile Sonar Baseline"
  echo "---------------------"
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

  PROJECT_KEY=$(jq -r '.component.key // empty' sonar-metrics-mobile.json)
  if [ -z "$PROJECT_KEY" ]; then
    echo "❌ PROJECT_KEY vacío: no se pudo leer .component.key desde sonar-metrics-mobile.json"
    exit 1
  fi

  fetch_sonar_issues "$PROJECT_KEY" sonar-issues-mobile.json
  echo ""
  print_sonar_group "Mobile Sonar Issues" issues sonar-issues-mobile.json

  fetch_sonar_hotspots "$PROJECT_KEY" sonar-hotspots-mobile.json
  echo ""
  print_sonar_group "Mobile Sonar Hotspots" hotspots sonar-hotspots-mobile.json
}

enforce_gate() {
  set -u
  if [ ! -f sonar-metrics-mobile.json ]; then
    echo "❌ Missing Sonar metrics file: sonar-metrics-mobile.json"
    exit 1
  fi
  if [ ! -f sonar-issues-mobile.json ] || [ ! -f sonar-hotspots-mobile.json ]; then
    echo "❌ Falta el listado de issues o hotspots."
    exit 1
  fi

  echo "Mobile Sonar Issues"
  echo "-------------------"
  print_sonar_issues sonar-issues-mobile.json
  echo ""
  print_sonar_group "Mobile Sonar Hotspots" hotspots sonar-hotspots-mobile.json
  echo ""

  metric() {
    jq -r --arg metric "$1" '
      [.component.measures[]?
        | select(.metric == $metric)
        | .value
        | select(. != null and . != "")][0] // empty
    ' sonar-metrics-mobile.json
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

  echo "Mobile Quality Gate"
  echo "-------------------"
  if present "$COVERAGE"; then echo "Coverage: ${COVERAGE}% (minimum 81.4%)"; else echo "Coverage: missing"; fi
  if present "$DUPLICATION"; then echo "Duplication: ${DUPLICATION}% (maximum 0.0%)"; else echo "Duplication: missing"; fi
  if present "$CODE_SMELLS"; then echo "Code Smells: ${CODE_SMELLS} (maximum 35)"; else echo "Code Smells: missing"; fi
  if present "$VIOLATIONS"; then echo "Violations: ${VIOLATIONS} (maximum 35)"; else echo "Violations: missing"; fi
  if present "$OPEN_ISSUES"; then echo "Open Issues: ${OPEN_ISSUES} (maximum 35)"; else echo "Open Issues: missing"; fi
  if present "$BUGS"; then echo "Bugs: ${BUGS} (maximum 0)"; else echo "Bugs: missing"; fi
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

  if present "$COVERAGE" && [ "$(below "$COVERAGE" 81.4)" -eq 1 ]; then
    echo "❌ Coverage (${COVERAGE}%) is below baseline (81.4%)"
    failed=1
  fi
  if present "$DUPLICATION" && [ "$(exceeds "$DUPLICATION" 0.0)" -eq 1 ]; then
    echo "❌ Duplication (${DUPLICATION}%) exceeds baseline (0.0%)"
    failed=1
  fi
  if present "$CODE_SMELLS" && [ "$(exceeds "$CODE_SMELLS" 35)" -eq 1 ]; then
    echo "❌ Code Smells (${CODE_SMELLS}) exceed baseline (35)"
    failed=1
  fi
  if present "$VIOLATIONS" && [ "$(exceeds "$VIOLATIONS" 35)" -eq 1 ]; then
    echo "❌ Violations (${VIOLATIONS}) exceed baseline (35)"
    failed=1
  fi
  if present "$OPEN_ISSUES" && [ "$(exceeds "$OPEN_ISSUES" 35)" -eq 1 ]; then
    echo "❌ Open Issues (${OPEN_ISSUES}) exceed baseline (35)"
    failed=1
  fi
  if present "$BUGS" && [ "$(exceeds "$BUGS" 0)" -eq 1 ]; then
    echo "❌ Bugs (${BUGS}) exceed baseline (0)"
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
  echo "✅ Mobile Quality Gate passed"
}

case "${1:-}" in
  verify-lcov) verify_lcov ;;
  configure) configure_sonar ;;
  show-baseline) show_baseline ;;
  show-issues) show_issues ;;
  enforce-gate) enforce_gate ;;
  *)
    echo "Uso: $0 verify-lcov|configure|show-baseline|show-issues|enforce-gate" >&2
    exit 1
    ;;
esac
