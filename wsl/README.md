# Golden Apple Island — WSL bridge

WSL-side components for Golden Apple Island v1. When Claude Code (running in WSL) is about to execute a tool, a PreToolUse hook forwards the event to the Windows-side Tauri app over a WebSocket and blocks until the user approves or denies it.

## Contents

- `pre-tool-use.sh` — bash hook script Claude Code invokes. Pipes stdin to `bridge.mjs`, exits `0` on `approve` and `1` on `deny`.
- `bridge.mjs` — ESM Node script that connects to `ws://localhost:10423`, sends a `hook_event`, awaits a matching `hook_response`, and prints `approve`/`deny` on stdout.
- `install.sh` — one-shot installer. Copies the scripts into `~/.claude/hooks/` and registers the hook in `~/.claude/settings.json`.

No external Node packages. Uses Node 22+ global `WebSocket` plus `node:crypto` and `process.stdin`.

## Quickstart

From WSL, in this directory:

```bash
bash install.sh
```

The installer will:

1. Create `~/.claude/hooks/` and copy the two scripts in.
2. `chmod +x` the hook script.
3. Register a `PreToolUse` matcher in `~/.claude/settings.json` (via `jq` if available, otherwise print a manual snippet).
4. Warn if `node --version` is below 18/22.

## Verify

Make sure the Windows Tauri app is running (listening on `ws://localhost:10423`), then:

```bash
echo '{"tool_name":"bash","tool_input":{"command":"ls"},"session_id":"test","cwd":"/tmp"}' \
  | ~/.claude/hooks/pre-tool-use.sh; echo $?
```

Approve in the Windows GUI — the command prints exit code `0`. Deny — exit code `1`.

## Environment variables

- `CLAUDE_HOOK_GUARD_TIMEOUT_MS` — how long `bridge.mjs` waits for a `hook_response`. Default `300000` (5 minutes). On timeout the bridge prints `deny` and exits cleanly.
- `CLAUDE_SESSION_ID` — fallback session id when the hook payload omits `session_id`.

## Troubleshooting

- **Hook always denies / "connection failed"** — the Windows Tauri app isn't running. Start it so it can listen on `ws://localhost:10423`.
- **Hook hangs then denies after 5 minutes** — nobody clicked Approve/Deny in the GUI within the timeout. Raise `CLAUDE_HOOK_GUARD_TIMEOUT_MS` or respond faster.
- **"global WebSocket not available"** — Node version too low. Upgrade to Node 22+ (or 18+ with `--experimental-websocket`).
- **Hook not firing at all** — confirm `~/.claude/settings.json` contains the `PreToolUse` entry pointing at `~/.claude/hooks/pre-tool-use.sh` and that the file is executable.
- **CRLF errors in WSL** — if you edited the scripts with a Windows editor, re-save as LF. `file ~/.claude/hooks/pre-tool-use.sh` should not say "CRLF".

## Uninstall

```bash
rm -f ~/.claude/hooks/pre-tool-use.sh ~/.claude/hooks/bridge.mjs
```

Then edit `~/.claude/settings.json` and remove the `PreToolUse` entry whose command is `~/.claude/hooks/pre-tool-use.sh`. If that leaves `PreToolUse` empty, you can delete the key entirely.
