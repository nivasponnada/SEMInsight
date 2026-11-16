// Probe station: a silicon wafer on a chuck, with one measurement rig per technique
// descending onto it as the journey advances.
import { Scene3D, THREE, V3, lerp, TAU, SIG } from '../core/scene3d.js';

const RIGS = ['fpp', 'hall', 'mos', 'fet', 'ellip', 'optic', 'sims'];

export class SemiScene extends Scene3D {
  build() {
    const M = this.M;
    // --- chuck and wafer (150 mm with a primary flat)
    this._mesh(new THREE.CylinderGeometry(3.5, 3.7, 0.5, 64), M.dark, [0, -0.36, 0]);
    this._mesh(new THREE.CylinderGeometry(3.25, 3.25, 0.08, 64), M.iron, [0, -0.08, 0]);
    this._mesh(new THREE.CylinderGeometry(1.2, 1.6, 1.0, 32), M.body, [0, -1.1, 0]);
    this._box(7.6, 0.3, 5.2, M.dark, [0, -1.75, 0]);
    const sh = new THREE.Shape(); const fl = 0.42; // flat half-angle
    sh.absarc(0, 0, 3, -Math.PI / 2 + fl, (3 * Math.PI) / 2 - fl, false); sh.closePath();
    const wafer = this._mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.035, bevelEnabled: false, curveSegments: 96 }), M.silicon, [0, 0, 0]);
    wafer.rotation.x = -Math.PI / 2; this.wafer = wafer;
    // die grid on the wafer
    const grid = [];
    for (let i = -6; i <= 6; i++) { const x = i * 0.42, hgt = Math.sqrt(Math.max(0, 8.4 - x * x)); grid.push(V3(x, 0.04, -hgt), V3(x, 0.04, Math.min(hgt, 2.7)), V3(-hgt, 0.04, x), V3(hgt, 0.04, x)); }
    const gl = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(grid), new THREE.LineBasicMaterial({ color: 0x9fb4c8, transparent: true, opacity: 0.22 })); this.root.add(gl);

    this.rig = {};
    for (const k of RIGS) { const g = new THREE.Group(); this.root.add(g); this.rig[k] = g; }

    // --- four-point probe head
    {
      const g = this.rig.fpp;
      this._box(1.5, 0.5, 0.6, M.dark, [0, 1.5, 0], g); this._rod(V3(0, 1.75, 0), V3(0, 3.2, 0), 0.12, M.body, g);
      this.fppCur = [];
      for (let i = 0; i < 4; i++) {
        const x = (i - 1.5) * 0.36;
        this._rod(V3(x, 1.25, 0), V3(x, 0.22, 0), 0.035, M.steel, g);
        const tip = this._mesh(new THREE.ConeGeometry(0.035, 0.2, 12), i === 0 || i === 3 ? M.bse : M.se, [x, 0.13, 0], g); tip.rotation.x = Math.PI;
      }
      // current streamlines between the outer probes, inside the wafer plane
      for (let k = -3; k <= 3; k++) { const pts = []; for (let i = 0; i <= 24; i++) { const u = i / 24, x = lerp(-0.54, 0.54, u); pts.push(V3(x, 0.045, k * 0.2 * Math.sin(Math.PI * u))); } this.fppCur.push(this._line(pts, SIG.bse, 0.8, g)); }
    }
    // --- Hall effect: van der Pauw square between magnet poles
    {
      const g = this.rig.hall;
      this._box(1.3, 0.05, 1.3, this._std(0x7f8aa0, { roughness: 0.25, metalness: 0.7 }), [0, 0.12, 0], g);
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { this._box(0.16, 0.03, 0.16, M.gold, [x * 0.57, 0.16, z * 0.57], g); this._rod(V3(x * 0.57, 0.17, z * 0.57), V3(x * 1.3, 0.9, z * 1.3), 0.015, M.gold, g); }
      this._mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.7, 40), M.iron, [0, 1.9, 0], g); this._mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.3, 40), M.copper, [0, 2.3, 0], g);
      this._rod(V3(0, 2.4, 0), V3(0, 3.4, 0), 0.3, M.body, g);
      this.hallB = [];
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) this.hallB.push(this._line([V3(i * 0.35, 1.5, j * 0.35), V3(i * 0.35, 0.2, j * 0.35)], 0x5a9cff, 0.7, g));
      this.hallE = this._points(60, SIG.beam, 0.06); g.add(this.hallE.obj);
      this.hallE.st.forEach((p) => { p.u = Math.random(); p.z = (Math.random() - 0.5) * 1.0; });
    }
    // --- magnified MOS capacitor cross-section (C–V, DLTS)
    {
      const g = this.rig.mos; g.position.set(0, 0, 0);
      const B = new THREE.Group(); B.position.set(0, 1.9, 0); g.add(B); this.mosB = B;
      this._box(3.2, 1.3, 1.2, this._std(0x59616c, { roughness: 0.4, metalness: 0.4 }), [0, -0.65, 0], B);            // p-Si
      this._box(3.2, 0.12, 1.2, this._std(0x7fc4e8, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.75 }), [0, 0.06, 0], B); // oxide
      this._box(2.0, 0.14, 1.0, M.gold, [0, 0.19, 0], B);                                                                // gate
      this._box(3.2, 0.06, 1.2, M.steel, [0, -1.33, 0], B);                                                             // back contact
      this.depl = this._mesh(new THREE.BoxGeometry(2.0, 1, 1.21), new THREE.MeshBasicMaterial({ color: 0xffc730, transparent: true, opacity: 0.28, depthWrite: false }), [0, -0.3, 0], B);
      this.inv = this._mesh(new THREE.BoxGeometry(2.0, 0.035, 1.22), new THREE.MeshBasicMaterial({ color: SIG.beam, transparent: true, opacity: 0 }), [0, -0.02, 0], B);
      this._rod(V3(0, 0.26, 0), V3(0, 1.3, 0), 0.03, M.steel, B);
      this.traps = this._points(40, 0xff6b9d, 0.09); B.add(this.traps.obj);
      this.traps.st.forEach((p) => { p.x = (Math.random() - 0.5) * 1.9; p.y = -0.08 - Math.random() * 0.5; p.z = 0.62; p.ph = Math.random() * TAU; });
      this._line([V3(-1.0, 1.25, 0), V3(-0.3, 0.06, 0)], 0xf6f4f2, 0.25, g); this._line([V3(1.0, 1.25, 0), V3(0.3, 0.06, 0)], 0xf6f4f2, 0.25, g);
    }
    // --- magnified MOSFET cross-section (I–V)
    {
      const g = this.rig.fet;
      const B = new THREE.Group(); B.position.set(0, 1.9, 0); g.add(B);
      this._box(3.6, 1.3, 1.2, this._std(0x59616c, { roughness: 0.4, metalness: 0.4 }), [0, -0.65, 0], B);
      const nplus = this._std(0x3f7fd0, { roughness: 0.4, metalness: 0.3 });
      this._box(1.0, 0.4, 1.21, nplus, [-1.25, -0.2, 0], B); this._box(1.0, 0.4, 1.21, nplus, [1.25, -0.2, 0], B);
      this._box(1.7, 0.08, 1.2, this._std(0x7fc4e8, { transparent: true, opacity: 0.75, roughness: 0.15, metalness: 0.1 }), [0, 0.04, 0], B);
      this._box(1.5, 0.3, 1.0, M.gold, [0, 0.23, 0], B);
      this._box(0.6, 0.12, 1.0, M.steel, [-1.4, 0.06, 0], B); this._box(0.6, 0.12, 1.0, M.steel, [1.4, 0.06, 0], B);
      this.chan = this._mesh(new THREE.BoxGeometry(1.5, 0.04, 1.22), new THREE.MeshBasicMaterial({ color: SIG.beam, transparent: true, opacity: 0.8 }), [0, -0.02, 0], B);
      this.fetE = this._points(50, 0xdff8ff, 0.07); B.add(this.fetE.obj);
      this.fetE.st.forEach((p) => { p.u = Math.random(); p.z = 0.62; });
      for (const x of [-1.4, 0, 1.4]) this._rod(V3(x, x ? 0.12 : 0.38, 0), V3(x, 1.3, 0), 0.03, M.steel, B);
      this._line([V3(-1.0, 1.25, 0), V3(-0.3, 0.06, 0)], 0xf6f4f2, 0.25, g); this._line([V3(1.0, 1.25, 0), V3(0.3, 0.06, 0)], 0xf6f4f2, 0.25, g);
    }
    // --- ellipsometer: polariser arm and analyser arm at 70° incidence
    {
      const g = this.rig.ellip, a = (70 * Math.PI) / 180;
      const dirL = V3(-Math.sin(a), Math.cos(a), 0), dirR = V3(Math.sin(a), Math.cos(a), 0);
      for (const [d, mat] of [[dirL, M.dark], [dirR, M.dark]]) {
        this._rod(d.clone().multiplyScalar(2.2), d.clone().multiplyScalar(3.6), 0.26, mat, g);
        this._rod(d.clone().multiplyScalar(1.9), d.clone().multiplyScalar(2.2), 0.2, M.steel, g);
        this._rod(d.clone().multiplyScalar(1.55), d.clone().multiplyScalar(1.62), 0.22, this._std(0x9fd0ff, { transparent: true, opacity: 0.5, roughness: 0.1 }), g);
      }
      this.ellIn = this._rod(dirL.clone().multiplyScalar(1.9), V3(0, 0.04, 0), 0.02, new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.9 }), g);
      this.ellOut = this._rod(V3(0, 0.04, 0), dirR.clone().multiplyScalar(1.9), 0.02, new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.9 }), g);
      // polarisation ellipse travelling on the reflected beam
      const pts = []; for (let i = 0; i <= 48; i++) pts.push(V3(0, Math.cos((i / 48) * TAU) * 0.16, Math.sin((i / 48) * TAU) * 0.16));
      this.ellipse = this._line(pts, 0xffc730, 1, g); this.ellDir = dirR;
      this.lin = this._line([V3(0, -0.16, 0), V3(0, 0.16, 0)], 0xffc730, 1, g); this.linDir = dirL;
      this._mesh(new THREE.TorusGeometry(3.7, 0.08, 8, 48, Math.PI), M.body, [0, 0, -0.5], g);
    }
    // --- optical head (PL, Raman): objective above the wafer, laser down, emission up
    {
      const g = this.rig.optic;
      this._mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.7, 32), M.steel, [0, 1.25, 0], g);
      this._mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.0, 32), M.dark, [0, 2.1, 0], g);
      this._box(2.4, 0.7, 0.8, M.dark, [0.9, 2.95, 0], g); this._box(1.2, 0.5, 0.6, M.body, [2.6, 2.95, 0], g);
      this.laserMat = new THREE.MeshBasicMaterial({ color: 0x38ff7a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
      const cone = this._mesh(new THREE.CylinderGeometry(0.17, 0.012, 0.86, 20, 1, true), this.laserMat, [0, 0.47, 0], g);
      this.spotMat = new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      this._mesh(new THREE.SphereGeometry(0.07, 12, 10), this.spotMat, [0, 0.06, 0], g);
      this.emit = this._points(70, 0xff5a4a, 0.07); g.add(this.emit.obj);
    }
    // --- SIMS: primary ion gun at 45°, crater, secondary ions extracted upward
    {
      const g = this.rig.sims, d = V3(-0.7, 0.7, 0).normalize();
      this._rod(d.clone().multiplyScalar(1.5), d.clone().multiplyScalar(3.4), 0.24, M.dark, g);
      this._rod(d.clone().multiplyScalar(1.1), d.clone().multiplyScalar(1.5), 0.12, M.steel, g);
      this.ionBeam = this._rod(d.clone().multiplyScalar(1.1), V3(0, 0.04, 0), 0.025, new THREE.MeshBasicMaterial({ color: 0xffc730, transparent: true, opacity: 0.9 }), g);
      this._mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 24), this._std(0x2a2d33, { roughness: 0.9 }), [0, 0.046, 0], g); // crater
      this._mesh(new THREE.CylinderGeometry(0.22, 0.4, 0.5, 24, 1, true), M.steel, [0, 1.0, 0], g);                          // extraction cone
      this._mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.5, 24), M.dark, [0, 2.1, 0], g);
      const prism = new THREE.Group(); prism.rotation.x = Math.PI / 2; prism.position.set(0.9, 2.85, 0); g.add(prism);
      this._arc([[0.6, -0.2], [1.2, -0.2], [1.2, 0.2], [0.6, 0.2]], M.iron, M.ironCut, Math.PI, Math.PI / 2, prism, 16);
      this._box(0.8, 0.5, 0.6, M.dark, [2.6, 3.75, 0], g);
      this.ions = this._points(80, 0xb7ff54, 0.07); g.add(this.ions.obj);
      this.ions.st.forEach((p) => { p.u = Math.random(); p.m = Math.random(); });
    }
    this.rigW = Object.fromEntries(RIGS.map((k) => [k, 0]));
  }

  tick(state, dt) {
    const P = this.params, f = state.f, t = this.time;
    for (const k of RIGS) {
      const w = P[k] || 0, g = this.rig[k];
      g.visible = w > 0.01; g.position.y = (1 - w) * (1 - w) * 5; g.scale.setScalar(0.6 + 0.4 * w);
    }
    // MOS: depletion width follows the gate bias sweep
    if (this.rig.mos.visible) {
      const bias = P.dlts ? 0.75 + 0.25 * Math.sin(t * 2.2) : Math.min(1, f * 1.2); // accumulation -> inversion
      const wd = 0.02 + 0.58 * Math.min(1, bias * 1.35);
      this.depl.scale.y = wd; this.depl.position.y = -wd / 2;
      this.inv.material.opacity = Math.max(0, (bias - 0.72) / 0.28) * 0.9 * (P.dlts ? 0 : 1);
      const tr = this.traps; tr.obj.visible = (P.dlts || 0) > 0.3;
      if (tr.obj.visible) { for (let i = 0; i < tr.n; i++) { const p = tr.st[i], o = i * 3, e = 0.5 + 0.5 * Math.sin(t * 2.2 + p.ph); tr.pos[o] = p.x; tr.pos[o + 1] = p.y + e * 0.25; tr.pos[o + 2] = p.z; } tr.geo.attributes.position.needsUpdate = true; }
    }
    if (this.rig.fet.visible) {
      const on = Math.min(1, Math.max(0, (f - 0.25) / 0.5));
      this.chan.material.opacity = on * 0.85; this.chan.scale.y = 0.4 + on;
      const e = this.fetE; e.mat.opacity = on;
      for (let i = 0; i < e.n; i++) { const p = e.st[i], o = i * 3; p.u = (p.u + dt * (0.15 + on * 0.9)) % 1; e.pos[o] = lerp(-0.9, 0.9, p.u); e.pos[o + 1] = -0.03; e.pos[o + 2] = p.z; }
      e.geo.attributes.position.needsUpdate = true;
    }
    if (this.rig.hall.visible) {
      const e = this.hallE;
      for (let i = 0; i < e.n; i++) { const p = e.st[i], o = i * 3; p.u = (p.u + dt * 0.5) % 1; e.pos[o] = lerp(-0.6, 0.6, p.u); e.pos[o + 1] = 0.17; e.pos[o + 2] = p.z * (1 - 0.55 * p.u) + 0.28 * p.u; } // Lorentz force piles carriers up on one edge
      e.geo.attributes.position.needsUpdate = true;
    }
    if (this.rig.ellip.visible) {
      const u = (t * 0.35) % 1;
      this.lin.position.copy(this.linDir).multiplyScalar(lerp(1.5, 0.3, u)); this.lin.quaternion.setFromUnitVectors(V3(1, 0, 0), this.linDir); this.lin.rotateX(0.78);
      this.ellipse.position.copy(this.ellDir).multiplyScalar(lerp(0.3, 1.5, u)); this.ellipse.quaternion.setFromUnitVectors(V3(1, 0, 0), this.ellDir);
      this.ellipse.scale.set(1, 1, 0.3 + 0.7 * Math.abs(Math.sin(f * 3.1)));
    }
    if (this.rig.optic.visible) {
      const raman = P.raman || 0;
      this.laserMat.color.setHex(raman > 0.5 ? 0x38ff7a : 0x5a8cff); this.spotMat.color.setHex(raman > 0.5 ? 0xffc730 : 0xff5a4a); this.emit.mat.color.setHex(raman > 0.5 ? 0xffc730 : 0xff5a4a);
      const e = this.emit;
      for (let i = 0; i < e.n; i++) {
        const p = e.st[i], o = i * 3; p.age += dt;
        if (p.age > p.life) { p.age = 0; p.life = 0.6 + Math.random() * 0.5; const a = Math.random() * TAU, r = Math.random(); p.vx = Math.cos(a) * r * 0.5; p.vz = Math.sin(a) * r * 0.5; p.vy = 0.6 + Math.random(); }
        e.pos[o] = p.vx * p.age; e.pos[o + 1] = 0.06 + p.vy * p.age; e.pos[o + 2] = p.vz * p.age;
      }
      e.geo.attributes.position.needsUpdate = true;
    }
    if (this.rig.sims.visible) {
      const e = this.ions;
      for (let i = 0; i < e.n; i++) {
        const p = e.st[i], o = i * 3; p.u = (p.u + dt * 0.3) % 1; const s = p.u * 5.6; // path length
        if (s < 2.85) { e.pos[o] = 0; e.pos[o + 1] = 0.05 + s; e.pos[o + 2] = 0; }
        else { const a = Math.min(Math.PI / 2, (s - 2.85) / (0.75 + p.m * 0.3)); const R = 0.75 + p.m * 0.3; e.pos[o] = 0.9 - 0.9 * Math.cos(a) + (R - 0.9) * (1 - Math.cos(a)) * 0.3; e.pos[o + 1] = 2.85 + R * Math.sin(a); e.pos[o + 2] = 0; if (a >= Math.PI / 2) e.pos[o] += (s - 2.85 - R * Math.PI / 2); }
      }
      e.geo.attributes.position.needsUpdate = true;
    }
  }
}
