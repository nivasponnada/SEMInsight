// Physically-based SEM image model.
//   geometry  : procedural specimens -> height map [nm] + material map
//   signal    : SE yield (Lin–Joy curve, sec θ tilt law, detector shadowing, delocalised SE2),
//               BSE coefficient (Reuter fit, tilt), probe blur from the aberration budget,
//               defocus and astigmatism
//   compose   : Poisson shot noise from the dose, charging of insulators, digitisation
import { MATERIALS, K, probe, lensCoefficients, rangeKO, eta, delta, skirtRadius } from './physics.js';

export const W = 512, H = 442;
const MAT = ['Si', 'SiO2', 'W', 'Cu', 'C', 'Sn', 'WC', 'Co', 'Au'].map((k) => MATERIALS[k]);
const iSi = 0, iOx = 1, iW = 2, iC = 4, iSn = 5, iWC = 6, iCo = 7, iAu = 8;

export const SPECIMENS = {
  chip: { name: 'Semiconductor pattern', desc: 'SiO₂ lines on Si · W contacts in SiO₂ · particle and bridge defects', mag: 25000 },
  wcco: { name: 'WC–Co hardmetal', desc: 'Polished cemented carbide: WC grains, Co binder, pores', mag: 8000 },
  tin: { name: 'Tin on carbon', desc: 'Sn spheres on a carbon substrate: the classic resolution standard', mag: 5000 },
};

// ---------------------------------------------------------------- hashing / noise
function hash(ix, iy, s) {
  let h = (ix * 374761393 + iy * 668265263 + s * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;

// ---------------------------------------------------------------- specimens (x, y in nm)
function chip(x, y, o) {
  const band = mod(y, 6400), tileY = Math.floor(y / 6400), tileX = Math.floor(x / 6400);
  let h = 0, m = iSi, ch = 0;
  if (band < 3200) {
    // SiO2 line/space grating on Si: 400 nm pitch, 120 nm tall, line-edge roughness
    const ler = (vnoise(y / 55, Math.floor(x / 400) * 7.3, 3) - 0.5) * 16;
    const u = mod(x, 400) - 200;
    let prof = sstep(104, 86, Math.abs(u) + ler);
    // bridge defect between two lines
    if (tileX === 0 && tileY === 0) {
      const dx = x - 1400, dy = y - 1700;
      prof = Math.max(prof, sstep(115, 60, Math.hypot(dx * 0.42, dy)));
    }
    // band edges: lines end
    prof *= sstep(120, 220, band) * sstep(3080, 2980, band);
    h = 120 * prof; m = prof > 0.5 ? iOx : iSi;
  } else {
    // tungsten contacts in a planarised oxide field, 400 nm pitch, slightly recessed
    m = iOx;
    const by = band - 3200;
    const row = Math.floor(by / 400), col = Math.floor((x + (row & 1) * 200) / 400);
    const cx = (col + 0.5) * 400 - (row & 1) * 200, cy = (row + 0.5) * 400;
    const d = Math.hypot(x - cx, by - cy);
    const inField = by > 300 && by < 2900;
    const missing = hash(col, row + tileY * 16, 9) < 0.012;
    if (inField && !missing && d < 96) { m = iW; h = -12 * sstep(96, 80, d); ch = (vnoise(x / 30, y / 30, 5) - 0.5) * 0.05; }
    h += (vnoise(x / 18, y / 18, 2) - 0.5) * 1.6;
    // particle sitting on the array
    if (tileX === 0 && tileY === 0) {
      const dp = Math.hypot(x - 2100, y - 4700), R = 260;
      if (dp < R) { h = R * 0.75 + Math.sqrt(R * R - dp * dp); m = iC; }
    }
  }
  o.h = h; o.m = m; o.ch = ch;
}

function wcco(x, y, o) {
  const cell = 1000;
  // domain warp makes the grains less regular
  const wx = x + (vnoise(x / 2600, y / 2600, 11) - 0.5) * 900, wy = y + (vnoise(x / 2600, y / 2600, 12) - 0.5) * 900;
  const cx = Math.floor(wx / cell), cy = Math.floor(wy / cell);
  let f1 = 1e9, f2 = 1e9, id = 0, idx = 0, idy = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const px = (cx + i + 0.15 + 0.7 * hash(cx + i, cy + j, 1)) * cell, py = (cy + j + 0.15 + 0.7 * hash(cx + i, cy + j, 2)) * cell;
    // chebyshev-ish metric rotated per grain gives faceted, prismatic WC shapes
    const a = hash(cx + i, cy + j, 3) * 3.14159, ca = Math.cos(a), sa = Math.sin(a);
    const dx = wx - px, dy = wy - py;
    const rx = Math.abs(dx * ca + dy * sa), ry = Math.abs(-dx * sa + dy * ca);
    const d = Math.max(rx, ry * (0.75 + 0.5 * hash(cx + i, cy + j, 4))) * 0.9 + 0.25 * Math.hypot(dx, dy);
    if (d < f1) { f2 = f1; f1 = d; id = hash(cx + i, cy + j, 5); idx = cx + i; idy = cy + j; } else if (d < f2) f2 = d;
  }
  const gap = f2 - f1;
  const bw = 45 + 170 * vnoise(x / 1900, y / 1900, 6) ** 2;
  const binder = 1 - sstep(bw * 0.7, bw, gap);
  const pore = hash(idx, idy, 7) < 0.05 ? sstep(330, 200, f1) : 0;
  let h = (1 - binder) * 7 + (vnoise(x / 25, y / 25, 8) - 0.5) * 1.2;
  let m = binder > 0.5 ? iCo : iWC;
  if (pore > 0) { h -= 380 * pore; if (pore > 0.3) m = iCo; }
  // polishing scratches
  h -= 2.5 * sstep(0.93, 1, vnoise((x * 0.94 + y * 0.34) / 9000 * 40, (y * 0.94 - x * 0.34) / 90, 13));
  o.h = h; o.m = m; o.ch = m === iWC ? (id - 0.5) * 0.11 : 0;
}

const TIN_OCT = [[9000, 0.55], [3200, 0.6], [1100, 0.55], [380, 0.5], [130, 0.45]];
function tin(x, y, o) {
  let h = (vnoise(x / 60, y / 60, 21) - 0.5) * 6 + (vnoise(x / 700, y / 700, 22) - 0.5) * 30, m = iC;
  for (let k = 0; k < TIN_OCT.length; k++) {
    const [cell, prob] = TIN_OCT[k];
    const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j;
      if (hash(gx, gy, 30 + k) > prob) continue;
      const R = cell * (0.14 + 0.3 * hash(gx, gy, 40 + k) ** 1.5);
      const px = (gx + 0.5 + (hash(gx, gy, 50 + k) - 0.5) * 0.6) * cell, py = (gy + 0.5 + (hash(gx, gy, 60 + k) - 0.5) * 0.6) * cell;
      const d2 = (x - px) ** 2 + (y - py) ** 2;
      if (d2 < R * R) { const hs = R * 0.8 + Math.sqrt(R * R - d2); if (hs > h) { h = hs; m = iSn; } }
    }
  }
  o.h = h; o.m = m; o.ch = 0;
}
const FN = { chip, wcco, tin };

