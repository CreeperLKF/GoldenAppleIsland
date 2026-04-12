# Golden Apple Island

A lightweight Windows system tray app that intercepts Claude Code hook events from WSL and surfaces them as one-click approval cards — so you never have to babysit a terminal tab again.

Built with Tauri v2, React, and Tailwind CSS.

## Why

When Claude Code runs in WSL, every tool call (shell command, file write, file read) requires you to switch to the terminal and confirm. Running multiple sessions in parallel turns approval into a juggling act. Golden Apple Island moves that approval to a native Windows popup anchored to the tray, with approve/deny buttons, a Windows toast, and a 5-minute auto-deny timeout.

## How it works

```
WSL (Linux)                                Windows
─────────────                              ──────────────────────
Claude Code                                Golden Apple Island
   │                                          ▲
   ▼                                          │
pre-tool-use.sh  ──►  bridge.mjs  ══ ws ═══►  WebSocket server
   ▲                                          │   (localhost:19876)
   │                                          ▼
   └──── exit 0/1 ◄── approve/deny ◄──  Approval popup + tray
```

1. A bash hook script in WSL catches the pre-tool-use event.
2. A zero-dependency Node bridge forwards the event over `ws://localhost:19876`.
3. The Tauri app shows a toast and an approval card.
4. Your click routes back over the same WebSocket, the hook exits 0 (approve) or 1 (deny), and Claude Code continues.

If you don't click within 5 minutes, the event auto-denies.

## Install

### 1. Install the Windows app

Clone this repo on Windows and build it:

```bash
git clone https://github.com/CreeperLKF/GoldenAppleIsland.git
cd GoldenAppleIsland
npm install
npm run tauri build
```

The built `.msi` installer lands in `src-tauri/target/release/bundle/msi/`. Install it and launch **Golden Apple Island** — it will appear in your system tray.

Prerequisites: Node 20+, Rust (via `rustup`), and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for Windows (MSVC build tools + WebView2).

### 2. Install the WSL hook

From your WSL shell, run:

```bash
cd /mnt/c/path/to/GoldenAppleIsland
bash wsl/install.sh
```

This copies `pre-tool-use.sh` and `bridge.mjs` to `~/.claude/hooks/` and registers the `PreToolUse` hook in `~/.claude/settings.json` (merging with `jq` if available, otherwise printing a manual snippet).

Prerequisite: Node 22+ in WSL (required for the global `WebSocket` client).

## Usage

1. Keep Golden Apple Island running in the Windows tray.
2. Start `claude` in WSL as usual.
3. When Claude Code wants to run a tool, a toast appears and the tray popup shows a card: tool category, the command or file path, and approve/deny buttons.
4. Click once. The WSL session unblocks immediately.

Keyboard shortcuts in the popup:

| Key | Action |
|---|---|
| `A` | Approve the topmost pending card |
| `D` | Deny the topmost pending card |
| `Esc` | Hide the popup |

## Development

```bash
npm install
npm run tauri dev
```

This launches the Rust tray app with the Vite dev server on `http://localhost:5173` and hot-reloads the React frontend. Stop with `Ctrl+C`.

To check the backend without launching the app:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

To build only the frontend:

```bash
npm run build
```

## Project structure

```
GoldenAppleIsland/
├── src/                  # React + Tailwind frontend (Vite)
│   ├── components/       # Header, ApprovalCard, PopupWindow, …
│   ├── hooks/            # useWebSocket, usePendingEvents, …
│   ├── types/events.ts   # HookEvent / HookResponse contract
│   └── styles/tokens.css # Light/dark design tokens
├── src-tauri/            # Rust + Tauri v2 backend
│   ├── src/ws.rs         # tokio-tungstenite WebSocket server
│   ├── src/commands.rs   # Tauri commands called from the webview
│   └── src/lib.rs        # Tray, window, app setup
└── wsl/                  # WSL-side hook and bridge
    ├── pre-tool-use.sh
    ├── bridge.mjs
    └── install.sh
```

## WebSocket protocol

The app listens on `127.0.0.1:19876`. Messages are JSON.

**Bridge → app:**

```json
{
  "type": "hook_event",
  "id": "evt_abc123",
  "session_id": "sess_def456",
  "session_cwd": "/home/user/projects/my-app",
  "hook_type": "pre_tool_use",
  "tool_name": "bash",
  "tool_input": { "command": "rm -rf ./dist" },
  "timestamp": "2026-04-11T10:30:00Z"
}
```

**App → bridge:**

```json
{ "type": "hook_response", "id": "evt_abc123", "action": "approve" }
```

`action` is `"approve"` or `"deny"`. Responses are routed by `id` so multiple bridge instances can share the server.

## Configuration

| Env var | Scope | Default | Purpose |
|---|---|---|---|
| `CLAUDE_HOOK_GUARD_TIMEOUT_MS` | WSL (bridge.mjs) | `300000` | Client-side wait before printing `deny` |

## Troubleshooting

- **Toast appears but no popup.** Left-click the tray icon — the popup is hidden by default.
- **`Connection refused` in WSL.** The Windows app isn't running. Launch it from the Start menu.
- **Bash script exits with CRLF errors.** The repo enforces LF on `wsl/**` via `.gitattributes`; re-clone or `git checkout -- wsl/` to reset line endings.
- **`WebSocket is not defined` in bridge.** Upgrade WSL Node to 22+.
- **Hook not firing.** Check `~/.claude/settings.json` has a `hooks.PreToolUse` entry pointing to `~/.claude/hooks/pre-tool-use.sh`, and that the script is `chmod +x`.

## Releasing

Versions across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` stay in lock-step. Use the bump script and let CI do the rest:

```bash
npm run release patch   # or: minor / major / 1.2.3
git add -A
git commit -m "chore: release v$(node -p "require('./package.json').version")"
git tag v$(node -p "require('./package.json').version")
git push --follow-tags
```

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which on a Windows runner builds the MSI and NSIS installers plus the WSL tarball, then attaches them to a new GitHub Release.

### Local build

```bash
npm install
npm run tauri:build     # produces MSI + NSIS under src-tauri/target/release/bundle/
npm run bundle:wsl      # produces dist-wsl/golden-apple-island-wsl-<version>.tar.gz
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server only |
| `npm run tauri:dev` | Full Tauri dev (Vite + Rust) |
| `npm run tauri:build` | Production MSI + NSIS installer |
| `npm run build` | `tsc` + Vite frontend build only |
| `npm run check` | Typecheck + `cargo check` (no build) |
| `npm run bundle:wsl` | Tarball of `wsl/` for standalone distribution |
| `npm run release <bump>` | Bump version in all three manifests |
| `npm run clean` | Wipe `dist/`, `src-tauri/target/`, caches |

## Status

**v1 — P0 + UI polish.** Covers hook installation, event reception, approval UI, tray, toast, timeout handling, approve-all, in-memory auto-approve session, and a decision history view. Planned for later: auto-approve by tool, diff preview for file writes, global hotkey, and a rule engine. See `docs/prd.md` in the companion development workspace for the full roadmap.

## License

MIT — see [LICENSE](LICENSE).
