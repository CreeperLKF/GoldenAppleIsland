#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! RESULT="$(node "$SCRIPT_DIR/bridge.mjs")"; then
  RESULT="deny"
fi

if [[ "$RESULT" == "approve" ]]; then
  # Output permissionDecision so Claude Code skips its own prompt
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","permissionDecisionReason":"Approved via Golden Apple Island"}}'
  exit 0
else
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Denied via Golden Apple Island"}}'
  exit 1
fi
