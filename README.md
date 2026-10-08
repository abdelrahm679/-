# ORION · Unified Solar System Platform

A full-fidelity 3D solar system simulation with a unified state machine spanning a macroscopic Keplerian map, a pressurized flight-deck (FPP) cockpit, and a 600 m procedural planetary-surface colony sandbox — all sharing one time-warp clock, one renderer, and one leak-free resource lifecycle.

Inspired by TheSkyLive's 3D Solar System viewer, elevated with precision orbital physics, glassmorphic UI, live NASA data, and an LLM-assisted generative suite (with automatic heuristic fallback).

---

## Get it running

```
# local dev
cd D:\projects\solar-system-platform
node server.mjs 8321
# → open 
```

---

## Deploy to Vercel

The project is a **static SPA** — `server.mjs` is only a local dev server. On Vercel the app is served from a static `dist/` output; there is no Node "server" process at runtime.

1. **`npm run build`** (`build-vercel.mjs`) assembles a self-contained `dist/` containing `index.html`, `css/`, `js/`, and the vendored `node_modules/three` tree that the import map references. Root entry lives at **`dist/index.html`**.
2. **`vercel.json`** points Vercel at that output:
 - `"outputDirectory": "dist"` → serves `/` from `dist/index.html` (this is what was missing before → the `404 /index.html`).
 - `"buildCommand": "npm run build"` → runs the assembly script (after npm install, so three.js is present).
 - `"rewrites"` → deep-link fallback to `/index.html` for any non-asset route.
 - `"cleanUrls": true` + caching headers for js/ and node_modules/.
3. **`package.json`** now exposes `start` (dev), `dev`, and `build` (Vercel build hook).
4. **Deploy** (Vercel auto-detects `vercel.json`; no framework preset needed):
 ```
 vercel # preview
 vercel --prod # production
 ```
 Or connect the Git repo in the Vercel dashboard (Framework Preset: **Other**, Build: `npm run build`, Output: `dist`).

### Optional serverless function (API routing)

| Route | Purpose | How to enable |
|-------|---------|---------------|
| `/api/neows` (from `api/neows.mjs`) | Proxies NASA NeoWs so the API key stays server-side instead of in the client bundle | Set env var `NASA_API_KEY` in Vercel → **Settings → Environment Variables**. Client-side, tick **Setup → "Serve NeoWs via Vercel Function"**, then save. The client uses `/api/neows` when served over https (production); over http (local dev) it calls api.nasa.gov directly. |

