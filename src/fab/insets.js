// Magnified "what happens at the surface" panels shown next to each process tool.
// Every variant is a small 2D animation of one process step, so the tool view reads
// as cause (the chamber) and effect (the surface) together. pr = progress 0..1, t = seconds.
export const IW = 640, IH = 420;
const C = {
  bg: '#141312', si: '#6b7684', sige: '#2fb7a6', sheet: '#a9b8cc', ox: '#4f86ad', poly: '#b39b6a', hm: '#4a474d', nit: '#e6d27a',
  epiP: '#ff6b9d', epiN: '#7ddc6e', gate: '#7f74c9', hk: '#ffc730', cu: '#d9823a', lowk: '#5a4d8c', pad: '#d9d2c0', txt: '#f6f4f2', dim: '#a09a93',
};
const rnd = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
const fr = (x) => x - Math.floor(x);
const cl = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const R = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
const dot = (c, x, y, r, col, a = 1) => { c.globalAlpha = a; c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.globalAlpha = 1; };
function frame(c, title, caption) {
  c.font = '500 19px "JetBrains Mono", monospace'; c.textBaseline = 'top'; c.textAlign = 'left';
  c.fillStyle = 'rgba(20,19,18,.78)'; c.fillRect(0, 0, IW, 34); c.fillRect(0, IH - 36, IW, 36);
  c.fillStyle = C.dim; c.fillText(title, 14, 8);
  c.fillStyle = C.txt; c.fillText(caption, 14, IH - 27);
  c.strokeStyle = '#6f6962'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, IW - 3, IH - 3);
}
/** Molecules falling onto a surface given by top(x). stick: fraction of the fall shown. */
function rain(c, t, n, col, top, { y0 = 40, speed = 0.35, r = 5, tail = 0, seed = 0, x0 = 0, x1 = IW } = {}) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd(i, seed) * (x1 - x0), ph = fr(t * speed * (0.7 + 0.6 * rnd(i, seed + 1)) + rnd(i, seed + 2)), y = y0 + ph * (top(x) - y0);
    if (tail) { c.strokeStyle = col; c.globalAlpha = 0.75; c.lineWidth = 2.5; c.beginPath(); c.moveTo(x, y - tail); c.lineTo(x, y); c.stroke(); c.globalAlpha = 1; }
    else dot(c, x, y, r, col, 0.95);
  }
}
/** Small by-product or debris dots leaving the surface, drifting towards the pump (right). */
function exhaust(c, t, n, col, top, { x0 = 0, x1 = IW, seed = 9 } = {}) {
  for (let i = 0; i < n; i++) { const x = x0 + rnd(i, seed) * (x1 - x0), ph = fr(t * 0.3 + rnd(i, seed + 1)); dot(c, x + ph * 150, top(x) - 6 - ph * 190, 3, col, 0.8 * (1 - ph)); }
}
function plasma(c, col, y = 34, h = 70, label = 'PLASMA') {
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, col); g.addColorStop(1, 'transparent');
  c.globalAlpha = 0.6; c.fillStyle = g; c.fillRect(0, y, IW, h); c.globalAlpha = 1;
  c.font = '16px "JetBrains Mono", monospace'; c.fillStyle = C.txt; c.textAlign = 'right'; c.fillText(label, IW - 14, y + 8); c.textAlign = 'left';
}

