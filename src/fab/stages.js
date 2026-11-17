// Twenty-five stages of a wafer's journey through a 2 nm-class gate-all-around nanosheet
// logic process with backside power delivery, from quartz to a packaged, tested chip.
// The flow is the generic leading-edge sequence described in public conference papers and
// roadmaps; dimensions are published ranges, and cumulative counts are approximate.
import { fr, rt } from '../stages.js';
import { prepCanvas } from '../plots.js';
import { VIEW, TOOL_LABELS, CLOSE_LABELS, DEVICE_LABELS } from './scene.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const g = (f) => clamp(f * 1.15);
const logf = (f, a, b) => 10 ** lerp(Math.log10(a), Math.log10(b), g(f));
const sup = (e) => String(e).replace(/-/g, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
const sci = (v, d = 1) => { if (!isFinite(v) || v === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(v))); return `${(v / 10 ** e).toFixed(d)}×10${sup(e)}`; };
const css = (c) => { const s = getComputedStyle(c); return { acc: s.getPropertyValue('--accent').trim(), dim: s.getPropertyValue('--dim').trim(), fg: s.getPropertyValue('--fg').trim(), line: s.getPropertyValue('--line').trim() }; };
const FONT = '10px "JetBrains Mono", monospace';

/** Horizontal bars. items: [[label, value, text?]]; hi: index to highlight. */
export function drawBars(canvas, items, { log = false, hi = -1, min = null } = {}) {
  const { ctx, w, h } = prepCanvas(canvas); const c = css(canvas);
  const m = { l: 96, r: 62, t: 6, b: 6 }, rh = (h - m.t - m.b) / items.length, pw = w - m.l - m.r;
  const vals = items.map((i) => i[1]), mx = Math.max(...vals), mn = min ?? (log ? Math.min(...vals) / 3 : 0);
  const X = (v) => (log ? (Math.log10(v) - Math.log10(mn)) / (Math.log10(mx) - Math.log10(mn)) : (v - mn) / (mx - mn)) * pw;
  ctx.font = FONT; ctx.textBaseline = 'middle';
  items.forEach(([label, v, text], i) => {
    const y = m.t + rh * (i + 0.5);
    ctx.fillStyle = c.dim; ctx.textAlign = 'right'; ctx.fillText(label, m.l - 8, y);
    ctx.fillStyle = c.line; ctx.fillRect(m.l, y - 1, pw, 1);
    ctx.fillStyle = i === hi || hi < 0 ? c.acc : c.dim; ctx.globalAlpha = i === hi || hi < 0 ? 1 : 0.7;
    ctx.fillRect(m.l, y - rh * 0.28, Math.max(2, X(v)), rh * 0.56); ctx.globalAlpha = 1;
    ctx.fillStyle = c.fg; ctx.textAlign = 'left'; ctx.fillText(text ?? String(v), m.l + Math.max(2, X(v)) + 6, y);
  });
}

// Wafer map: dies fail with probability 1 − exp(−A·D₀), plus an edge-exclusion ring.
function drawWaferMap(canvas, f) {
  const { ctx, w, h } = prepCanvas(canvas); const c = css(canvas);
  const D0 = lerp(0.6, 0.05, g(f)), A = 1.0, pFail = 1 - Math.exp(-A * D0);
  const R = Math.min(h / 2 - 8, w * 0.28), cx = w * 0.34, cy = h / 2, n = 15, d = (2 * R) / n;
  let good = 0, tot = 0;
  const hash = (i, j) => { let x = (i * 374761393 + j * 668265263 + 911) | 0; x = (x ^ (x >>> 13)) * 1274126177 | 0; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = cx - R + i * d, y = cy - R + j * d;
    if ([[x, y], [x + d, y], [x, y + d], [x + d, y + d]].some(([px, py]) => Math.hypot(px - cx, py - cy) > R)) continue;
    tot++;
    const edge = Math.hypot(x + d / 2 - cx, y + d / 2 - cy) > R * 0.86;
    const ok = hash(i, j) > pFail + (edge ? 0.12 : 0); if (ok) good++;
    ctx.fillStyle = ok ? c.acc : '#ff4b4b'; ctx.globalAlpha = ok ? 0.85 : 0.9; ctx.fillRect(x + 0.7, y + 0.7, d - 1.4, d - 1.4);
  }
  ctx.globalAlpha = 1; ctx.strokeStyle = c.dim; ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, 7); ctx.stroke();
  ctx.font = FONT; ctx.fillStyle = c.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const tx = w * 0.66;
  [['D₀', `${D0.toFixed(2)} /cm²`], ['die area', '1.0 cm²'], ['good dies', `${good} / ${tot}`], ['sort yield', `${((100 * good) / tot).toFixed(0)} %`], ['Poisson', `${(100 * Math.exp(-A * D0)).toFixed(0)} %`]].forEach(([k, v], i) => { ctx.fillStyle = c.dim; ctx.fillText(k, tx, 22 + i * 21); ctx.fillStyle = c.fg; ctx.fillText(v, tx, 32 + i * 21); });
}

// ---------------------------------------------------------------- small physical models
const scheil = (frac, k) => k * (1 - frac) ** (k - 1);
const depRate = (invT) => { const T = 1000 / invT, rk = 1e9 * Math.exp(-1.6 / (8.617e-5 * T)), rm = 400 * (T / 1300) ** 1.5; return 1 / (1 / rk + 1 / rm); };
const hcSiGe = (x) => 5.4 / (x * x); // metastable critical thickness [nm], People–Bean-like fit
const halfPitch = (k1, lam, NA) => (k1 * lam) / NA;
const etchYield = (E, Eth, A) => (E > Eth ? A * (Math.sqrt(E) - Math.sqrt(Eth)) : 0);
const weffSheet = (F) => 3 * 2 * (Math.max(6, F - 12) + 5);          // three sheets, 5 nm thick, 12 nm lost to spacing
const weffFin = (F) => Math.max(1, Math.floor(F / 26)) * (2 * 50 + 6); // fins 50 nm tall, 6 nm wide, 26 nm pitch
const jSiO2 = (eot) => 100 * 10 ** (-(eot - 1.2) / 0.2);               // gate leakage at 1 V [A/cm²], approximate
const jHfO2 = (eot) => jSiO2(eot) * 1e-4;
const rhoWire = (w, rho0, mfp, liner) => rho0 * (1 + (0.94 * mfp) / w) * (liner ? (w / Math.max(1, w - 2 * liner)) ** 2 : 1); // µΩ·cm
const viaR = (cd, barrier) => { const a = Math.max(1, cd - 2 * barrier); return (rhoWire(a, 5.3, 16, 0) * 1e-8 * 40e-9) / (a * 1e-9) ** 2 + (barrier ? 2e-16 / (cd * 1e-9) ** 2 * 0.25 : 0); }; // Ω, 40 nm tall tungsten plug
const selSiGe = (x) => 3 * 10 ** (x * 0.055);
const dpw = (A, d = 300) => (Math.PI * (d / 2) ** 2) / A - (Math.PI * d) / Math.sqrt(2 * A);
const bathtub = (t) => 800 * t ** -0.6 + 12 + 2e-17 * t ** 3.4;         // FIT, illustrative
const NODES = [['28 nm planar', 117], ['14 nm FinFET', 70], ['7 nm FinFET', 54], ['5 nm FinFET', 48], ['3 nm FinFET', 45], ['2 nm nanosheet', 45]];

// ---------------------------------------------------------------- view helpers
const FALL = { p: [44, 3.5, 11], t: [40, 1.5, 0] };
const tool = (k) => VIEW?.tool?.[k] || FALL;
const close = (k) => VIEW?.close?.[k] || tool(k);
const TL = (k) => TOOL_LABELS?.[k] || [];
const CL = (k) => CLOSE_LABELS?.[k] || [];
const DL = (b) => DEVICE_LABELS?.[b] || [];
/** A wafer-level or primer stage: tool overview, then a close-up of the same tool. */
const bay = (k, b, flip = 0, k2 = null) => ({ cam: tool(k), cam2: k2 ? tool(k2) : close(k), labels: TL(k), labels2: k2 ? TL(k2) : CL(k), s: { b, flip, [`t_${k}`]: 1 }, s2: { b, flip, [`t_${k2 || k}`]: 1 } });
/** A process stage: the tool, then the device cross-section showing what it did. */
const proc = (k, b0, b1, f0 = 0, f1 = f0) => ({ cam: tool(k), cam2: f1 ? VIEW?.deviceFlip || VIEW?.device || FALL : VIEW?.device || FALL, labels: TL(k), labels2: DL(b1), s: { b: b0, flip: f0, [`t_${k}`]: 1 }, s2: { b: b1, flip: f1, [`t_${k}`]: 1 } });