/** Sample the specimen on the image grid. cx, cy: field centre [nm]; px: pixel size [nm]. */
export function buildGeometry(spec, cx, cy, px) {
  const fn = FN[spec], n = W * H;
  const Hm = new Float32Array(n), Mt = new Uint8Array(n), Ch = new Float32Array(n);
  const o = { h: 0, m: 0, ch: 0 };
  const x0 = cx - (W / 2) * px, y0 = cy - (H / 2) * px;
  // 2x2 supersampling of the height when features are near the pixel size keeps edges stable
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    fn(x0 + (i + 0.5) * px, y0 + (j + 0.5) * px, o);
    const k = j * W + i; Hm[k] = o.h; Mt[k] = o.m; Ch[k] = o.ch;
  }
  return { Hm, Mt, Ch, px, spec };
}

// ---------------------------------------------------------------- optics
export const APERTURES = [20, 30, 60, 120];
export function optics(st) {
  const V = st.kV * 1000;
  const alpha = ((st.ap / 2) * 1e-6) / ((st.wd + 3) * 1e-3);
  const { Cs, Cc } = lensCoefficients(st.wd);
  const p = probe({ V, Ip: st.Ip, alpha, Cs, Cc });
  let d = p.d, skirt = 0, scat = 0;
  if (st.mode === 'lv') {
    const gpl = Math.max(1, st.wd - 1) * 1e-3;
    scat = 1 - Math.exp(-(60 / (K.kB * 293)) * gpl * 2.3e-21 * (20 / st.kV));
    skirt = skirtRadius(7, V, 60, gpl);
  }
  return { ...p, d, alpha, Cs, Cc, skirt, scat };
}

