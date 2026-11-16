// Small canvas plotting helpers for the HUD panel.
import { wavelength } from './physics.js';

const FONT = '10px "JetBrains Mono", monospace';

function theme(el) {
  const cs = getComputedStyle(el || document.documentElement);
  return {
    fg: cs.getPropertyValue('--fg').trim() || '#f6f4f2',
    dim: cs.getPropertyValue('--dim').trim() || '#8a8580',
    line: cs.getPropertyValue('--line').trim() || '#45423f',
    accent: cs.getPropertyValue('--accent').trim() || '#ff4b4b',
  };
}

export function prepCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

const tickFmt = (v, log) => {
  if (log) {
    const e = Math.round(Math.log10(v));
    if (Math.abs(e) <= 2) return String(+(10 ** e).toPrecision(1));
    return '10' + String(e).replace(/-/g, '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]);
  }
  return String(+v.toPrecision(3));
};

/**
 * spec: { x:[a,b], y:[a,b], lx, ly, xl, yl, series:[{f, c, name, dash}], mark:(f)=>x, hl:[{y, name}] }
 */
export function drawFnPlot(canvas, spec, f, env) {
  const { ctx, w, h } = prepCanvas(canvas);
  const th = theme(canvas);
  const m = { l: 34, r: 8, t: 8, b: 22 };
  const pw = w - m.l - m.r, ph = h - m.t - m.b;
  const tx = (v) => (spec.lx ? Math.log10(v) : v);
  const ty = (v) => (spec.ly ? Math.log10(v) : v);
  const x0 = tx(spec.x[0]), x1 = tx(spec.x[1]), y0 = ty(spec.y[0]), y1 = ty(spec.y[1]);
  const X = (v) => m.l + ((tx(v) - x0) / (x1 - x0)) * pw;
  const Y = (v) => m.t + ph - ((ty(Math.max(v, spec.ly ? 1e-300 : -1e300)) - y0) / (y1 - y0)) * ph;

  ctx.font = FONT;
  ctx.lineWidth = 1;
  // grid
  ctx.strokeStyle = th.line;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const gx = m.l + (pw * i) / 4, gy = m.t + (ph * i) / 4;
    ctx.moveTo(gx + 0.5, m.t); ctx.lineTo(gx + 0.5, m.t + ph);
    ctx.moveTo(m.l, gy + 0.5); ctx.lineTo(m.l + pw, gy + 0.5);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
  // tick labels
  ctx.fillStyle = th.dim;
  ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  ctx.fillText(tickFmt(spec.x[0], spec.lx), m.l, m.t + ph + 5);
  ctx.textAlign = 'right';
  ctx.fillText(tickFmt(spec.x[1], spec.lx), m.l + pw, m.t + ph + 5);
  ctx.textAlign = 'center';
  ctx.fillText(spec.xl || '', m.l + pw / 2, m.t + ph + 5);
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(tickFmt(spec.y[1], spec.ly), m.l - 4, m.t + 5);
  ctx.fillText(tickFmt(spec.y[0], spec.ly), m.l - 4, m.t + ph - 4);
  ctx.save();
  ctx.translate(9, m.t + ph / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(spec.yl || '', 0, 0);
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.rect(m.l, m.t, pw, ph); ctx.clip();
  // horizontal reference lines
  for (const hl of spec.hl || []) {
    ctx.strokeStyle = th.dim; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(m.l, Y(hl.y)); ctx.lineTo(m.l + pw, Y(hl.y)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.dim; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(hl.name, m.l + pw - 3, Y(hl.y) - 2);
  }
  for (const vl of spec.vl || []) {
    ctx.strokeStyle = th.dim; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(vl.x), m.t); ctx.lineTo(X(vl.x), m.t + ph); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = th.dim; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(vl.name, X(vl.x), m.t + 3);
  }
  const N = spec.n || 140;
  const series = typeof spec.series === 'function' ? spec.series(env) : spec.series;
  series.forEach((s, si) => {
    ctx.strokeStyle = s.c === 'accent' ? th.accent : s.c === 'fg' ? th.fg : s.c === 'dim' ? th.dim : s.c;
    ctx.lineWidth = s.w || 1.5;
    ctx.setLineDash(s.dash || []);
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i <= N; i++) {
      const u = x0 + ((x1 - x0) * i) / N;
      const xv = spec.lx ? 10 ** u : u;
      const yv = s.f(xv, env);
      if (!isFinite(yv)) { pen = false; continue; }
      const px = X(xv), py = Y(yv);
      if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (s.name) {
      const lx = s.lx ?? (spec.lx ? 10 ** (x0 + (x1 - x0) * (0.08 + 0.2 * si)) : x0 + (x1 - x0) * 0.6);
      ctx.fillStyle = ctx.strokeStyle; ctx.textAlign = s.la || 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(s.name, X(lx) + 2, Math.min(m.t + ph - 2, Math.max(m.t + 11, Y(s.f(lx, env)) - 3)));
    }
  });
  for (const [nx, name] of spec.notes || []) {
    const s0 = series[0];
    ctx.fillStyle = th.fg; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(name, X(nx), Math.max(m.t + 11, Y(s0.f(nx, env)) - 4));
  }
  // marker
  if (spec.mark) {
    const xm = spec.mark(f, env);
    if (xm != null && isFinite(xm)) {
      const s = series[spec.markSeries || 0];
      const px = X(xm), py = Y(s.f(xm, env));
      ctx.strokeStyle = th.fg; ctx.globalAlpha = 0.35; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, m.t); ctx.lineTo(px, m.t + ph); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = th.fg;
      ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 7); ctx.fill();
    }
  }
  ctx.restore();
  ctx.strokeStyle = th.dim; ctx.lineWidth = 1;
  ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw, ph);
}

