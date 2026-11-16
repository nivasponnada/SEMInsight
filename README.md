# Characterisation techniques

Four scroll-driven journeys through materials and device characterisation, sharing one design
language and one engine. Each follows the probe from its source to the final number with live
readouts, equations and plots, and ends in a virtual instrument.

| Page | Module | Virtual instrument |
| --- | --- | --- |
| `index.html` | Hub: the four techniques, a comparison table and a question-to-technique matrix | |
| `sem.html` | Scanning electron microscopy (15 stages) | Virtual SEM: image model with shot noise and charging |
| `tem.html` | Transmission electron microscopy (12 stages) | Virtual TEM: phase-object simulation with a live CTF |
| `xrd.html` | X-ray diffraction (10 stages) | Virtual diffractometer: structure-factor patterns, Williamson–Hall |
| `semiconductor.html` | Semiconductor characterisation (10 stages) | Virtual probe station: 4PP + Hall, MOS C–V, p–n I–V |

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/
```

Pushing to `main` builds and deploys `dist/` with the workflow in `.github/workflows/deploy.yml`
(set **Settings → Pages → Source** to **GitHub Actions** once).

## Layout

| Path | Purpose |
| --- | --- |
| `src/core/engine.js` | Builds a module page from a config; maps scroll to stage keyframes; HUD and labels |
| `src/core/scene3d.js` | Three.js base: renderer, materials, sectioned solids of revolution, beams, particles |
| `src/core/panel.js`, `src/core/modules.js` | Control-panel builder; module registry used for cross-links |
| `src/pages/*.js` | One entry per page (hub, sem, tem, xrd, semi) |
| `src/stages.js`, `src/column.js`, `src/sem-image.js`, `src/sandbox.js`, `src/montecarlo.js` | SEM module |
| `src/tem/` | TEM stages, column scene, FFT image simulation, virtual TEM |
| `src/xrd/` | XRD stages, goniometer scene, pattern calculation, virtual diffractometer |
| `src/semi/` | Semiconductor stages, probe-station scene, device physics, virtual probe station |
| `src/physics.js`, `src/plots.js` | Shared constants, electron-optics formulas and canvas plots |

Beam widths, scan amplitudes, slit openings and device cross-sections in the 3D views are
exaggerated or schematic. The virtual instruments are teaching models, not calibrated simulators.
