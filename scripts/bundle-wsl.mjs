#!/usr/bin/env node
// Packages the wsl/ directory as a tarball for standalone distribution.
// Usage: node scripts/bundle-wsl.mjs [output-dir]
// Requires `tar` on PATH (present on Windows 10+ and every Unix).

import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const version = pkg.version;

const outDirArg = process.argv[2] ?? "dist-wsl";
const outDir = resolve(repoRoot, outDirArg);
const outFileName = `golden-apple-island-wsl-${version}.tar.gz`;
const outFileRel = `${outDirArg.replace(/\\/g, "/")}/${outFileName}`;

if (!existsSync(join(repoRoot, "wsl"))) {
  console.error("error: wsl/ directory not found at", repoRoot);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

console.log(`[bundle-wsl] creating ${outFileRel}`);
// Run tar with cwd=repoRoot and forward-slash relative paths so we work
// with both GNU tar (msys) — which parses "D:" as a remote host — and
// BSD tar (Windows native tar.exe).
execFileSync(
  "tar",
  ["-czf", outFileRel, "wsl"],
  { stdio: "inherit", cwd: repoRoot },
);
console.log("[bundle-wsl] done");