// ---------- custom drawings ----------

/** Probe cross-sections through focus with residual astigmatism a (0..1). */
export function drawStigmator(canvas, f) {
  const { ctx, w, h } = prepCanvas(canvas);
  const th = theme(canvas);
  const a = 1 - Math.min(1, f * 1.25); // astigmatism left to correct
  const labels = ['UNDER', 'FOCUS', 'OVER'];
  ctx.font = FONT; ctx.textAlign = 'center';
  [-1, 0, 1].forEach((dz, i) => {
    const cx = (w * (i + 0.5)) / 3, cy = h / 2 - 8;
    const base = 5 + 9 * Math.abs(dz);
    const rx = Math.abs(base + dz * a * 16) + (dz === 0 ? a * 9 : 0) * 0 + 2;
    const ry = Math.abs(base - dz * a * 16) + 2;
    const R = dz === 0 ? 4 + a * 12 : null;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 5);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    ctx.scale(R ?? rx, R ?? ry);
    g.addColorStop(0, th.accent); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.arc(0, 0, 1, 0, 7); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = th.line; ctx.beginPath();
    ctx.moveTo(cx - 34, cy); ctx.lineTo(cx + 34, cy); ctx.moveTo(cx, cy - 34); ctx.lineTo(cx, cy + 34); ctx.stroke();
    ctx.fillStyle = th.dim; ctx.fillText(labels[i], cx, h - 6);
  });
}

