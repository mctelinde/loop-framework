# Loop Framework — Technical Architecture

## Guiding Principles

- **Write once, run everywhere**: A shared audio engine compiled to both native and WebAssembly eliminates duplicated logic between web and desktop.
- **Web-first, desktop-optional**: The web app is the primary surface. The desktop app is a thin native shell around it, adding OS-level capabilities.
- **Standard protocols**: MIDI 1.0 and 2.0, OSC (Open Sound Control), and Ableton Link are treated as first-class citizens, not afterthoughts.
- **Minimal dependencies in the core**: The audio engine should be self-contained. UI frameworks, live coding runtimes, and plugin systems sit above it.

---

## High-Level Component Map

```
┌─────────────────────────────────────────────────────┐
│                   User Interfaces                    │
│  ┌──────────────┐  ┌────────────┐  ┌─────────────┐ │
│  │  Web App     │  │Desktop App │  │ Live Coding │ │
│  │ (Browser)    │  │  (Tauri)   │  │  (Strudel)  │ │
│  └──────┬───────┘  └─────┬──────┘  └──────┬──────┘ │
│         └────────────────┼─────────────────┘        │
└──────────────────────────┼──────────────────────────┘
                           │ Session API (TypeScript)
┌──────────────────────────┼──────────────────────────┐
│            Core Services │                          │
│  ┌──────────────────┐    │    ┌──────────────────┐  │
│  │  Audio Engine    │◄───┘    │   MIDI Subsystem │  │
│  │ (Rust / WASM)    │         │ (WebMIDI / midir)│  │
│  └──────────────────┘         └──────────────────┘  │
│  ┌──────────────────┐         ┌──────────────────┐  │
│  │  Project Store   │         │   Sync / Clock   │  │
│  │  (JSON / SQLite) │         │  (Ableton Link)  │  │
│  └──────────────────┘         └──────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Component Deep Dives

### 1. Audio Engine (Rust → WASM + Native)

**Language: Rust**

Rust is recommended for the audio engine for four reasons:
1. Deterministic memory management (no garbage collector pauses that cause audio glitches)
2. Compiles to WebAssembly for browser use via `wasm-pack`
3. Compiles to native for desktop use via the same codebase
4. Rich ecosystem: `cpal` (cross-platform audio I/O), `dasp` (digital audio signal processing), `hound` (WAV I/O)

**Responsibilities:**
- Loop playback scheduling (sample-accurate timing)
- Layer mixing (volume, pan, send levels)
- Audio format decoding (WAV, AIFF; MP3/OGG via `symphonia`)
- Beat grid quantization logic
- Effects processing (EQ, reverb, compressor — implemented as a chain)
- Exporting mixed output or individual stems

**Boundary:** The engine exposes a clean API surface (functions callable from JavaScript via WASM bindings, or from Rust/desktop directly). It has no knowledge of the UI or MIDI.

---

### 2. Web Application

**Language: TypeScript**
**Framework: Svelte or React (decision point — see note)**
**Audio bridge: Tone.js (wraps Web Audio API) OR direct WASM engine calls**

> **Framework note:** Svelte compiles to minimal vanilla JS with no runtime overhead, making it well-suited for audio apps where every CPU cycle matters. React has a larger ecosystem and more available developers. Recommendation: **Svelte** for v1; migrate if team size grows.

**Responsibilities:**
- Session UI: layer list, waveform display, transport controls
- Drag-and-drop audio file import
- BPM / time signature controls
- Per-layer mixer strip (volume, pan, mute, solo)
- MIDI mapping configuration UI
- Live coding pane (iframe or embedded Strudel instance)
- WebSocket client for collaborative sessions

**Key Web APIs used:**
- `Web Audio API` — audio scheduling and graph
- `WebMIDI API` — MIDI device access in browser (requires HTTPS + user permission)
- `File API` — audio file import
- `MediaRecorder API` — in-browser loop recording (v2)
- `WebSocket API` — real-time collaboration (v2)

---

### 3. Desktop Application (Tauri)

**Language: Rust (backend) + TypeScript/Svelte (frontend — reused from web)**

Tauri is a framework for building desktop apps using web technologies for the UI and Rust for the system backend. It is significantly lighter than Electron (no bundled Chromium) and gives direct access to system audio APIs.

**Why Tauri over Electron:**
- ~10x smaller binary size
- Direct Rust FFI to audio libraries (no Node.js native module complexity)
- Better security model (allowlist-based permissions)
- The audio engine is already Rust — sharing code is natural

**Desktop-specific capabilities:**
- System audio routing (aggregate devices, virtual cables like BlackHole/VB-Audio)
- Virtual MIDI port creation (appears as a MIDI device to other software)
- VST/AU plugin hosting via `vst3-sys` or `baseplug` (v3)
- Ableton Link integration for network beat sync
- Local file system access without browser sandbox restrictions

---

### 4. MIDI Subsystem

**Web:** `WebMIDI API` (browser-native, limited to MIDI 1.0)
**Desktop:** `midir` crate (Rust, cross-platform, MIDI 1.0 + 2.0 capable)

**Capabilities:**
- MIDI clock input: sync BPM and transport to external hardware
- MIDI clock output: drive external hardware from Loop Framework
- Note-on/off mapping: trigger loop start/stop, layer mute, scene launch
- CC (Control Change) mapping: control volume, BPM, effects parameters
- Program Change: switch between saved presets/scenes
- MIDI 2.0 (MIDI-CI): high-resolution controllers, extended expression (desktop v2)

**MIDI mapping model:** A user-configurable map of `{channel, message type, number} → {action, target layer/parameter}`. Stored as part of the project file. Can be learned (press a controller button, click the parameter to link).

---

### 5. Live Coding Integration

**The music coding language you're thinking of** is likely one of:

| Language | Host Environment | Style |
|---|---|---|
| **Sonic Pi** | Desktop (Raspberry Pi / Mac / Win) | Ruby-like; beginner-friendly; educational |
| **TidalCycles** | Desktop (Haskell + SuperCollider) | Pattern algebra; complex; powerful |
| **Strudel** | **Browser-native** | TidalCycles concepts in JavaScript; runs in `<iframe>` |
| **SuperCollider** | Desktop | Low-level synthesis language; expert-level |
| **Orca** | Browser / Desktop | Esoteric visual grid; performance-focused |

**Recommendation: Strudel for v1 web integration, Sonic Pi bridge for desktop v2**

Strudel (https://strudel.cc) is a JavaScript port of TidalCycles that runs entirely in the browser with no installation. It uses the Web Audio API and can be embedded. This makes it the natural fit for our web app.

**Integration model:**
```
┌────────────────────────────────────────────────────────┐
│  Loop Framework Web App                                │
│  ┌──────────────────────┐  ┌───────────────────────┐  │
│  │   Layer / Mixer UI   │  │  Strudel Coding Pane  │  │
│  │                      │  │  (iframe or embedded) │  │
│  └──────────┬───────────┘  └───────────┬───────────┘  │
│             │                          │               │
│             └──────────┬───────────────┘               │
│                        ▼                               │
│              Shared Session Bus                        │
│         (BPM, transport state, layer triggers)         │
└────────────────────────────────────────────────────────┘
```

Strudel patterns can route audio to named Loop Framework layers. Loop Framework's transport (play/pause/BPM) broadcasts over a shared event bus that Strudel listens to. Both surfaces stay in sync.

---

### 6. Project File Format

Projects are stored as a single `.loopfw` file (a ZIP archive containing):

```
project.json          # session metadata, BPM, layers, MIDI map
audio/                # audio files referenced by layers (or symlinked on desktop)
  loop_001.wav
  loop_002.wav
