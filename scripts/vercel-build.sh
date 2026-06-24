#!/usr/bin/env bash
# scripts/vercel-build.sh
#
# Full build script for Vercel deployments.
# Installs Rust + wasm-pack (if absent), builds the WASM crate, then the
# Vite web app.  Vercel's Amazon Linux 2 image ships without Rust, so this
# script handles bootstrapping on a clean build runner.
set -euo pipefail

# ── 1. Rust / wasm-pack ───────────────────────────────────────────────────────

if ! command -v cargo &>/dev/null; then
  echo "[build] Installing Rust..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --default-toolchain stable --target wasm32-unknown-unknown
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
else
  echo "[build] Rust already present: $(rustc --version)"
  rustup target add wasm32-unknown-unknown --toolchain stable 2>/dev/null || true
fi

if ! command -v wasm-pack &>/dev/null; then
  echo "[build] Installing wasm-pack..."
  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
else
  echo "[build] wasm-pack already present: $(wasm-pack --version)"
fi

# ── 2. Build WASM ─────────────────────────────────────────────────────────────

echo "[build] Building WASM..."
wasm-pack build crates/lf-wasm --target web --out-dir ../../apps/web/public/wasm

# ── 3. Build Vite web app ────────────────────────────────────────────────────

echo "[build] Building web app..."
cd apps/web
npm run build

echo "[build] Done. Output: apps/web/dist"
