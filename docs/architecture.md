# Architecture

How Golden Apple Island gets a Claude Code tool-call from WSL to a Windows tray popup and back.

## The flow

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

1. A bash hook script in WSL catches the `PreToolUse` event Claude Code emits before running any tool.
2. A zero-dependency Node bridge (`bridge.mjs`) forwards the event over `ws://localhost:19876`.
3. The Tauri app receives the event, shows a Windows toast, and renders an approval card in the tray popup.
4. Your click routes back over the same WebSocket. The hook script exits `0` (approve) or `1` (deny), and Claude Code continues.

If no click arrives within 5 minutes, the event auto-denies client-side so the WSL session never hangs forever.

## Why this shape

- **WebSocket over HTTP/stdio:** we need server-pushed events from Windows to WSL in both directions. WebSocket is the simplest full-duplex transport that works without elevated permissions.
- **localhost only:** the server binds to `127.0.0.1:19876`. WSL2's `localhost` forwarding puts the loopback from both sides on the same port without extra NAT config.
- **Zero-dep bridge:** `bridge.mjs` uses only Node 22+'s built-in `WebSocket`, so installing the hook does not require `npm install` inside WSL.
- **One server, many sessions:** responses are routed by event `id`, so multiple Claude Code sessions (even from different distributions) can share one Windows app instance.

## Project structure

```
GoldenAppleIsland/
├── src/                  # React + Tailwind frontend (Vite)
│   ├── components/       # Header, ApprovalCard, PopupWindow, ResolverPanel, …
│   ├── hooks/            # useWebSocket, usePendingEvents, useApprovalPolicies, …
│   ├── lib/              # resolvePolicy, log, path helpers
│   ├── types/events.ts   # HookEvent / HookResponse contract
│   └── styles/tokens.css # Light/dark design tokens
├── src-tauri/            # Rust + Tauri v2 backend
│   ├── src/ws.rs         # tokio-tungstenite WebSocket server
│   ├── src/commands.rs   # Tauri commands called from the webview
│   ├── src/policy.rs     # Approval policy resolver (global/distro/folder/session)
│   ├── src/app_settings.rs # Persisted settings (JSON in %APPDATA%)
│   └── src/lib.rs        # Tray, window, app setup
└── wsl/                  # WSL-side hook and bridge
    ├── pre-tool-use.sh
    ├── bridge.mjs
    └── install.sh
```

## Approval policies

Events are resolved against a four-tier chain — `global → distribution → folder → session` — with the most specific matching tier winning. The resolver logic is mirrored between the Rust source of truth (`src-tauri/src/policy.rs`) and the frontend visualization (`src/lib/resolvePolicy.ts`); the frontend mirror drives the "How policies resolve" panel in Settings without a backend round-trip.

See the Approval Policy tab inside the app to configure rules, and `docs/websocket-protocol.md` for how session context is carried on each event.
