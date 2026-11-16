# SEMInsight

A scroll-driven walkthrough of a Schottky field-emission scanning electron microscope:
the beam is followed from the emitter through the column to the specimen, the detectors,
the signal chain and the final image, and the page ends in a physically-based virtual SEM.

## Run

```bash
npm install
npm run dev      # local dev server
npm run build    # static site in dist/
```

Pushing to `main` builds and deploys `dist/` with the workflow in `.github/workflows/deploy.yml`
(set **Settings → Pages → Source** to **GitHub Actions** once).

## Layout

| File | Purpose |
| --- | --- |
| `src/stages.js` | The 15 stages: copy, live readouts, equations, plots, camera and label choreography |
| `src/column.js` | Three.js scene: half-sectioned column, beam envelope, signal particles |
| `src/physics.js` | Constants and closed-form models (wavelength, probe size, yields, ranges) |
| `src/montecarlo.js` | Single-scattering Monte Carlo (screened Rutherford + Joy–Luo stopping power) |
| `src/sem-image.js` | Image model: specimens, SE/BSE signal, probe blur, shot noise, charging |
| `src/sandbox.js` | Virtual SEM controls and scan loop |
| `src/plots.js` | Canvas plots for the readout panel (incl. computed Kikuchi pattern, EDS spectrum) |
| `src/main.js` | Scroll state, HUD, labels |

Beam radii, scan amplitudes and particle counts in the 3D view are exaggerated for visibility.
The virtual SEM is a teaching model, not a metrology simulator.
