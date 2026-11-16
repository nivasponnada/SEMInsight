// Three.js scene: a half-sectioned Schottky FEG-SEM column, the beam, and the emitted signals.
// The column axis is +y (gun on top), the specimen surface is the plane y = 0 and the
// section plane is z = 0 (the half with z > 0 is the removable "cover").
import { Scene3D, THREE, V3, lerp, TAU, SIG } from './core/scene3d.js';
import { drawKikuchi } from './plots.js';


// Beam envelope nodes [y, radius]; radii are exaggerated ~1000× so the optics are visible.
const AP_Y = 5.3, PIVOT_Y = 1.25, TIP_Y = 9.97;
const ENV_UP = [[TIP_Y, 0.003], [9.74, 0.035], [9.05, 0.065], [7.6, 0.17], [6.9, 0.012], [6.3, 0.12], [5.75, 0.01], [AP_Y, 0.085]];
const ENV_LO = [[AP_Y, 0.012], [PIVOT_Y, 0.12], [0, 0.004]];
function envR(nodes, y) {
  for (let i = 0; i < nodes.length - 1; i++) {
    const [ya, ra] = nodes[i], [yb, rb] = nodes[i + 1];
    if (y <= ya && y >= yb) return lerp(ra, rb, (ya - y) / (ya - yb));
  }
  return 0;
}
const SCAN_AMP = 0.07;
const ETD_POS = V3(1.32, 0.62, -0.2);

export class Column extends Scene3D {
  build() {
    this.scanPos = { x: 0, z: 0 };
    this._build();
    this._buildBeam();
    this._buildParticles();
    this._buildExtras();
  }

