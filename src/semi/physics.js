// Silicon device physics used by the semiconductor-characterisation module.
// Units: cm, V, s, K unless noted.
export const Q = 1.602176634e-19, KB = 1.380649e-23, EPS0 = 8.8541878e-14; // F/cm
export const ES = 11.7 * EPS0, EOX = 3.9 * EPS0;
export const vt = (T = 300) => (KB * T) / Q;
/** Intrinsic carrier density of Si [cm⁻³] (Misiakos & Tsamakis). */
export const ni = (T = 300) => 5.29e19 * (T / 300) ** 2.54 * Math.exp(-6726 / T);
/** Band gap of Si [eV] (Varshni). */
export const Eg = (T = 300) => 1.17 - (4.73e-4 * T * T) / (T + 636);
/** Majority-carrier mobility in Si at 300 K [cm²/Vs] (Caughey–Thomas fits). */
export const muN = (N) => 68.5 + (1414 - 68.5) / (1 + (N / 9.2e16) ** 0.711);
export const muP = (N) => 44.9 + (470.5 - 44.9) / (1 + (N / 2.23e17) ** 0.719);
export const mobility = (N, type) => (type === 'n' ? muN(N) : muP(N));
/** Resistivity [Ω cm]. */
export const resistivity = (N, type) => 1 / (Q * N * mobility(N, type));

// ---------------------------------------------------------------- MOS capacitor
/**
 * C–V of a MOS capacitor on p-type Si (mirror the voltage axis for n-type).
 * o: { N [cm⁻³], tox [nm], Qf [cm⁻²], Dit [cm⁻² eV⁻¹], T, type, phiMS }
 * Returns { V[], Chf[], Clf[] (normalised to Cox), Cox [F/cm²], Vfb, Vt, Wmax [cm], phiF, Cmin }.
 */
export function mosCV(o) {
  const T = o.T || 300, b = 1 / vt(T), N = o.N, n0 = ni(T);
  const Cox = EOX / (o.tox * 1e-7);
  const phiF = vt(T) * Math.log(N / n0);
  const LD = Math.sqrt((ES * vt(T)) / (Q * N));
  const phiMS = o.phiMS ?? -(0.56 + phiF); // n+ poly / Al-like gate on p-Si
  const Vfb = phiMS - (Q * (o.Qf || 0)) / Cox;
  const r = (n0 / N) ** 2;
  const F = (psi) => Math.sqrt(Math.max(1e-30, Math.exp(-b * psi) + b * psi - 1 + r * (Math.exp(b * psi) - b * psi - 1)));
  const Fd = (psi) => Math.sqrt(Math.max(1e-30, Math.exp(-b * psi) + b * psi - 1));
  const pre = (Math.SQRT2 * ES * vt(T)) / LD;
  const psiInv = 2 * phiF + 4 * vt(T);
  const V = [], Chf = [], Clf = [], Psi = [];
  const Cit = Q * (o.Dit || 0); // F/cm² per volt of surface potential
  for (let i = 0; i <= 400; i++) {
    const psi = -0.35 + (i / 400) * (psiInv + 0.2 + 0.35);
    const Qs = -Math.sign(psi) * pre * F(psi);
    const v = Vfb + psi - Qs / Cox + (Cit * (psi - phiF)) / Cox;
    let Cs;
    if (Math.abs(psi) < 1e-4) Cs = ES / LD;
    else Cs = Math.abs((ES / (Math.SQRT2 * LD)) * (1 - Math.exp(-b * psi) + r * (Math.exp(b * psi) - 1)) / F(psi));
    // high frequency: minority carriers cannot follow, the depletion layer stops at its maximum width
    const pd = Math.min(psi, psiInv - 3.2 * vt(T));
    let Cd = Math.abs(pd) < 1e-4 ? ES / LD : Math.abs((ES / (Math.SQRT2 * LD)) * (1 - Math.exp(-b * pd)) / Fd(pd));
    if (psi < 0) Cd = Cs;
    V.push(v); Psi.push(psi);
    Clf.push(1 / (1 / Cox + 1 / (Cs + Cit)) / Cox);
    Chf.push(1 / (1 / Cox + 1 / Cd) / Cox);
  }
  const Wmax = Math.sqrt((4 * ES * phiF) / (Q * N));
  const Vt = Vfb + 2 * phiF + Math.sqrt(4 * ES * Q * N * phiF) / Cox;
  const s = o.type === 'n' ? -1 : 1;
  return { V: V.map((v) => v * s), Chf, Clf, Psi, Cox, Vfb: Vfb * s, Vt: Vt * s, Wmax, phiF, LD, Cmin: Math.min(...Chf) };
}
export function interp(xs, ys, x) {
  const inc = xs[xs.length - 1] > xs[0];
  if (inc ? x <= xs[0] : x >= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) if (inc ? x <= xs[i] : x >= xs[i]) { const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]); return ys[i - 1] + (ys[i] - ys[i - 1]) * t; }
  return ys[ys.length - 1];
}

