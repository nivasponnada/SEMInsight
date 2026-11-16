// The fifteen stages of the journey: copy, live readouts, governing equation, mini plot
// and the 3D choreography (camera, labels, scene parameters) for each.
import {
  K, wavelength, betaRel, richardson, schottkyLowering, meanFreePath, probe, lensCoefficients,
  rangeKO, eta, delta, skirtRadius, MATERIALS, fmtLen, fmtCurrent, fmtExp,
} from './physics.js';
import { drawStigmator, drawScan, drawKikuchi, drawLineScan, edsSpectrum } from './plots.js';

const fr = (a, b) => `<span class="fr"><span>${a}</span><span>${b}</span></span>`;
const rt = (x) => `<span class="rt">√<span>${x}</span></span>`;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const L = (m) => fmtLen(m);

export const SIG = { beam: '#8fe9ff', se: '#ffc730', bse: '#ff4b4b', xray: '#b08cff', light: '#b7ff54' };

// Optimum-aperture probe size for a given set of conditions.
function bestProbe(V, Ip, Cs, Cc) {
  let best = null;
  for (let i = 0; i <= 60; i++) {
    const alpha = 10 ** (-3.6 + (i / 60) * 1.9);
    const p = probe({ V, Ip, alpha, Cs, Cc });
    if (!best || p.d < best.d) best = { ...p, alpha };
  }
  return best;
}
// Retarding-field model: C_eff = C / (1 + (k-1) C / L), k = E_column / E_landing.
const decel = (C, k, Lf = 4e-3) => C / (1 + ((k - 1) * C) / Lf);
function probeLanding(EL, withDecel) {
  const { Cs, Cc } = lensCoefficients(3);
  if (!withDecel) return bestProbe(EL, 20e-12, Cs, Cc).d;
  const k = Math.max(1, 5000 / EL);
  return bestProbe(EL, 20e-12, decel(Cs, k), decel(Cc, k)).d;
}
function totalYield(E, m) { return delta(E, m) + eta(m.Z); }
function findE2(m) {
  let lo = m.Em, hi = 30;
  if (totalYield(lo, m) < 1) return null;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; totalYield(mid, m) > 1 ? (lo = mid) : (hi = mid); }
  return lo;
}

