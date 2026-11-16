import { boot } from '../core/engine.js';
import { STAGES } from '../tem/stages.js';
import { TemScene, Y } from '../tem/scene.js';
import { VirtualTEM, makeScreen } from '../tem/sandbox.js';

const FRONT = [[0.2, Y.tip], [0.9, 11.5], [1.8, 8.1], [2.5, Y.spec], [3.4, Y.spec], [3.75, Y.sa], [7.6, Y.sa - 0.05], [8.6, Y.screen]];
function front(t) {
  if (t <= FRONT[0][0]) return 99;
  for (let i = 0; i < FRONT.length - 1; i++) if (t <= FRONT[i + 1][0]) return FRONT[i][1] + (FRONT[i + 1][1] - FRONT[i][1]) * ((t - FRONT[i][0]) / (FRONT[i + 1][0] - FRONT[i][0]));
  return Y.screen;
}
const SCREEN_MODE = ['off', 'off', 'off', 'off', 'off', 'diff', 'bf', 'hr', 'zoom', 'off', 'off', 'dose'];

boot({
  key: 'tem',
  stages: STAGES,
  Scene: TemScene,
  heroCam: { p: [16, 9, 40], t: [0, 6.6, 0], shift: 0.2 },
  front,
  env: { df: -66 },
  hero: {
    title: ['Through the', 'specimen,', 'atom by atom.'],
    lede: 'Follow a 200 keV electron down a transmission electron microscope: through condenser optics, a foil a few hundred atoms thick, the objective lens and its back focal plane, to a camera that counts single electrons.',
    chips: ['live contrast transfer'],
  },
  lab: {
    title: 'Virtual TEM',
    intro: 'A real image calculation: the specimen’s projected potential becomes a phase object, its Fourier transform is multiplied by the aperture, the coherence envelopes and the aberration phase, and transformed back. Defocus, C<sub>s</sub>, voltage, aperture and dose all act as they do at the microscope.',
    foot: 'Model: phase-object approximation with weak absorption, 256 × 256 samples; χ(q) with defocus and third-order spherical aberration; temporal (4 nm focal spread) and spatial (0.25 mrad) coherence envelopes; Poisson noise from electrons per pixel. No multislice propagation, so thick-crystal dynamical effects are not reproduced.',
    mount: (el) => new VirtualTEM(el),
  },
  setup() {
    let draw = null, key = '';
    return {
      frame({ t, idx, f, env, scene }) {
        if (idx === 7) env.df = 20 - 180 * Math.min(1, f * 1.15);
        if (t < 3.5) return;
        const mode = t > STAGES.length ? 'hr' : SCREEN_MODE[idx];
        const q = mode === 'hr' || mode === 'zoom' || mode === 'dose' ? Math.round(f * 30) : 0;
        const k = `${mode}|${q}|${mode === 'dose' ? Math.floor(env.time * 6) : 0}`;
        if (k === key) return;
        key = k; draw = draw || makeScreen();
        draw(scene.screenCanvas, mode, Math.min(1, f * 1.15)); scene.screenTex.needsUpdate = true;
      },
    };
  },
  refs: [
    'D. B. Williams and C. B. Carter, <i>Transmission Electron Microscopy: A Textbook for Materials Science</i>, 2nd ed., Springer, 2009.',
    'L. Reimer and H. Kohl, <i>Transmission Electron Microscopy: Physics of Image Formation</i>, 5th ed., Springer, 2008.',
    'J. C. H. Spence, <i>High-Resolution Electron Microscopy</i>, 4th ed., Oxford University Press, 2013.',
    'E. J. Kirkland, <i>Advanced Computing in Electron Microscopy</i>, 3rd ed., Springer, 2020.',
    'R. F. Egerton, <i>Electron Energy-Loss Spectroscopy in the Electron Microscope</i>, 3rd ed., Springer, 2011.',
    'S. J. Pennycook and P. D. Nellist (eds.), <i>Scanning Transmission Electron Microscopy</i>, Springer, 2011.',
    'O. Scherzer, “The theoretical resolution limit of the electron microscope”, <i>J. Appl. Phys.</i> 20, 20 (1949).',
  ],
  footNote: 'Beam widths and scattering angles in the 3D view are exaggerated for visibility. Mean free paths and contrast figures are representative values at 200 kV.',
});