function blur(src, dst, tmp, sx, sy) {
  const pass = (a, b, sigma, horiz) => {
    if (sigma < 0.3) { b.set(a); return; }
    const s = Math.min(sigma, 22), r = Math.ceil(s * 2.6);
    const kern = new Float32Array(2 * r + 1); let sum = 0;
    for (let i = -r; i <= r; i++) { kern[i + r] = Math.exp(-(i * i) / (2 * s * s)); sum += kern[i + r]; }
    for (let i = 0; i < kern.length; i++) kern[i] /= sum;
    if (horiz) {
      for (let j = 0; j < H; j++) { const row = j * W; for (let i = 0; i < W; i++) { let v = 0; for (let k = -r; k <= r; k++) { const x = i + k; v += a[row + (x < 0 ? 0 : x >= W ? W - 1 : x)] * kern[k + r]; } b[row + i] = v; } }
    } else {
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { let v = 0; for (let k = -r; k <= r; k++) { const y = j + k; v += a[(y < 0 ? 0 : y >= H ? H - 1 : y) * W + i] * kern[k + r]; } b[j * W + i] = v; }
    }
  };
  pass(src, tmp, sx, true); pass(tmp, dst, sy, false);
}

function totalYield(E, m) { return delta(E, m) + eta(m.Z); }

/**
 * st: { kV, Ip [A], wd [mm], ap [µm], det: 'etd'|'inlens'|'bse', dwell [s], frames,
 *       focus [µm], stig [µm], mode: 'hv'|'lv'|'coat' }
 */
export function buildSignal(g, st) {
  const n = W * H, { Hm, Mt, Ch, px } = g;
  const E = st.kV, coat = st.mode === 'coat';
  const op = optics(st);
  // per-material lookups
  const dl = MAT.map((m) => delta(E, coat ? MATERIALS.Au : m));
  const et = MAT.map((m) => { const e = eta(m.Z); return coat ? e + (eta(79) - e) * Math.exp(-E / 2.5) : e; });
  const insul = MAT.map((m) => !m.cond && !coat);
  const sig = MAT.map((m, i) => (insul[i] ? totalYield(E, m) : 1));
  const S1 = new Float32Array(n), B = new Float32Array(n), Q = new Float32Array(n), tmp = new Float32Array(n), Et = new Float32Array(n);
  const det = st.det;
  // BSE diode: gain ∝ energy above a ~1.2 keV dead-layer threshold
  const bseGain = Math.max(0, 0.75 * E - 1.2) / (0.75 * 15 - 1.2);
  let matCount = new Float32Array(MAT.length);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i;
    const il = i > 0 ? k - 1 : k, ir = i < W - 1 ? k + 1 : k, ju = j > 0 ? k - W : k, jd = j < H - 1 ? k + W : k;
    const hx = (Hm[ir] - Hm[il]) / ((ir - il) * px), hy = (Hm[jd] - Hm[ju]) / (((jd - ju) / W) * px);
    const sec = Math.sqrt(1 + hx * hx + hy * hy);
    const m = Mt[k]; matCount[m]++;
    const secC = Math.min(sec, 4.5);
    let se = dl[m] * secC ** (det === 'inlens' ? 0.8 : 1);
    if (det === 'etd') se *= 0.62 + 0.38 * (0.5 - (0.5 * hy) / sec) * 1.6; // detector sits "above" the frame
    // positive charging (σ > 1) re-attracts secondaries and darkens the insulator
    if (insul[m] && sig[m] > 1 && st.mode !== 'lv') se *= 1 - 0.3 * Math.min(1, sig[m] - 1);
    S1[k] = se;
    const cosT = 1 / sec;
    B[k] = et[m] * (1 + Ch[k]) * (0.35 + 0.65 * cosT) * bseGain;
    Et[k] = et[m];
    Q[k] = insul[m] ? Math.max(0, 1 - sig[m]) : 0;
  }
  let dom = 0; for (let i = 1; i < MAT.length; i++) if (matCount[i] > matCount[dom]) dom = i;
  const rko = rangeKO(E, MAT[dom]) * 1000; // nm
  const sBse = (0.15 * rko) / px;
  // probe blur with defocus and astigmatism (µm -> nm)
  const sp = (op.d * 1e9) / 2.355 / px;
  const dfx = (op.alpha * (st.focus + st.stig / 2) * 1000) / 2 / px, dfy = (op.alpha * (st.focus - st.stig / 2) * 1000) / 2 / px;
  const sx = Math.hypot(sp, dfx), sy = Math.hypot(sp, dfy);

  let out = new Float32Array(n);
  if (det === 'bse') {
    // BSE point-spread: a sharp core of low-loss electrons leaving near the probe plus a broad tail
    const core = new Float32Array(n);
    blur(B, core, tmp, sx, sy);
    blur(B, out, tmp, Math.hypot(sx, sBse), Math.hypot(sy, sBse));
    for (let k = 0; k < n; k++) out[k] = 0.45 * core[k] + 0.55 * out[k];
  } else {
    // SE2: secondaries released by exiting BSE, delocalised over the BSE escape radius
    const S2 = new Float32Array(n);
    if (sBse > 0.5) blur(S1, S2, tmp, sBse, sBse); else S2.set(S1);
    const bsePart = det === 'etd' ? 0.35 : 0.05;
    const se2w = det === 'inlens' ? 1.2 : 3.0;
    for (let k = 0; k < n; k++) S2[k] = S1[k] + se2w * Et[k] * S2[k] + bsePart * Et[k];
    blur(S2, out, tmp, sx, sy);
  }
  // gas skirt removes current from the probe and adds a featureless background
  let mean = 0; for (let k = 0; k < n; k++) mean += out[k]; mean /= n;
  if (op.scat > 0) for (let k = 0; k < n; k++) out[k] = out[k] * (1 - op.scat) + mean * op.scat;

  // detector efficiency (geometry) and quanta per pixel
  let eff = det === 'etd' ? 0.3 * Math.min(1, st.wd / 5) ** 0.7 : det === 'inlens' ? 0.5 * Math.exp(-(st.wd - 2) / 5) : 0.22;
  const nPrimary = (st.Ip * st.dwell) / K.e * st.frames;
  // auto brightness/contrast on the noise-free signal
  const sorted = Float32Array.from(out).sort();
  let lo = sorted[Math.floor(n * 0.004)], hi = sorted[Math.floor(n * 0.996)];
  if (hi - lo < 0.04 * Math.max(hi, 1e-6)) { const mid = (hi + lo) / 2, half = Math.max(0.02 * Math.max(mid, 0.02), (hi - lo) / 2); lo = mid - half; hi = mid + half; }
  // charging strength: dose rate onto insulators without a path to ground
  let charge = (st.mode === 'lv' ? 0.02 : 1) * Math.min(3, Math.sqrt(st.Ip / 50e-12) * (st.dwell / 1e-6) ** 0.25) * (det === 'bse' ? 0.2 : det === 'inlens' ? 1.3 : 1);
  let qMean = 0; for (let k = 0; k < n; k++) qMean += Q[k]; qMean /= n;
  const snr = Math.sqrt(Math.max(1e-9, nPrimary * eff * mean)) * ((hi - lo) / Math.max(mean, 1e-9));
  return { out, Q, lo, hi, mean, quanta: nPrimary * eff, charge, qMean, op, rko, dom: MAT[dom], sx, sy, px, snr, nPrimary, sig: sig[iOx], seed: 1 };
}

