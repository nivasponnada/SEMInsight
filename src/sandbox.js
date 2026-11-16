// Virtual SEM: controls + scan loop around the image model in sem-image.js.
import { W, H, SPECIMENS, APERTURES, buildGeometry, buildSignal, composeRows } from './sem-image.js';
import { fmtLen, fmtCurrent } from './physics.js';

const DEFAULT = { spec: 'chip', kV: 2, Ip: 50e-12, wd: 5, ap: 30, det: 'etd', dwell: 1e-6, frames: 1, mag: 25000, focus: 0, stig: 0, mode: 'hv' };
const DET_NAME = { etd: 'ETD', inlens: 'TLD', bse: 'BSE' };
const log = Math.log10;

// slider definitions: [key, label, min, max, toSlider, fromSlider, format]
const SLIDERS = [
  ['kV', 'Accelerating voltage', 0.5, 30, log, (v) => 10 ** v, (v) => `${v < 10 ? v.toFixed(2) : v.toFixed(1)} kV`],
  ['Ip', 'Probe current', 1e-12, 10e-9, log, (v) => 10 ** v, (v) => fmtCurrent(v).join(' ')],
  ['mag', 'Magnification', 300, 400000, log, (v) => 10 ** v, (v) => `${Math.round(v).toLocaleString('en-US')} ×`],
  ['wd', 'Working distance', 2, 20, (v) => v, (v) => v, (v) => `${v.toFixed(1)} mm`],
  ['dwell', 'Dwell time', 50e-9, 50e-6, log, (v) => 10 ** v, (v) => (v < 1e-6 ? `${(v * 1e9).toFixed(0)} ns` : `${(v * 1e6).toFixed(1)} µs`)],
  ['frames', 'Frame integration', 1, 64, Math.log2, (v) => Math.round(2 ** v), (v) => `${v} ×`],
  ['focus', 'Focus offset', -60, 60, (v) => Math.sign(v) * Math.sqrt(Math.abs(v)), (v) => Math.sign(v) * v * v, (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} µm`],
  ['stig', 'Astigmatism', -60, 60, (v) => Math.sign(v) * Math.sqrt(Math.abs(v)), (v) => Math.sign(v) * v * v, (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} µm`],
];

export class VirtualSEM {
  constructor(root) {
    this.root = root;
    this.st = { ...DEFAULT };
    this.centre = { x: 1600, y: 3100 };
    this.geomKey = ''; this.dirty = true; this.row = 0; this.active = false;
    this._dom();
    this.img = new ImageData(W, H);
    this.buf = document.createElement('canvas'); this.buf.width = W; this.buf.height = H;
    this.bctx = this.buf.getContext('2d');
    this.last = performance.now();
    new IntersectionObserver((e) => { this.active = e[0].isIntersecting; }, { rootMargin: '200px' }).observe(root);
  }

