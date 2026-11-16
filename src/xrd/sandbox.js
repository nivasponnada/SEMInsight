// Virtual diffractometer: simulated powder pattern with indexing and a Williamson–Hall analysis.
import { ANODES, MATERIALS, pattern, instFWHM } from './physics.js';
import { buildPanel, statusHTML } from '../core/panel.js';

const DEFAULT = { mat: 'Si', anode: 'Cu', filter: 'on', L: 60, eps: 0.0005, strain: 0, disp: 0, time: 0.5 };
const rad = Math.PI / 180;

/** Draw a diffractogram. data: result of pattern(); upto: reveal limit in 2θ. */
export function drawPattern(canvas, data, { upto = 1e9, labels = true, color = '#b08cff', bg = '#151413', sqrt = true } = {}) {
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height, s = w / 640;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const m = { l: 46 * s, r: 12 * s, t: 26 * s, b: 30 * s }, pw = w - m.l - m.r, ph = h - m.t - m.b;
  const { x, y, peaks } = data, x0 = x[0], x1 = x[x.length - 1];
  let mx = 0; for (let i = 0; i < y.length; i++) if (y[i] > mx) mx = y[i]; mx *= 1.08;
  const X = (v) => m.l + ((v - x0) / (x1 - x0)) * pw, Y = (v) => m.t + ph - (sqrt ? Math.sqrt(Math.max(0, v) / mx) : v / mx) * ph;
  ctx.font = `${10 * s}px "JetBrains Mono", monospace`; ctx.lineWidth = 1;
  ctx.strokeStyle = '#45423f'; ctx.fillStyle = '#a09a93'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (let t = Math.ceil(x0 / 10) * 10; t <= x1; t += 10) { ctx.beginPath(); ctx.moveTo(X(t), m.t); ctx.lineTo(X(t), m.t + ph); ctx.stroke(); ctx.fillText(String(t), X(t), m.t + ph + 5 * s); }
  ctx.fillText('2θ [°]', m.l + pw / 2, h - 12 * s);
  ctx.save(); ctx.translate(12 * s, m.t + ph / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(sqrt ? '√counts' : 'counts', 0, 0); ctx.restore();
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(Math.round(mx / 1.08).toLocaleString('en-US'), m.l - 4 * s, Y(mx / 1.08));
  ctx.strokeStyle = '#a09a93'; ctx.strokeRect(m.l + 0.5, m.t + 0.5, pw, ph);
  ctx.strokeStyle = color; ctx.lineWidth = 1.2 * s; ctx.beginPath();
  const stride = Math.max(1, Math.floor(x.length / (pw * 1.5)));
  let pen = false;
  for (let i = 0; i < x.length; i += stride) {
    if (x[i] > upto) break;
    let v = 0; for (let k = i; k < Math.min(x.length, i + stride); k++) if (y[k] > v) v = y[k];
    const px = X(x[i]), py = Y(v); pen ? ctx.lineTo(px, py) : ctx.moveTo(px, py); pen = true;
  }
  ctx.stroke();
  if (labels) {
    ctx.fillStyle = '#f6f4f2'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.font = `${9.5 * s}px "JetBrains Mono", monospace`;
    let lastX = -99;
    for (const p of peaks) {
      if (p.pos > upto || p.I < 1.2) continue;
      const px = X(p.pos); if (px - lastX < 22 * s) continue; lastX = px;
      const i = Math.round((p.pos - x0) / (x[1] - x[0]));
      ctx.fillText(`${p.h}${p.k}${p.l}`, px, Math.max(m.t - 2 * s + 12 * s, Y(data.ideal[i] || 0) - 4 * s));
    }
  }
  if (upto < x1) { ctx.fillStyle = '#ffc730'; ctx.fillRect(X(Math.max(x0, upto)), m.t, 1.5 * s, ph); }
}

export class VirtualXRD {
  constructor(root) {
    this.st = { ...DEFAULT }; this.dirty = true; this.active = false;
    root.innerHTML = `
      <div class="vs-screen">
        <div class="vs-canvas-wrap"><canvas class="x-pat" width="1280" height="620" aria-label="Simulated diffractogram" style="display:block;width:100%;height:auto"></canvas></div>
        <div class="vs-two" style="margin-top:10px">
          <figure><canvas class="x-zoom" width="640" height="360"></canvas><figcaption>Strongest reflection, linear scale</figcaption></figure>
          <figure><canvas class="x-wh" width="640" height="360"></canvas><figcaption>Williamson–Hall plot of the fitted widths</figcaption></figure>
        </div>
        <div class="vs-status"></div>
      </div>
      <div class="vs-controls"></div>`;
    this.cPat = root.querySelector('.x-pat'); this.cZoom = root.querySelector('.x-zoom'); this.cWH = root.querySelector('.x-wh'); this.status = root.querySelector('.vs-status');
    const st = this.st;
    this.panel = buildPanel(root.querySelector('.vs-controls'), {
      segs: [
        { key: 'mat', label: 'Sample', opts: Object.entries(MATERIALS).map(([k]) => [k, k]), desc: (v) => `${MATERIALS[v].name}: ${MATERIALS[v].lattice}, a = ${MATERIALS[v].a.toFixed(4)} Å` },
        { key: 'anode', label: 'Anode', opts: Object.keys(ANODES).map((k) => [k, `${k} Kα`]) },
        { key: 'filter', label: 'Kβ filter', opts: [['on', 'In'], ['off', 'Out']] },
      ],
      sliders: [
        { key: 'L', label: 'Crystallite size', min: 2, max: 1000, log: true, fmt: (v) => `${v < 10 ? v.toFixed(1) : v.toFixed(0)} nm` },
        { key: 'eps', label: 'Microstrain', min: 0, max: 0.01, fmt: (v) => `${(v * 100).toFixed(2)} %` },
        { key: 'strain', label: 'Lattice strain', min: -0.01, max: 0.01, fmt: (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)} %` },
        { key: 'disp', label: 'Sample height error', min: -0.5, max: 0.5, fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)} mm` },
        { key: 'time', label: 'Time per step', min: 0.02, max: 10, log: true, fmt: (v) => (v < 1 ? `${(v * 1000).toFixed(0)} ms` : `${v.toFixed(1)} s`) },
      ],
      actions: [['nano', 'Nanocrystalline'], ['std', 'Standard powder'], ['reset', 'Reset']],
    }, st, () => { this.dirty = true; }, (a) => {
      if (a === 'nano') { st.L = 8; st.eps = 0.003; }
      if (a === 'std') { st.L = 1000; st.eps = 0; st.strain = 0; st.disp = 0; }
      if (a === 'reset') Object.assign(st, DEFAULT);
    });
    new IntersectionObserver((e) => { this.active = e[0].isIntersecting; }, { rootMargin: '200px' }).observe(root);
  }
  _compute() {
    const st = this.st, an = ANODES[st.anode];
    const d = (this.data = pattern({ ...st, filter: st.filter === 'on' }));
    this.dirty = false;
    drawPattern(this.cPat, d);
    const pk = d.peaks.slice().sort((a, b) => b.I - a.I)[0];
    // zoom on the strongest reflection
    {
      const c = this.cZoom, half = Math.max(0.5, pk.fwhm * 5), i0 = Math.max(0, Math.round((pk.pos - half - d.x[0]) / 0.02)), i1 = Math.min(d.x.length - 1, Math.round((pk.pos + half - d.x[0]) / 0.02));
      drawPattern(c, { x: d.x.subarray(i0, i1 + 1), y: d.y.subarray(i0, i1 + 1), ideal: d.ideal.subarray(i0, i1 + 1), peaks: [pk] }, { sqrt: false });
      const ctx = c.getContext('2d'); ctx.fillStyle = '#a09a93'; ctx.font = '19px "JetBrains Mono", monospace'; ctx.textAlign = 'left';
      ctx.fillText(`FWHM ${pk.fwhm.toFixed(3)}°`, 60, 60);
    }
    // Williamson–Hall: β cos θ against 4 sin θ after removing the instrument width
    const pts = d.peaks.filter((p) => p.I > 2).map((p) => {
      const inst = instFWHM(p.th), b = Math.max(1e-5, p.fwhm - (inst * inst) / p.fwhm) * rad; // parabolic correction
      return [4 * Math.sin(p.th), b * Math.cos(p.th)];
    });
    let sx = 0, sy = 0, sxx = 0, sxy = 0; for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
    const n = pts.length, slope = n > 1 ? (n * sxy - sx * sy) / (n * sxx - sx * sx) : 0, icpt = (sy - slope * sx) / n;
    const Lfit = icpt > 1e-6 ? (0.9 * an.ka1) / icpt / 10 : Infinity;
    {
      const c = this.cWH, ctx = c.getContext('2d'), w = c.width, h = c.height, m = { l: 70, r: 20, t: 24, b: 50 };
      ctx.fillStyle = '#151413'; ctx.fillRect(0, 0, w, h);
      const ymax = Math.max(1e-3, ...pts.map((p) => p[1])) * 1.25, X = (v) => m.l + (v / 4) * (w - m.l - m.r), Y = (v) => h - m.b - (v / ymax) * (h - m.t - m.b);
      ctx.strokeStyle = '#a09a93'; ctx.strokeRect(m.l + 0.5, m.t + 0.5, w - m.l - m.r, h - m.t - m.b);
      ctx.font = '18px "JetBrains Mono", monospace'; ctx.fillStyle = '#a09a93'; ctx.textAlign = 'center'; ctx.fillText('4 sin θ', w / 2, h - 14);
      ctx.save(); ctx.translate(22, h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('β cos θ', 0, 0); ctx.restore();
      ctx.textAlign = 'right'; ctx.fillText((ymax * 1e3).toFixed(1) + 'e-3', m.l - 6, m.t + 14); ctx.fillText('0', m.l - 6, h - m.b);
      ctx.strokeStyle = '#ffc730'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(0), Y(icpt)); ctx.lineTo(X(4), Y(icpt + slope * 4)); ctx.stroke();
      ctx.fillStyle = '#b08cff'; for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(X(x), Y(y), 5, 0, 7); ctx.fill(); }
    }
    const kb = d.peaks.length && st.filter === 'off';
    this.panel.readouts([
      ['Wavelength Kα₁', an.ka1.toFixed(5), 'Å'],
      [`Strongest: ${pk.h}${pk.k}${pk.l}`, pk.pos.toFixed(3), '° 2θ'],
      ['d-spacing', pk.d.toFixed(4), 'Å'],
      ['Observed FWHM', pk.fwhm.toFixed(3), '° 2θ'],
      ['Instrument FWHM', instFWHM(pk.th).toFixed(3), '° 2θ'],
      ['W–H size (true ' + (st.L < 10 ? st.L.toFixed(1) : st.L.toFixed(0)) + ' nm)', isFinite(Lfit) && Lfit < 5000 ? Lfit.toFixed(Lfit < 10 ? 1 : 0) : '> resolvable', isFinite(Lfit) && Lfit < 5000 ? 'nm' : ''],
      ['W–H strain (true ' + (st.eps * 100).toFixed(2) + ' %)', (Math.max(0, slope) * 100).toFixed(2), '%'],
      ['Reflections 10–120°', String(d.peaks.length), ''],
      ['Scan time', ((5500 * st.time) / 60).toFixed(0), 'min'],
    ]);
    const notes = [];
    if (d.fluo) notes.push(['warn', `${st.anode} Kα excites K-shell fluorescence in this sample: the background is ~10× higher. Use a Co anode or a monochromator.`]);
    if (kb) notes.push(['info', 'Without the filter every strong reflection has a Kβ satellite on its low-angle side.']);
    if (st.L > 200 && st.eps < 0.0003) notes.push(['info', 'Peaks are instrument-limited: sizes above ~150 nm cannot be measured from width.']);
    if (st.L < 5) notes.push(['info', 'Below ~5 nm neighbouring reflections merge: the pattern approaches that of an amorphous solid.']);
    if (Math.abs(st.disp) > 0.05) notes.push(['info', `Height error shifts peaks by −2s cos θ / R: ${(-(2 * st.disp * Math.cos(pk.th)) / 240 / rad).toFixed(3)}° at the strongest peak, vanishing towards 180°.`]);
    if (Math.abs(st.strain) > 0.0005) notes.push(['info', 'Uniform lattice strain moves every peak; the shift grows as tan θ, unlike a height error.']);
    if (st.anode === 'Mo') notes.push(['info', 'Mo Kα compresses the pattern to low angles: many more reflections, less angular resolution.']);
    if (!notes.length) notes.push(['ok', 'Kα₁/Kα₂ doublets resolve at high angle. Change size and strain and watch the Williamson–Hall line.']);
    this.status.innerHTML = statusHTML(notes);
  }
  tick() { if (this.active && this.dirty) this._compute(); }
}
