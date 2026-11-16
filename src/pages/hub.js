// Hub: "Characterisation techniques". Four modules, a comparison table and a question matrix.
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '../style.css';
import '../hub.css';
import { animate, stagger } from 'animejs';
import { MODULES } from '../core/modules.js';
import { pattern } from '../xrd/physics.js';
import { mosCV, interp } from '../semi/physics.js';

const FACTS = {
  sem: { probe: 'Focused electrons, 0.1–30 keV', signal: 'Secondary and backscattered electrons, X-rays', res: '0.5–5 nm', depth: '1 nm – 5 µm', sample: 'Bulk; conductive or coated', stages: 15, lab: 'Virtual SEM', gives: 'Topography, composition contrast, grain orientation' },
  tem: { probe: 'Electrons, 60–300 keV, through a foil', signal: 'Transmitted and diffracted electrons, energy loss, X-rays', res: '50–200 pm', depth: 'Foil thickness, < 100 nm', sample: 'Electron-transparent lamella', stages: 12, lab: 'Virtual TEM', gives: 'Atomic structure, defects, interfaces, local chemistry' },
  xrd: { probe: 'X-rays, Cu Kα 8.05 keV', signal: 'Bragg-diffracted X-rays', res: 'Averaged over mm²', depth: '1–100 µm', sample: 'Powder, bulk or thin film', stages: 10, lab: 'Virtual diffractometer', gives: 'Phase, lattice parameter, crystallite size, strain, texture' },
  semi: { probe: 'Currents, fields, photons, ions', signal: 'Voltage, current, capacitance, light, sputtered ions', res: 'µm to wafer scale', depth: 'nm (SIMS) to full wafer', sample: 'Wafer, test structure or device', stages: 10, lab: 'Virtual probe station', gives: 'Resistivity, carrier density and mobility, interface quality, film thickness, dopant profiles' },
};
// question → [technique key, strength (2 = primary, 1 = supporting), link, method]
const MATRIX = [
  ['What does the surface look like?', { sem: [2, 'sem.html#detectors', 'SE imaging'], tem: [1, 'tem.html#contrast', 'replica / cross-section'] }],
  ['Which phases are present?', { xrd: [2, 'xrd.html#analysis', 'search–match'], tem: [2, 'tem.html#diffraction', 'SAED'], sem: [1, 'sem.html#ebsd', 'EBSD'] }],
  ['How are the atoms arranged at a defect or interface?', { tem: [2, 'tem.html#hrtem', 'HRTEM / STEM'] }],
  ['How large are the crystallites?', { xrd: [2, 'xrd.html#profile', 'Scherrer'], tem: [2, 'tem.html#contrast', 'dark field'], sem: [1, 'sem.html#ebsd', 'EBSD map'] }],
  ['Which elements, and where?', { sem: [2, 'sem.html#detectors', 'EDS'], tem: [2, 'tem.html#spectroscopy', 'EELS / EDS'], semi: [2, 'semiconductor.html#sims', 'SIMS (trace)'] }],
  ['Is the lattice strained?', { xrd: [2, 'xrd.html#profile', 'peak shift / width'], semi: [2, 'semiconductor.html#raman', 'Raman'], tem: [1, 'tem.html#diffraction', 'CBED'] }],
  ['How thick is the film?', { semi: [2, 'semiconductor.html#ellipsometry', 'ellipsometry'], tem: [2, 'tem.html#projection', 'cross-section'], sem: [1, 'sem.html#image', 'cross-section'], xrd: [1, 'xrd.html#analysis', 'reflectivity'] }],
  ['How is it doped, and how do carriers move?', { semi: [2, 'semiconductor.html#hall', 'Hall, C–V, SIMS'] }],
  ['Are there electrically active defects?', { semi: [2, 'semiconductor.html#dlts', 'DLTS, PL'], sem: [1, 'sem.html#image', 'voltage contrast'] }],
];

