// Powder X-ray diffraction: reflections, structure factors, intensities and peak profiles
// for cubic materials. Lengths in ångström, angles in degrees unless noted.

export const ANODES = {
  Cu: { name: 'Cu', ka1: 1.54056, ka2: 1.54439, kb: 1.39222, edge: 8.979, filter: 'Ni', Z: 29 },
  Co: { name: 'Co', ka1: 1.78897, ka2: 1.79285, kb: 1.62079, edge: 7.709, filter: 'Fe', Z: 27 },
  Mo: { name: 'Mo', ka1: 0.7093, ka2: 0.71359, kb: 0.63229, edge: 20.0, filter: 'Zr', Z: 42 },
  Cr: { name: 'Cr', ka1: 2.2897, ka2: 2.29361, kb: 2.08487, edge: 5.989, filter: 'V', Z: 24 },
};

const FCC = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];
const shift = (pts, d) => pts.map((p) => p.map((v, i) => v + d[i]));
export const MATERIALS = {
  Si: { name: 'Silicon', a: 5.4309, lattice: 'diamond', sites: [...FCC.map((p) => [p, 14]), ...shift(FCC, [0.25, 0.25, 0.25]).map((p) => [p, 14])] },
  Al: { name: 'Aluminium', a: 4.0495, lattice: 'fcc', sites: FCC.map((p) => [p, 13]) },
  Cu: { name: 'Copper', a: 3.6149, lattice: 'fcc', sites: FCC.map((p) => [p, 29]) },
  Au: { name: 'Gold', a: 4.0782, lattice: 'fcc', sites: FCC.map((p) => [p, 79]) },
  Fe: { name: 'α-Iron', a: 2.8665, lattice: 'bcc', sites: [[[0, 0, 0], 26], [[0.5, 0.5, 0.5], 26]] },
  W: { name: 'Tungsten', a: 3.1652, lattice: 'bcc', sites: [[[0, 0, 0], 74], [[0.5, 0.5, 0.5], 74]] },
  NaCl: { name: 'Rock salt', a: 5.6402, lattice: 'rock salt', sites: [...FCC.map((p) => [p, 11]), ...shift(FCC, [0.5, 0.5, 0.5]).map((p) => [p, 17])] },
};

/** Approximate atomic form factor; s = sin θ / λ [Å⁻¹]. Diffuse outer shell + compact core. */
export function formFactor(Z, s) {
  const s2 = 0.55 + 0.0048 * Z;
  return Z * (0.2 / (1 + (s / 0.12) ** 2) ** 2 + 0.8 * Math.exp(-((s / s2) ** 2)));
}

export function multiplicity(h, k, l) {
  const set = new Set();
  for (const p of [[h, k, l], [h, l, k], [k, h, l], [k, l, h], [l, h, k], [l, k, h]]) for (let sg = 0; sg < 8; sg++) set.add([p[0] * (sg & 1 ? -1 : 1), p[1] * (sg & 2 ? -1 : 1), p[2] * (sg & 4 ? -1 : 1)].join());
  return set.size;
}

/** |F|² for reflection hkl. */
export function structureFactor2(mat, h, k, l, s) {
  let re = 0, im = 0;
  for (const [[x, y, z], Z] of mat.sites) { const ph = 2 * Math.PI * (h * x + k * y + l * z), f = formFactor(Z, s); re += f * Math.cos(ph); im += f * Math.sin(ph); }
  return re * re + im * im;
}

/** All reflections up to 2θ max for a wavelength. Returns [{h,k,l,d,tth,F2,m,I}] with I relative (max 100). */
export function reflections(mat, lambda, { strain = 0, tthMax = 140, B = 0.5 } = {}) {
  const a = mat.a * (1 + strain), out = [];
  const nMax = Math.floor((2 * a) / lambda);
  for (let h = 0; h <= nMax; h++) for (let k = 0; k <= h; k++) for (let l = 0; l <= k; l++) {
    const N = h * h + k * k + l * l; if (!N) continue;
    const d = a / Math.sqrt(N), st = lambda / (2 * d); if (st >= 1) continue;
    const th = Math.asin(st), tth = (2 * th * 180) / Math.PI; if (tth > tthMax) continue;
    const s = st / lambda, F2 = structureFactor2(mat, h, k, l, s);
    if (F2 < 1e-6 * mat.sites.length ** 2) continue;
    const m = multiplicity(h, k, l), lp = (1 + Math.cos(2 * th) ** 2) / (Math.sin(th) ** 2 * Math.cos(th));
    out.push({ h, k, l, N, d, tth, th, F2, m, lp, I: F2 * m * lp * Math.exp(-2 * B * s * s) });
  }
  out.sort((p, q) => p.tth - q.tth);
  // reflections that share N = h²+k²+l² (e.g. 333 and 511) coincide: merge them into one line
  for (let i = out.length - 1; i > 0; i--) if (out[i].N === out[i - 1].N) { out[i - 1].I += out[i].I; out[i - 1].m += out[i].m; out.splice(i, 1); }
  const mx = Math.max(...out.map((r) => r.I), 1e-12);
  for (const r of out) r.I = (r.I / mx) * 100;
  return out;
}

