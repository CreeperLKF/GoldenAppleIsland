#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! RESULT="$(node "$SCRIPT_DIR/bridge.mjs")"; then
  RESULT="deny"
fi

if [[ "$RESULT" == "approve" ]]; then
  exit 0
else
  exit 1
fi
