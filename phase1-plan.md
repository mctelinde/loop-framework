# Loop Framework — Phase 1 Implementation Plan

## Status: ✅ Complete

This document captures the agreed plan for Phase 1 (Web MVP). See `roadmap.md` for the full
multi-phase roadmap and `architecture.md` for system-level design.

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Audio scheduling | `AudioWorklet` (WASM writes directly to worklet) | Maximum fidelity; avoids JS-thread scheduling jitter |
| Waveform thumbnails | Pre-rendered at import time | Instant visual feedback; revisit on-the-fly rendering post-MVP |
| Static hosting | Vercel | Simple CI integration, good DX |
| Phase 1 starting point | Workstream A (Rust audio engine) first | Solid engine foundation before building UI against it |

---

## Workstream A: Rust Audio Engine

**Crates:** `crates/lf-engine` (core, `no_std`-friendly) · `crates/lf-wasm` (WASM bindings)

### A1 — Workspace Scaffolding ✅
- [x] Initialize Cargo workspace (`Cargo.toml` at repo root)
- [x] Create `crates/lf-engine` crate (library, pure Rust, no platform I/O)
- [x] Create `crates/lf-wasm` crate (wasm-pack target, depends on `lf-engine`)
- [x] Configure `wasm-pack` build, output to `apps/web/public/wasm/`
- [x] Add `wasm-bindgen`, `wasm-bindgen-futures`, `js-sys`, `web-sys` dependencies

### A2 — Core Playback ✅
- [x] Audio buffer loading: WAV via `hound`; MP3/OGG via `symphonia`
- [x] Loop playback: schedule a buffer to repeat at sample-accurate intervals given BPM
- [x] Beat-grid quantization: defer start/stop to nearest beat boundary

### A3 — Mixer ✅
- [x] `N` concurrent layers, each with independent volume (0.0–1.0) and pan (−1.0–1.0)
- [x] Master volume control
- [x] Per-layer mute and solo (solo: mute all others)

### A4 — AudioWorklet Integration ✅
- [x] Implement a `wasm-bindgen` entry point callable from an `AudioWorkletProcessor`
- [x] Engine writes interleaved float32 samples directly into the worklet's output buffer
- [x] JS-side `AudioWorkletProcessor` glue code (loaded by the web app)

### A5 — WASM JavaScript API ✅ ✅
Full TypeScript-callable API surface (via `wasm-bindgen`):

```typescript
createEngine(sampleRate: number): EngineHandle
addLayer(audioData: Uint8Array, name: string): LayerId
removeLayer(layerId: LayerId): void
setLayerVolume(layerId: LayerId, volume: number): void   // 0.0–1.0
setLayerPan(layerId: LayerId, pan: number): void          // −1.0–1.0
muteLayer(layerId: LayerId, muted: boolean): void
soloLayer(layerId: LayerId, soloed: boolean): void
setLoopRegion(layerId: LayerId, startSec: number, endSec: number): void
setBpm(bpm: number): void
play(): void
pause(): void
stop(): void
```

---

## Workstream B: Web Application

**Location:** `apps/web` · **Stack:** Vite + Svelte + TypeScript

> **Dependency:** Workstream B connects to the engine at Step B1 (WASM loader). Steps B1–B3
> can use a mock/stub engine until A5 is complete.

### B1 — Project Scaffolding ✅
- [x] `npm create vite` with Svelte + TypeScript template
- [x] WASM loader: instantiate engine, expose as a Svelte store
- [x] Basic single-page layout shell

### B2 — Transport Bar ✅
- [x] Play / Pause / Stop buttons wired to engine
- [x] BPM knob (40–240 BPM, default 120) with tap-tempo button
- [x] Time signature selector (4/4, 3/4, 6/8 for MVP)

### B3 — Layer List ✅
- [x] Add layer (file picker or drop target)
- [x] Remove and rename layers
- [x] Drag-to-reorder layers

### B4 — Per-Layer Mixer Strip ✅
- [x] Waveform thumbnail (Canvas; pre-rendered at import from decoded buffer)
- [x] Volume fader + pan knob
- [x] Mute and Solo buttons
- [x] Loop region selector (drag handles on waveform)

### B5 — Audio File Import ✅
- [x] Drag-and-drop onto layer list or individual layer rows
- [x] File picker fallback
- [x] Accepted formats: WAV, MP3, OGG (decoded by WASM engine)

### B6 — Session Save / Load ✅
- [x] Export: bundle `project.json` + audio files into a `.loopfw` ZIP
- [x] Import: unzip, parse JSON, reload layers and settings
- [x] Auto-save to `localStorage` as crash-recovery fallback

---

## Workstream C: Infrastructure

### C1 — Repository Structure ✅
- [x] Establish monorepo layout: `crates/`, `apps/`, `scripts/`, `docs/`
- [x] Root `Cargo.toml` workspace and root `.gitignore`

### C2 — CI/CD Pipeline (GitHub Actions → Vercel) ✅
- [x] On every PR: `cargo check`, `cargo test`, `wasm-pack build`, `npm run build`
- [x] `vercel.json`: custom build script (`scripts/vercel-build.sh`) installs Rust + wasm-pack, builds WASM, then Vite
- [x] COOP/COEP headers set in `vercel.json` for production (mirrors dev server config)

---

## Build Order

```
C1 (repo structure)
  ├── A1 (Rust workspace) → A2 → A3 → A4 → A5
  └── B1 (Vite/Svelte, stub engine) → B2 → B3+B4 (parallel) → B5 → B6
C2 (CI) — set up after A1 + B1 scaffolding exist
```

A5 (WASM bindings complete) is the integration point: swap the B1 stub for the real engine.

---

## Definition of Done (Phase 1)

A user can open the app in a browser, drop in audio files, build a layered loop, and save/reopen
their session — with no install and no account required.
