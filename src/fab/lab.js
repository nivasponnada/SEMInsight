// Lab section of the wafer-journey site:
//   1. Virtual lithography: partially coherent aerial image of a line/space grating,
//      resist blur + threshold, photon shot noise -> top-down printed pattern.
//   2. Cross-section scrubber: the device build replayed as two schematic 2D cuts.
//   3. Node comparison: planar -> FinFET -> nanosheet, approximate public figures.
import { buildPanel, statusHTML } from '../core/panel.js';
import { drawFnPlot } from '../plots.js';

// ---------------------------------------------------------------- lithography model
export const TOOLS = {
  arf: { name: 'ArF immersion', lam: 193, NA: 1.35, nMed: 1.44, Eth: 7, absorb: 0.3, single: 76 },
  euv: { name: 'EUV 0.33 NA', lam: 13.5, NA: 0.33, nMed: 1, Eth: 15, absorb: 0.2, single: 28 },
  hna: { name: 'High-NA EUV 0.55', lam: 13.5, NA: 0.55, nMed: 1, Eth: 15, absorb: 0.2, single: 18 },
};
const M = 128; // samples per pitch
const NORD = 7; // diffraction orders −7 … +7

/** Source points [s, weight] in units of NA. Dipole poles are matched to the pitch, as a scanner would set them. */
function sourcePoints(illum, tool, pitch) {
  const pts = [];
  if (illum === 'conv') {
    for (let i = 0; i < 33; i++) { const s = -0.8 + (1.6 * i) / 32; pts.push([s, Math.sqrt(Math.max(0, 0.64 - s * s)) + 0.02]); }
  } else {
    const sc = Math.min(0.8, tool.lam / (2 * pitch * tool.NA)), r = 0.1;
    for (const sgn of [-1, 1]) for (let i = 0; i < 9; i++) { const d = -r + (2 * r * i) / 8; pts.push([sgn * sc + d, Math.sqrt(Math.max(0, r * r - d * d)) + 0.01]); }
  }
  return pts;
}
export const sigmaMax = (illum) => (illum === 'conv' ? 0.8 : 0.9);

/**
 * Aerial image over one pitch (space centred on x = 0), M samples, clear-field = 1.
 * o: { tool, illum, pitch [nm], focus [nm] }
 */
export function aerialImage(o) {
  const t = TOOLS[o.tool], p = o.pitch, I = new Float64Array(M);
  const src = sourcePoints(o.illum, t, p);
  let wsum = 0;
  const c = (n) => (n === 0 ? 0.5 : Math.sin((Math.PI * n) / 2) / (Math.PI * n));
  for (const [s, w] of src) {
    wsum += w;
    const ord = [];
    for (let n = -NORD; n <= NORD; n++) {
      const cn = c(n); if (Math.abs(cn) < 1e-9) continue;
      const dir = (n * t.lam) / (p * t.NA) + s; // direction sine in units of NA
      if (Math.abs(dir) > 1) continue; // outside the pupil
      const sm = (dir * t.NA) / t.nMed; // sine of the propagation angle in the image medium
      const ph = ((2 * Math.PI * t.nMed * o.focus) / t.lam) * (Math.sqrt(Math.max(0, 1 - sm * sm)) - 1);
      ord.push([n, cn, ph]);
    }
    for (let i = 0; i < M; i++) {
      const x = (i / M - 0.5); // in pitches
      let re = 0, im = 0;
      for (const [n, cn, ph] of ord) { const a = 2 * Math.PI * n * x + ph; re += cn * Math.cos(a); im += cn * Math.sin(a); }
      I[i] += w * (re * re + im * im);
    }
  }
  for (let i = 0; i < M; i++) I[i] /= wsum;
  return I;
}
/** Periodic Gaussian blur of a one-pitch profile; sigma in samples. */
function blur1(I, sigma) {
  if (sigma < 0.05) return Float64Array.from(I);
  const r = Math.ceil(sigma * 3.2), out = new Float64Array(M); let ks = 0; const k = [];
  for (let d = -r; d <= r; d++) { const v = Math.exp(-(d * d) / (2 * sigma * sigma)); k.push(v); ks += v; }
  for (let i = 0; i < M; i++) { let v = 0; for (let d = -r; d <= r; d++) v += I[(((i + d) % M) + M) % M] * k[d + r]; out[i] = v / ks; }
  return out;
}
const at = (I, xPitch) => { const u = (((xPitch + 0.5) % 1) + 1) % 1 * M, i = Math.floor(u), f = u - i; return I[i % M] * (1 - f) + I[(i + 1) % M] * f; };