strudel.js            # live coding script (if any)
```

`project.json` schema (simplified):
```json
{
  "version": "1.0",
  "name": "My Session",
  "bpm": 120,
  "timeSignature": [4, 4],
  "layers": [
    {
      "id": "layer_001",
      "name": "Kick",
      "audioFile": "audio/loop_001.wav",
      "volume": 0.8,
      "pan": 0.0,
      "muted": false,
      "loopStart": 0.0,
      "loopEnd": 2.0
    }
  ],
  "midiMap": [
    {
      "channel": 1, "type": "note_on", "number": 36,
      "action": "toggle_mute", "target": "layer_001"
    }
  ]
}
```

---

### 7. Backend / Collaboration Service (v2)

For real-time collaborative sessions, a lightweight backend is needed.

**Recommendation: Rust + Axum (HTTP/WebSocket server)**

- Maintains authoritative session state
- Broadcasts layer changes, transport events, and live code edits via WebSocket
- Stateless design: session state lives in Redis or in-memory; no heavy database required for real-time
- Can be self-hosted or offered as a managed cloud service

---

## Technology Summary

| Layer | Technology | Language |
|---|---|---|
| Audio Engine | `cpal`, `dasp`, `symphonia` | **Rust** |
| WASM Bridge | `wasm-pack`, `wasm-bindgen` | Rust → WASM |
| Web UI | Svelte + Web Audio API + WebMIDI | **TypeScript** |
| Desktop Shell | Tauri | Rust + TypeScript |
| MIDI (desktop) | `midir` | Rust |
| Live Coding | Strudel | JavaScript (embedded) |
| Collaboration Server | Axum + WebSockets | **Rust** |
| Project Format | ZIP + JSON | — |
| Beat Sync | Ableton Link (`rusty-link`) | Rust |
