// TEM column, half-sectioned like the SEM: gun and accelerator on top, condensers,
// objective lens with the specimen in its gap, intermediate/projector lenses,
// viewing chamber with screen, camera and energy-loss spectrometer below.
import { Scene3D, THREE, V3, lerp, TAU, SIG } from '../core/scene3d.js';

export const Y = { tip: 13.6, c1: 10.8, c2: 9.9, cap: 9.3, spec: 7.6, bfp: 7.22, sa: 6.6, il: 5.6, p1: 4.4, p2: 3.4, haadf: 2.5, screen: 0.8 };
const TEM_ENV = [[Y.tip, 0.003], [12.0, 0.05], [Y.c1, 0.11], [10.4, 0.012], [Y.c2, 0.09], [Y.cap, 0.07], [Y.spec, 0.07], [Y.bfp, 0.012], [Y.sa, 0.07], [Y.il, 0.1], [5.1, 0.012], [Y.p1, 0.08], [3.9, 0.01], [Y.p2, 0.06], [3.0, 0.012], [Y.screen, 1.05]];
const STEM_ENV = [[Y.tip, 0.003], [12.0, 0.05], [Y.c1, 0.11], [10.4, 0.012], [Y.c2, 0.09], [Y.cap, 0.035], [8.0, 0.1], [Y.spec, 0.004], [Y.haadf, 0.26], [Y.screen, 0.36]];

