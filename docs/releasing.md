# Releasing

Versions across `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` stay in lock-step. The release script bumps all three; CI does the rest.

## Cutting a release

```bash
npm run release patch   # or: minor / major / 1.2.3
git add -A
git commit -m "chore: release v$(node -p "require('./package.json').version")"
git tag v$(node -p "require('./package.json').version")
git push --follow-tags
```

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which on a Windows runner builds the NSIS installer (current-user) plus the WSL tarball and attaches them to a new GitHub Release.

## Local build

For testing the build pipeline without cutting a release:

```bash
npm install
npm run tauri:build     # produces NSIS setup.exe under src-tauri/target/release/bundle/nsis/
npm run bundle:wsl      # produces dist-wsl/golden-apple-island-wsl-<version>.tar.gz
```

## NPM scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server only |
| `npm run tauri:dev` | Full Tauri dev (Vite + Rust) |
| `npm run tauri:build` | Production NSIS installer (current-user) |
| `npm run build` | `tsc` + Vite frontend build only |
| `npm run check` | Typecheck + `cargo check` (no build) |
| `npm run bundle:wsl` | Tarball of `wsl/` for standalone distribution |
| `npm run release <bump>` | Bump version in all three manifests |
| `npm run clean` | Wipe `dist/`, `src-tauri/target/`, caches |