export const STAGES = [
  // ------------------------------------------------------------------ 1
  {
    id: 'polysilicon', accent: '#8e9bff', nav: 'Quartz to polysilicon',
    title: 'Sand, minus\neverything else', kicker: 'Electronic-grade silicon',
    copy: 'Quartz is reduced with carbon in an arc furnace to metallurgical silicon, about 99 % pure. It is then converted to trichlorosilane, distilled, and decomposed on thin silicon rods heated to 1100 °C in a Siemens reactor. What grows on the rods is polysilicon with less than one foreign atom per billion.',
    points: [
      ['Carbothermic reduction', 'SiO₂ + 2C → Si + 2CO at about 1900 °C: cheap, energy hungry, and far too dirty for devices.'],
      ['Distillation', 'SiHCl₃ boils at 32 °C, so metals, boron and phosphorus chlorides are separated in tall columns.'],
      ['Siemens deposition', 'SiHCl₃ + H₂ → Si + 3HCl on a hot filament; a batch takes several days.'],
    ],
    readouts: (f) => { const n = lerp(2, 11, g(f)); return [['Purity', `${Math.floor(n)}N`, `${(100 - 10 ** (2 - n)).toFixed(Math.min(9, Math.max(1, Math.floor(n) - 2)))} %`], ['Impurities', sci(10 ** (9 - n)), 'ppb'], ['Rod temperature', '1100', '°C'], ['Energy', '45–60', 'kWh/kg'], ['Boron · phosphorus', '< 0.1', 'ppb']]; },
    eq: `SiHCl₃ + H₂ → Si + 3 HCl`,
    eqNote: 'Chemical vapour deposition of silicon from distilled trichlorosilane on a resistively heated seed rod.',
    plot: { title: 'Impurity content by grade [ppb]', draw: (c) => drawBars(c, [['metallurgical', 1e7, '1 %'], ['solar 6N', 1e3, '1 ppm'], ['electronic 9N', 1, '1 ppb'], ['electronic 11N', 0.01, '0.01 ppb']], { log: true, min: 1e-3 }) },
    ...bay('siemens', 0),
    watch: { risk: 'Residual boron, phosphorus and transition metals set the resistivity and carrier lifetime of every wafer cut from the batch.', by: [['Resistivity · four-point probe', 'semiconductor.html#fpp'], ['Deep levels · DLTS', 'semiconductor.html#dlts']] },
  },
  // ------------------------------------------------------------------ 2
  {
    id: 'crystal', accent: '#ff4b4b', nav: 'Crystal pulling',
    title: 'One crystal,\ntwo metres long', kicker: 'Czochralski growth',
    copy: 'Polysilicon is melted in a quartz crucible at 1420 °C under argon. A seed crystal the size of a pencil touches the melt and is pulled up slowly while rotating, and the melt freezes onto it atom by atom in the seed’s orientation. A thin neck grown first lets dislocations run out, so the 300 mm body is dislocation free.',
    points: [
      ['Dash neck', 'A 3–5 mm neck grown fast removes the dislocations created by thermal shock at the seed.'],
      ['Segregation', 'Dopants prefer the melt, so their concentration in the crystal rises along the ingot.'],
      ['Oxygen and defects', 'The crucible dissolves: 10¹⁸ cm⁻³ of oxygen enters; pull rate and gradient set vacancy clusters.'],
    ],
    readouts: (f) => { const fr2 = lerp(0.02, 0.9, g(f)); return [['Fraction solidified', (fr2 * 100).toFixed(0), '%'], ['Boron C/C₀ (k = 0.80)', scheil(fr2, 0.8).toFixed(2), ''], ['Phosphorus C/C₀ (k = 0.35)', scheil(fr2, 0.35).toFixed(2), ''], ['Pull rate', '0.4–1.0', 'mm/min'], ['Ingot', '300 mm × 2 m', '> 250 kg']]; },
    eq: `C<sub>s</sub> = k C₀ (1 − g)<sup>k − 1</sup>`,
    eqNote: 'Scheil equation: dopant concentration in the crystal after a fraction g of the melt has solidified.',
    plot: { title: 'Dopant concentration along the ingot', xl: 'fraction solidified', yl: 'C / C₀', x: [0, 0.95], y: [0, 3], series: [{ f: (x) => scheil(x, 0.8), c: 'accent', name: 'boron', lx: 0.3 }, { f: (x) => scheil(x, 0.35), c: 'fg', name: 'phosphorus', lx: 0.55 }], hl: [{ y: 1, name: 'melt' }], mark: (f) => lerp(0.02, 0.9, g(f)) },
    ...bay('cz', 0),
    watch: { risk: 'Slip dislocations if the neck fails, swirl defects and oxygen striations from an unstable pull rate, and resistivity drifting along the ingot.', by: [['Orientation · XRD', 'xrd.html#bragg'], ['Lifetime · photoluminescence', 'semiconductor.html#pl'], ['Resistivity map', 'semiconductor.html#fpp']] },
  },
  // ------------------------------------------------------------------ 3
  {
    id: 'wafering', accent: '#ff8f42', nav: 'Slicing and polishing',
    title: 'Flat to a\nfew atoms', kicker: 'Wafer preparation',
    copy: 'The ingot is ground to diameter, notched to mark the crystal direction, and cut by a diamond wire saw into slices under a millimetre thick. Lapping, etching and chemical-mechanical polishing then remove the saw damage in stages. The finished wafer is 775 µm thick, flat to tens of nanometres across a die, and smooth to a fraction of an atomic step.',
    points: [
      ['Wire saw', 'A web of diamond wire cuts several hundred wafers at once, losing about 150 µm per cut.'],
      ['Edge and notch', 'A rounded edge prevents chipping; the notch gives the ⟨110⟩ direction to every tool.'],
      ['Epitaxial layer', 'A few micrometres of silicon grown on top gives a defect-free, precisely doped surface.'],
    ],
    readouts: (f) => { const s = Math.min(3, Math.floor(g(f) * 4)); const st = [['wire sawn', '10 µm', '25 µm'], ['lapped', '1 µm', '5 µm'], ['etched', '100 nm', '1 µm'], ['polished', '0.1 nm', '< 0.5 µm']][s]; return [['Step', st[0], ''], ['Surface roughness / damage', st[1], ''], ['Thickness variation', st[2], ''], ['Final thickness', '775 ± 20', 'µm'], ['Site flatness (26 × 8 mm)', '< 20', 'nm']]; },
    eq: `N<sub>wafers</sub> = ${fr('L<sub>ingot</sub>', 't<sub>wafer</sub> + t<sub>kerf</sub>')}`,
    eqNote: 'A 2 m ingot at 775 µm plus about 150 µm of kerf and stock removal yields roughly 2000 wafers.',
    plot: { title: 'Surface roughness after each step [nm]', draw: (c, f) => drawBars(c, [['wire sawn', 1e4, '10 µm'], ['lapped', 1e3, '1 µm'], ['etched', 100, '100 nm'], ['polished', 0.1, '0.1 nm']], { log: true, min: 0.03, hi: Math.min(3, Math.floor(g(f) * 4)) }) },
    ...bay('saw', 0, 0, 'wafer'),
    watch: { risk: 'Subsurface saw damage, particles and nanometre-scale waviness that later steals lithographic depth of focus.', by: [['Surface · SEM', 'sem.html#detectors'], ['Film and haze · ellipsometry', 'semiconductor.html#ellipsometry'], ['Substrate spec', 'semiconductor.html#wafer']] },
  },
  // ------------------------------------------------------------------ 4
  {
    id: 'deposition', accent: '#ffc730', nav: 'Primer: deposition',
    title: 'Adding atoms,\none layer at a time', kicker: 'Process primer · deposition',
    copy: 'Every film on the chip arrives as a gas. In chemical vapour deposition and epitaxy, precursor molecules decompose on the hot wafer and leave their atoms behind. Atomic layer deposition splits the reaction into two self-limiting half-steps, so each cycle adds exactly one sub-monolayer on every surface, however deep or hidden.',
    points: [
      ['Epitaxy', 'On a clean crystal the new atoms continue the lattice: used for the channel stack and source/drain.'],
      ['CVD · PVD', 'Conformal dielectrics and tungsten by CVD; barrier and seed metals sputtered by PVD.'],
      ['ALD', '0.05–0.1 nm per cycle, conformal inside gaps a few nanometres wide: essential for gate-all-around.'],
    ],
    readouts: (f) => { const T = lerp(500, 1150, g(f)), r = depRate(1000 / (T + 273)); return [['Wafer temperature', T.toFixed(0), '°C'], ['Growth rate', r >= 10 ? r.toFixed(0) : r.toFixed(2), 'nm/min'], ['Regime', r < 0.5 * 400 * ((T + 273) / 1300) ** 1.5 ? 'reaction limited' : 'transport limited', ''], ['ALD growth per cycle', '0.05–0.1', 'nm'], ['ALD cycle time', '1–10', 's']]; },
    eq: `R = ${fr('1', '1/k<sub>s</sub> + 1/h<sub>g</sub>')} , &nbsp; k<sub>s</sub> ∝ e<sup>−E<sub>a</sub>/kT</sup>`,
    eqNote: 'Growth is limited by surface reaction at low temperature and by gas-phase transport at high temperature.',
    plot: { title: 'Silicon growth rate vs temperature', xl: '1000 / T [K⁻¹]', yl: 'rate [nm/min]', ly: true, x: [0.68, 1.35], y: [0.01, 1000], series: [{ f: (x) => depRate(x), c: 'accent' }], vl: [{ x: 0.86, name: 'transport | reaction' }], mark: (f) => 1000 / (lerp(500, 1150, g(f)) + 273) },
    ...bay('dep', 0),
    watch: { risk: 'Thickness and composition drifting across the wafer, particles from the chamber wall, and voids where a film closes a gap too early.', by: [['Thickness · ellipsometry', 'semiconductor.html#ellipsometry'], ['Cross-section · TEM', 'tem.html#contrast']] },
  },
  // ------------------------------------------------------------------ 5
  {
    id: 'stack', accent: '#b7ff54', nav: 'Si/SiGe stack',
    title: 'Grow the channels\nbefore the transistor', kicker: 'Superlattice epitaxy',
    copy: 'The nanosheet transistor begins as a stack of alternating silicon and silicon-germanium layers grown epitaxially over the whole wafer. The silicon layers will become the channels; the SiGe layers are sacrificial and exist only to hold them apart. Each layer is 5 to 10 nm thick and must be uniform to a few atomic layers, because its thickness is the channel thickness.',
    points: [
      ['Three or four pairs', 'Sheet count sets drive current per footprint; more sheets add parasitic capacitance and height.'],
      ['25–30 % germanium', 'Enough Ge for a highly selective release etch, little enough to stay fully strained.'],
      ['Sharp interfaces', 'Low growth temperature limits Ge diffusion, which would blur the sheets.'],
    ],
    readouts: (f) => { const x = lerp(0.1, 0.5, g(f)); return [['Germanium fraction', (x * 100).toFixed(0), '%'], ['Lattice mismatch', (4.18 * x).toFixed(2), '%'], ['Critical thickness (metastable)', hcSiGe(x).toFixed(0), 'nm'], ['Si sheet · SiGe spacer', '5–7 · 8–12', 'nm'], ['Thickness control', '± 0.3', 'nm']]; },
    eq: `a(x) ≈ 5.431 + 0.20x + 0.027x² Å , &nbsp; ε = ${fr('a<sub>SiGe</sub> − a<sub>Si</sub>', 'a<sub>Si</sub>')}`,
    eqNote: 'SiGe is compressively strained to match silicon in-plane; beyond a critical thickness it relaxes by misfit dislocations.',
    plot: { title: 'Critical thickness of strained SiGe on Si', xl: 'Ge [%]', yl: 'h_c [nm]', ly: true, x: [10, 60], y: [5, 1000], series: [{ f: (x) => hcSiGe(x / 100), c: 'accent' }], hl: [{ y: 60, name: 'total SiGe in a 4-pair stack' }], mark: (f) => lerp(10, 50, g(f)) },
    ...proc('dep', 0, 1),
    watch: { risk: 'Layer thickness or Ge fraction off target, interdiffusion at the interfaces, and misfit dislocations if the stack relaxes.', by: [['Strain and period · XRD', 'xrd.html#profile'], ['Interfaces · TEM', 'tem.html#hrtem'], ['Composition · SIMS', 'semiconductor.html#sims']] },
  },
  // ------------------------------------------------------------------ 6
  {
    id: 'lithography', accent: '#18ff92', nav: 'Primer: lithography',
    title: 'Printing with\n13.5 nm light', kicker: 'Process primer · EUV lithography',
    copy: 'A pattern is transferred by projecting a demagnified image of a mask onto a light-sensitive resist. The smallest printable half-pitch scales with wavelength over numerical aperture, which is why the leading edge moved from 193 nm to 13.5 nm light. Extreme ultraviolet is absorbed by everything, so the scanner runs in vacuum and uses only mirrors, including the mask.',
    points: [
      ['Source', 'A CO₂ laser hits 50 000 tin droplets per second; the plasma radiates EUV into a collector mirror.'],
      ['Optics', 'Mo/Si multilayer mirrors reflect about 70 % each; ten reflections leave a few per cent of the light.'],
      ['High NA', 'Anamorphic 0.55 NA optics shrink the half-pitch from 13 nm to 8 nm at the cost of half-field exposures.'],
    ],
    readouts: (f) => { const k1 = lerp(0.6, 0.28, g(f)); return [['k₁', k1.toFixed(2), ''], ['Half-pitch · 193 nm immersion', halfPitch(k1, 193, 1.35).toFixed(0), 'nm'], ['Half-pitch · EUV 0.33', halfPitch(k1, 13.5, 0.33).toFixed(1), 'nm'], ['Half-pitch · EUV 0.55', halfPitch(k1, 13.5, 0.55).toFixed(1), 'nm'], ['Photon energy', '92', 'eV']]; },
    eq: `HP = k₁ ${fr('λ', 'NA')} , &nbsp; DOF = k₂ ${fr('λ', 'NA²')}`,
    eqNote: 'Rayleigh criteria. k₁ cannot go below 0.25 for a single exposure; production runs at 0.3–0.4.',
    plot: { title: 'Printable half-pitch vs k₁', xl: 'k₁', yl: 'half-pitch [nm]', ly: true, x: [0.25, 0.65], y: [4, 120], series: [{ f: (k) => halfPitch(k, 193, 1.35), c: 'dim', name: '193i, NA 1.35', lx: 0.45 }, { f: (k) => halfPitch(k, 13.5, 0.33), c: 'accent', name: 'EUV 0.33', lx: 0.45 }, { f: (k) => halfPitch(k, 13.5, 0.55), c: 'fg', name: 'EUV 0.55', lx: 0.45 }], mark: (f) => lerp(0.6, 0.28, g(f)), markSeries: 1 },
    ...bay('euv', 1),
    watch: { risk: 'Too few photons per feature: random missing or bridging lines, line-edge roughness, and overlay errors between layers.', by: [['CD and roughness · SEM', 'sem.html#image'], ['Charging of resist', 'sem.html#charge']] },
  },
  // ------------------------------------------------------------------ 7
  {
    id: 'etch', accent: '#17f1d1', nav: 'Primer: etch',
    title: 'Straight down,\nand only there', kicker: 'Process primer · plasma etch',
    copy: 'Etching copies the resist pattern into the film beneath. In a plasma, reactive radicals arrive from all directions while ions are accelerated straight down by the sheath voltage, so the bottom of a feature etches much faster than its sidewalls. Chemistry provides selectivity between materials; ion energy and sidewall passivation provide direction.',
    points: [
      ['Anisotropy', 'Ion-assisted reactions plus polymer on the sidewalls give vertical profiles at 10:1 aspect ratio and beyond.'],
      ['Selectivity', 'The ratio of etch rates between the target film and the mask or stop layer.'],
      ['Atomic layer etching', 'Alternate a self-limiting surface modification with a gentle removal step: one layer per cycle.'],
    ],
    readouts: (f) => { const E = lerp(15, 200, g(f)), a = etchYield(E, 20, 0.12), b = etchYield(E, 45, 0.05); return [['Ion energy', E.toFixed(0), 'eV'], ['Yield · silicon', a.toFixed(2), 'atoms/ion'], ['Yield · oxide', b.toFixed(2), 'atoms/ion'], ['Selectivity Si : SiO₂', b > 0 ? (a / b).toFixed(1) : '∞', ''], ['Pressure', '2–50', 'mTorr']]; },
    eq: `Y ∝ ${rt('E<sub>ion</sub>')} − ${rt('E<sub>th</sub>')} , &nbsp; A = 1 − ${fr('R<sub>lateral</sub>', 'R<sub>vertical</sub>')}`,
    eqNote: 'Ion-enhanced etch yield above a threshold energy, and the definition of anisotropy.',
    plot: { title: 'Etch yield vs ion energy (Cl₂ plasma)', xl: 'ion energy [eV]', yl: 'yield [atoms/ion]', x: [0, 220], y: [0, 1.4], series: [{ f: (E) => etchYield(E, 20, 0.12), c: 'accent', name: 'Si', lx: 150 }, { f: (E) => etchYield(E, 45, 0.05), c: 'fg', name: 'SiO₂', lx: 150 }], mark: (f) => lerp(15, 200, g(f)) },
    ...bay('etch', 1),
    watch: { risk: 'Bowed or tapered profiles, micro-loading between dense and isolated features, and residues or damage left on the etched surface.', by: [['Profile · SEM cross-section', 'sem.html#detectors'], ['Damage layer · TEM', 'tem.html#hrtem']] },
  },
  // ------------------------------------------------------------------ 8
  {
    id: 'fins', accent: '#5ac8ff', nav: 'Sheet patterning',
    title: 'Cut the stack\ninto ribbons', kicker: 'Active-area patterning',
    copy: 'EUV lithography and etch slice the blanket stack into long ribbons, each a multilayer fin whose width becomes the nanosheet width. Unlike a FinFET, where drive strength comes only in whole numbers of fins, the sheet width is drawn on the mask and can be any value from about 15 to 50 nm. The etch continues into the substrate so that neighbouring devices can be isolated.',
    points: [
      ['Continuous width', 'Wide sheets for high current, narrow ones for low power, in the same cell height.'],
      ['Profile control', 'Sidewalls must be vertical through Si and SiGe alike, or the sheets differ in width.'],
      ['Line cuts', 'A second EUV mask removes ribbons where no transistor is wanted.'],
    ],
    readouts: (f) => { const F = lerp(22, 68, g(f)); return [['Footprint width', F.toFixed(0), 'nm'], ['Sheet width', Math.max(6, F - 12).toFixed(0), 'nm'], ['W<sub>eff</sub> · 3 nanosheets', weffSheet(F).toFixed(0), 'nm'], ['W<sub>eff</sub> · FinFET', weffFin(F).toFixed(0), 'nm'], ['Sheet thickness', '5', 'nm']]; },
    eq: `W<sub>eff</sub> = N<sub>sheet</sub> · 2 (W<sub>sheet</sub> + T<sub>sheet</sub>)`,
    eqNote: 'Gate-controlled perimeter per transistor. A FinFET offers N<sub>fin</sub> (2H<sub>fin</sub> + W<sub>fin</sub>) in fixed steps.',
    plot: { title: 'Effective channel width per footprint', xl: 'footprint width [nm]', yl: 'W_eff [nm]', x: [20, 70], y: [0, 400], n: 300, series: [{ f: (F) => weffSheet(F), c: 'accent', name: 'nanosheet ×3', lx: 24 }, { f: (F) => weffFin(F), c: 'dim', name: 'FinFET', lx: 56 }], mark: (f) => lerp(22, 68, g(f)) },
    ...proc('euv', 1, 2),
    watch: { risk: 'Ribbon width variation, tapered sidewalls that make the lower sheets wider, and pitch walking between neighbours.', by: [['Top-down CD · SEM', 'sem.html#image'], ['Sheet profile · TEM', 'tem.html#contrast']] },
  },
  // ------------------------------------------------------------------ 9
  {
    id: 'cmp', accent: '#5a9cff', nav: 'Primer: planarisation',
    title: 'Polish it flat\nagain', kicker: 'Process primer · CMP',
    copy: 'Every deposition follows the topography beneath it, and lithography has a depth of focus of only tens of nanometres. Chemical-mechanical planarisation presses the wafer face down against a rotating pad flooded with slurry. Chemistry softens the surface, abrasive particles wipe it away, and high spots are removed faster than low ones until the wafer is flat.',
    points: [
      ['Stop layers', 'A slow-polishing film such as nitride tells the process where to end.'],
      ['Dishing and erosion', 'Wide soft features polish below their surroundings; dummy fill keeps pattern density even.'],
      ['Endpoint', 'Motor current, optical reflectance or eddy current sensors detect the layer change in real time.'],
    ],
    readouts: (f) => { const P = lerp(1, 5, g(f)); return [['Down force', P.toFixed(1), 'psi'], ['Relative velocity', '1.0', 'm/s'], ['Removal rate', (100 * P).toFixed(0), 'nm/min'], ['Within-wafer non-uniformity', '< 3', '%'], ['Abrasive size', '30–100', 'nm']]; },
    eq: `RR = K<sub>p</sub> · P · V`,
    eqNote: 'Preston’s equation: removal rate is proportional to pressure and relative velocity.',
    plot: { title: 'Removal rate vs down force', xl: 'pressure [psi]', yl: 'rate [nm/min]', x: [0, 6], y: [0, 900], series: [{ f: (P) => 100 * P * 0.5, c: 'dim', name: '0.5 m/s', lx: 4.6 }, { f: (P) => 100 * P * 1.0, c: 'accent', name: '1.0 m/s', lx: 4.6 }, { f: (P) => 100 * P * 1.5, c: 'fg', name: '1.5 m/s', lx: 4.0 }], mark: (f) => lerp(1, 5, g(f)), markSeries: 1 },
    ...bay('cmp', 2),
    watch: { risk: 'Micro-scratches, slurry residue, dishing of wide features and erosion of dense arrays.', by: [['Scratches and residue · SEM', 'sem.html#detectors'], ['Remaining film · ellipsometry', 'semiconductor.html#ellipsometry']] },
  },
  // ------------------------------------------------------------------ 10
  {
    id: 'isolation', accent: '#8e9bff', nav: 'Isolation',
    title: 'Oxide between\nneighbours', kicker: 'Shallow trench isolation',
    copy: 'The trenches between ribbons are filled with silicon dioxide so that adjacent transistors cannot talk through the substrate. A flowable oxide fills gaps too narrow for conventional CVD, is densified by anneal, and is polished back to the top of the ribbons. A final recess etch lowers the oxide to the base of the stack and exposes the layers that will become channels.',
    points: [
      ['Gap fill', 'Trenches under 15 nm wide and over 100 nm deep must fill without seams or voids.'],
      ['Liner', 'A thin oxide or nitride liner protects the SiGe layers from oxidation during the anneal.'],
      ['Recess', 'The oxide height sets where the gate will end; variation becomes transistor variation.'],
    ],
    readouts: (f) => { const t = lerp(0, 60, g(f)); return [['Recess etch time', t.toFixed(0), 's'], ['Stack revealed', Math.min(60, t * 1.0).toFixed(0), 'nm'], ['Target reveal', '60', 'nm'], ['Trench aspect ratio', '≈ 8 : 1', ''], ['Recess uniformity', '± 1.5', 'nm']]; },
    eq: `AR = ${fr('depth', 'width')} , &nbsp; h<sub>reveal</sub> = R<sub>etch</sub> · t`,
    eqNote: 'Fill difficulty grows with aspect ratio; the reveal height is set by a timed, highly uniform etch.',
    plot: { title: 'Stack reveal vs recess time', xl: 'time [s]', yl: 'reveal [nm]', x: [0, 70], y: [0, 80], series: [{ f: (t) => t * 1.0, c: 'accent' }], hl: [{ y: 60, name: 'target' }], mark: (f) => lerp(0, 60, g(f)) },
    ...proc('cmp', 2, 3),
    watch: { risk: 'Voids or seams in the fill, oxidised SiGe layers, and uneven recess depth from ribbon to ribbon.', by: [['Voids · TEM cross-section', 'tem.html#contrast'], ['Step height · SEM', 'sem.html#detectors']] },
  },
  // ------------------------------------------------------------------ 11
  {
    id: 'dummygate', accent: '#ff4b4b', nav: 'Dummy gate',
    title: 'A placeholder\nfor the gate', kicker: 'Sacrificial gate',
    copy: 'The real gate materials cannot survive the hot steps that follow, so a stand-in is built first. Amorphous or polycrystalline silicon is deposited over a thin protective oxide and patterned by EUV into lines running across the ribbons. Their width is the gate length, about 12 nm, and their spacing is the contacted gate pitch, the main measure of how densely transistors are packed.',
    points: [
      ['Gate-last', 'The placeholder defines the geometry now and is swapped for high-k and metal later.'],
      ['Gate pitch', 'About 45–48 nm at this node, close to the limit of a single 0.33 NA EUV exposure.'],
      ['Hard mask', 'A nitride and oxide cap protects the dummy gate through spacer and epitaxy steps.'],
    ],
    readouts: (f) => { const i = Math.min(5, Math.floor(g(f) * 6)); return [['Node', NODES[i][0], ''], ['Contacted gate pitch', String(NODES[i][1]), 'nm'], ['Gate length (2 nm class)', '≈ 12', 'nm'], ['Dummy gate height', '80–100', 'nm'], ['CD uniformity (3σ)', '< 1', 'nm']]; },
    eq: `CPP = L<sub>g</sub> + 2 t<sub>spacer</sub> + W<sub>contact</sub>`,
    eqNote: 'The contacted gate pitch must hold the gate, two spacers and a source/drain contact.',
    plot: { title: 'Contacted gate pitch by node [nm]', draw: (c, f) => drawBars(c, NODES.map(([n, v]) => [n, v, `${v} nm`]), { hi: Math.min(5, Math.floor(g(f) * 6)), min: 0 }) },
    ...proc('etch', 3, 4),
    watch: { risk: 'Gate line-width variation and roughness, footing where the gate meets the ribbon, and poly residue between ribbons.', by: [['Gate CD · SEM', 'sem.html#image'], ['Gate profile · TEM', 'tem.html#contrast']] },
  },
  // ------------------------------------------------------------------ 12
  {
    id: 'spacers', accent: '#ff8f42', nav: 'Spacers',
    title: 'Insulate the gate\nfrom its neighbours', kicker: 'Gate and inner spacers',
    copy: 'A conformal dielectric is deposited and etched back so that it remains only on the gate sidewalls. The ribbon outside the gate is then etched away, and the exposed ends of the SiGe layers are recessed a few nanometres and refilled with dielectric. These inner spacers are unique to nanosheets: they separate the future metal gate from the source and drain between every pair of sheets.',
    points: [
      ['Low-k spacer', 'SiOCN or SiBCN with k near 4.5–5 instead of nitride at 7 cuts gate-to-contact capacitance.'],
      ['Inner spacer', 'About 5 nm thick; its depth uniformity sets effective gate length sheet by sheet.'],
      ['Source/drain recess', 'Removing the ribbon here exposes clean sheet ends for epitaxy to grow from.'],
    ],
    readouts: (f) => { const k = lerp(7, 1, g(f)); return [['Spacer dielectric constant', k.toFixed(1), k > 6.5 ? 'SiN' : k > 3.9 ? 'SiOCN' : k > 1.5 ? 'porous' : 'air gap'], ['Fringe capacitance', (0.074 * k).toFixed(2), 'fF/µm'], ['Gate spacer thickness', '5–7', 'nm'], ['Inner spacer thickness', '≈ 5', 'nm'], ['Indent control', '± 1', 'nm']]; },
    eq: `C<sub>par</sub> ≈ ${fr('k ε₀ · H<sub>gate</sub>', 't<sub>spacer</sub>')}`,
    eqNote: 'Parallel-plate estimate of gate-to-contact capacitance per unit width, for a 50 nm tall gate and 6 nm spacer.',
    plot: { title: 'Parasitic capacitance vs spacer k', xl: 'dielectric constant k', yl: 'C [fF/µm]', x: [1, 7.5], y: [0, 0.6], series: [{ f: (k) => 0.074 * k, c: 'accent' }], vl: [{ x: 3.9, name: 'SiO₂' }, { x: 7, name: 'SiN' }], mark: (f) => lerp(7, 1, g(f)) },
    ...proc('dep', 4, 5),
    watch: { risk: 'Inner spacers too shallow or missing, which shorts gate to source/drain, and spacer pull-down that exposes the gate corner.', by: [['Inner spacer · TEM', 'tem.html#hrtem'], ['Composition · EELS / EDS', 'tem.html#spectroscopy']] },
  },
  // ------------------------------------------------------------------ 13
  {
    id: 'sourcedrain', accent: '#ffc730', nav: 'Source/drain epitaxy',
    title: 'Grow the source\nand drain', kicker: 'Selective epitaxy',
    copy: 'Heavily doped crystal is grown from the exposed sheet ends and the substrate until it merges into a single block on each side of the gate. PMOS receives boron-doped SiGe, whose larger lattice compresses the channel and speeds up holes; NMOS receives phosphorus-doped silicon. The two types are grown separately, each while the other is masked.',
    points: [
      ['Selective growth', 'HCl in the gas removes nuclei on dielectric, so crystal grows only on silicon.'],
      ['Active doping', 'Above 10²¹ cm⁻³ of electrically active dopant, to bring contact resistivity near 10⁻⁹ Ω·cm².'],
      ['Strain', 'SiGe with 40–60 % Ge pushes on the sheets from both ends: a mobility gain for holes.'],
    ],
    readouts: (f) => { const A = logf(f, 2000, 150), rc = 1e-9; return [['Contact area', A.toFixed(0), 'nm²'], ['Contact resistivity', '1×10⁻⁹', 'Ω·cm²'], ['Contact resistance', (rc / (A * 1e-14)).toFixed(0), 'Ω'], ['PMOS · SiGe:B', '40–60 % Ge', '> 10²¹ cm⁻³'], ['NMOS · Si:P', '', '> 3×10²¹ cm⁻³']]; },
    eq: `R<sub>c</sub> = ${fr('ρ<sub>c</sub>', 'A<sub>contact</sub>')}`,
    eqNote: 'As contacts shrink, interface resistance dominates the transistor’s series resistance.',
    plot: { title: 'Contact resistance vs contact area', xl: 'area [nm²]', yl: 'R [Ω]', lx: true, ly: true, x: [100, 5000], y: [5, 5000], series: [{ f: (A) => 2e-9 / (A * 1e-14), c: 'dim', name: '2×10⁻⁹', lx: 1500 }, { f: (A) => 1e-9 / (A * 1e-14), c: 'accent', name: 'ρc = 1×10⁻⁹ Ω·cm²', lx: 130 }, { f: (A) => 5e-10 / (A * 1e-14), c: 'fg', name: '5×10⁻¹⁰', lx: 1500 }], mark: (f) => logf(f, 2000, 150), markSeries: 1 },
    ...proc('dep', 5, 6),
    watch: { risk: 'Unmerged or over-merged epitaxy, stacking faults where growth fronts meet, and dopant that is present but not electrically active.', by: [['Faults · TEM', 'tem.html#hrtem'], ['Dopant profile · SIMS', 'semiconductor.html#sims'], ['Strain · Raman', 'semiconductor.html#raman']] },
  },
  // ------------------------------------------------------------------ 14
  {
    id: 'gateremoval', accent: '#b7ff54', nav: 'Dummy gate removal',
    title: 'Pull out the\nplaceholder', kicker: 'Replacement-gate open',
    copy: 'Oxide is deposited over everything and polished back until the tops of the dummy gates are exposed. A wet or dry etch that attacks silicon thousands of times faster than oxide or nitride then removes the placeholder entirely. What remains is a trench between the spacers with the multilayer ribbon crossing it, ready to be turned into channels.',
    points: [
      ['Poly-open polish', 'CMP must stop on every gate across the wafer within a few nanometres.'],
      ['Selective removal', 'Hot ammonia or TMAH dissolves silicon and stops on the thin dummy oxide.'],
      ['Clean trench', 'Any residue left at the bottom corners would block the gate metal later.'],
    ],
    readouts: (f) => { const t = lerp(0, 40, g(f)); return [['Etch time', t.toFixed(0), 's'], ['Dummy gate removed', Math.min(90, t * 5).toFixed(0), 'nm'], ['Oxide lost', (t * 0.002).toFixed(2), 'nm'], ['Selectivity Si : SiO₂', '> 2000 : 1', ''], ['Trench width', '≈ 12', 'nm']]; },
    eq: `S = ${fr('R<sub>target</sub>', 'R<sub>stop</sub>')}`,
    eqNote: 'Selectivity: how much faster the film to be removed etches than the film that must stay.',
    plot: { title: 'Etch rate in hot TMAH [nm/min], approximate', draw: (c) => drawBars(c, [['poly-Si', 300, '300'], ['SiGe 30 %', 30, '30'], ['SiO₂', 0.1, '0.1'], ['SiN', 0.05, '0.05']], { log: true, min: 0.01 }) },
    ...proc('cmp', 6, 7),
    watch: { risk: 'Gates left unopened by uneven polish, silicon residue in the trench corners, and attack of the ribbon through a pinhole in the dummy oxide.', by: [['Open trenches · SEM', 'sem.html#detectors'], ['Residue · TEM', 'tem.html#contrast']] },
  },
  // ------------------------------------------------------------------ 15
  {
    id: 'release', accent: '#18ff92', nav: 'Channel release',
    title: 'Free the\nnanosheets', kicker: 'Sacrificial SiGe removal',
    copy: 'Inside the open gate trench the SiGe layers are etched away isotropically while the silicon layers are left untouched. The silicon sheets are now bridges a few nanometres thick, anchored at both ends in the source and drain and surrounded by empty space. This is the defining step of the gate-all-around transistor, and it depends entirely on etch selectivity.',
    points: [
      ['Selective chemistry', 'Vapour HCl, or fluorine radicals with an oxidiser, remove SiGe over 100 times faster than Si.'],
      ['Sheet loss', 'Every nanometre of silicon lost thins the channel and shifts the threshold voltage.'],
      ['Stiction', 'Dry processes avoid the capillary forces that would pull wet sheets together.'],
    ],
    readouts: (f) => { const x = lerp(15, 40, g(f)), S = selSiGe(x); return [['Ge in sacrificial layer', x.toFixed(0), '%'], ['Selectivity SiGe : Si', S.toFixed(0), ': 1'], ['Si lost while clearing 15 nm', (15 / S).toFixed(2), 'nm'], ['Sheet thickness', '5–6', 'nm'], ['Sheet spacing', '8–12', 'nm']]; },
    eq: `Δt<sub>Si</sub> = ${fr('W<sub>sheet</sub> / 2', 'S')}`,
    eqNote: 'Silicon lost from each sheet surface while the etch travels half the sheet width through SiGe.',
    plot: { title: 'Release selectivity vs Ge content, approximate', xl: 'Ge [%]', yl: 'SiGe : Si', ly: true, x: [10, 45], y: [5, 1000], series: [{ f: (x) => selSiGe(x), c: 'accent' }], hl: [{ y: 100, name: 'needed' }], mark: (f) => lerp(15, 40, g(f)) },
    ...proc('etch', 7, 8), cam2: VIEW.deviceClose,
    watch: { risk: 'SiGe left between sheets, thinned or rounded sheets, and sheets bent or stuck together.', by: [['Sheet shape · TEM', 'tem.html#hrtem'], ['Residual Ge · EELS / EDS', 'tem.html#spectroscopy']] },
  },
  // ------------------------------------------------------------------ 16
  {
    id: 'hkmg', accent: '#17f1d1', nav: 'High-k metal gate',
    title: 'Wrap the gate\nall the way round', kicker: 'Gate stack',
    copy: 'Atomic layer deposition coats every surface of every sheet: first a sub-nanometre interfacial oxide, then about 1.5 nm of hafnium oxide, then work-function metals a few nanometres thick, and finally a fill metal. Hafnium oxide stores as much charge as a silicon dioxide layer five times thinner while leaking thousands of times less. Different threshold voltages are set by adding or removing dipole and metal layers device by device.',
    points: [
      ['Equivalent oxide thickness', 'About 0.8–0.9 nm electrically, built from roughly 2 nm of physical dielectric.'],
      ['Multi-V<sub>t</sub>', 'Lanthanum or aluminium dipoles shift the threshold without thick metals that would not fit between sheets.'],
      ['The gap', 'Everything must fit in the 8–12 nm between sheets, from both sides.'],
    ],
    readouts: (f) => { const e = lerp(1.6, 0.7, g(f)); return [['Equivalent oxide thickness', e.toFixed(2), 'nm'], ['Leakage · SiO₂', sci(jSiO2(e)), 'A/cm²'], ['Leakage · HfO₂ stack', sci(jHfO2(e)), 'A/cm²'], ['HfO₂ thickness (k ≈ 18)', ((e - 0.5) * 18 / 3.9).toFixed(1), 'nm'], ['Interfacial SiO₂', '0.5', 'nm']]; },
    eq: `EOT = t<sub>IL</sub> + t<sub>hk</sub> ${fr('3.9', 'k<sub>hk</sub>')} , &nbsp; J ∝ e<sup>−2κ t<sub>phys</sub></sup>`,
    eqNote: 'A high-k film is physically thicker for the same capacitance, and tunnelling falls exponentially with thickness.',
    plot: { title: 'Gate leakage at 1 V vs EOT, approximate', xl: 'EOT [nm]', yl: 'J [A/cm²]', ly: true, x: [0.6, 2], y: [1e-6, 1e5], series: [{ f: (e) => jSiO2(e), c: 'dim', name: 'SiO₂', lx: 1.5 }, { f: (e) => jHfO2(e), c: 'accent', name: 'HfO₂ / metal gate', lx: 0.9 }], hl: [{ y: 1, name: 'budget' }], mark: (f) => lerp(1.6, 0.7, g(f)), markSeries: 1 },
    ...proc('dep', 8, 9), cam2: VIEW.deviceClose,
    watch: { risk: 'Work-function metal pinching off between sheets, threshold-voltage spread, and interface traps or leakage paths in the dielectric.', by: [['Layer-by-layer · STEM', 'tem.html#stem'], ['Interface traps · C–V', 'semiconductor.html#cv'], ['Threshold · I–V', 'semiconductor.html#iv']] },
  },
  // ------------------------------------------------------------------ 17
  {
    id: 'contacts', accent: '#5ac8ff', nav: 'Contacts',
    title: 'Reach down to\nthe transistor', kicker: 'Middle of line',
    copy: 'Trenches are etched through the oxide down to the source and drain, lined with titanium that reacts to form a silicide, and filled with metal. The gate receives its own contact, placed directly over the active device to save area. With only about 15 nm between a gate and its neighbouring contact, both are capped with dielectric so that a slightly misplaced via cannot short them.',
    points: [
      ['Silicide', 'Titanium silicide lowers the barrier between metal and heavily doped semiconductor.'],
      ['Barrierless fill', 'Tungsten, cobalt, molybdenum or ruthenium grown without a resistive liner.'],
      ['Self-aligned contacts', 'Dielectric caps on the gate let the contact etch land safely even with overlay error.'],
    ],
    readouts: (f) => { const cd = lerp(28, 9, g(f)); return [['Contact CD', cd.toFixed(0), 'nm'], ['Plug resistance · 2 nm barrier', viaR(cd, 2).toFixed(0), 'Ω'], ['Plug resistance · barrierless', viaR(cd, 0).toFixed(0), 'Ω'], ['Gate-to-contact space', '≈ 15', 'nm'], ['Overlay budget', '< 2', 'nm']]; },
    eq: `R = ${fr('ρ(d) · h', '(d − 2t<sub>b</sub>)²')}`,
    eqNote: 'A barrier of thickness t<sub>b</sub> takes area from the conductor; resistivity itself rises as d shrinks.',
    plot: { title: 'Contact plug resistance vs size, approximate', xl: 'CD [nm]', yl: 'R [Ω]', ly: true, x: [8, 30], y: [5, 2000], series: [{ f: (d) => viaR(d, 2), c: 'dim', name: 'with 2 nm barrier', lx: 16 }, { f: (d) => viaR(d, 0), c: 'accent', name: 'barrierless', lx: 9 }], mark: (f) => lerp(28, 9, g(f)), markSeries: 1 },
    ...proc('etch', 9, 10),
    watch: { risk: 'Contacts that stop short and stay open, contacts that touch the gate, and voids in the metal fill.', by: [['Opens · voltage contrast SEM', 'sem.html#image'], ['Shorts and voids · TEM', 'tem.html#contrast'], ['Silicide phase · EELS', 'tem.html#spectroscopy']] },
  },
  // ------------------------------------------------------------------ 18
  {
    id: 'beol', accent: '#5a9cff', nav: 'Copper wiring',
    title: 'Fifteen floors\nof wiring', kicker: 'Back end of line',
    copy: 'Transistors are connected by a stack of metal layers, each a trench-and-via pattern etched into a low-k dielectric, lined, filled with metal and polished flat. The lowest layers have a pitch near 20 nm and are printed by EUV; upper layers grow wider and thicker to carry current and clocks across the die. At these widths electrons scatter from the wire surfaces and grain boundaries, so resistivity is several times the bulk value.',
    points: [
      ['Dual damascene', 'Via and trench are etched first and filled together: copper cannot be plasma etched.'],
      ['Low-k dielectric', 'Porous SiCOH with k near 2.5–3 reduces wire-to-wire capacitance, at the cost of strength.'],
      ['Beyond copper', 'Ruthenium or molybdenum need no thick barrier and win below about 12 nm line width.'],
    ],
    readouts: (f) => { const w = lerp(40, 8, g(f)); return [['Line width', w.toFixed(0), 'nm'], ['Resistivity · Cu with liner', rhoWire(w, 1.68, 39, 2).toFixed(1), 'µΩ·cm'], ['Resistivity · Ru', rhoWire(w, 7.1, 6.6, 0).toFixed(1), 'µΩ·cm'], ['Minimum metal pitch', '≈ 20', 'nm'], ['Metal layers', '14–19', '']]; },
    eq: `ρ(w) ≈ ρ₀ <span class="big">(</span>1 + C ${fr('λ', 'w')}<span class="big">)</span> , &nbsp; τ = R C`,
    eqNote: 'Surface and grain-boundary scattering add a term in mean free path λ over width: 39 nm for Cu, 6.6 nm for Ru.',
    plot: { title: 'Wire resistivity vs line width', xl: 'width [nm]', yl: 'ρ [µΩ·cm]', x: [7, 40], y: [0, 40], series: [{ f: (w) => rhoWire(w, 1.68, 39, 2), c: 'accent', name: 'Cu + 2 nm liner', lx: 22 }, { f: (w) => rhoWire(w, 7.1, 6.6, 0), c: 'fg', name: 'Ru, no liner', lx: 22 }], mark: (f) => lerp(40, 8, g(f)) },
    ...proc('cmp', 10, 11),
    watch: { risk: 'Voids in narrow lines, via misalignment, cracked or damaged low-k, and electromigration and dielectric breakdown over lifetime.', by: [['Voids · SEM cross-section', 'sem.html#detectors'], ['Barrier integrity · STEM', 'tem.html#stem'], ['Opens · voltage contrast', 'sem.html#image']] },
  },
  // ------------------------------------------------------------------ 19
  {
    id: 'bonding', accent: '#c58bff', nav: 'Bonding and thinning',
    title: 'Turn the wafer\nupside down', kicker: 'Carrier bonding',
    copy: 'To build wiring on the other side, the finished front is covered with oxide, polished, and bonded face down to a second silicon wafer. Two clean, flat oxide surfaces brought into contact stick by hydrogen bonds, and a mild anneal turns them into covalent bonds. The carrier now supports the device layer while the original 775 µm substrate is removed from behind.',
    points: [
      ['Fusion bonding', 'Needs sub-nanometre roughness and no particles: one 1 µm particle leaves a millimetre-sized void.'],
      ['Distortion', 'Bonding stretches the wafer by parts per million, which backside lithography must correct.'],
      ['Removal sequence', 'Grinding, then polishing, then a selective etch that stops on a buried SiGe layer.'],
    ],
    readouts: (f) => { const s = Math.min(3, Math.floor(g(f) * 4)); const st = [['bonded', '775 µm'], ['ground', '20 µm'], ['polished', '2 µm'], ['etched to stop layer', '≈ 0.3 µm']][s]; return [['Step', st[0], ''], ['Silicon remaining', st[1], ''], ['Bond energy after anneal', '> 2', 'J/m²'], ['Thickness variation', '< 50', 'nm'], ['Bond-induced distortion', '< 10', 'nm']]; },
    eq: `Si–OH + HO–Si → Si–O–Si + H₂O`,
    eqNote: 'Hydrophilic fusion bonding: hydroxyl-terminated oxide surfaces condense into siloxane bonds on annealing.',
    plot: { title: 'Substrate remaining after each step [µm]', draw: (c, f) => drawBars(c, [['bonded', 775, '775 µm'], ['back-grind', 20, '20 µm'], ['CMP', 2, '2 µm'], ['selective etch', 0.3, '0.3 µm']], { log: true, min: 0.1, hi: Math.min(3, Math.floor(g(f) * 4)) }) },
    ...proc('bond', 11, 12, 0, 0), cam2: VIEW.deviceTall,
    watch: { risk: 'Bond voids from particles, wafer distortion that breaks backside overlay, and uneven thinning that exposes or buries devices.', by: [['Remaining silicon · ellipsometry', 'semiconductor.html#ellipsometry'], ['Bond interface · TEM', 'tem.html#contrast'], ['Stress · Raman', 'semiconductor.html#raman']] },
  },
  // ------------------------------------------------------------------ 20
  {
    id: 'backside', accent: '#ff6b9d', nav: 'Backside power',
    title: 'Power from\nunderneath', kicker: 'Backside power delivery',
    copy: 'With the substrate gone, contacts are etched from the back to the underside of the source and drain, and thick power rails are built on what used to be the bottom of the wafer. Supply current no longer has to descend through fifteen layers of thin signal wiring. The front side is left to signals alone, cells shrink, and the voltage lost between bump and transistor falls by roughly a third.',
    points: [
      ['Backside contacts', 'Either direct contacts to the source/drain or nano through-silicon vias beside the device.'],
      ['Thick, wide rails', 'Micrometre-scale copper on the back has a small fraction of the resistance of front-side M1.'],
      ['Heat', 'The device layer is now buried between two wiring stacks, so heat must leave through them.'],
    ],
    readouts: (f) => { const Lw = lerp(5, 50, g(f)); return [['Distance from bump', Lw.toFixed(0), 'µm'], ['IR drop · front-side grid', (0.024 * Lw * Lw).toFixed(0), 'mV'], ['IR drop · backside rails', (0.008 * Lw * Lw + 0.3 * Lw).toFixed(0), 'mV'], ['Supply voltage', '0.65–0.75', 'V'], ['Cell area gain', '5–10', '%']]; },
    eq: `ΔV = I · R<sub>grid</sub> , &nbsp; R = ${fr('ρ L', 'w · t')}`,
    eqNote: 'Voltage lost in the power network. Curves are illustrative; published droop reductions are about 30 %.',
    plot: { title: 'Supply droop vs distance, illustrative', xl: 'distance [µm]', yl: 'ΔV [mV]', x: [0, 55], y: [0, 80], series: [{ f: (x) => 0.024 * x * x, c: 'dim', name: 'front-side power', lx: 30 }, { f: (x) => 0.008 * x * x + 0.3 * x, c: 'accent', name: 'backside power', lx: 38 }], hl: [{ y: 35, name: '5 % of 0.7 V' }], mark: (f) => lerp(5, 50, g(f)), markSeries: 1 },
    ...proc('grind', 13, 14, 1, 1),
    watch: { risk: 'Backside contacts that miss the source/drain after bonding distortion, high contact resistance, and hot spots in the buried device layer.', by: [['Alignment · TEM cross-section', 'tem.html#contrast'], ['Contact resistance · I–V', 'semiconductor.html#iv'], ['Composition · EDS', 'sem.html#detectors']] },
  },
  // ------------------------------------------------------------------ 21
  {
    id: 'metrology', accent: '#ffc730', nav: 'Inline metrology',
    title: 'Measure everything,\nall the time', kicker: 'Inspection and metrology',
    copy: 'Between process steps, sample wafers are measured: line widths by scanning electron microscope, buried profiles by optical scatterometry, layer-to-layer overlay to better than 2 nm, and film thickness by ellipsometry. Optical and electron-beam inspection hunt for the few defects among trillions of features. Yield falls exponentially with defect density, so every excursion found early saves wafers.',
    points: [
      ['CD-SEM and scatterometry', 'Sub-nanometre precision on line width; optical models recover the full 3D profile.'],
      ['Defect inspection', 'Broadband optical tools scan whole wafers; e-beam finds what light cannot resolve.'],
      ['Feedback', 'Results steer the next lot’s dose, focus and etch time: run-to-run control.'],
    ],
    readouts: (f) => { const D = lerp(0.5, 0.05, g(f)); return [['Defect density D₀', D.toFixed(2), '/cm²'], ['Yield · 1 cm² die', (100 * Math.exp(-D)).toFixed(0), '%'], ['Yield · 4 cm² die', (100 * Math.exp(-4 * D)).toFixed(0), '%'], ['Overlay (3σ)', '< 2', 'nm'], ['CD precision', '≈ 0.1', 'nm']]; },
    eq: `Y = e<sup>−A · D₀</sup>`,
    eqNote: 'Poisson yield model: the probability that a die of area A contains no killer defect.',
    plot: { title: 'Die yield vs defect density', xl: 'D₀ [defects/cm²]', yl: 'yield', x: [0, 0.6], y: [0, 1], series: [{ f: (D) => Math.exp(-1 * D), c: 'accent', name: '1 cm²', lx: 0.45 }, { f: (D) => Math.exp(-4 * D), c: 'fg', name: '4 cm²', lx: 0.3 }, { f: (D) => Math.exp(-8 * D), c: 'dim', name: '8 cm²', lx: 0.12 }], mark: (f) => lerp(0.5, 0.05, g(f)) },
    ...bay('insp', 14, 1),
    watch: { risk: 'Sampling too few sites and missing an excursion, or resist and low-k shrinking under the measuring beam.', by: [['How the SEM images', 'sem.html#image'], ['Probe size limits', 'sem.html#objective'], ['Film thickness', 'semiconductor.html#ellipsometry'], ['Root cause · TEM', 'tem.html#hrtem']] },
    see: [['The full SEM journey', 'sem.html']],
  },
  // ------------------------------------------------------------------ 22
  {
    id: 'wafertest', accent: '#b7ff54', nav: 'Wafer test',
    title: 'First power-up', kicker: 'Wafer acceptance and sort',
    copy: 'A probe card with thousands of fine needles lands on the pads of each die while it is still part of the wafer. Test structures in the scribe lanes report transistor and wire parameters; then every die runs functional and scan patterns. The result is a wafer map of passing and failing dies, and its spatial signature often identifies the process step at fault.',
    points: [
      ['Parametric test', 'Threshold voltage, drive current, leakage, sheet and contact resistance from scribe-lane structures.'],
      ['Sort', 'Each die is binned; known-good dies matter most when several are stacked in one package.'],
      ['Signatures', 'Rings, scratches, clusters and edge losses each point to a different tool.'],
    ],
    readouts: (f) => { const D = lerp(0.6, 0.05, g(f)); return [['Defect density D₀', D.toFixed(2), '/cm²'], ['Predicted yield (1 cm²)', (100 * Math.exp(-D)).toFixed(0), '%'], ['Probes per card', '10 000–50 000', ''], ['Touch-down force', '1–3', 'g per probe'], ['Test time per die', '1–30', 's']]; },
    eq: `Y<sub>sort</sub> = ${fr('good dies', 'total dies')}`,
    eqNote: 'Measured yield, compared against the defect-limited prediction to separate random from systematic loss.',
    plot: { title: 'Wafer map as defect density falls', draw: (c, f) => drawWaferMap(c, f), tall: true },
    ...bay('probe', 14, 1),
    watch: { risk: 'Systematic yield loss hidden in the average, probe damage to pads, and marginal dies that pass cold but fail hot.', by: [['Transistor curves', 'semiconductor.html#iv'], ['Capacitance · C–V', 'semiconductor.html#cv'], ['Failure site · SEM', 'sem.html#image']] },
  },
  // ------------------------------------------------------------------ 23
  {
    id: 'dicing', accent: '#18ff92', nav: 'Dicing',
    title: 'One wafer,\nhundreds of chips', kicker: 'Singulation',
    copy: 'The wafer is separated into individual dies along the scribe lanes. Porous low-k dielectrics chip under a diamond blade, so advanced wafers are grooved by laser first, or cut entirely by a laser focused inside the silicon or by plasma etching. How many dies a wafer yields depends on die area and on how many partial dies are lost at the round edge.',
    points: [
      ['Stealth dicing', 'A laser focused below the surface creates a modified layer; the wafer is then expanded and cleaves.'],
      ['Plasma dicing', 'Etches all streets at once with no mechanical stress: narrower lanes, stronger dies.'],
      ['Die strength', 'Edge chipping seeds cracks, which matters once dies are thinned to tens of micrometres.'],
    ],
    readouts: (f) => { const A = logf(f, 30, 800); return [['Die area', A.toFixed(0), 'mm²'], ['Gross dies per 300 mm wafer', Math.max(0, dpw(A)).toFixed(0), ''], ['Lost at the edge', ((Math.PI * 300) / Math.sqrt(2 * A)).toFixed(0), 'dies'], ['Scribe lane width', '40–80', 'µm'], ['Wafer area', '707', 'cm²']]; },
    eq: `DPW = ${fr('π (d/2)²', 'A')} − ${fr('π d', rt('2A'))}`,
    eqNote: 'Dies per wafer of diameter d: wafer area over die area, minus the partial dies around the circumference.',
    plot: { title: 'Dies per 300 mm wafer vs die area', xl: 'die area [mm²]', yl: 'dies', lx: true, ly: true, x: [20, 900], y: [30, 4000], series: [{ f: (A) => dpw(A), c: 'accent' }, { f: (A) => (Math.PI * 150 ** 2) / A, c: 'dim', dash: [3, 3], name: 'area ratio only', lx: 200 }], mark: (f) => logf(f, 30, 800) },
    ...bay('dice', 14, 1),
    watch: { risk: 'Chipping and delamination of the low-k stack at the die edge, and cracks that grow during packaging or use.', by: [['Edge damage · SEM', 'sem.html#detectors'], ['Residual stress · Raman', 'semiconductor.html#raman']] },
  },
  // ------------------------------------------------------------------ 24
  {
    id: 'packaging', accent: '#5ac8ff', nav: 'Advanced packaging',
    title: 'Several chips,\none system', kicker: 'Heterogeneous integration',
    copy: 'A leading-edge die rarely ships alone. Logic, memory stacks and other dies are mounted side by side on a silicon or organic interposer, or bonded directly face to face, then attached to a substrate that fans the connections out to the board. The number of connections per square millimetre grows as the inverse square of the bump pitch, so each step in pitch is a large step in bandwidth.',
    points: [
      ['Solder bumps', 'C4 bumps at about 130 µm pitch to the substrate; micro-bumps at 25–40 µm between dies.'],
      ['Hybrid bonding', 'Copper pads and oxide bonded directly, with no solder: pitch below 10 µm, heading to 1–3 µm.'],
      ['Interposers', 'Silicon with through-silicon vias, or redistribution layers, carry thousands of die-to-die links.'],
    ],
    readouts: (f) => { const p = logf(f, 130, 3); return [['Interconnect pitch', p >= 10 ? p.toFixed(0) : p.toFixed(1), 'µm'], ['Connections', sci(1e6 / (p * p)), '/mm²'], ['Technology', p > 60 ? 'C4 solder bump' : p > 15 ? 'micro-bump' : 'hybrid bond', ''], ['Interposer line/space', '0.4–2', 'µm'], ['Package power', 'up to 500+', 'W']]; },
    eq: `n = ${fr('1', 'p²')}`,
    eqNote: 'Area-array interconnect density for pitch p. Going from 40 µm to 4 µm gives a hundred times more connections.',
    plot: { title: 'Connections per mm² vs pitch', xl: 'pitch [µm]', yl: 'per mm²', lx: true, ly: true, x: [1, 200], y: [10, 1e6], series: [{ f: (p) => 1e6 / (p * p), c: 'accent' }], vl: [{ x: 130, name: 'C4' }, { x: 36, name: 'µ-bump' }, { x: 6, name: 'hybrid' }], mark: (f) => logf(f, 130, 3) },
    ...bay('pack', 14, 1),
    watch: { risk: 'Warpage from mismatched thermal expansion, solder voids and non-wets, and bond voids or misalignment in hybrid bonding.', by: [['Joint cross-section · SEM', 'sem.html#detectors'], ['Intermetallics · EDS', 'sem.html#detectors'], ['Interface · TEM', 'tem.html#contrast']] },
  },
  // ------------------------------------------------------------------ 25
  {
    id: 'finaltest', accent: '#d93a3a', nav: 'Final test', light: true,
    title: 'Prove it,\nthen ship it', kicker: 'Final test and reliability',
    copy: 'The packaged part is tested again at hot and cold, at the limits of its supply voltage, and at speed, then sorted into performance grades. A short period of elevated voltage and temperature removes the weak parts that would otherwise fail in their first weeks. Samples from each lot run for a thousand hours of accelerated stress to confirm that wear-out lies beyond the product’s lifetime.',
    points: [
      ['Burn-in', 'Stress at raised voltage and 125 °C accelerates infant mortality so it happens in the factory.'],
      ['Speed binning', 'Natural variation spreads maximum frequency; each part is sold at the grade it reaches.'],
      ['Wear-out', 'Bias temperature instability, hot carriers, dielectric breakdown and electromigration set the end of life.'],
    ],
    readouts: (f) => { const t = logf(f, 1, 1e6); return [['Time in service', t < 100 ? t.toFixed(0) : sci(t), 'h'], ['Failure rate', bathtub(t).toFixed(0), 'FIT'], ['Phase', t < 300 ? 'infant mortality' : t < 2e5 ? 'useful life' : 'wear-out', ''], ['Burn-in', '125 °C, 1.2–1.4 × V<sub>dd</sub>', ''], ['Wafer start to shipment', '≈ 4', 'months']]; },
    eq: `λ(t) = ${fr('β', 'η')} <span class="big">(</span>${fr('t', 'η')}<span class="big">)</span><sup>β − 1</sup> , &nbsp; AF = e<sup>(E<sub>a</sub>/k)(1/T<sub>use</sub> − 1/T<sub>stress</sub>)</sup>`,
    eqNote: 'Weibull hazard rate (β < 1 early failures, β > 1 wear-out) and the Arrhenius acceleration factor. 1 FIT = one failure per 10⁹ device-hours.',
    plot: { title: 'Failure rate over life, illustrative', xl: 'time [h]', yl: 'failure rate [FIT]', lx: true, ly: true, x: [1, 2e6], y: [5, 2000], series: [{ f: (t) => bathtub(t), c: 'accent' }], vl: [{ x: 87600, name: '10 years' }], mark: (f) => logf(f, 1, 1e6) },
    ...bay('test', 14, 1),
    watch: { risk: 'Latent defects that pass every test and fail in the field, and returns that must be traced back to a single process step.', by: [['Fault isolation · SEM', 'sem.html#image'], ['Physical analysis · TEM', 'tem.html#stem'], ['Traps and drift · DLTS', 'semiconductor.html#dlts']] },
  },
];

