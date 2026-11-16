import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './style.css';
import { animate, stagger } from 'animejs';
import { STAGES, MC_MATERIALS } from './stages.js';
import { MATERIALS, rangeKO } from './physics.js';
import { Column } from './column.js';
import { drawFnPlot, drawKikuchi } from './plots.js';
import { simulate } from './montecarlo.js';
import { VirtualSEM, makeDemo } from './sandbox.js';

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const pad = (n) => String(n).padStart(2, '0');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = STAGES.length;

// ------------------------------------------------------------------ DOM: stages, index, scrubber
const journey = $('#journey');
journey.innerHTML = STAGES.map((s, i) => `
  <section class="stage" id="${s.id}" data-i="${i}" style="--accent:${s.accent}">
    <div class="stage-text">
      <p class="kicker rv"><b>${pad(i + 1)}</b> / ${s.kicker}</p>
      <h2 class="rv">${s.title.replace('\n', '<br>')}</h2>
      <p class="copy rv">${s.copy}</p>
      <ul class="points">${s.points.map(([a, b]) => `<li class="rv"><span>${a}</span><em>${b}</em></li>`).join('')}</ul>
      ${s.table ? `<div class="tbl rv"><table><thead><tr>${s.table.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((c, k) => (k ? `<td>${c}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
    </div>
  </section>`).join('');

$('#index-grid').innerHTML = STAGES.map((s, i) => `<a href="#${s.id}" style="--accent:${s.accent}"><b>${pad(i + 1)}</b><span>${s.nav}</span></a>`).join('') + `<a href="#lab" style="--accent:#f6f4f2"><b>16</b><span>Virtual SEM</span></a>`;
const scrub = $('.scrub');
scrub.innerHTML = STAGES.map((s, i) => `<a href="#${s.id}" title="${pad(i + 1)} ${s.nav}" aria-label="${s.nav}"><i></i></a>`).join('');
const scrubTicks = [...scrub.children];

// text reveal (anime.js)
if (!reduced) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      animate(e.target.querySelectorAll('.rv'), { opacity: [0, 1], y: [28, 0], duration: 900, delay: stagger(70), ease: 'outExpo' });
    }
  }, { threshold: 0.35 });
  document.querySelectorAll('.stage-text, .lab-head, .index-inner').forEach((el) => { el.classList.add('pre'); io.observe(el); });
  document.querySelectorAll('.lab-head > *, .index-inner > *').forEach((el) => el.classList.add('rv'));
  animate('#hero h1 span', { opacity: [0, 1], y: ['0.6em', 0], duration: 1200, delay: stagger(110, { start: 150 }), ease: 'outExpo' });
  animate('#hero .lede, #hero .chips, .scroll-hint', { opacity: [0, 1], y: [16, 0], duration: 1000, delay: stagger(120, { start: 650 }), ease: 'outExpo' });
}

// ------------------------------------------------------------------ 3D
const column = new Column($('#gl'));
column.reduced = reduced;
const HERO = { cam: { p: [13, 7, 30], t: [0, 4.1, 0], shift: 0.2 }, s: { closed: 1 } };
const END = { cam: { p: [14, 6.2, 31], t: [0, 4.1, 0], shift: 0.2 }, s: { closed: 1 } };
const KEYS = [HERO, ...STAGES, END];
const PARAMS = ['closed', 'scan', 'tilt', 'ebsd', 'gas', 'field', 'mc', 'se', 'bse', 'xray', 'photons', 'monitor'];
// beam front (y of the leading electrons) against scroll position t
const FRONT = [[0.9, 9.97], [1.8, 9.3], [2.8, 8.2], [3.8, 5.75], [4.8, 4.9], [5.8, 4.2], [6.8, 2.8], [7.7, 0]];
function frontAt(t) {
  if (t <= FRONT[0][0]) return 99;
  for (let i = 0; i < FRONT.length - 1; i++) if (t <= FRONT[i + 1][0]) return lerp(FRONT[i][1], FRONT[i + 1][1], (t - FRONT[i][0]) / (FRONT[i + 1][0] - FRONT[i][0]));
  return 0;
}

// ------------------------------------------------------------------ labels
const labelLayer = $('#labels');
const labelEls = STAGES.map((s) => (s.labels || []).map(([text, pos, dir]) => {
  const el = document.createElement('div'); el.className = 'lab' + (pos[0] < -0.2 ? ' l' : '') + (dir ? ' d' : ''); el.style.setProperty('--accent', s.accent);
  el.innerHTML = `<i></i><span>${text}</span>`; labelLayer.appendChild(el); return { el, pos, on: false };
}));