/** Full analysis of a setting. Returns image, blurred image, CD, NILS, contrast, etc. */
export function analyse(o) {
  const t = TOOLS[o.tool], p = o.pitch;
  const I = aerialImage(o), Ib = blur1(I, (o.blur / p) * M);
  const thr = t.Eth / o.dose;
  let mx = -1, mn = 9; for (let i = 0; i < M; i++) { if (Ib[i] > mx) mx = Ib[i]; if (Ib[i] < mn) mn = Ib[i]; }
  const contrast = (mx - mn) / (mx + mn);
  // cleared (space) width: where the blurred image exceeds the threshold
  let cleared = 0; for (let i = 0; i < M; i++) if (Ib[i] >= thr) cleared++;
  const space = (cleared / M) * p, line = p - space;
  // normalised image log-slope at the nominal edge (x = p/4)
  const e = 0.25, dx = 1 / M, slope = (at(Ib, e - dx) - at(Ib, e + dx)) / (2 * dx * p); // per nm, falling edge
  const nils = (slope / Math.max(1e-6, at(Ib, e))) * (p / 2);
  const Eph = (1239.84 / t.lam) * 1.602176634e-19; // J
  const photons = (o.dose * 1e-17) / Eph; // incident photons per nm²
  const k1 = ((p / 2) * t.NA) / t.lam;
  const pMin = t.lam / (t.NA * (1 + sigmaMax(o.illum)));
  return { I, Ib, thr, contrast, space, line, nils, photons, absorbed: photons * t.absorb, k1, pMin, dof: t.lam / (t.NA * t.NA), tool: t };
}

// ---------------------------------------------------------------- stochastic top-down print
const NX = 200, NY = 120, NP = 5; // cells, pitches across the field
let seed = 987654321;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) + 0.5) / 4294967296; };
function poisson(l) {
  if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * Math.sqrt(-2 * Math.log(rnd())) * Math.cos(6.283185 * rnd())));
  const L = Math.exp(-l); let k = 0, q = 1; do { k++; q *= rnd(); } while (q > L); return k - 1;
}
/** Simulate one exposure. Returns { clear: Uint8Array(NX*NY), ler3 [nm] | null, failRows (0..1), a [nm/cell] }. */
export function printPattern(o, an) {
  const p = o.pitch, a = (p * NP) / NX, mean = an.absorbed * a * a;
  const cnt = new Float32Array(NX * NY), tmp = new Float32Array(NX * NY);
  const col = new Float64Array(NX);
  for (let i = 0; i < NX; i++) col[i] = Math.max(0, at(an.I, ((i + 0.5) / NX) * NP - 0.5 * (NP % 2 ? 1 : 0))) * mean;
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) cnt[j * NX + i] = poisson(col[i]);
  // resist blur (acid diffusion): separable Gaussian, periodic in x, clamped in y
  const s = Math.max(0.3, o.blur / a), r = Math.min(90, Math.ceil(s * 3)), k = new Float32Array(2 * r + 1); let ks = 0;
  for (let d = -r; d <= r; d++) { k[d + r] = Math.exp(-(d * d) / (2 * s * s)); ks += k[d + r]; }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { let v = 0; for (let d = -r; d <= r; d++) v += cnt[j * NX + ((((i + d) % NX) + NX) % NX)] * k[d + r]; tmp[j * NX + i] = v / ks; }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { let v = 0; for (let d = -r; d <= r; d++) { const y = j + d; v += tmp[(y < 0 ? 0 : y >= NY ? NY - 1 : y) * NX + i] * k[d + r]; } cnt[j * NX + i] = v / ks; }
  const thr = an.thr * mean, clear = new Uint8Array(NX * NY);
  for (let q = 0; q < NX * NY; q++) clear[q] = cnt[q] >= thr ? 1 : 0;
  // ideal (noise-free) row for reference
  const ideal = new Uint8Array(NX); let idealTr = 0;
  for (let i = 0; i < NX; i++) ideal[i] = at(an.Ib, ((i + 0.5) / NX) * NP - 0.5 * (NP % 2 ? 1 : 0)) >= an.thr ? 1 : 0;
  for (let i = 0; i < NX; i++) if (ideal[i] !== ideal[(i + 1) % NX]) idealTr++;
  let fail = 0; const edges = [];
  // reference edge: first clear -> resist transition right of centre
  let ref = -1; for (let i = Math.floor(NX / 2); i < NX - 1; i++) if (ideal[i] === 1 && ideal[i + 1] === 0) { ref = i; break; }
  const win = Math.round(NX / NP / 4);
  for (let j = 0; j < NY; j++) {
    let tr = 0; for (let i = 0; i < NX; i++) if (clear[j * NX + i] !== clear[j * NX + ((i + 1) % NX)]) tr++;
    if (tr !== idealTr) fail++;
    if (ref >= 0) { let best = null; for (let i = ref - win; i <= ref + win; i++) { if (i < 0 || i >= NX - 1) continue; if (clear[j * NX + i] === 1 && clear[j * NX + i + 1] === 0 && (best === null || Math.abs(i - ref) < Math.abs(best - ref))) best = i; } if (best !== null) edges.push(best); }
  }
  let ler3 = null;
  if (edges.length > NY * 0.6) { const m = edges.reduce((x, y) => x + y, 0) / edges.length; ler3 = 3 * a * Math.sqrt(edges.reduce((x, y) => x + (y - m) * (y - m), 0) / edges.length); }
  return { clear, ler3, failRows: idealTr ? fail / NY : 0, a, idealTr };
}

