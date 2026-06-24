# Loop Framework — Product Vision

## What We're Building

Loop Framework is a **layered looping audio platform** designed to give anyone — regardless of technical skill — a frictionless path from silence to a piece of music. At its core is a session-based loop player where audio layers can be added, muted, soloed, and arranged in real time. The platform spans three interaction surfaces: a **web app** for maximum reach, a **desktop app** for deep hardware integration, and a **live coding environment** for programmers and experimental artists.

---

## The Problem

Most music-making tools present a steep learning curve. DAWs (Digital Audio Workstations) like Ableton Live or Logic Pro are enormously powerful, but overwhelming for beginners. Meanwhile, mobile loop apps lack expressiveness and don't connect well to professional gear (instruments, MIDI controllers). There is no widely-adopted, open, web-native layer-looping tool with pro-grade MIDI support and a coding interface.

---

## Core Values

| Value | What It Means |
|---|---|
| **Low barriers** | A first-time user should be able to make sound in under 60 seconds |
| **Industry compatibility** | Support professional MIDI standards, common audio formats (WAV, AIFF, MP3, OGG), and standard BPM/time-signature conventions |
| **Extensibility** | Power users can drop into code; developers can extend via a plugin API |
| **Cross-platform** | Works in a browser, works as a desktop app, works headless as a service |

---

## Target Users

### 1. The Curious Beginner
Has a musical idea but has never opened a DAW. Wants to layer sounds immediately without reading documentation.

**Needs:** Drag-and-drop audio, auto-quantize to grid, pre-loaded sample packs, visual waveform feedback.

### 2. The Performing Musician
Uses MIDI controllers on stage. Wants to trigger loops, transition layers, and change BPM live.

**Needs:** Rock-solid MIDI clock sync, low latency, MIDI mapping for all controls, DAW-style transport controls.

### 3. The Live Coder
Writes code to generate and manipulate patterns in real time, often in public.

**Needs:** A live coding environment integrated into the same session as the audio layers, so code and loops coexist and interact.

### 4. The Developer / Integrator
Wants to embed Loop Framework into another application or automate it.

**Needs:** A well-documented API, WebSocket or IPC interface, plugin system.

---

## Feature Overview

### Must-Have (v1)
- [ ] Layer-based loop player (add, remove, mute, solo tracks)
- [ ] Global BPM and time signature control
- [ ] Loop quantization (loops snap to beat grid)
- [ ] Audio import (WAV, MP3, OGG, AIFF)
- [ ] Per-layer volume, pan, and basic EQ
- [ ] Waveform visualization
- [ ] Save/load sessions (JSON-based project format)
- [ ] MIDI clock input/output
- [ ] MIDI note and CC mapping for triggers and controls

### Should-Have (v2)
- [ ] In-browser audio recording (capture a loop from mic/instrument)
- [ ] Live coding pane with Strudel integration (see Architecture)
- [ ] Desktop app wrapper with system audio routing
- [ ] Export to stems (individual WAV files per layer)
- [ ] Collaborative session sharing (same session, multiple clients)

### Could-Have (v3+)
- [ ] VST/AU plugin hosting (desktop only)
- [ ] Generative pattern engine (AI-assisted loop suggestions)
- [ ] Mobile-optimized touch interface
- [ ] DAW sync via Ableton Link protocol

---

## Open Questions (Decisions Needed)

1. **Live recording**: Should users be able to record loops live within the app (like Loopy HD), or is the v1 scope import-only?
2. **Collaboration model**: Real-time collaborative sessions (like Google Docs for music) or shared-file async? Real-time implies significant backend infrastructure.
3. **Sample library**: Should the platform ship with a built-in royalty-free sample library, or start with import-only?
4. **Naming**: "Loop Framework" is a working title. A product name will matter for branding.
5. **Monetization**: Open source with hosted SaaS? Freemium? Matters for infrastructure decisions.

---

## Inspirations & Reference Products

| Product | What It Does Well | What We'd Do Differently |
|---|---|---|
| **Ableton Live (Session View)** | Industry-standard loop launching, MIDI integration | Too complex for beginners; not web-native |
| **Loopy HD** (iOS) | Live loop recording, layer stacking | Mobile only, no MIDI depth, no coding interface |
| **Soundtrap** (Spotify) | Web-based collaborative DAW | Too DAW-like; we want loops-first simplicity |
| **Strudel** | Live coding of music patterns in browser | No traditional audio layer view alongside it |
| **Ableton Link** | Beat-sync across devices over network | Protocol we want to support, not build from scratch |