// ------------------------------------------------------------------ HUD
const hud = $('#hud');
const hudEl = { n: $('.hud-n'), k: $('.hud-k'), read: $('.hud-read'), ctl: $('.hud-ctl'), eq: $('.hud-eq'), note: $('.hud-note'), pt: $('.hud-pt'), plot: $('.hud-plot') };
const env = { time: 0, mcE: 15, mcMat: 'Si', mcEta: null, mcBseE: 0 };
let hudStage = -1, lastRead = '', lastPlotKey = '';
$('.hud-toggle').addEventListener('click', (e) => {
  const open = hud.classList.toggle('collapsed') === false;
  e.currentTarget.setAttribute('aria-expanded', String(open)); e.currentTarget.textContent = open ? '–' : '+';
  lastPlotKey = '';
});
if (innerWidth < 820) { hud.classList.add('collapsed'); $('.hud-toggle').textContent = '+'; $('.hud-toggle').setAttribute('aria-expanded', 'false'); }

hudEl.ctl.innerHTML = `
  <div class="vs-row"><label class="lbl" for="mc-e">Beam energy</label><output id="mc-e-out"></output></div>
  <input id="mc-e" type="range" min="1" max="30" step="0.5" value="15">
  <div class="seg" id="mc-mat">${MC_MATERIALS.map((m) => `<button type="button" data-v="${m}">${m}</button>`).join('')}</div>`;
let mcTimer = 0, mcReady = false;
function runMC() {
  const m = MATERIALS[env.mcMat];
  const res = simulate(m, env.mcE, { nShow: 170, nCount: 1500 });
  env.mcEta = res.eta; env.mcBseE = res.meanBseEnergy;
  column.setMC(res.paths, rangeKO(env.mcE, m));
  mcReady = true; lastRead = ''; lastPlotKey = '';
}
function syncMC() {
  $('#mc-e-out').textContent = `${env.mcE.toFixed(1)} keV`;
  hudEl.ctl.querySelectorAll('#mc-mat button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === env.mcMat)));
  clearTimeout(mcTimer); mcTimer = setTimeout(runMC, 40);
}
$('#mc-e').addEventListener('input', (e) => { env.mcE = +e.target.value; env.mcEta = null; syncMC(); });
$('#mc-mat').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { env.mcMat = b.dataset.v; env.mcEta = null; syncMC(); } });

function setHudStage(i) {
  hudStage = i;
  const s = STAGES[i];
  document.documentElement.style.setProperty('--accent', s.accent);
  hud.style.setProperty('--accent', s.light ? '#ff6b6b' : s.accent);
  hudEl.n.textContent = pad(i + 1); hudEl.k.textContent = s.kicker;
  hudEl.eq.innerHTML = s.eq; hudEl.note.innerHTML = s.eqNote; hudEl.pt.textContent = s.plot.title;
  hudEl.ctl.hidden = !s.controls;
  hudEl.plot.classList.toggle('tall', !!s.plot.tall);
  scrubTicks.forEach((t, k) => { t.classList.toggle('on', k === i); t.classList.toggle('done', k < i); });
  lastRead = ''; lastPlotKey = '';
  if (!reduced) animate('.hud-head, .hud-eq', { opacity: [0.2, 1], duration: 500, ease: 'outQuad' });
}
function updateHud(i, f) {
  if (i !== hudStage) setHudStage(i);
  const s = STAGES[i];
  const rows = s.readouts(f, env);
  const html = rows.map(([l, v, u]) => `<div class="ro"><span>${l}</span><b>${v}</b><i>${u || ''}</i></div>`).join('');
  if (html !== lastRead) { hudEl.read.innerHTML = html; lastRead = html; }
  if (hud.classList.contains('collapsed')) return;
  const key = s.plot.live ? Math.floor(env.time * 20) : `${i}|${f.toFixed(3)}|${env.mcE}|${env.mcMat}|${hudEl.plot.clientWidth}|${document.documentElement.className}`;
  if (key !== lastPlotKey) {
    lastPlotKey = key;
    if (s.plot.draw) s.plot.draw(hudEl.plot, f, env); else drawFnPlot(hudEl.plot, s.plot, f, env);
  }
}