function duvSteps(p) {
  if (p >= 76) return ['single exposure', 1];
  if (p >= 38) return ['SADP or LELE (2 masks + cuts)', 2];
  if (p >= 19) return ['SAQP (spacer ×4) + cut masks', 4];
  return ['SAOP (spacer ×8): not practical', 8];
}

// ---------------------------------------------------------------- cross-section scrubber data
const COL = { si: '#6b7684', sige: '#2fb7a6', ox: '#4f7896', poly: '#b39b6a', sin: '#e6d27a', epi: '#ff6b9d', gate: '#aab3bd', hk: '#ffc730', w: '#d0d0dc', cu: '#d9823a', lowk: '#39424c', carrier: '#4a5058', bsd: '#34506a', hm: '#8d6fb3' };
const LEGEND = [['si', 'Silicon'], ['sige', 'SiGe (sacrificial)'], ['ox', 'Oxide'], ['poly', 'Dummy poly'], ['sin', 'Spacer / nitride'], ['epi', 'Source/drain epi'], ['hk', 'High-k'], ['gate', 'Gate metal'], ['w', 'Contact metal'], ['cu', 'Copper'], ['carrier', 'Carrier wafer']];
export const STEPS = [
  ['Bare silicon', 'A polished 300 mm (100) wafer, 775 µm thick. Only its top few hundred nanometres will ever hold transistors.'],
  ['Si / SiGe stack epitaxy', 'Alternating layers of silicon–germanium and silicon are grown as one continuous crystal. The silicon layers become the channels; the SiGe is a placeholder to be removed later.'],
  ['Fin patterning', 'EUV lithography and plasma etching cut the stack into fins and continue into the substrate. Sheet width is set here, by the mask, not by a fixed fin height.'],
  ['Shallow trench isolation', 'Oxide fills the trenches, is polished flat and etched back until the whole stack stands clear. It isolates neighbouring devices electrically.'],
  ['Dummy gate', 'A sacrificial polysilicon gate with a hard mask is patterned across the fins. It defines the gate length and holds the place of the real gate through the hot steps to come.'],
  ['Spacers, recess, inner spacers', 'Nitride spacers form on the gate sidewalls and the exposed stack is etched away. The SiGe ends are then recessed sideways and plugged with dielectric: the inner spacers.'],
  ['Source / drain epitaxy', 'Heavily doped crystals grow from the exposed sheet ends and merge: SiGe:B for p-type, Si:P for n-type. They feed carriers into every sheet and strain the channel.'],
  ['Gate removal', 'Oxide is deposited and polished down to the gate top, then the polysilicon is etched out. An open trench is left between the spacers with the stack exposed inside.'],
  ['Channel release', 'A highly selective etch dissolves the SiGe layers through the open trench. The silicon sheets are left suspended between source and drain, anchored by the inner spacers.'],
  ['High-k / metal gate', 'Atomic layer deposition wraps every sheet, on all four sides, with an interfacial oxide, hafnium oxide and work-function metals, then fills the trench with a low-resistance metal.'],
  ['Contacts', 'The gate is capped, and trenches are etched down to the source/drain, lined with silicide and filled with metal. Contact resistance is now a large part of the total.'],
  ['Wiring', 'Copper (or ruthenium at the tightest pitches) lines in low-k dielectric are built layer by layer with the damascene process: etch the trench, fill, polish. Leading-edge chips have 15 or more levels.'],
  ['Carrier bonding', 'A blank carrier wafer is bonded oxide-to-oxide onto the finished front side. From here the wafer is processed upside down; the drawing keeps the original orientation.'],
  ['Wafer thinning', 'Grinding, polishing and a selective etch remove the original 775 µm substrate down to the bottom of the transistors, stopping on a buried etch-stop layer.'],
  ['Backside power', 'Contacts are etched from the back directly into the source/drain and connected to thick power rails. Power arrives from below; the front-side wiring is left for signals.'],
];

