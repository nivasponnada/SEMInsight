// Ten stages of the powder-XRD journey.
import { fr, rt } from '../stages.js';
import { prepCanvas } from '../plots.js';
import { ANODES, MATERIALS, reflections, formFactor, tubeSpectrum, instFWHM, sizeFWHM, strainFWHM, tch, pseudoVoigt } from './physics.js';
import { arm, R } from './scene.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const rad = Math.PI / 180;
const XC = '#b08cff';
const css = (c) => { const s = getComputedStyle(c); return { acc: s.getPropertyValue('--accent').trim(), dim: s.getPropertyValue('--dim').trim(), fg: s.getPropertyValue('--fg').trim(), line: s.getPropertyValue('--line').trim() }; };
const FONT = '10px "JetBrains Mono", monospace';

// 2D detector view: Debye rings of a powder, spotty when few crystallites diffract.
function drawRings(canvas, f) {
  const { ctx, w, h } = prepCanvas(canvas); const c = css(canvas);
  const refl = reflections(MATERIALS.Si, 1.54056, { tthMax: 100 });
  const cx = w * 0.5, cy = h * 0.5, sc = h * 0.0095;
  const grains = Math.round(10 ** lerp(1.2, 4, clamp(f * 1.2)));
  ctx.fillStyle = '#0b0b0d'; ctx.fillRect(0, 0, w, h);
  let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return (seed >>> 8) / 16777216; };
  for (const r of refl) {
    const rr = r.tth * sc; if (rr > w) continue;
    const n = Math.min(900, Math.round(grains * r.m * 0.012 * (r.I / 100 + 0.05) * 6));
    ctx.fillStyle = XC;
    for (let i = 0; i < n; i++) { const a = rnd() * 6.2832, j = (rnd() - 0.5) * 1.6; ctx.globalAlpha = 0.25 + 0.6 * rnd(); ctx.fillRect(cx + Math.cos(a) * (rr + j), cy + Math.sin(a) * (rr + j), 1.6, 1.6); }
  }
  ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 7); ctx.fill();
  ctx.font = FONT; ctx.fillStyle = c.dim; ctx.textAlign = 'left'; ctx.fillText(`${grains.toLocaleString('en-US')} crystallites in the beam`, 6, h - 6);
}

// Which reflections each Bravais lattice allows, against N = h² + k² + l².
function drawAbsences(canvas) {
  const { ctx, w, h } = prepCanvas(canvas); const c = css(canvas);
  const rows = [['P', () => true], ['I (bcc)', (hh, k, l) => (hh + k + l) % 2 === 0], ['F (fcc)', (hh, k, l) => (hh % 2 === k % 2) && (k % 2 === l % 2)], ['diamond', (hh, k, l) => ((hh % 2 === k % 2) && (k % 2 === l % 2)) && (hh % 2 === 1 || (hh + k + l) % 4 === 0)]];
  const m = { l: 62, r: 8, t: 6, b: 18 }, pw = w - m.l - m.r, rh = (h - m.t - m.b) / rows.length;
  ctx.font = FONT; ctx.textBaseline = 'middle';
  const seen = {};
  for (let hh = 0; hh <= 4; hh++) for (let k = 0; k <= hh; k++) for (let l = 0; l <= k; l++) { const N = hh * hh + k * k + l * l; if (N && N <= 20 && !seen[N]) seen[N] = [hh, k, l]; }
  rows.forEach(([name, ok], i) => {
    const y = m.t + rh * (i + 0.5);
    ctx.fillStyle = c.dim; ctx.textAlign = 'left'; ctx.fillText(name, 4, y);
    ctx.strokeStyle = c.line; ctx.beginPath(); ctx.moveTo(m.l, y + rh * 0.35); ctx.lineTo(m.l + pw, y + rh * 0.35); ctx.stroke();
    for (const [N, hkl] of Object.entries(seen)) {
      const x = m.l + ((N - 0.5) / 20) * pw, on = ok(...hkl);
      ctx.fillStyle = on ? c.acc : c.line; ctx.fillRect(x - 1.5, y - rh * 0.3, 3, rh * (on ? 0.65 : 0.25) + (on ? 0 : rh * 0.4) * 0);
    }
  });
  ctx.fillStyle = c.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  for (const N of [1, 2, 3, 4, 8, 11, 12, 16, 19, 20]) ctx.fillText(String(N), m.l + ((N - 0.5) / 20) * pw, h - 5);
  ctx.textAlign = 'left'; ctx.fillText('N =', 34, h - 5);
}

