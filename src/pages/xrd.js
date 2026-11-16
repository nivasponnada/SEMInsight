import { boot } from '../core/engine.js';
import { STAGES } from '../xrd/stages.js';
import { XrdScene } from '../xrd/scene.js';
import { VirtualXRD, drawPattern } from '../xrd/sandbox.js';
import { pattern } from '../xrd/physics.js';

const FRONT = [[0.15, -1], [0.45, 0], [1.5, 0.3], [2.25, 1], [2.75, 2]];
function front(t) {
  if (t <= FRONT[0][0]) return -1;
  for (let i = 0; i < FRONT.length - 1; i++) if (t <= FRONT[i + 1][0]) return FRONT[i][1] + (FRONT[i + 1][1] - FRONT[i][1]) * ((t - FRONT[i][0]) / (FRONT[i + 1][0] - FRONT[i][0]));
  return 2;
}
const lerp = (a, b, t) => a + (b - a) * t;

boot({
  key: 'xrd',
  stages: STAGES,
  Scene: XrdScene,
  heroCam: { p: [7, 4, 31], t: [0, 0.6, 0], shift: 0.2 },
  heroState: { closed: 1, sweep: 1 },
  endState: { closed: 1, sweep: 1 },
  front,
  env: { kV: 40, theta: 15, L: 50 },
  hero: {
    title: ['From photon', 'to phase,', 'one angle at a time.'],
    lede: 'Follow Cu Kα radiation through a powder diffractometer: generated in the tube, filtered and collimated, reflected by planes of atoms at the Bragg angle, counted by the detector and turned into a pattern that names the crystal.',
    chips: ['computed patterns'],
  },
  lab: {
    title: 'Virtual diffractometer',
    intro: 'Patterns are calculated from the crystal structure: allowed reflections from the structure factor, heights from multiplicity, Lorentz–polarisation and thermal factors, and widths from the instrument, crystallite size and microstrain. Noise follows the counting time.',
    foot: 'Model: cubic structures; analytic approximation to the atomic form factors (no anomalous dispersion); pseudo-Voigt profiles with Thompson–Cox–Hastings mixing; Caglioti instrument function; Kα₁, Kα₂ and Kβ lines; Poisson counting noise. Axial-divergence asymmetry, absorption and preferred orientation are not modelled.',
    mount: (el) => new VirtualXRD(el),
  },
  setup() {
    let data = null, key = '';
    return {
      frame({ t, idx, f, env, scene, N }) {
        env.theta = scene.theta;
        if (idx === 0) env.kV = lerp(5, 45, Math.min(1, f * 1.15));
        if (idx === 8) env.L = 10 ** lerp(2.6, 0.6, Math.min(1, f * 1.15));
        env.rev = Math.round(scene.theta * 4) + Math.round((env.kV || 0) * 2) * 1000;
        if (t < 7.5 || t > N + 0.4) return;
        const Lc = idx === 8 ? env.L : 60;
        const dk = Math.round(Math.log10(Lc) * 12);
        if (!data || data.dk !== dk) { data = pattern({ mat: 'Si', anode: 'Cu', filter: true, L: Lc, eps: 0.0005, strain: 0, disp: 0, time: 0.4 }, { x1: 100 }); data.dk = dk; key = ''; }
        const upto = idx >= 9 ? 1e9 : 2 * scene.theta + 30 * (0.5 + 0.5 * Math.sin(env.time * 0.2)) * 0;
        const k = `${dk}|${Math.round(upto * 2)}`;
        if (k === key) return; key = k;
        drawPattern(scene.monitorCanvas, data, { upto: idx >= 9 ? 1e9 : 10 + (scene.theta - 9) / 26 * 90, bg: '#0d0d0d' });
        scene.monitorTex.needsUpdate = true;
      },
    };
  },
  refs: [
    'B. D. Cullity and S. R. Stock, <i>Elements of X-Ray Diffraction</i>, 3rd ed., Pearson, 2014.',
    'V. K. Pecharsky and P. Y. Zavalij, <i>Fundamentals of Powder Diffraction and Structural Characterization of Materials</i>, 2nd ed., Springer, 2009.',
    'R. Jenkins and R. L. Snyder, <i>Introduction to X-Ray Powder Diffractometry</i>, Wiley, 1996.',
    'B. E. Warren, <i>X-Ray Diffraction</i>, Dover, 1990.',
    'H. M. Rietveld, “A profile refinement method for nuclear and magnetic structures”, <i>J. Appl. Cryst.</i> 2, 65 (1969).',
    'G. K. Williamson and W. H. Hall, “X-ray line broadening from filed aluminium and wolfram”, <i>Acta Metall.</i> 1, 22 (1953).',
    'P. Thompson, D. E. Cox and J. B. Hastings, “Rietveld refinement of Debye–Scherrer synchrotron X-ray data from Al₂O₃”, <i>J. Appl. Cryst.</i> 20, 79 (1987).',
  ],
  footNote: 'The beam fan, slit openings and lattice spacing in the 3D view are exaggerated for visibility. Peak positions use tabulated lattice parameters and wavelengths; intensities use approximate form factors.',
});
