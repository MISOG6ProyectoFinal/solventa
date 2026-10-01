#!/usr/bin/env bash
set -euo pipefail

avd="${1:-Pixel_8}"
emulator -avd "$avd" -no-snapshot-load
