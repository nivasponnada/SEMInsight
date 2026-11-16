// Twelve stages of the TEM journey.
import { K, wavelength, betaRel, fmtLen, fmtExp } from '../physics.js';
import { fr, rt } from '../stages.js';
import { optics, sigmaInt } from './sim.js';
import { prepCanvas } from '../plots.js';
import { Y } from './scene.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const L = (m) => fmtLen(m);
const kVat = (f) => lerp(60, 300, clamp(f * 1.15));
const MFP = { C: 160, Si: 145, Au: 84 }; // inelastic mean free path at 200 kV [nm] (approx.)
const theta0 = (Z, V) => wavelength(V) / (2 * Math.PI * 0.885 * 0.0529e-9 * Z ** (-1 / 3));
const ruth = (Z, th, V = 200000) => (Z * Z) / (th * th + theta0(Z, V) ** 2) ** 2;

// Si <110> zone-axis spot pattern (diamond cubic), computed from the selection rules.
function drawSAED(canvas, f) {
  const { ctx, w, h } = prepCanvas(canvas);
  const cs = getComputedStyle(canvas), acc = cs.getPropertyValue('--accent').trim(), dim = cs.getPropertyValue('--dim').trim();
  const Lcam = lerp(0.35, 1, clamp(f * 1.15));
  const sc = Lcam * Math.min(w, h) * 0.085, cx = w / 2, cy = h / 2;
  ctx.font = '10px "JetBrains Mono", monospace'; ctx.textAlign = 'center';
  for (let hh = -4; hh <= 4; hh++) for (let l = -6; l <= 6; l++) {
    const k = -hh, sum = hh + k + l, odd = [hh, k, l].every((v) => Math.abs(v) % 2 === 1), even = [hh, k, l].every((v) => v % 2 === 0);
    if (!(odd || (even && sum % 4 === 0))) continue;
    const g2 = hh * hh + k * k + l * l, x = cx + l * sc, y = cy + hh * Math.SQRT2 * sc;
    if (x < 4 || x > w - 4 || y < 4 || y > h - 4) continue;
    const I = g2 === 0 ? 1 : Math.exp(-g2 * 0.085);
    const r = 1.2 + 4.2 * Math.sqrt(I);
    const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    gr.addColorStop(0, g2 === 0 ? '#fff' : acc); gr.addColorStop(1, 'transparent');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, 7); ctx.fill();
    if ((g2 === 3 || g2 === 8 || g2 === 16) && hh >= 0 && l >= 0 && Lcam > 0.6) { ctx.fillStyle = dim; ctx.fillText(`${Math.abs(hh)}${Math.abs(k)}${Math.abs(l)}`, x, y - 9); }
  }
  ctx.fillStyle = dim; ctx.textAlign = 'left'; ctx.fillText('Si ⟨110⟩ zone axis', 6, h - 6);
}

