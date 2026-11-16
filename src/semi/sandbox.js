// Virtual probe station: resistivity & Hall, MOS C–V, and p–n junction I–V on silicon.
import { Q, ES, vt, ni, muN, muP, mobility, resistivity, mosCV, interp, diode, sci } from './physics.js';
import { buildPanel, statusHTML } from '../core/panel.js';
import { drawFnPlot } from '../plots.js';

const logfmt = (u) => (v) => `${sci(v)} ${u}`;
const TYPE = { key: 'type', label: 'Substrate', opts: [['p', 'p-type (boron)'], ['n', 'n-type (phosphorus)']] };
const SPEC = {
  res: {
    segs: [TYPE],
    sliders: [
      { key: 'N', label: 'Doping', min: 1e13, max: 1e20, log: true, fmt: logfmt('cm⁻³') },
      { key: 't', label: 'Layer thickness', min: 0.05, max: 700, log: true, fmt: (v) => `${v < 10 ? v.toFixed(2) : v.toFixed(0)} µm` },
      { key: 'I', label: 'Probe current', min: 1e-6, max: 1e-1, log: true, fmt: (v) => (v < 1e-3 ? `${(v * 1e6).toFixed(0)} µA` : `${(v * 1e3).toFixed(1)} mA`) },
      { key: 'B', label: 'Magnetic field', min: 0.05, max: 2, fmt: (v) => `${v.toFixed(2)} T` },
    ],
  },
  cv: {
    segs: [TYPE],
    sliders: [
      { key: 'N', label: 'Doping', min: 1e14, max: 3e18, log: true, fmt: logfmt('cm⁻³') },
      { key: 'tox', label: 'Oxide thickness', min: 1.5, max: 100, log: true, fmt: (v) => `${v.toFixed(1)} nm` },
      { key: 'Qf', label: 'Fixed oxide charge', min: 1e9, max: 5e12, log: true, fmt: logfmt('cm⁻²') },
      { key: 'Dit', label: 'Interface traps', min: 1e9, max: 5e12, log: true, fmt: logfmt('cm⁻²eV⁻¹') },
      { key: 'T', label: 'Temperature', min: 200, max: 450, fmt: (v) => `${v.toFixed(0)} K` },
    ],
  },
  iv: {
    segs: [],
    sliders: [
      { key: 'Na', label: 'p-side doping', min: 1e15, max: 1e19, log: true, fmt: logfmt('cm⁻³') },
      { key: 'Nd', label: 'n-side doping', min: 1e14, max: 1e18, log: true, fmt: logfmt('cm⁻³') },
      { key: 'tau', label: 'Carrier lifetime', min: 1e-9, max: 1e-3, log: true, fmt: (v) => (v < 1e-6 ? `${(v * 1e9).toFixed(0)} ns` : v < 1e-3 ? `${(v * 1e6).toFixed(1)} µs` : `${(v * 1e3).toFixed(1)} ms`) },
      { key: 'Rs', label: 'Series resistance', min: 0.01, max: 1000, log: true, fmt: (v) => `${v < 10 ? v.toFixed(2) : v.toFixed(0)} Ω` },
      { key: 'T', label: 'Temperature', min: 200, max: 450, fmt: (v) => `${v.toFixed(0)} K` },
    ],
  },
};
const DEFAULT = { tool: 'cv', type: 'p', N: 1e16, t: 0.5, I: 1e-3, B: 0.5, tox: 10, Qf: 5e10, Dit: 1e10, T: 300, Na: 1e17, Nd: 1e15, tau: 1e-6, Rs: 2 };