// A single reflection measured with different counting times.
function drawCounting(canvas, f, env) {
  const { ctx, w, h } = prepCanvas(canvas); const c = css(canvas);
  const T = 10 ** lerp(-1.3, 1, clamp(f * 1.15)), m = 8;
  let seed = (Math.floor(env.time * 5) * 9973 + 3) | 0; const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return ((seed >>> 8) + 1) / 16777217; };
  const N = 90, mu = (i) => (40 + 900 * pseudoVoigt((i - 38) * 0.02, 0.09, 0.4) + 450 * pseudoVoigt((i - 50.5) * 0.02, 0.09, 0.4)) * T;
  const top = 1000 * T;
  ctx.strokeStyle = c.dim; ctx.setLineDash([3, 3]); ctx.beginPath();
  for (let i = 0; i <= N; i++) { const x = m + ((w - 2 * m) * i) / N, y = h - 16 - (mu(i) / top) * (h - 28); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = c.acc;
  for (let i = 0; i <= N; i++) { const l = mu(i), v = l + Math.sqrt(l) * Math.sqrt(-2 * Math.log(rnd())) * Math.cos(6.2832 * rnd()); ctx.fillRect(m + ((w - 2 * m) * i) / N - 1, h - 16 - (Math.max(0, v) / top) * (h - 28) - 1, 2.4, 2.4); }
  ctx.font = FONT; ctx.fillStyle = c.dim; ctx.textAlign = 'left'; ctx.fillText('Kα₁ + Kα₂ doublet, counts per step', m, h - 3);
}

const sizeAt = (f) => 10 ** lerp(2.6, 0.6, clamp(f * 1.15));

