# Loop Framework

A **browser-based layered looping audio platform** — drop in audio files, stack loops, mix in real time, and save your session. No install, no account required.

Built on a Rust/WebAssembly audio engine running directly in an AudioWorklet for sample-accurate, jitter-free playback.

> **Phase 1 (Web MVP) — complete.** See the [roadmap](roadmap.md) for what's coming next.

---

## Features

- 🎵 **Layer-based loop player** — add, remove, rename, and reorder audio layers
- ▶️ **Transport controls** — play/pause/stop, BPM (40–240), tap tempo, time signature (4/4, 3/4, 6/8)
- 🎚️ **Per-layer mixer** — volume fader, pan knob, mute, solo, loop region trim handles
- 📊 **Waveform display** — pre-rendered peak canvas with HiDPI support
- 📂 **Flexible import** — drag-and-drop anywhere on the page, per-row drop, or file picker (WAV · MP3 · OGG)
- 💾 **Session save/load** — exports a self-contained `.loopfw` file (ZIP with audio + metadata)
- 🔄 **Auto-save** — project metadata written to `localStorage` as a crash-recovery fallback

---

## Getting Started

### Requirements

- [Rust](https://rustup.rs) (stable, with `wasm32-unknown-unknown` target)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
- [Node.js](https://nodejs.org) 18+
- A Chromium-based browser (Chrome / Edge) — required for AudioWorklet ES module support

### Local development

```bash
# 1. Build the WASM engine
wasm-pack build crates/lf-wasm --target web --out-dir ../../apps/web/public/wasm

# 2. Install JS dependencies
cd apps/web && npm install

# 3. Start the dev server
npm run dev
```

Open **http://localhost:5173** in Chrome or Edge.

### Production build

```bash
cd apps/web && npm run build
# Output: apps/web/dist/
```

---

## Project Structure

```
loop-framework/
├── crates/
│   ├── lf-engine/       # Core Rust audio engine (decode, mix, quantize)
│   └── lf-wasm/         # wasm-bindgen bindings for the browser
├── apps/
│   └── web/             # Svelte 5 web application
│       ├── public/
│       │   ├── lf-engine-processor.js   # AudioWorkletProcessor
│       │   └── wasm/                    # wasm-pack output (gitignored, built in CI)
│       └── src/
│           ├── lib/
│           │   ├── engine.ts            # Main-thread ↔ worklet proxy
│           │   ├── engineStore.ts       # Svelte store wrapping EngineController
│           │   ├── layerStore.ts        # Layer state management
│           │   ├── transportStore.ts    # BPM, time sig, transport state
│           │   └── session.ts           # Save/load .loopfw, auto-save
│           └── components/
│               ├── Transport.svelte
│               ├── LayerList.svelte
│               ├── LayerStrip.svelte
│               ├── WaveformCanvas.svelte
│               ├── Knob.svelte
│               └── SessionControls.svelte
├── scripts/
│   └── vercel-build.sh  # Full build script for Vercel (installs Rust + wasm-pack)
├── .github/workflows/
│   └── ci.yml           # cargo check/test + wasm-pack + Vite build on every PR
├── vercel.json          # Vercel deployment config (build command + COOP/COEP headers)
├── architecture.md
├── roadmap.md
└── vision.md
```

---

## Architecture

The audio engine runs entirely on the **AudioWorklet thread** — never the main thread — to prevent UI activity from causing audio dropouts.

```
Main thread                     AudioWorklet thread
──────────────────────────────  ──────────────────────────────
EngineController (engine.ts)    lf-engine-processor.js
  │                               │
  │  postMessage(cmd)  ──────►   _dispatch(cmd)
  │                               │
  │  postMessage(res)  ◄──────   LoopEngine (Rust/WASM)
  │                               └── process() → 128-frame quanta
  └── Svelte stores (reactive UI)
```

Key design choices:
- **Zero-copy audio transfer** — `ArrayBuffer`s are transferred (not copied) to the worklet via `postMessage` with `transfer`
- **Pre-ready command queue** — commands sent before WASM initializes are drained automatically on `'ready'`
- **Dynamic WASM import** — avoids static-import reliability issues in AudioWorklet ES module scope

---

## Deployment

The app deploys to [Vercel](https://vercel.com) via `vercel.json`. Connect your fork on the Vercel dashboard — it handles the rest on every push to `main`.

The build process on Vercel:
1. Install Rust + `wasm32-unknown-unknown` target
2. Install `wasm-pack`
3. Build WASM crate → `apps/web/public/wasm/`
4. Run `vite build` → `apps/web/dist/`

**Required response headers** (set in `vercel.json` and the Vite dev server):
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
These are needed for AudioWorklet ES module loading.

---

## Roadmap

| Phase | Theme | Status |
|---|---|---|
| **1 — Web MVP** | Browser loop player, Rust/WASM engine | ✅ Complete |
| **2 — MIDI + Desktop** | WebMIDI, Tauri desktop app, Ableton Link | Planned |
| **3 — Live Coding** | Strudel integration, OSC bridge | Planned |
| **4 — Ecosystem** | Plugin API, collaboration, stem export | Planned |

See [roadmap.md](roadmap.md) for full details.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Audio engine | Rust + [symphonia](https://github.com/pdeljanov/Symphonia) + [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen) |
| Audio scheduling | Web Audio API — `AudioWorkletProcessor` |
| Web UI | [Svelte 5](https://svelte.dev) + TypeScript + [Vite](https://vitejs.dev) |
| Session format | ZIP (via [fflate](https://github.com/101arrowz/fflate)) + JSON |
| CI | GitHub Actions |
| Hosting | Vercel |

---

## License

MIT
