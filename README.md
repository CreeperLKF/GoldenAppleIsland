# Golden Apple Island

One-click Claude Code approvals from the Windows tray.

*Loved \*-Island on macOS and wish Windows had something like it? Try Golden Apple Island.*

Built with Tauri v2, React, and Tailwind CSS.

## Who needs this

Anyone who runs Claude Code on Windows — natively, through WSL, or over SSH (coming soon) — and wants every approval prompt turned into a single click, a pre-approved auto-decision, or eventually a smart AI-assisted judgment.

## Why Golden Apple Island

> [!TIP]
> **Auto-approve beats YOLO.** Agents that know they're running in YOLO mode tend to wander — pulling parent-directory listings, probing sibling projects, gathering context they don't actually need. Auto-approve gives you the same hands-off speed while keeping the agent inside a supervised boundary, so it stays focused on the task at hand. Every decision is logged in the Recent history, so if something slips past your rules you can audit exactly where afterward.

- **Built for Windows developers.** Native tray icon, Windows toasts, keyboard shortcuts, and popups that remember where you dragged them — no terminal context-switching.
- **Meets Claude Code wherever it runs.** First-class WSL today; SSH on the roadmap. One tray app can serve every distro and host on your machine at once.
- **Approval policies that compose.** Global, per-distribution, per-folder, and per-session rules resolve along a clear precedence chain — mark a trusted workspace auto-approve, keep production manual, and forget about the rest. Hook modes are equally configurable for when you need to go deeper.

## Quick start

1. **Install the app.** Grab the latest `-setup.exe` from [GitHub Releases](https://github.com/CreeperLKF/GoldenAppleIsland/releases), run it (no admin needed — it installs per-user), and launch **Golden Apple Island** from the Start menu — it appears in your system tray.
2. **Enable your WSL distros.** Right-click the tray icon → **Settings → Hook Management → WSL Instances → Enable all**. The app installs the hook into every distribution and registers it in `~/.claude/settings.json` for you.
3. **Try it.** Run `claude` in any WSL shell and have it do something that needs a tool call. A Windows toast pops up and the tray shows an approval card — click ✓ or ✗ and the session unblocks.

> **Networking note.** WSL support currently requires `networkingMode = mirrored` in your `.wslconfig` so the bridge can reach the Windows WebSocket server on `127.0.0.1`. NAT and other WSL network modes are on the roadmap.

## Install

**From a release (recommended).** Follow **Quick start** above — one `-setup.exe` covers everything.

**From source.** Clone and build on Windows:

```bash
git clone https://github.com/CreeperLKF/GoldenAppleIsland.git
cd GoldenAppleIsland
npm install
npm run tauri build
```

The setup.exe lands in `src-tauri/target/release/bundle/nsis/`. Run it, launch the app, and enable your WSL distros from **Settings → Hook Management → WSL Instances → Enable all** exactly as in Quick start.

Prerequisites: Node 20+, Rust via `rustup`, and the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) for Windows (MSVC build tools + WebView2).

### Optional: Agent Approve (experimental)

The **Agent Approve** policy kind delegates approval decisions to a locally-running Claude Code agent guided by a workspace `CLAUDE.md`. Using it requires the Claude Code CLI on your Windows `PATH` — install it from <https://claude.com/claude-code>. Golden Apple Island does not bundle or install Claude Code; both `claude.exe` and the npm-installed `claude.cmd` shim are supported (resolved via `which`).

When Agent Approve is enabled for a rule, Golden Apple Island spawns `claude -p` against a small workspace (default: `%APPDATA%\golden-apple-island\agent-workspaces\default\`, pre-populated with the ALICE "all-is-well" profile downloaded on first use) and waits for a JSON verdict before responding to the hook event. Configure it under **Settings → Approval Policies → Agent Approve (experimental)**.

## Develop

```bash
npm install
npm run tauri dev
```

The Rust tray app launches with the Vite dev server on `http://localhost:5173` and hot-reloads the React frontend. `Ctrl+C` to stop.

For fast iteration without a full build:

```bash
npm run check              # tsc --noEmit + cargo check
npm run build              # frontend only
```

Release cadence and the full script reference live in [`docs/releasing.md`](docs/releasing.md).

## Using the popup

Left-click the tray icon to show or hide the popup. Drag it anywhere — its position persists across restarts. Keyboard shortcuts while the popup has focus:

| Key | Action |
|---|---|
| `A` | Approve the topmost pending card |
| `Shift+A` | Approve **all** currently pending cards |
| `D` | Deny the topmost pending card |
| `Esc` | Hide the popup |

Per-distribution, per-folder, and per-session approval rules live under **Settings → Approval Policy**.

## Documentation

Deeper technical docs live in [`docs/`](docs/):

| Looking for… | Read |
|---|---|
| How the hook, bridge, and Windows app fit together | [`docs/architecture.md`](docs/architecture.md) |
| The WebSocket message schema | [`docs/websocket-protocol.md`](docs/websocket-protocol.md) |
| Release process and build scripts | [`docs/releasing.md`](docs/releasing.md) |

Product requirements, design specs, and implementation plans live in the companion development workspace repo.