/** Draw both cuts for build step s (0..14) on a 1200×520 canvas. */
export function drawCrossSection(canvas, s) {
  const ctx = canvas.getContext('2d'), Wc = canvas.width, Hc = canvas.height;
  ctx.fillStyle = '#151413'; ctx.fillRect(0, 0, Wc, Hc);
  const pw = Wc / 2 - 36, ph = Hc - 64, sx = pw / 100, sy = ph / 132;
  const panel = (ox, title, fn) => {
    const oy = 44;
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, pw, ph); ctx.clip();
    ctx.fillStyle = '#0d0d0d'; ctx.fillRect(ox, oy, pw, ph);
    const R = (x0, x1, y0, y1, c) => { ctx.fillStyle = COL[c] || c; ctx.fillRect(ox + x0 * sx, oy + ph - (y1 + 30) * sy, (x1 - x0) * sx + 0.5, (y1 - y0) * sy + 0.5); };
    fn(R); ctx.restore();
    ctx.strokeStyle = '#45423f'; ctx.strokeRect(ox + 0.5, oy + 0.5, pw, ph);
    ctx.fillStyle = '#a09a93'; ctx.font = '500 17px "JetBrains Mono", monospace'; ctx.textBaseline = 'alphabetic'; ctx.fillText(title, ox, 30);
  };
  const LY = [0, 4, 8, 12, 16, 20, 24]; // stack layer boundaries; even index starts SiGe
  const common = (R) => { // layers shared by both cuts
    if (s >= 12) { R(0, 100, 81, 83, 'ox'); R(0, 100, 83, 102, 'carrier'); }
    if (s < 13) R(0, 100, -30, -10, 'si');
    if (s >= 14) { R(0, 100, -28, -10, 'bsd'); }
  };
  const wiring = (R, along) => {
    if (s >= 10) R(0, 100, 48, 56, 'lowk');
    if (s < 11) return;
    R(0, 100, 56, 81, 'lowk');
    if (along) { R(0, 100, 57, 62, 'cu'); for (let x = 6; x < 100; x += 16) R(x, x + 7, 65, 71, 'cu'); R(0, 100, 74, 80, 'cu'); R(48, 52, 62, 65, 'cu'); R(24, 28, 71, 74, 'cu'); }
    else { for (let x = 4; x < 100; x += 12) R(x, x + 6, 57, 62, 'cu'); R(0, 100, 65, 71, 'cu'); for (let x = 8; x < 100; x += 24) R(x, x + 12, 74, 80, 'cu'); R(28, 32, 62, 65, 'cu'); R(68, 72, 62, 65, 'cu'); }
  };

  // ---- cut A: across the gate, through the sheets (two fins)
  panel(24, 'ACROSS THE GATE', (R) => {
    common(R);
    const fins = [[22, 38], [62, 78]];
    if (s < 2) { R(0, 100, -10, 0, 'si'); if (s === 1) for (let l = 0; l < 6; l++) R(0, 100, LY[l], LY[l + 1], l % 2 ? 'si' : 'sige'); }
    else {
      for (const [a, b] of fins) R(a, b, -10, 0, 'si');
      if (s >= 3) { R(0, 22, -10, -1, 'ox'); R(38, 62, -10, -1, 'ox'); R(78, 100, -10, -1, 'ox'); }
      if (s >= 4 && s < 7) { R(0, 100, -1, 44, 'poly'); R(0, 100, 44, 48, 'hm'); }
      if (s >= 9) { R(0, 100, -1, 44, 'gate'); }
      for (const [a, b] of fins) for (let l = 0; l < 6; l++) {
        const sige = l % 2 === 0;
        if (sige && s >= 8) continue;
        if (!sige && s >= 9) R(a - 1.2, b + 1.2, LY[l] - 1.1, LY[l + 1] + 1.1, 'hk');
        R(a, b, LY[l], LY[l + 1], sige ? 'sige' : 'si');
      }
      if (s >= 9) for (const [a, b] of fins) R(a - 1.2, b + 1.2, -1.6, 0, 'hk');
      if (s >= 10) R(0, 100, 44, 48, 'sin');
      if (s >= 10) R(46, 54, 44, 56, 'w'); // gate contact
    }
    wiring(R, false);
    if (s >= 14) for (const [a, b] of fins) R(a - 4, b + 4, -26, -14, 'cu');
  });

  // ---- cut B: along the fin, source – channel – drain (two gates)
  panel(Wc / 2 + 12, 'ALONG THE FIN', (R) => {
    common(R);
    R(0, 100, -10, 0, 'si');
    const gates = [[24, 36], [64, 76]], sd = [[0, 20], [40, 60], [80, 100]];
    if (s >= 1 && s < 5) for (let l = 0; l < 6; l++) R(0, 100, LY[l], LY[l + 1], l % 2 ? 'si' : 'sige');
    if (s >= 5) for (const [a, b] of gates) for (let l = 0; l < 6; l++) {
      const sige = l % 2 === 0;
      if (!sige) { R(a - 4, b + 4, LY[l], LY[l + 1], 'si'); continue; }
      R(a - 4, a, LY[l], LY[l + 1], 'sin'); R(b, b + 4, LY[l], LY[l + 1], 'sin'); // inner spacers
      if (s < 8) R(a, b, LY[l], LY[l + 1], 'sige');
      else if (s >= 9) { R(a, b, LY[l], LY[l + 1], 'gate'); R(a, b, LY[l], LY[l] + 0.9, 'hk'); R(a, b, LY[l + 1] - 0.9, LY[l + 1], 'hk'); }
    }
    if (s >= 6) for (const [a, b] of sd) R(a, b, -3, 27, 'epi');
    if (s >= 7) for (const [a, b] of sd) R(a, b, 27, 48, 'ox');
    for (const [a, b] of gates) {
      if (s >= 4 && s < 7) { R(a, b, 24, 44, 'poly'); R(a, b, 44, 48, 'hm'); }
      if (s >= 5) { R(a - 4, a, 24, 48, 'sin'); R(b, b + 4, 24, 48, 'sin'); }
      if (s >= 9) { R(a, b, 24, 44, 'gate'); R(a, a + 1, 24, 44, 'hk'); R(b - 1, b, 24, 44, 'hk'); R(a, b, 24, 25, 'hk'); }
      if (s >= 10) R(a, b, 44, 48, 'sin');
    }
    if (s >= 10) for (const [a, b] of [[5, 15], [45, 55], [85, 95]]) R(a, b, 26, 56, 'w');
    wiring(R, true);
    if (s >= 14) { R(46, 54, -14, -3, 'w'); R(0, 100, -26, -14, 'cu'); }
  });
}

