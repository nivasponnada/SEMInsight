// Virtual TEM: phase-object image simulation with a live contrast transfer function.
import { N, SPECIMENS, buildSpecimen, simulate, powerSpectrum, paint, optics, sigmaInt } from './sim.js';
import { buildPanel, statusHTML } from '../core/panel.js';
import { drawFnPlot } from '../plots.js';

const DEFAULT = { spec: 'au', mode: 'image', kV: 200, Cs: 1.0, df: -66, ap: 0, dose: 2000, mag: 1 };

export class VirtualTEM {
  constructor(root) {
    this.st = { ...DEFAULT }; this.dirty = true; this.active = false; this.last = 0;
    root.innerHTML = `
      <div class="vs-screen">
        <div class="vs-two">
          <figure><canvas class="t-img" width="512" height="512" aria-label="Simulated TEM image"></canvas><figcaption class="t-cap1">Image</figcaption></figure>
          <figure><canvas class="t-fft" width="512" height="512" aria-label="Diffractogram"></canvas><figcaption class="t-cap2">Diffractogram (FFT of image)</figcaption></figure>
        </div>
        <p class="vs-cap">Contrast transfer function</p>
        <canvas class="vs-plot t-ctf" style="height:150px"></canvas>
        <div class="vs-status"></div>
      </div>
      <div class="vs-controls"></div>`;
    this.cImg = root.querySelector('.t-img'); this.cFft = root.querySelector('.t-fft'); this.cCtf = root.querySelector('.t-ctf');
    this.cap1 = root.querySelector('.t-cap1'); this.cap2 = root.querySelector('.t-cap2'); this.status = root.querySelector('.vs-status');
    const st = this.st;
    this.panel = buildPanel(root.querySelector('.vs-controls'), {
      segs: [
        { key: 'spec', label: 'Specimen', opts: Object.entries(SPECIMENS).map(([k, s]) => [k, s.name]), desc: (v) => SPECIMENS[v].desc },
        { key: 'mode', label: 'Mode', opts: [['image', 'Bright field / HRTEM'], ['dark', 'Dark field'], ['diff', 'Diffraction']] },
        { key: 'kV', label: 'High tension', num: true, opts: [[80, '80 kV'], [200, '200 kV'], [300, '300 kV']] },
        { key: 'ap', label: 'Objective aperture', num: true, opts: [[0, 'Out'], [6, '6 nm⁻¹'], [3, '3 nm⁻¹'], [1.5, '1.5 nm⁻¹']] },
      ],
      sliders: [
        { key: 'df', label: 'Defocus', min: -300, max: 150, fmt: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)} nm` },
        { key: 'Cs', label: 'Spherical aberration', min: 0.001, max: 3, log: true, fmt: (v) => (v >= 0.1 ? `${v.toFixed(2)} mm` : `${(v * 1000).toFixed(0)} µm`) },
        { key: 'dose', label: 'Dose', min: 5, max: 1e5, log: true, fmt: (v) => `${v < 100 ? v.toFixed(0) : Math.round(v).toLocaleString('en-US')} e⁻/Å²` },
        { key: 'mag', label: 'Magnification', min: 0.5, max: 2, log: true, fmt: (v) => `${(v * 4.2).toFixed(1)} M×` },
      ],
      actions: [['scherzer', 'Scherzer focus'], ['gauss', 'Gaussian focus'], ['corr', 'Cs corrector'], ['reset', 'Reset']],
    }, st, (k) => { if (k === 'spec' || k === 'mag' || k === 'kV' || k === 'reset') this.specKey = ''; this.dirty = true; }, (a) => {
      const o = optics(st);
      if (a === 'scherzer') st.df = Math.max(-300, Math.round(o.scherzer));
      if (a === 'gauss') st.df = 0;
      if (a === 'corr') { st.Cs = 0.005; st.df = Math.round(optics(st).scherzer); }
      if (a === 'reset') Object.assign(st, DEFAULT);
    });
    new IntersectionObserver((e) => { this.active = e[0].isIntersecting; }, { rootMargin: '200px' }).observe(root);
  }
  _compute() {
    const st = this.st, px = SPECIMENS[st.spec].px / st.mag;
    const key = `${st.spec}|${px}|${st.kV}`;
    if (key !== this.specKey) { this.spec = buildSpecimen(st.spec, px, st.kV); this.specKey = key; }
    const dark = st.mode === 'dark';
    const ap = dark ? Math.max(1.2, st.ap || 1.5) : st.ap;
    this.res = simulate(this.spec, { kV: st.kV, Cs: st.Cs, df: st.df, aperture: ap, dark });
    this.ps = powerSpectrum(this.res.image);
    this.dirty = false;
    const o = this.res.op, nPix = st.dose * (px * 10) ** 2;
    this.nPix = nPix;
    this.cap1.textContent = st.mode === 'diff' ? 'Diffraction pattern (log)' : dark ? 'Dark-field image' : 'Image';
    this.cap2.textContent = st.mode === 'diff' ? 'Image' : 'Diffractogram (FFT of image)';
    this.panel.readouts([
      ['Wavelength', (o.lam * 1000).toFixed(2), 'pm'],
      ['Scherzer defocus', o.scherzer.toFixed(1), 'nm'],
      ['Point resolution', (o.dPoint * 1000).toFixed(0), 'pm'],
      ['Information limit', (o.dInfo * 1000).toFixed(0), 'pm'],
      ['Interaction constant σ', (sigmaInt(st.kV * 1000) * 1e3).toFixed(2), 'mrad/V·nm'],
      ['Pixel size', (px * 1000).toFixed(1), 'pm'],
      ['Field of view', (px * N).toFixed(1), 'nm'],
      ['Electrons / pixel', nPix < 10 ? nPix.toFixed(1) : Math.round(nPix).toLocaleString('en-US'), 'e⁻'],
    ]);
    const notes = [];
    const firstZero = Math.sqrt(Math.abs(st.df) > 1 ? 1 / (o.lam * Math.abs(st.df)) : 99);
    if (st.mode === 'image') {
      if (Math.abs(st.df - o.scherzer) < Math.max(6, Math.abs(o.scherzer) * 0.15)) notes.push(['ok', `At Scherzer defocus: one passband out to ${(o.dPoint * 1000).toFixed(0)} pm.`]);
      else if (st.df > 5) notes.push(['info', 'Overfocus: transfer changes sign at low frequency; contrast is weak and reversed.']);
      else if (st.df < o.scherzer * 2.2) notes.push(['info', `Strong underfocus: good low-frequency contrast, but the transfer oscillates beyond ${(1 / firstZero).toFixed(2)} nm and fringes delocalise.`]);
      else notes.push(['info', 'Phase contrast depends on defocus: sweep it and watch the rings in the diffractogram move.']);
      if (st.ap && st.ap < 4) notes.push(['info', `Aperture cuts spacings below ${(1 / st.ap).toFixed(2)} nm: lattice fringes vanish, mass–thickness contrast remains.`]);
    }
    if (dark) notes.push(['info', 'Aperture centred on the Au 111 beam (4.25 nm⁻¹): only particles diffracting into it are bright.']);
    if (st.mode === 'diff') notes.push(['info', 'Spots from crystals on a zone axis, diffuse rings from the amorphous film. The circle marks the objective aperture.']);
    if (nPix < 8) notes.push(['warn', 'Shot-noise limited: fewer than 8 electrons per pixel.']);
    if (st.kV === 300 && st.spec === 'si') notes.push(['info', '300 kV is above the knock-on threshold of silicon (~145 keV): expect damage in a real sample.']);
    this.status.innerHTML = statusHTML(notes);
    drawFnPlot(this.cCtf, {
      xl: 'q [nm⁻¹]', yl: 'sin χ · E', x: [0, 10], y: [-1.05, 1.05], n: 600,
      series: [{ f: (q) => o.ctf(q), c: '#8fe9ff' }, { f: (q) => o.env(q), c: 'dim', dash: [3, 3] }, { f: (q) => -o.env(q), c: 'dim', dash: [3, 3] }],
      hl: [{ y: 0, name: '' }], vl: [{ x: 1 / 0.2355, name: 'Au 111' }, { x: 1 / 0.2039, name: '200' }, ...(st.ap ? [{ x: st.ap, name: 'aperture' }] : [])],
    }, 0, {});
  }
  tick(now) {
    if (!this.active) return;
    if (this.dirty) { this._compute(); this.last = 0; }
    if (now - this.last < 140) return; // re-draw with fresh shot noise ~7 fps
    this.last = now;
    const st = this.st, r = this.res;
    const imgC = st.mode === 'diff' ? this.cFft : this.cImg, auxC = st.mode === 'diff' ? this.cImg : this.cFft;
    paint(imgC, r.image, { nPix: this.nPix });
    paint(auxC, st.mode === 'diff' ? r.dp : this.ps, { mode: 'log', gamma: st.mode === 'diff' ? 1 : 2, tint: st.mode === 'diff' ? [0.75, 1, 0.8] : [1, 1, 1] });
    const ap = st.mode === 'dark' ? Math.max(1.2, st.ap || 1.5) : st.ap;
    if (st.mode !== 'image' && ap) { // aperture outline on the diffraction pattern
      const c = (st.mode === 'diff' ? this.cImg : this.cFft).getContext('2d'), s = 512 / N / r.dq;
      if (st.mode === 'diff') { c.strokeStyle = '#ffc730'; c.lineWidth = 2; c.beginPath(); c.arc(256, 256, ap * s, 0, 7); c.stroke(); }
    }
  }
}

/** Small renders for the in-scene viewing screen. */
export function makeScreen() {
  const cache = {};
  const spec = (kind, px) => cache[kind + px] || (cache[kind + px] = buildSpecimen(kind, px, 200));
  return (canvas, mode, f = 0) => {
    const ctx = canvas.getContext('2d');
    let data, opts = { tint: [0.72, 1, 0.75] };
    if (mode === 'off') { ctx.fillStyle = '#0c120c'; ctx.fillRect(0, 0, canvas.width, canvas.height); return; }
    if (mode === 'diff') { data = simulate(spec('au', 0.03), { kV: 200, Cs: 1, df: -66 }).dp; opts = { mode: 'log', tint: [0.72, 1, 0.75] }; }
    else if (mode === 'bf') data = simulate(spec('au', 0.03), { kV: 200, Cs: 1, df: -120, aperture: 2.2 }).image;
    else if (mode === 'df') data = simulate(spec('au', 0.03), { kV: 200, Cs: 1, df: -66, aperture: 1.5, dark: true }).image;
    else if (mode === 'hr') data = simulate(spec('au', 0.03), { kV: 200, Cs: 1, df: 20 - 180 * f }).image;
    else if (mode === 'zoom') data = simulate(spec('au', 0.06 / (1 + 3 * f)), { kV: 200, Cs: 1, df: -66 }).image;
    else if (mode === 'dose') { data = simulate(spec('au', 0.03), { kV: 200, Cs: 1, df: -66 }).image; opts.nPix = 10 ** (0.5 + 4 * f) * 0.09; }
    paint(canvas, data, opts);
    // circular mask of the screen
    ctx.globalCompositeOperation = 'destination-in'; ctx.beginPath(); ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
  };
}
