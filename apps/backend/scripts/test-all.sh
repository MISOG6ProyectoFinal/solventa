#!/usr/bin/env bash
# Corre las pruebas de la librería común y de cada servicio, cada uno con su pythonpath.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
status=0
run_coverage="${RUN_COVERAGE:-1}"
JUNIT_PARTIALS="${ROOT}/.junit-partials"

if [ "$run_coverage" = "1" ]; then
  export COVERAGE_FILE="${ROOT}/.coverage"
  rm -f "${COVERAGE_FILE}" "${ROOT}/coverage.xml" "${ROOT}/test-results.xml" "${ROOT}/.coverage."*
fi
rm -rf "${JUNIT_PARTIALS}"
mkdir -p "${JUNIT_PARTIALS}"

for dir in libs/solventa_common services/*/; do
  echo "== ${dir}"
  junit_file="${JUNIT_PARTIALS}/$(echo "${dir%/}" | tr '/' '-').xml"
  if [ "$run_coverage" = "1" ]; then
    (
      cd "$ROOT"
      PYTHONPATH="${ROOT}/${dir}${PYTHONPATH:+:${PYTHONPATH}}" \
        python -m pytest -q "${dir%/}/tests" \
          --cov \
          --cov-append \
          --cov-config="${ROOT}/pyproject.toml" \
          --cov-fail-under=0 \
          --junitxml="${junit_file}"
    ) || status=1
  else
    (
      cd "$dir"
      python -m pytest -q --junitxml="${junit_file}"
    ) || status=1
  fi
done

if compgen -G "${JUNIT_PARTIALS}/*.xml" > /dev/null; then
  python - "${ROOT}/test-results.xml" "${JUNIT_PARTIALS}" <<'PY'
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

output = Path(sys.argv[1])
partials_dir = Path(sys.argv[2])
files = sorted(partials_dir.glob("*.xml"))
if not files:
    sys.stderr.write("No se generaron reportes JUnit parciales\n")
    sys.exit(1)

testsuites = ET.Element("testsuites")
total = failures = errors = skipped = 0
time = 0.0
for filepath in files:
    root = ET.parse(filepath).getroot()
    suites = [root] if root.tag == "testsuite" else list(root.findall("testsuite"))
    for suite in suites:
        testsuites.append(suite)
        total += int(suite.get("tests", 0))
        failures += int(suite.get("failures", 0))
        errors += int(suite.get("errors", 0))
        skipped += int(suite.get("skipped", 0))
        time += float(suite.get("time", 0))

testsuites.set("tests", str(total))
testsuites.set("failures", str(failures))
testsuites.set("errors", str(errors))
testsuites.set("skipped", str(skipped))
testsuites.set("time", str(time))
ET.ElementTree(testsuites).write(output, encoding="utf-8", xml_declaration=True)
PY
fi

if [ "$run_coverage" = "1" ]; then
  cd "$ROOT"
  python -m coverage combine --keep 2>/dev/null || true
  python -m coverage report --fail-under=80 || status=1
  python -m coverage xml -o coverage.xml
  python - "$ROOT" <<'PY' || status=1
import sys
from pathlib import Path
import xml.etree.ElementTree as ET

repo = Path(sys.argv[1]).resolve().parents[1]
report = Path("coverage.xml")
text = report.read_text(encoding="utf-8")
text = text.replace("<source>libs</source>", "<source>apps/backend/libs</source>")
text = text.replace("<source>services</source>", "<source>apps/backend/services</source>")
report.write_text(text, encoding="utf-8")

sources = [(node.text or "").strip() for node in ET.parse(report).getroot().find("sources")]
expected = {"apps/backend/libs", "apps/backend/services"}
if set(sources) != expected:
    sys.stderr.write(f"sources inesperados en coverage.xml: {sources}\n")
    sys.exit(1)
missing = []
for cls in ET.parse(report).getroot().iter("class"):
    filename = cls.get("filename") or ""
    if not any((repo / source / filename).is_file() for source in sources):
        missing.append(filename)
if missing:
    preview = "\n".join(f"  {name}" for name in missing[:20])
    sys.stderr.write(f"coverage.xml no resuelve {len(missing)} archivos desde la raíz:\n{preview}\n")
    sys.exit(1)
PY
fi

rm -rf "${JUNIT_PARTIALS}"
exit "$status"
