#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

node_major="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$node_major" != "26" ]]; then
  echo "Node.js 26 is required. Current: $(node -v)" >&2
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "Java is not on PATH." >&2
  exit 1
fi

sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [[ -z "$sdk" ]]; then
  echo "Set ANDROID_HOME to the Android SDK." >&2
  exit 1
fi
export ANDROID_HOME="$sdk"

ndk_version="27.1.12297006"
cmake_version="3.31.6"
if [[ ! -d "$sdk/ndk/$ndk_version" || ! -d "$sdk/cmake/$cmake_version" ]]; then
  echo "Install NDK $ndk_version and CMake $cmake_version in the Android SDK." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  npm ci
fi

android_dir="$root/apps/mobile/android"
if [[ ! -f "$android_dir/local.properties" ]]; then
  printf 'sdk.dir=%s\n' "$sdk" > "$android_dir/local.properties"
fi

chmod +x "$android_dir/gradlew"
(
  cd "$android_dir"
  ./gradlew assembleRelease --no-daemon
)

apk="$android_dir/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$apk" ]]; then
  echo "The release APK was not produced." >&2
  exit 1
fi

mkdir -p "$root/dist"
cp "$apk" "$root/dist/mobile-release.apk"
echo "APK: $root/dist/mobile-release.apk"
