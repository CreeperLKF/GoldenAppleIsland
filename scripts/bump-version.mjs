#!/usr/bin/env node
// Bumps version across package.json, src-tauri/Cargo.toml, and
// src-tauri/tauri.conf.json. Keeps the three files in lock-step so a
// single `git tag v<version>` is enough to drive a release.
//
// Usage: node scripts/bump-version.mjs <patch|minor|major|x.y.z>

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const arg = process.argv[2];
if (!arg) {
  console.error("usage: bump-version.mjs <patch|minor|major|x.y.z>");
  process.exit(1);
}

const pkgPath = join(repoRoot, "package.json");
const cargoPath = join(repoRoot, "src-tauri", "Cargo.toml");
const tauriPath = join(repoRoot, "src-tauri", "tauri.conf.json");

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = pkg.version;

const next = computeNext(current, arg);
if (!/^\d+\.\d+\.\d+$/.test(next)) {
  console.error(`error: computed version "${next}" is not semver`);
  process.exit(1);
}

console.log(`[bump-version] ${current} -> ${next}`);

// package.json
pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

// Cargo.toml — only the first `version = "..."` inside [package]
const cargo = readFileSync(cargoPath, "utf8");
const cargoUpdated = cargo.replace(
  /(\[package\][\s\S]*?version\s*=\s*)"[^"]+"/,
  `$1"${next}"`,
);
if (cargo === cargoUpdated) {
  console.error("error: could not locate [package] version in Cargo.toml");
  process.exit(1);
}
writeFileSync(cargoPath, cargoUpdated);

// tauri.conf.json
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
tauri.version = next;
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n");

console.log("[bump-version] updated package.json, Cargo.toml, tauri.conf.json");
console.log(`[bump-version] next steps:\n  git add -A\n  git commit -m "chore: release v${next}"\n  git tag v${next}\n  git push --follow-tags`);

function computeNext(current, spec) {
  if (/^\d+\.\d+\.\d+$/.test(spec)) return spec;
  const [maj, min, pat] = current.split(".").map(Number);
  if (spec === "patch") return `${maj}.${min}.${pat + 1}`;
  if (spec === "minor") return `${maj}.${min + 1}.0`;
  if (spec === "major") return `${maj + 1}.0.0`;
  console.error(`error: unknown bump "${spec}"`);
  process.exit(1);
}
