# Loop Framework — Development Roadmap

## Overview

Development is organized into four phases. Each phase delivers a usable, shippable product — not just internal infrastructure. The goal is to have something real to play with as early as possible, then deepen capabilities incrementally.

```
Phase 1 ──────► Phase 2 ──────► Phase 3 ──────► Phase 4
Web MVP         MIDI + Desktop  Live Coding      Ecosystem
(~3 months)     (~3 months)     (~2 months)      (ongoing)
```

---

## Phase 1: Web MVP — "Make Sound Fast"

**Goal:** A browser-based loop player anyone can use in 60 seconds, no install, no account.

**Deliverables:**

### 1.1 Audio Engine (Rust/WASM)
- [ ] Project scaffolding: Rust workspace, `wasm-pack` build pipeline
- [ ] Basic loop playback: load an audio buffer, loop it at a given BPM
- [ ] Multi-layer mixer: N concurrent loops, per-layer volume + pan
- [ ] Beat-grid quantization: loops snap to nearest beat on start/stop
- [ ] WASM bindings: JavaScript-callable API for all engine functions

### 1.2 Web Application (TypeScript + Svelte)
- [ ] Project scaffolding: Vite + Svelte + TypeScript
- [ ] Transport bar: Play / Pause / Stop, BPM knob, time signature selector
- [ ] Layer list: add, remove, rename, reorder layers
- [ ] Per-layer strip: waveform thumbnail, volume fader, pan knob, mute, solo
- [ ] Audio file import: drag-and-drop or file picker (WAV, MP3, OGG)
- [ ] Loop region selection: set loop start/end points on waveform
- [ ] Session save/load: export and import `.loopfw` project file

### 1.3 Infrastructure
- [ ] Static hosting pipeline (GitHub Actions → Netlify or Vercel)
- [ ] Basic CI: build + lint on PR

**Definition of Done:** A user can open the app, drop in audio files, build a layered loop, and save/reopen their session.

---

## Phase 2: MIDI + Desktop — "Connect Your Gear"

**Goal:** Musicians can use hardware MIDI controllers and have a native desktop experience with lower latency.

**Deliverables:**

### 2.1 MIDI Integration (Web)
- [ ] WebMIDI device discovery and listing in UI
- [ ] MIDI clock input: sync BPM and transport to incoming clock
- [ ] MIDI clock output: send clock signal to external devices
- [ ] MIDI learn mode: press a controller button/knob, click a parameter to link
- [ ] MIDI mapping persistence: save/load maps in project file
- [ ] Trigger map: note-on → toggle mute, launch layer, tap tempo
- [ ] CC map: continuous controller → volume, pan, BPM

### 2.2 Desktop App (Tauri)
- [ ] Tauri project scaffolding wrapping the web app
- [ ] Native MIDI via `midir`: full device access without browser HTTPS/permissions friction
- [ ] Native audio I/O via `cpal`: lower latency than Web Audio API
- [ ] Local file system access: load audio files from anywhere without re-import
- [ ] System tray integration: run in background, accessible from tray
- [ ] Auto-updater: Tauri built-in update mechanism
- [ ] Signed builds for macOS, Windows, Linux

### 2.3 Audio Improvements
- [ ] Audio latency compensation: per-layer offset to account for hardware delay
- [ ] Virtual MIDI port (desktop): Loop Framework appears as a MIDI device to DAWs
- [ ] Ableton Link integration (`rusty-link`): sync with Ableton, Reason, other Link-enabled apps

**Definition of Done:** A performing musician can control Loop Framework entirely from a MIDI controller on stage, with the desktop app running as their primary interface.

---

## Phase 3: Live Coding — "Code Your Music"

**Goal:** Integrate a live coding environment that shares a session with the layer interface, enabling hybrid workflow between traditional loop launching and code-driven pattern generation.

**Deliverables:**

### 3.1 Strudel Integration (Web)
- [ ] Embed Strudel editor pane alongside the layer UI
- [ ] Shared event bus: Loop Framework BPM/transport events dispatched to Strudel
- [ ] Layer routing: Strudel patterns can target named Loop Framework layers by ID
- [ ] Code persistence: save live coding script in `.loopfw` project file
- [ ] Evaluate-on-save shortcut (Ctrl+Enter standard)
- [ ] Error display: surface Strudel runtime errors in UI

### 3.2 Custom Loop Framework API for Strudel
Define a small set of helper functions usable inside Strudel scripts:
```javascript
// Example API surface exposed to Strudel environment
lf.layer("Kick").mute()
lf.layer("Bass").volume(0.7)
lf.bpm(140)
lf.trigger("layer_003")   // start a layer on next beat
```