export class VirtualProbe {
  constructor(root) {
    this.st = { ...DEFAULT }; this.dirty = true; this.active = false;
    root.innerHTML = `
      <div class="vs-screen">
        <div class="seg vp-tools" style="margin-bottom:12px"><button type="button" data-v="res">Four-point probe + Hall</button><button type="button" data-v="cv">MOS capacitor C–V</button><button type="button" data-v="iv">p–n junction I–V</button></div>
        <p class="vs-cap vp-t1"></p><canvas class="vs-plot vp-a" style="height:300px"></canvas>
        <p class="vs-cap vp-t2" style="margin-top:10px"></p><canvas class="vs-plot vp-b" style="height:190px"></canvas>
        <div class="vs-status"></div>
      </div>
      <div class="vs-controls"><div class="vp-panel" style="display:grid;gap:18px"></div></div>`;
    this.cA = root.querySelector('.vp-a'); this.cB = root.querySelector('.vp-b'); this.t1 = root.querySelector('.vp-t1'); this.t2 = root.querySelector('.vp-t2');
    this.status = root.querySelector('.vs-status'); this.pEl = root.querySelector('.vp-panel'); this.tools = root.querySelector('.vp-tools');
    this.tools.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; this.st.tool = b.dataset.v; this._panel(); this.dirty = true; });
    this._panel();
    new IntersectionObserver((e) => { this.active = e[0].isIntersecting; }, { rootMargin: '200px' }).observe(root);
    addEventListener('resize', () => { this.dirty = true; });
  }
  _panel() {
    const st = this.st;
    this.tools.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === st.tool)));
    if (st.tool === 'cv') st.N = Math.min(3e18, Math.max(1e14, st.N));
    this.panel = buildPanel(this.pEl, { ...SPEC[st.tool], actions: [['reset', 'Reset']] }, st, () => { this.dirty = true; }, () => { const tool = st.tool; Object.assign(st, DEFAULT, { tool }); });
  }
  _compute() {
    this.dirty = false;
    const st = this.st, notes = [];
    if (st.tool === 'res') {
      const rho = resistivity(st.N, st.type), mu = mobility(st.N, st.type), t = st.t * 1e-4, Rs = rho / t;
      const thin = st.t < 500; // probe spacing 1 mm
      const V = thin ? (Rs * st.I) / 4.532 : (rho * st.I) / (2 * Math.PI * 0.1);
      const VH = ((st.I * st.B * 1e-8) / (Q * st.N * t)) * (st.type === 'n' ? -1 : 1); // B in T -> V·s/cm²
      this.t1.textContent = 'Resistivity of silicon vs doping'; this.t2.textContent = 'Hall voltage vs magnetic field';
      drawFnPlot(this.cA, { xl: 'N [cm⁻³]', yl: 'ρ [Ω·cm]', lx: true, ly: true, x: [1e13, 1e20], y: [1e-4, 1e4], series: [{ f: (N) => resistivity(N, 'p'), c: st.type === 'p' ? '#18ff92' : 'dim', name: 'p-type', lx: 1e17 }, { f: (N) => resistivity(N, 'n'), c: st.type === 'n' ? '#18ff92' : 'dim', name: 'n-type', lx: 3e13 }], mark: () => st.N, markSeries: st.type === 'p' ? 0 : 1 }, 0, {});
      const vmax = Math.abs(((st.I * 2 * 1e-8) / (Q * st.N * t))) * 1.1;
      drawFnPlot(this.cB, { xl: 'B [T]', yl: 'V_H [V]', x: [0, 2], y: st.type === 'n' ? [-vmax, vmax * 0.1] : [-vmax * 0.1, vmax], series: [{ f: (B) => ((st.I * B * 1e-8) / (Q * st.N * t)) * (st.type === 'n' ? -1 : 1), c: '#18ff92' }], hl: [{ y: 0, name: '' }], mark: () => st.B }, 0, {});
      this.panel.readouts([
        ['Resistivity', rho >= 1 ? rho.toFixed(2) : sci(rho, 2), 'Ω·cm'], ['Mobility', mu.toFixed(0), 'cm²/Vs'], ['Sheet resistance', Rs >= 1 ? Rs.toFixed(1) : sci(Rs, 2), 'Ω/□'],
        ['4PP voltage', Math.abs(V) >= 1e-3 ? (V * 1e3).toFixed(2) : (V * 1e6).toFixed(1), Math.abs(V) >= 1e-3 ? 'mV' : 'µV'], ['Formula used', thin ? 'thin sheet' : 'semi-infinite', ''],
        ['Hall voltage', Math.abs(VH) >= 1e-3 ? (VH * 1e3).toFixed(2) : (VH * 1e6).toFixed(2), Math.abs(VH) >= 1e-3 ? 'mV' : 'µV'], ['Hall coefficient', sci((st.type === 'n' ? -1 : 1) / (Q * st.N)), 'cm³/C'],
      ]);
      if (Math.abs(VH) < 2e-6) notes.push(['warn', 'Hall voltage below ~2 µV: thermoelectric offsets dominate. Use a thinner layer, more current or field reversal.']);
      if (V > 5) notes.push(['warn', 'Over 5 V across the sense probes: reduce the current to avoid heating and minority-carrier injection.']);
      if (st.N > 3e19) notes.push(['info', 'Degenerate doping: mobility is nearly constant, so resistivity falls almost as 1/N.']);
      if (!notes.length) notes.push(['ok', `Positive Hall voltage for holes, negative for electrons. Here: ${st.type}-type.`]);
    } else if (st.tool === 'cv') {
      const c = mosCV(st), s = st.type === 'n' ? -1 : 1;
      const lo = Math.min(c.Vfb, c.Vt) - 2.5, hi = Math.max(c.Vfb, c.Vt) + 2.5;
      const hf = (V) => interp(c.V, c.Chf, V), lf = (V) => interp(c.V, c.Clf, V);
      const ideal = mosCV({ ...st, Qf: 0, Dit: 0 });
      this.t1.textContent = 'Capacitance–voltage'; this.t2.textContent = '1/C² against bias: the slope gives the doping';
      drawFnPlot(this.cA, { xl: 'gate bias [V]', yl: 'C / Cox', x: [lo, hi], y: [0, 1.08], n: 400, series: [{ f: hf, c: '#18ff92', w: 2, name: 'high frequency', lx: lo + 0.2 }, { f: lf, c: '#ffc730', dash: [5, 3], name: 'quasi-static', lx: hi - 1.6 }, { f: (V) => interp(ideal.V, ideal.Chf, V), c: 'dim', dash: [2, 3], name: 'ideal', lx: (lo + hi) / 2 + 0.3 }], vl: [{ x: c.Vfb, name: 'V FB' }, { x: c.Vt, name: 'V T' }] }, 0, {});
      const inv2 = (V) => 1 / hf(V) ** 2;
      drawFnPlot(this.cB, { xl: 'gate bias [V]', yl: '(Cox / C)²', x: [lo, hi], y: [0, 1.15 / c.Cmin ** 2], n: 300, series: [{ f: inv2, c: '#18ff92' }] }, 0, {});
      // doping extracted from the steepest part of 1/C²
      let best = 0; for (let V = lo; V < hi; V += 0.02) { const d = Math.abs(inv2(V + 0.02) - inv2(V)) / 0.02; if (d > best) best = d; }
      const Next = 2 / (Q * ES * (best / (c.Cox * c.Cox)));
      this.panel.readouts([
        ['C<sub>ox</sub>', (c.Cox * 1e9).toFixed(1), 'nF/cm²'], ['Flat-band voltage', c.Vfb.toFixed(3), 'V'], ['Threshold voltage', c.Vt.toFixed(3), 'V'],
        ['Max depletion width', (c.Wmax * 1e7).toFixed(0), 'nm'], ['C<sub>min</sub> / C<sub>ox</sub>', c.Cmin.toFixed(3), ''], ['Debye length', (c.LD * 1e7).toFixed(1), 'nm'],
        ['Doping from slope', sci(Next), 'cm⁻³'], ['V<sub>FB</sub> shift from Q<sub>f</sub>', (-(Q * st.Qf) / c.Cox * s * 1000).toFixed(0), 'mV'],
      ]);
      if (st.Dit > 3e11) notes.push(['warn', 'High interface-trap density: the curve is stretched out and the quasi-static minimum is shallower. Forming-gas anneal needed.']);
      if (st.Qf > 5e11) notes.push(['info', 'Positive fixed charge shifts the whole curve towards negative gate voltage.']);
      if (st.tox < 2.5) notes.push(['info', 'Below ~2.5 nm real oxides leak by direct tunnelling and quantum effects lower the measured capacitance; neither is modelled.']);
      if (st.T > 400) notes.push(['info', 'At high temperature minority carriers are generated fast enough to follow: real “high-frequency” curves start to rise in inversion.']);
      if (!notes.length) notes.push(['ok', 'Accumulation on one side, depletion in the middle, inversion on the other. Switch substrate type to mirror it.']);
    } else {
      const d = diode({ ...st, A: 1e-2 }), Vt = vt(st.T);
      this.t1.textContent = 'Forward current–voltage (log scale)'; this.t2.textContent = 'Local ideality factor n = (q/kT) · dV / d ln I';
      const imax = Math.max(1e-3, d.I(1.0));
      drawFnPlot(this.cA, { xl: 'V [V]', yl: 'I [A]', ly: true, x: [0, 1.0], y: [1e-14, Math.max(1, imax * 2)], n: 250, series: [{ f: (V) => d.I(V), c: '#18ff92', w: 2 }, { f: (V) => d.Is * Math.exp(V / Vt), c: 'dim', dash: [3, 3], name: 'ideal, n = 1', lx: 0.15 }] }, 0, {});
      const nl = (V) => 0.004 / (Vt * Math.log(d.I(V + 0.004) / d.I(V)));
      drawFnPlot(this.cB, { xl: 'V [V]', yl: 'n', x: [0.05, 1.0], y: [0.8, 4], n: 200, series: [{ f: nl, c: '#18ff92' }], hl: [{ y: 1, name: 'diffusion' }, { y: 2, name: 'recombination' }] }, 0, {});
      const von = (() => { for (let V = 0; V < 1.2; V += 0.005) if (d.I(V) > 1e-3) return V; return NaN; })();
      this.panel.readouts([
        ['Saturation current', sci(d.Is), 'A'], ['Built-in potential', d.Vbi.toFixed(3), 'V'], ['Depletion width (0 V)', (d.W0 * 1e4).toFixed(3), 'µm'],
        ['Diffusion length L<sub>n</sub>', (d.Ln * 1e4).toFixed(1), 'µm'], ['V at 1 mA', isNaN(von) ? '> 1.2' : von.toFixed(3), 'V'], ['n<sub>i</sub>', sci(ni(st.T)), 'cm⁻³'], ['Area', '1.0', 'mm²'],
      ]);
      if (st.tau < 1e-7) notes.push(['info', 'Short lifetime: recombination in the depletion layer dominates at low bias (n → 2) and leakage rises.']);
      if (st.Rs > 20) notes.push(['info', 'Series resistance bends the curve over at high current: the ideality appears to climb.']);
      if (st.T > 380) notes.push(['info', 'n<sub>i</sub>² grows steeply with temperature: saturation current rises ~15 % per kelvin and the turn-on voltage falls ~2 mV/K.']);
      if (!notes.length) notes.push(['ok', '60 mV per decade where n = 1. Vary lifetime and series resistance to see each end of the curve change.']);
    }
    this.status.innerHTML = statusHTML(notes);
  }
  tick() { if (this.active && this.dirty) this._compute(); }
}
