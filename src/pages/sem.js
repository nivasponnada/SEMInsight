import { boot } from '../core/engine.js';
import { STAGES, MC_MATERIALS } from '../stages.js';
import { MATERIALS, rangeKO } from '../physics.js';
import { Column } from '../column.js';
import { drawKikuchi } from '../plots.js';
import { simulate } from '../montecarlo.js';
import { VirtualSEM, makeDemo } from '../sandbox.js';

// beam front (y of the leading electrons) against scroll position t
const FRONT = [[0.9, 9.97], [1.8, 9.3], [2.8, 8.2], [3.8, 5.75], [4.8, 4.9], [5.8, 4.2], [6.8, 2.8], [7.7, 0]];
function front(t) {
  if (t <= FRONT[0][0]) return 99;
  for (let i = 0; i < FRONT.length - 1; i++) if (t <= FRONT[i + 1][0]) return FRONT[i][1] + (FRONT[i + 1][1] - FRONT[i][1]) * ((t - FRONT[i][0]) / (FRONT[i + 1][0] - FRONT[i][0]));
  return 0;
}

let runMC = () => {};
boot({
  key: 'sem',
  stages: STAGES,
  Scene: Column,
  heroCam: { p: [13, 7, 30], t: [0, 4.1, 0], shift: 0.2 },
  endCam: { p: [14, 6.2, 31], t: [0, 4.1, 0], shift: 0.2 },
  front,
  env: { mcE: 15, mcMat: 'Si', mcEta: null, mcBseE: 0 },
  hero: {
    title: ['From electron', 'gun to', 'pixel.'],
    lede: 'Follow one beam through a Schottky field-emission scanning electron microscope: emitted, accelerated, focused, scanned, scattered, detected and digitised.',
    chips: ['live Monte Carlo'],
  },
  lab: {
    title: 'Virtual SEM',
    intro: 'Every control acts through the physics from the journey: the aberration budget sets the blur, the dose sets the shot noise, yield curves set the contrast and the charge balance decides whether an insulator behaves.',
    foot: 'Model: SE yield from the Lin–Joy universal curve with a sec θ tilt law and BSE-generated SE2 delocalised over the backscatter escape radius; BSE coefficient from Reuter’s fit; probe diameter from source, spherical, chromatic and diffraction terms in quadrature; Poisson noise from electrons per pixel. Specimens are procedural. It is a teaching model, not a metrology simulator.',
    mount: (el) => new VirtualSEM(el),
  },
  controls: {
    interaction: {
      html: `<div class="vs-row"><label class="lbl" for="mc-e">Beam energy</label><output id="mc-e-out"></output></div>
        <input id="mc-e" type="range" min="1" max="30" step="0.5" value="15">
        <div class="seg" id="mc-mat">${MC_MATERIALS.map((m) => `<button type="button" data-v="${m}">${m}</button>`).join('')}</div>`,
      bind(el, env, invalidate, scene) {
        let timer = 0;
        runMC = () => {
          const m = MATERIALS[env.mcMat];
          const res = simulate(m, env.mcE, { nShow: 170, nCount: 1500 });
          env.mcEta = res.eta; env.mcBseE = res.meanBseEnergy; env.rev = (env.rev || 0) + 1;
          scene.setMC(res.paths, rangeKO(env.mcE, m));
          invalidate();
        };
        const sync = () => {
          el.querySelector('#mc-e-out').textContent = `${env.mcE.toFixed(1)} keV`;
          el.querySelectorAll('#mc-mat button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === env.mcMat)));
          clearTimeout(timer); timer = setTimeout(runMC, 40);
        };
        el.querySelector('#mc-e').addEventListener('input', (e) => { env.mcE = +e.target.value; env.mcEta = null; sync(); });
        el.querySelector('#mc-mat').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { env.mcMat = b.dataset.v; env.mcEta = null; sync(); } });
        el.querySelector('#mc-e-out').textContent = '15.0 keV';
        el.querySelectorAll('#mc-mat button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === env.mcMat)));
      },
    },
  },
  setup() {
    let mcReady = false, demo = null, demoKey = '', kTexKey = -1;
    return {
      frame({ t, idx, f, env, scene, N }) {
        if (!mcReady && t > 7) { mcReady = true; setTimeout(runMC, 0); }
        if (t > 12.5 && t < N + 0.3) {
          if (!demo) demo = makeDemo();
          const key = `${idx === N - 1 ? Math.round(f * 60) : 0}|${Math.floor(env.time * 8)}`;
          if (key !== demoKey) { demoKey = key; demo.draw(scene.monitorCanvas, idx === N - 1 ? Math.max(0.02, f) : 0.02 + ((env.time * 0.15) % 0.3)); scene.monitorTex.needsUpdate = true; }
        }
        if (idx === 12) {
          const kk = Math.round(f * 24);
          if (kk !== kTexKey) { kTexKey = kk; drawKikuchi(scene.kCanvas, f * 0.8, 20, true); scene.kTex.needsUpdate = true; }
        }
      },
    };
  },
  refs: [
    'J. I. Goldstein et al., <i>Scanning Electron Microscopy and X-Ray Microanalysis</i>, 4th ed., Springer, 2018.',
    'L. Reimer, <i>Scanning Electron Microscopy: Physics of Image Formation and Microanalysis</i>, 2nd ed., Springer, 1998.',
    'D. C. Joy, <i>Monte Carlo Modeling for Electron Microscopy and Microanalysis</i>, Oxford University Press, 1995.',
    'K. Kanaya and S. Okayama, “Penetration and energy-loss theory of electrons in solid targets”, <i>J. Phys. D</i> 5, 43 (1972).',
    'Y. Lin and D. C. Joy, “A new examination of secondary electron yield data”, <i>Surf. Interface Anal.</i> 37, 895 (2005).',
    'G. D. Danilatos, “Foundations of environmental scanning electron microscopy”, <i>Adv. Electron. Electron Phys.</i> 71, 109 (1988).',
    'A. J. Schwartz et al. (eds.), <i>Electron Backscatter Diffraction in Materials Science</i>, 2nd ed., Springer, 2009.',
  ],
  footNote: 'Beam radii, scan amplitudes and particle counts in the 3D view are exaggerated for visibility; every number in the readouts is computed from the stated equations.',
});