/** X (line) and Y (frame) scan-generator waveforms, plus the current beam position. */
export function drawScan(canvas, f, env) {
  const { ctx, w, h } = prepCanvas(canvas);
  const th = theme(canvas);
  const t = (env.time * 0.12) % 1;
  const lines = 8;
  const m = 30;
  ctx.font = FONT; ctx.fillStyle = th.dim; ctx.textBaseline = 'middle';
  ctx.fillText('X', 8, h * 0.27); ctx.fillText('Y', 8, h * 0.73);
  const pw = w - m - 70;
  ctx.strokeStyle = th.accent; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < lines; i++) {
    const xa = m + (pw * i) / lines, xb = m + (pw * (i + 0.9)) / lines, xc = m + (pw * (i + 1)) / lines;
    ctx.moveTo(xa, h * 0.42); ctx.lineTo(xb, h * 0.12); ctx.lineTo(xc, h * 0.42);
  }
  ctx.stroke();
  ctx.strokeStyle = th.fg; ctx.beginPath();
  for (let i = 0; i < lines; i++) {
    const xa = m + (pw * i) / lines, xc = m + (pw * (i + 1)) / lines;
    const y = h * 0.9 - (h * 0.32 * i) / (lines - 1);
    ctx.moveTo(xa, y); ctx.lineTo(xc, y);
    if (i < lines - 1) ctx.lineTo(xc, y - (h * 0.32) / (lines - 1));
  }
  ctx.stroke();
  const px = m + pw * t;
  ctx.strokeStyle = th.dim; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
  ctx.beginPath(); ctx.moveTo(px, 4); ctx.lineTo(px, h - 4); ctx.stroke(); ctx.setLineDash([]);
  // raster preview
  const bx = w - 58, by = h / 2 - 25, bs = 50;
  ctx.strokeStyle = th.dim; ctx.strokeRect(bx + 0.5, by + 0.5, bs, bs);
  const li = Math.floor(t * lines), lf = Math.min(1, ((t * lines) % 1) / 0.9);
  ctx.strokeStyle = th.line; ctx.beginPath();
  for (let i = 0; i < li; i++) { const y = by + (bs * (i + 0.5)) / lines; ctx.moveTo(bx + 3, y); ctx.lineTo(bx + bs - 3, y); }
  ctx.stroke();
  const y = by + (bs * (li + 0.5)) / lines;
  ctx.strokeStyle = th.accent; ctx.beginPath(); ctx.moveTo(bx + 3, y); ctx.lineTo(bx + 3 + (bs - 6) * lf, y); ctx.stroke();
  ctx.fillStyle = th.fg; ctx.beginPath(); ctx.arc(bx + 3 + (bs - 6) * lf, y, 2.5, 0, 7); ctx.fill();
}

/** Simulated EDS spectrum intensity (arbitrary units) at photon energy E [keV] for beam energy E0. */
export function edsSpectrum(E, E0 = 15) {
  if (E <= 0.05 || E >= E0) return 0;
  const win = Math.exp(-((0.35 / E) ** 2.6)); // low-energy absorption (window, dead layer)
  let y = 0.9 * ((E0 - E) / E) * win * 0.06;
  const lines = [
    [0.277, 0.25], [0.525, 0.75], [0.93, 0.55], [1.74, 1.0], [1.775, 0.42], [8.046, 0.34], [8.398, 0.16], [8.905, 0.05],
  ];
  for (const [e, a] of lines) {
    if (e * 1.2 > E0) continue;
    const fwhm = Math.sqrt(5.546 * 0.115 * 3.8 * e * 1000 + 55 * 55) / 1000;
    const s = fwhm / 2.355;
    y += a * Math.exp(-((E - e) ** 2) / (2 * s * s));
  }
  return y;
}

// Kikuchi pattern for a diamond-cubic crystal (Si, a = 0.5431 nm) in gnomonic projection.
const FAMILIES = [
  { hkl: [1, 1, 1], w: 1.0 }, { hkl: [2, 2, 0], w: 0.8 }, { hkl: [3, 1, 1], w: 0.42 }, { hkl: [4, 0, 0], w: 0.45 },
];
function planeSet() {
  const out = [];
  for (const fam of FAMILIES) {
    const [a, b, c] = fam.hkl;
    const seen = new Set();
    const perms = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];
    for (const p of perms) for (let s = 0; s < 8; s++) {
      const v = [p[0] * (s & 1 ? -1 : 1), p[1] * (s & 2 ? -1 : 1), p[2] * (s & 4 ? -1 : 1)];
      // canonical sign
      const k = v.find((q) => q !== 0) < 0 ? v.map((q) => -q) : v;
      const key = k.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      const n = Math.hypot(...k);
      out.push({ n: k.map((q) => q / n), d: 0.5431e-9 / n, w: fam.w });
    }
  }
  return out;
}
const PLANES = planeSet();

