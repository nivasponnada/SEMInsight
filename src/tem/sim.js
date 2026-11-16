// TEM image simulation in the phase-object approximation.
//   exit wave  ψ(r) = exp[iσV_t(r)] · exp[−μ(r)]        (projected potential, weak absorption)
//   image wave Ψ(q) = FT[ψ] · A(q) · E_t(q) · E_s(q) · exp[−iχ(q)]
//   χ(q) = πλΔf q² + ½πC_sλ³q⁴   (Δf < 0 is underfocus)
// Lengths in nm, spatial frequency q in nm⁻¹.
import { wavelength, K } from '../physics.js';

export const N = 256;

// ---------------------------------------------------------------- FFT (radix-2, in place)
const rev = new Uint16Array(N);
for (let i = 0, bits = Math.log2(N); i < N; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
const cosT = new Float64Array(N / 2), sinT = new Float64Array(N / 2);
for (let i = 0; i < N / 2; i++) { cosT[i] = Math.cos((2 * Math.PI * i) / N); sinT[i] = Math.sin((2 * Math.PI * i) / N); }
function fft1(re, im, off, stride, inverse) {
  for (let i = 0; i < N; i++) { const j = rev[i]; if (j > i) { const a = off + i * stride, b = off + j * stride; let t = re[a]; re[a] = re[b]; re[b] = t; t = im[a]; im[a] = im[b]; im[b] = t; } }
  for (let size = 2; size <= N; size <<= 1) {
    const half = size >> 1, step = N / size;
    for (let s = 0; s < N; s += size) for (let k = 0; k < half; k++) {
      const wr = cosT[k * step], wi = inverse ? sinT[k * step] : -sinT[k * step];
      const a = off + (s + k) * stride, b = off + (s + k + half) * stride;
      const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
      re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
    }
  }
}
export function fft2(re, im, inverse = false) {
  for (let j = 0; j < N; j++) fft1(re, im, j * N, 1, inverse);
  for (let i = 0; i < N; i++) fft1(re, im, i, N, inverse);
  if (inverse) { const s = 1 / (N * N); for (let k = 0; k < N * N; k++) { re[k] *= s; im[k] *= s; } }
}

// ---------------------------------------------------------------- optics
/** Interaction constant σ [rad V⁻¹ nm⁻¹]. */
export function sigmaInt(V) {
  const lam = wavelength(V), g = 1 + (K.e * V) / (K.m * K.c * K.c);
  return ((2 * Math.PI * g * K.m * K.e * lam) / (K.h * K.h)) * 1e-9;
}
export function optics({ kV, Cs, df, spread = 4, conv = 0.25 }) {
  const lam = wavelength(kV * 1000) * 1e9; // nm
  const CsN = Cs * 1e6; // mm -> nm
  const scherzer = -1.2 * Math.sqrt(CsN * lam);
  const dPoint = 0.66 * CsN ** 0.25 * lam ** 0.75;
  const dInfo = Math.sqrt((Math.PI * lam * spread) / 2);
  const chi = (q) => Math.PI * lam * df * q * q + 0.5 * Math.PI * CsN * lam ** 3 * q ** 4;
  const env = (q) => {
    const et = Math.exp(-0.5 * (Math.PI * lam * spread) ** 2 * q ** 4);
    const a = conv * 1e-3;
    const es = Math.exp(-(((Math.PI * a) / lam) ** 2) * (CsN * lam ** 3 * q ** 3 + df * lam * q) ** 2);
    return et * es;
  };
  return { lam, CsN, scherzer, dPoint, dInfo, chi, env, ctf: (q) => Math.sin(chi(q)) * env(q) };
}

// ---------------------------------------------------------------- specimens
function hash(i, s) { let h = (i * 374761393 + s * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; h ^= h >>> 16; return (h >>> 0) / 4294967296; }
const gaussRand = (i, s) => Math.sqrt(-2 * Math.log(hash(i, s) + 1e-9)) * Math.cos(6.2832 * hash(i, s + 77));

export const SPECIMENS = {
  au: { name: 'Au nanoparticles on carbon', desc: 'Gold particles (fcc, a = 0.408 nm) in ⟨110⟩ and random orientations on a 5 nm amorphous carbon film.', px: 0.03 },
  si: { name: 'Si ⟨110⟩ wedge', desc: 'Silicon viewed down ⟨110⟩: dumbbell columns 0.136 nm apart; thickness increases left to right.', px: 0.022 },
  carbon: { name: 'Amorphous carbon', desc: 'A featureless phase object: its power spectrum shows the transfer function directly as Thon rings.', px: 0.04 },
};

/** Splat a column of projected potential with phase `ph` [rad] at (x, y) nm. */
function splat(phase, x, y, ph, px, w = 0.042) {
  const cx = x / px, cy = y / px, r = Math.ceil((3 * w) / px), s2 = 2 * (w / px) ** 2;
  const i0 = Math.round(cx), j0 = Math.round(cy);
  for (let j = j0 - r; j <= j0 + r; j++) { if (j < 0 || j >= N) continue; for (let i = i0 - r; i <= i0 + r; i++) { if (i < 0 || i >= N) continue; phase[j * N + i] += ph * Math.exp(-((i - cx) ** 2 + (j - cy) ** 2) / s2); } }
}

/** Projected phase shift φ(r) [rad] and absorption μ(r) for a specimen at pixel size px [nm]. */
export function buildSpecimen(kind, px, kV = 200) {
  const phase = new Float32Array(N * N), abs = new Float32Array(N * N);
  const L = N * px, sc = sigmaInt(kV * 1000) / sigmaInt(200000);
  const carbon = (amp) => { // amorphous film: band-limited random phase
    for (let k = 0; k < N * N; k++) phase[k] += amp * gaussRand(k, 5);
  };
  if (kind === 'carbon') carbon(0.22 * sc);
  if (kind === 'au') {
    carbon(0.12 * sc);
    const a = 0.4078, parts = [[0.3, 0.34, 2.1, 0.3, true], [0.7, 0.62, 1.5, 1.25, true], [0.24, 0.78, 1.0, 0.0, false], [0.78, 0.2, 0.8, 2.2, true]];
    for (const [fx, fy, R, rot, onZone] of parts) {
      const cx = fx * L, cy = fy * L, c = Math.cos(rot), s = Math.sin(rot), ux = a / Math.SQRT2, uy = a;
      const nmax = Math.ceil(R / ux) + 1;
      for (let m = -nmax; m <= nmax; m++) for (let n = -nmax; n <= nmax; n++) for (const [bx, by] of [[0, 0], [0.5, 0.5]]) {
        const lx = (m + bx) * ux, ly = (n + by) * uy, d2 = lx * lx + ly * ly;
        if (d2 > R * R) continue;
        const thick = (2 * Math.sqrt(R * R - d2)) / 0.288; // atoms in the column (sphere chord)
        const x = cx + lx * c - ly * s, y = cy + lx * s + ly * c;
        // an off-zone particle shows no resolved columns, only mass-thickness
        splat(phase, x, y, (onZone ? 0.16 : 0.05) * thick * sc, px, onZone ? 0.042 : 0.11);
        splat(abs, x, y, 0.012 * thick, px, 0.1);
      }
    }
  }
  if (kind === 'si') {
    const ux = 0.5431 / Math.SQRT2, uy = 0.5431;
    for (let m = -1; m <= Math.ceil(L / ux) + 1; m++) for (let n = -1; n <= Math.ceil(L / uy) + 1; n++) for (const [bx, by] of [[0, 0], [0, 0.25], [0.5, 0.5], [0.5, 0.75]]) {
      const x = (m + bx) * ux, y = (n + by) * uy;
      const thick = 4 + 36 * Math.min(1, Math.max(0, x / L)); // atoms per column
      splat(phase, x, y, 0.035 * thick * sc, px, 0.036);
    }
    for (let k = 0; k < N * N; k++) phase[k] += 0.05 * gaussRand(k, 9); // amorphous surface layer
  }
  return { phase, abs, px, kind, L };
}

// ---------------------------------------------------------------- image formation
const re = new Float32Array(N * N), im = new Float32Array(N * N);
const wr = new Float32Array(N * N), wi = new Float32Array(N * N);

/**
 * o: { kV, Cs [mm], df [nm], aperture [nm⁻¹, 0 = none], dark (bool: aperture on a diffracted beam), spread, conv }
 * Returns { image, dp } as Float32Array (image mean ≈ 1; dp = diffraction intensity, fft-shifted).
 */
export function simulate(spec, o) {
  const op = optics(o), { phase, abs, px } = spec;
  for (let k = 0; k < N * N; k++) { const a = Math.exp(-abs[k]); re[k] = a * Math.cos(phase[k]); im[k] = a * Math.sin(phase[k]); }
  fft2(re, im);
  const dq = 1 / (N * px);
  const dp = new Float32Array(N * N);
  const ap = o.aperture || 0;
  // dark field: aperture centred on a diffracted beam (Au 111 at 4.25 nm⁻¹ along +x)
  const ax = o.dark ? 4.25 : 0;
  for (let j = 0; j < N; j++) {
    const qy = (j < N / 2 ? j : j - N) * dq;
    for (let i = 0; i < N; i++) {
      const qx = (i < N / 2 ? i : i - N) * dq, k = j * N + i;
      const q = Math.hypot(qx, qy);
      dp[((j + N / 2) % N) * N + ((i + N / 2) % N)] = re[k] * re[k] + im[k] * im[k];
      let A = 1;
      if (ap > 0) { const d = Math.hypot(qx - ax, qy); A = d <= ap ? 1 : 0; }
      if (A === 0) { wr[k] = 0; wi[k] = 0; continue; }
      const e = op.env(q), c = op.chi(q), cc = Math.cos(c) * e, ss = -Math.sin(c) * e;
      wr[k] = re[k] * cc - im[k] * ss; wi[k] = re[k] * ss + im[k] * cc;
    }
  }
  fft2(wr, wi, true);
  const image = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) image[k] = wr[k] * wr[k] + wi[k] * wi[k];
  return { image, dp, op, dq };
}

/** Power spectrum of an image (fft-shifted), for the diffractogram. */
export function powerSpectrum(image) {
  let mean = 0; for (let k = 0; k < N * N; k++) mean += image[k]; mean /= N * N;
  for (let k = 0; k < N * N; k++) { re[k] = image[k] - mean; im[k] = 0; }
  fft2(re, im);
  const out = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) out[((j + N / 2) % N) * N + ((i + N / 2) % N)] = re[j * N + i] ** 2 + im[j * N + i] ** 2;
  return out;
}