  // ---------------------------------------------------------------- the instrument
  _build() {
    const M = this.M;
    // --- gun chamber
    this._rev([[0, 11.2], [1.3, 11.2], [1.3, 8.62], [1.15, 8.62], [1.15, 11.05], [0, 11.05]], M.body, M.cut);
    this._rev([[0.22, 11.05], [0.62, 11.05], [0.4, 10.42], [0.2, 10.42]], M.ceramic, M.ceramic);
    this._rev([[0.11, 10.02], [0.4, 10.02], [0.4, 10.44], [0.34, 10.44], [0.34, 10.08], [0.11, 10.08]], M.steel, M.cut); // suppressor
    this._rev([[0.06, 9.7], [0.72, 9.7], [0.72, 9.9], [0.66, 9.9], [0.66, 9.76], [0.06, 9.76]], M.steel, M.cut); // extractor
    this._rev([[0.085, 9.0], [1.15, 9.0], [1.15, 9.08], [0.3, 9.08], [0.085, 9.16]], M.iron, M.ironCut); // anode
    this._rev([[0.12, 8.62], [1.15, 8.62], [1.15, 8.7], [0.12, 8.7]], M.dark, M.cut); // isolation valve seat
    // emitter: hairpin, needle, ZrO reservoir
    this._rod(V3(-0.13, 10.5, 0), V3(0, 10.2, 0), 0.012, M.tip);
    this._rod(V3(0.13, 10.5, 0), V3(0, 10.2, 0), 0.012, M.tip);
    const needle = this._mesh(new THREE.ConeGeometry(0.03, 0.24, 16), M.tip, [0, 10.09, 0]); needle.rotation.x = Math.PI;
    this._mesh(new THREE.SphereGeometry(0.035, 16, 12), M.ceramic, [0, 10.13, 0]);
    this.tipLight = new THREE.PointLight(0xff7a30, 1.2, 2.2); this.tipLight.position.set(0, 9.95, 0.15); this.root.add(this.tipLight);
    // ion getter pumps
    for (const [y, s] of [[10.0, 1], [6.9, 0.8]]) {
      this._mesh(new THREE.BoxGeometry(1.0 * s, 1.25 * s, 1.0 * s), M.dark, [-2.15, y, -0.2]);
      this._mesh(new THREE.BoxGeometry(0.16, 1.4 * s, 1.12 * s), M.iron, [-2.15, y, -0.2]);
      this._rod(V3(-1.25, y, -0.2), V3(-1.7, y, -0.2), 0.2 * s, M.body);
    }
    // --- column housing
    this._rev([[1.15, 8.62], [1.3, 8.62], [1.3, 2.8], [1.15, 2.8]], M.body, M.cut);
    this._lens(7.6, 0.95, 0.25, 1.12, 0.14);
    this._lens(6.3, 0.85, 0.25, 1.12, 0.14);
    // aperture strip with four selectable holes + drive rod
    {
      const sh = new THREE.Shape([new THREE.Vector2(-1.25, -0.09), new THREE.Vector2(0.25, -0.09), new THREE.Vector2(0.25, 0.09), new THREE.Vector2(-1.25, 0.09)]);
      [[0, 0.02], [-0.16, 0.032], [-0.34, 0.045], [-0.54, 0.06]].forEach(([x, r]) => { const h = new THREE.Path(); h.absarc(x, 0, r, 0, TAU, true); sh.holes.push(h); });
      const strip = this._mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false, curveSegments: 20 }), M.steel, [0, AP_Y - 0.01, 0]);
      strip.rotation.x = Math.PI / 2;
      this._rod(V3(-1.25, AP_Y - 0.02, 0), V3(-1.75, AP_Y - 0.02, 0), 0.035, M.steel);
      this._rod(V3(-1.3, AP_Y - 0.02, 0), V3(-1.62, AP_Y - 0.02, 0), 0.12, M.dark);
      this._rod(V3(-1.62, AP_Y - 0.02, 0), V3(-1.85, AP_Y - 0.02, 0), 0.16, M.iron);
    }
    // alignment coils, stigmator (octupole), scan coils (two saddle-coil decks)
    const deg = Math.PI / 180;
    for (let k = 0; k < 4; k++) {
      const front = k < 2;
      this._arc([[0.36, 4.86], [0.46, 4.86], [0.46, 5.04], [0.36, 5.04]], front ? this._coverMat(M.copper) : M.copper, front ? null : M.copperCut, (k * 90 + 10) * deg, 70 * deg, front ? this.cover : this.root, 10);
    }
    for (let k = 0; k < 8; k++) {
      const front = k < 2 || k > 5;
      this._arc([[0.3, 4.47], [0.4, 4.47], [0.4, 4.73], [0.3, 4.73]], front ? this._coverMat(M.copper) : M.copper, front ? null : M.copperCut, (k * 45 + 8 - 90) * deg + Math.PI / 2, 29 * deg, front ? this.cover : this.root, 6);
    }
    for (const y of [3.9, 3.3]) for (let k = 0; k < 4; k++) {
      const front = k < 2;
      this._arc([[0.34, y - 0.2], [0.47, y - 0.2], [0.47, y + 0.2], [0.34, y + 0.2]], front ? this._coverMat(M.copper) : M.copper, front ? null : M.copperCut, (k * 90 + 6) * deg, 78 * deg, front ? this.cover : this.root, 12);
    }
    // --- objective lens: conical pole piece, gap at the bottom, coil in the cavity
    this._rev([[0.22, 2.8], [1.3, 2.8], [1.3, 2.1], [0.42, 1.0], [0.3, 1.0], [0.34, 1.2], [1.12, 2.2], [1.12, 2.62], [0.4, 2.62], [0.4, 1.3], [0.22, 1.3]], M.iron, M.ironCut);
    this._rev([[0.47, 2.55], [1.05, 2.55], [1.05, 2.25], [0.47, 1.52]], M.copper, M.copperCut);
    this._rev([[0.19, 2.9], [0.3, 2.9], [0.3, 2.97], [0.19, 2.97]], M.se, M.se); // in-lens SE detector
    // --- specimen chamber
    this._rev([[1.3, 2.6], [3.2, 2.6], [3.2, -2.2], [0, -2.2], [0, -2.05], [3.05, -2.05], [3.05, 2.45], [1.3, 2.45]], M.body, M.cut);
    this._rev([[0.14, 0.9], [0.56, 0.9], [0.56, 0.935], [0.14, 0.935]], M.bse, M.bse); // annular BSE
    // stage: z / xy / rotation stack, then the eucentric tilt cradle carrying the stub
    this._mesh(new THREE.BoxGeometry(2.6, 0.22, 1.9), M.dark, [0, -1.94, 0]);
    this._mesh(new THREE.BoxGeometry(2.1, 0.2, 1.5), M.iron, [0.1, -1.72, 0]);
    this._mesh(new THREE.BoxGeometry(1.6, 0.2, 1.2), M.dark, [0, -1.5, 0.05]);
    this._mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.36, 32), M.iron, [0, -1.22, 0]);
    this.tilt = new THREE.Group(); this.root.add(this.tilt);
    this._mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.8, 20), M.steel, [0, -0.62, 0], this.tilt);
    this._mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 32), M.steel, [0, -0.2, 0], this.tilt);
    this._mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 32), M.dark, [0, -0.1, 0], this.tilt);
    this.specimen = this._mesh(new THREE.BoxGeometry(0.56, 0.05, 0.46), M.specimen, [0, -0.025, 0], this.tilt);
    // magnified block of specimen shown (sectioned) while the interaction volume is on screen
    this.blockMat = new THREE.MeshStandardMaterial({ color: 0x59616c, roughness: 0.45, metalness: 0.4, transparent: true, opacity: 0 });
    this.block = this._mesh(new THREE.BoxGeometry(1.5, 0.9, 0.7), this.blockMat, [0, -0.452, -0.351]);
    // turbomolecular pump
    this._mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.3, 32), M.dark, [1.7, -2.85, -0.4]);
    for (let i = 0; i < 5; i++) this._mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.05, 32), M.iron, [1.7, -2.35 - i * 0.2, -0.4]);
    this._mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 32), M.iron, [1.7, -2.22, -0.4]);

    // --- Everhart–Thornley detector and the signal chain (runs out along +x)
    const z = ETD_POS.z, y = ETD_POS.y;
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.34, 14, 3, true), new THREE.MeshBasicMaterial({ color: SIG.se, wireframe: true, transparent: true, opacity: 0.5 }));
    cage.rotation.z = Math.PI / 2; cage.position.set(1.5, y, z); this.root.add(cage);
    this._rod(V3(1.68, y, z), V3(1.72, y, z), 0.17, this.M.scint);
    this._rod(V3(1.72, y, z), V3(3.3, y, z), 0.13, this.M.glass);
    this._rod(V3(1.66, y, z), V3(1.74, y, z), 0.21, M.steel);
    this._rod(V3(3.0, y, z), V3(3.3, y, z), 0.3, M.iron);
    this._rod(V3(3.3, y, z), V3(4.5, y, z), 0.27, M.dark);
    for (let i = 0; i < 9; i++) this._rod(V3(3.42 + i * 0.115, y, z), V3(3.45 + i * 0.115, y, z), 0.285, M.iron);
    this._mesh(new THREE.BoxGeometry(0.62, 0.5, 0.5), M.dark, [5.2, 0.2, z]);
    this._mesh(new THREE.BoxGeometry(0.62, 0.5, 0.5), M.dark, [6.0, 0.2, z]);
    this._mesh(new THREE.BoxGeometry(0.5, 0.04, 0.52), M.se, [5.2, 0.47, z]);
    this._mesh(new THREE.BoxGeometry(0.5, 0.04, 0.52), M.scint, [6.0, 0.47, z]);
    this.chain = [V3(1.7, y, z), V3(4.5, y, z), V3(4.75, 0.2, z), V3(6.3, 0.2, z), V3(6.33, 0.6, 0)];
    this._rod(this.chain[1], this.chain[2], 0.025, M.steel);
    this._rod(this.chain[2], this.chain[3], 0.025, M.steel);
    this._rod(this.chain[3], this.chain[4], 0.025, M.steel);

    // --- EDS: silicon drift detector on a 35° take-off axis
    const ed = V3(-Math.cos(35 * deg) * Math.cos(0.35), Math.sin(35 * deg), -Math.cos(35 * deg) * Math.sin(0.35));
    this.edsDir = ed;
    this._rod(ed.clone().multiplyScalar(1.15), ed.clone().multiplyScalar(3.5), 0.11, M.steel);
    this._rod(ed.clone().multiplyScalar(1.1), ed.clone().multiplyScalar(1.16), 0.09, M.xray);
    this._rod(ed.clone().multiplyScalar(3.5), ed.clone().multiplyScalar(4.7), 0.3, M.dark);

    // --- EBSD: phosphor screen + camera, inserted from the back
    this.ebsd = new THREE.Group(); this.root.add(this.ebsd);
    this.kCanvas = document.createElement('canvas'); this.kCanvas.width = 256; this.kCanvas.height = 256;
    drawKikuchi(this.kCanvas, 0.3, 20, true);
    this.kTex = new THREE.CanvasTexture(this.kCanvas); this.kTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.CircleGeometry(0.62, 48), new THREE.MeshBasicMaterial({ map: this.kTex }));
    screen.position.set(0, 0.5, 0.011); this.ebsd.add(screen);
    const bez = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.08, 48), M.dark); bez.rotation.x = Math.PI / 2; bez.position.set(0, 0.5, -0.04); this.ebsd.add(bez);
    const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.6, 32), M.dark); cam.rotation.x = Math.PI / 2; cam.position.set(0, 0.5, -0.88); this.ebsd.add(cam);

    // --- display fed by the digitiser
    this.monitorCanvas = document.createElement('canvas'); this.monitorCanvas.width = 512; this.monitorCanvas.height = 442;
    this.monitorTex = new THREE.CanvasTexture(this.monitorCanvas); this.monitorTex.colorSpace = THREE.SRGBColorSpace;
    this.monitor = new THREE.Group(); this.monitor.position.set(7.75, 0.95, 0); this.root.add(this.monitor);
    this.monitor.add(new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8 * 442 / 512), new THREE.MeshBasicMaterial({ map: this.monitorTex, toneMapped: false })));
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.62, 0.12), M.dark); frame.position.z = -0.07; this.monitor.add(frame);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.6), M.dark); stand.position.set(0, -1.52, -0.1); this.monitor.add(stand);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.1), M.dark); neck.position.set(0, -1.38, -0.14); this.monitor.add(neck);
  }

  // ---------------------------------------------------------------- beam
  _buildBeam() {
    const RS = 14;
    const mk = (nodes, sub) => {
      const ys = [];
      for (let i = 0; i < nodes.length - 1; i++) for (let k = 0; k < sub; k++) ys.push(lerp(nodes[i][0], nodes[i + 1][0], k / sub));
      ys.push(nodes[nodes.length - 1][0]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ys.length * RS * 3), 3));
      const idx = [];
      for (let j = 0; j < ys.length - 1; j++) for (let k = 0; k < RS; k++) {
        const a = j * RS + k, b = j * RS + ((k + 1) % RS), c = a + RS, d = b + RS;
        idx.push(a, c, b, b, c, d);
      }
      geo.setIndex(idx);
      const mat = new THREE.MeshBasicMaterial({ color: SIG.beam, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; this.root.add(mesh);
      return { ys, geo, nodes, mesh };
    };
    this.beamUp = mk(ENV_UP, 5);
    this.beamLo = mk(ENV_LO, 14);
    this.RS = RS;
    // bright axis line
    this.axisGeo = new THREE.BufferGeometry();
    this.axisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3));
    this.axis = new THREE.Line(this.axisGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.axis.frustumCulled = false; this.axis.renderOrder = 6; this.root.add(this.axis);
    // landing spot
    this.spot = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.spot.renderOrder = 7; this.root.add(this.spot);
  }
  /** Beam centre offset at height y for the current scan position. */
  _centre(y, out) {
    const { x, z } = this.scanPos;
    let k = 0;
    if (y < 3.9) {
      const kLo = -(Math.min(y, 3.3) - PIVOT_Y) / PIVOT_Y;
      k = y >= 3.3 ? kLo * ((3.9 - y) / 0.6) : kLo;
    }
    out.x = x * k; out.z = z * k;
    return out;
  }
  _updateBeam(front) {
    const c = { x: 0, z: 0 }, RS = this.RS;
    for (const b of [this.beamUp, this.beamLo]) {
      const pos = b.geo.attributes.position.array;
      const top = b.nodes[0][0];
      b.mesh.visible = front < top - 1e-3;
      if (!b.mesh.visible) continue;
      for (let j = 0; j < b.ys.length; j++) {
        const y = Math.max(b.ys[j], front);
        const r = envR(b.nodes, y);
        this._centre(y, c);
        for (let k = 0; k < RS; k++) {
          const a = (k / RS) * TAU, o = (j * RS + k) * 3;
          pos[o] = c.x + Math.cos(a) * r; pos[o + 1] = y; pos[o + 2] = c.z + Math.sin(a) * r;
        }
      }
      b.geo.attributes.position.needsUpdate = true;
    }
    const ap = this.axisGeo.attributes.position.array;
    for (let i = 0; i < 40; i++) {
      const y = Math.max(lerp(TIP_Y, 0, i / 39), front);
      this._centre(y, c);
      ap[i * 3] = c.x; ap[i * 3 + 1] = y; ap[i * 3 + 2] = c.z;
    }
    this.axisGeo.attributes.position.needsUpdate = true;
    this.axis.visible = front < TIP_Y - 0.01;
    this.landed = front <= 0.001;
    this.spot.visible = this.landed;
    this.spot.position.set(this.scanPos.x, 0.005, this.scanPos.z);
  }

  // ---------------------------------------------------------------- particles
  _buildParticles() {
    this.eUp = this._points(260, 0xdff8ff, 0.035);
    this.eLo = this._points(150, 0xdff8ff, 0.03);
    for (const s of [this.eUp, this.eLo]) s.st.forEach((p) => { p.u = Math.random(); p.rho = Math.sqrt(Math.random()); p.a = Math.random() * TAU; });
    this.pSE = this._points(160, SIG.se, 0.05);
    this.pBSE = this._points(90, SIG.bse, 0.06);
    this.pX = this._points(70, SIG.xray, 0.05);
    this.pPh = this._points(60, SIG.light, 0.06);
    this.pPh.st.forEach((p) => { p.u = Math.random(); p.j = Math.random(); });
    this.pGas = this._points(320, 0xc58bff, 0.045);
    this.pGas.st.forEach((p, i) => {
      const r = Math.sqrt(Math.random()) * 2.7, a = Math.random() * TAU;
      p.x = Math.cos(a) * r; p.y = lerp(-1.4, 2.2, Math.random()); p.z = -Math.abs(Math.sin(a) * r) * 0.9 + 0.2; p.ph = Math.random() * TAU; p.sp = 0.3 + Math.random();
    });
  }
  _spawnSignal(p, kind) {
    const tilt = this.params.tilt || 0;
    p.age = 0;
    p.x = this.scanPos.x; p.y = 0.01; p.z = this.scanPos.z;
    // cosine-weighted direction about the surface normal
    const u = Math.random(), a = Math.random() * TAU;
    const st = Math.sqrt(u), ct = Math.sqrt(1 - u);
    let dx = st * Math.cos(a), dy = ct, dz = st * Math.sin(a);
    if (kind === 'se') { p.sp = 0.9 + Math.random() * 0.6; p.life = 2.6; }
    else if (kind === 'bse') {
      p.sp = 3.2 + Math.random(); p.life = 1.2;
      if (tilt > 0.5) { // forward-scattered towards the EBSD screen
        const tx = (Math.random() - 0.5) * 1.0, ty = 0.5 + (Math.random() - 0.5) * 1.0, tz = -1.7;
        const l = Math.hypot(tx, ty, tz); dx = tx / l; dy = ty / l; dz = tz / l;
      } else { dx *= 0.75; dz *= 0.75; const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l; }
    } else {
      p.sp = 4.5; p.life = 1.0;
      if (Math.random() < 0.55) { // those inside the detector's solid angle
        const e = this.edsDir; dx = e.x + (Math.random() - 0.5) * 0.09; dy = e.y + (Math.random() - 0.5) * 0.09; dz = e.z + (Math.random() - 0.5) * 0.09;
        p.hit = true;
      } else p.hit = false;
    }
    p.vx = dx * p.sp; p.vy = dy * p.sp; p.vz = dz * p.sp;
  }
  _updateParticles(dt, front) {
    const P = this.params, c = { x: 0, z: 0 };
    // primary electrons riding the envelope
    const flow = (set, nodes, y0, y1, speed) => {
      for (let i = 0; i < set.n; i++) {
        const p = set.st[i];
        p.u += dt * speed * (0.8 + 0.4 * p.rho);
        if (p.u > 1) { p.u -= 1; p.rho = Math.sqrt(Math.random()); p.a = Math.random() * TAU; }
        const y = lerp(y0, y1, p.u), o = i * 3;
        if (y < front) { set.pos[o + 1] = 999; continue; }
        const r = envR(nodes, y) * p.rho;
        this._centre(y, c);
        set.pos[o] = c.x + Math.cos(p.a) * r; set.pos[o + 1] = y; set.pos[o + 2] = c.z + Math.sin(p.a) * r;
      }
      set.geo.attributes.position.needsUpdate = true;
    };
    flow(this.eUp, ENV_UP, TIP_Y, AP_Y, 0.3);
    flow(this.eLo, ENV_LO, AP_Y, 0, 0.3);

    const sig = (set, kind, weight) => {
      set.mat.opacity = Math.min(1, weight * 1.2);
      set.obj.visible = weight > 0.01 && this.landed;
      if (!set.obj.visible) return;
      const active = Math.ceil(set.n * Math.min(1, weight));
      for (let i = 0; i < set.n; i++) {
        const p = set.st[i], o = i * 3;
        p.age += dt;
        if (p.age > p.life) {
          if (i < active && Math.random() < dt * 4) this._spawnSignal(p, kind); else { set.pos[o + 1] = 999; continue; }
        }
        if (kind === 'se') { // drawn towards the positively biased cage
          const ex = ETD_POS.x - p.x, ey = ETD_POS.y - p.y, ez = ETD_POS.z - p.z, d = Math.hypot(ex, ey, ez);
          if (d < 0.16) { p.age = 1e9; set.pos[o + 1] = 999; continue; }
          const k = 2.4 / (0.35 + d * 0.6);
          p.vx += (ex / d) * k * dt; p.vy += (ey / d) * k * dt; p.vz += (ez / d) * k * dt;
          const damp = Math.exp(-dt * 0.9); p.vx *= damp; p.vy *= damp; p.vz *= damp;
        }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (kind === 'bse' && !(P.tilt > 0.5)) {
          const r = Math.hypot(p.x, p.z);
          if (p.y > 0.9 && r > 0.13) p.age = 1e9; // absorbed by the annular detector / pole piece
        }
        if (kind === 'bse' && P.tilt > 0.5 && p.z < -1.62) p.age = 1e9;
        if (kind === 'x' && p.hit && Math.hypot(p.x, p.y, p.z) > 1.12) p.age = 1e9;
        if (p.y < 0 && !(P.tilt > 0.5)) p.age = 1e9;
        set.pos[o] = p.x; set.pos[o + 1] = p.y; set.pos[o + 2] = p.z;
      }
      set.geo.attributes.position.needsUpdate = true;
    };
    sig(this.pSE, 'se', P.se || 0);
    sig(this.pBSE, 'bse', P.bse || 0);
    sig(this.pX, 'x', P.xray || 0);

    // photons / electrical signal running down the chain
    const ph = this.pPh; const w = P.photons || 0;
    ph.obj.visible = w > 0.01; ph.mat.opacity = w;
    if (ph.obj.visible) {
      const segs = this.chain, lens = [], tot = segs.slice(1).reduce((s, v, i) => { const l = v.distanceTo(segs[i]); lens.push(l); return s + l; }, 0);
      for (let i = 0; i < ph.n; i++) {
        const p = ph.st[i]; p.u = (p.u + dt * 0.22) % 1;
        let d = p.u * tot, k = 0; while (k < lens.length - 1 && d > lens[k]) d -= lens[k++];
        const a = segs[k], b = segs[k + 1], t = d / lens[k], j = k === 0 ? 0.09 : 0.012, o = i * 3;
        ph.pos[o] = lerp(a.x, b.x, t); ph.pos[o + 1] = lerp(a.y, b.y, t) + Math.sin(p.j * 40 + p.u * 60) * j; ph.pos[o + 2] = lerp(a.z, b.z, t) + Math.cos(p.j * 33 + p.u * 50) * j;
      }
      ph.geo.attributes.position.needsUpdate = true;
    }
    // residual gas
    const gas = this.pGas; const gw = P.gas || 0;
    gas.obj.visible = gw > 0.01; gas.mat.opacity = gw * 0.7;
    if (gas.obj.visible) {
      const t = this.time;
      for (let i = 0; i < gas.n; i++) {
        const p = gas.st[i], o = i * 3;
        gas.pos[o] = p.x + Math.sin(t * p.sp + p.ph) * 0.12; gas.pos[o + 1] = p.y + Math.cos(t * p.sp * 0.8 + p.ph * 2) * 0.12; gas.pos[o + 2] = p.z + Math.sin(t * p.sp * 0.6 + p.ph * 3) * 0.1;
      }
      gas.geo.attributes.position.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- extras
  _buildExtras() {
    // retarding-field equipotentials between pole piece and specimen
    this.field = new THREE.Group(); this.root.add(this.field);
    this.fieldMat = new THREE.LineBasicMaterial({ color: 0x5a9cff, transparent: true, opacity: 0 });
    for (let i = 1; i <= 7; i++) {
      const y = (i / 8) * 0.95, pts = [];
      for (let k = 0; k <= 48; k++) {
        const x = lerp(-1.1, 1.1, k / 48);
        const bulge = 0.16 * Math.exp(-((x / 0.3) ** 2)) * (y / 0.95) ** 2; // lines bulge into the bore
        const cone = Math.max(0, Math.abs(x) - 0.42) * 0.9 * (y / 0.95);
        pts.push(V3(x, y + bulge + cone * 0.6, 0));
      }
      this.field.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.fieldMat));
    }
    // Monte Carlo trajectories
    this.mcGeo = new THREE.BufferGeometry();
    this.mc = new THREE.LineSegments(this.mcGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false }));
    this.mc.renderOrder = 9; this.mc.frustumCulled = false; this.root.add(this.mc);
    this.mcCount = 0;
  }
  /** paths: [{pts: Float32Array (µm; z = depth), bse}], rangeUm: scale reference. */
  setMC(paths, rangeUm) {
    const s = 0.34 / rangeUm;
    const pos = [], col = [];
    const cA = new THREE.Color(0xbff6ff), cB = new THREE.Color(0x2a56ff), cR = new THREE.Color(SIG.bse), tmp = new THREE.Color();
    this.mcBreaks = [];
    for (const p of paths) {
      const n = p.pts.length / 3;
      for (let i = 0; i < n - 1; i++) {
        const o = i * 3;
        pos.push(p.pts[o] * s, -p.pts[o + 2] * s, p.pts[o + 1] * s, p.pts[o + 3] * s, -p.pts[o + 5] * s, p.pts[o + 4] * s);
        for (const t of [i / n, (i + 1) / n]) { if (p.bse) tmp.copy(cR); else tmp.copy(cA).lerp(cB, t); col.push(tmp.r, tmp.g, tmp.b); }
      }
      this.mcBreaks.push(pos.length / 3);
    }
    this.mcGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.mcGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.mcCount = pos.length / 3;
  }

  // ---------------------------------------------------------------- per-frame
  tick(state, dt) {
    const P = this.params;
    // scan raster
    const amp = SCAN_AMP * (P.scan || 0);
    const lineT = (this.time * 1.4) % 1, frameT = Math.floor(((this.time * 1.4) / 14) % 1 * 14) / 13;
    this.scanPos.x = amp * (2 * Math.min(1, lineT / 0.92) - 1);
    this.scanPos.z = -amp * 0.8 * (2 * frameT - 1);

    this.tilt.rotation.x = -(P.tilt || 0) * (70 * Math.PI) / 180;
    const e = P.ebsd || 0;
    this.ebsd.visible = e > 0.01; this.ebsd.position.set(0.1, 0.1, lerp(-3.6, -1.72, e));
    this.fieldMat.opacity = (P.field || 0) * 0.7; this.field.visible = (P.field || 0) > 0.01;
    this.blockMat.opacity = Math.min(1, (P.mc || 0) * 1.3); this.block.visible = (P.mc || 0) > 0.01;
    this.mc.material.opacity = (P.mc || 0) * 0.26; this.mc.visible = (P.mc || 0) > 0.01;
    if (this.mc.visible && this.mcBreaks?.length) {
      const n = Math.max(1, Math.round(this.mcBreaks.length * Math.min(1, 0.08 + state.f * 1.3)));
      this.mcGeo.setDrawRange(0, this.mcBreaks[Math.min(n, this.mcBreaks.length) - 1]);
    }
    this.tipLight.intensity = 1.0 + 0.25 * Math.sin(this.time * 9);
    this.monitor.visible = (P.photons || 0) > 0.01 || (P.monitor || 0) > 0.01;

    this._updateBeam(state.front);
    this._updateParticles(dt, state.front);
  }
}