export function drawKikuchi(canvas, rot, kV = 20, raw = false) {
  let ctx, w, h;
  if (raw) { ctx = canvas.getContext('2d'); w = canvas.width; h = canvas.height; }
  else ({ ctx, w, h } = prepCanvas(canvas));
  const sw = Math.round(w / 2), sh = Math.round(h / 2);
  const img = new ImageData(sw, sh);
  const lam = wavelength(kV * 1000);
  const a1 = 0.35 + rot * 0.9, a2 = 0.5 + rot * 0.5, a3 = 0.2 - rot * 0.6;
  const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2), c3 = Math.cos(a3), s3 = Math.sin(a3);
  const R = [
    [c1 * c3 - s1 * c2 * s3, -c1 * s3 - s1 * c2 * c3, s1 * s2],
    [s1 * c3 + c1 * c2 * s3, -s1 * s3 + c1 * c2 * c3, -c1 * s2],
    [s2 * s3, s2 * c3, c2],
  ];
  const pl = PLANES.map((p) => ({
    n: [0, 1, 2].map((i) => R[i][0] * p.n[0] + R[i][1] * p.n[1] + R[i][2] * p.n[2]),
    tb: lam / (2 * p.d), w: p.w,
  }));
  const half = 0.75; // tan of half capture angle (horizontal)
  for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
    const x = ((i + 0.5) / sw - 0.5) * 2 * half, y = ((j + 0.5) / sh - 0.5) * 2 * half * (sh / sw);
    const il = 1 / Math.sqrt(x * x + y * y + 1);
    let v = 0.34 * il * il * il + 0.05;
    for (const p of pl) {
      const s = Math.abs((p.n[0] * x + p.n[1] * y + p.n[2]) * il);
      if (s < p.tb) v += 0.2 * p.w;
      else if (s < p.tb * 1.35) v -= 0.07 * p.w;
    }
    v = Math.max(0, Math.min(1, v));
    const o = (j * sw + i) * 4;
    const g = 255 * v ** 0.9;
    img.data[o] = g * 0.82; img.data[o + 1] = g; img.data[o + 2] = g * 0.8; img.data[o + 3] = 255;
  }
  const tmp = drawKikuchi._c || (drawKikuchi._c = document.createElement('canvas'));
  tmp.width = sw; tmp.height = sh;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(tmp, 0, 0, w, h);
}

/** Detector line-scan across a step edge: mean signal, shot noise, ADC quantisation. */
export function drawLineScan(canvas, f, env) {
  const { ctx, w, h } = prepCanvas(canvas);
  const th = theme(canvas);
  const n = env.nPerPixel || 100; // detected quanta per pixel
  const N = 110;
  const m = 8;
  const mean = (i) => {
    const x = i / N;
    let s = 0.3;
    if (x > 0.3 && x < 0.62) s = 0.52;
    s += 0.38 * Math.exp(-(((x - 0.3) / 0.018) ** 2)) + 0.38 * Math.exp(-(((x - 0.62) / 0.018) ** 2));
    return s;
  };
  // deterministic pseudo-noise that reshuffles a few times per second
  let seed = (Math.floor(env.time * 6) * 9973 + 17) | 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) | 0; return (seed >>> 8) / 16777216; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(6.2832 * rnd());
  ctx.strokeStyle = th.dim; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  ctx.beginPath();
  for (let i = 0; i <= N; i++) { const x = m + ((w - 2 * m) * i) / N, y = h - 14 - mean(i) * (h - 26); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = th.accent; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const mu = mean(i);
    let v = mu + gauss() * Math.sqrt(mu / n);
    v = Math.round(v * 64) / 64;
    const x = m + ((w - 2 * m) * i) / N, y = h - 14 - Math.max(0, Math.min(1.05, v)) * (h - 26);
    if (i) { ctx.lineTo(x, ctx._py); ctx.lineTo(x, y); } else ctx.moveTo(x, y);
    ctx._py = y;
  }
  ctx.stroke();
  ctx.font = FONT; ctx.fillStyle = th.dim; ctx.textBaseline = 'bottom'; ctx.textAlign = 'left';
  ctx.fillText('SIGNAL vs BEAM POSITION', m, h - 1);
  ctx.textAlign = 'right'; ctx.fillText('— — ideal', w - m, h - 1);
}

/** Emitted-electron energy distribution N(E): SE peak, BSE continuum, elastic peak. */
export function emittedSpectrum(x) {
  // x = E / E0 on a log-ish axis is awkward; use piecewise model on linear E/E0
  const se = 2.6 * (x / 0.004) * Math.exp(1 - x / 0.004) * 0.37; // peak near 0.004 E0
  const bse = 0.25 * (0.25 + x ** 2.2 * 2.4) * (x < 1 ? 1 : 0);
  const el = 1.3 * Math.exp(-(((x - 0.985) / 0.012) ** 2));
  return se + bse + el;
}