  _dom() {
    const r = this.root;
    const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`;
    r.innerHTML = `
      <div class="vs-screen">
        <div class="vs-canvas-wrap"><canvas class="vs-canvas" width="${W * 2}" height="${H * 2 + 56}" aria-label="Simulated SEM image"></canvas></div>
        <div class="vs-status"></div>
      </div>
      <div class="vs-controls">
        <div class="vs-group">
          <label class="lbl">Specimen</label>
          ${seg('spec', Object.entries(SPECIMENS).map(([k, s]) => [k, s.name]))}
          <p class="vs-desc"></p>
        </div>
        <div class="vs-group"><label class="lbl">Detector</label>${seg('det', [['etd', 'Everhart–Thornley SE'], ['inlens', 'In-lens SE'], ['bse', 'Annular BSE']])}</div>
        <div class="vs-group"><label class="lbl">Charge control</label>${seg('mode', [['hv', 'High vacuum, uncoated'], ['coat', 'Au/Pd coated'], ['lv', 'Low vacuum 60 Pa']])}</div>
        <div class="vs-group"><label class="lbl">Objective aperture</label>${seg('ap', APERTURES.map((a) => [a, `${a} µm`]))}</div>
        <div class="vs-sliders">
          ${SLIDERS.map(([k, label, mn, mx, to]) => `<div class="vs-slider"><div class="vs-row"><label class="lbl" for="vs-${k}">${label}</label><output data-out="${k}"></output></div><input id="vs-${k}" type="range" data-key="${k}" min="${to(mn)}" max="${to(mx)}" step="any"></div>`).join('')}
        </div>
        <div class="vs-actions">
          <button type="button" class="btn" data-act="auto">Auto focus + stig</button>
          <button type="button" class="btn" data-act="misalign">Detune</button>
          <button type="button" class="btn" data-act="reset">Reset</button>
          <button type="button" class="btn" data-act="save">Save image</button>
        </div>
        <div class="vs-readouts"></div>
      </div>`;
    this.canvas = r.querySelector('.vs-canvas'); this.ctx = this.canvas.getContext('2d');
    this.statusEl = r.querySelector('.vs-status'); this.readEl = r.querySelector('.vs-readouts'); this.descEl = r.querySelector('.vs-desc');
    r.querySelectorAll('.seg').forEach((s) => s.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const key = s.dataset.key; let v = b.dataset.v; if (key === 'ap') v = +v;
      if (key === 'spec' && v !== this.st.spec) { this.st.mag = SPECIMENS[v].mag; this.centre = v === 'chip' ? { x: 1600, y: 3100 } : { x: 5200, y: 4100 }; }
      this.st[key] = v; this._sync(); this.dirty = true;
    }));
    r.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', () => {
      const def = SLIDERS.find((s) => s[0] === inp.dataset.key);
      this.st[def[0]] = def[5](+inp.value); this._sync(true); this.dirty = true;
    }));
    r.querySelector('.vs-actions').addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.act; if (!a) return;
      if (a === 'auto') { this.st.focus = 0; this.st.stig = 0; }
      if (a === 'misalign') { this.st.focus = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 14); this.st.stig = (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 20); }
      if (a === 'reset') { this.st = { ...DEFAULT, spec: this.st.spec, mag: SPECIMENS[this.st.spec].mag }; }
      if (a === 'save') { const l = document.createElement('a'); l.download = `seminsight-${this.st.spec}-${this.st.kV.toFixed(1)}kV.png`; l.href = this.canvas.toDataURL('image/png'); l.click(); return; }
      this._sync(); this.dirty = true;
    });
    // drag to move the stage
    let drag = null;
    this.canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; this.canvas.setPointerCapture(e.pointerId); });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const px = this._px() * (W / this.canvas.clientWidth);
      this.centre.x -= (e.clientX - drag.x) * px; this.centre.y -= (e.clientY - drag.y) * px;
      drag = { x: e.clientX, y: e.clientY }; this.dirty = true;
    });
    const end = () => { drag = null; };
    this.canvas.addEventListener('pointerup', end); this.canvas.addEventListener('pointercancel', end);
    this._sync();
  }
  _sync(skipSliders) {
    const st = this.st, r = this.root;
    r.querySelectorAll('.seg').forEach((s) => s.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(String(st[s.dataset.key]) === b.dataset.v))));
    for (const [k, , , , to, , fmt] of SLIDERS) {
      if (!skipSliders) r.querySelector(`input[data-key=${k}]`).value = to(st[k]);
      r.querySelector(`[data-out=${k}]`).textContent = fmt(st[k]);
    }
    this.descEl.textContent = SPECIMENS[st.spec].desc;
  }
  _px() { return (127e6 / this.st.mag) / (W * 2); } // nm per model pixel (1024-px frame = 127 mm print)

  _rebuild() {
    const st = this.st, px = this._px();
    const key = `${st.spec}|${px}|${this.centre.x}|${this.centre.y}`;
    if (key !== this.geomKey) { this.geom = buildGeometry(st.spec, this.centre.x, this.centre.y, px); this.geomKey = key; }
    this.model = buildSignal(this.geom, st);
    this.dirty = false; this.row = 0; this.fresh = true;
    this._readouts();
  }
  _readouts() {
    const m = this.model, st = this.st, op = m.op;
    const px = m.px * 1e-9;
    const frameT = st.dwell * 1024 * 884 * st.frames;
    const dof = (2 * Math.max(px, op.d)) / op.alpha;
    const parts = [['source', op.dg], ['spherical', op.ds], ['chromatic', op.dc], ['diffraction', op.dd]];
    const mx = Math.max(...parts.map((p) => p[1]));
    const row = (l, v, u = '') => `<div class="ro"><span>${l}</span><b>${v}</b><i>${u}</i></div>`;
    this.readEl.innerHTML =
      row('Probe diameter', ...fmtLen(op.d)) +
      `<div class="bars">${parts.map(([n, v]) => `<div><span>${n}</span><em><u style="width:${(v / mx) * 100}%"></u></em><b>${fmtLen(v).join(' ')}</b></div>`).join('')}</div>` +
      row('Convergence α', (op.alpha * 1e3).toFixed(2), 'mrad') +
      row('Pixel size', ...fmtLen(px)) +
      row('Field width', ...fmtLen(px * 1024)) +
      row('Depth of field', ...fmtLen(dof)) +
      row('Electrons / pixel', m.nPrimary < 10 ? m.nPrimary.toFixed(1) : Math.round(m.nPrimary).toLocaleString('en-US'), 'e⁻') +
      row(`Range in ${m.dom.sym}`, ...fmtLen(m.rko * 1e-9)) +
      row('Frame time', frameT < 1 ? (frameT * 1e3).toFixed(0) : frameT.toFixed(1), frameT < 1 ? 'ms' : 's');
    const notes = [];
    if (m.qMean * m.charge > 0.015) notes.push(['warn', `Negative charging: σ(SiO₂) = ${m.sig.toFixed(2)} &lt; 1 at ${st.kV.toFixed(1)} keV. Lower the voltage towards E₂, coat, or use low vacuum.`]);
    if (st.det === 'bse' && st.kV < 2.5) notes.push(['warn', 'BSE diode starved: backscattered electrons below ~1.5 keV do not cross the dead layer.']);
    if (m.snr < 3) notes.push(['warn', 'Shot-noise limited: raise the current, dwell time or frame integration.']);
    if (op.d > 2.5 * px) notes.push(['info', `Empty magnification: the probe (${fmtLen(op.d).join(' ')}) spans ${(op.d / px).toFixed(1)} pixels.`]);
    if (Math.abs(st.focus) > 0.5 || Math.abs(st.stig) > 0.5) notes.push(['info', 'Out of focus / astigmatic: streaks rotate 90° through focus. Use Auto focus + stig.']);
    if (st.mode === 'lv') notes.push(['info', `Gas skirt: ${(op.scat * 100).toFixed(0)} % of the beam scattered out to ~${fmtLen(op.skirt).join(' ')}. SE imaging uses a gaseous detector.`]);
    if (st.det === 'inlens' && st.wd > 8) notes.push(['info', 'In-lens detector loses collection efficiency at long working distance.']);
    if (!notes.length) notes.push(['ok', 'Stable imaging conditions. Drag the image to move the stage.']);
    this.statusEl.innerHTML = notes.map(([c, t]) => `<p class="${c}">${t}</p>`).join('');
  }

  _databar() {
    const c = this.ctx, st = this.st, y0 = H * 2, w = W * 2;
    c.fillStyle = '#0d0d0d'; c.fillRect(0, y0, w, 56);
    c.strokeStyle = '#555'; c.lineWidth = 1; c.strokeRect(0.5, y0 + 0.5, w - 1, 55);
    c.font = '500 17px "JetBrains Mono", monospace'; c.textBaseline = 'middle';
    const cells = [['HV', `${st.kV.toFixed(2)} kV`], ['curr', fmtCurrent(st.Ip).join(' ')], ['WD', `${st.wd.toFixed(1)} mm`], ['mag', `${Math.round(st.mag).toLocaleString('en-US')} x`], ['det', st.mode === 'lv' && st.det !== 'bse' ? 'GSED' : DET_NAME[st.det]], ['HFW', fmtLen(this._px() * 1e-9 * 1024).join(' ')]];
    const cw = 126;
    cells.forEach(([k, v], i) => {
      const x = i * cw;
      c.strokeStyle = '#555'; c.beginPath(); c.moveTo(x + cw + 0.5, y0); c.lineTo(x + cw + 0.5, y0 + 56); c.stroke();
      c.fillStyle = '#9a9a9a'; c.textAlign = 'center'; c.fillText(k, x + cw / 2, y0 + 17);
      c.fillStyle = '#fff'; c.fillText(v, x + cw / 2, y0 + 39);
    });
    // scale bar: 1-2-5 length nearest to ~18% of the field
    const nmPerPx = this._px() / 1; // model pixel; canvas shows 2 px per model px
    const target = nmPerPx * W * 0.2, p10 = 10 ** Math.floor(log(target));
    const len = [1, 2, 5, 10].map((m) => m * p10).reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));
    const bw = (len / nmPerPx) * 2, bx = cells.length * cw + (w - cells.length * cw - bw) / 2;
    c.fillStyle = '#fff'; c.fillRect(bx, y0 + 34, bw, 5); c.fillRect(bx, y0 + 28, 2, 16); c.fillRect(bx + bw - 2, y0 + 28, 2, 16);
    c.textAlign = 'center'; c.fillText(fmtLen(len * 1e-9, 1).join(' ').replace('.0', ''), bx + bw / 2, y0 + 15);
  }

  /** Advance the scan; called every animation frame. */
  tick(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    if (!this.active) return;
    if (this.dirty) this._rebuild();
    const st = this.st;
    const frameT = st.dwell * 1024 * 884 * st.frames;
    const T = this.fresh ? Math.min(0.45, Math.max(0.12, frameT)) : Math.min(6, Math.max(0.25, frameT));
    const rows = Math.max(1, Math.round((dt / T) * H));
    const j1 = Math.min(H, this.row + rows);
    composeRows(this.model, this.img, this.row, j1);
    this.row = j1;
    if (this.row >= H) { this.row = 0; this.fresh = false; }
    this.bctx.putImageData(this.img, 0, 0);
    this.ctx.imageSmoothingEnabled = true; this.ctx.imageSmoothingQuality = 'high';
    this.ctx.drawImage(this.buf, 0, 0, W * 2, H * 2);
    if (!this.fresh && this.row > 0) { // scan line cursor
      this.ctx.fillStyle = 'rgba(255,255,255,.35)'; this.ctx.fillRect(0, this.row * 2, W * 2, 1);
    }
    this._databar();
  }
}

/** A fixed demonstration image for the in-scene display (stage 15). */
export function makeDemo() {
  const g = buildGeometry('chip', 1600, 3100, 127e6 / 22000 / 1024);
  const base = { ...DEFAULT, mag: 22000 };
  const models = [1, 4, 16, 64].map((frames) => buildSignal(g, { ...base, dwell: 100e-9, Ip: 25e-12, frames }));
  const img = new ImageData(W, H);
  return {
    /** f in 0..1: the frame scans in during the first part, then integrates. */
    draw(canvas, f) {
      const ctx = canvas.getContext('2d');
      const reveal = Math.min(1, f / 0.35);
      const mi = f < 0.35 ? 0 : Math.min(3, 1 + Math.floor(((f - 0.35) / 0.65) * 3.2));
      composeRows(models[mi], img, 0, Math.max(1, Math.round(H * reveal)));
      ctx.fillStyle = '#060606'; ctx.fillRect(0, 0, W, H);
      ctx.putImageData(img, 0, 0, 0, 0, W, Math.round(H * reveal));
      if (reveal < 1) { ctx.fillStyle = '#b7ff54'; ctx.fillRect(0, Math.round(H * reveal), W, 2); }
      return [1, 4, 16, 64][mi];
    },
  };
}
