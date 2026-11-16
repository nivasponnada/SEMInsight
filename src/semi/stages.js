// Ten stages of semiconductor characterisation, from bare wafer to device parameters.
import { fr, rt } from '../stages.js';
import { prepCanvas } from '../plots.js';
import { Q, vt, ni, Eg, muN, muP, resistivity, mosCV, interp, diode, dlts, emission, ellipsometry, implant, implantProfile, sci } from './physics.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const logf = (f, a, b) => 10 ** lerp(Math.log10(a), Math.log10(b), clamp(f * 1.15));
const CV = mosCV({ N: 1e16, tox: 10, Qf: 5e10, Dit: 0 });
const DI = diode({ Na: 1e17, Nd: 1e15, T: 300, A: 1e-2, tau: 1e-6, Rs: 2 });
const cvV = (f) => lerp(-3, 2.5, clamp(f * 1.15));
const css = (c) => { const s = getComputedStyle(c); return { acc: s.getPropertyValue('--accent').trim(), dim: s.getPropertyValue('--dim').trim(), fg: s.getPropertyValue('--fg').trim(), line: s.getPropertyValue('--line').trim() }; };

// Raman spectrum of silicon under stress.
const raman = (w, shift) => 1 / (1 + ((w - 520.7 - shift) / 1.6) ** 2) + 0.04 * Math.exp(-(((w - 480) / 28) ** 2));
// Band-edge photoluminescence of GaAs.
const EgGaAs = (T) => 1.519 - (5.405e-4 * T * T) / (T + 204);
const pl = (E, T) => { const x = E - EgGaAs(T), kT = vt(T); if (x <= 0) return 0.9 * Math.exp(x / (0.006 + kT * 0.35)) * 0; const pk = 0.5 * kT; return Math.sqrt(x) * Math.exp(-x / kT) / (Math.sqrt(pk) * Math.exp(-0.5)); };