// ------------------------------------------------------------------ virtual SEM + in-scene display
const vsem = new VirtualSEM($('#vsem'));
let demo = null, demoKey = '';

// ------------------------------------------------------------------ scroll state
let stageH = 1, journeyTop = 0, vh = innerHeight, mobile = false;
function measure() {
  vh = innerHeight; mobile = innerWidth < 820;
  const r = journey.getBoundingClientRect();
  journeyTop = r.top + scrollY; stageH = r.height / N;
  column.resize();
}
addEventListener('resize', measure);
addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { column.pointer.x = e.clientX / innerWidth - 0.5; column.pointer.y = e.clientY / innerHeight - 0.5; } });

const state = { cam: { p: [0, 0, 0], t: [0, 0, 0] }, params: {}, front: 99, f: 0, shift: 0.15, shiftY: 0 };
const proj = { x: 0, y: 0, vis: false };
let lastT = performance.now(), kTexKey = -1;

function frame(now) {
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; env.time += dt;
  const t = clamp((scrollY + vh * 0.5 - journeyTop) / stageH, -1, N + 1);
  // keyframe interpolation: hold around each stage centre, travel in between
  const u = clamp(t + 0.5, 0, N + 0.999), ki = Math.min(N, Math.floor(u)), a = smooth(clamp((u - ki - 0.3) / 0.4));
  const A = KEYS[ki], B = KEYS[ki + 1];
  for (let k = 0; k < 3; k++) { state.cam.p[k] = lerp(A.cam.p[k], B.cam.p[k], a); state.cam.t[k] = lerp(A.cam.t[k], B.cam.t[k], a); }
  for (const p of PARAMS) state.params[p] = lerp(A.s?.[p] || 0, B.s?.[p] || 0, a);
  const idx = clamp(Math.floor(t), 0, N - 1);
  const f = clamp((t - idx - 0.2) / 0.6);
  state.f = f; state.front = t > N ? 0 : frontAt(t);
  state.shift = mobile ? 0 : lerp(A.cam.shift ?? 0.17, B.cam.shift ?? 0.17, a);
  state.shiftY = mobile ? 0.1 : lerp(A.cam.shiftY ?? 0, B.cam.shiftY ?? 0, a);

  const inJourney = t > -0.12 && t < N + 0.05;
  hud.classList.toggle('show', inJourney);
  document.documentElement.classList.toggle('light', t > N - 1 + 0.08 && t < N + 0.12);
  $('#top').classList.toggle('solid', t > N + 0.3);
  if (inJourney) updateHud(idx, f);

  // lazy work near the stages that need it
  if (!mcReady && t > 7) { mcReady = true; setTimeout(runMC, 0); syncMC(); }
  if (t > 12.5 && t < N + 0.3) {
    if (!demo) demo = makeDemo();
    const fk = idx === N - 1 ? Math.round(f * 60) : 0;
    const key = `${fk}|${Math.floor(env.time * 8)}`;
    if (key !== demoKey) { demoKey = key; demo.draw(column.monitorCanvas, idx === N - 1 ? Math.max(0.02, f) : 0.02 + ((env.time * 0.15) % 0.3)); column.monitorTex.needsUpdate = true; }
  }
  if (idx === 12) {
    const kk = Math.round(f * 24);
    if (kk !== kTexKey) { kTexKey = kk; drawKikuchi(column.kCanvas, f * 0.8, 20, true); column.kTex.needsUpdate = true; }
  }

  const lab = $('#lab').getBoundingClientRect();
  const covered = lab.top < 0 && lab.bottom > vh; // the lab section fully hides the canvas
  if (!covered) {
    column.update(state, dt);
    column.render();
    // labels
    const hold = 1 - smooth(clamp(Math.abs(t - idx - 0.5) / 0.42));
    labelEls.forEach((set, i) => set.forEach((L) => {
      const on = i === idx && inJourney && hold > 0.05;
      if (on) {
        column.project(L.pos, proj);
        L.el.style.transform = `translate(${proj.x.toFixed(1)}px, ${proj.y.toFixed(1)}px)`;
        L.el.style.opacity = proj.vis ? hold : 0;
      } else if (L.on) L.el.style.opacity = 0;
      L.on = on;
    }));
  }
  vsem.tick(now);
  requestAnimationFrame(frame);
}

document.fonts.ready.then(() => { lastPlotKey = ''; });
measure();
new ResizeObserver(measure).observe(journey);
requestAnimationFrame(frame);