export class TemScene extends Scene3D {
  build() {
    const M = this.M;
    this.coverTravel = 3.6;
    // --- gun + accelerator
    this._rev([[0, 14.5], [1.4, 14.5], [1.4, 11.42], [1.25, 11.42], [1.25, 14.35], [0, 14.35]], M.body, M.cut);
    this._rev([[0.22, 14.35], [0.62, 14.35], [0.4, 14.0], [0.2, 14.0]], M.ceramic, M.ceramic);
    this._rev([[0.1, 13.63], [0.36, 13.63], [0.36, 14.02], [0.3, 14.02], [0.3, 13.69], [0.1, 13.69]], M.steel, M.cut);
    this._rev([[0.06, 13.38], [0.6, 13.38], [0.6, 13.44], [0.06, 13.44]], M.steel, M.cut);
    const needle = this._mesh(new THREE.ConeGeometry(0.03, 0.24, 16), M.tip, [0, 13.72, 0]); needle.rotation.x = Math.PI;
    this.tipLight = new THREE.PointLight(0xff7a30, 1.2, 2.2); this.tipLight.position.set(0, 13.55, 0.15); this.root.add(this.tipLight);
    // accelerator: graded electrodes inside a ceramic tube
    for (let i = 0; i < 6; i++) { const y = 13.1 - i * 0.28; this._rev([[0.09, y], [0.78, y], [0.78, y + 0.05], [0.09, y + 0.05]], M.steel, M.cut); }
    this._rev([[0.8, 13.3], [0.92, 13.3], [0.92, 11.55], [0.8, 11.55]], M.ceramic, M.ceramic);
    this._rev([[0.1, 11.42], [1.25, 11.42], [1.25, 11.5], [0.1, 11.5]], M.iron, M.ironCut);
    this._box(1.0, 1.4, 1.0, M.dark, [-2.25, 13.2, -0.2]); this._rod(V3(-1.35, 13.2, -0.2), V3(-1.8, 13.2, -0.2), 0.2, M.body);
    // --- column
    this._rev([[1.25, 11.42], [1.4, 11.42], [1.4, 2.9], [1.25, 2.9]], M.body, M.cut);
    this._lens(Y.c1, 0.75, 0.25, 1.12, 0.12);
    this._lens(Y.c2, 0.75, 0.25, 1.12, 0.12);
    this._aperture(Y.cap, -1);
    // objective: large twin pole piece, specimen in the gap
    this._lens(Y.spec, 1.7, 0.2, 1.22, 0.36, 0.14);
    this._aperture(Y.bfp, 1, 0.012, 0.9);
    this._aperture(Y.sa, -1, 0.07);
    this._lens(Y.il, 0.7, 0.25, 1.12, 0.12);
    this._lens(Y.p1, 0.7, 0.25, 1.12, 0.12);
    this._lens(Y.p2, 0.7, 0.25, 1.12, 0.12);
    // specimen holder (side entry) and goniometer
    this._rod(V3(-3.0, Y.spec, 0), V3(-0.3, Y.spec, 0), 0.06, M.steel);
    this._rod(V3(-3.0, Y.spec, 0), V3(-1.5, Y.spec, 0), 0.3, M.dark);
    this._rod(V3(-3.4, Y.spec, 0), V3(-3.0, Y.spec, 0), 0.38, M.iron);
    this._box(0.5, 0.025, 0.2, M.copper, [-0.1, Y.spec, 0]);
    this.grid = this._mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 24), M.gold, [0, Y.spec + 0.014, 0]);
    // EDS above the specimen
    const ed = V3(Math.cos(0.42), Math.sin(0.42), -0.25).normalize();
    this.edsDir = ed;
    this._rod(V3(0, Y.spec, 0).addScaledVector(ed, 0.42), V3(0, Y.spec, 0).addScaledVector(ed, 2.6), 0.06, M.steel);
    this._rod(V3(0, Y.spec, 0).addScaledVector(ed, 0.38), V3(0, Y.spec, 0).addScaledVector(ed, 0.43), 0.05, M.xray);
    this._rod(V3(0, Y.spec, 0).addScaledVector(ed, 2.6), V3(0, Y.spec, 0).addScaledVector(ed, 3.5), 0.26, M.dark);
    // --- viewing chamber, screen, detectors
    this._rev([[1.4, 2.9], [2.3, 2.9], [2.3, 0.2], [0.5, 0.2], [0.5, 0.32], [2.16, 0.32], [2.16, 2.76], [1.4, 2.76]], M.body, M.cut);
    this._rev([[0.3, Y.haadf], [0.7, Y.haadf], [0.7, Y.haadf + 0.05], [0.3, Y.haadf + 0.05]], M.se, M.se); // HAADF annulus
    const sc = this._canvasTex(256, 256);
    this.screenCanvas = sc.canvas; this.screenTex = sc.tex;
    const scr = new THREE.Mesh(new THREE.CircleGeometry(1.15, 64), new THREE.MeshBasicMaterial({ map: sc.tex, toneMapped: false }));
    scr.rotation.x = -Math.PI / 2; scr.position.set(0, Y.screen + 0.012, 0); this.root.add(scr);
    this._mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.04, 64), M.dark, [0, Y.screen - 0.02, 0]);
    // camera + spectrometer below the chamber
    this._box(1.3, 0.5, 1.1, M.dark, [0, -0.1, -0.1]);
    this._box(1.1, 0.06, 0.9, M.scint, [0, 0.17, -0.1]);
    this._rod(V3(0, -0.35, -0.1), V3(0, -0.9, -0.1), 0.2, M.body);
    // magnetic prism (90° sector) and spectrum detector
    const prism = new THREE.Group(); prism.rotation.x = Math.PI / 2; prism.position.set(0.9, -0.9, -0.1); this.root.add(prism);
    this._arc([[0.55, -0.15], [1.25, -0.15], [1.25, 0.15], [0.55, 0.15]], M.iron, M.ironCut, -Math.PI / 2, Math.PI / 2, prism, 16);
    this._box(0.9, 0.5, 0.6, M.dark, [2.6, -1.8, -0.1]);
    this._box(0.06, 0.42, 0.5, M.xray, [2.13, -1.8, -0.1]);
    // dispersed fan after the prism
    this.fan = [];
    const cols = [0x8fe9ff, 0x9fb4ff, 0xb08cff, 0xff6b9d];
    cols.forEach((c, i) => {
      const pts = [];
      for (let k = 0; k <= 20; k++) { const a = (k / 20) * (Math.PI / 2) * (1 + (i - 1.5) * 0.045); pts.push(V3(0.9 - 0.9 * Math.cos(a), -0.9 - 0.9 * Math.sin(a), -0.1)); }
      const last = pts[pts.length - 1]; pts.push(V3(2.13, last.y - (i - 1.5) * 0.06, -0.1));
      this.fan.push(this._line(pts, c, 0));
    });

    // --- beams
    this.beamTEM = this._beam(TEM_ENV, 5);
    this.beamSTEM = this._beam(STEM_ENV, 6);
    // diffracted beams between specimen and image plane
    this.diff = [];
    for (const sgn of [-1, 1]) for (const k of [1, 2]) {
      const x = sgn * 0.1 * k;
      this.diff.push(this._line([V3(0, Y.spec, 0), V3(x, Y.bfp, 0), V3(0, Y.sa, 0)], k === 1 ? 0xffc730 : 0xff8f42, 0));
      const spot = this._mesh(new THREE.SphereGeometry(0.018, 10, 8), new THREE.MeshBasicMaterial({ color: k === 1 ? 0xffc730 : 0xff8f42, transparent: true, opacity: 0 }), [x, Y.bfp, 0]);
      this.diff.push(spot);
    }
    // high-angle scattering cone to the HAADF detector
    this.cone = [];
    for (let i = 0; i < 10; i++) { const a = Math.PI + (i / 9) * Math.PI; this.cone.push(this._line([V3(0, Y.spec, 0), V3(Math.cos(a) * 0.5, Y.haadf + 0.05, Math.sin(a) * 0.5)], SIG.se, 0)); }
    // particles: primary electrons and X-rays
    this.eP = this._points(280, 0xdff8ff, 0.035);
    this.eP.st.forEach((p) => { p.u = Math.random(); p.rho = Math.sqrt(Math.random()); p.a = Math.random() * TAU; });
    this.pX = this._points(50, SIG.xray, 0.05);
  }
  _aperture(y, side, hole = 0.03, len = 1.3) {
    const sh = new THREE.Shape([new THREE.Vector2(-len, -0.08), new THREE.Vector2(0.2, -0.08), new THREE.Vector2(0.2, 0.08), new THREE.Vector2(-len, 0.08)]);
    [[0, hole], [-0.18, hole * 1.6], [-0.38, hole * 2.3]].forEach(([x, r]) => { const h = new THREE.Path(); h.absarc(x, 0, r, 0, TAU, true); sh.holes.push(h); });
    const g = new THREE.Group(); g.position.set(0, y, 0); g.scale.x = -side; this.root.add(g);
    const strip = this._mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.016, bevelEnabled: false, curveSegments: 16 }), this.M.steel, [0, 0, 0], g); strip.rotation.x = Math.PI / 2;
    this._rod(V3(-len, -0.01, 0), V3(-len - 0.55, -0.01, 0), 0.03, this.M.steel, g);
    this._rod(V3(-1.38, -0.01, 0), V3(-1.7, -0.01, 0), 0.11, this.M.dark, g);
    return g;
  }

  tick(state, dt) {
    const P = this.params, front = state.front;
    const stem = P.stem || 0;
    this.beamTEM.mat.opacity = 0.3 * (1 - stem); this.beamSTEM.mat.opacity = 0.34 * stem;
    this.beamTEM.set(front); this.beamSTEM.set(stem > 0.02 ? Y.screen : 99);
    if (stem > 0.98) this.beamTEM.mesh.visible = false;
    const d = P.diff || 0;
    this.diff.forEach((o) => { o.material.opacity = d * 0.9; o.visible = d > 0.01 && front < Y.sa + 0.2; });
    this.cone.forEach((l) => { l.material.opacity = stem * 0.5; l.visible = stem > 0.01; });
    const e = P.eels || 0;
    this.fan.forEach((l) => { l.material.opacity = e; l.visible = e > 0.01; });
    this.tipLight.intensity = 1.0 + 0.25 * Math.sin(this.time * 9);
    // electrons
    const env = stem > 0.5 ? this.beamSTEM : this.beamTEM, set = this.eP, lo = stem > 0.5 ? Y.screen : Math.max(front, Y.screen);
    for (let i = 0; i < set.n; i++) {
      const p = set.st[i]; p.u += dt * 0.16 * (0.8 + 0.4 * p.rho);
      if (p.u > 1) { p.u -= 1; p.rho = Math.sqrt(Math.random()); p.a = Math.random() * TAU; }
      const y = lerp(Y.tip, Y.screen, p.u), o = i * 3;
      if (y < lo) { set.pos[o + 1] = 999; continue; }
      const r = env.radius(y) * p.rho;
      set.pos[o] = Math.cos(p.a) * r; set.pos[o + 1] = y; set.pos[o + 2] = Math.sin(p.a) * r;
    }
    set.geo.attributes.position.needsUpdate = true;
    // characteristic X-rays towards the EDS detector
    const xw = P.xray || 0, X = this.pX; X.obj.visible = xw > 0.01; X.mat.opacity = xw;
    if (X.obj.visible) {
      for (let i = 0; i < X.n; i++) {
        const p = X.st[i], o = i * 3; p.age += dt;
        if (p.age > p.life) {
          if (Math.random() > dt * 5) { X.pos[o + 1] = 999; continue; }
          p.age = 0; p.life = 0.5; const hit = Math.random() < 0.6, a = Math.random() * TAU, u = Math.random();
          const dir = hit ? this.edsDir.clone().add(V3((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.12)) : V3(Math.cos(a) * Math.sqrt(1 - u * u), u * 0.5, Math.sin(a) * Math.sqrt(1 - u * u));
          p.vx = dir.x * 2.2; p.vy = dir.y * 2.2; p.vz = dir.z * 2.2; p.x = 0; p.y = Y.spec; p.z = 0;
        }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        X.pos[o] = p.x; X.pos[o + 1] = p.y; X.pos[o + 2] = p.z;
      }
      X.geo.attributes.position.needsUpdate = true;
    }
  }
}
