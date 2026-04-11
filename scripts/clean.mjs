#!/usr/bin/env node
// Wipes local build artifacts.
// Usage: node scripts/clean.mjs

import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const targets = [
  "dist",
  "dist-wsl",
  "src-tauri/target",
  "src-tauri/gen/schemas",
  ".vite",
  "tsconfig.tsbuildinfo",
  "tsconfig.node.tsbuildinfo",
];

for (const t of targets) {
  const p = join(repoRoot, t);
  try {
    rmSync(p, { recursive: true, force: true });
    console.log(`[clean] removed ${t}`);
  } catch (e) {
    console.warn(`[clean] skipped ${t}: ${e instanceof Error ? e.message : e}`);
  }
}
