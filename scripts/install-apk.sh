#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
apk="$root/dist/mobile-release.apk"
serial="${1:-}"

if [[ ! -f "$apk" ]]; then
  echo "APK not found. Run scripts/build-apk.sh first." >&2
  exit 1
fi

if command -v adb >/dev/null 2>&1; then
  adb_bin="$(command -v adb)"
else
  sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  if [[ -z "$sdk" || ! -x "$sdk/platform-tools/adb" ]]; then
    echo "adb is not on PATH." >&2
    exit 1
  fi
  adb_bin="$sdk/platform-tools/adb"
fi

if [[ -n "$serial" ]]; then
  "$adb_bin" -s "$serial" install -r "$apk"
else
  "$adb_bin" install -r "$apk"
fi
