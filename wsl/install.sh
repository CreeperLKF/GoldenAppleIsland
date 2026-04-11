#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$HOME/.claude/hooks"
SETTINGS="$HOME/.claude/settings.json"

mkdir -p "$HOOKS_DIR"
cp "$SCRIPT_DIR/pre-tool-use.sh" "$HOOKS_DIR/pre-tool-use.sh"
cp "$SCRIPT_DIR/bridge.mjs" "$HOOKS_DIR/bridge.mjs"
chmod +x "$HOOKS_DIR/pre-tool-use.sh"

NODE_OK=1
if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node --version 2>/dev/null || echo v0.0.0)"
  NODE_MAJOR="${NODE_VERSION#v}"
  NODE_MAJOR="${NODE_MAJOR%%.*}"
  if [[ "${NODE_MAJOR:-0}" -lt 18 ]]; then
    echo "WARNING: Node $NODE_VERSION is below v18. Global WebSocket requires Node 22+ (or 18+ with experimental flag). Please upgrade."
    NODE_OK=0
  elif [[ "${NODE_MAJOR:-0}" -lt 22 ]]; then
    echo "WARNING: Node $NODE_VERSION is below v22. Global WebSocket is experimental on $NODE_VERSION. Upgrade to v22+ recommended."
  fi
else
  echo "WARNING: 'node' not found on PATH. Install Node.js v22+."
  NODE_OK=0
fi

HOOK_SNIPPET='{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "~/.claude/hooks/pre-tool-use.sh" }
        ]
      }
    ]
  }
}'

register_with_jq() {
  local tmp
  tmp="$(mktemp)"
  jq '
    .hooks //= {} |
    .hooks.PreToolUse //= [] |
    if any(.hooks.PreToolUse[]?; .matcher == "*" and (any(.hooks[]?; .command == "~/.claude/hooks/pre-tool-use.sh")))
    then .
    else .hooks.PreToolUse += [{
      "matcher": "*",
      "hooks": [{ "type": "command", "command": "~/.claude/hooks/pre-tool-use.sh" }]
    }]
    end
  ' "$SETTINGS" > "$tmp"
  mv "$tmp" "$SETTINGS"
}

if [[ ! -f "$SETTINGS" ]]; then
  mkdir -p "$(dirname "$SETTINGS")"
  printf '%s\n' "$HOOK_SNIPPET" > "$SETTINGS"
  echo "Created $SETTINGS with PreToolUse hook."
elif command -v jq >/dev/null 2>&1; then
  register_with_jq
  echo "Merged PreToolUse hook into $SETTINGS."
else
  echo ""
  echo "NOTE: $SETTINGS already exists and 'jq' is not installed."
  echo "Please add the following PreToolUse hook manually:"
  echo ""
  echo "$HOOK_SNIPPET"
  echo ""
fi

echo ""
echo "===== Claude Hook Guard installed ====="
echo "Hook script: $HOOKS_DIR/pre-tool-use.sh"
echo "Next: start the Windows Tauri app (listens on ws://localhost:9876)."
echo "Verify: echo '{\"tool_name\":\"bash\",\"tool_input\":{\"command\":\"ls\"}}' | $HOOKS_DIR/pre-tool-use.sh; echo \$?"

exit 0
