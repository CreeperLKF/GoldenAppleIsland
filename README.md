# Golden Apple Island — Claude Hook Guard

A lightweight Windows system tray application that intercepts Claude Code hook events from WSL and presents them as one-click approval cards.

Built with Tauri v2 (Rust) + React + Tailwind CSS.

## Status

v1 in development. See `docs/prd.md` in the companion development workspace for product details.

## Structure

- `src-tauri/` — Rust backend: tray icon, WebSocket server (`localhost:9876`), notification plugin.
- `src/` — React + Tailwind frontend rendering the approval popup.
- `wsl/` — Hook script, Node bridge client, and `install.sh` for WSL side.

## Development

```bash
pnpm install
pnpm tauri dev
```

## License

TBD
