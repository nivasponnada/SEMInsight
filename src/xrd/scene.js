// Powder diffractometer in θ–θ Bragg–Brentano geometry: the sample stays horizontal at the
// goniometer centre while the tube arm (left) and detector arm (right) each rise by θ.
import { Scene3D, THREE, V3, lerp, TAU, SIG } from '../core/scene3d.js';

export const R = 4;
const rad = Math.PI / 180;
const XC = 0xb08cff;

export class XrdScene extends Scene3D {
  build() {
    const M = this.M;
    this.theta = 15;
    // --- goniometer: back plate, ring with degree ticks, hub
    const ring = this._mesh(new THREE.TorusGeometry(5.45, 0.16, 12, 96), M.body, [0, 0, -0.8]);
    this._mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.3, 48), M.dark, [0, 0, -0.8]).rotation.x = Math.PI / 2;
    this._mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32), M.iron, [0, 0, -0.6]).rotation.x = Math.PI / 2;
    for (let i = 0; i < 72; i++) { const a = (i / 72) * TAU, big = i % 6 === 0; const t = this._box(big ? 0.26 : 0.14, 0.03, 0.05, big ? M.steel : M.dark, [Math.cos(a) * 5.15, Math.sin(a) * 5.15, -0.72]); t.rotation.z = a; }
    this._box(2.4, 0.5, 1.6, M.dark, [0, -5.9, -0.6]); this._box(0.5, 0.6, 0.5, M.body, [0, -5.5, -0.75]);
    // --- sample stage
    this.sampleMat = this._std(0xd8d2c6, { roughness: 0.95, metalness: 0, transparent: true });
    this.holderMat = this._std(0x4a4643, { transparent: true });
    this._box(1.7, 0.14, 1.1, this.holderMat, [0, -0.08, 0]);
    this._box(1.1, 0.02, 0.75, this.sampleMat, [0, -0.005, 0]);
    this._rod(V3(0, -0.15, -0.1), V3(0, -0.15, -0.7), 0.16, M.steel);

    // --- incident arm (built along −x, rotated by −θ)
    const A = (this.armIn = new THREE.Group()); this.root.add(A);
    this._box(4.6, 0.34, 0.16, M.body, [-3.0, 0, -0.55], A);
    // X-ray tube, sectioned: cathode above, copper anode below, beryllium window towards the sample
    this._box(1.5, 1.9, 0.12, M.dark, [-4.75, 0.25, -0.5], A);                       // back wall
    this._box(1.5, 0.1, 0.9, M.body, [-4.75, 1.2, -0.1], A); this._box(1.5, 0.1, 0.9, M.body, [-4.75, -0.7, -0.1], A);
    this._box(0.1, 1.9, 0.9, M.body, [-5.5, 0.25, -0.1], A);
    this._box(0.1, 0.72, 0.9, M.body, [-4.0, 0.84, -0.1], A); this._box(0.1, 0.72, 0.9, M.body, [-4.0, -0.34, -0.1], A);
    this._box(0.03, 0.46, 0.5, this._std(0xbfd6e8, { transparent: true, opacity: 0.45, roughness: 0.2 }), [-4.0, 0.25, -0.1], A); // Be window
    this._box(0.7, 0.5, 0.6, M.copper, [-4.7, -0.3, -0.1], A);                        // anode block
    const face = this._box(0.72, 0.06, 0.62, M.copperCut, [-4.7, -0.03, -0.1], A); face.rotation.z = 0.1;
    this._rod(V3(-5.3, -0.42, -0.1), V3(-5.0, -0.42, -0.1), 0.06, M.steel, A); this._rod(V3(-5.3, -0.22, -0.1), V3(-5.0, -0.22, -0.1), 0.06, M.steel, A); // cooling water
    this._box(0.5, 0.2, 0.4, M.steel, [-4.7, 0.95, -0.1], A);                         // cathode cup
    this._rod(V3(-4.86, 0.83, -0.1), V3(-4.54, 0.83, -0.1), 0.02, M.tip, A);          // filament
    this.eBeam = this._mesh(new THREE.CylinderGeometry(0.03, 0.09, 0.8, 12, 1, true), new THREE.MeshBasicMaterial({ color: SIG.beam, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [-4.7, 0.42, -0.1], A);
    this.focal = this._mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), [-4.7, 0.02, -0.1], A);
    // Soller slit and divergence slit
    for (let i = -4; i <= 4; i++) this._box(0.5, 0.36, 0.008, M.steel, [-3.3, 0, i * 0.045], A);
    this._box(0.56, 0.05, 0.48, M.dark, [-3.3, 0.21, 0], A); this._box(0.56, 0.05, 0.48, M.dark, [-3.3, -0.21, 0], A);
    this._box(0.05, 0.3, 0.5, M.steel, [-2.6, 0.2, 0], A); this._box(0.05, 0.3, 0.5, M.steel, [-2.6, -0.2, 0], A);

    // --- diffracted arm (built along +x, rotated by +θ)
    const D = (this.armOut = new THREE.Group()); this.root.add(D);
    this._box(4.6, 0.34, 0.16, M.body, [3.0, 0, -0.55], D);
    this._box(0.05, 0.3, 0.5, M.steel, [2.2, 0.21, 0], D); this._box(0.05, 0.3, 0.5, M.steel, [2.2, -0.21, 0], D); // anti-scatter slit
    for (let i = -4; i <= 4; i++) this._box(0.5, 0.36, 0.008, M.steel, [2.9, 0, i * 0.045], D);
    this._box(0.56, 0.05, 0.48, M.dark, [2.9, 0.21, 0], D); this._box(0.56, 0.05, 0.48, M.dark, [2.9, -0.21, 0], D);
    this._box(0.02, 0.34, 0.46, this._std(0x9aa7b0, { roughness: 0.3, metalness: 0.9, transparent: true, opacity: 0.8 }), [3.4, 0, 0], D); // Kβ filter foil
    this._box(0.04, 0.3, 0.5, M.steel, [3.95, 0.17, 0], D); this._box(0.04, 0.3, 0.5, M.steel, [3.95, -0.17, 0], D);   // receiving slit
    this._box(1.0, 0.8, 0.8, M.dark, [4.6, 0, -0.05], D);
    this._box(0.04, 0.5, 0.56, M.xray, [4.09, 0, -0.05], D);

    // --- beams: divergent incident fan and parafocused diffracted fan
    const fan = () => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: XC, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.frustumCulled = false; m.renderOrder = 5; this.root.add(m); return m; };
    this.fanIn = fan(); this.fanOut = fan();
    this.ph = this._points(140, XC, 0.06);
    this.ph.st.forEach((p) => { p.u = Math.random(); p.x = (Math.random() - 0.5) * 0.8; });

    // --- focusing circle
    const cp = []; for (let i = 0; i <= 96; i++) cp.push(V3(Math.cos((i / 96) * TAU), Math.sin((i / 96) * TAU), 0));
    this.fcircle = this._line(cp, 0xffc730, 0);

    // --- Debye–Scherrer cones around the incident beam direction (Si, Cu Kα)
    this.cones = new THREE.Group(); this.root.add(this.cones);
    this.coneMat = new THREE.LineBasicMaterial({ color: XC, transparent: true, opacity: 0 });
    for (const tt of [28.44, 47.3, 56.12, 69.13, 76.38]) {
      const pts = []; const rr = R * Math.sin(tt * rad), xx = R * Math.cos(tt * rad);
      for (let i = 0; i <= 96; i++) pts.push(V3(xx, Math.cos((i / 96) * TAU) * rr, Math.sin((i / 96) * TAU) * rr));
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.coneMat); l.frustumCulled = false; this.cones.add(l);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; const g = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(0, 0, 0), V3(xx, Math.cos(a) * rr, Math.sin(a) * rr)]), this.coneMat); g.frustumCulled = false; this.cones.add(g); }
    }

    // --- lattice close-up for Bragg's law
    const Lg = (this.lattice = new THREE.Group()); this.root.add(Lg);
    this.d = 0.55;
    this.atomMat = this._std(0x9fb4c8, { roughness: 0.35, metalness: 0.4, transparent: true });
    const sph = new THREE.SphereGeometry(0.085, 16, 12);
    for (let j = 0; j < 4; j++) for (let i = -5; i <= 5; i++) for (let k = 0; k < 2; k++) this._mesh(sph, this.atomMat, [i * this.d, -j * this.d, -k * this.d], Lg);
    this.planeMat = new THREE.LineBasicMaterial({ color: 0xf6f4f2, transparent: true, opacity: 0 });
    for (let j = 0; j < 4; j++) Lg.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(-3.2, -j * this.d, 0.1), V3(3.2, -j * this.d, 0.1)]), this.planeMat));
    const mk = (color) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 })); l.frustumCulled = false; l.renderOrder = 6; Lg.add(l); return l; };
    this.ray1 = mk(XC); this.ray2 = mk(XC); this.extra = mk(0xffc730);

    // --- display for the diffractogram
    const mon = this._canvasTex(640, 360);
    this.monitorCanvas = mon.canvas; this.monitorTex = mon.tex;
    this.monitor = new THREE.Group(); this.monitor.position.set(8.2, 1.4, -0.2); this.root.add(this.monitor);
    this.monitor.add(new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6 * 360 / 640), new THREE.MeshBasicMaterial({ map: mon.tex, toneMapped: false })));
    this._box(3.8, 2.22, 0.12, M.dark, [0, 0, -0.07], this.monitor); this._box(0.14, 0.5, 0.1, M.dark, [0, -1.3, -0.14], this.monitor); this._box(1.0, 0.08, 0.6, M.dark, [0, -1.56, -0.1], this.monitor);
    ring.renderOrder = 0;
  }

  tick(state, dt) {
    const P = this.params;
    const sweepTh = 9 + 26 * (0.5 - 0.5 * Math.cos(this.time * 0.45));
    const th = (this.theta = lerp(P.theta || 15, sweepTh, P.sweep || 0)), t = th * rad;
    this.armIn.rotation.z = -t; this.armOut.rotation.z = t;
    const S = V3(-(R - 0.0) * Math.cos(t), R * Math.sin(t), 0), D = V3(R * Math.cos(t), R * Math.sin(t), 0);
    // fans
    const lat = P.lattice || 0, front = state.front, w = 0.45;
    const setFan = (m, a, b, c, frac) => {
      const p = m.geometry.attributes.position.array;
      const bx = lerp(a.x, b.x, frac), by = lerp(a.y, b.y, frac), cx = lerp(a.x, c.x, frac), cy = lerp(a.y, c.y, frac);
      p[0] = a.x; p[1] = a.y; p[2] = 0; p[3] = bx; p[4] = by; p[5] = 0; p[6] = cx; p[7] = cy; p[8] = 0;
      m.geometry.attributes.position.needsUpdate = true; m.visible = frac > 0.01 && lat < 0.95; m.material.opacity = 0.34 * (1 - lat);
    };
    const fin = Math.min(1, Math.max(0, front)), fout = Math.min(1, Math.max(0, front - 1));
    // the fan starts at the tube window, not at the anode
    const S0 = S.clone().multiplyScalar((R + 0.7) / R);
    setFan(this.fanIn, S0, V3(-w, 0, 0), V3(w, 0, 0), fin);
    // diffracted: draw from the sample edges converging on the receiving slit
    {
      const p = this.fanOut.geometry.attributes.position.array, e = fout;
      p[0] = -w; p[1] = 0; p[2] = 0; p[3] = w; p[4] = 0; p[5] = 0; p[6] = lerp(0, D.x, e); p[7] = lerp(0, D.y, e); p[8] = 0;
      if (e < 1) { p[6] = lerp(w, D.x, e); p[7] = lerp(0, D.y, e); } // while travelling, keep a finite width
      this.fanOut.geometry.attributes.position.needsUpdate = true; this.fanOut.visible = e > 0.01 && lat < 0.95; this.fanOut.material.opacity = 0.3 * (1 - lat);
    }
    this.eBeam.material.opacity = front > -0.5 ? 0.42 : 0; this.focal.visible = front > -0.5;
    // photons
    const ph = this.ph; ph.obj.visible = fin > 0.5 && lat < 0.9; ph.mat.opacity = 1 - lat;
    if (ph.obj.visible) {
      for (let i = 0; i < ph.n; i++) {
        const p = ph.st[i], o = i * 3; p.u += dt * 0.5; if (p.u > 1) { p.u -= 1; p.x = (Math.random() - 0.5) * 2 * w; }
        if (p.u < 0.5) { const f = p.u * 2; ph.pos[o] = lerp(S0.x, p.x, f); ph.pos[o + 1] = lerp(S0.y, 0, f); }
        else if (fout > 0.5 && (i % 3 === 0)) { const f = (p.u - 0.5) * 2; ph.pos[o] = lerp(p.x, D.x, f); ph.pos[o + 1] = lerp(0, D.y, f); }
        else { ph.pos[o + 1] = 999; continue; }
        ph.pos[o + 2] = 0;
      }
      ph.geo.attributes.position.needsUpdate = true;
    }
    // focusing circle through tube focus, sample centre and receiving slit
    const fo = P.focus || 0, rf = R / (2 * Math.sin(t));
    this.fcircle.visible = fo > 0.01; this.fcircle.material.opacity = fo * 0.8; this.fcircle.scale.setScalar(rf); this.fcircle.position.set(0, rf, 0);
    // cones follow the incident beam direction
    const co = P.cones || 0; this.cones.visible = co > 0.01; this.coneMat.opacity = co * 0.55; this.cones.rotation.z = -t;
    // lattice
    this.lattice.visible = lat > 0.01; this.atomMat.opacity = lat; this.planeMat.opacity = lat * 0.35;
    this.sampleMat.opacity = 1 - lat; this.holderMat.opacity = 1 - lat;
    if (this.lattice.visible) {
      const d = this.d, ux = Math.cos(t), uy = Math.sin(t), Lr = 3.4, ex = d * Math.sin(t);
      const set = (l, pts, op) => { const p = l.geometry.attributes.position.array; pts.forEach((v, i) => { p[i * 3] = v[0]; p[i * 3 + 1] = v[1]; p[i * 3 + 2] = 0.12; }); l.geometry.attributes.position.needsUpdate = true; l.material.opacity = op; };
      set(this.ray1, [[-ux * Lr, uy * Lr], [0, 0], [ux * Lr, uy * Lr]], lat);
      set(this.ray2, [[-ux * Lr, -d + uy * Lr], [0, -d], [ux * Lr, -d + uy * Lr]], lat);
      set(this.extra, [[-ux * ex, -d + uy * ex], [0, -d], [ux * ex, -d + uy * ex]], lat);
    }
    this.monitor.visible = (P.monitor || 0) > 0.01;
  }
}

/** World position of a point at radius r on the incident (side −1) or diffracted (+1) arm at angle θ [deg]. */
export const arm = (side, r, th, dy = 0) => [side * r * Math.cos(th * rad) - dy * Math.sin(th * rad) * side, r * Math.sin(th * rad) + dy * Math.cos(th * rad), 0];
