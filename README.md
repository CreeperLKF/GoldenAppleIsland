<h1 align="center">
  <img src="logo.png" width="36" height="36" alt="Golden Apple Island" valign="middle">&nbsp;
  Golden Apple Island
</h1>
<p align="center">
  <b>One-click Claude Code approvals from the Windows tray.</b><br>
  English | <a href="README_zh.md">简体中文</a>
</p>

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
- **Hooks you can customize.** Golden Apple Island manages the hook scripts that bridge Claude Code to the tray app. Configure which hook types are active, how they behave per distro or folder, and let the app keep everything in sync — no manual `settings.json` surgery.
- **Let another agent — or your own vibe-coded service — decide.** Agent Approve spawns a second Claude Code instance as a safety reviewer that reads each request and returns approve / reject / escalate. The [ALICE](https://github.com/CreeperLKF/ALICE) project provides ready-made reviewer profiles — an "Alice" agent that audits what "Bob" (your working agent) is doing. External Approve does the same thing over HTTP, so any service you build or vibe-code can plug in as the decision-maker.

## Roadmap

- [ ] SSH support — connect to Claude Code on remote hosts
- [ ] WSL NAT and other network modes (beyond mirrored)
- [ ] UI polish — improved card layout, theme customization, accessibility

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

### Optional: Agent Approve & External Approve (experimental)

The **Agent Approve** and **External Approve** policy kinds delegate approval decisions to an AI agent or an external HTTP endpoint, respectively. See the dedicated guide: [`docs/agent-external-approve.md`](docs/agent-external-approve.md).

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

The popup's policy panel has two controls:

- **Override Policy** — a global top-priority switch that overrides all other rules. Available at any time, even when no session is active. Set it to Force Auto to auto-approve all incoming events regardless of session or configured rules, or Force Manual to force everything through manual review. Resets on app restart (in-memory only). Also supports Agent Approve and External Approve when configured.
- **Session Policy** — writes a persistent rule for the currently active session. Supports Auto Approve, Manual Approve, Agent Approve, and External Approve. Unconfigured policy kinds appear greyed out.

Per-distribution, per-folder, and per-session approval rules live under **Settings → Approval Policy**.

## Documentation

Deeper technical docs live in [`docs/`](docs/):

| Looking for… | Read |
|---|---|
| How the hook, bridge, and Windows app fit together | [`docs/architecture.md`](docs/architecture.md) |
| Agent Approve & External Approve setup guide | [`docs/agent-external-approve.md`](docs/agent-external-approve.md) |
| The WebSocket message schema | [`docs/websocket-protocol.md`](docs/websocket-protocol.md) |
| Release process and build scripts | [`docs/releasing.md`](docs/releasing.md) |

Product requirements, design specs, and implementation plans live in the companion development workspace repo.

## Acknowledgements

Inspired by [ping-island](https://github.com/erha19/ping-island/) — the project that motivated the author to build Golden Apple Island.

## License

MIT — see [LICENSE](LICENSE).