function drawEELS(canvas, f) {
  const { ctx, w, h } = prepCanvas(canvas);
  const cs = getComputedStyle(canvas), acc = cs.getPropertyValue('--accent').trim(), dim = cs.getPropertyValue('--dim').trim(), line = cs.getPropertyValue('--line').trim();
  const m = { l: 8, r: 8, t: 8, b: 20 }, pw = w - m.l - m.r, ph = h - m.t - m.b;
  const tl = lerp(0.2, 1.4, clamp(f * 1.1)); // t/λ
  const I = (E) => {
    let y = Math.exp(-((E / 0.6) ** 2)) * Math.exp(-tl) * 1e6;
    let pn = 1;
    for (let n = 1; n <= 3; n++) { pn *= tl / n; y += pn * Math.exp(-tl) * 4e4 * Math.exp(-(((E - 16.7 * n) / (3.2 * Math.sqrt(n))) ** 2)); }
    y += 9e3 * (E > 8 ? (E / 30) ** -3.2 : 0) * tl;
    for (const [e0, a, r] of [[99, 5200, 3.2], [284, 420, 3.6], [532, 95, 3.8]]) if (E > e0) y += a * tl * (E / e0) ** -r * (1 - Math.exp(-(E - e0) / 6));
    return y;
  };
  const X = (E) => m.l + (Math.log10(E + 8) - Math.log10(8)) / (Math.log10(708) - Math.log10(8)) * pw;
  const Yp = (v) => m.t + ph - ((Math.log10(Math.max(v, 1)) - 0.5) / 5.7) * ph;
  ctx.strokeStyle = line; ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw, ph);
  ctx.strokeStyle = acc; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i <= 300; i++) { const E = (10 ** (Math.log10(8) + (i / 300) * (Math.log10(708) - Math.log10(8)))) - 8; const x = X(E), y = Yp(I(E)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
  ctx.font = '10px "JetBrains Mono", monospace'; ctx.fillStyle = dim; ctx.textAlign = 'center';
  for (const [E, n] of [[0, 'ZLP'], [16.7, 'plasmon'], [99, 'Si L'], [284, 'C K'], [532, 'O K']]) ctx.fillText(n, Math.max(18, X(E)), Math.max(m.t + 10, Yp(I(E + (E > 50 ? 12 : 0))) - 6));
  ctx.textAlign = 'left'; ctx.fillText('0', m.l, h - 6); ctx.textAlign = 'right'; ctx.fillText('700 eV (log)', w - m.r, h - 6);
  ctx.textAlign = 'center'; ctx.fillText('energy loss', w / 2, h - 6);
}

export const STAGES = [
  {
    id: 'gun', accent: '#ff4b4b', nav: 'Source & high tension',
    title: 'Fast enough\nto pass through', kicker: 'Source & high tension',
    copy: 'A TEM needs electrons that cross a solid without stopping. A field-emission tip supplies a coherent beam, and a multi-stage accelerator fed by an oil- or gas-insulated high-tension tank brings it to 80–300 keV, more than half the speed of light.',
    points: [
      ['Graded accelerator', 'The potential is divided over a stack of electrodes so no gap exceeds the breakdown field.'],
      ['Coherence', 'Schottky or cold FEG: brightness 10⁸–10⁹ A cm⁻² sr⁻¹ and ΔE of 0.3–0.7 eV feed phase contrast.'],
      ['Why not higher?', 'Knock-on damage: carbon atoms are displaced above ~80 keV, silicon above ~145 keV.'],
    ],
    readouts: (f) => { const V = kVat(f) * 1000; const g = 1 + (K.e * V) / (K.m * K.c * K.c); return [['High tension', (V / 1000).toFixed(0), 'kV'], ['Wavelength', (wavelength(V) * 1e12).toFixed(2), 'pm'], ['Velocity', betaRel(V).toFixed(3), 'c'], ['Relativistic mass', g.toFixed(3), 'm₀'], ['Stability needed', '<1', 'ppm']]; },
    eq: `λ = ${fr('h', rt('2m₀eV (1 + eV / 2m₀c²)'))}`,
    eqNote: '4.18 pm at 80 kV, 2.51 pm at 200 kV, 1.97 pm at 300 kV: a hundred times smaller than an atom.',
    plot: { title: 'Wavelength and velocity vs high tension', xl: 'V [kV]', yl: 'λ [pm] · v/c ×5', x: [40, 300], y: [0, 6.5], series: [{ f: (kv) => wavelength(kv * 1000) * 1e12, c: 'accent', name: 'λ', lx: 60 }, { f: (kv) => betaRel(kv * 1000) * 5, c: 'fg', name: 'v/c ×5', lx: 200 }], mark: (f) => kVat(f) },
    cam: { p: [4.38, 14.52, 11.5], t: [0.5, 12.9, 0.0] },
    labels: [['FIELD-EMISSION TIP', [0.03, 13.6, 0]], ['ACCELERATOR STACK', [0.78, 12.4, 0]], ['ANODE · GROUND', [1.0, 11.46, 0]], ['ION GETTER PUMP', [-1.75, 13.2, -0.2]]],
    see: [['SEM · Schottky emitter', 'sem.html#gun']],
  },
  {
    id: 'illumination', accent: '#ff8f42', nav: 'Illumination',
    title: 'Shape the\nillumination', kicker: 'Condenser system',
    copy: 'Two or three condenser lenses and an aperture decide how the specimen is lit: a broad, parallel beam for imaging and selected-area diffraction, or a convergent cone focused to a point for CBED and STEM. C1 sets the spot size, C2 the brightness.',
    points: [
      ['Parallel illumination', 'Every point sees the same incident direction: sharp diffraction spots and clean phase contrast.'],
      ['Condenser aperture', 'Limits the convergence angle and removes off-axis electrons; smaller means more coherent, dimmer.'],
      ['Dose rate', 'Current over illuminated area; spreading the beam is the simplest way to spare the specimen.'],
    ],
    readouts: (f) => { const d = 10 ** lerp(4.2, 2, clamp(f * 1.15)); const A = Math.PI * (d * 10 / 2) ** 2; const rate = 1e-9 / K.e / A; return [['Beam current', '1.00', 'nA'], ['Illuminated diameter', ...L(d * 1e-9)], ['Dose rate', rate >= 1000 ? fmtExp(rate) : rate.toFixed(rate < 10 ? 2 : 0), 'e⁻/Å²s'], ['Convergence', (0.05 + 300 / d).toFixed(2), 'mrad']]; },
    eq: `Ḋ = ${fr('I', 'e · π r²')}`,
    eqNote: 'Electron dose rate on the specimen. 1 nA carries 6.2 × 10⁹ electrons per second.',
    plot: { title: 'Dose rate vs illuminated diameter (1 nA)', xl: 'diameter [nm]', yl: 'e⁻/Å²s', lx: true, ly: true, x: [50, 20000], y: [1e-2, 1e5], series: [{ f: (d) => 1e-9 / K.e / (Math.PI * (d * 5) ** 2), c: 'accent' }], hl: [{ y: 10, name: 'typical cryo-EM' }], mark: (f) => 10 ** lerp(4.2, 2, clamp(f * 1.15)) },
    cam: { p: [5.77, 11.27, 13.65], t: [0.7, 10.1, 0.0] },
    labels: [['C1 · SPOT SIZE', [1.12, 10.95, 0]], ['CROSSOVER', [0.03, 10.4, 0]], ['C2 · INTENSITY', [1.12, 9.75, 0]], ['CONDENSER APERTURE', [-0.6, Y.cap, 0]]],
    labelSplit: -0.1,
  },
  {
    id: 'specimen', accent: '#ffc730', nav: 'Specimen',
    title: 'Thin enough\nto see through', kicker: 'The specimen',
    copy: 'The sample is the hardest part of the instrument to build. It sits on a 3 mm grid in a side-entry holder, inside the objective lens gap, and must be thinner than about one inelastic mean free path, tens of nanometres, for the image to be interpretable.',
    points: [
      ['Preparation', 'FIB lift-out lamellae, electropolishing, ion milling, ultramicrotomy, or vitrified ice for biology.'],
      ['Goniometer', 'Double-tilt holders bring a crystal zone axis parallel to the beam within a fraction of a degree.'],
      ['Thickness matters', 'Beyond t/Λ ≈ 1, multiple scattering blurs images and buries EELS edges.'],
    ],
    readouts: (f) => { const t = lerp(10, 320, clamp(f * 1.15)); return [['Foil thickness', t.toFixed(0), 'nm'], ['t / Λ (Si)', (t / MFP.Si).toFixed(2), ''], ['Unscattered (Si)', (Math.exp(-t / MFP.Si) * 100).toFixed(0), '%'], ['Unscattered (Au)', (Math.exp(-t / MFP.Au) * 100).toFixed(0), '%'], ['Grid', '3.05', 'mm']]; },
    eq: `${fr('I', 'I₀')} = e<sup>−t/Λ</sup> &nbsp;⇒&nbsp; ${fr('t', 'Λ')} = ln ${fr('I<sub>total</sub>', 'I<sub>ZLP</sub>')}`,
    eqNote: 'Fraction of electrons that suffer no inelastic event; the log-ratio of an EELS spectrum measures thickness.',
    plot: { title: 'Electrons without energy loss vs thickness', xl: 't [nm]', yl: 'fraction', x: [0, 350], y: [0, 1], series: [{ f: (t) => Math.exp(-t / MFP.C), c: 'dim', name: 'C', lx: 250 }, { f: (t) => Math.exp(-t / MFP.Si), c: 'accent', name: 'Si', lx: 130 }, { f: (t) => Math.exp(-t / MFP.Au), c: '#ffb070', name: 'Au', lx: 30 }], mark: (f) => lerp(10, 320, clamp(f * 1.15)), markSeries: 1 },
    cam: { p: [4.5, 9.1, 11.1], t: [0.0, 7.6, 0.0] },
    labels: [['SIDE-ENTRY HOLDER', [-1.0, Y.spec, 0]], ['3 mm GRID', [0.05, Y.spec + 0.02, 0]], ['UPPER POLE PIECE', [0.3, 7.95, 0]], ['LOWER POLE PIECE', [0.3, 7.3, 0], 'd']],
  },
  {
    id: 'scattering', accent: '#b7ff54', nav: 'Scattering',
    title: 'Scatter,\nor lose energy', kicker: 'Electron–specimen interaction',
    copy: 'Inside the foil an electron can do three things: pass untouched, be deflected elastically by a screened nucleus, or lose energy to the specimen’s electrons. Elastic scattering carries the structure, to large angles; inelastic scattering carries the chemistry, forward-peaked.',
    points: [
      ['Elastic', 'Rutherford-like, ∝ Z², tens of mrad; coherent in crystals, where it becomes Bragg diffraction.'],
      ['Inelastic', 'Plasmons (10–30 eV) and core ionisation; characteristic angle θ<sub>E</sub> below 0.1 mrad.'],
      ['Secondary signals', 'Ionised atoms relax by characteristic X-rays or Auger electrons: the basis of EDS.'],
    ],
    readouts: () => [['θ₀ carbon', (theta0(6, 2e5) * 1e3).toFixed(1), 'mrad'], ['θ₀ gold', (theta0(79, 2e5) * 1e3).toFixed(1), 'mrad'], ['θ<sub>E</sub> plasmon (17 eV)', (17 / (2e5 * (1222 / 711)) * 1e3).toFixed(3), 'mrad'], ['Elastic ratio Au / C', ((79 / 6) ** 1.5).toFixed(0), '×']],
    eq: `${fr('dσ', 'dΩ')} ∝ ${fr('Z²', '(θ² + θ₀²)²')} , &nbsp; θ₀ = ${fr('λ', '2π a')}`,
    eqNote: 'Screened Rutherford cross-section; a = 0.885 a₀ Z<sup>−1/3</sup> is the Thomas–Fermi screening radius.',
    plot: { title: 'Elastic differential cross-section, 200 kV', xl: 'θ [mrad]', yl: 'dσ/dΩ (rel.)', lx: true, ly: true, x: [1, 300], y: [1e-6, 1e2], series: [{ f: (th) => ruth(79, th * 1e-3) * 1e-9, c: '#ffb070', name: 'Au', lx: 3 }, { f: (th) => ruth(14, th * 1e-3) * 1e-9, c: 'accent', name: 'Si', lx: 3 }, { f: (th) => ruth(6, th * 1e-3) * 1e-9, c: 'dim', name: 'C', lx: 3 }], vl: [{ x: 50, name: 'HAADF →' }] },
    cam: { p: [2.89, 8.27, 7.14], t: [0.0, 7.5, 0.0] },
    labels: [['INCIDENT BEAM', [0.07, 7.8, 0]], ['DIFFRACTED BEAMS', [0.1, 7.36, 0]], ['DIRECT BEAM', [-0.02, 7.3, 0]]],
    labelSplit: -0.01,
    s: { diff: 1, xray: 0.5 },
    see: [['SEM · interaction volume', 'sem.html#interaction']],
  },
  {
    id: 'objective', accent: '#18ff92', nav: 'Objective lens',
    title: 'One lens sets\nthe resolution', kicker: 'Objective lens',
    copy: 'The first image is formed by the objective, a few millimetres of intense field around the specimen. Every later lens only magnifies what it delivers, so its spherical and chromatic aberrations fix the resolution of the microscope, unless a multipole corrector cancels them.',
    points: [
      ['Spherical aberration', 'Round magnetic lenses always over-focus off-axis rays: C<sub>s</sub> ≈ 0.5–1.2 mm.'],
      ['Correctors', 'Hexapole or quadrupole-octupole optics give negative C<sub>s</sub>: sub-ångström, 50 pm resolution.'],
      ['Chromatic limit', 'Energy spread and lens-current ripple blur focus: the information limit.'],
    ],
    readouts: (f) => { const Cs = 10 ** lerp(Math.log10(2), Math.log10(0.005), clamp(f * 1.15)); const o = optics({ kV: 200, Cs, df: 0 }); return [['C<sub>s</sub>', Cs >= 0.1 ? Cs.toFixed(2) : (Cs * 1000).toFixed(0), Cs >= 0.1 ? 'mm' : 'µm'], ['Scherzer defocus', o.scherzer.toFixed(1), 'nm'], ['Point resolution', (o.dPoint * 1000).toFixed(0), 'pm'], ['Information limit', (o.dInfo * 1000).toFixed(0), 'pm'], ['Focal length', '1.8', 'mm']]; },
    eq: `d<sub>Scherzer</sub> = 0.66 C<sub>s</sub><sup>1/4</sup> λ<sup>3/4</sup>`,
    eqNote: 'Point resolution at the optimum (Scherzer) defocus Δf = −1.2 (C<sub>s</sub>λ)<sup>1/2</sup>.',
    plot: { title: 'Point resolution vs spherical aberration', xl: 'Cs [mm]', yl: 'd [pm]', lx: true, ly: true, x: [0.005, 3], y: [40, 500], series: [{ f: (c) => optics({ kV: 80, Cs: c, df: 0 }).dPoint * 1000, c: 'dim', name: '80 kV', lx: 0.008 }, { f: (c) => optics({ kV: 200, Cs: c, df: 0 }).dPoint * 1000, c: 'accent', name: '200 kV', lx: 0.05 }, { f: (c) => optics({ kV: 300, Cs: c, df: 0 }).dPoint * 1000, c: 'fg', name: '300 kV', lx: 0.4 }], mark: (f) => 10 ** lerp(Math.log10(2), Math.log10(0.005), clamp(f * 1.15)), markSeries: 1 },
    cam: { p: [5.54, 8.56, 12.74], t: [0.6, 7.45, 0.0] },
    labels: [['OBJECTIVE COIL', [0.8, 8.05, 0]], ['SPECIMEN PLANE', [0.2, Y.spec, 0]], ['BACK FOCAL PLANE', [0.2, Y.bfp, 0], 'd']],
    s: { diff: 1 },
    see: [['SEM · probe formation', 'sem.html#objective']],
  },
  {
    id: 'diffraction', accent: '#17f1d1', nav: 'Diffraction',
    title: 'A map of\nreciprocal space', kicker: 'Diffraction',
    copy: 'All electrons leaving the specimen in one direction meet at one point in the objective’s back focal plane. For a crystal those directions are the Bragg beams, so the plane holds a spot pattern: a nearly flat slice of the reciprocal lattice, because the Ewald sphere is so large.',
    points: [
      ['Selected-area diffraction', 'An aperture in the first image plane picks the region, down to ~100 nm, that contributes.'],
      ['Camera length', 'Spot distance r = λL/d: measure r, read off the plane spacing d.'],
      ['Beyond spots', 'Rings from polycrystals, Kikuchi lines from thick crystals, CBED discs for symmetry and strain.'],
    ],
    readouts: (f) => { const Lc = lerp(150, 1000, clamp(f * 1.15)); const lam = wavelength(2e5); return [['Camera length', Lc.toFixed(0), 'mm'], ['r (Si 111, d = 0.314 nm)', ((lam * Lc * 1e-3) / 0.3136e-9 * 1e3).toFixed(2), 'mm'], ['r (Si 220, d = 0.192 nm)', ((lam * Lc * 1e-3) / 0.192e-9 * 1e3).toFixed(2), 'mm'], ['θ<sub>B</sub> (111)', ((lam / (2 * 0.3136e-9)) * 1e3).toFixed(2), 'mrad'], ['Ewald radius 1/λ', (1e-9 / lam).toFixed(0), 'nm⁻¹']]; },
    eq: `r · d<sub>hkl</sub> = λL`,
    eqNote: 'Small-angle form of Bragg’s law 2d sin θ = λ on a detector at camera length L.',
    plot: { title: 'Selected-area diffraction pattern', draw: (c, f) => drawSAED(c, f), tall: true },
    cam: { p: [4.04, 7.83, 9.92], t: [0.2, 6.95, 0.0] },
    labels: [['OBJECTIVE APERTURE', [0.2, Y.bfp, 0]], ['DIFFRACTION SPOTS', [-0.2, Y.bfp, 0]], ['SELECTED-AREA APERTURE', [-0.3, Y.sa, 0], 'd']],
    labelSplit: -0.1,
    s: { diff: 1 },
    see: [['XRD · Bragg’s law', 'xrd.html#bragg'], ['SEM · EBSD', 'sem.html#ebsd']],
  },
  {
    id: 'contrast', accent: '#5ac8ff', nav: 'Bright & dark field',
    title: 'Choose which\nelectrons count', kicker: 'Amplitude contrast',
    copy: 'Insert a small aperture in the back focal plane and only one beam reaches the image. Keep the direct beam and anything that scatters strongly, heavy, thick or diffracting, turns dark: bright field. Keep one diffracted beam instead and only crystals in that orientation light up: dark field.',
    points: [
      ['Mass–thickness', 'Dominant in amorphous and biological samples; heavy-metal stains exploit it.'],
      ['Diffraction contrast', 'Dislocations, stacking faults and bend contours appear where the local Bragg condition changes.'],
      ['Two-beam conditions', 'Tilting to one strong reflection g makes g·b analysis of Burgers vectors possible.'],
    ],
    readouts: (f) => { const d = [70, 40, 20, 10][Math.min(3, Math.floor(clamp(f) * 4.2))]; const beta = (d / 2) * 1e-6 / 1.8e-3; return [['Objective aperture', d.toFixed(0), 'µm'], ['Collection semi-angle', (beta * 1e3).toFixed(1), 'mrad'], ['Cut-off spacing', (wavelength(2e5) / beta * 1e9).toFixed(2), 'nm'], ['Contrast, 5 nm Au on C', (100 * (1 - Math.exp(-5 / (8 + d * 0.35)))).toFixed(0), '%']]; },
    eq: `I<sub>BF</sub> = I₀ exp(−ρt / (ρt)<sub>c</sub>(β))`,
    eqNote: 'Bright-field intensity falls exponentially with mass-thickness; a smaller aperture angle β raises contrast.',
    plot: { title: 'Bright-field transmission vs thickness', xl: 't [nm]', yl: 'I / I₀', x: [0, 60], y: [0, 1], series: [{ f: (t) => Math.exp(-t / 140), c: 'dim', name: 'carbon', lx: 40 }, { f: (t) => Math.exp(-t / 55), c: 'accent', name: 'Si', lx: 30 }, { f: (t) => Math.exp(-t / 12), c: '#ffb070', name: 'Au', lx: 12 }] },
    cam: { p: [4.04, 7.83, 9.92], t: [0.2, 6.95, 0.0] },
    labels: [['APERTURE SELECTS ONE BEAM', [0.2, Y.bfp, 0]], ['FIRST IMAGE', [0.1, Y.sa, 0], 'd']],
    s: { diff: 0.5 },
  },
  {
    id: 'hrtem', accent: '#5a9cff', nav: 'Phase contrast',
    title: 'Turn phase\ninto contrast', kicker: 'High-resolution TEM',
    copy: 'A thin crystal barely absorbs electrons; it only delays them, by an amount proportional to the projected atomic potential. Phase is invisible to a camera. Defocus and spherical aberration together act as a phase plate that converts it into intensity, for some spatial frequencies better than others.',
    points: [
      ['Contrast transfer function', 'sin χ(q) oscillates: each zero is a spacing that vanishes, each sign change a contrast reversal.'],
      ['Scherzer defocus', 'Balances C<sub>s</sub> with a slight underfocus to give one broad passband.'],
      ['Interpretation', 'Atoms can be dark or bright; images are matched against multislice simulations.'],
    ],
    readouts: (f) => { const df = lerp(20, -160, clamp(f * 1.15)); const o = optics({ kV: 200, Cs: 1.0, df }); return [['Defocus', df.toFixed(0), 'nm'], ['Scherzer (C<sub>s</sub> 1.0 mm)', o.scherzer.toFixed(1), 'nm'], ['Interaction constant σ', (sigmaInt(2e5) * 1e3).toFixed(2), 'mrad/V·nm'], ['Point resolution', (o.dPoint * 1000).toFixed(0), 'pm'], ['Information limit', (o.dInfo * 1000).toFixed(0), 'pm']]; },
    eq: `χ(q) = πλ Δf q² + ½π C<sub>s</sub>λ³ q⁴`,
    eqNote: 'Weak-phase object: I(r) ≈ 1 + 2σV<sub>t</sub>(r) ⊗ FT⁻¹[sin χ · E]. E is the coherence envelope.',
    plot: { title: 'Contrast transfer function (200 kV, Cs 1.0 mm)', xl: 'q [nm⁻¹]', yl: 'sin χ · E', x: [0, 9], y: [-1.05, 1.05], n: 500, series: (env) => [{ f: (q) => optics({ kV: 200, Cs: 1.0, df: env.df ?? -66 }).ctf(q), c: 'accent' }, { f: (q) => optics({ kV: 200, Cs: 1.0, df: 0 }).env(q), c: 'dim', dash: [3, 3] }, { f: (q) => -optics({ kV: 200, Cs: 1.0, df: 0 }).env(q), c: 'dim', dash: [3, 3] }], hl: [{ y: 0, name: '' }], vl: [{ x: 1 / 0.3136, name: 'Si 111' }, { x: 1 / 0.192, name: '220' }] },
    cam: { p: [4.6, 3.6, 11], t: [0.3, 1.9, 0] },
    labels: [['LATTICE IMAGE', [0.7, Y.screen, 0]]],
  },
  {
    id: 'projection', accent: '#8e9bff', nav: 'Projection',
    title: 'Magnify, or\nswitch planes', kicker: 'Intermediate & projector lenses',
    copy: 'Three or four more lenses relay the first image down the column, multiplying its size at each step. Change the strength of the intermediate lens and it looks at the back focal plane instead of the image plane: the same optics project the diffraction pattern onto the screen.',
    points: [
      ['Magnification', '50× to 1.5 million×, the product of the individual lens magnifications.'],
      ['Image ↔ diffraction', 'One button changes one lens current; the specimen and illumination stay untouched.'],
      ['Image rotation', 'Each magnetic lens rotates the image; modern columns compensate in pairs.'],
    ],
    readouts: (f) => { const M = 10 ** lerp(3.3, 6.1, clamp(f * 1.15)); return [['Magnification', M >= 1e6 ? (M / 1e6).toFixed(2) + ' M' : (M / 1000).toFixed(0) + ' k', '×'], ['Pixel at specimen (14 µm px)', ...L(14e-6 / M)], ['Field of view (4k)', ...L((14e-6 / M) * 4096)], ['Nyquist spacing', ...L((2 * 14e-6) / M)]]; },
    eq: `M = M<sub>obj</sub> · M<sub>int</sub> · M<sub>proj 1</sub> · M<sub>proj 2</sub>`,
    eqNote: 'To record a spacing d, the specimen pixel must be smaller than d/2 (Nyquist), in practice d/3.',
    plot: { title: 'Field of view vs magnification (4k camera)', xl: 'M', yl: 'FOV [nm]', lx: true, ly: true, x: [1e3, 2e6], y: [10, 1e5], series: [{ f: (M) => (14e-6 / M) * 4096 * 1e9, c: 'accent' }], mark: (f) => 10 ** lerp(3.3, 6.1, clamp(f * 1.15)) },
    cam: { p: [5.4, 5.2, 13], t: [0.7, 3.9, 0] },
    labels: [['INTERMEDIATE LENS', [1.12, Y.il, 0]], ['PROJECTOR 1', [1.12, Y.p1, 0]], ['PROJECTOR 2', [1.12, Y.p2, 0]], ['VIEWING SCREEN', [1.15, Y.screen, 0]]],
  },
  {
    id: 'stem', accent: '#c58bff', nav: 'STEM',
    title: 'Scan a probe\ninstead', kicker: 'Scanning TEM',
    copy: 'Run the optics the other way round: focus the beam to an ångström-sized probe on the specimen, raster it, and collect what comes out at each pixel. An annular detector at high angles counts electrons scattered close to the nucleus, so brightness scales roughly as Z¹·⁷ and is directly interpretable.',
    points: [
      ['HAADF', '50–200 mrad: incoherent Z-contrast, heavy columns bright, no contrast reversals.'],
      ['BF · ABF · DPC', 'On-axis detectors recover light elements and, with segmentation, electric fields.'],
      ['Probe size', 'Aberration-corrected probes reach 50–80 pm with tens of picoamps: single-atom sensitivity.'],
    ],
    readouts: (f) => { const Cs = 10 ** lerp(Math.log10(1.2), Math.log10(0.002), clamp(f * 1.15)); const lam = wavelength(2e5) * 1e9, c = Cs * 1e6; const d = Math.max(0.43 * c ** 0.25 * lam ** 0.75, 0.05); const a = Math.min(1.41 * (lam / c) ** 0.25, 0.032); return [['C<sub>s</sub>', Cs >= 0.1 ? Cs.toFixed(2) : (Cs * 1000).toFixed(0), Cs >= 0.1 ? 'mm' : 'µm'], ['Optimum aperture α', (a * 1e3).toFixed(1), 'mrad'], ['Probe diameter', (d * 1000).toFixed(0), 'pm'], ['HAADF inner angle', '60', 'mrad'], ['Contrast Au / Si', ((79 / 14) ** 1.7).toFixed(0), '×']]; },
    eq: `d<sub>probe</sub> = 0.43 C<sub>s</sub><sup>1/4</sup> λ<sup>3/4</sup> , &nbsp; I<sub>HAADF</sub> ∝ t · Z<sup>1.7</sup>`,
    eqNote: 'Aberration-limited probe at the optimum aperture α = 1.41 (λ/C<sub>s</sub>)<sup>1/4</sup>.',
    plot: { title: 'HAADF signal per atom vs atomic number', xl: 'Z', yl: 'I ∝ Z^1.7 (Au = 1)', x: [1, 90], y: [0, 1.1], series: [{ f: (Z) => (Z / 79) ** 1.7, c: 'accent' }], notes: [[14, 'Si'], [31, 'Ga'], [50, 'Sn'], [79, 'Au']] },
    cam: { p: [5.0, 6.82, 14.37], t: [0.4, 5.1, 0.0] },
    labels: [['FOCUSED PROBE', [0.02, Y.spec, 0]], ['HIGH-ANGLE SCATTERING', [0.35, 4.2, 0]], ['HAADF DETECTOR', [0.7, Y.haadf, 0]]],
    s: { stem: 1 },
    see: [['SEM · scan coils', 'sem.html#scan']],
  },
  {
    id: 'spectroscopy', accent: '#ff6b9d', nav: 'EELS & EDS',
    title: 'Ask each electron\nwhat it lost', kicker: 'Analytical TEM',
    copy: 'Below the column a magnetic prism bends electrons through 90°, slower ones more, and spreads them into an energy-loss spectrum: plasmons, then ionisation edges whose onset names the element and whose fine structure reveals bonding. Above the specimen, X-ray detectors watch the same atoms relax.',
    points: [
      ['EELS', 'Best for light elements; 0.3–1 eV resolution, 10 meV with a monochromator.'],
      ['EDS', 'Silicon drift detectors covering up to ~1 sr map all elements from boron up.'],
      ['Spectrum imaging', 'A full spectrum at every STEM pixel: atomic-resolution chemical maps.'],
    ],
    readouts: (f) => { const tl = lerp(0.2, 1.4, clamp(f * 1.1)); return [['t / Λ', tl.toFixed(2), ''], ['Zero-loss fraction', (Math.exp(-tl) * 100).toFixed(0), '%'], ['Plasmon energy (Si)', '16.7', 'eV'], ['Si L₂,₃ · C K · O K', '99 · 284 · 532', 'eV'], ['Prism dispersion', '~2', 'µm/eV']]; },
    eq: `R = ${fr('γ m₀ v', 'e B')} &nbsp;·&nbsp; I<sub>edge</sub> ∝ N · σ<sub>k</sub>(β, Δ) · I₀`,
    eqNote: 'The bend radius grows with momentum, dispersing the beam; the edge integral counts atoms per area.',
    plot: { title: 'Energy-loss spectrum (log intensity)', draw: (c, f) => drawEELS(c, f) },
    cam: { p: [5.2, 0.6, 13], t: [1.0, -0.4, 0], shift: 0.12, shiftY: -0.12 },
    labels: [['MAGNETIC PRISM', [0.5, -1.3, 0.05]], ['SPECTRUM DETECTOR', [2.15, -1.6, 0.2]], ['CAMERA', [0.65, 0.17, 0.4]]],
    s: { eels: 1, xray: 1 },
    see: [['SEM · EDS detector', 'sem.html#detectors']],
  },
  {
    id: 'detection', accent: '#d93a3a', nav: 'Detection', light: true,
    title: 'Count every\nelectron', kicker: 'Detection & dose',
    copy: 'The final image is a count of electrons per pixel, and the specimen often dies before the statistics are good. Direct-detection cameras register single electrons without a scintillator, read out hundreds of frames per second, and let software undo drift and weight frames by accumulated damage.',
    points: [
      ['DQE', 'Detective quantum efficiency: 0.2–0.4 for scintillator-coupled CCDs, up to 0.9 for counting detectors.'],
      ['Dose budget', '10–60 e⁻/Å² for proteins in ice; 10³–10⁶ for metals and oxides.'],
      ['Dose-limited resolution', 'Smaller features need more electrons per area than the sample may survive.'],
    ],
    readouts: (f) => { const D = 10 ** lerp(0.5, 4.5, clamp(f * 1.15)); const res = (c, q) => 5 / (c * Math.sqrt(q * D)) / 10; return [['Dose', D < 100 ? D.toFixed(1) : D.toFixed(0), 'e⁻/Å²'], ['Resolvable, C = 10 %, DQE 0.9', res(0.1, 0.9).toFixed(2), 'nm'], ['Resolvable, C = 10 %, DQE 0.3', res(0.1, 0.3).toFixed(2), 'nm'], ['Frame rate (counting)', '400–1500', 'fps']]; },
    eq: `δ ≥ ${fr('SNR', 'C · ' + rt('DQE · D'))}`,
    eqNote: 'Rose criterion (SNR ≈ 5): the smallest feature of contrast C visible at dose D.',
    plot: { title: 'Dose-limited resolution vs dose (C = 10 %)', xl: 'dose [e⁻/Å²]', yl: 'δ [nm]', lx: true, ly: true, x: [1, 1e5], y: [0.01, 10], series: [{ f: (D) => 5 / (0.1 * Math.sqrt(0.9 * D)) / 10, c: 'accent', name: 'DQE 0.9', lx: 2 }, { f: (D) => 5 / (0.1 * Math.sqrt(0.3 * D)) / 10, c: 'dim', dash: [4, 3], name: 'DQE 0.3', lx: 200 }], mark: (f) => 10 ** lerp(0.5, 4.5, clamp(f * 1.15)) },
    cam: { p: [2.6, 4.6, 6.8], t: [0.2, 0.9, 0] },
    labels: [['FLUORESCENT SCREEN', [1.1, Y.screen, 0.3]], ['DIRECT-DETECTION CAMERA BELOW', [0.4, 0.3, 0.9], 'd']],
  },
];