- The `What-If` narrative / notebook LLM is **not** deployable to Vercel (it targets a local Ollama instance); on the deployed site those features automatically use their deterministic heuristic fallback (this never fails — it's the designed degradation path).
- `functions: { "api/neows.mjs": { "runtime": "nodejs20.x" } }` in vercel.json pins the function runtime.

### Directory layout (what Vercel sees)
```
├── vercel.json # outputDirectory + rewrites + functions mapping
├── package.json # start / dev / build scripts
├── api/neows.mjs # optional serverless NASA proxy
├── index.html # source root entry (copied to dist/index.html)
├── css/ js/ # source (copied to dist/)
├── build-vercel.mjs # the actual `npm run build` script
├── dist/ # build output Vercel serves (generated)
└── node_modules/ # install-time only; three.js build copied into dist
```


---

## Architecture

### The 3-mode state machine (`js/main.js`)
```
 ┌──────────┐ fly-to / select
 fly-to ──────▶│ ORRERY │◀────────────────────┐
 (map) └────┬─────┘ │
 │ [Enter FPP Cockpit] │
 ▼ │ [Return to Orrery]
 ┌───────────────┐
 │ FPP (visor) │
 └───────┬───────┘
 │ [Descend to Surface]
 ▼
 ┌───────────────────┐
 │ SURFACE (EVA) │ ──▶ colony simulation
 └───────────────────┘
```

Every mode owns a `DisposalScope` (`js/core/resources.js`). Leaving a mode disposes its entire GPU tree (geometries, materials, textures), clears the procedural-texture cache, and unbinds every listener / RAF / interval it registered. Round-tripping modes is **verified flat** in GPU memory (see *Verification*).

### Module map
| Path | Responsibility |
|------|----------------|
| `js/core/kepler.js` | JPL "Approximate Positions of the Major Planets" — Kepler's equation (Newton–Raphson), full element sets with rates, orbit sampling, ecliptic→three.js remap |
| `js/core/astro-data.js` | JPL + NASA planetary elements & physical parameters for Sun, 8 planets, 2 dwarfs, 18 moons |
| `js/core/scale.js` | **Visual vs True scale**: compressed monotonic orbits (visual) vs exact 1 unit = 1000 km (true) |
| `js/core/timewarp.js` | Shared 1×→1,000,000× clock syncing orbits + FPP + surface sols |
| `js/core/textures.js` | Deterministic procedural planet surfaces / sun / rings / glow / visor FX (fully offline) |
| `js/core/resources.js` | `DisposalScope` + recursive GPU-tree disposal |
| `js/modes/orrery.js` | 3D map: glowing orbits, axial tilts, equatorial grid, asteroid + Kuiper belts, constellations, CSS2D labels, cinematic fly-to, raycast picking, layer toggles |
| `js/modes/fpp.js` | Pressurized flight deck: orbital drift, axial-tilt planet surface, visor condensation + micro-scratches, biometric HUD |
| `js/modes/surface.js` | 600 m procedural terrain EVA, WASD movement scaled by local gravity, module placement |
| `js/features/colony.js` | Full colony economy: power grid (solar/fission/storage), O₂/H₂O/food, crew growth, waste, per-body climate (light/temp/radiation/volatiles), unlock progression, crisis resolution |
| `js/features/physics.js` | Cataclysm engine (Collins/Melosh/Marcus pi-scaling, seismic, overpressure, thermal, ejecta, binding fraction) |
| `js/features/cataclysm.js` | What-If panel: LLM narrative + GLSL-style shockwave preview + damage readout |
| `js/services/nasa.js` | NASA NeoWs near-Earth object radar (live) |
| `js/services/llm.js` | Ollama bridge with deterministic heuristic fallback (never hard-fails) |
| `js/ui/*` | Telemetry drawer, NEO radar, cataclysm panel, field notebook, settings, colony HUD, toast |

---

## Features

### 1. Core 3D + astronomical controls
- **Keplerian precision** — JPL element sets solved via Kepler's equation; true conic orbit paths (eccentricity + inclination included).
- **Axial tilts & equatorial planes** — each body's spin/tilt modeled (Saturn rolled 26.7°, Uranus 97.8°, etc.).
- **Scale mode switcher** — *True* (exact sizes/distances: Earth = 1.50e8 km) vs *Visual* (compressed for navigation).
- **Layer HUD toggles** — Orbits, Labels, Ecliptic grid, Asteroid Belt, Kuiper Belt, Constellations, Atmospheres, Moons, NEO markers, Trails.
- **Cinematic fly-to** — smooth interpolated camera glide with quaternion slerp framing any body.

### 2. Celestial Inspector (glassmorphic telemetry drawer)
Click any body → slide-in drawer with live, astronomically-accurate readouts:
- Distance from Sun & Earth (AU + km), computed from true Keplerian positions.
- Orbital speed (vis-viva), eccentricity, inclination, longitude, true anomaly.
- Surface gravity, pressure, temperature range, moon count, atmosphere.
- **JPL J2000 elements** (a, e, i, Ω, ϖ, L).
- Actions: **[Enter FPP Cockpit]**, **[Descend to Surface]**, **[Lock/Track]**, **[What-If Impact]**.

### 3. UI/UX
- Deep-space dark theme, backdrop-blur glassmorphism, neon cyan accents, zero clutter.
- Mobile-adaptive: floating bottom bar (time warp + camera presets), collapsible side panels, pinch/touch orbit controls.
- Time-warp scrubber 1× → 1,000,000× synced across all modes + Earth UTC / Julian Date / local Sols.

### 4. Integrated modes
- **FPP Cockpit** — macroscopic map → pressurized visor with dynamic condensation, micro-scratches, breath fog, and a biometric HUD (suit, O₂, pressure, gravity, ΔV, attitude).
- **Surface Colony Simulation** — descend to a 600 m procedural sandbox on *any* body; build habitats, greenhouses, fission plants, solar arrays, ice drills, storage, airlocks. A live life-support economy tracks power, O₂, water, food, crew, waste, and radiation, with crises (brownouts, crop failure, crew loss) and body-specific climate/gravity. Time-warp drives the local Sol clock and colony production.
- **Live NASA NeoWs** — 3D radar of real near-Earth asteroids (7-day feed), hazard flags, closest-approach, overlay option.
- **What-If Cataclysm** — generative kinetic-impact engine: pi-scaling crater, seismic, thermal, overpressure, ejecta, binding-fraction damage readout + shockwave visual + LLM narrative.
- **Explorer's Field Notebook** — log observations, get AI scientific evaluation (local LLM), rubric fallback when offline.

---

## Verification (all run against the live build)

Performed in a headless Chromium via the WebGL renderer's own stats:

| Check | Result |
|-------|--------|
| Clean boot, no errors | ✔ curtain clears, mode = Orrery |
| Orrery scene | 29 bodies, 49 draw calls, 43,642 tris |
| Keplerian accuracy (Mercury) | 0.4484 AU from Sun, 40.8 km/s, e 0.2056 — correct for date |
| Jupiter distance (telemetry) | 5.307 AU from Sun / 5.823 AU from Earth — correct for Oct 2026 |
| **True Scale** | Earth 149,676 units (≈1 AU), Jupiter/earth ratio **5.30** (real 5.20) |
| Visual Scale | Monotonic compressed (Earth 40, Jupiter 80) |
| Mode transitions | Orrery↔FPP↔Surface all clean, overlays toggle correctly |
| **Memory-leak test** | 10 full cycles + 80 selections + scale toggles: GPU **flat 2 geoms / 11 textures** (start=end) |
| Colony sim | habitat+greenhouse → 2→6 crew, −36 kW → +reactor → +84 kW; unlocks at SOL 3 |
| Live NASA NeoWs | 33 real NEOs fetched, 3 hazardous, closest 1.81M km (via DEMO key) |
| Notebook AI | Ollama offline → rubric fallback scored Europa entry 6.2/ADEQUATE |

Known environmental note: in this headless runner `requestAnimationFrame` never fires, so an in-app `window.__ORION.step()` debug hook drives the loop for validation; in a real browser the normal RAF loop runs and the HUD clocks update live.

---

## Configuration

`js/core/config.js` holds all tuning constants (time-warp ladder, scale compression, surface size/resolution, module catalogue, seeds). The **Settings** panel persists NASA key + local LLM endpoint/model to `localStorage` (`orion.platform.v1`). Nothing leaves the machine except the NASA NeoWs query.

## Notes & limitations
- Positions use the JPL approximate algorithm (valid 1800–2050 AD), accurate to ~1 arcminute — appropriate for a visualization, not for precision astrometry.
- Cataclysm figures are published scaling laws (Collins et al.), labelled as estimates, not hydrocode.
- Constellation asterisms are illustrative, not IAU-accurate line charts.
- Ollama is optional; every LLM feature degrades to a deterministic engine when it's unreachable.