// Cumulative, approximate: process steps completed, mask layers used, days since wafer start,
// and the smallest feature created so far.
const P = (steps, masks, days, feature) => ({ steps, masks, days, feature });
export const PASSPORT = [
  P('–', '–', '–', '–'), P('–', '–', '–', '–'), P('–', '–', '–', '–'),
  P('–', '–', '0', '–'), P('~30', '2', '2', '5 nm film'),
  P('~30', '2', '2', '5 nm film'), P('~30', '2', '2', '5 nm film'), P('~90', '6', '6', '15 nm sheet'),
  P('~90', '6', '6', '15 nm sheet'), P('~140', '8', '9', '15 nm sheet'),
  P('~190', '11', '13', '12 nm gate'), P('~250', '12', '17', '5 nm spacer'), P('~330', '16', '23', '5 nm spacer'),
  P('~380', '16', '26', '5 nm spacer'), P('~410', '17', '28', '5 nm sheet'), P('~480', '24', '35', '1.5 nm high-k'),
  P('~580', '30', '42', '1.5 nm high-k'), P('~1100', '68', '80', '1.5 nm high-k'),
  P('~1150', '68', '83', '1.5 nm high-k'), P('~1350', '76', '95', '1.5 nm high-k'),
  P('~1350', '76', '95', '1.5 nm high-k'), P('~1360', '76', '98', '1.5 nm high-k'), P('~1365', '76', '100', '1.5 nm high-k'),
  P('~1450', '80', '115', '1.5 nm high-k'), P('~1460', '80', '120', '1.5 nm high-k'),
];