let seed = 4321;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(6.283185 * rnd());

/** Draw an intensity map to a canvas. mode: 'image' (linear, shot noise from electrons/pixel) or 'log'. */
export function paint(canvas, data, { mode = 'image', nPix = 0, tint = [1, 1, 1], lo = null, hi = null, gamma = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  const img = paint._img || (paint._img = new ImageData(N, N));
  let a = lo, b = hi;
  if (mode === 'log') {
    let mx = 0; for (let k = 0; k < N * N; k++) if (data[k] > mx) mx = data[k];
    const l1 = Math.log10(mx + 1e-20); a = l1 - (gamma > 1 ? 3.4 : 5.2); b = l1 - 0.3;
  } else if (a == null) {
    const s = Float32Array.from(data).sort(); a = s[Math.floor(N * N * 0.002)]; b = s[Math.floor(N * N * 0.998)];
    const pad = Math.max(0.04, (b - a) * 0.08); a -= pad; b += pad;
  }
  for (let k = 0; k < N * N; k++) {
    let v = data[k];
    if (mode === 'log') v = Math.log10(v + 1e-20);
    else if (nPix > 0) { const l = v * nPix; v = (l > 30 ? l + gauss() * Math.sqrt(l) : poisson(l)) / nPix; }
    let g = (v - a) / (b - a); g = g < 0 ? 0 : g > 1 ? 1 : g;
    const o = k * 4, c = 255 * g;
    img.data[o] = c * tint[0]; img.data[o + 1] = c * tint[1]; img.data[o + 2] = c * tint[2]; img.data[o + 3] = 255;
  }
  const tmp = paint._c || (paint._c = Object.assign(document.createElement('canvas'), { width: N, height: N }));
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
}
function poisson(l) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rnd(); } while (p > L); return k - 1; }
