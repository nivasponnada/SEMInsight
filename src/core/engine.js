// Scroll engine shared by every technique module: builds the page from a config,
// maps scroll position to stage keyframes, and drives the 3D scene, HUD and labels.
import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '../style.css';
import { animate, stagger } from 'animejs';
import { drawFnPlot } from '../plots.js';
import { MODULES } from './modules.js';

export { MODULES };

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const pad = (n) => String(n).padStart(2, '0');

export function boot(cfg) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const STAGES = cfg.stages, N = STAGES.length;
  const me = cfg.me || MODULES.find((m) => m.key === cfg.key);
  document.documentElement.style.setProperty('--accent', me.accent);

  // ------------------------------------------------------------------ page
  document.body.insertAdjacentHTML('afterbegin', `
  <canvas id="gl" aria-hidden="true"></canvas>
  <div id="labels" aria-hidden="true"></div>
  <header id="top">
    <a class="logo" href="#hero" aria-label="${me.brand.join('')} home"><b>${me.brand[0]}</b>${me.brand[1]}</a>
    <nav>
      ${cfg.standalone ? '' : '<a href="index.html">Techniques</a>'}
      <a href="#journey">Journey</a>
      <a href="#lab">${cfg.lab.title}</a>
      <a href="#index">Index</a>
      <a href="#refs">References</a>
    </nav>
  </header>
  <main>
    <section id="hero">
      <div class="hero-text">
        <p class="kicker hero-k">${cfg.standalone ? cfg.hero.kicker : `<a href="index.html">Characterisation techniques</a> / ${me.name}`}</p>
        <h1>${cfg.hero.title.map((t) => `<span>${t}</span>`).join(' ')}</h1>
        <p class="lede">${cfg.hero.lede}</p>
        <div class="chips">
          <span class="chip"><b>${N}</b> stages</span>
          ${cfg.hero.chips.map((c) => `<span class="chip">${c}</span>`).join('')}
          <a class="chip cta" href="#lab">${cfg.lab.title} ↓</a>
        </div>
      </div>
      <div class="scroll-hint"><span>Scroll</span><i></i></div>
    </section>
    <div id="journey">${STAGES.map((s, i) => `
      <section class="stage" id="${s.id}" data-i="${i}" style="--accent:${s.accent}">
        <div class="stage-text">
          <p class="kicker rv"><b>${pad(i + 1)}</b> / ${s.kicker}</p>
          <h2 class="rv">${s.title.replace('\n', '<br>')}</h2>
          <p class="copy rv">${s.copy}</p>
          <ul class="points">${s.points.map(([a, b]) => `<li class="rv"><span>${a}</span><em>${b}</em></li>`).join('')}</ul>
          ${s.table ? `<div class="tbl rv"><table><thead><tr>${s.table.head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((c, k) => (k ? `<td>${c}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>` : ''}
          ${s.watch ? `<div class="watch rv"><p><b>What goes wrong</b>${s.watch.risk}</p><p><b>Caught by</b>${s.watch.by.map(([label, href]) => `<a href="${href}">${label} →</a>`).join('')}</p></div>` : ''}
          ${s.see ? `<p class="see rv">${s.see.map(([label, href]) => `<a href="${href}">${label} →</a>`).join('')}</p>` : ''}
        </div>
      </section>`).join('')}
    </div>
    <section id="lab">
      <div class="lab-head">
        <p class="kicker"><b>${pad(N + 1)}</b> / Operate it</p>
        <h2>${cfg.lab.title}</h2>
        <p>${cfg.lab.intro}</p>
      </div>
      <div id="vsem"></div>
      <p class="lab-foot">${cfg.lab.foot}</p>
    </section>
    <section id="index">
      <div class="index-inner">
        <h2>Revisit a stage</h2>
        <p>Jump straight to any part of the journey.</p>
        <div id="index-grid">${STAGES.map((s, i) => `<a href="#${s.id}" style="--accent:${s.accent}"><b>${pad(i + 1)}</b><span>${s.nav}</span></a>`).join('')}<a href="#lab" style="--accent:#f6f4f2"><b>${pad(N + 1)}</b><span>${cfg.lab.title}</span></a></div>
        <h3 class="lbl other-h">${cfg.standalone ? 'How it is inspected' : 'Other techniques'}</h3>
        <div id="other-grid">${MODULES.filter((m) => m.key !== cfg.key).map((m) => `<a href="${m.href}" style="--accent:${m.accent}"><b>${m.short}</b><span>${m.name}</span></a>`).join('')}${cfg.standalone ? '' : '<a href="index.html" style="--accent:#f6f4f2"><b>All</b><span>Characterisation techniques</span></a>'}</div>
      </div>
    </section>
    <footer id="refs">
      <div><h3>References</h3><ol>${cfg.refs.map((r) => `<li>${r}</li>`).join('')}</ol></div>
      <div class="foot-meta">
        <p class="logo"><b>${me.brand[0]}</b>${me.brand[1]}</p>
        <p>${cfg.footNote}</p>
        <p>${cfg.standalone ? '' : 'Part of <a href="index.html">Characterisation techniques</a>. '}Built with Three.js and anime.js.</p>
      </div>
    </footer>
  </main>
  <aside id="hud" aria-live="off">
    <div class="hud-panel">
      <div class="hud-pass" hidden></div>
      <div class="hud-head"><span class="hud-n">01</span><span class="hud-k"></span><button type="button" class="hud-toggle" aria-label="Toggle details" aria-expanded="true">–</button></div>
      <div class="hud-read"></div>
      <div class="hud-ctl" hidden></div>
      <div class="hud-more">
        <div class="hud-eq"></div>
        <p class="hud-note"></p>
        <p class="hud-pt"></p>
        <canvas class="hud-plot"></canvas>
      </div>
    </div>
    <div class="scrub" role="navigation" aria-label="Stages">${STAGES.map((s, i) => `<a href="#${s.id}" title="${pad(i + 1)} ${s.nav}" aria-label="${s.nav}"><i></i></a>`).join('')}</div>
  </aside>`);

  const journey = $('#journey');
  const scrubTicks = [...$('.scrub').children];

  // text reveal (anime.js)
  if (!reduced) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        animate(e.target.querySelectorAll('.rv'), { opacity: [0, 1], y: [28, 0], duration: 900, delay: stagger(70), ease: 'outExpo' });
      }
    }, { threshold: 0.3 });
    document.querySelectorAll('.lab-head > *, .index-inner > *').forEach((el) => el.classList.add('rv'));
    document.querySelectorAll('.stage-text, .lab-head, .index-inner').forEach((el) => { el.classList.add('pre'); io.observe(el); });
    animate('#hero h1 span', { opacity: [0, 1], y: ['0.6em', 0], duration: 1200, delay: stagger(110, { start: 150 }), ease: 'outExpo' });
    animate('#hero .hero-k, #hero .lede, #hero .chips, .scroll-hint', { opacity: [0, 1], y: [16, 0], duration: 1000, delay: stagger(120, { start: 500 }), ease: 'outExpo' });
  }

  // ------------------------------------------------------------------ 3D
  const scene = new cfg.Scene($('#gl'));
  scene.reduced = reduced;
  const KEYS = [{ cam: cfg.heroCam, s: cfg.heroState || { closed: 1 } }, ...STAGES, { cam: cfg.endCam || cfg.heroCam, s: cfg.endState || cfg.heroState || { closed: 1 } }];
  const PARAMS = [...new Set(KEYS.flatMap((k) => [...Object.keys(k.s || {}), ...Object.keys(k.s2 || {})]))];

  const labelLayer = $('#labels');
  const labelEls = STAGES.map((s) => [...(s.labels || []).map((l) => [...l.slice(0, 3), s.cam2 ? 0 : -1]), ...(s.labels2 || []).map((l) => [...l.slice(0, 3), 1])].map(([text, pos, dir, view]) => {
    const el = document.createElement('div'); el.className = 'lab' + (pos[0] < (s.labelSplit ?? -0.2) ? ' l' : '') + (dir ? ' d' : ''); el.style.setProperty('--accent', s.accent);
    el.innerHTML = `<i></i><span>${text}</span>`; labelLayer.appendChild(el); return { el, pos, on: false, view };
  }));

  // ------------------------------------------------------------------ HUD
  const hud = $('#hud');
  const hudEl = { n: $('.hud-n'), k: $('.hud-k'), read: $('.hud-read'), ctl: $('.hud-ctl'), eq: $('.hud-eq'), note: $('.hud-note'), pt: $('.hud-pt'), plot: $('.hud-plot') };
  const env = { time: 0, ...(cfg.env || {}) };
  let hudStage = -1, lastRead = '', lastPlotKey = '';
  const invalidate = () => { lastRead = ''; lastPlotKey = ''; };
  $('.hud-toggle').addEventListener('click', (e) => {
    const open = hud.classList.toggle('collapsed') === false;
    e.currentTarget.setAttribute('aria-expanded', String(open)); e.currentTarget.textContent = open ? '–' : '+';
    lastPlotKey = '';
  });
  if (innerWidth < 820) { hud.classList.add('collapsed'); $('.hud-toggle').textContent = '+'; $('.hud-toggle').setAttribute('aria-expanded', 'false'); }
  // per-stage live controls
  const ctlEls = {};
  for (const [id, c] of Object.entries(cfg.controls || {})) {
    const el = document.createElement('div'); el.innerHTML = c.html; el.hidden = true; hudEl.ctl.appendChild(el); ctlEls[id] = el;
    c.bind(el, env, invalidate, scene);
  }

  function setHudStage(i) {
    hudStage = i;
    const s = STAGES[i];
    document.documentElement.style.setProperty('--accent', s.accent);
    hud.style.setProperty('--accent', s.light ? '#ff6b6b' : s.accent);
    hudEl.n.textContent = pad(i + 1); hudEl.k.textContent = s.kicker;
    hudEl.eq.innerHTML = s.eq; hudEl.note.innerHTML = s.eqNote; hudEl.pt.textContent = s.plot.title;
    hudEl.ctl.hidden = !ctlEls[s.id];
    for (const [id, el] of Object.entries(ctlEls)) el.hidden = id !== s.id;
    hudEl.plot.classList.toggle('tall', !!s.plot.tall);
    scrubTicks.forEach((t, k) => { t.classList.toggle('on', k === i); t.classList.toggle('done', k < i); });
    invalidate();
    if (!reduced) animate('.hud-head, .hud-eq', { opacity: [0.2, 1], duration: 500, ease: 'outQuad' });
  }
  function updateHud(i, f) {
    if (i !== hudStage) setHudStage(i);
    const s = STAGES[i];
    const rows = s.readouts(f, env);
    const html = rows.map(([l, v, u]) => `<div class="ro"><span>${l}</span><b>${v}</b><i>${u || ''}</i></div>`).join('');
    if (html !== lastRead) { hudEl.read.innerHTML = html; lastRead = html; }
    if (hud.classList.contains('collapsed')) return;
    const key = s.plot.live ? Math.floor(env.time * 20) : `${i}|${f.toFixed(3)}|${env.rev || 0}|${hudEl.plot.clientWidth}|${document.documentElement.className}`;
    if (key !== lastPlotKey) {
      lastPlotKey = key;
      if (s.plot.draw) s.plot.draw(hudEl.plot, f, env); else drawFnPlot(hudEl.plot, s.plot, f, env);
    }
  }

  // ------------------------------------------------------------------ virtual instrument
  const lab = cfg.lab.mount($('#vsem'));
  const hooks = cfg.setup ? cfg.setup({ scene, env, invalidate }) : null;

  // ------------------------------------------------------------------ scroll state
  let stageH = 1, journeyTop = 0, vh = innerHeight, mobile = false;
  function measure() {
    vh = innerHeight; mobile = innerWidth < 820;
    const r = journey.getBoundingClientRect();
    journeyTop = r.top + scrollY; stageH = r.height / N;
    scene.resize();
  }
  addEventListener('resize', measure);
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { scene.pointer.x = e.clientX / innerWidth - 0.5; scene.pointer.y = e.clientY / innerHeight - 0.5; } });

  const state = { cam: { p: [0, 0, 0], t: [0, 0, 0] }, params: {}, front: 99, f: 0, t: 0, idx: 0, shift: 0.15, shiftY: 0, env };
  const proj = { x: 0, y: 0, vis: false };
  const labEl = $('#lab'), top = $('#top');
  let lastT = performance.now(), passHTML = '';
  const passEl = $('.hud-pass');

  function frame(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; env.time += dt;
    const t = clamp((scrollY + vh * 0.5 - journeyTop) / stageH, -1, N + 1);
    // keyframe interpolation: hold around each stage centre, travel in between
    const u = clamp(t + 0.5, 0, N + 0.999), ki = Math.min(N, Math.floor(u)), a = smooth(clamp((u - ki - 0.3) / 0.4));
    const A = KEYS[ki], B = KEYS[ki + 1];
    // a stage may have a second view (cam2 / s2): leave from it, and move to it during the hold
    const Ac = A.cam2 || A.cam, As = A.s2 || A.s;
    for (let k = 0; k < 3; k++) { state.cam.p[k] = lerp(Ac.p[k], B.cam.p[k], a); state.cam.t[k] = lerp(Ac.t[k], B.cam.t[k], a); }
    for (const p of PARAMS) state.params[p] = lerp(As?.[p] || 0, B.s?.[p] || 0, a);
    const idx = clamp(Math.floor(t), 0, N - 1);
    const S = STAGES[idx], local = t - idx;
    let two = null;
    if (S.cam2 && local >= 0.3 && local <= 0.7 && t >= 0 && t <= N) {
      const m = smooth(clamp((local - 0.36) / 0.28)); two = S;
      for (let k = 0; k < 3; k++) { state.cam.p[k] = lerp(S.cam.p[k], S.cam2.p[k], m); state.cam.t[k] = lerp(S.cam.t[k], S.cam2.t[k], m); }
      for (const p of PARAMS) state.params[p] = lerp(S.s?.[p] || 0, (S.s2 || S.s)?.[p] || 0, m);
      state.view = m;
    } else state.view = local > 0.5 ? 1 : 0;
    const f = clamp((t - idx - 0.2) / 0.6);
    state.f = f; state.t = t; state.idx = idx; state.front = cfg.front ? (t > N ? cfg.front(N) : cfg.front(t)) : 0;
    state.shift = mobile ? 0 : two ? lerp(two.cam.shift ?? 0.17, two.cam2.shift ?? 0.17, state.view) : lerp(Ac.shift ?? 0.17, B.cam.shift ?? 0.17, a);
    state.shiftY = mobile ? 0.1 : lerp(A.cam.shiftY ?? 0, B.cam.shiftY ?? 0, a);

    const inJourney = t > -0.12 && t < N + 0.05;
    hud.classList.toggle('show', inJourney);
    document.documentElement.classList.toggle('light', !!STAGES[idx].light && t > idx + 0.08 && t < idx + 1.12);
    top.classList.toggle('solid', t > N + 0.3);
    if (inJourney) updateHud(idx, f);
    if (cfg.passport && inJourney) { const h = cfg.passport(idx, f); if (h !== passHTML) { passHTML = h; passEl.innerHTML = h; passEl.hidden = false; } }
    hooks?.frame?.({ t, idx, f, env, scene, N });

    const r = labEl.getBoundingClientRect();
    const covered = r.top < 0 && r.bottom > vh; // the lab section fully hides the canvas
    if (!covered) {
      scene.update(state, dt);
      scene.render();
      const hold = 1 - smooth(clamp(Math.abs(t - idx - 0.5) / 0.42));
      labelEls.forEach((set, i) => set.forEach((L) => {
        const vw = L.view < 0 ? 1 : L.view === 0 ? 1 - smooth(clamp(state.view * 2.5)) : smooth(clamp((state.view - 0.6) * 2.5));
        const on = i === idx && inJourney && hold * vw > 0.05;
        if (on) {
          scene.project(L.pos, proj);
          L.el.style.transform = `translate(${proj.x.toFixed(1)}px, ${proj.y.toFixed(1)}px)`;
          L.el.style.opacity = proj.vis ? hold * vw : 0;
        } else if (L.on) L.el.style.opacity = 0;
        L.on = on;
      }));
    }
    lab.tick(now);
    requestAnimationFrame(frame);
  }

  document.fonts.ready.then(invalidate);
  measure();
  new ResizeObserver(measure).observe(journey);
  requestAnimationFrame(frame);
}