// ---------------------------------------------------------------- node comparison (approximate public figures)
export const NODES = [
  { node: '28 nm', year: '2011', type: 'Planar, high-k / metal gate', cpp: '113–117', mmp: '90', dens: [10, 15], euv: '0' },
  { node: '16 / 14 nm', year: '2014–15', type: 'FinFET', cpp: '70–90', mmp: '52–64', dens: [29, 38], euv: '0' },
  { node: '7 nm', year: '2018–19', type: 'FinFET', cpp: '54–57', mmp: '36–40', dens: [91, 101], euv: '0–8' },
  { node: '5 nm', year: '2020', type: 'FinFET', cpp: '48–51', mmp: '28–30', dens: [127, 171], euv: '10–14' },
  { node: '3 nm', year: '2022–23', type: 'FinFET (one foundry: nanosheet)', cpp: '45–48', mmp: '21–24', dens: [150, 215], euv: '≈ 20–25' },
  { node: '2 nm-class', year: '2025', type: 'Nanosheet GAA, backside power arriving', cpp: '≈ 42–48', mmp: '≈ 16–22', dens: [195, 240], euv: '≈ 20–30' },
];
function drawDensity(canvas) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w) return;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
  const m = { l: 40, r: 10, t: 14, b: 40 }, pw = w - m.l - m.r, ph = h - m.t - m.b, max = 260;
  c.font = '10px "JetBrains Mono", monospace'; c.strokeStyle = '#45423f'; c.fillStyle = '#a09a93'; c.textAlign = 'right'; c.textBaseline = 'middle';
  for (let v = 0; v <= max; v += 50) { const y = m.t + ph - (v / max) * ph; c.beginPath(); c.moveTo(m.l, y + 0.5); c.lineTo(m.l + pw, y + 0.5); c.stroke(); c.fillText(String(v), m.l - 6, y); }
  const bw = pw / NODES.length;
  NODES.forEach((n, i) => {
    const x = m.l + i * bw + bw * 0.2, y0 = m.t + ph - (n.dens[0] / max) * ph, y1 = m.t + ph - (n.dens[1] / max) * ph, last = i === NODES.length - 1;
    c.fillStyle = last ? '#8fe9ff' : '#77716a'; c.globalAlpha = 0.45; c.fillRect(x, y0, bw * 0.6, m.t + ph - y0); c.globalAlpha = 1;
    c.fillRect(x, y1, bw * 0.6, Math.max(2, y0 - y1)); // band = spread between sources
    c.fillStyle = '#a09a93'; c.textAlign = 'center'; c.textBaseline = 'top';
    const words = n.node.split(' '); c.fillText(words.slice(0, words.length > 2 ? 3 : 1).join(' ').replace(' /', '/'), x + bw * 0.3, m.t + ph + 7);
    if (words.length === 2) c.fillText(words[1], x + bw * 0.3, m.t + ph + 20);
  });
  c.save(); c.translate(10, m.t + ph / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#a09a93'; c.fillText('MTr / mm²', 0, 0); c.restore();
}

// ---------------------------------------------------------------- UI
const DEFAULT = { tool: 'euv', illum: 'dipole', pitch: 28, dose: 60, blur: 3, focus: 0 };
/** Dose at which the blurred image crosses the resist threshold at the nominal edge (1:1 lines and spaces). */
export function doseToSize(st) { const an = analyse(st); return Math.min(120, Math.max(5, an.tool.Eth / Math.max(0.02, at(an.Ib, 0.25)))); }