// ---------------------------------------------------------------- deposition
const DEP = {
  cvd(c, pr, t) {
    const th = 78 * pr, top = () => 300 - th;
    R(c, 0, 300, IW, 120, C.si); R(c, 0, 300 - th, IW, th, C.sige);
    const g = c.createLinearGradient(0, 380, 0, 420); g.addColorStop(0, 'transparent'); g.addColorStop(1, '#ff7a30'); c.fillStyle = g; c.fillRect(0, 380, IW, 40);
    for (let i = 0; i < 26; i++) { const x = rnd(i, 1) * IW, ph = fr(t * 0.3 * (0.7 + 0.6 * rnd(i, 2)) + rnd(i, 3)), y = 40 + ph * (top() - 40); dot(c, x, y, 6, C.sige); dot(c, x + 7, y - 5, 3.2, '#fff'); dot(c, x - 6, y - 6, 3.2, '#fff'); }
    exhaust(c, t, 22, '#fff', top);
    frame(c, 'CVD · SURFACE ×100 000', `FILM ${(pr * 30).toFixed(0)} nm · BY-PRODUCTS PUMPED AWAY`);
  },
  epi(c, pr, t) {
    const LH = 34, k = pr * 6, n = Math.min(5, Math.floor(k)), part = pr >= 1 ? 1 : k - n, base = 310;
    R(c, 0, base, IW, 110, C.si);
    for (let i = 0; i <= n; i++) { const h = LH * (i < n ? 1 : part); R(c, 0, base - i * LH - h, IW, h, i % 2 ? C.sheet : C.sige); }
    const top = base - n * LH - LH * part;
    // the lattice continues through every layer: that is what makes it epitaxy
    for (let y = base + 96; y > top + 6; y -= 17) for (let x = 12; x < IW; x += 17) dot(c, x, y, 2.2, y > base ? '#8e99a8' : '#10302c', 0.55);
    const cur = n % 2 ? C.sheet : C.sige;
    rain(c, t, 24, cur, () => top, { y0: 62 });
    const g = c.createLinearGradient(0, 34, 0, 76); g.addColorStop(0, '#ff8a3a'); g.addColorStop(1, 'transparent'); c.fillStyle = g; c.fillRect(0, 34, IW, 42);
    frame(c, 'EPITAXY · LAMP-HEATED', `LAYER ${n + 1}/6 · ${n % 2 ? 'Si   (SiH₄)' : 'SiGe (SiH₄ + GeH₄)'}`);
  },
  ald(c, pr, t) {
    const N = 8, k = pr * N, n = Math.min(N, Math.floor(k)), ph = pr >= 1 ? 0.99 : k - n, d = n * 4.5, G = [[150, 250], [390, 490]];
    R(c, 0, 320, IW, 100, C.si);
    R(c, 0, 320 - d, IW, d, C.nit); for (const [a, b] of G) R(c, a - d, 140 - d, b - a + 2 * d, 180, C.nit);
    for (const [a, b] of G) { R(c, a, 170, b - a, 150, C.poly); R(c, a, 140, b - a, 30, C.hm); }
    // adsorbed monolayer following every surface
    const pts = [], o = d + 4;
    for (let x = 6; x < IW; x += 13) { const g = G.find(([a, b]) => x > a - o && x < b + o); pts.push([x, g ? 140 - o : 320 - o]); }
    for (const [a, b] of G) for (let y = 150; y < 320 - o; y += 13) pts.push([a - o, y], [b + o, y]);
    const name = ph < 0.3 ? 'PRECURSOR A' : ph < 0.5 ? 'PURGE' : ph < 0.8 ? 'REACTANT B' : 'PURGE';
    if (ph >= 0.08) pts.forEach(([x, y], i) => { const conv = ph >= 0.5 && (ph - 0.5) / 0.3 > rnd(i, 4); if (ph < 0.8 || !conv) dot(c, x, y, 3.6, conv ? C.nit : '#6fb6ff'); });
    const top = (x) => (G.some(([a, b]) => x > a - d && x < b + d) ? 140 - d : 320 - d);
    if (ph < 0.3) rain(c, t, 26, '#6fb6ff', top, { speed: 0.6 });
    else if (ph >= 0.5 && ph < 0.8) rain(c, t, 26, '#ff9a4a', top, { speed: 0.6, seed: 5 });
    else for (let i = 0; i < 30; i++) { const x = fr(rnd(i, 6) + t * 0.9) * IW, y = 50 + rnd(i, 7) * 250; c.strokeStyle = '#8a8580'; c.lineWidth = 2; c.globalAlpha = 0.7; c.beginPath(); c.moveTo(x - 22, y); c.lineTo(x, y); c.stroke(); c.globalAlpha = 1; }
    frame(c, 'ALD · ONE ATOMIC LAYER PER CYCLE', `CYCLE ${Math.min(N, n + 1)}/${N} · ${name} · CONFORMAL`);
  },
  sd(c, pr, t) {
    const GX = [[70, 150], [280, 360], [490, 570]], POCK = [[162, 268, C.epiP, 'p · SiGe:B'], [372, 478, C.epiN, 'n · Si:P']];
    R(c, 0, 330, IW, 90, C.si);
    for (const [a, b] of GX) {
      R(c, a - 12, 120, b - a + 24, 130, C.nit); R(c, a, 120, b - a, 130, C.poly); R(c, a - 12, 96, b - a + 24, 24, C.hm);
      R(c, a - 12, 250, b - a + 24, 80, C.sige);
      for (const y of [262, 290, 318]) R(c, a - 12, y - 6, b - a + 24, 12, C.sheet);
      for (const y of [250, 276, 304]) { R(c, a - 12, y, 12, 6, C.nit); R(c, b, y, 12, 6, C.nit); }
    }
    for (const [a, b, col, name] of POCK) {
      R(c, a, 250, b - a, 96, C.bg);
      const h = 118 * pr; R(c, a, 346 - h, b - a, h, col);
      c.font = '16px "JetBrains Mono", monospace'; c.fillStyle = col; c.textAlign = 'center'; c.fillText(name, (a + b) / 2, 64); c.textAlign = 'left';
    }
    const inP = (x) => POCK.find(([a, b]) => x > a && x < b);
    for (let i = 0; i < 30; i++) {
      const x = rnd(i, 1) * IW, p = inP(x), ph = fr(t * 0.32 * (0.7 + 0.6 * rnd(i, 2)) + rnd(i, 3));
      if (p) dot(c, x, 84 + ph * (346 - 118 * pr - 84), 5, p[2]);
      else { const q = ph < 0.6 ? ph / 0.6 : 1 - (ph - 0.6) / 0.4; dot(c, x + (ph > 0.6 ? (ph - 0.6) * 90 : 0), 84 + q * 8, 4, '#8a8580', 0.8); } // no growth on dielectric: molecules leave
    }
    frame(c, 'SELECTIVE EPITAXY', 'GROWS ONLY ON EXPOSED SILICON, NOT ON DIELECTRIC');
  },
  hk(c, pr, t) {
    const SH = [[220, 120], [220, 195], [220, 270]], first = pr < 0.55, n = first ? Math.min(5, Math.floor((pr / 0.55) * 5) + 1) : 5, d1 = n * 2.2, d2 = first ? 0 : ((pr - 0.55) / 0.45) * 62;
    R(c, 0, 345, IW, 75, C.ox); R(c, 0, 34, 110, 311, C.nit); R(c, 530, 34, 110, 311, C.nit);
    c.save(); c.beginPath(); c.rect(110, 34, 420, 311); c.clip();
    if (d2 > 0) { R(c, 110, 34, d1 + d2, 311, C.gate); R(c, 530 - d1 - d2, 34, d1 + d2, 311, C.gate); R(c, 110, 345 - d1 - d2, 420, d1 + d2, C.gate); for (const [x, y] of SH) R(c, x - d1 - d2, y - d1 - d2, 200 + 2 * (d1 + d2), 30 + 2 * (d1 + d2), C.gate); }
    R(c, 110, 34, d1, 311, C.hk); R(c, 530 - d1, 34, d1, 311, C.hk); R(c, 110, 345 - d1, 420, d1, C.hk);
    for (const [x, y] of SH) { R(c, x - d1, y - d1, 200 + 2 * d1, 30 + 2 * d1, C.hk); R(c, x, y, 200, 30, C.sheet); }
    c.restore();
    const pulse = fr(t * 0.5) < 0.5;
    if (pr < 0.97) for (let i = 0; i < 30; i++) { const x = 120 + rnd(i, 1) * 400, y = 50 + fr(rnd(i, 2) + t * 0.25) * 280 + Math.sin(t * 2 + i) * 6; dot(c, x + Math.sin(t * 1.3 + i * 2) * 14, y, 4, pulse ? (first ? C.hk : C.gate) : '#6fb6ff', 0.85); }
    frame(c, 'ALD AROUND SUSPENDED SHEETS', first ? `HfO₂ HIGH-k · MONOLAYER ${n}/5` : 'WORK-FUNCTION METAL FILLS THE GAPS');
  },
};

