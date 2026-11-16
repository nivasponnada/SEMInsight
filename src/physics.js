// Physical constants (SI) and the closed-form electron-optics / interaction models
// used throughout the site. Sources: Goldstein et al., "Scanning Electron Microscopy
// and X-ray Microanalysis" (4th ed.); Reimer, "Scanning Electron Microscopy" (2nd ed.);
// Joy, "Monte Carlo Modeling for Electron Microscopy and Microanalysis".

export const K = {
  e: 1.602176634e-19,
  m: 9.1093837015e-31,
  c: 299792458,
  h: 6.62607015e-34,
  kB: 1.380649e-23,
  eps0: 8.8541878128e-12,
};

/** Relativistic de Broglie wavelength [m] for accelerating potential V [volts]. */
export function wavelength(V) {
  const { h, m, e, c } = K;
  return h / Math.sqrt(2 * m * e * V * (1 + (e * V) / (2 * m * c * c)));
}

/** v/c for accelerating potential V [volts]. */
export function betaRel(V) {
  const g = 1 + (K.e * V) / (K.m * K.c * K.c);
  return Math.sqrt(1 - 1 / (g * g));
}

/** Schottky barrier lowering [eV] for a surface field F [V/m]. */
export function schottkyLowering(F) {
  return Math.sqrt((K.e * F) / (4 * Math.PI * K.eps0));
}

/** Richardson–Schottky current density [A/m^2]. phi [eV], T [K], F [V/m]. */
export function richardson(T, phi, F = 0) {
  const A = 1.20173e6; // A m^-2 K^-2
  const kT = (K.kB * T) / K.e; // eV
  return A * T * T * Math.exp(-(phi - schottkyLowering(F)) / kT);
}

/** Mean free path of air molecules at 293 K [m] for pressure p [mbar]. */
export function meanFreePath(pMbar) {
  return 6.6e-5 / pMbar; // 6.6e-3 cm·mbar
}

/**
 * Probe diameter contributions [m], added in quadrature.
 * V [V], Ip [A], alpha [rad], Cs, Cc [m], dE [eV], Br reduced brightness [A m^-2 sr^-1 V^-1]
 */
export function probe({ V, Ip, alpha, Cs, Cc, dE = 0.7, Br = 1e8 }) {
  const dg = (2 / Math.PI) * Math.sqrt(Ip / (Br * V)) / alpha;
  const ds = 0.5 * Cs * alpha ** 3;
  const dc = Cc * (dE / V) * alpha;
  const dd = (0.61 * wavelength(V)) / alpha;
  return { dg, ds, dc, dd, d: Math.sqrt(dg * dg + ds * ds + dc * dc + dd * dd) };
}

/** Aberration coefficients [m] of a conventional (pinhole) objective vs working distance [mm]. */
export function lensCoefficients(wdMm, immersion = false) {
  if (immersion) return { Cs: (0.9 + 0.35 * wdMm) * 1e-3, Cc: (0.8 + 0.3 * wdMm) * 1e-3 };
  return { Cs: (2 + 1.6 * wdMm) * 1e-3, Cc: (1.5 + 0.9 * wdMm) * 1e-3 };
}

/** Kanaya–Okayama electron range [µm]. E [keV], rho [g/cm^3]. */
export function rangeKO(E, m) {
  return (0.0276 * m.A * E ** 1.67) / (m.Z ** 0.889 * m.rho);
}

/** Backscatter coefficient at normal incidence (Reuter fit). */
export function eta(Z) {
  return -0.0254 + 0.016 * Z - 1.86e-4 * Z * Z + 8.3e-7 * Z * Z * Z;
}

/** Backscatter coefficient at tilt theta [rad] (Arnal et al.). */
export function etaTilt(Z, theta) {
  return Math.min(0.95, 1 / (1 + Math.cos(theta)) ** (9 / Math.sqrt(Z)));
}

/** Secondary-electron yield, Lin–Joy universal curve. E [keV]. */
export function delta(E, m) {
  const x = E / m.Em;
  return m.dm * 1.28 * x ** -0.67 * (1 - Math.exp(-1.614 * x ** 1.67));
}

/** Oxygen-gas skirt radius [m] (Danilatos). E [eV], p [Pa], L gas path length [m]. */
export function skirtRadius(Z, E, p, L, T = 293) {
  return ((364 * Z) / E) * Math.sqrt(p / T) * L ** 1.5;
}

// Z: (mass-averaged) atomic number, A [g/mol], rho [g/cm^3],
// dm / Em: maximum SE yield and the energy [keV] at which it occurs,
// cond: electrically conductive.
export const MATERIALS = {
  C: { name: 'Carbon', sym: 'C', Z: 6, A: 12.011, rho: 2.0, dm: 1.0, Em: 0.3, cond: true },
  Al: { name: 'Aluminium', sym: 'Al', Z: 13, A: 26.982, rho: 2.7, dm: 1.0, Em: 0.3, cond: true },
  Si: { name: 'Silicon', sym: 'Si', Z: 14, A: 28.086, rho: 2.33, dm: 1.1, Em: 0.25, cond: true },
  SiO2: { name: 'Silicon dioxide', sym: 'SiO₂', Z: 10.8, A: 20.03, rho: 2.2, dm: 2.4, Em: 0.4, cond: false },
  Co: { name: 'Cobalt', sym: 'Co', Z: 27, A: 58.933, rho: 8.9, dm: 1.2, Em: 0.6, cond: true },
  Cu: { name: 'Copper', sym: 'Cu', Z: 29, A: 63.546, rho: 8.96, dm: 1.3, Em: 0.6, cond: true },
  Sn: { name: 'Tin', sym: 'Sn', Z: 50, A: 118.71, rho: 7.29, dm: 1.35, Em: 0.5, cond: true },
  WC: { name: 'Tungsten carbide', sym: 'WC', Z: 69.8, A: 172.5, rho: 15.6, dm: 1.3, Em: 0.6, cond: true },
  W: { name: 'Tungsten', sym: 'W', Z: 74, A: 183.84, rho: 19.3, dm: 1.4, Em: 0.65, cond: true },
  Au: { name: 'Gold', sym: 'Au', Z: 79, A: 196.97, rho: 19.3, dm: 1.4, Em: 0.8, cond: true },
};

/** Format a length given in metres with a sensible unit. */
export function fmtLen(m, digits = 3) {
  const a = Math.abs(m);
  const p = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(Math.max(0, digits - 1)));
  if (a >= 1e-3) return [p(m * 1e3), 'mm'];
  if (a >= 1e-6) return [p(m * 1e6), 'µm'];
  if (a >= 1e-9) return [p(m * 1e9), 'nm'];
  return [p(m * 1e12), 'pm'];
}

export function fmtCurrent(A) {
  const a = Math.abs(A);
  const p = (v) => (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  if (a >= 1e-6) return [p(A * 1e6), 'µA'];
  if (a >= 1e-9) return [p(A * 1e9), 'nA'];
  return [p(A * 1e12), 'pA'];
}

export function fmtExp(v, d = 1) {
  if (v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const mant = v / 10 ** e;
  const sup = String(e).replace(/-/g, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
  return `${mant.toFixed(d)}×10${sup}`;
}
