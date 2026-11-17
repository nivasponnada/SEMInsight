// Shared Three.js base for every module: renderer, lights, materials, geometry helpers,
// camera choreography and label projection. Subclasses implement build() and tick().
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export { THREE };
export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;
export const SIG = { beam: '#8fe9ff', se: '#ffc730', bse: '#ff4b4b', xray: '#b08cff', light: '#b7ff54' };

export class Scene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.05, 200);
    this.camPos = V3(10, 7, 24); this.camTgt = V3(0, 4, 0);
    this.camera.position.copy(this.camPos);
    this.pointer = { x: 0, y: 0 };
    this.orbit = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 }; // user drag-to-orbit, eased; targets set by the engine
    this.params = {};
    this.shift = 0.15; this.shiftY = 0;
    this.time = 0;
    this.reduced = false;

    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x1c1a18, 0.7));
    const key = new THREE.DirectionalLight(0xfff0e0, 2.2); key.position.set(6, 12, 10); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fb4ff, 0.8); rim.position.set(-9, 4, 5); this.scene.add(rim);

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.cover = new THREE.Group(); this.root.add(this.cover);
    this.coverMats = [];
    this.coverTravel = 3.2;
    this._materials();
    this.build();
  }
  build() {}
  tick() {}

  // ---------------------------------------------------------------- materials
  _std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.55, side: THREE.DoubleSide, ...o }); }
  _materials() {
    const std = (c, o) => this._std(c, o);
    this.M = {
      body: std(0x4a4643),
      dark: std(0x2f2c2a, { roughness: 0.7 }),
      cut: std(0x6f6962, { roughness: 0.85, metalness: 0.15 }),
      iron: std(0x5a5550, { roughness: 0.5, metalness: 0.7 }),
      ironCut: std(0x8a827a, { roughness: 0.85, metalness: 0.1 }),
      copper: std(0xc9773a, { roughness: 0.42, metalness: 0.8 }),
      copperCut: std(0xe39a5b, { roughness: 0.75, metalness: 0.2 }),
      ceramic: std(0xe2dbd0, { roughness: 0.9, metalness: 0 }),
      steel: std(0x8d8881, { roughness: 0.35, metalness: 0.85 }),
      gold: std(0xd9a441, { roughness: 0.35, metalness: 0.9 }),
      tip: std(0xffb070, { emissive: 0xff5a1f, emissiveIntensity: 1.6, roughness: 0.4 }),
      se: std(0x3a3320, { emissive: new THREE.Color(SIG.se), emissiveIntensity: 0.55 }),
      bse: std(0x3a2020, { emissive: new THREE.Color(SIG.bse), emissiveIntensity: 0.55 }),
      xray: std(0x2c2540, { emissive: new THREE.Color(SIG.xray), emissiveIntensity: 0.6 }),
      scint: std(0x304020, { emissive: new THREE.Color(SIG.light), emissiveIntensity: 0.9 }),
      beamGlow: std(0x203038, { emissive: new THREE.Color(SIG.beam), emissiveIntensity: 0.7 }),
      glass: new THREE.MeshStandardMaterial({ color: 0xcfe8c0, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.28, emissive: new THREE.Color(SIG.light), emissiveIntensity: 0.12 }),
      specimen: std(0x77808c, { roughness: 0.3, metalness: 0.6, transparent: true }),
      silicon: std(0x5d6672, { roughness: 0.18, metalness: 0.85 }),
    };
  }
  _coverMat(mat) { const m = mat.clone(); m.transparent = true; this.coverMats.push(m); return m; }
  /** Emissive material in a signal colour. */
  _glow(color, intensity = 0.8, base = 0x222222) { return this._std(base, { emissive: new THREE.Color(color), emissiveIntensity: intensity }); }

  // ---------------------------------------------------------------- geometry helpers
  /** Solid of revolution over an arc with flat end caps. profile: [[r, y], ...] closed polygon. */
  _arc(profile, mat, capMat, phiStart, phiLen, parent, seg = 40) {
    const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
    pts.push(pts[0].clone());
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, seg, phiStart, phiLen), mat));
    if (capMat) {
      const shape = new THREE.Shape(profile.map(([r, y]) => new THREE.Vector2(r, y)));
      const sg = new THREE.ShapeGeometry(shape);
      for (const phi of [phiStart, phiStart + phiLen]) { const c = new THREE.Mesh(sg, capMat); c.rotation.y = phi - Math.PI / 2; g.add(c); }
    }
    parent.add(g);
    return g;
  }
  /** Half-sectioned body of revolution: kept half (z<0) with section faces + removable cover half. */
  _rev(profile, mat, capMat, { cover = true } = {}) {
    this._arc(profile, mat, capMat, Math.PI / 2, Math.PI, this.root);
    if (cover) this._arc(profile, this._coverMat(mat), null, -Math.PI / 2, Math.PI, this.cover);
  }
  _mesh(geo, mat, pos, parent = this.root) { const m = new THREE.Mesh(geo, mat); if (pos) m.position.set(...pos); parent.add(m); return m; }
  _box(w, h, d, mat, pos, parent = this.root) { return this._mesh(new THREE.BoxGeometry(w, h, d), mat, pos, parent); }
  /** Cylinder between two points. */
  _rod(a, b, r, mat, parent = this.root, seg = 20) {
    const d = b.clone().sub(a);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
    parent.add(m); return m;
  }
  /** Magnetic lens: iron yoke with a pole-piece gap facing the axis and a copper coil inside. */
  _lens(yc, h, rB, rO, gap, t = 0.11) {
    const a = yc + h / 2, b = yc - h / 2;
    this._rev([[rB, a], [rO, a], [rO, b], [rB, b], [rB, yc - gap / 2], [rB + t, yc - gap / 2], [rB + t, b + t], [rO - t, b + t], [rO - t, a - t], [rB + t, a - t], [rB + t, yc + gap / 2], [rB, yc + gap / 2]], this.M.iron, this.M.ironCut);
    const p = 0.045;
    this._rev([[rB + t + p, b + t + p], [rO - t - p, b + t + p], [rO - t - p, a - t - p], [rB + t + p, a - t - p]], this.M.copper, this.M.copperCut);
  }
  _line(pts, color, opacity = 1, parent = this.root) {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat); l.frustumCulled = false; parent.add(l); return l;
  }
  _dot() {
    if (this._dotTex) return this._dotTex;
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return (this._dotTex = new THREE.CanvasTexture(c));
  }
  _points(n, color, size, blending = THREE.AdditiveBlending) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3).fill(999), 3));
    const mat = new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 1, blending, depthWrite: false, map: this._dot() });
    const p = new THREE.Points(geo, mat); p.frustumCulled = false; p.renderOrder = 8; this.root.add(p);
    return { n, geo, pos: geo.attributes.position.array, mat, obj: p, st: Array.from({ length: n }, () => ({ age: 1e9, life: 0 })) };
  }
  /**
   * Translucent beam of circular section along +y: nodes [[y, r], ...] from top to bottom.
   * Returns { set(front, centreFn) } to redraw down to y = front.
   */
  _beam(nodes, sub = 6, color = SIG.beam, opacity = 0.3) {
    const RS = 14, ys = [];
    for (let i = 0; i < nodes.length - 1; i++) for (let k = 0; k < sub; k++) ys.push(lerp(nodes[i][0], nodes[i + 1][0], k / sub));
    ys.push(nodes[nodes.length - 1][0]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ys.length * RS * 3), 3));
    const idx = [];
    for (let j = 0; j < ys.length - 1; j++) for (let k = 0; k < RS; k++) { const a = j * RS + k, b = j * RS + ((k + 1) % RS), c = a + RS, d = b + RS; idx.push(a, c, b, b, c, d); }
    geo.setIndex(idx);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 5; this.root.add(mesh);
    const radius = (y) => {
      for (let i = 0; i < nodes.length - 1; i++) { const [ya, ra] = nodes[i], [yb, rb] = nodes[i + 1]; if (y <= ya && y >= yb) return lerp(ra, rb, (ya - y) / (ya - yb)); }
      return 0;
    };
    const c = { x: 0, z: 0 };
    return {
      mesh, mat, nodes, radius,
      set(front, centre) {
        const pos = geo.attributes.position.array;
        mesh.visible = front < nodes[0][0] - 1e-3;
        if (!mesh.visible) return;
        for (let j = 0; j < ys.length; j++) {
          const y = Math.max(ys[j], front), r = radius(y);
          if (centre) centre(y, c); else { c.x = 0; c.z = 0; }
          for (let k = 0; k < RS; k++) { const a = (k / RS) * TAU, o = (j * RS + k) * 3; pos[o] = c.x + Math.cos(a) * r; pos[o + 1] = y; pos[o + 2] = c.z + Math.sin(a) * r; }
        }
        geo.attributes.position.needsUpdate = true;
      },
    };
  }
  /** Canvas-backed texture. */
  _canvasTex(w, h) {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, tex };
  }

  // ---------------------------------------------------------------- per-frame
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.w = w; this.h = h;
    this.camera.aspect = w / h;
  }
  /** state: { cam:{p,t}, params, front, f, t, idx, shift, shiftY } already interpolated by the engine. */
  update(state, dt) {
    this.time += dt;
    const P = (this.params = state.params);
    const k = 1 - Math.exp(-dt * 5.5);
    this.camPos.lerp(V3(...state.cam.p), k);
    this.camTgt.lerp(V3(...state.cam.t), k);
    this.shift = lerp(this.shift, state.shift, k);
    this.shiftY = lerp(this.shiftY, state.shiftY, k);
    // portrait screens: pull back so the subject still fits the narrower frustum
    const pull = this.camera.aspect < 1 ? 1 + (1 - this.camera.aspect) * 1.1 : 1;
    const off = this.camPos.clone().sub(this.camTgt).multiplyScalar(pull);
    const sway = this.reduced ? 0 : (P.closed || 0) * 0.35 * Math.sin(this.time * 0.35) + this.pointer.x * 0.06;
    // user orbit: wrap yaw so easing home takes the short way round
    const o = this.orbit, ko = 1 - Math.exp(-dt * 9);
    if (o.tYaw === 0 && Math.abs(o.yaw) > Math.PI) o.yaw -= Math.round(o.yaw / TAU) * TAU;
    o.yaw += (o.tYaw - o.yaw) * ko; o.pitch += (o.tPitch - o.pitch) * ko;
    if (Math.abs(o.pitch) > 1e-4) {
      const right = V3(0, 1, 0).cross(off).normalize();
      const elev = Math.asin(Math.min(1, Math.max(-1, off.y / off.length())));
      off.applyAxisAngle(right, -(Math.min(1.35, Math.max(-0.15, elev + o.pitch)) - elev));
    }
    off.applyAxisAngle(V3(0, 1, 0), sway + o.yaw);
    this.camera.position.copy(this.camTgt).add(off);
    this.camera.position.y += this.pointer.y * -0.02 * off.length();
    this.camera.lookAt(this.camTgt);
    this.camera.setViewOffset(this.w, this.h, -this.w * this.shift, -this.h * this.shiftY, this.w, this.h);
    // cover half: slides out towards the viewer and fades
    const open = 1 - (P.closed || 0);
    this.cover.position.z = open * this.coverTravel;
    this.cover.visible = open < 0.98;
    for (const m of this.coverMats) m.opacity = 1 - Math.min(1, open * 1.15);
    this.tick(state, Math.min(dt, 0.05));
  }
  render() { this.renderer.render(this.scene, this.camera); }
  /** World position -> CSS pixel position. */
  project(p, out) {
    const v = this._pv || (this._pv = V3(0, 0, 0));
    v.set(p[0], p[1], p[2]).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * this.w; out.y = (-v.y * 0.5 + 0.5) * this.h; out.vis = v.z < 1 && v.z > -1;
    return out;
  }
}