// ---------------------------------------------------------------- etch
const ions = (c, t, top, o = {}) => rain(c, t, 30, '#ffd0ff', top, { y0: 104, speed: 0.9, tail: 20, ...o });
function sheath(c) { c.strokeStyle = C.dim; c.setLineDash([6, 6]); c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, 104); c.lineTo(IW, 104); c.stroke(); c.setLineDash([]); c.font = '14px "JetBrains Mono", monospace'; c.fillStyle = C.dim; c.fillText('SHEATH · IONS ACCELERATE', 14, 84); }
const ETCH = {
  rie(c, pr, t) {
    const dep = 170 * pr, open = (x) => x > 270 && x < 370;
    R(c, 0, 200, IW, 220, C.si); R(c, 0, 178, IW, 22, C.hm); R(c, 270, 178, 100, 22 + dep, C.bg);
    plasma(c, '#c86bff'); sheath(c);
    ions(c, t, (x) => (open(x) ? 200 + dep : 178));
    exhaust(c, t, 12, '#ffd9a0', () => 200 + dep, { x0: 280, x1: 360 });
    frame(c, 'REACTIVE ION ETCH', `ANISOTROPIC · ${(dep * 0.6).toFixed(0)} nm DEEP · VERTICAL WALLS`);
  },
  gate(c, pr, t) {
    const L = [[110, 190], [280, 360], [450, 530]], dep = 152 * pr, line = (x) => L.some(([a, b]) => x > a && x < b);
    R(c, 0, 330, IW, 90, C.si); R(c, 0, 322, IW, 8, C.ox); R(c, 0, 170, IW, 152, C.poly);
    for (let x = 0; x < IW; x += 2) if (!line(x)) R(c, x, 170, 2, dep, C.bg);
    for (const [a, b] of L) R(c, a, 140, b - a, 30, C.hm);
    plasma(c, '#5fd0ff'); sheath(c);
    ions(c, t, (x) => (line(x) ? 140 : 170 + dep));
    exhaust(c, t, 16, '#ffd9a0', () => 170 + dep);
    frame(c, 'GATE ETCH · HBr / Cl₂', pr > 0.97 ? 'STOPS ON THE THIN GATE OXIDE' : 'MASK PATTERN TRANSFERRED INTO POLY-Si');
  },
  iso(c, pr, t) {
    const half = 120 * (1 - pr);
    R(c, 0, 345, IW, 75, C.si); R(c, 0, 34, 150, 311, C.nit); R(c, 490, 34, 150, 311, C.nit);
    for (const y of [150, 220, 290]) if (half > 0.5) R(c, 320 - half, y, 2 * half, y === 290 ? 55 : 30, C.sige);
    for (const y of [110, 180, 250]) R(c, 200, y, 240, 40, C.sheet);
    plasma(c, '#7dffb0', 34, 44, 'REMOTE PLASMA · RADICALS ONLY');
    for (let i = 0; i < 46; i++) { const x = 160 + rnd(i, 1) * 320 + Math.sin(t * 0.9 + i * 1.7) * 40, y = 90 + rnd(i, 2) * 250 + Math.cos(t * 1.1 + i * 2.3) * 30; if (x > 155 && x < 485) dot(c, x, y, 3.6, '#7dffb0', 0.85); }
    frame(c, 'CHANNEL RELEASE · ISOTROPIC', pr > 0.97 ? 'Si SHEETS LEFT SUSPENDED' : 'SiGe ETCHES SIDEWAYS, Si BARELY AT ALL');
  },
  hole(c, pr, t) {
    const H = [[185, 215], [425, 455]], dep = 200 * pr, open = (x) => H.some(([a, b]) => x > a && x < b);
    R(c, 0, 350, IW, 70, C.si); R(c, 140, 310, 120, 40, C.epiP); R(c, 380, 310, 120, 40, C.epiN); R(c, 0, 110, IW, 200, C.ox); R(c, 0, 310, 140, 40, C.ox); R(c, 260, 310, 120, 40, C.ox); R(c, 500, 310, 140, 40, C.ox);
    R(c, 0, 90, IW, 20, C.hm);
    for (const [a, b] of H) { c.fillStyle = C.bg; c.beginPath(); c.moveTo(a, 90); c.lineTo(b, 90); c.lineTo(b - 3 * pr, 110 + dep); c.lineTo(a + 3 * pr, 110 + dep); c.closePath(); c.fill(); }
    plasma(c, '#ff6b9d', 34, 50);
    rain(c, t, 40, '#ffd0ff', (x) => (open(x) ? 110 + dep : 90), { y0: 60, speed: 0.9, tail: 18 });
    frame(c, 'CONTACT ETCH · HIGH ASPECT RATIO', pr > 0.97 ? 'LANDS ON THE SOURCE/DRAIN EPI' : `ASPECT RATIO ${(dep / 30).toFixed(1)} : 1`);
  },
};