document.body.insertAdjacentHTML('afterbegin', `
<header id="top" class="solid">
  <a class="logo" href="#hero" aria-label="Characterisation techniques home"><b>Insight</b> / Characterisation</a>
  <nav><a href="#modules">Techniques</a><a href="#compare">Compare</a><a href="#choose">Choose</a></nav>
</header>
<main class="hub">
  <section id="hero" class="hub-hero">
    <div class="hero-text">
      <p class="kicker hero-k">Materials &amp; device characterisation</p>
      <h1><span>Four ways</span> <span>to question</span> <span>a material.</span></h1>
      <p class="lede">Scroll-driven journeys through four families of instruments. Each follows the probe from its source to the final number, shows the physics with live readouts and equations, and ends in a virtual instrument you can operate.</p>
      <div class="chips"><span class="chip"><b>4</b> techniques</span><span class="chip"><b>47</b> stages</span><span class="chip"><b>4</b> virtual instruments</span></div>
    </div>
  </section>
  <section id="modules">
    ${MODULES.map((m, i) => { const f = FACTS[m.key]; return `
    <a class="mod" href="${m.href}" style="--accent:${m.accent}">
      <canvas class="mod-viz" data-viz="${m.key}" aria-hidden="true"></canvas>
      <div class="mod-body">
        <p class="kicker"><b>0${i + 1}</b> / ${m.short}</p>
        <h2>${m.name}</h2>
        <p class="mod-blurb">${m.blurb}</p>
        <dl>
          <div><dt>Probe</dt><dd>${f.probe}</dd></div>
          <div><dt>Signal</dt><dd>${f.signal}</dd></div>
          <div><dt>Resolution</dt><dd>${f.res}</dd></div>
        </dl>
        <p class="mod-cta"><span>${f.stages} stages</span><span>${f.lab}</span><b>Open →</b></p>
      </div>
    </a>`; }).join('')}
  </section>
  <section id="compare">
    <div class="sec-head"><p class="kicker"><b>05</b> / Side by side</p><h2>What each one sees</h2><p>The same sample looks different to each probe. Resolution, depth and what must be done to the specimen decide which is worth the time.</p></div>
    <div class="tbl wide"><table>
      <thead><tr><th></th>${MODULES.map((m) => `<th style="color:${m.accent}">${m.short}</th>`).join('')}</tr></thead>
      <tbody>${[['Probe', 'probe'], ['Signal', 'signal'], ['Lateral resolution', 'res'], ['Depth sampled', 'depth'], ['Specimen', 'sample'], ['Tells you', 'gives']].map(([l, k]) => `<tr><th>${l}</th>${MODULES.map((m) => `<td>${FACTS[m.key][k]}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>
  </section>
  <section id="choose">
    <div class="sec-head"><p class="kicker"><b>06</b> / Start from the question</p><h2>Which technique answers it</h2><p>Filled markers are the primary method, open ones a supporting route. Each links to the stage that explains it.</p></div>
    <div class="tbl wide"><table class="matrix">
      <thead><tr><th>Question</th>${MODULES.map((m) => `<th style="color:${m.accent}">${m.short}</th>`).join('')}</tr></thead>
      <tbody>${MATRIX.map(([q, c]) => `<tr><th>${q}</th>${MODULES.map((m) => { const e = c[m.key]; return e ? `<td><a href="${e[1]}" style="--accent:${m.accent}"><i class="${e[0] === 2 ? 'full' : ''}"></i>${e[2]}</a></td>` : '<td class="none">–</td>'; }).join('')}</tr>`).join('')}</tbody>
    </table></div>
  </section>
  <footer id="refs">
    <div><h3>About</h3><p class="about">Every number shown in the journeys is computed in the page from the stated equations, and each virtual instrument runs a real, simplified physical model: a Monte Carlo and image model for the SEM, a Fourier-optics phase-contrast simulation for the TEM, structure-factor patterns for XRD and device equations for silicon. They are teaching models, not substitutes for calibrated simulation or measurement.</p></div>
    <div class="foot-meta"><p class="logo"><b>Insight</b> / Characterisation</p><p>Built with Three.js and anime.js.</p></div>
  </footer>
</main>`);

if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  animate('#hero h1 span', { opacity: [0, 1], y: ['0.6em', 0], duration: 1200, delay: stagger(110, { start: 150 }), ease: 'outExpo' });
  animate('#hero .hero-k, #hero .lede, #hero .chips', { opacity: [0, 1], y: [16, 0], duration: 1000, delay: stagger(120, { start: 500 }), ease: 'outExpo' });
  animate('.mod', { opacity: [0, 1], y: [30, 0], duration: 1000, delay: stagger(110, { start: 700 }), ease: 'outExpo' });
}

// ---------------------------------------------------------------- card visualisations
const xr = pattern({ mat: 'Si', anode: 'Cu', filter: true, L: 40, eps: 0.0005, strain: 0, disp: 0, time: 1 }, { x0: 20, x1: 100, step: 0.1, rand: () => 0.5 });
const cv = mosCV({ N: 1e16, tox: 10, Qf: 5e10, Dit: 0 });
const VIZ = {
  sem(ctx, w, h, t, c) { // raster building an image of spheres
    const n = 14, rows = Math.floor(((t * 0.18) % 1.15) * n);
    const cell = Math.min(w, h * 1.4) / (n + 2), ox = (w - cell * n) / 2, oy = (h - cell * n * 0.72) / 2;
    for (let j = 0; j < n * 0.72; j++) for (let i = 0; i < n; i++) {
      if (j > rows) continue;
      const done = j < rows || i / n < ((t * 0.18 * n) % 1);
      if (!done) continue;
      let v = 0.12; for (const [sx, sy, r] of [[4, 3, 2.6], [10, 6, 3.4], [7.5, 8.5, 1.6], [12, 1.5, 1.4]]) { const d = Math.hypot(i - sx, j - sy) / r; if (d < 1) v = Math.max(v, 0.35 + 0.65 * d ** 3); }
      ctx.fillStyle = c; ctx.globalAlpha = v; ctx.fillRect(ox + i * cell + 1, oy + j * cell + 1, cell - 2, cell - 2);
    }
    ctx.globalAlpha = 1;
  },
  tem(ctx, w, h, t, c) { // lattice fringes whose contrast breathes with defocus
    const a = 15, ph = Math.sin(t * 0.5);
    for (let j = -1; j < h / (a * 0.866) + 1; j++) for (let i = -1; i < w / a + 1; i++) {
      const x = i * a + (j % 2) * a * 0.5, y = j * a * 0.866, d = Math.hypot(x - w * 0.5, y - h * 0.5), inside = d < Math.min(w, h) * 0.42;
      ctx.globalAlpha = inside ? 0.25 + 0.6 * Math.abs(ph) : 0.08; ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(x, y, inside ? 2 + 1.6 * Math.abs(ph) : 1.2, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  },
  xrd(ctx, w, h, t, c) { // diffractogram being scanned
    const n = xr.x.length, upto = ((t * 0.12) % 1.2) * n; let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, xr.ideal[i]);
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i < Math.min(n, upto); i++) { const x = 10 + ((w - 20) * i) / n, y = h - 14 - Math.sqrt(xr.ideal[i] / mx) * (h - 30); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.globalAlpha = 0.3; ctx.fillStyle = c; ctx.fillRect(10, h - 13, w - 20, 1); ctx.globalAlpha = 1;
  },
  semi(ctx, w, h, t, c) { // C–V curve with a bias marker sweeping
    const X = (v) => 12 + ((v + 3) / 5.5) * (w - 24), Y = (y) => h - 14 - y * (h - 30);
    ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const v = -3 + (5.5 * i) / 120; const y = interp(cv.V, cv.Chf, v); i ? ctx.lineTo(X(v), Y(y)) : ctx.moveTo(X(v), Y(y)); } ctx.stroke();
    ctx.globalAlpha = 0.45; ctx.setLineDash([4, 4]); ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const v = -3 + (5.5 * i) / 120; const y = interp(cv.V, cv.Clf, v); i ? ctx.lineTo(X(v), Y(y)) : ctx.moveTo(X(v), Y(y)); } ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const v = -3 + 5.5 * (0.5 - 0.5 * Math.cos(t * 0.6));
    ctx.fillStyle = '#f6f4f2'; ctx.beginPath(); ctx.arc(X(v), Y(interp(cv.V, cv.Chf, v)), 4, 0, 7); ctx.fill();
  },
};
const canvases = [...document.querySelectorAll('.mod-viz')].map((el) => ({ el, key: el.dataset.viz, color: MODULES.find((m) => m.key === el.dataset.viz).accent }));
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
function draw(now) {
  const t = still ? 4.2 : now / 1000;
  for (const c of canvases) {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = c.el.clientWidth, h = c.el.clientHeight;
    if (!w) continue;
    if (c.el.width !== Math.round(w * dpr)) { c.el.width = Math.round(w * dpr); c.el.height = Math.round(h * dpr); }
    const ctx = c.el.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    VIZ[c.key](ctx, w, h, t, c.color);
  }
  if (!still) requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
