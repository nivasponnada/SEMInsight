import { boot } from '../core/engine.js';
import { STAGES } from '../semi/stages.js';
import { SemiScene } from '../semi/scene.js';
import { VirtualProbe } from '../semi/sandbox.js';

const lerp = (a, b, t) => a + (b - a) * t;
boot({
  key: 'semi',
  stages: STAGES,
  Scene: SemiScene,
  heroCam: { p: [9, 9.5, 21], t: [0, 0.2, 0], shift: 0.2 },
  env: { T: 300, shift: 0, E: 50 },
  hero: {
    title: ['From wafer', 'to device', 'parameters.'],
    lede: 'Follow one silicon wafer across the characterisation lab: probed for resistivity, placed in a magnetic field, biased as a capacitor, swept as a diode, read by polarised light, made to glow and finally sputtered away atom by atom.',
    chips: ['live device physics'],
  },
  lab: {
    title: 'Virtual probe station',
    intro: 'Three measurements on silicon, each calculated from the device equations: resistivity and Hall voltage from doping-dependent mobility, the MOS capacitance from the exact surface-charge solution of Poisson’s equation, and junction current from diffusion, depletion-layer recombination and series resistance.',
    foot: 'Model: silicon at the chosen temperature; Caughey–Thomas mobility fits (300 K); n<sub>i</sub> after Misiakos and Tsamakis; uniform doping; MOS capacitor in the charge-sheet-free exact formulation with interface traps as a parallel capacitance; no quantum confinement, poly depletion or tunnelling.',
    mount: (el) => new VirtualProbe(el),
  },
  setup() {
    return {
      frame({ idx, f, env }) {
        const g = Math.min(1, f * 1.15);
        if (idx === 7) env.T = lerp(10, 300, g);
        if (idx === 8) env.shift = -lerp(-1.5, 1.5, g) * 4.0 / 1.74;
        if (idx === 9) env.E = lerp(10, 120, g);
        env.rev = Math.round(f * 200) + idx * 1000;
      },
    };
  },
  refs: [
    'D. K. Schroder, <i>Semiconductor Material and Device Characterization</i>, 3rd ed., Wiley-IEEE Press, 2006.',
    'S. M. Sze and K. K. Ng, <i>Physics of Semiconductor Devices</i>, 3rd ed., Wiley, 2007.',
    'E. H. Nicollian and J. R. Brews, <i>MOS (Metal Oxide Semiconductor) Physics and Technology</i>, Wiley, 1982.',
    'L. J. van der Pauw, “A method of measuring specific resistivity and Hall effect of discs of arbitrary shape”, <i>Philips Res. Rep.</i> 13, 1 (1958).',
    'D. V. Lang, “Deep-level transient spectroscopy”, <i>J. Appl. Phys.</i> 45, 3023 (1974).',
    'H. Fujiwara, <i>Spectroscopic Ellipsometry: Principles and Applications</i>, Wiley, 2007.',
    'I. De Wolf, “Micro-Raman spectroscopy to study local mechanical stress in silicon integrated circuits”, <i>Semicond. Sci. Technol.</i> 11, 139 (1996).',
  ],
  footNote: 'Device cross-sections in the 3D view are schematic and not to scale. Readouts use the stated equations with silicon parameters at 300 K unless a temperature is shown.',
});