export const STAGES = [
  // ------------------------------------------------------------------ 0
  {
    id: 'vacuum', accent: '#8e9bff', nav: 'Vacuum',
    title: 'Empty the path', kicker: 'Vacuum system',
    copy: 'An electron beam only survives where there is almost nothing to hit. Differential pumping holds the gun eight orders of magnitude below the chamber, so the emitter stays clean while specimens are exchanged in minutes.',
    points: [
      ['Ion getter pumps', 'Gun and upper column at 10⁻⁹–10⁻¹⁰ mbar; no moving parts, no vibration.'],
      ['Turbomolecular + scroll', 'Oil-free chamber pumping to ~10⁻⁶ mbar behind a column isolation valve.'],
      ['Why it matters', 'Emitter chemistry, high-voltage stability, and a mean free path far longer than the column.'],
    ],
    readouts: (f) => {
      const p = 10 ** lerp(3, -5.3, clamp(f * 1.15));
      return [
        ['Chamber', fmtExp(p), 'mbar'],
        ['Mean free path', ...L(meanFreePath(p))],
        ['Column', '5.0×10⁻⁷', 'mbar'],
        ['Gun (IGP)', '2.0×10⁻⁹', 'mbar'],
      ];
    },
    eq: `λ = ${fr('k<sub>B</sub>T', '√2 · π d² · p')}`,
    eqNote: 'Mean free path of the residual gas (air, 293 K: λ ≈ 6.6 cm at 10⁻³ mbar).',
    plot: {
      title: 'Mean free path vs pressure', xl: 'p [mbar]', yl: 'λ [m]', lx: true, ly: true,
      x: [1e-9, 1e3], y: [1e-8, 1e5],
      series: [{ f: (p) => meanFreePath(p), c: 'accent' }],
      hl: [{ y: 1, name: 'column length ≈ 1 m' }],
      mark: (f) => 10 ** lerp(3, -5.3, clamp(f * 1.15)),
    },
    cam: { p: [10.5, 6, 25], t: [0, 4.1, 0] },
    labels: [['ION GETTER PUMP', [-2.0, 10.2, 0]], ['ISOLATION VALVE', [1.3, 8.55, 0]], ['TURBO PUMP', [1.6, -2.9, 0]]],
    s: { cover: 1 },
  },
  // ------------------------------------------------------------------ 1
  {
    id: 'gun', accent: '#ff4b4b', nav: 'Gun',
    title: 'Schottky\nfield emitter', kicker: 'Electron source',
    copy: 'A ⟨100⟩ tungsten single crystal, sharpened to a ~0.5 µm radius and wetted with zirconium oxide, runs at 1800 K. The extractor field lowers the surface barrier, so electrons boil over it from a virtual source only ~20 nm wide.',
    points: [
      ['ZrO / W(100)', 'ZrO lowers the work function from 4.5 to ~2.8 eV on the (100) facet only.'],
      ['Suppressor', 'Biased −300 V to the tip; blocks stray thermionic emission from the shank.'],
      ['Extractor', '+2 to +5 kV sets the tip field (~1 V/nm) and the angular intensity.'],
    ],
    readouts: (f) => {
      const F = lerp(0.05e9, 1.0e9, clamp(f * 1.2));
      const J = richardson(1800, 2.8, F);
      return [
        ['Extractor', (F * 4.5e-6).toFixed(0), 'V'],
        ['Tip field', (F * 1e-9).toFixed(2), 'V/nm'],
        ['Barrier lowering', schottkyLowering(F).toFixed(2), 'eV'],
        ['Current density', fmtExp(J * 1e-4), 'A/cm²'],
        ['Energy spread', '0.7', 'eV'],
      ];
    },
    eq: `J = A T² exp<span class="big">(</span>−${fr(`φ − ${rt('e³F / 4πε₀')}`, 'k<sub>B</sub>T')}<span class="big">)</span>`,
    eqNote: 'Richardson–Schottky emission. Reduced brightness ≈ 10⁸ A m⁻² sr⁻¹ V⁻¹: 10³× a tungsten hairpin.',
    plot: {
      title: 'Emission vs temperature', xl: 'T [K]', yl: 'J [A/cm²]', ly: true,
      x: [1200, 3000], y: [1e-4, 1e6],
      series: [
        { f: (T) => richardson(T, 2.8, 1e9) * 1e-4, c: 'accent', name: 'Schottky', lx: 1300 },
        { f: (T) => richardson(T, 2.7) * 1e-4, c: '#ffc730', name: 'LaB₆', lx: 1750 },
        { f: (T) => richardson(T, 4.5) * 1e-4, c: 'dim', name: 'W hairpin', lx: 2350 },
      ],
      mark: () => 1800,
    },
    cam: { p: [2.42, 11.08, 5.95], t: [0.28, 9.72, 0.0] },
    labels: [['SUPPRESSOR', [0.4, 10.2, 0]], ['ZrO/W TIP', [0.03, 9.97, 0]], ['EXTRACTOR', [0.7, 9.72, 0]]],
    table: {
      head: ['', 'W', 'LaB₆', 'Schottky', 'Cold FE'],
      rows: [
        ['T [K]', '2700', '1800', '1800', '300'],
        ['Brightness [A/cm²sr]', '10⁵', '10⁶', '10⁸', '10⁹'],
        ['ΔE [eV]', '1–3', '1–2', '0.3–1.0', '0.3'],
        ['Source size', '30–100 µm', '5–50 µm', '15–30 nm', '<5 nm'],
        ['Vacuum [mbar]', '10⁻⁵', '10⁻⁷', '10⁻⁹', '10⁻¹⁰'],
        ['Stability [%/h]', '<1', '<1', '<1', '~5'],
      ],
    },
  },
  // ------------------------------------------------------------------ 2
  {
    id: 'accelerate', accent: '#ff8f42', nav: 'Acceleration',
    title: 'Fall through\nthe potential', kicker: 'Acceleration',
    copy: 'The tip floats at the negative high voltage; the anode sits at ground. Crossing that gap, every electron gains the same energy and its wavelength shrinks to picometres, far below any lens-limited probe size.',
    points: [
      ['0.1 – 30 kV', 'Low kV for surface detail and insulators, high kV for X-ray excitation and resolution.'],
      ['Relativistic', 'At 30 kV electrons already travel at 0.33 c; the wavelength needs the correction term.'],
      ['Brightness is conserved', 'β/V is invariant down the column: no lens can make the source brighter.'],
    ],
    readouts: (f) => {
      const V = Math.max(100, 15000 * clamp(f * 1.25));
      return [
        ['Beam energy', (V / 1000).toFixed(2), 'keV'],
        ['Wavelength', ...L(wavelength(V))],
        ['Velocity', betaRel(V).toFixed(3), 'c'],
        ['Brightness', fmtExp(1e8 * V * 1e-4), 'A/cm²sr'],
      ];
    },
    eq: `λ = ${fr('h', rt('2m₀eV (1 + eV / 2m₀c²)'))}`,
    eqNote: 'de Broglie wavelength: 38.8 pm at 1 kV, 9.94 pm at 15 kV, 6.98 pm at 30 kV.',
    plot: {
      title: 'Wavelength vs accelerating voltage', xl: 'V [kV]', yl: 'λ [pm]', lx: true, ly: true,
      x: [0.1, 30], y: [5, 150],
      series: [{ f: (kv) => wavelength(kv * 1000) * 1e12, c: 'accent' }],
      mark: (f) => Math.max(0.1, 15 * clamp(f * 1.25)),
    },
    cam: { p: [3.67, 10.25, 7.8], t: [0.45, 9.2, 0.0] },
    labels: [['TIP · −HV', [0.03, 9.97, 0]], ['EXTRACTOR', [0.72, 9.8, 0]], ['ANODE · 0 V', [0.9, 9.05, 0]]],
  },
  // ------------------------------------------------------------------ 3
  {
    id: 'condenser', accent: '#ffc730', nav: 'Condensers',
    title: 'Squeeze\nthe source', kicker: 'Condenser lenses',
    copy: 'Each electromagnetic lens is a copper coil inside an iron yoke; the field leaks out only at the pole-piece gap. Its axial component bends spiralling electrons back to the axis, forming a demagnified image of the source at each crossover.',
    points: [
      ['Always converging', 'Focusing power scales with B², so reversing the current changes nothing but the image rotation.'],
      ['Spot size control', 'A stronger C1 moves the crossover up: smaller source image, less current through the aperture.'],
      ['Crossover-free designs', 'Some FE columns avoid intermediate crossovers to limit Boersch energy broadening.'],
    ],
    readouts: (f) => {
      const NI = lerp(520, 1050, clamp(f * 1.15));
      const fl = (25 * 15220) / (NI * NI) * 10; // mm, (S+D) = 1 cm
      const u = 110;
      const M = fl / (u - fl);
      return [
        ['C1 excitation', NI.toFixed(0), 'A·turns'],
        ['Focal length', fl.toFixed(1), 'mm'],
        ['Demagnification', (1 / M).toFixed(1), '×'],
        ['Source image', (20 * M).toFixed(2), 'nm'],
      ];
    },
    eq: `${fr('1', 'f')} = ${fr('e', '8m₀V*')} ∫ B<sub>z</sub>²(z) dz`,
    eqNote: 'Thin magnetic lens; V* is the relativistically corrected potential. Image rotation θ = √(e/8m₀V*) ∫B<sub>z</sub> dz.',
    plot: {
      title: 'Focal length vs excitation (15 kV)', xl: 'NI [A·turns]', yl: 'f [mm]',
      x: [400, 1200], y: [0, 25],
      series: [{ f: (ni) => (25 * 15220) / (ni * ni) * 10, c: 'accent' }],
      mark: (f) => lerp(520, 1050, clamp(f * 1.15)),
    },
    cam: { p: [4.62, 7.86, 9.99], t: [0.7, 6.85, 0.0] },
    labels: [['C1 COIL', [0.78, 7.75, 0]], ['IRON YOKE', [1.1, 8.0, 0]], ['POLE-PIECE GAP', [-0.25, 7.6, 0]], ['CROSSOVER', [0.03, 6.9, 0]], ['C2', [1.1, 6.3, 0]]],
  },
  // ------------------------------------------------------------------ 4
  {
    id: 'aperture', accent: '#b7ff54', nav: 'Apertures',
    title: 'Trade current\nfor angle', kicker: 'Apertures',
    copy: 'A platinum or molybdenum foil with a laser-drilled hole passes only the paraxial core of the beam. The diameter fixes the convergence semi-angle α at the specimen, and with it probe current, aberrations and depth of field.',
    points: [
      ['Probe current ∝ α²', 'At constant brightness, halving the aperture quarters the current.'],
      ['Depth of field ∝ 1/α', 'Small apertures keep rough surfaces in focus over hundreds of micrometres.'],
      ['Spray apertures', 'Fixed diaphragms upstream intercept scattered electrons and limit contamination.'],
    ],
    readouts: (f) => {
      const d = [120, 60, 30, 20][Math.min(3, Math.floor(clamp(f) * 4.2))];
      const alpha = (d / 2) * 1e-6 / 8e-3;
      return [
        ['Aperture', d.toFixed(0), 'µm'],
        ['Semi-angle α', (alpha * 1e3).toFixed(2), 'mrad'],
        ['Probe current', ...fmtCurrent(100e-12 * (d / 30) ** 2)],
        ['Depth of field @1k×', ((2 * 124e-9) / alpha * 1e6).toFixed(0), 'µm'],
      ];
    },
    eq: `I<sub>p</sub> = β · ${fr('π² d<sub>g</sub>² α²', '4')}`,
    eqNote: 'Brightness equation: current in a probe of Gaussian diameter d<sub>g</sub> and semi-angle α.',
    plot: {
      title: 'Current and depth of field vs aperture', xl: 'aperture [µm]', yl: 'relative', ly: true,
      x: [10, 120], y: [0.05, 20],
      series: [
        { f: (d) => (d / 30) ** 2, c: 'accent', name: 'Iₚ', lx: 70 },
        { f: (d) => 30 / d, c: 'fg', name: 'DOF', lx: 14 },
      ],
      mark: (f) => [120, 60, 30, 20][Math.min(3, Math.floor(clamp(f) * 4.2))],
    },
    cam: { p: [3.63, 6.23, 7.36], t: [0.35, 5.35, 0.0] },
    labels: [['APERTURE STRIP', [-0.75, 5.3, 0]], ['CROSSOVER', [0.03, 5.75, 0]], ['CLIPPED BEAM', [0.1, 5.33, 0]]],
  },
  // ------------------------------------------------------------------ 5
  {
    id: 'stigmator', accent: '#18ff92', nav: 'Stigmator',
    title: 'Round\nthe probe', kicker: 'Stigmator & alignment',
    copy: 'Machining tolerances, magnetic inhomogeneity and charged contamination make every lens slightly cylindrical: two line foci instead of one point. An octupole of small coils adds an opposite, adjustable quadrupole field that cancels it.',
    points: [
      ['Two quadrupoles at 45°', 'Stigmator X and Y set the magnitude and azimuth of the correction.'],
      ['Diagnosis', 'Features streak in one direction under focus and at 90° to it over focus.'],
      ['Alignment coils', 'Gun shift/tilt and aperture alignment steer the beam onto the optical axis (wobbler).'],
    ],
    readouts: (f) => {
      const a = 1 - clamp(f * 1.25);
      return [
        ['Astigmatism Δf', (18 * a).toFixed(1), 'µm'],
        ['Disc of least confusion', (18e-6 * a * 2e-3 * 1e9).toFixed(1), 'nm'],
        ['Stig X', (41 * (1 - a)).toFixed(0), 'mA'],
        ['Stig Y', (-17 * (1 - a)).toFixed(0), 'mA'],
      ];
    },
    eq: `d<sub>A</sub> = Δf<sub>A</sub> · α`,
    eqNote: 'Diameter of the disc of least confusion between the two line foci separated by Δf<sub>A</sub>.',
    plot: { title: 'Probe cross-section through focus', draw: (c, f) => drawStigmator(c, f), live: true },
    cam: { p: [3.34, 5.72, 6.4], t: [0.3, 4.6, 0.0] },
    labels: [['OCTUPOLE STIGMATOR', [-0.4, 4.55, 0]], ['ALIGNMENT COILS', [0.48, 5.0, 0]]],
  },
  // ------------------------------------------------------------------ 6
  {
    id: 'scan', accent: '#17f1d1', nav: 'Scan coils',
    title: 'Draw the raster', kicker: 'Scan coils',
    copy: 'Two stacked pairs of deflection coils bend the beam off axis and back again so that it pivots at the objective aperture plane. Nothing is imaged optically: magnification is just the ratio of display width to scanned width.',
    points: [
      ['Double deflection', 'Rocking about the lens centre keeps the beam inside the bore at any scan size.'],
      ['Magnification', 'M = L<sub>display</sub> / L<sub>scan</sub>. Zooming in means driving the coils with less current.'],
      ['Dwell time', '50 ns to 100 µs per pixel; the scan generator clocks the digitiser in lock-step.'],
    ],
    readouts: (f) => {
      const M = 10 ** lerp(2, 5.3, clamp(f * 1.1));
      const hfw = 0.127 / M;
      return [
        ['Magnification', M >= 1000 ? (M / 1000).toFixed(M >= 1e4 ? 0 : 1) + 'k' : M.toFixed(0), '×'],
        ['Field width', ...L(hfw)],
        ['Pixel (1024 px)', ...L(hfw / 1024)],
        ['Frame @ 1 µs dwell', '0.91', 's'],
      ];
    },
    eq: `M = ${fr('L<sub>display</sub>', 'L<sub>specimen</sub>')}`,
    eqNote: 'Referred to a 127 mm (5-inch) print; field width is the unambiguous quantity.',
    plot: { title: 'Scan generator waveforms', draw: (c, f, env) => drawScan(c, f, env), live: true },
    cam: { p: [3.88, 4.6, 7.84], t: [0.45, 3.2, 0.0] },
    labels: [['UPPER SCAN COILS', [0.52, 3.9, 0]], ['LOWER SCAN COILS', [-0.47, 3.3, 0]], ['PIVOT POINT', [0.03, 1.25, 0]]],
    s: { scan: 1 },
  },
  // ------------------------------------------------------------------ 7
  {
    id: 'objective', accent: '#5ac8ff', nav: 'Objective',
    title: 'Form the probe', kicker: 'Objective lens',
    copy: 'The final lens images the last crossover onto the specimen. Its conical pole piece leaves room for detectors and tilt, and its aberrations decide the smallest probe: too small an angle and diffraction wins, too large and spherical aberration takes over.',
    points: [
      ['Spherical · chromatic', 'd<sub>s</sub> = ½C<sub>s</sub>α³ and d<sub>c</sub> = C<sub>c</sub>(ΔE/E)α; chromatic dominates below ~5 kV.'],
      ['Working distance', 'Shorter WD means lower C<sub>s</sub>, C<sub>c</sub> and a finer probe, at the cost of depth of field.'],
      ['Focus', 'Lens current places the crossover on the surface; wobbling it checks aperture centring.'],
    ],
    readouts: (f) => {
      const alpha = 10 ** lerp(-3.5, -1.85, clamp(f * 1.1));
      const { Cs, Cc } = lensCoefficients(5);
      const p = probe({ V: 15000, Ip: 50e-12, alpha, Cs, Cc });
      const dom = Object.entries({ source: p.dg, spherical: p.ds, chromatic: p.dc, diffraction: p.dd }).sort((a, b) => b[1] - a[1])[0][0];
      return [
        ['Semi-angle α', (alpha * 1e3).toFixed(2), 'mrad'],
        ['Probe diameter', ...L(p.d)],
        ['Limited by', dom, ''],
        ['C<sub>s</sub> / C<sub>c</sub> @ WD 5', `${(Cs * 1e3).toFixed(0)} / ${(Cc * 1e3).toFixed(0)}`, 'mm'],
      ];
    },
    eq: `d<sub>p</sub> = ${rt('d<sub>g</sub>² + (½C<sub>s</sub>α³)² + (C<sub>c</sub>α ΔE/E)² + (0.61λ/α)²')}`,
    eqNote: 'Quadrature sum of source image, spherical, chromatic and diffraction discs.',
    plot: {
      title: 'Probe size vs convergence angle (15 kV, 50 pA)', xl: 'α [mrad]', yl: 'd [nm]', lx: true, ly: true,
      x: [0.3, 15], y: [0.1, 100],
      series: (() => {
        const { Cs, Cc } = lensCoefficients(5);
        const P = (a) => probe({ V: 15000, Ip: 50e-12, alpha: a * 1e-3, Cs, Cc });
        return [
          { f: (a) => P(a).d * 1e9, c: 'accent', w: 2 },
          { f: (a) => P(a).dd * 1e9, c: 'dim', dash: [3, 3], name: 'diffraction', lx: 0.33 },
          { f: (a) => P(a).dg * 1e9, c: 'dim', dash: [1, 3], name: 'source', lx: 1.6 },
          { f: (a) => P(a).ds * 1e9, c: 'dim', dash: [6, 3], name: 'spherical', lx: 5.2 },
          { f: (a) => P(a).dc * 1e9, c: 'dim', dash: [8, 2, 2, 2], name: 'chromatic', lx: 0.33 },
        ];
      })(),
      mark: (f) => 10 ** lerp(-3.5, -1.85, clamp(f * 1.1)) * 1e3,
    },
    cam: { p: [4.38, 2.15, 8.91], t: [0.6, 1.2, 0.0] },
    labels: [['OBJECTIVE COIL', [0.8, 2.25, 0]], ['CONICAL POLE PIECE', [0.75, 1.42, 0]], ['WORKING DISTANCE', [-0.3, 0.5, 0]], ['SPECIMEN', [0.5, -0.02, 0]]],
    s: { scan: 0.35 },
  },
  // ------------------------------------------------------------------ 8
  {
    id: 'decel', accent: '#5a9cff', nav: 'Deceleration',
    title: 'Brake before\nlanding', kicker: 'Immersion & deceleration',
    copy: 'Low landing energies reveal the true surface and tame charging, but a slow beam is hard to focus. So keep it fast inside the column and decelerate it in the last millimetres, with a biased stage or a retarding electrode inside the lens.',
    points: [
      ['Stage bias', 'E<sub>landing</sub> = E<sub>column</sub> − eV<sub>bias</sub>. The retarding field is itself an electrostatic lens.'],
      ['Magnetic immersion', 'A snorkel or semi-in-lens puts the specimen in the field: C<sub>s</sub>, C<sub>c</sub> drop to 1–3 mm.'],
      ['Beam booster', 'A liner tube at +8 kV carries the beam through the column, insensitive to stray fields.'],
    ],
    readouts: (f) => {
      const EL = 10 ** lerp(Math.log10(5000), Math.log10(200), clamp(f * 1.15));
      return [
        ['Column energy', '5.00', 'keV'],
        ['Stage bias', (-(5000 - EL)).toFixed(0), 'V'],
        ['Landing energy', EL.toFixed(0), 'eV'],
        ['Probe · decelerated', ...L(probeLanding(EL, true))],
        ['Probe · no bias', ...L(probeLanding(EL, false))],
      ];
    },
    eq: `C<sub>eff</sub> ≈ ${fr('C', '1 + (k − 1) C / L')} , &nbsp; k = ${fr('E<sub>column</sub>', 'E<sub>landing</sub>')}`,
    eqNote: 'Retarding-field (cathode-lens) estimate: aberration coefficients tend to L/k for a field of length L.',
    plot: {
      title: 'Probe size vs landing energy (20 pA)', xl: 'E landing [keV]', yl: 'd [nm]', lx: true, ly: true,
      x: [0.1, 5], y: [1, 60],
      series: [
        { f: (e) => probeLanding(e * 1000, true) * 1e9, c: 'accent', name: 'decelerated', lx: 0.12 },
        { f: (e) => probeLanding(e * 1000, false) * 1e9, c: 'dim', dash: [4, 3], name: 'no bias', lx: 0.6 },
      ],
      mark: (f) => 10 ** lerp(Math.log10(5), Math.log10(0.2), clamp(f * 1.15)),
    },
    cam: { p: [3.18, 0.93, 6.24], t: [0.3, 0.45, 0.0] },
    labels: [['POLE PIECE · 0 V', [0.42, 1.0, 0]], ['RETARDING FIELD', [-0.3, 0.5, 0]], ['STAGE · −V BIAS', [-0.42, -0.2, 0]]],
    s: { scan: 0.2, field: 1 },
  },
  // ------------------------------------------------------------------ 9
  {
    id: 'interaction', accent: '#ff6b9d', nav: 'Interaction',
    title: 'One electron,\nmany signals', kicker: 'Beam–specimen interaction',
    copy: 'A nanometre-wide probe does not make a nanometre-wide signal. Elastic collisions with nuclei scatter electrons through large angles while inelastic ones bleed their energy, spreading them through a pear-shaped volume that every signal samples differently.',
    points: [
      ['Secondary electrons', '&lt;50 eV, escape only from the top ~1–10 nm: topography and the highest resolution.'],
      ['Backscattered electrons', 'Retain 50–90 % of E₀, emerge from ~⅓ of the range; yield climbs with Z.'],
      ['X-rays · light · Auger', 'Characteristic lines from the whole volume; Auger electrons only from the first nanometre.'],
    ],
    controls: true,
    readouts: (f, env) => {
      const m = MATERIALS[env.mcMat];
      const sp = SE_ESCAPE[env.mcMat] || 5;
      return [
        ['Range (Kanaya–Okayama)', ...L(rangeKO(env.mcE, m) * 1e-6)],
        ['η Monte Carlo', env.mcEta != null ? env.mcEta.toFixed(3) : '…', ''],
        ['η Reuter fit', eta(m.Z).toFixed(3), ''],
        ['Mean BSE energy', env.mcEta != null ? (env.mcBseE * 100).toFixed(0) : '…', '% E₀'],
        ['SE escape depth', sp.toFixed(0), 'nm'],
      ];
    },
    eq: `R<sub>KO</sub> = ${fr('0.0276 · A · E₀<sup>1.67</sup>', 'Z<sup>0.89</sup> · ρ')} µm`,
    eqNote: 'Trajectories: single-scattering Monte Carlo, screened Rutherford cross-section, Joy–Luo stopping power, run live in your browser.',
    plot: {
      title: 'Energy distribution of emitted electrons', xl: 'E [eV]', yl: 'E · dN/dE', lx: true, n: 400,
      x: [0.3, 30000], y: [0, 1.1],
      series: [{
        f: (E, env) => {
          const E0 = env.mcE * 1000, Zf = MATERIALS[env.mcMat].Z;
          if (E > E0) return NaN;
          const phi = 4.5;
          const se = ((E * E) / (E + phi) ** 4) * 16 * phi * phi; // Chung–Everhart, normalised on a log axis
          const W = E / E0;
          const bse = eta(Zf) * 1.6 * W * W ** (0.6 + Zf / 30) * (1 - W) ** 0.45 * 2.6;
          const el = 0.35 * Math.exp(-(((W - 0.995) / 0.012) ** 2));
          return se * 0.95 + (E > 50 ? bse + el : bse * (E / 50));
        },
        c: 'accent',
      }],
      hl: [],
      vl: [{ x: 50, name: 'SE | BSE' }],
    },
    cam: { p: [1.5, 0.16, 3.0], t: [0.16, -0.14, 0] },
    labels: [['PRIMARY BEAM', [0.02, 0.36, 0]], ['INTERACTION VOLUME', [-0.24, -0.18, 0]]],
    s: { scan: 0, mc: 1, se: 0.5, bse: 0.6, xray: 0.4 },
  },
  // ------------------------------------------------------------------ 10
  {
    id: 'charge', accent: '#c58bff', nav: 'Charge control',
    title: 'Keep the\nbooks balanced', kicker: 'Low vacuum & charge control',
    copy: 'On an insulator, every electron that arrives must leave. Where the total yield σ = δ + η is not 1, charge builds up, deflecting the beam and bleaching or blackening the image. Low kV, a thin metal coat, or a few tens of pascals of gas restore the balance.',
    points: [
      ['E₂ crossover', 'Above it the surface charges negatively and runs away; find it and the image is stable.'],
      ['Variable pressure', '10–130 Pa of N₂ or H₂O: ionised gas drifts to the surface and neutralises it.'],
      ['The price', 'Gas scatters the beam into a skirt tens of micrometres wide; a short gas path keeps the core sharp.'],
    ],
    readouts: (f) => {
      const p = 10 ** lerp(-3, 2.1, clamp(f * 1.15));
      const m = MATERIALS.SiO2;
      const nL = (p / (K.kB * 293)) * 5e-3;
      const scat = 1 - Math.exp(-nL * 2.3e-21);
      return [
        ['Chamber pressure', p < 0.1 ? fmtExp(p) : p.toFixed(p < 10 ? 1 : 0), 'Pa'],
        ['Beam scattered', (scat * 100).toFixed(scat < 0.1 ? 1 : 0), '%'],
        ['Skirt radius (20 kV, 5 mm)', ...L(skirtRadius(7, 20000, p, 5e-3))],
        ['σ(SiO₂) @ 5 keV', totalYield(5, m).toFixed(2), ''],
        ['E₂ (SiO₂)', findE2(m).toFixed(2), 'keV'],
      ];
    },
    eq: `σ = δ + η = 1 &nbsp;⇒&nbsp; I<sub>beam</sub> = I<sub>SE</sub> + I<sub>BSE</sub>`,
    eqNote: `Skirt radius (Danilatos): r<sub>s</sub> = ${fr('364 Z', 'E')} ${rt('p / T')} · L<sup>3/2</sup>.`,
    plot: {
      title: 'Total electron yield vs landing energy', xl: 'E [keV]', yl: 'σ = δ + η', lx: true,
      x: [0.05, 30], y: [0, 3],
      series: [
        { f: (E) => totalYield(E, MATERIALS.SiO2), c: 'accent', name: 'SiO₂', lx: 0.35 },
        { f: (E) => totalYield(E, MATERIALS.Si), c: 'fg', name: 'Si', lx: 0.07 },
        { f: (E) => totalYield(E, MATERIALS.Au), c: 'dim', name: 'Au', lx: 4 },
      ],
      hl: [{ y: 1, name: 'σ = 1' }],
      mark: () => findE2(MATERIALS.SiO2),
    },
    cam: { p: [4.5, 1.58, 9.36], t: [0.6, 0.35, 0.0] },
    labels: [['PRESSURE-LIMITING APERTURE', [0.3, 1.0, 0]], ['GAS · IONISATION', [-1.3, 1.3, -0.5]], ['INSULATING SPECIMEN', [-0.28, -0.02, 0]]],
    s: { scan: 0.6, gas: 1, se: 0.5, bse: 0.3 },
  },
  // ------------------------------------------------------------------ 11
  {
    id: 'detectors', accent: '#ffc730', nav: 'Detectors',
    title: 'Sort what\ncomes out', kicker: 'Detectors',
    copy: 'Each detector selects electrons or photons by energy and direction, and so picks a contrast mechanism. A positively biased cage pulls slow secondaries sideways; fast backscattered electrons fly straight up into an annular diode; X-rays reach a silicon drift detector.',
    points: [
      ['Everhart–Thornley · in-lens', 'ETD: topography with shadowing. In-lens: field-extracted SE1, pure surface detail.'],
      ['Annular BSE', 'Si diode or YAG: gain ≈ E/3.6 eV. Sum the segments for composition, subtract for topography.'],
      ['EDS · SDD', 'Peltier-cooled drift diode, ~127 eV at Mn Kα, 10⁵–10⁶ counts/s, 35° take-off.'],
    ],
    readouts: () => [
      ['ETD grid bias', '+300', 'V'],
      ['η: Si / Cu / W', `${eta(14).toFixed(2)} / ${eta(29).toFixed(2)} / ${eta(74).toFixed(2)}`, ''],
      ['BSE diode gain @ 15 keV', (15000 / 3.6).toFixed(0), 'e-h pairs'],
      ['EDS resolution (Mn Kα)', '127', 'eV'],
    ],
    eq: `${rt('ν')} ∝ (Z − σ) &nbsp;·&nbsp; U = ${fr('E₀', 'E<sub>c</sub>')} ≳ 2`,
    eqNote: 'Moseley’s law fixes each element’s line energies; the overvoltage U must be ~2 or more to excite them efficiently.',
    plot: {
      title: 'EDS spectrum: Cu / W / SiO₂ / Si at 15 kV', xl: 'photon energy [keV]', yl: 'counts',
      x: [0, 10], y: [0, 1.15],
      n: 400, series: [{ f: (E) => edsSpectrum(E, 15), c: SIG.xray }],
      notes: [[0.4, 'O'], [2.35, 'Si K · W M'], [7.75, 'Cu Kα']],
    },
    cam: { p: [2.6, 3.0, 11.5], t: [0.3, 0.75, 0], shift: 0.1, shiftY: -0.13 },
    labels: [['ETD · SE', [1.5, 0.82, -0.2]], ['IN-LENS SE', [0.2, 2.95, 0]], ['ANNULAR BSE', [0.5, 0.9, 0]], ['EDS · SDD', [-1.3, 0.95, -0.45]]],
    s: { scan: 1, se: 1, bse: 1, xray: 1 },
  },
  // ------------------------------------------------------------------ 12
  {
    id: 'ebsd', accent: '#b7ff54', nav: 'EBSD',
    title: 'Read the lattice', kicker: 'Electron backscatter diffraction',
    copy: 'Tilt a polished crystal 70° and backscattered electrons leave it having diffracted on their way out. Each lattice plane paints a pair of Kossel cones on a phosphor screen, a Kikuchi band whose width is twice the Bragg angle. Index the bands and you have the orientation.',
    points: [
      ['Geometry', '70° tilt, 15–30 kV, nA currents; the signal comes from the top 10–40 nm.'],
      ['Indexing', 'Hough transform finds the bands; interplanar angles identify phase and orientation at >3000 patterns/s.'],
      ['Output', 'Grain size, texture, boundary character, strain: ~0.5° absolute, 20–50 nm spatial resolution.'],
    ],
    readouts: (f) => {
      const lam = wavelength(20000);
      const tb = lam / (2 * 0.3135e-9);
      return [
        ['Specimen tilt', '70', '°'],
        ['λ @ 20 kV', ...L(lam)],
        ['θ<sub>B</sub> Si (111)', ((tb * 180) / Math.PI).toFixed(2), '°'],
        ['Band width 2θ<sub>B</sub>', (2 * tb * 1e3).toFixed(1), 'mrad'],
      ];
    },
    eq: `2 d<sub>hkl</sub> sin θ<sub>B</sub> = nλ`,
    eqNote: 'Bragg’s law. Pattern below: silicon, computed from the {111} {220} {311} {400} plane families.',
    plot: { title: 'Kikuchi pattern, gnomonic projection', draw: (c, f) => drawKikuchi(c, f * 0.8), tall: true },
    cam: { p: [3.6, 2.0, 9.6], t: [0.1, 0.3, -0.5], shift: 0.1, shiftY: -0.1 },
    labels: [['PHOSPHOR SCREEN', [0.55, 1.05, -1.7]], ['70° TILT', [-0.25, 0.0, 0]], ['DIFFRACTED BSE', [-0.25, 0.5, -0.9]]],
    s: { scan: 0, tilt: 1, ebsd: 1, bse: 0.5 },
  },
  // ------------------------------------------------------------------ 13
  {
    id: 'signal', accent: '#18ff92', nav: 'Signal chain',
    title: 'From electrons\nto numbers', kicker: 'Signal chain',
    copy: 'Past the cage, +10 kV slams each secondary into a scintillator: one electron becomes a burst of photons. A light guide carries them through the chamber wall to a photomultiplier, whose dynodes multiply every photoelectron a million-fold before the amplifier and digitiser.',
    points: [
      ['Scintillator → PMT', 'Noise-free gain of 10⁵–10⁷ with nanosecond response: fast enough for TV-rate scanning.'],
      ['Contrast · brightness', 'PMT voltage sets the gain, amplifier DC offset sets the black level, before the ADC.'],
      ['Shot noise', 'Signal quality is counting statistics: SNR = √(n·δ·DQE). The Rose criterion asks for 5.'],
    ],
    readouts: (f) => {
      const dwell = 10 ** lerp(-7.3, -4.7, clamp(f * 1.1));
      const n = (100e-12 * dwell) / K.e;
      const snr = Math.sqrt(n * 0.25 * 0.5);
      return [
        ['Dwell time', dwell < 1e-6 ? (dwell * 1e9).toFixed(0) : (dwell * 1e6).toFixed(1), dwell < 1e-6 ? 'ns' : 'µs'],
        ['Electrons / pixel @ 100 pA', n.toFixed(0), 'e⁻'],
        ['Detected SE (δ·DQE = 0.12)', (n * 0.125).toFixed(0), 'quanta'],
        ['SNR', snr.toFixed(1), snr >= 5 ? '≥ 5 ✓' : '< 5'],
        ['PMT gain', '1.0×10⁶', ''],
      ];
    },
    eq: `I<sub>B</sub> &gt; ${fr('4 × 10⁻¹² A·s', 'ε · C² · t<sub>frame</sub>')}`,
    eqNote: 'Threshold current to see a contrast C in a 10⁶-pixel frame with collection efficiency ε (Rose criterion).',
    plot: {
      title: 'Digitised line scan across a raised line', live: true,
      draw: (c, f, env) => {
        const dwell = 10 ** lerp(-7.3, -4.7, clamp(f * 1.1));
        drawLineScan(c, f, { ...env, nPerPixel: ((100e-12 * dwell) / K.e) * 0.125 });
      },
    },
    cam: { p: [5.0, 2.2, 15], t: [5.2, 0.7, 0], shift: 0.16, shiftY: -0.2 },
    labels: [['FARADAY CAGE', [1.45, 0.82, -0.2]], ['SCINTILLATOR +10 kV', [1.7, 0.45, -0.2], 'd'], ['LIGHT GUIDE', [2.5, 0.75, -0.2]], ['PHOTOMULTIPLIER', [3.9, 0.34, -0.2], 'd'], ['AMP · ADC', [5.6, 0.47, -0.2]]],
    s: { scan: 1, se: 1, photons: 1 },
  },
  // ------------------------------------------------------------------ 14
  {
    id: 'image', accent: '#d93a3a', nav: 'Image', light: true,
    title: 'Build the image,\npixel by pixel', kicker: 'Image formation & processing',
    copy: 'The image is a time series written into a grid: brightness at pixel (x, y) is the signal collected while the beam dwelled there. Contrast comes from how yield changes with tilt, composition and potential; everything after that is statistics and bookkeeping.',
    points: [
      ['Contrast mechanisms', 'δ ∝ sec θ lights up edges; η(Z) separates phases; surface potential gives voltage contrast.'],
      ['Noise reduction', 'Frame or line integration improves SNR as √N; drift-corrected integration avoids blur.'],
      ['Artifacts', 'Charging streaks, contamination frames, drift, edge blooming, 50/60 Hz stray-field wobble.'],
    ],
    readouts: (f) => {
      const N = Math.max(1, Math.round(2 ** lerp(0, 6, clamp(f * 1.15))));
      return [
        ['Frames integrated', N.toFixed(0), ''],
        ['SNR gain', Math.sqrt(N).toFixed(1), '×'],
        ['Image', '1024 × 884', 'px'],
        ['Bit depth', '8 / 16', 'bit'],
      ];
    },
    eq: `δ(θ) ≈ δ₀ sec θ &nbsp;·&nbsp; SNR<sub>N</sub> = ${rt('N')} · SNR₁`,
    eqNote: 'Tilt dependence of SE yield (topographic contrast) and the gain from integrating N frames.',
    plot: {
      title: 'Signal-to-noise vs frames integrated', xl: 'N frames', yl: 'SNR / SNR₁', lx: true,
      x: [1, 64], y: [0, 8.5],
      series: [{ f: (n) => Math.sqrt(n), c: 'accent' }],
      mark: (f) => Math.max(1, Math.round(2 ** lerp(0, 6, clamp(f * 1.15)))),
    },
    cam: { p: [7.0, 1.5, 11], t: [7.75, 0.95, 0], shift: 0.2 },
    labels: [['SCAN-SYNCHRONOUS DISPLAY', [8.4, 2.2, 0]]],
    s: { scan: 1, se: 1, photons: 1, monitor: 1 },
  },
];

export const SE_ESCAPE = { C: 10, Al: 4, Si: 6, Cu: 3, W: 3, Au: 3 };
export const MC_MATERIALS = ['C', 'Al', 'Si', 'Cu', 'W', 'Au'];