// ---------------------------------------------------------------- peak profiles
/** Instrument FWHM [deg] (Caglioti). */
export const instFWHM = (th) => Math.sqrt(Math.max(1e-6, 0.0035 * Math.tan(th) ** 2 - 0.002 * Math.tan(th) + 0.0042));
/** Size (Lorentzian) and strain (Gaussian) FWHM [deg]. L [nm], eps microstrain (fraction). */
export const sizeFWHM = (th, lambda, L) => ((0.9 * lambda) / (L * 10 * Math.cos(th))) * (180 / Math.PI);
export const strainFWHM = (th, eps) => 4 * eps * Math.tan(th) * (180 / Math.PI);
/** Thompson–Cox–Hastings pseudo-Voigt parameters from Gaussian and Lorentzian widths. */
export function tch(gG, gL) {
  const G = (gG ** 5 + 2.69269 * gG ** 4 * gL + 2.42843 * gG ** 3 * gL ** 2 + 4.47163 * gG ** 2 * gL ** 3 + 0.07842 * gG * gL ** 4 + gL ** 5) ** 0.2;
  const q = gL / G;
  return { G, eta: 1.36603 * q - 0.47719 * q * q + 0.11116 * q ** 3 };
}
export function pseudoVoigt(x, G, eta) {
  const t = (2 * x) / G;
  return eta / (1 + t * t) + (1 - eta) * Math.exp(-Math.LN2 * t * t);
}

/**
 * Simulated diffractogram on a 2θ grid.
 * o: { mat, anode, filter (bool), L [nm], eps, strain, disp [mm], time [s/step], R [mm] }
 * Returns { x, y (counts, noisy), ideal, peaks }.
 */
export function pattern(o, { x0 = 10, x1 = 120, step = 0.02, rand = Math.random } = {}) {
  const an = ANODES[o.anode], mat = MATERIALS[o.mat], n = Math.round((x1 - x0) / step) + 1;
  const ideal = new Float32Array(n), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = x0 + i * step;
  const lines = [[an.ka1, 1], [an.ka2, 0.5], [an.kb, o.filter ? 0.012 : 0.17]];
  const peaks = reflections(mat, an.ka1, { strain: o.strain, tthMax: x1 + 5 });
  const R = o.R || 240;
  for (const [lam, w] of lines) {
    for (const r of reflections(mat, lam, { strain: o.strain, tthMax: x1 + 5 })) {
      const ref = peaks.find((p) => p.N === r.N); if (!ref) continue;
      const gG = Math.hypot(instFWHM(r.th), strainFWHM(r.th, o.eps)), gL = sizeFWHM(r.th, lam, o.L);
      const { G, eta } = tch(gG, gL);
      // sample displacement shifts peaks: Δ2θ = −2 s cos θ / R
      const c = r.tth - ((2 * o.disp * Math.cos(r.th)) / R) * (180 / Math.PI);
      if (lam === an.ka1) { ref.fwhm = G; ref.pos = c; ref.eta = eta; ref.gL = gL; ref.gG = gG; }
      // constant integrated intensity: height ∝ I / width
      const amp = (ref.I * w * 0.065) / G;
      const i0 = Math.max(0, Math.floor((c - 25 * G - x0) / step)), i1 = Math.min(n - 1, Math.ceil((c + 25 * G - x0) / step));
      for (let i = i0; i <= i1; i++) ideal[i] += amp * pseudoVoigt(x[i] - c, G, eta);
    }
  }
  // background: air scatter + fluorescence when the radiation excites the sample's K shell
  const fluo = mat.sites.some(([, Z]) => (o.anode === 'Cu' && (Z === 26 || Z === 27)) || (o.anode === 'Mo' && Z >= 29 && Z <= 40)) ? 14 : 1;
  const cps = 7000 * (o.filter ? 0.6 : 1); // counts per second at relative intensity 100
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const bg = (0.35 + 1.6 * Math.exp(-(x[i] - 10) / 22)) * fluo;
    const mu = ((ideal[i] / 100) * cps + bg * 7) * o.time;
    ideal[i] = mu;
    y[i] = mu > 40 ? Math.max(0, mu + Math.sqrt(mu) * Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(6.2832 * rand())) : poisson(mu, rand);
  }
  return { x, y, ideal, peaks: peaks.filter((p) => p.tth <= x1 && p.pos != null), fluo: fluo > 1 };
}
function poisson(l, rand) { const L = Math.exp(-l); let k = 0, p = 1; do { k++; p *= rand(); } while (p > L); return k - 1; }

/** Tube spectrum (relative photons per wavelength interval) at wavelength lam [Å] for tube voltage kV. */
export function tubeSpectrum(lam, kV, an = ANODES.Cu, filter = false) {
  const lmin = 12.398 / kV; if (lam <= lmin) return 0;
  let y = 2.2 * (lam / lmin - 1) / (lam * lam) * (kV / 40) ** 1; // Kramers continuum
  if (kV > an.edge) {
    const ov = (kV / an.edge - 1) ** 1.6;
    y += ov * (5.5 * Math.exp(-(((lam - an.ka1) / 0.006) ** 2)) + 2.75 * Math.exp(-(((lam - an.ka2) / 0.006) ** 2)) + 1.0 * Math.exp(-(((lam - an.kb) / 0.006) ** 2)));
  }
  if (filter) { // Ni foil: K absorption edge at 1.488 Å sits between Kβ and Kα
    const edge = 1.488 * (an.ka1 / 1.54056), mu = (lam < edge ? 5.2 : 0.62) * (lam / edge) ** 3;
    y *= Math.exp(-mu);
  }
  return y;
}
