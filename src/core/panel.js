// Small control-panel builder shared by the virtual instruments.
// spec: { segs:[{key,label,opts:[[value,label]],num}], sliders:[{key,label,min,max,log,step,fmt}], actions:[[id,label]] }
export function buildPanel(el, spec, st, onChange, onAction) {
  const uid = Math.random().toString(36).slice(2, 7);
  const tx = (s, v) => (s.log ? Math.log10(v) : v), inv = (s, v) => (s.log ? 10 ** v : v);
  el.innerHTML =
    (spec.segs || []).map((s) => `<div class="vs-group"><label class="lbl">${s.label}</label><div class="seg" data-key="${s.key}">${s.opts.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>${s.desc ? `<p class="vs-desc" data-desc="${s.key}"></p>` : ''}</div>`).join('') +
    `<div class="vs-sliders">${(spec.sliders || []).map((s) => `<div class="vs-slider"><div class="vs-row"><label class="lbl" for="p${uid}-${s.key}">${s.label}</label><output data-out="${s.key}"></output></div><input id="p${uid}-${s.key}" type="range" data-key="${s.key}" min="${tx(s, s.min)}" max="${tx(s, s.max)}" step="${s.step || 'any'}"></div>`).join('')}</div>` +
    (spec.actions ? `<div class="vs-actions">${spec.actions.map(([id, l]) => `<button type="button" class="btn" data-act="${id}">${l}</button>`).join('')}</div>` : '') +
    `<div class="vs-readouts"></div>`;
  const sync = (skipSliders) => {
    for (const s of spec.segs || []) {
      el.querySelectorAll(`.seg[data-key=${s.key}] button`).forEach((b) => b.setAttribute('aria-pressed', String(String(st[s.key]) === b.dataset.v)));
      if (s.desc) el.querySelector(`[data-desc=${s.key}]`).textContent = s.desc(st[s.key]);
    }
    for (const s of spec.sliders || []) {
      if (!skipSliders) el.querySelector(`input[data-key=${s.key}]`).value = tx(s, st[s.key]);
      el.querySelector(`[data-out=${s.key}]`).textContent = s.fmt(st[s.key]);
    }
  };
  el.querySelectorAll('.seg').forEach((g) => g.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const s = spec.segs.find((q) => q.key === g.dataset.key);
    st[s.key] = s.num ? +b.dataset.v : b.dataset.v; sync(); onChange(s.key);
  }));
  el.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', () => {
    const s = spec.sliders.find((q) => q.key === inp.dataset.key);
    let v = inv(s, +inp.value); if (s.round) v = s.round(v);
    st[s.key] = v; sync(true); onChange(s.key);
  }));
  el.querySelector('.vs-actions')?.addEventListener('click', (e) => {
    const a = e.target.closest('button')?.dataset.act; if (!a) return;
    onAction(a); sync(); onChange(a);
  });
  sync();
  const readEl = el.querySelector('.vs-readouts');
  return {
    sync,
    /** rows: [[label, value, unit]] */
    readouts(rows) { readEl.innerHTML = rows.map(([l, v, u]) => `<div class="ro"><span>${l}</span><b>${v}</b><i>${u || ''}</i></div>`).join(''); },
  };
}

export function statusHTML(notes) { return notes.map(([c, t]) => `<p class="${c}">${t}</p>`).join(''); }