export const STAGES = [
  {
    id: 'wafer', accent: '#8e9bff', nav: 'The wafer',
    title: 'Start with\nthe crystal', kicker: 'Substrate',
    copy: 'Everything is built on a slice of single-crystal silicon: 150 to 300 mm across, under a millimetre thick, polished flat to a few ångströms. Its orientation, dopant type and resistivity are the first numbers on any specification sheet, and the first things characterisation has to confirm.',
    points: [
      ['Orientation', '(100) for CMOS: lowest interface-state density. Flats or a notch mark the ⟨110⟩ direction.'],
      ['Doping', 'Boron makes it p-type, phosphorus or arsenic n-type; 10¹⁴ to 10²⁰ atoms per cm³ against 5 × 10²² silicon.'],
      ['Purity', 'Metals below 10¹⁰ cm⁻³ and oxygen near 10¹⁸ cm⁻³ set carrier lifetime and oxide integrity.'],
    ],
    readouts: (f) => { const N = logf(f, 1e14, 1e19); return [['Boron concentration', sci(N), 'cm⁻³'], ['Fraction of lattice sites', sci(N / 5e22), ''], ['Hole mobility', muP(N).toFixed(0), 'cm²/Vs'], ['Resistivity', resistivity(N, 'p') >= 1 ? resistivity(N, 'p').toFixed(1) : resistivity(N, 'p').toFixed(3), 'Ω·cm'], ['n<sub>i</sub> (300 K)', sci(ni(300)), 'cm⁻³']]; },
    eq: `ρ = ${fr('1', 'q (n μ<sub>n</sub> + p μ<sub>p</sub>)')}`,
    eqNote: 'Resistivity falls slower than 1/N because ionised dopants scatter carriers and reduce mobility.',
    plot: { title: 'Resistivity of silicon vs doping (300 K)', xl: 'N [cm⁻³]', yl: 'ρ [Ω·cm]', lx: true, ly: true, x: [1e13, 1e20], y: [1e-4, 1e4], series: [{ f: (N) => resistivity(N, 'p'), c: 'accent', name: 'p-type (B)', lx: 1e17 }, { f: (N) => resistivity(N, 'n'), c: 'fg', name: 'n-type (P)', lx: 3e13 }], mark: (f) => logf(f, 1e14, 1e19) },
    cam: { p: [6.5, 8, 18], t: [0.2, 0.2, 0] },
    labels: [['PRIMARY FLAT ⟨110⟩', [0, 0.04, 2.75], 'd'], ['(100) SURFACE', [1.6, 0.04, -0.8]], ['VACUUM CHUCK', [-3.2, -0.1, 1.2], 'd']],
    labelSplit: -1,
    see: [['XRD · lattice and orientation', 'xrd.html#bragg']],
  },
  {
    id: 'fpp', accent: '#ff4b4b', nav: 'Four-point probe',
    title: 'Four needles,\nno contact error', kicker: 'Sheet resistance',
    copy: 'Press four collinear tungsten-carbide tips onto the surface. Force a current through the outer pair and measure the voltage across the inner pair with a high-impedance meter: because almost no current flows in the voltage probes, their contact resistance drops out of the measurement.',
    points: [
      ['Sheet resistance', 'For a layer much thinner than the probe spacing, R<sub>s</sub> = 4.532 V/I in ohms per square.'],
      ['Corrections', 'Finite thickness and wafer edges need geometric factors; junction-isolated layers need the right polarity.'],
      ['Mapping', '49 or 121 sites across the wafer reveal implant and anneal uniformity to better than 1 %.'],
    ],
    readouts: (f) => { const N = logf(f, 1e15, 1e20), rho = resistivity(N, 'n'), tj = 0.2e-4, Rs = rho / tj; return [['Layer doping (n⁺)', sci(N), 'cm⁻³'], ['Junction depth', '0.20', 'µm'], ['Sheet resistance', Rs >= 100 ? Rs.toFixed(0) : Rs.toFixed(1), 'Ω/□'], ['V at I = 1 mA', (Rs / 4.532 >= 1 ? (Rs / 4.532).toFixed(1) : (Rs / 4.532).toFixed(3)), 'mV'], ['Probe spacing', '1.00', 'mm']]; },
    eq: `R<sub>s</sub> = ${fr('π', 'ln 2')} · ${fr('V', 'I')} = ${fr('ρ', 't')}`,
    eqNote: 'Thin infinite sheet with equally spaced probes. For a bulk wafer: ρ = 2πs · V/I.',
    plot: { title: 'Sheet resistance of a 0.2 µm n⁺ layer', xl: 'N [cm⁻³]', yl: 'Rs [Ω/□]', lx: true, ly: true, x: [1e15, 1e21], y: [1, 1e6], series: [{ f: (N) => resistivity(N, 'n') / 0.2e-4, c: 'accent' }], mark: (f) => logf(f, 1e15, 1e20) },
    cam: { p: [2.8, 2.4, 6.6], t: [0.3, 0.75, 0] },
    labels: [['CURRENT IN', [-0.54, 0.6, 0]], ['VOLTAGE SENSE', [0.0, 0.3, 0.05], 'd'], ['CURRENT OUT', [0.54, 0.6, 0]]],
    labelSplit: -0.3,
    s: { fpp: 1 },
  },
  {
    id: 'hall', accent: '#ff8f42', nav: 'Hall effect',
    title: 'Which carriers,\nhow many, how fast', kicker: 'Hall effect',
    copy: 'Resistivity alone cannot separate carrier density from mobility. Add a magnetic field perpendicular to the current: the Lorentz force pushes carriers to one edge until the field of the piled-up charge balances it. The sign of that Hall voltage gives the carrier type, its size the density.',
    points: [
      ['van der Pauw', 'Four small contacts on the edge of any flat, uniform sample: no need for a patterned bar.'],
      ['Mobility', 'μ<sub>H</sub> = |R<sub>H</sub>|/ρ combines the Hall coefficient with a resistivity measurement.'],
      ['Temperature sweeps', 'Freeze-out and intrinsic regimes give dopant ionisation energy and compensation.'],
    ],
    readouts: (f) => { const n = logf(f, 1e14, 1e19), t = 5e-5, I = 1e-4, B = 0.5; const VH = (I * B * 1e-4 * 1e4) / (Q * n * t) * 1e-4; return [['Carrier density n', sci(n), 'cm⁻³'], ['Hall coefficient', sci(1 / (Q * n)), 'cm³/C'], ['V<sub>H</sub> (0.5 T, 100 µA, 0.5 µm)', Math.abs(VH * 1e3) >= 1 ? (VH * 1e3).toFixed(2) : (VH * 1e6).toFixed(1), Math.abs(VH * 1e3) >= 1 ? 'mV' : 'µV'], ['Mobility μ<sub>n</sub>', muN(n).toFixed(0), 'cm²/Vs'], ['Sign', 'negative', 'n-type']]; },
    eq: `V<sub>H</sub> = ${fr('I B', 'q n t')} , &nbsp; R<sub>H</sub> = −${fr('1', 'q n')}`,
    eqNote: 'Hall voltage for a layer of thickness t; positive R<sub>H</sub> means holes carry the current.',
    plot: { title: 'Electron and hole mobility in Si (300 K)', xl: 'N [cm⁻³]', yl: 'μ [cm²/Vs]', lx: true, ly: true, x: [1e14, 1e20], y: [30, 2000], series: [{ f: (N) => muN(N), c: 'accent', name: 'electrons', lx: 3e14 }, { f: (N) => muP(N), c: 'fg', name: 'holes', lx: 3e14 }], mark: (f) => logf(f, 1e14, 1e19) },
    cam: { p: [3.4, 2.8, 7.6], t: [0.3, 0.9, 0] },
    labels: [['MAGNET POLE · B', [0.9, 1.9, 0]], ['VAN DER PAUW SAMPLE', [0.65, 0.14, 0.65], 'd'], ['CARRIERS DEFLECTED', [-0.1, 0.17, 0.4], 'd']],
    labelSplit: -0.3,
    s: { hall: 1 },
  },
  {
    id: 'cv', accent: '#ffc730', nav: 'C–V profiling',
    title: 'A capacitor that\nmeasures itself', kicker: 'Capacitance–voltage',
    copy: 'A metal gate on oxide on silicon is a capacitor whose lower plate moves. Negative bias on p-type silicon pulls holes to the interface: full oxide capacitance. Positive bias pushes them away and a depletion layer widens in series with the oxide, until an inversion layer of electrons forms and screens it.',
    points: [
      ['Three regimes', 'Accumulation, depletion, inversion: each read directly from the shape of the curve.'],
      ['What it yields', 'Oxide thickness from C<sub>ox</sub>, doping from the depletion slope, fixed charge from the flat-band shift.'],
      ['Interface traps', 'They stretch the curve out along the voltage axis; comparing high and low frequency gives D<sub>it</sub>.'],
    ],
    readouts: (f) => { const V = cvV(f), c = interp(CV.V, CV.Chf, V), W = (11.7 * 8.854e-14 / CV.Cox) * (1 / c - 1); return [['Gate bias', V.toFixed(2), 'V'], ['C / C<sub>ox</sub> (1 MHz)', c.toFixed(3), ''], ['Depletion width', (Math.max(0, W) * 1e7).toFixed(0), 'nm'], ['Regime', V < CV.Vfb ? 'accumulation' : V < CV.Vt ? 'depletion' : 'inversion', ''], ['V<sub>FB</sub> · V<sub>T</sub>', `${CV.Vfb.toFixed(2)} · ${CV.Vt.toFixed(2)}`, 'V']]; },
    eq: `${fr('1', 'C')} = ${fr('1', 'C<sub>ox</sub>')} + ${fr('W', 'ε<sub>s</sub>')} , &nbsp; N(W) = ${fr('2', 'q ε<sub>s</sub> A² · d(1/C²)/dV')}`,
    eqNote: 'Oxide and depletion capacitance in series; the slope of 1/C² against bias gives the doping at depth W.',
    plot: { title: 'MOS C–V, p-Si 10¹⁶ cm⁻³, 10 nm oxide', xl: 'gate bias [V]', yl: 'C / Cox', x: [-3, 2.5], y: [0, 1.08], n: 300, series: [{ f: (V) => interp(CV.V, CV.Chf, V), c: 'accent', name: '1 MHz', lx: 0.9 }, { f: (V) => interp(CV.V, CV.Clf, V), c: 'dim', dash: [4, 3], name: 'quasi-static', lx: 0.9 }], vl: [{ x: CV.Vfb, name: 'V FB' }, { x: CV.Vt, name: 'V T' }], mark: (f) => cvV(f) },
    cam: { p: [3.6, 2.8, 9.2], t: [0.5, 1.35, 0] },
    labels: [['METAL GATE', [0.8, 2.1, 0.5]], ['OXIDE', [-1.5, 1.96, 0.6]], ['DEPLETION LAYER', [0.9, 1.6, 0.6], 'd'], ['p-TYPE SILICON', [-1.5, 1.0, 0.6], 'd']],
    labelSplit: -0.2,
    s: { mos: 1 },
  },
  {
    id: 'iv', accent: '#b7ff54', nav: 'I–V curves',
    title: 'Current is\nthe verdict', kicker: 'Current–voltage',
    copy: 'In the end a device is judged by its current. A parameter analyser sweeps voltage and measures from femtoamps to amps. On a logarithmic axis a junction shows its ideality, its leakage and its series resistance; a transistor shows its threshold and how sharply it switches.',
    points: [
      ['Ideality factor', 'n = 1 for diffusion current, 2 for recombination in the depletion layer; in between, both.'],
      ['Subthreshold swing', 'A MOSFET needs at least 60 mV of gate voltage per decade of current at room temperature.'],
      ['Kelvin sensing', 'Separate force and sense lines remove cable and probe resistance; triaxial guards remove leakage.'],
    ],
    readouts: (f) => { const V = lerp(0.1, 0.85, clamp(f * 1.15)), I = DI.I(V), I2 = DI.I(V + 0.01), n = 0.01 / (vt(300) * Math.log(I2 / I)); return [['Forward bias', V.toFixed(2), 'V'], ['Current', sci(I, 2), 'A'], ['Local ideality n', n.toFixed(2), ''], ['Saturation current', sci(DI.Is), 'A'], ['kT/q · ln 10', (vt(300) * Math.log(10) * 1000).toFixed(1), 'mV/dec']]; },
    eq: `I = I<sub>s</sub> <span class="big">(</span>e<sup>q(V − IR<sub>s</sub>)/nkT</sup> − 1<span class="big">)</span> , &nbsp; SS = ln 10 · ${fr('kT', 'q')} <span class="big">(</span>1 + ${fr('C<sub>d</sub>', 'C<sub>ox</sub>')}<span class="big">)</span>`,
    eqNote: 'Diode equation with series resistance, and the subthreshold swing of a MOSFET.',
    plot: { title: 'Forward I–V of a silicon p–n junction', xl: 'V [V]', yl: 'I [A]', ly: true, x: [0, 0.9], y: [1e-12, 1], n: 200, series: [{ f: (V) => DI.I(V), c: 'accent' }, { f: (V) => DI.Is * Math.exp(V / vt(300)), c: 'dim', dash: [3, 3], name: 'n = 1', lx: 0.2 }], mark: (f) => lerp(0.1, 0.85, clamp(f * 1.15)) },
    cam: { p: [3.6, 2.8, 9.6], t: [0.5, 1.35, 0] },
    labels: [['SOURCE', [-1.4, 2.0, 0.5]], ['GATE', [0, 2.3, 0.5]], ['DRAIN', [1.4, 2.0, 0.5]], ['INVERSION CHANNEL', [0.3, 1.87, 0.62], 'd']],
    labelSplit: -0.3,
    s: { fet: 1 },
  },
  {
    id: 'dlts', accent: '#ff6b9d', nav: 'Deep levels',
    title: 'Listen for\ntraps emptying', kicker: 'Deep-level transient spectroscopy',
    copy: 'A few metal atoms per billion create energy levels deep in the gap that kill carrier lifetime. Pulse a junction to fill them, then watch the capacitance relax as they thermally empty. The emission rate is fiercely temperature dependent, so scanning temperature turns each trap into a peak.',
    points: [
      ['Rate window', 'The signal C(t₁) − C(t₂) peaks when the emission time constant matches the chosen window.'],
      ['Arrhenius plot', 'Repeating with several windows gives activation energy and capture cross-section: the trap’s signature.'],
      ['Sensitivity', 'Trap densities down to 10⁻⁵ of the doping: 10¹⁰ cm⁻³ in lightly doped silicon.'],
    ],
    readouts: (f) => { const T = lerp(120, 380, clamp(f * 1.15)); return [['Temperature', T.toFixed(0), 'K'], ['Emission rate, E<sub>c</sub> − 0.55 eV', sci(emission(T, 0.55, 2e-15)), 's⁻¹'], ['Emission rate, E<sub>c</sub> − 0.23 eV', sci(emission(T, 0.23, 1e-15)), 's⁻¹'], ['Rate window', '1 – 10', 'ms'], ['Peak when e<sub>n</sub> =', (Math.log(10) / 9e-3).toFixed(0), 's⁻¹']]; },
    eq: `e<sub>n</sub> = σ<sub>n</sub> v<sub>th</sub> N<sub>c</sub> exp<span class="big">(</span>−${fr('E<sub>c</sub> − E<sub>t</sub>', 'kT')}<span class="big">)</span>`,
    eqNote: 'Thermal emission rate of electrons from a trap; v<sub>th</sub>N<sub>c</sub> ∝ T², hence plots of ln(e<sub>n</sub>/T²) against 1/T.',
    plot: { title: 'DLTS spectrum, two electron traps', xl: 'T [K]', yl: 'ΔC (norm.)', x: [80, 400], y: [0, 0.85], n: 300, series: [{ f: (T) => dlts(T, 0.55, 2e-15, 1e-3, 1e-2) + 0.55 * dlts(T, 0.23, 1e-15, 1e-3, 1e-2), c: 'accent', name: '1–10 ms', lx: 210 }, { f: (T) => dlts(T, 0.55, 2e-15, 1e-2, 1e-1) + 0.55 * dlts(T, 0.23, 1e-15, 1e-2, 1e-1), c: 'dim', dash: [3, 3], name: '10–100 ms', lx: 150 }], mark: (f) => lerp(120, 380, clamp(f * 1.15)) },
    cam: { p: [3.6, 2.8, 9.2], t: [0.5, 1.35, 0] },
    labels: [['FILL PULSE ON GATE', [0, 2.6, 0.3]], ['TRAPS EMITTING', [0.7, 1.55, 0.62], 'd'], ['DEPLETION EDGE', [-0.9, 1.3, 0.62], 'd']],
    labelSplit: -0.3,
    s: { mos: 1, dlts: 1 },
  },
  {
    id: 'ellipsometry', accent: '#17f1d1', nav: 'Ellipsometry',
    title: 'Thickness from\na twist of light', kicker: 'Spectroscopic ellipsometry',
    copy: 'Reflect polarised light from the wafer at about 70° and its polarisation changes: the components parallel and perpendicular to the plane of incidence reflect with different amplitude and phase. Those two numbers, Ψ and Δ, respond to a film a fraction of a nanometre thick, without touching it.',
    points: [
      ['Model-based', 'Thickness and optical constants come from fitting a layer model to Ψ(λ) and Δ(λ).'],
      ['Sensitivity', 'Δ changes by about 0.3° per ångström of oxide on silicon: sub-monolayer resolution.'],
      ['In the fab', 'Gate oxides, high-k stacks, resists and nitride films are measured on every lot.'],
    ],
    readouts: (f) => { const d = lerp(0, 300, clamp(f * 1.15)), e = ellipsometry(d); return [['SiO₂ thickness', d.toFixed(1), 'nm'], ['Ψ', e.psi.toFixed(2), '°'], ['Δ', e.delta.toFixed(2), '°'], ['Wavelength · angle', '632.8 · 70', 'nm · °'], ['Thickness period', (632.8 / (2 * Math.sqrt(1.457 ** 2 - Math.sin(70 * Math.PI / 180) ** 2))).toFixed(0), 'nm']]; },
    eq: `ρ = ${fr('r<sub>p</sub>', 'r<sub>s</sub>')} = tan Ψ · e<sup>iΔ</sup>`,
    eqNote: 'Ratio of the complex reflection coefficients for p- and s-polarised light, from the Fresnel and Airy formulas.',
    plot: { title: 'Ψ and Δ vs oxide thickness on Si', xl: 'SiO₂ [nm]', yl: 'degrees', x: [0, 300], y: [0, 360], n: 300, series: [{ f: (d) => ellipsometry(d).delta, c: 'accent', name: 'Δ', lx: 30 }, { f: (d) => ellipsometry(d).psi, c: 'fg', name: 'Ψ', lx: 30 }], mark: (f) => lerp(0, 300, clamp(f * 1.15)) },
    cam: { p: [1.0, 3.6, 16], t: [0.3, 1.2, 0], shift: 0.13, shiftY: -0.12 },
    labels: [['SOURCE + POLARISER', [-2.6, 1.0, 0]], ['ANALYSER + DETECTOR', [2.6, 1.0, 0]], ['70° INCIDENCE', [0, 0.05, 0.2], 'd']],
    labelSplit: -1,
    s: { ellip: 1 },
  },
  {
    id: 'pl', accent: '#5ac8ff', nav: 'Photoluminescence',
    title: 'Make it glow', kicker: 'Photoluminescence',
    copy: 'A laser with photons above the band gap creates electron–hole pairs. Where the crystal is good they recombine by emitting light at the gap energy; where there are defects they recombine silently. The spectrum gives the gap and impurity levels, the brightness and its decay the carrier lifetime.',
    points: [
      ['Band gap', 'Peak at E<sub>g</sub> + kT/2 in direct-gap materials; composition of alloys follows directly.'],
      ['Low temperature', 'At 4–10 K lines sharpen into excitons bound to specific donors and acceptors.'],
      ['Lifetime mapping', 'Time-resolved or imaging PL shows contamination and dislocations across a wafer or solar cell.'],
    ],
    readouts: (f) => { const T = lerp(10, 300, clamp(f * 1.15)); return [['Temperature', T.toFixed(0), 'K'], ['E<sub>g</sub> (GaAs)', EgGaAs(T).toFixed(4), 'eV'], ['Peak wavelength', (1239.84 / (EgGaAs(T) + vt(T) / 2)).toFixed(1), 'nm'], ['Linewidth ≈ 1.8 kT', (1.8 * vt(T) * 1000).toFixed(1), 'meV'], ['E<sub>g</sub> (Si)', Eg(T).toFixed(4), 'eV']]; },
    eq: `I(ℏω) ∝ ${rt('ℏω − E<sub>g</sub>')} · e<sup>−(ℏω − E<sub>g</sub>)/kT</sup> , &nbsp; E<sub>g</sub>(T) = E₀ − ${fr('αT²', 'T + β')}`,
    eqNote: 'Band-to-band emission line shape and the Varshni temperature dependence of the gap.',
    plot: { title: 'Band-edge PL of GaAs', xl: 'photon energy [eV]', yl: 'intensity', x: [1.38, 1.6], y: [0, 1.1], n: 500, series: (env) => [{ f: (E) => pl(E, 10), c: 'dim', dash: [3, 3], name: '10 K', lx: 1.53 }, { f: (E) => pl(E, env.T || 300), c: 'accent', w: 2 }] },
    cam: { p: [4.2, 3.0, 9.6], t: [0.9, 1.5, 0] },
    labels: [['EXCITATION LASER', [0.1, 0.6, 0]], ['OBJECTIVE', [0.34, 1.3, 0]], ['SPECTROMETER', [2.1, 3.0, 0.4]], ['LUMINESCENCE', [-0.25, 0.3, 0.2], 'd']],
    labelSplit: -0.1,
    s: { optic: 1 },
  },
  {
    id: 'raman', accent: '#c58bff', nav: 'Raman',
    title: 'Weigh the bonds', kicker: 'Raman spectroscopy',
    copy: 'One photon in ten million exchanges energy with a lattice vibration and leaves shifted in colour. In silicon that shift is 520.7 cm⁻¹, set by the stiffness of the Si–Si bond. Compress the lattice and the bonds stiffen, the line moves up; stretch it and it moves down, by about two wavenumbers per gigapascal.',
    points: [
      ['Stress', 'Micron-scale maps of strain around trenches, through-silicon vias and strained channels.'],
      ['Crystallinity', 'Amorphous silicon gives a broad band near 480 cm⁻¹; the ratio measures the crystalline fraction.'],
      ['Also', 'Alloy composition, doping (Fano line shape), temperature from the Stokes/anti-Stokes ratio.'],
    ],
    readouts: (f) => { const s = lerp(-1.5, 1.5, clamp(f * 1.15)); return [['Biaxial stress', (s >= 0 ? '+' : '') + s.toFixed(2), s >= 0 ? 'GPa tensile' : 'GPa compr.'], ['Peak position', (520.7 - s * 4.0 / 1.74).toFixed(2), 'cm⁻¹'], ['Shift', (-s * 4.0 / 1.74).toFixed(2), 'cm⁻¹'], ['Phonon energy', (520.7 * 0.12398).toFixed(1), 'meV'], ['Line width', '3.2', 'cm⁻¹']]; },
    eq: `σ [MPa] ≈ −434 · Δω [cm⁻¹]`,
    eqNote: 'Biaxial stress in the (100) plane of silicon from the shift of the first-order optical phonon.',
    plot: { title: 'First-order Raman line of silicon', xl: 'Raman shift [cm⁻¹]', yl: 'intensity', x: [440, 560], y: [0, 1.1], n: 500, series: (env) => [{ f: (w) => raman(w, 0), c: 'dim', dash: [3, 3], name: 'relaxed', lx: 529 }, { f: (w) => raman(w, env.shift || 0), c: 'accent', w: 2 }], notes: [[480, 'a-Si']] },
    cam: { p: [4.2, 3.0, 9.6], t: [0.9, 1.5, 0] },
    labels: [['532 nm LASER', [0.1, 0.6, 0]], ['SCATTERED LIGHT', [-0.25, 0.3, 0.2], 'd'], ['NOTCH FILTER + GRATING', [1.6, 3.0, 0.4]]],
    labelSplit: -0.1,
    s: { optic: 1, raman: 1 },
  },
  {
    id: 'sims', accent: '#d93a3a', nav: 'SIMS', light: true,
    title: 'Dig, and count\nwhat flies off', kicker: 'Secondary-ion mass spectrometry',
    copy: 'To see where the dopant atoms actually are, sputter the surface away with a focused ion beam and send the ejected ions through a mass spectrometer. Signal against time becomes concentration against depth: an implant profile over five decades, down to parts per billion.',
    points: [
      ['Primary beams', 'O₂⁺ enhances positive ions (B, Al); Cs⁺ enhances negative ions (P, As, O, C).'],
      ['Quantification', 'Ion yields vary by orders of magnitude with the matrix, so implanted standards are essential.'],
      ['Depth resolution', '1–5 nm per decade at low impact energy; the crater is measured by profilometry.'],
    ],
    readouts: (f) => { const E = lerp(10, 120, clamp(f * 1.15)), im = implant(E), pk = 1e15 / (Math.sqrt(2 * Math.PI) * im.dRp), xj = im.Rp + im.dRp * Math.sqrt(2 * Math.log(pk / 1e15)); return [['Implant energy (B⁺)', E.toFixed(0), 'keV'], ['Projected range R<sub>p</sub>', (im.Rp * 1e7).toFixed(0), 'nm'], ['Straggle ΔR<sub>p</sub>', (im.dRp * 1e7).toFixed(0), 'nm'], ['Peak concentration', sci(pk), 'cm⁻³'], ['Junction depth (10¹⁵ background)', (xj * 1e7).toFixed(0), 'nm']]; },
    eq: `N(x) = ${fr('Φ', rt('2π') + ' ΔR<sub>p</sub>')} exp<span class="big">(</span>−${fr('(x − R<sub>p</sub>)²', '2ΔR<sub>p</sub>²')}<span class="big">)</span>`,
    eqNote: 'Gaussian approximation to an as-implanted profile of dose Φ; SIMS reveals the channelling tail it omits.',
    plot: { title: 'Boron depth profile, dose 10¹⁵ cm⁻²', xl: 'depth [nm]', yl: 'N [cm⁻³]', ly: true, x: [0, 800], y: [1e14, 1e21], n: 300, series: (env) => [{ f: (x) => Math.max(1e15, implantProfile(x * 1e-7, env.E || 50, 1e15)) , c: 'accent' }], hl: [{ y: 1e15, name: 'substrate doping' }] },
    cam: { p: [4.6, 3.6, 13.5], t: [1.0, 2.0, 0], shift: 0.15 },
    labels: [['PRIMARY ION GUN', [-1.6, 1.6, 0]], ['SPUTTER CRATER', [0.28, 0.06, 0.1], 'd'], ['SECONDARY IONS', [0.1, 1.6, 0.1]], ['MAGNETIC SECTOR', [1.2, 3.4, 0.3]]],
    labelSplit: -0.3,
    s: { sims: 1 },
    see: [['SEM · EDS for major elements', 'sem.html#detectors'], ['TEM · EELS at atomic scale', 'tem.html#spectroscopy']],
  },
];