// ---------------------------------------------------------------- pn junction
/** o: { Na, Nd, T, A [cm²], tau [s], Rs [Ω] } */
export function diode(o) {
  const T = o.T || 300, n0 = ni(T), Vt = vt(T);
  const Dn = muN(o.Na) * Vt * (300 / T) ** 0, Dp = muP(o.Nd) * Vt;
  const Ln = Math.sqrt(Dn * o.tau), Lp = Math.sqrt(Dp * o.tau);
  const Is = Q * o.A * n0 * n0 * (Dn / (Ln * o.Na) + Dp / (Lp * o.Nd));
  const Vbi = Vt * Math.log((o.Na * o.Nd) / (n0 * n0));
  const W0 = Math.sqrt(((2 * ES) / Q) * (1 / o.Na + 1 / o.Nd) * Vbi);
  const Igr0 = (Q * o.A * n0 * W0) / (2 * o.tau); // generation–recombination in the depletion layer
  const I = (V) => {
    // solve I = Is(e^{(V−IRs)/Vt}−1) + Igr(e^{(V−IRs)/2Vt}−1) by bisection on the junction voltage
    const f = (vj) => Is * (Math.exp(vj / Vt) - 1) + Igr0 * Math.sqrt(Math.max(0.02, 1 - vj / Vbi)) * (Math.exp(vj / (2 * Vt)) - 1);
    if (V <= 0) return f(V);
    let lo = 0, hi = V;
    for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; (mid + f(mid) * o.Rs > V) ? (hi = mid) : (lo = mid); }
    return f(lo);
  };
  return { I, Is, Vbi, W0, Ln, Lp };
}

// ---------------------------------------------------------------- DLTS
/** Electron emission rate [s⁻¹] of a trap Et below Ec [eV] with capture cross-section sigma [cm²]. */
export const emission = (T, Et, sigma) => 1.07e21 * sigma * T * T * Math.exp(-Et / (vt(T)));
/** Normalised DLTS signal for a rate window (t1, t2) [s]. */
export const dlts = (T, Et, sigma, t1, t2) => { const e = emission(T, Et, sigma); return Math.exp(-e * t1) - Math.exp(-e * t2); };

// ---------------------------------------------------------------- ellipsometry (ambient / film / substrate)
const C = (re, im = 0) => ({ re, im });
const add = (a, b) => C(a.re + b.re, a.im + b.im), sub = (a, b) => C(a.re - b.re, a.im - b.im);
const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const csqrt = (a) => { const m = Math.hypot(a.re, a.im), r = Math.sqrt((m + a.re) / 2), i = Math.sqrt((m - a.re) / 2); return C(r, a.im < 0 ? -i : i); };
const cexp = (a) => { const e = Math.exp(a.re); return C(e * Math.cos(a.im), e * Math.sin(a.im)); };
/** Ψ, Δ [deg] for a film (index n1, thickness d [nm]) on a substrate n2 at wavelength lam [nm], incidence th [deg]. */
export function ellipsometry(d, { n1 = C(1.457), n2 = C(3.882, -0.019), lam = 632.8, th = 70 } = {}) {
  const s0 = Math.sin((th * Math.PI) / 180), c0 = C(Math.cos((th * Math.PI) / 180)), n0 = C(1);
  const cosIn = (n) => csqrt(sub(C(1), div(C(s0 * s0), mul(n, n))));
  const c1 = cosIn(n1), c2 = cosIn(n2);
  const rs = (na, ca, nb, cb) => div(sub(mul(na, ca), mul(nb, cb)), add(mul(na, ca), mul(nb, cb)));
  const rp = (na, ca, nb, cb) => div(sub(mul(nb, ca), mul(na, cb)), add(mul(nb, ca), mul(na, cb)));
  const beta = mul(C((2 * Math.PI * d) / lam), mul(n1, c1));
  const ph = cexp(mul(C(0, -2), beta));
  const tot = (r01, r12) => div(add(r01, mul(r12, ph)), add(C(1), mul(mul(r01, r12), ph)));
  const Rp = tot(rp(n0, c0, n1, c1), rp(n1, c1, n2, c2)), Rs = tot(rs(n0, c0, n1, c1), rs(n1, c1, n2, c2));
  const rho = div(Rp, Rs);
  let delta = (Math.atan2(rho.im, rho.re) * 180) / Math.PI; if (delta < 0) delta += 360;
  return { psi: (Math.atan(Math.hypot(rho.re, rho.im)) * 180) / Math.PI, delta };
}

// ---------------------------------------------------------------- ion implantation profile (B in Si)
export const implant = (E) => ({ Rp: 3.3 * E ** 0.985 * 1e-7 * 1.0, dRp: 5.6 * E ** 0.56 * 1e-7 }); // [cm], E in keV
export function implantProfile(x, E, dose) { const { Rp, dRp } = implant(E); return (dose / (Math.sqrt(2 * Math.PI) * dRp)) * Math.exp(-((x - Rp) ** 2) / (2 * dRp * dRp)); }

export const sci = (v, d = 1) => { if (!isFinite(v) || v === 0) return '0'; const e = Math.floor(Math.log10(Math.abs(v))); return `${(v / 10 ** e).toFixed(d)}×10${String(e).replace(/-/g, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}`; };