export class FabLab {
  constructor(root) {
    this.st = { ...DEFAULT }; this.st.dose = doseToSize(this.st); this.dirty = true; this.active = false; this.last = 0; this.step = 9; this.playing = false; this.lastStep = 0;
    if (!document.getElementById('fab-lab-css')) document.head.insertAdjacentHTML('beforeend', '<style id="fab-lab-css">@media (max-width:819px){.fab-two{grid-template-columns:1fr}#vsem .vs-readouts .ro{display:grid}}</style>');
    root.innerHTML = `
      <div class="vs-screen">
        <div class="vs-two fab-two">
          <figure><canvas class="l-aer" width="560" height="380" aria-label="Aerial image"></canvas><figcaption>Aerial image across two pitches</figcaption></figure>
          <figure><canvas class="l-top" width="560" height="380" aria-label="Printed resist pattern, top-down"></canvas><figcaption class="l-topcap">Printed resist, top-down</figcaption></figure>
        </div>
        <div class="vs-status"></div>
      </div>
      <div class="vs-controls"></div>
      <div class="vs-wide">
        <h3>Replay the build</h3>
        <p>The same fifteen steps as the journey, as two schematic cuts through one transistor pair. Drag the slider or press play.</p>
        <div class="xs-row">
          <canvas class="xs-canvas" width="1200" height="520" aria-label="Device cross-sections"></canvas>
          <div>
            <div class="vs-row"><label class="lbl" for="xs-step">Build step</label><output class="xs-out"></output></div>
            <input id="xs-step" type="range" min="0" max="14" step="1" value="9">
            <div class="vs-actions" style="margin:10px 0 18px"><button type="button" class="btn xs-play">Play</button><button type="button" class="btn xs-prev">◂ Back</button><button type="button" class="btn xs-next">Next ▸</button></div>
            <p class="xs-step"></p><p class="xs-desc"></p>
            <div class="xs-legend">${LEGEND.map(([k, n]) => `<span><i style="background:${COL[k]}"></i>${n}</span>`).join('')}</div>
          </div>
        </div>
      </div>
      <div class="vs-wide">
        <h3>Six generations, side by side</h3>
        <p>Node names stopped being dimensions long ago; pitches and density are what changed. Figures are approximate, compiled from public disclosures and analyst teardown estimates, and differ between foundries: ranges show the spread, and the 2 nm-class row is the least certain.</p>
        <div class="xs-row">
          <div class="tbl" style="margin-top:0"><table style="min-width:640px">
            <thead><tr><th>Node</th><th>Year</th><th style="text-align:left;padding-left:14px">Transistor</th><th style="color:var(--dim)">Gate pitch [nm]</th><th>Metal pitch [nm]</th><th>Density [MTr/mm²]</th><th>EUV layers</th></tr></thead>
            <tbody>${NODES.map((n, i) => `<tr><th style="${i === NODES.length - 1 ? 'color:var(--accent)' : ''}">${n.node}</th><td>${n.year}</td><td style="text-align:left;padding-left:14px;white-space:normal;font-family:var(--sans);font-size:13.5px">${n.type}</td><td style="color:inherit">${n.cpp}</td><td>${n.mmp}</td><td>${n.dens[0]}–${n.dens[1]}</td><td>${n.euv}</td></tr>`).join('')}</tbody>
          </table></div>
          <figure style="margin:0;min-width:0"><canvas class="n-chart" style="width:100%;height:230px;display:block"></canvas><figcaption class="vs-cap">Logic transistor density; band = spread between sources</figcaption></figure>
        </div>
      </div>`;
    // keep the sticky screen inside the lithography row so it cannot slide over the blocks below
    { const main = document.createElement('div'); main.className = 'vs-main'; root.prepend(main); main.append(root.querySelector('.vs-screen'), root.querySelector('.vs-controls')); }
    const q = (s) => root.querySelector(s);
    this.cAer = q('.l-aer'); this.cTop = q('.l-top'); this.topCap = q('.l-topcap'); this.status = q('.vs-status');
    this.xs = q('.xs-canvas'); this.xsIn = q('#xs-step'); this.xsOut = q('.xs-out'); this.xsTitle = q('.xs-step'); this.xsDesc = q('.xs-desc'); this.playBtn = q('.xs-play'); this.chart = q('.n-chart');
    const st = this.st;
    this.panel = buildPanel(q('.vs-controls'), {
      segs: [
        { key: 'tool', label: 'Exposure tool', opts: Object.entries(TOOLS).map(([k, t]) => [k, t.name]), desc: (v) => `λ = ${TOOLS[v].lam} nm, NA = ${TOOLS[v].NA}${v === 'arf' ? ' (water immersion)' : v === 'hna' ? ' (anamorphic optics)' : ' (all-reflective optics in vacuum)'}` },
        { key: 'illum', label: 'Illumination', opts: [['dipole', 'Dipole, matched to pitch'], ['conv', 'Conventional σ = 0.8']] },
      ],
      sliders: [
        { key: 'pitch', label: 'Line/space pitch', min: 12, max: 200, log: true, fmt: (v) => `${v < 40 ? v.toFixed(1) : v.toFixed(0)} nm` },
        { key: 'dose', label: 'Dose', min: 5, max: 120, fmt: (v) => `${v.toFixed(0)} mJ/cm²` },
        { key: 'blur', label: 'Resist blur', min: 1, max: 8, fmt: (v) => `${v.toFixed(1)} nm` },
        { key: 'focus', label: 'Focus offset', min: -150, max: 150, fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)} nm` },
      ],
      actions: [['metal', 'Metal pitch, 2 nm-class'], ['fin', 'Sheet pitch'], ['relaxed', 'Relaxed 80 nm, ArF'], ['size', 'Dose to size'], ['reset', 'Reset']],
    }, st, () => { this.dirty = true; }, (a) => {
      if (a === 'metal') Object.assign(st, { tool: 'euv', illum: 'dipole', pitch: 22, blur: 2.5, focus: 0 });
      if (a === 'fin') Object.assign(st, { tool: 'euv', illum: 'dipole', pitch: 30, blur: 3, focus: 0 });
      if (a === 'relaxed') Object.assign(st, { tool: 'arf', illum: 'dipole', pitch: 80, blur: 5, focus: 0 });
      if (a === 'reset') Object.assign(st, DEFAULT);
      st.dose = doseToSize(st); // every preset lands on the dose that prints 1:1 lines and spaces
    });
    const setStep = (v) => { this.step = Math.max(0, Math.min(14, v)); this.xsIn.value = this.step; this._xs(); };
    this.xsIn.addEventListener('input', () => { this.playing = false; this.playBtn.textContent = 'Play'; setStep(+this.xsIn.value); });
    q('.xs-prev').addEventListener('click', () => setStep(this.step - 1));
    q('.xs-next').addEventListener('click', () => setStep(this.step + 1));
    this.playBtn.addEventListener('click', () => { this.playing = !this.playing; this.playBtn.textContent = this.playing ? 'Pause' : 'Play'; if (this.playing && this.step >= 14) setStep(0); });
    this._setStep = setStep;
    this._xs();
    new IntersectionObserver((e) => { this.active = e[0].isIntersecting; if (this.active) drawDensity(this.chart); }, { rootMargin: '200px' }).observe(root);
    addEventListener('resize', () => { this.dirty = true; drawDensity(this.chart); });
    document.fonts?.ready.then(() => { this._xs(); drawDensity(this.chart); this.dirty = true; });
  }
  _xs() {
    drawCrossSection(this.xs, this.step);
    this.xsOut.textContent = `${this.step} / 14`;
    this.xsTitle.textContent = `${String(this.step).padStart(2, '0')}  ${STEPS[this.step][0]}`;
    this.xsDesc.textContent = STEPS[this.step][1];
  }
  _compute() {
    const st = this.st, an = (this.an = analyse(st)), t = an.tool, p = st.pitch;
    this.dirty = false;
    drawFnPlot(this.cAer, {
      xl: 'position [nm]', yl: 'intensity (clear field = 1)', x: [-p, p], y: [0, 1.4], n: 300,
      series: [{ f: (x) => at(an.I, x / p), c: 'dim', dash: [3, 3], name: 'optical', lx: -p * 0.52 }, { f: (x) => at(an.Ib, x / p), c: '#8fe9ff', w: 2, name: 'in resist', lx: p * 0.48 }],
      hl: [{ y: Math.min(1.39, an.thr), name: an.thr > 1.39 ? 'threshold above scale' : 'resist threshold' }],
    }, 0, {});
    this._print();
    const pr = this.pr, duv = duvSteps(p);
    const prints = an.space > 0.02 * p && an.line > 0.02 * p;
    this.panel.readouts([
      ['k₁ = half-pitch · NA / λ', an.k1.toFixed(3), ''],
      ['Half-pitch', (p / 2).toFixed(1), 'nm'],
      ['Cut-off pitch, this setup', an.pMin.toFixed(1), 'nm'],
      ['Image contrast', an.contrast.toFixed(2), ''],
      ['NILS at the edge', an.nils.toFixed(2), ''],
      ['Depth of focus λ/NA²', an.dof.toFixed(0), 'nm'],
      ['Printed line CD', prints ? an.line.toFixed(1) : '–', prints ? 'nm' : ''],
      ['LER 3σ (this exposure)', pr.ler3 != null ? pr.ler3.toFixed(1) : '–', pr.ler3 != null ? 'nm' : ''],
      ['Photons: incident · absorbed', `${an.photons.toFixed(0)} · ${an.absorbed.toFixed(0)}`, '/nm²'],
      ['Same pitch with ArF immersion', duv[0], ''],
    ]);
    const notes = [];
    if (p < an.pMin) notes.push(['warn', `Below cut-off: at ${p.toFixed(1)} nm pitch the ±1 diffraction orders miss the lens (limit ${an.pMin.toFixed(1)} nm here). Only the undiffracted beam arrives, so the image is flat grey and nothing can print at any dose.`]);
    else if (an.contrast < 0.25) notes.push(['warn', 'Image contrast is too low for a usable process: a small dose or focus error moves the edge a long way. Use dipole illumination, a larger pitch or a higher NA.']);
    if (p >= an.pMin && !prints) notes.push(['warn', an.space <= 0.02 * p ? 'Under-exposed: the image never reaches the resist threshold, so no resist clears. Raise the dose.' : 'Over-exposed: the whole field is above threshold and the lines are washed away. Lower the dose.']);
    if (prints && pr.failRows > 0.02) notes.push(['warn', `Stochastic failures: ${(pr.failRows * 100).toFixed(0)} % of rows show a bridge or a broken line. With ${an.absorbed.toFixed(0)} absorbed photons per nm², random clustering beats the image contrast. More dose, less blur or a better image fixes it.`]);
    if (prints && pr.failRows <= 0.02 && pr.ler3 != null && pr.ler3 > 0.15 * an.line) notes.push(['info', `Lines print, but edge roughness is ${(100 * pr.ler3 / an.line).toFixed(0)} % of the line width. Roughness is photon shot noise divided by image slope: raise dose or NILS.`]);
    if (Math.abs(st.focus) > an.dof / 2) notes.push(['info', `Focus offset exceeds half the depth of focus (${an.dof.toFixed(0)} nm): contrast is being thrown away.`]);
    if (st.tool === 'arf' && duv[1] > 1 && p >= 19) notes.push(['info', `ArF immersion cannot print this pitch in one exposure. In production it is reached with ${duv[0]}: more masks, more steps, tighter overlay.`]);
    if (st.tool !== 'arf' && p < t.single && p >= an.pMin) notes.push(['info', `Above the optical cut-off but below ~${t.single} nm, the practical single-exposure limit of this tool once stochastics and mask effects are counted.`]);
    if (st.tool === 'hna') notes.push(['info', 'High-NA optics demagnify 8× in one direction and 4× in the other, halving the exposure field; depth of focus shrinks with NA².']);
    if (!notes.length) notes.push(['ok', `Good window: NILS ${an.nils.toFixed(1)}, clean lines, ${an.line.toFixed(1)} nm CD. Now lower the dose or shrink the pitch until it fails.`]);
    this.status.innerHTML = statusHTML(notes);
    this.topCap.textContent = `Printed resist, top-down · field ${(p * NP).toFixed(0)} × ${(pr.a * NY).toFixed(0)} nm`;
  }
  _print() {
    const pr = (this.pr = printPattern(this.st, this.an));
    const img = this._img || (this._img = new ImageData(NX, NY)), d = img.data;
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const k = j * NX + i, r = !pr.clear[k];
      // resist bright with brighter edges (as a CD-SEM would show it), cleared substrate dark
      const edge = r && (pr.clear[j * NX + ((i + 1) % NX)] || pr.clear[j * NX + ((i + NX - 1) % NX)] || (j > 0 && pr.clear[k - NX]) || (j < NY - 1 && pr.clear[k + NX]));
      const v = r ? (edge ? 232 : 150) : 30;
      d[k * 4] = v * 0.92; d[k * 4 + 1] = v * 0.97; d[k * 4 + 2] = v; d[k * 4 + 3] = 255;
    }
    const tmp = this._tmp || (this._tmp = Object.assign(document.createElement('canvas'), { width: NX, height: NY }));
    tmp.getContext('2d').putImageData(img, 0, 0);
    const c = this.cTop.getContext('2d'); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(tmp, 0, 0, this.cTop.width, this.cTop.height);
    // scale bar: one pitch
    const pxPitch = this.cTop.width / NP;
    c.font = '500 15px "JetBrains Mono", monospace'; c.textBaseline = 'bottom';
    c.fillStyle = 'rgba(13,13,13,.82)'; c.fillRect(8, this.cTop.height - 48, Math.max(pxPitch, 150) + 12, 40);
    c.fillStyle = '#ffc730'; c.fillRect(14, this.cTop.height - 18, pxPitch, 3);
    c.fillText(`pitch ${this.st.pitch < 40 ? this.st.pitch.toFixed(1) : this.st.pitch.toFixed(0)} nm`, 14, this.cTop.height - 22);
  }
  tick(now) {
    if (!this.active) return;
    if (this.dirty) { this._compute(); this.last = now; }
    else if (now - this.last > 500 && this.an) { this.last = now; this._print(); } // fresh photon statistics, like repeated exposures
    if (this.playing && now - this.lastStep > 1300) { this.lastStep = now; if (this.step >= 14) { this.playing = false; this.playBtn.textContent = 'Play'; } else this._setStep(this.step + 1); }
  }
}