// ---------------------------------------------------------------- CMP
function polish(c, pr, t, { under, orig, y0, y1, col, title, cap, slurry = '#e8f0ff' }) {
  const yP = y0 + (y1 - y0) * pr;
  c.fillStyle = col; c.beginPath(); c.moveTo(0, IH);
  for (let x = 0; x <= IW; x += 2) c.lineTo(x, Math.max(orig(x), yP));
  c.lineTo(IW, IH); c.closePath(); c.fill();
  under(c);
  // pad pressed onto the high spots, moving sideways, with slurry abrasive in the gap
  R(c, 0, yP - 70, IW, 64, C.pad);
  c.strokeStyle = '#a79f8c'; c.lineWidth = 3; for (let x = -40 + ((t * 120) % 40); x < IW; x += 40) { c.beginPath(); c.moveTo(x, yP - 70); c.lineTo(x + 26, yP - 6); c.stroke(); }
  for (let i = 0; i < 40; i++) { const x = fr(rnd(i, 1) + t * 0.25) * IW, lo = Math.max(orig(x), yP); dot(c, x, yP - 3 + rnd(i, 2) * Math.max(0, lo - yP), 3, slurry, 0.9); }
  frame(c, title, cap(yP));
}
const blocks = (L) => (x) => L.some(([a, b]) => x > a && x < b);
const CMP = {
  cmp0(c, pr, t) {
    const on = blocks([[120, 220], [300, 400], [480, 580]]);
    polish(c, pr, t, { col: C.ox, y0: 150, y1: 235, orig: (x) => (on(x) ? 150 : 230), title: 'CMP · HIGH SPOTS POLISH FASTER',
      under: (c2) => { R(c2, 0, 330, IW, 90, C.si); for (const a of [120, 300, 480]) R(c2, a, 250, 100, 80, C.poly); },
      cap: (y) => `STEP HEIGHT ${(Math.max(0, 230 - y) * 0.5).toFixed(0)} nm → FLAT` });
  },
  sti(c, pr, t) {
    const on = blocks([[130, 210], [280, 360], [430, 510]]);
    polish(c, pr, t, { col: C.ox, y0: 120, y1: 185, orig: (x) => (on(x) ? 120 : 160), title: 'ISOLATION OXIDE CMP',
      under: (c2) => { R(c2, 0, 330, IW, 90, C.si); for (const a of [140, 290, 440]) { R(c2, a, 200, 60, 130, C.si); R(c2, a, 185, 60, 15, C.nit); } },
      cap: () => (pr > 0.95 ? 'STOPS ON THE NITRIDE CAP' : 'REMOVING OXIDE OVERBURDEN') });
  },
  poc(c, pr, t) {
    const on = blocks([[100, 200], [270, 370], [440, 540]]);
    polish(c, pr, t, { col: C.ox, y0: 110, y1: 170, orig: (x) => (on(x) ? 110 : 150), title: 'INTERLAYER OXIDE CMP',
      under: (c2) => { R(c2, 0, 330, IW, 90, C.si); for (const a of [110, 280, 450]) { R(c2, a - 10, 170, 100, 160, C.nit); R(c2, a, 170, 80, 160, C.poly); } },
      cap: () => (pr > 0.95 ? 'POLY GATE TOPS EXPOSED, READY TO REMOVE' : 'POLISHING DOWN TO THE DUMMY GATES') });
  },
  cu(c, pr, t) {
    const tr = blocks([[120, 200], [280, 360], [440, 520]]);
    polish(c, pr, t, { col: C.cu, y0: 150, y1: 200, slurry: '#9fd0ff', orig: (x) => (tr(x) ? 172 : 150), title: 'COPPER DAMASCENE CMP',
      under: (c2) => { for (let x = 0; x < IW; x += 2) R(c2, x, tr(x) ? 290 : 200, 2, 220, C.lowk); R(c2, 0, 380, IW, 40, C.si); },
      cap: () => (pr > 0.95 ? 'COPPER LEFT ONLY IN THE TRENCHES' : 'REMOVING COPPER OVERBURDEN') });
  },
};

export const VARIANTS = { dep: Object.keys(DEP), etch: Object.keys(ETCH), cmp: Object.keys(CMP) };
const ALL = { dep: DEP, etch: ETCH, cmp: CMP };
export function drawInset(ctx, tool, variant, pr, t) {
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, IW, IH);
  (ALL[tool][variant] || ALL[tool][VARIANTS[tool][0]])(ctx, cl(pr), t);
}