export const STAGES = [
  {
    id: 'tube', accent: '#ff4b4b', nav: 'X-ray tube',
    title: 'Make X-rays\nfrom electrons', kicker: 'The X-ray tube',
    copy: 'A tungsten filament boils off electrons; 40 kV drives them into a water-cooled copper anode. Ninety-nine per cent of the power becomes heat. The rest leaves as a continuous braking spectrum plus sharp lines emitted when a knocked-out K electron is replaced from the L or M shell.',
    points: [
      ['Line focus', 'A 0.4 × 12 mm focal spot viewed at a 6° take-off angle looks like a 40 µm line.'],
      ['Characteristic lines', 'Cu Kα₁ 1.5406 Å, Kα₂ 1.5444 Å (half as strong), Kβ 1.3922 Å.'],
      ['Brighter sources', 'Rotating anodes, liquid-metal jets and synchrotrons trade cost for 10 to 10¹⁰ times the brilliance.'],
    ],
    readouts: (f) => { const kV = lerp(5, 45, clamp(f * 1.15)); return [['Tube voltage', kV.toFixed(0), 'kV'], ['Tube current', '40', 'mA'], ['Short-wavelength limit', (12.398 / kV).toFixed(3), 'Å'], ['Cu K excitation', kV > 8.979 ? 'on' : 'off', kV > 8.979 ? `U = ${(kV / 8.979).toFixed(1)}` : '< 8.98 kV'], ['Power as heat', '~99', '%']]; },
    eq: `λ<sub>min</sub> = ${fr('hc', 'eV')} = ${fr('12.398', 'V [kV]')} Å`,
    eqNote: 'Duane–Hunt limit of the bremsstrahlung. Line intensity grows as (V/V<sub>K</sub> − 1)<sup>1.6</sup>.',
    plot: { title: 'Tube spectrum (Cu anode)', xl: 'λ [Å]', yl: 'intensity', x: [0.2, 2.2], y: [0, 6.5], n: 500, series: (env) => [{ f: (l) => tubeSpectrum(l, env.kV || 40), c: 'accent' }], notes: [[1.33, 'Kβ'], [1.62, 'Kα']] },
    cam: { p: [-3.4, 2.8, 10.5], t: [-4.4, 1.35, 0], shift: 0.24 },
    labels: [['FILAMENT · CATHODE', arm(-1, 4.7, 15, 0.85)], ['Cu ANODE', arm(-1, 4.9, 15, -0.3)], ['Be WINDOW', arm(-1, 4.0, 15, 0.25)], ['COOLING WATER', arm(-1, 5.3, 15, -0.5), 'd']],
    labelSplit: -4.4,
    s: { theta: 15 },
    see: [['SEM · X-ray generation', 'sem.html#interaction']],
  },
  {
    id: 'optics', accent: '#ff8f42', nav: 'Beam conditioning',
    title: 'One wavelength,\none direction', kicker: 'Beam conditioning',
    copy: 'Bragg’s law needs a single wavelength and a defined angle. A nickel foil whose absorption edge lies between Cu Kβ and Kα removes the unwanted line; Soller slits, stacks of thin parallel plates, limit divergence out of the diffraction plane; a divergence slit sets how much of the sample is lit.',
    points: [
      ['Kβ filter', '15–20 µm Ni cuts Kβ to about 1 % while passing roughly half of Kα.'],
      ['Monochromators', 'A bent graphite or Ge crystal, or a multilayer mirror, also removes fluorescence and Kα₂.'],
      ['Soller slits', '2.3° to 5° axial divergence: narrower means sharper, more symmetric peaks, fewer counts.'],
    ],
    readouts: (f) => { const t = lerp(0, 20, clamp(f * 1.2)); return [['Ni filter', t.toFixed(0), 'µm'], ['Kα transmitted', (Math.exp(-0.62 * t / 20 * 1.1) * 100).toFixed(0), '%'], ['Kβ transmitted', (Math.exp(-5.2 * (1.392 / 1.488) ** 3 * t / 20) * 100).toFixed(1), '%'], ['Ni K edge', '1.488', 'Å'], ['Soller opening', '2.3', '°']]; },
    eq: `I = I₀ e<sup>−μ(λ) t</sup> , &nbsp; μ ∝ λ³ between edges`,
    eqNote: 'Photoelectric absorption jumps by a factor ~8 at the K edge of the filter element (Z − 1 of the anode).',
    plot: { title: 'Spectrum before and after the Ni filter', xl: 'λ [Å]', yl: 'intensity', x: [1.2, 1.7], y: [0, 6.5], n: 600, series: [{ f: (l) => tubeSpectrum(l, 40), c: 'dim', dash: [3, 3], name: 'unfiltered', lx: 1.22 }, { f: (l) => tubeSpectrum(l, 40, ANODES.Cu, true), c: 'accent', name: 'filtered', lx: 1.6 }], vl: [{ x: 1.488, name: 'Ni edge' }] },
    cam: { p: [-1.4, 2.6, 11], t: [-2.9, 0.9, 0], shift: 0.24 },
    labels: [['SOLLER SLIT', arm(-1, 3.3, 15, 0.24)], ['DIVERGENCE SLIT', arm(-1, 2.6, 15, -0.3), 'd']],
    labelSplit: -9,
    s: { theta: 15 },
  },
  {
    id: 'geometry', accent: '#ffc730', nav: 'Goniometer',
    title: 'Focus without\na lens', kicker: 'Bragg–Brentano geometry',
    copy: 'X-rays cannot be focused by ordinary lenses, so the instrument uses geometry instead. Source, sample surface and receiving slit lie on one circle; rays diverging from the source and reflected at the same Bragg angle from a flat powder converge again on the slit. The arms move in step: θ and θ.',
    points: [
      ['Parafocusing', 'The focusing circle shrinks as 2θ grows; the flat sample is tangent to it.'],
      ['θ–θ or θ–2θ', 'Either both arms rise, or the sample turns by θ while the detector turns by 2θ.'],
      ['Systematic errors', 'Sample height displacement and transparency shift peaks; axial divergence makes them asymmetric.'],
    ],
    readouts: (f, env) => { const th = env.theta || 15; return [['θ', th.toFixed(2), '°'], ['2θ', (2 * th).toFixed(2), '°'], ['Goniometer radius', '240', 'mm'], ['Focusing-circle radius', (240 / (2 * Math.sin(th * rad))).toFixed(0), 'mm'], ['Irradiated length (½° slit)', Math.min(20, (240 * 0.5 * rad) / Math.sin(th * rad)).toFixed(1), 'mm']]; },
    eq: `r<sub>f</sub> = ${fr('R', '2 sin θ')} , &nbsp; Δ2θ = −${fr('2s cos θ', 'R')}`,
    eqNote: 'Focusing-circle radius, and the peak shift caused by a sample surface displaced by s from the axis.',
    plot: { title: 'Irradiated sample length vs 2θ', xl: '2θ [°]', yl: 'length [mm]', x: [5, 120], y: [0, 30], series: [{ f: (tt) => (240 * 1 * rad) / Math.sin((tt / 2) * rad), c: 'dim', name: '1° slit', lx: 40 }, { f: (tt) => (240 * 0.5 * rad) / Math.sin((tt / 2) * rad), c: 'accent', name: '½°', lx: 16 }, { f: (tt) => (240 * 0.25 * rad) / Math.sin((tt / 2) * rad), c: 'fg', name: '¼°', lx: 8 }], hl: [{ y: 20, name: 'sample width' }], mark: (f, env) => 2 * (env.theta || 15), markSeries: 1 },
    cam: { p: [1.5, 3.2, 27], t: [0.6, 1.2, 0], shift: 0.16 },
    labels: [['X-RAY TUBE', [-4.4, 4.6, 0]], ['SAMPLE', [0.3, 0, 0.4], 'd'], ['DETECTOR', [4.4, 4.6, 0]], ['FOCUSING CIRCLE', [0, 5.4, 0]]],
    labelSplit: -1,
    s: { sweep: 1, focus: 1 },
  },
  {
    id: 'bragg', accent: '#b7ff54', nav: 'Bragg’s law',
    title: 'Planes that\nreflect in step', kicker: 'Bragg’s law',
    copy: 'A crystal is a stack of identical atomic planes a distance d apart. The wave scattered from the second plane travels 2d sin θ farther than the wave from the first. When that detour is a whole number of wavelengths every plane adds in phase and a reflection appears; at any other angle the planes cancel.',
    points: [
      ['One angle per spacing', 'Each family of planes (hkl) has its own d and therefore its own 2θ.'],
      ['Wavelength matters', 'λ must be comparable to d: 0.5–2.5 Å for crystals, so X-rays, electrons or neutrons.'],
      ['Cubic crystals', 'd = a / √(h² + k² + l²): one lattice parameter fixes every peak position.'],
    ],
    readouts: (f, env) => { const th = env.theta || 15, d = 1.54056 / (2 * Math.sin(th * rad)); return [['θ', th.toFixed(2), '°'], ['Path difference 2d sin θ', '1.5406', 'Å'], ['Plane spacing d', d.toFixed(4), 'Å'], ['Si 111 · 220 · 311', '28.44 · 47.30 · 56.12', '° 2θ']]; },
    eq: `nλ = 2 d<sub>hkl</sub> sin θ`,
    eqNote: 'W. L. Bragg, 1912. Equivalent to the Laue condition: the scattering vector equals a reciprocal-lattice vector.',
    plot: { title: 'Diffraction angle vs plane spacing', xl: 'd [Å]', yl: '2θ [°]', x: [0.8, 4], y: [0, 160], series: [{ f: (d) => (1.54056 / (2 * d) < 1 ? 2 * Math.asin(1.54056 / (2 * d)) / rad : NaN), c: 'accent', name: 'Cu Kα', lx: 1.6 }, { f: (d) => 2 * Math.asin(0.7093 / (2 * d)) / rad, c: 'fg', name: 'Mo Kα', lx: 1.0 }, { f: (d) => (2.2897 / (2 * d) < 1 ? 2 * Math.asin(2.2897 / (2 * d)) / rad : NaN), c: 'dim', name: 'Cr Kα', lx: 2.6 }], mark: (f, env) => 1.54056 / (2 * Math.sin((env.theta || 15) * rad)) },
    cam: { p: [0.4, 0.6, 15], t: [0.2, -0.5, 0], shift: 0.22 },
    labels: [['INCIDENT WAVE', [-1.6, 0.55, 0.12]], ['EXTRA PATH 2d sin θ', [0.0, -0.55, 0.12], 'd'], ['LATTICE PLANES', [2.6, -1.1, 0.1], 'd']],
    labelSplit: -1,
    s: { sweep: 1, lattice: 1 },
    see: [['TEM · electron diffraction', 'tem.html#diffraction'], ['SEM · EBSD', 'sem.html#ebsd']],
  },
  {
    id: 'powder', accent: '#18ff92', nav: 'Powder & cones',
    title: 'Every orientation\nat once', kicker: 'Powder diffraction',
    copy: 'A single crystal must be turned to find each reflection. A powder contains millions of crystallites in random orientations, so for every plane family some grains are always at the Bragg angle. Their reflected beams form a cone of half-angle 2θ around the incident beam; the detector cuts across the cones.',
    points: [
      ['Debye–Scherrer cones', 'One cone per d-spacing; on an area detector they appear as concentric rings.'],
      ['Particle statistics', 'Too few or too coarse grains give spotty rings and unreliable intensities; aim for 1–10 µm.'],
      ['Preferred orientation', 'Plates and needles lie flat: some reflections are exaggerated. Spin, side-load or correct.'],
    ],
    readouts: (f) => [['Crystallites in beam', Math.round(10 ** lerp(1.2, 4, clamp(f * 1.2))).toLocaleString('en-US'), ''], ['Relative error ∝ 1/√N', (100 / Math.sqrt(10 ** lerp(1.2, 4, clamp(f * 1.2)) * 0.02)).toFixed(0), '%'], ['Ewald radius 1/λ', (1 / 1.54056).toFixed(3), 'Å⁻¹'], ['Cone half-angle', '2θ', '']],
    eq: `|<b>g</b><sub>hkl</sub>| = ${fr('1', 'd<sub>hkl</sub>')} = ${fr('2 sin θ', 'λ')}`,
    eqNote: 'A powder turns each reciprocal-lattice point into a sphere; the Ewald sphere cuts it in a circle: the cone.',
    plot: { title: 'Area-detector view of the Debye rings (Si)', draw: (c, f) => drawRings(c, f), tall: true },
    cam: { p: [7, 5, 24], t: [0.8, 1.0, 0], shift: 0.14 },
    labels: [['DEBYE–SCHERRER CONES', [3.0, 3.6, 1.4]], ['INCIDENT BEAM', [-2.4, 1.05, 0]]],
    labelSplit: -1,
    s: { theta: 23.65, cones: 1 },
  },
  {
    id: 'structure', accent: '#17f1d1', nav: 'Structure factor',
    title: 'Why some peaks\nare missing', kicker: 'Structure factor',
    copy: 'Bragg’s law says where a reflection may appear, not whether it does. Each atom in the unit cell scatters with its own phase; add them up and some reflections vanish exactly. Body-centred cells lose every reflection with h + k + l odd, face-centred cells keep only unmixed indices, and diamond drops more still.',
    points: [
      ['Systematic absences', 'They identify the Bravais lattice and, with glide planes and screw axes, the space group.'],
      ['Form factor', 'Each atom scatters in proportion to its electrons, falling off with sin θ/λ.'],
      ['Ordering', 'NaCl and KCl share a lattice, yet KCl looks primitive: K⁺ and Cl⁻ scatter almost equally.'],
    ],
    readouts: () => [['bcc allowed', 'h + k + l even', ''], ['fcc allowed', 'all odd or all even', ''], ['diamond: also', 'h + k + l ≠ 4n + 2', ''], ['Si 222', 'forbidden', '|F| = 0'], ['f(Si) at 111', formFactor(14, 0.1595).toFixed(1), 'e⁻']],
    eq: `F<sub>hkl</sub> = Σ<sub>j</sub> f<sub>j</sub> e<sup>2πi(hx<sub>j</sub> + ky<sub>j</sub> + lz<sub>j</sub>)</sup>`,
    eqNote: 'Sum over the atoms j of the unit cell. The measured intensity is proportional to |F|².',
    plot: { title: 'Allowed reflections by lattice type', draw: (c) => drawAbsences(c) },
    cam: { p: [0.4, 0.6, 15], t: [0.2, -0.5, 0], shift: 0.22 },
    labels: [],
    s: { theta: 14.22, lattice: 1 },
  },
  {
    id: 'intensity', accent: '#5ac8ff', nav: 'Intensities',
    title: 'What sets\nthe peak height', kicker: 'Integrated intensity',
    copy: 'The area under a powder peak is a product of factors, each with a physical cause: how strongly the cell scatters, how many equivalent planes contribute, how the geometry weights each angle, how thermal vibration smears the atoms, and how much sample the beam actually sees.',
    points: [
      ['Multiplicity', 'A cubic {100} has 6 equivalent planes, {110} 12, {111} 8, a general {hkl} 48.'],
      ['Lorentz–polarisation', 'Strongly favours low and very high angles; minimum near 2θ ≈ 100°.'],
      ['Debye–Waller', 'Thermal motion multiplies |F|² by exp(−2B sin²θ/λ²): high-angle peaks fade with temperature.'],
    ],
    readouts: (f) => { const tt = lerp(15, 140, clamp(f * 1.1)), th = (tt / 2) * rad, s = Math.sin(th) / 1.54056; return [['2θ', tt.toFixed(0), '°'], ['Lorentz–polarisation', ((1 + Math.cos(2 * th) ** 2) / (Math.sin(th) ** 2 * Math.cos(th))).toFixed(1), ''], ['f(Si) / Z', (formFactor(14, s) / 14).toFixed(2), ''], ['Debye–Waller (B = 0.5 Å²)', Math.exp(-2 * 0.5 * s * s).toFixed(2), '']]; },
    eq: `I<sub>hkl</sub> ∝ |F<sub>hkl</sub>|² · m · ${fr('1 + cos² 2θ', 'sin² θ cos θ')} · e<sup>−2B sin²θ/λ²</sup>`,
    eqNote: 'Bragg–Brentano geometry with an infinitely thick sample, where the absorption factor is independent of angle.',
    plot: { title: 'Angle-dependent intensity factors', xl: '2θ [°]', yl: 'relative', ly: true, x: [10, 150], y: [0.1, 100], series: [{ f: (tt) => { const th = (tt / 2) * rad; return (1 + Math.cos(2 * th) ** 2) / (Math.sin(th) ** 2 * Math.cos(th)); }, c: 'accent', name: 'LP', lx: 22 }, { f: (tt) => (formFactor(14, Math.sin((tt / 2) * rad) / 1.54056) / 14) ** 2 * 10, c: 'fg', name: '(f/Z)² ×10', lx: 60 }, { f: (tt) => Math.exp(-2 * 0.5 * (Math.sin((tt / 2) * rad) / 1.54056) ** 2) * 10, c: 'dim', name: 'D–W ×10', lx: 110 }], mark: (f) => lerp(15, 140, clamp(f * 1.1)) },
    cam: { p: [1.5, 3.2, 27], t: [0.6, 1.2, 0], shift: 0.16 },
    labels: [],
    s: { sweep: 1 },
  },
  {
    id: 'detector', accent: '#8e9bff', nav: 'Detector',
    title: 'Count photons,\nstep by step', kicker: 'Detection',
    copy: 'Behind the receiving slit a detector converts each photon into a pulse and counts. Photon arrival is random, so a measured N carries an uncertainty of √N: precision is bought with time. Silicon strip detectors record a few degrees of 2θ at once and cut measuring time a hundredfold.',
    points: [
      ['Point detectors', 'Scintillation or proportional counters behind a slit: simple, with good energy discrimination.'],
      ['Strip and area detectors', '100+ channels in parallel; 2D versions show rings, texture and grain statistics directly.'],
      ['Step and time', 'Typically 0.01–0.02° steps; at least 5–10 points across the FWHM.'],
    ],
    readouts: (f) => { const T = 10 ** lerp(-1.3, 1, clamp(f * 1.15)), N = 940 * T; return [['Time per step', T < 1 ? (T * 1000).toFixed(0) : T.toFixed(1), T < 1 ? 'ms' : 's'], ['Peak counts', N.toFixed(0), ''], ['Relative error 1/√N', (100 / Math.sqrt(N)).toFixed(1), '%'], ['Scan 10–120° @ 0.02°', ((5500 * T) / 60).toFixed(0), 'min']]; },
    eq: `σ<sub>N</sub> = ${rt('N')} &nbsp;⇒&nbsp; ${fr('σ', 'N')} = ${fr('1', rt('N'))}`,
    eqNote: 'Poisson counting statistics. Halving the noise costs four times the measuring time.',
    plot: { title: 'One reflection at increasing counting time', draw: (c, f, env) => drawCounting(c, f, env), live: true },
    cam: { p: [4.8, 2.4, 11], t: [3.3, 0.95, 0], shift: 0.2, shiftY: -0.14 },
    labels: [['ANTI-SCATTER SLIT', arm(1, 2.2, 15, 0.36)], ['SOLLER SLIT', arm(1, 2.9, 15, -0.24), 'd'], ['Kβ FILTER', arm(1, 3.4, 15, 0.2)], ['RECEIVING SLIT', arm(1, 3.95, 15, -0.32), 'd'], ['DETECTOR', arm(1, 4.6, 15, 0.42)]],
    labelSplit: -9,
    s: { theta: 15 },
  },
  {
    id: 'profile', accent: '#c58bff', nav: 'Peak shape',
    title: 'Read the width,\nnot just the place', kicker: 'Peak profile',
    copy: 'A perfect, large crystal gives a peak as narrow as the instrument allows. Real peaks are wider. Small crystallites contain too few planes to cancel just off the Bragg angle; a spread of lattice strain shifts each grain’s peak slightly. The two effects grow differently with angle, which lets them be separated.',
    points: [
      ['Scherrer', 'Size broadening ∝ 1/(L cos θ): useful from ~2 to ~150 nm.'],
      ['Microstrain', 'Broadening ∝ tan θ, from dislocations, coherency stresses or composition gradients.'],
      ['Instrument function', 'Measured on a strain-free standard such as LaB₆ or Si and removed before analysis.'],
    ],
    readouts: (f) => { const Lc = sizeAt(f), th = 14.22 * rad; const gL = sizeFWHM(th, 1.54056, Lc), gG = instFWHM(th); return [['Crystallite size', Lc >= 10 ? Lc.toFixed(0) : Lc.toFixed(1), 'nm'], ['Size broadening (111)', gL.toFixed(3), '° 2θ'], ['Instrument FWHM', gG.toFixed(3), '° 2θ'], ['Observed FWHM', tch(gG, gL).G.toFixed(3), '° 2θ'], ['Planes per crystallite', (Lc * 10 / 3.1355).toFixed(0), '']]; },
    eq: `β<sub>size</sub> = ${fr('Kλ', 'L cos θ')} , &nbsp; β<sub>strain</sub> = 4ε tan θ`,
    eqNote: 'Scherrer equation (K ≈ 0.9) and Stokes–Wilson strain broadening; β in radians of 2θ.',
    plot: { title: 'Si 111 profile vs crystallite size', xl: '2θ [°]', yl: 'intensity', x: [26.4, 30.5], y: [0, 1.05], n: 400, series: (env) => { const th = 14.22 * rad, mk = (Lc) => { const { G, eta } = tch(instFWHM(th), sizeFWHM(th, 1.54056, Lc)); return (x) => pseudoVoigt(x - 28.44, G, eta) + 0.5 * pseudoVoigt(x - 28.513, G, eta) * 0 ; }; return [{ f: mk(1000), c: 'dim', dash: [3, 3], name: 'instrument', lx: 28.6 }, { f: mk(env.L || 50), c: 'accent', w: 2 }]; } },
    cam: { p: [7.8, 1.8, 11], t: [8.2, 1.4, 0], shift: 0.2 },
    labels: [['DIFFRACTOGRAM', [9.4, 2.55, 0]]],
    labelSplit: -9,
    s: { sweep: 1, monitor: 1 },
    see: [['TEM · direct lattice imaging', 'tem.html#hrtem']],
  },
  {
    id: 'analysis', accent: '#d93a3a', nav: 'Analysis', light: true,
    title: 'From pattern\nto answers', kicker: 'Analysis',
    copy: 'A diffractogram is a fingerprint. Peak positions give the unit cell and identify phases against a database of several hundred thousand patterns. Intensities give how much of each phase and where the atoms sit. Widths give crystallite size and strain. Rietveld refinement fits all of it at once.',
    points: [
      ['Phase identification', 'Search–match of d-spacings and intensities; quantification by reference intensity ratio or Rietveld.'],
      ['Stress and texture', 'sin²ψ plots measure residual stress from peak shifts; pole figures map preferred orientation.'],
      ['Thin films', 'Grazing incidence, reflectivity and rocking curves give thickness, density, roughness and epitaxial quality.'],
    ],
    readouts: () => { const r = reflections(MATERIALS.Si, 1.54056, { tthMax: 60 }); return [['Phase', 'Si, Fd3̄m', ''], ['Lattice parameter', '5.4309', 'Å'], ...r.slice(0, 3).map((p) => [`${p.h}${p.k}${p.l}`, p.tth.toFixed(2), `° · ${p.I.toFixed(0)} %`])]; },
    eq: `S = Σ<sub>i</sub> w<sub>i</sub> (y<sub>i</sub><sup>obs</sup> − y<sub>i</sub><sup>calc</sup>)²`,
    eqNote: 'Rietveld refinement minimises the weighted difference over every point of the pattern, w<sub>i</sub> = 1/y<sub>i</sub>.',
    plot: { title: 'Williamson–Hall: size from intercept, strain from slope', xl: '4 sin θ', yl: 'β cos θ [10⁻³]', x: [0, 3.6], y: [0, 6], series: [{ f: (x) => (0.9 * 1.54056) / (40 * 10) * 1e3 + 0.0008 * x * 1e3, c: 'accent', name: '40 nm, ε = 0.08 %', lx: 0.3 }, { f: (x) => (0.9 * 1.54056) / (40 * 10) * 1e3, c: 'dim', dash: [3, 3], name: 'size only', lx: 2.2 }] },
    cam: { p: [7.8, 1.8, 9], t: [8.2, 1.3, 0], shift: 0.2 },
    labels: [],
    s: { sweep: 1, monitor: 1 },
  },
];
export { R };