### 3.3 Sonic Pi Bridge (Desktop, optional)
- [ ] OSC (Open Sound Control) bridge: Loop Framework listens for OSC messages on a configurable port
- [ ] Sonic Pi sends OSC to Loop Framework to trigger layers, change BPM
- [ ] Document OSC message schema for third-party integration (any OSC-capable tool works: Max/MSP, Pure Data, TouchOSC)

**Definition of Done:** A live coder can write Strudel patterns that drive Loop Framework layers in real time, while a non-coder can simultaneously manipulate the same session visually.

---

## Phase 4: Ecosystem — "Build On It"

**Goal:** Make Loop Framework a platform others can extend.

**Deliverables:**

### 4.1 Plugin System
- [ ] Define a plugin API: effects processors, MIDI transformers, UI panels
- [ ] Plugin registry / discovery (local folder scan on desktop, npm-based on web)
- [ ] Example plugins: tap tempo, chord trigger pad, arpeggiator

### 4.2 Collaboration (v2)
- [ ] Backend service (Rust + Axum) for real-time session sharing
- [ ] WebSocket-based session sync: layer changes, mutes, BPM broadcast to all clients
- [ ] Presence indicators: see who's in the session
- [ ] Optional: live coding co-editing (similar to VS Code Live Share)

### 4.3 Export & Integration
- [ ] Stem export: render individual layers to WAV files
- [ ] Full mix export: bounce session to stereo WAV/MP3
- [ ] DAW project export: generate an Ableton Live Set (`.als`) or Logic Pro project from session
- [ ] Embed API: `<loop-framework>` web component embeddable in any webpage

### 4.4 Mobile
- [ ] Responsive web UI: touch-optimized layer strips, swipe gestures
- [ ] PWA (Progressive Web App): install to home screen, offline support

---

## Technical Milestones & Decision Points

| Milestone | Decision Required | Recommendation |
|---|---|---|
| Before Phase 1 | UI framework: Svelte vs React | Svelte |
| Before Phase 1 | Audio bridge: Tone.js vs raw WASM engine | Raw WASM — more control |
| Before Phase 2 | Desktop framework: Tauri vs Electron | Tauri |
| Before Phase 3 | Live coding: Strudel only vs multi-language | Strudel first; add OSC bridge for others |
| Before Phase 4 | Collaboration infra: managed cloud vs self-hosted | Self-hosted first; offer managed tier |
| Before Phase 4 | Monetization model | Open source + optional managed hosting |

---

## Suggested Team Structure (if scaling up)

| Role | Phase Involvement |
|---|---|
| Rust Audio Engineer | Phases 1–3 (engine, WASM, MIDI, Tauri backend) |
| TypeScript / Svelte Developer | Phases 1–4 (web UI) |
| DevOps / CI | Phase 1 (pipeline), Phase 4 (backend infrastructure) |
| UX Designer | Phase 1 (critical: low barrier entry), Phase 3 (coder/non-coder hybrid UI) |
| Music Domain Expert / Tester | All phases (validate against real musician workflows) |

---

## Key External Dependencies

| Dependency | Purpose | License |
|---|---|---|
| `cpal` | Cross-platform audio I/O | Apache 2.0 |
| `dasp` | Digital audio signal processing | Apache 2.0 / MIT |
| `symphonia` | Audio format decoding (MP3, OGG, FLAC) | MPL 2.0 |
| `midir` | MIDI I/O on desktop | MIT |
| `wasm-pack` | Rust → WebAssembly build tool | Apache 2.0 / MIT |
| `rusty-link` | Ableton Link protocol | GPL 2.0 ⚠️ |
| Strudel | Live coding environment | AGPL ⚠️ |
| Tauri | Desktop app framework | MIT / Apache 2.0 |
| Svelte | Web UI framework | MIT |
| Vite | Web build tool | MIT |

> ⚠️ **License note:** `rusty-link` (GPL 2.0) and Strudel (AGPL) have copyleft licenses. If Loop Framework is intended to be commercial/closed-source, these integrations will need to be isolated (e.g., Strudel loaded as a separate iframe/process; Link used only in the open-source desktop binary). Legal review recommended before Phase 2/3 if commercialization is planned.

---

## Repository Structure (Proposed)

```
loop-framework/
├── crates/
│   ├── lf-engine/          # Core Rust audio engine (no_std friendly)
│   ├── lf-wasm/            # WASM bindings (wasm-pack crate)
│   ├── lf-desktop/         # Tauri application (Rust backend)
│   └── lf-server/          # Collaboration server (Axum, Phase 4)
├── apps/
│   ├── web/                # Svelte web application
│   └── desktop/            # Tauri frontend (shared with web or separate build)
├── packages/
│   └── lf-js-sdk/          # TypeScript SDK / web component (Phase 4)
├── docs/
│   ├── vision.md           # This file
│   ├── architecture.md
│   └── roadmap.md
└── Cargo.toml              # Rust workspace root
```