// ---------------------------------------------------------------- compose rows
let _s = 12345;
const rnd = () => { _s ^= _s << 13; _s ^= _s >>> 17; _s ^= _s << 5; return (_s >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(6.283185 * rnd());
function poisson(l) {
  if (l > 40) return Math.max(0, l + gauss() * Math.sqrt(l));
  const L = Math.exp(-l); let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}

/** Write rows [j0, j1) of the noisy, charged, digitised image into an ImageData. */
export function composeRows(model, img, j0, j1) {
  const { out, Q, lo, hi, quanta, charge } = model, d = img.data, range = hi - lo;
  for (let j = j0; j < j1; j++) {
    const row = j * W;
    // row-level effects of negative charging: beam deflection (row shear) and flicker
    let rowQ = 0; for (let i = 0; i < W; i += 8) rowQ += Q[row + i]; rowQ = (rowQ / (W / 8)) * charge;
    const shift = rowQ > 0.02 ? Math.round(gauss() * rowQ * 7) : 0;
    const flick = rowQ > 0.02 ? 1 + gauss() * rowQ * 0.25 : 1;
    let acc = 0;
    for (let i = 0; i < W; i++) {
      const xs = i + shift, k = row + (xs < 0 ? 0 : xs >= W ? W - 1 : xs);
      let s = out[k] * flick;
      // charge deposited on the insulator bleeds along the fast-scan direction as a bright streak
      acc = acc * 0.972 + Q[k] * charge * 0.09;
      s *= 1 + Math.min(4, acc * 2.2);
      const lam = s * quanta;
      const v = quanta > 0 ? poisson(lam) / quanta : 0;
      let gval = (v - lo) / range;
      gval = 0.13 + 0.74 * gval;
      const b = gval <= 0 ? 0 : gval >= 1 ? 255 : (gval * 255) | 0;
      const o = (row + i) * 4;
      d[o] = d[o + 1] = d[o + 2] = b; d[o + 3] = 255;
    }
  }
}
