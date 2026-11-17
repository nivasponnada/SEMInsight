// Wafer journey: the device cross-section being built at the origin, and one process tool
// (or wafer-level object) at a time in the "bay" at BAY. Geometry is schematic and not to scale.
import { Scene3D, THREE, V3, lerp, TAU, SIG } from '../core/scene3d.js';
import { IW, IH, VARIANTS, drawInset } from './insets.js';

export const BAY = [40, 0, 0];
const B = (x, y, z) => [BAY[0] + x, BAY[1] + y, BAY[2] + z];
const sm = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
/** Device coordinates after the wafer flip (rotation by 180° about the x axis through y = 1). */
const fl = ([x, y, z]) => [x, 2 - y, -z];
const XCUT = 1.2, DX = 0.9; // section plane of the device block, and its x offset in the world
const dv = ([x, y, z]) => [x + DX, y, z];

export const TOOLS = ['siemens', 'cz', 'saw', 'wafer', 'dep', 'euv', 'etch', 'cmp', 'bond', 'grind', 'insp', 'probe', 'dice', 'pack', 'test'];

const cam = (p, t, o = {}) => ({ p: B(...p), t: B(...t), shift: 0.1, shiftY: -0.11, ...o });
const close = (p, t, o = {}) => cam(p.map((v, i) => t[i] + (v - t[i]) * 1.45), t, o);
export const VIEW = {
  device: { p: [10.5, 6.1, 12.4], t: [0.3, 0.8, 0], shift: 0.13, shiftY: -0.08 },
  deviceTall: { p: [11.5, 7.2, 14.5], t: [0.3, 1.5, 0], shift: 0.13, shiftY: -0.06 },
  deviceClose: { p: [12.8, 3.9, 8.9], t: [1.9, 0.55, 0.3], shift: 0.15, shiftY: -0.08 },
  deviceFlip: { p: [10.5, 6.5, 12.4], t: [0.3, 1.1, 0], shift: 0.13, shiftY: -0.08 },
  tool: {
    siemens: cam([4.5, 4.2, 13], [0.3, 2.4, 0]),
    cz: cam([5, 4.6, 15], [0.3, 3.1, 0]),
    saw: cam([4.5, 4.4, 12], [0.2, 2.2, 0]),
    wafer: cam([5, 6.5, 14.5], [0.2, 0.9, 0]),
    dep: cam([4, 3.6, 11.5], [0.2, 1.9, 0]),
    euv: cam([1.0, 4.4, 16.5], [-0.7, 3.2, 0], { shift: 0.09, shiftY: -0.1 }),
    etch: cam([4, 3.6, 11.5], [0.2, 1.9, 0]),
    cmp: cam([4.5, 5, 11.5], [0.1, 1.5, 0]),
    bond: cam([4.5, 3.6, 11.5], [0.2, 1.7, 0]),
    grind: cam([4.5, 4, 11.5], [0.2, 1.7, 0]),
    insp: cam([4.5, 4.2, 12.5], [0.2, 2.3, 0]),
    probe: cam([4.5, 4, 11.5], [0.2, 1.8, 0]),
    dice: cam([4.5, 5, 11.5], [0.2, 1.4, 0]),
    pack: cam([5, 4.4, 11], [0.2, 2.0, 0]),
    test: cam([4.5, 4, 12.5], [0.2, 1.8, 0], { shift: 0.24 }),
  },
  close: {
    siemens: close([2.4, 2.8, 7], [0.3, 2.2, 0]),
    cz: close([2.6, 2.6, 7], [0.3, 1.9, 0]),
    saw: close([2.4, 3.2, 6.5], [0.2, 2.3, 0.3]),
    wafer: close([1.5, 2.2, 5.5], [0.6, 1.05, 0.8]),
    dep: close([2.7, 3.0, 6.8], [1.9, 2.4, 0.4]),
    euv: close([3.0, 3.2, 9.0], [1.9, 2.5, 0]),
    etch: close([2.7, 3.0, 6.8], [1.9, 2.4, 0.4]),
    cmp: close([2.6, 3.2, 7.0], [1.5, 2.0, 0.5]),
    bond: close([2.4, 2.2, 6.4], [0.3, 1.4, 0.3]),
    grind: close([2.6, 2.6, 6.4], [0.6, 1.45, 0.2]),
    insp: close([2.4, 2.2, 6], [0.3, 1.5, 0.2]),
    probe: close([2.2, 2.2, 5.6], [0.3, 1.45, 0.2]),
    dice: close([2.4, 2.8, 6], [0.4, 1.35, 0.3]),
    pack: close([3, 3.2, 7], [0.3, 2.0, 0]),
    test: close([2.4, 2.6, 6], [0.2, 1.6, 0.2]),
  },
};
export const HERO_CAM = cam([4.6, 5.2, 12], [0, 0.8, 0], { shift: 0.2, shiftY: 0 });

export const TOOL_LABELS = {
  siemens: [['QUARTZ BELL JAR', B(1.55, 3.6, 0)], ['POLYSILICON RODS · 1100 °C', B(0.75, 2.6, 0.3)], ['SiHCl₃ + H₂ INLET', B(-1.3, 0.35, 0.8), 'd']],
  cz: [['SEED + PULL ROD', B(0.05, 5.6, 0)], ['GROWING INGOT', B(0.55, 3.0, 0)], ['MOLTEN SILICON · 1414 °C', B(0.9, 1.6, 0)], ['GRAPHITE HEATER', B(1.6, 1.2, 0), 'd']],
  saw: [['INGOT', B(1.6, 2.6, 0.9)], ['DIAMOND WIRE WEB', B(-0.6, 3.25, 1.7)], ['WIRE GUIDE', B(2.0, 3.2, -1.9)]],
  wafer: [['300 mm · 775 µm', B(2.1, 1.05, 2.1)], ['ORIENTATION NOTCH', B(0, 1.05, 3.0), 'd']],
  dep: [['SHOWERHEAD', B(-1.7, 2.7, 0)], ['PRECURSOR GAS', B(-0.6, 2.0, 0)], ['WAFER ON HEATED PEDESTAL', B(-1.5, 1.04, 0), 'd'], ['SURFACE, MAGNIFIED', B(2.9, 3.95, 0.9)]],
  euv: [['TIN PLASMA + COLLECTOR MIRROR', B(-3.6, 1.2, 0), 'd'], ['INTERMEDIATE FOCUS', B(-1.85, 1.2, 0)], ['ILLUMINATOR MIRRORS', B(-1.5, 3.3, 0)], ['REFLECTIVE RETICLE', B(0.9, 5.2, 0)], ['WAFER STAGE', B(3.2, 0.66, 0), 'd']],
  etch: [['INDUCTIVE COIL', B(-2.45, 2.9, 0)], ['PLASMA', B(-0.6, 1.9, 0)], ['BIASED CHUCK', B(-1.6, 0.8, 0), 'd'], ['SURFACE, MAGNIFIED', B(2.9, 3.95, 0.9)]],
  cmp: [['CARRIER HEAD ON ITS SPINDLE', B(0.9, 1.9, 0.3)], ['PAD ON ROTATING PLATEN', B(1.4, 1.22, 1.9), 'd'], ['SLURRY NOZZLE', B(-1.0, 2.35, -0.4)], ['PAD CONDITIONER', B(-0.1, 1.36, -1.45)]],
  bond: [['CARRIER WAFER', B(1.9, 2.6, 0.9)], ['DEVICE WAFER', B(2.0, 1.06, 0.9), 'd']],
  grind: [['GRINDING WHEEL', B(1.9, 1.75, 0.6)], ['DEVICE WAFER, BACK UP', B(-1.2, 1.3, 1.7), 'd'], ['CARRIER', B(2.1, 1.05, 0.8), 'd']],
  insp: [['ELECTRON COLUMN', B(0.55, 3.4, 0)], ['SCANNED BEAM', B(0.03, 1.7, 0)], ['WAFER STAGE', B(2.0, 1.04, 1.0), 'd']],
  probe: [['TEST HEAD', B(1.3, 3.1, 0.9)], ['PROBE CARD', B(1.6, 2.0, 0.6)], ['WAFER ON CHUCK', B(2.0, 1.04, 1.0), 'd']],
  dice: [['LASER GANTRY', B(1.8, 3.5, -0.6)], ['CUT FOLLOWS THE STREETS', B(-1.26, 1.06, 1.2), 'd'], ['TAPE FRAME', B(2.75, 1.0, 0.5), 'd']],
  pack: [['LID', B(1.45, 3.35, 1.45)], ['LOGIC DIE + MEMORY STACK', B(0.2, 2.5, 0.7)], ['SILICON INTERPOSER', B(1.3, 1.8, 1.3)], ['PACKAGE SUBSTRATE', B(1.6, 0.95, 1.6), 'd']],
  test: [['HANDLER ARM', B(0.5, 3.0, 0)], ['TEST SOCKET', B(0.9, 1.5, 0.9), 'd'], ['LOAD BOARD', B(2.0, 1.02, 1.3), 'd']],
};
export const CLOSE_LABELS = {
  siemens: [['SILICON DEPOSITS ON THE ROD', B(0.75, 2.4, 0.3)], ['RESISTIVELY HEATED', B(0.75, 3.55, 0.3)]],
  cz: [['MENISCUS · GROWTH FRONT', B(0.55, 1.62, 0)], ['QUARTZ CRUCIBLE', B(1.25, 1.3, 0), 'd']],
  saw: [['WIRE · 60–100 µm', B(0.3, 2.9, 0.9)], ['KERF LOSS', B(0.9, 2.2, 0.9), 'd']],
  wafer: [['MIRROR POLISH · Ra < 0.1 nm', B(0.6, 1.05, 0.9)]],
  dep: [['WHAT THE WAFER SURFACE SEES', B(2.9, 3.95, 0.9)], ['WAFER', B(1.3, 1.05, 0.2), 'd']],
  euv: [['SIX PROJECTION MIRRORS', B(2.9, 3.1, 0)], ['FINAL MIRROR FOCUSES THE CONE', B(1.2, 1.55, 0)], ['FOCUS ON THE RESIST', B(2.3, 0.71, 0), 'd']],
  etch: [['WHAT THE WAFER SURFACE SEES', B(2.9, 3.95, 0.9)], ['WAFER', B(1.3, 1.05, 0.2), 'd']],
  cmp: [['WAFER, FACE DOWN', B(0.9, 1.32, 1.2), 'd'], ['WHAT THE PAD DOES', B(2.9, 4.15, 1.2)]],
  bond: [['OXIDE-TO-OXIDE CONTACT', B(0.4, 1.1, 1.0), 'd']],
  grind: [['SILICON REMOVED', B(0.9, 1.4, 0.9), 'd']],
  insp: [['SECONDARY ELECTRONS TO DETECTOR', B(0.45, 1.5, 0.2)], ['DIE UNDER INSPECTION', B(0.03, 1.05, 0.05), 'd']],
  probe: [['TUNGSTEN NEEDLES', B(0.25, 1.45, 0.3)], ['BOND PADS', B(0.3, 1.05, 0.35), 'd']],
  dice: [['PICK-UP COLLET', B(0.21, 2.3, 0.21)], ['SINGULATED DIE', B(0.42, 1.08, 0.3), 'd'], ['KERF', B(0.84, 1.06, -0.4), 'd']],
  pack: [['LID OVER THE DIES', B(1.2, 1.75, 1.5)], ['BALL GRID TO THE BOARD', B(1.44, 0.55, 1.44), 'd']],
  test: [['PACKAGED CHIP', B(0.4, 1.75, 0.4)], ['SPRING PINS', B(0.5, 1.4, 0.7), 'd']],
};
export const DEVICE_LABELS = {
  1: [['Si CHANNEL LAYER', dv([1.2, 0.49, 2])], ['SiGe SACRIFICIAL LAYER', dv([1.2, 0.35, 2]), 'd'], ['Si SUBSTRATE', dv([1.2, -1.2, 1])]],
  2: [['SHEET STACK (FIN)', dv([1.2, 0.6, 0.9])], ['ETCHED TRENCH', dv([1.2, -0.4, 0]), 'd']],
  3: [['STI OXIDE, RECESSED', dv([1.2, -0.2, 0]), 'd'], ['STACK EXPOSED', dv([1.2, 0.6, -0.9])]],
  4: [['DUMMY POLY-Si GATE', dv([1.2, 1.2, 1.6])], ['HARD MASK', dv([-1.2, 1.7, 2])], ['FIN INSIDE THE GATE', dv([1.2, 0.5, 0.9]), 'd']],
  5: [['GATE SPACER', dv([-0.85, 1.2, 2])], ['SOURCE/DRAIN RECESS', dv([0, 0.0, 0.9]), 'd'], ['INNER SPACERS', dv([0.84, 0.35, 1.16])]],
  6: [['p-TYPE SiGe:B', dv([0, 0.98, 0.9])], ['n-TYPE Si:P', dv([0, 0.98, -0.9])], ['GROWN FROM THE SHEET ENDS', dv([-2.2, 0.5, 1.28]), 'd']],
  7: [['INTERLAYER OXIDE', dv([0, 1.5, 2])], ['GATE TRENCH, POLY REMOVED', dv([1.2, 1.2, 1.6])], ['STACK STILL INTACT', dv([1.2, 0.4, 0.9]), 'd']],
  8: [['SUSPENDED Si NANOSHEETS', dv([1.2, 0.49, 1.15])], ['SiGe ETCHED AWAY', dv([1.2, 0.35, 0.9]), 'd']],
  9: [['METAL GATE ALL AROUND', dv([1.2, 1.1, 1.6])], ['HIGH-k HfO₂ ON EVERY SHEET', dv([1.2, 0.49, 0.65]), 'd'], ['GATE CAP', dv([1.2, 1.56, 0])]],
  10: [['TRENCH CONTACT', dv([0, 1.95, 0.9])], ['CONTACT DIELECTRIC', dv([1.2, 1.75, 1.6])]],
  11: [['M0 · LOCAL WIRES', dv([1.2, 2.06, 1.5]), 'd'], ['M1', dv([0.5, 2.44, 2])], ['M2', dv([1.2, 2.72, 1.2])], ['LOW-k DIELECTRIC', dv([-2.2, 2.6, 2])]],
  12: [['CARRIER WAFER', dv([1.2, 3.4, 1.4])], ['BOND INTERFACE', dv([1.2, 2.92, 0]), 'd']],
  13: [['BULK SILICON REMOVED', fl(dv([1.2, -0.5, 0]))], ['CARRIER NOW BELOW', fl(dv([1.2, 3.4, -1.4])), 'd']],
  14: [['BACKSIDE POWER RAIL', fl(dv([1.2, -1.3, 0.9]))], ['BACKSIDE CONTACT', fl(dv([0, -0.7, -0.9 - 0.31]))], ['SIGNAL WIRING, FRONT SIDE', fl(dv([1.2, 2.4, -1.5])), 'd']],
};

export class FabScene extends Scene3D {
  build() {
    this.els = [];
    this.tool = {};
    this._device();
    for (const n of TOOLS) { const g = new THREE.Group(); g.position.set(...BAY); g.visible = false; this.root.add(g); this.tool[n] = g; }
    this._floor();
    this._siemens(); this._cz(); this._saw(); this._wafer(); this._dep(); this._etch(); this._euv(); this._cmp();
    this._bond(); this._grind(); this._insp(); this._probe(); this._dice(); this._pack(); this._test();
  }

  // ================================================================= device cross-section
  _device() {
    const std = (c, o) => this._std(c, o);
    const clear = (c, op) => this._std(c, { transparent: true, opacity: op, depthWrite: false, roughness: 0.2, metalness: 0.05 });
    const m = (this.DM = {
      si: std(0x6b7684, { roughness: 0.3, metalness: 0.55 }), sige: std(0x2fb7a6, { roughness: 0.4, metalness: 0.3 }), sheet: std(0xa9b8cc, { roughness: 0.3, metalness: 0.5 }),
      ox: clear(0x8fc7ea, 0.26), poly: std(0xb39b6a, { roughness: 0.7, metalness: 0.1 }), hm: std(0x3c3a3f, { roughness: 0.8, metalness: 0.1 }),
      nit: std(0xe6d27a, { roughness: 0.6, metalness: 0.1 }), epiP: std(0xff6b9d, { roughness: 0.45, metalness: 0.2 }), epiN: std(0x7ddc6e, { roughness: 0.45, metalness: 0.2 }),
      gate: this._std(0x7f74c9, { transparent: true, opacity: 0.82, depthWrite: false, roughness: 0.3, metalness: 0.8 }),
      hk: std(0xffc730, { roughness: 0.4, metalness: 0.6 }),
      w: std(0xd3d3e0, { roughness: 0.3, metalness: 0.9 }), cu: this.M.copper, lowk: clear(0xb9a6e8, 0.14), carrier: std(0x4b5360, { roughness: 0.35, metalness: 0.5 }),
    });
    this.pivot = new THREE.Group(); this.pivot.position.set(0, 1, 0); this.root.add(this.pivot);
    const D = (this.dev = new THREE.Group()); D.position.set(DX, -1, 0); this.pivot.add(D);
    const el = (x0, x1, y0, y1, z0, z1, mat, on, off = 99, o = {}) => {
      // the block is sectioned at x = XCUT, through the middle of the second gate
      if (x0 >= XCUT) return;
      x1 = Math.min(x1, XCUT + (o.face || 0));
      // transparent parts are shrunk a hair so their faces never coincide with a neighbour's (no z-fighting),
      // and get a fixed draw order so the blend order cannot change as the camera moves
      const e = mat.transparent ? 0.006 : 0;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 2 * e, y1 - y0 - 2 * e, z1 - z0 - 2 * e), mat);
      mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      if (mat.transparent) mesh.renderOrder = 3 + this.els.length * 0.002;
      D.add(mesh); this.els.push({ mesh, y0, y1, on, off, ...o });
    };
    const FZ = [0.9, -0.9], G = [-1.2, 1.2], SD = [[-3, -1.6], [-0.8, 0.8], [1.6, 3]], T = 0.14;
    // substrate
    el(-3, 3, -2, -0.5, -2, 2, m.si, 0, 13, { top: true });
    el(-3, 3, -0.5, 0, -2, 2, m.si, 0, 2, { swapOff: true });
    // blanket superlattice (grown layer by layer), replaced by fins at step 2
    for (let i = 0; i < 6; i++) el(-3, 3, i * T, (i + 1) * T, -2, 2, i % 2 ? m.sheet : m.sige, 1, 2, { swapOff: true, seq: [i, 6] });
    for (const fz of FZ) {
      const z0 = fz - 0.25, z1 = fz + 0.25;
      el(-3, 3, -0.5, 0, z0, z1, m.si, 2, 99, { swapOn: true, face: 0.006 });
      for (let i = 0; i < 6; i++) {
        const y0 = i * T, y1 = y0 + T, mat = i % 2 ? m.sheet : m.sige;
        for (const [a, b] of SD) el(a, b, y0, y1, z0, z1, mat, 2, 5, { swapOn: true });
        for (const g of G) {
          if (i % 2) { el(g - 0.4, g + 0.4, y0, y1, z0, z1, mat, 2, 99, { swapOn: true, face: 0.006 }); el(g - 0.3, g + 0.3, y0 - 0.035, y1 + 0.035, z0 - 0.035, z1 + 0.035, m.hk, 9, 99, { swapOn: true, face: 0.003 }); }
          else {
            el(g - 0.3, g + 0.3, y0, y1, z0, z1, mat, 2, 8, { swapOn: true, face: 0.006 });
            for (const [a, b] of [[g - 0.4, g - 0.3], [g + 0.3, g + 0.4]]) { el(a, b, y0, y1, z0, z1, mat, 2, 5, { swapOn: true, swapOff: true }); el(a, b, y0, y1, z0 - 0.01, z1 + 0.01, m.nit, 5, 99, { swapOn: true }); }
          }
        }
      }
      // source/drain epitaxy and its contacts
      for (const [a, b] of SD) el(a + 0.02, b - 0.02, -0.1, 0.98, fz - 0.38, fz + 0.38, fz > 0 ? m.epiP : m.epiN, 6);
      for (const xc of [-2.3, 0, 2.3]) el(xc - 0.22, xc + 0.22, 0.98, 1.95, fz - 0.33, fz + 0.33, m.w, 10);
      // backside: contacts under the outer source regions, and a power rail under each fin
      for (const xc of [-2.3, 0]) el(xc - 0.18, xc + 0.18, -1.05, -0.1, fz - 0.31, fz + 0.31, m.cu, 14, 99, { top: true });
      el(-3, 3, -1.56, -1.05, fz - 0.5, fz + 0.5, m.cu, 14, 99, { top: true });
    }
    // isolation oxide between the fins
    for (const [a, b] of [[-2, -1.15], [-0.65, 0.65], [1.15, 2]]) el(-3, 3, -0.5, -0.04, a, b, m.ox, 3);
    for (const g of G) {
      el(g - 0.3, g + 0.3, -0.04, 1.5, -2, 2, m.poly, 4, 7);
      el(g - 0.3, g + 0.3, 1.5, 1.7, -2, 2, m.hm, 4, 7);
      for (const [a, b] of [[g - 0.4, g - 0.3], [g + 0.3, g + 0.4]]) el(a, b, -0.04, 1.5, -2, 2, m.nit, 5);
      el(g - 0.3, g + 0.3, -0.04, 1.5, -2, 2, m.gate, 9);
      el(g - 0.3, g + 0.3, 1.5, 1.62, -2, 2, m.nit, 9);
    }
    for (const [a, b] of SD) el(a, b, -0.04, 1.5, -2, 2, m.ox, 7);
    el(-3, 3, 1.5, 1.95, -2, 2, m.ox, 10);
    // wiring
    el(-3, 3, 1.95, 2.9, -2, 2, m.lowk, 11);
    [-1.5, -0.9, -0.3, 0.3, 0.9, 1.5].forEach((z, i) => el(-3, 3, 1.98, 2.14, z - 0.11, z + 0.11, m.cu, 11, 99, { seq: [0, 3] }));
    [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].forEach((x) => { el(x - 0.15, x + 0.15, 2.26, 2.44, -2, 2, m.cu, 11, 99, { seq: [1, 3] }); el(x - 0.1, x + 0.1, 2.14, 2.26, 0.8, 1.0, m.cu, 11, 99, { seq: [1, 3] }); el(x - 0.1, x + 0.1, 2.14, 2.26, -1.0, -0.8, m.cu, 11, 99, { seq: [1, 3] }); });
    [-1.2, 0, 1.2].forEach((z) => { el(-3, 3, 2.58, 2.86, z - 0.25, z + 0.25, m.cu, 11, 99, { seq: [2, 3] }); el(-1.6, -1.4, 2.44, 2.58, z - 0.12, z + 0.12, m.cu, 11, 99, { seq: [2, 3] }); el(1.4, 1.6, 2.44, 2.58, z - 0.12, z + 0.12, m.cu, 11, 99, { seq: [2, 3] }); });
    // carrier and backside dielectric
    el(-3, 3, 2.92, 3.9, -2, 2, m.carrier, 12, 99, { drop: 2.5 });
    el(-3, 3, -1.6, -0.5, -2, 2, m.ox, 14, 99, { top: true });
  }
  _updateDevice(b) {
    for (const e of this.els) {
      let w = 1, vis = true;
      const d = b - (e.on - 1);
      // swaps happen right at the start of the step, while the camera is still on the tool
      if (e.on > 0) { if (e.swapOn) vis = d >= 0.12; else w = e.seq ? sm(d * e.seq[1] - e.seq[0]) : sm(d); }
      if (e.off < 99) { const q = b - (e.off - 1); if (e.swapOff) vis = vis && q < 0.12; else w *= 1 - sm(q); }
      const h = e.y1 - e.y0;
      if (e.drop) { e.mesh.visible = vis && w > 0.01; e.mesh.position.y = (e.y0 + e.y1) / 2 + (1 - w) * e.drop; continue; }
      e.mesh.visible = vis && w > 0.01;
      if (!e.mesh.visible) continue;
      e.mesh.scale.y = Math.max(w, 0.001);
      e.mesh.position.y = e.top ? e.y1 - (h * w) / 2 : e.y0 + (h * w) / 2;
    }
  }

  // ================================================================= shared tool parts
  _floor() { // plinth under every tool
    for (const n of TOOLS) if (n !== 'wafer' && n !== 'pack') this._mesh(new THREE.CylinderGeometry(3.3, 3.5, 0.18, 64), this.M.dark, [0, -0.09, 0], this.tool[n]);
  }
  _pts(g, n, color, size) { const p = this._points(n, color, size); g.add(p.obj); return p; }
  _disc(g, r, h, mat, pos, seg = 64) { return this._mesh(new THREE.CylinderGeometry(r, r, h, seg), mat, pos, g); }
  /** Wafer with a die grid, top surface at y. */
  _gridWafer(g, r, y, step = 0.42, color = 0x9fb4c8, op = 0.3) {
    const w = this._disc(g, r, 0.04, this.M.silicon, [0, y - 0.02, 0]);
    const pts = [];
    for (let v = -Math.floor(r / step) * step; v <= r; v += step) { const hgt = Math.sqrt(Math.max(0, r * r * 0.96 - v * v)); pts.push(V3(v, y + 0.004, -hgt), V3(v, y + 0.004, hgt), V3(-hgt, y + 0.004, v), V3(hgt, y + 0.004, v)); }
    const l = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, transparent: true, opacity: op })); g.add(l);
    return w;
  }
  /** Open truncated cone of light between two points (radius ra at a, rb at b). */
  _cone(a, b, ra, rb, mat, g) {
    const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(rb, 0.002), Math.max(ra, 0.002), d.length(), 28, 1, true), mat);
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize()); m.renderOrder = 5; g.add(m); return m;
  }
  /** Magnified-surface panel beside a tool, with leader lines from the point on the wafer it enlarges. */
  _inset(g, pos, anchor, w = 2.5) {
    const t = this._canvasTex(IW, IH), h = (w * IH) / IW;
    const q = new THREE.Group(); q.position.set(...pos); q.rotation.y = 0.28; g.add(q);
    q.add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t.tex, toneMapped: false })));
    this._box(w + 0.1, h + 0.1, 0.06, this.M.dark, [0, 0, -0.04], q);
    const A = V3(...anchor), c = Math.cos(0.28), sn = Math.sin(0.28);
    for (const sy of [-1, 1]) this._line([A, V3(pos[0] - (w / 2) * c, pos[1] + sy * h / 2, pos[2] + (w / 2) * sn)], 0xf6f4f2, 0.3, g);
    this._mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 32), new THREE.MeshBasicMaterial({ color: 0xf6f4f2, transparent: true, opacity: 0.7 }), anchor, g).rotation.x = Math.PI / 2;
    return { ctx: t.canvas.getContext('2d'), tex: t.tex };
  }
  _variant(tool) { let best = VARIANTS[tool][0], bw = 0; for (const n of VARIANTS[tool]) { const w = this.params['v_' + n] || 0; if (w > bw) { bw = w; best = n; } } return best; }
  /** Half-sectioned process chamber with pedestal, wafer and showerhead. */
  _chamber(g) {
    const M = this.M, half = (p, mat, cap) => this._arc(p, mat, cap, Math.PI / 2, Math.PI, g);
    half([[2.2, 0], [2.4, 0], [2.4, 3.45], [0.35, 3.45], [0.35, 3.3], [2.2, 3.3]], M.body, M.cut);
    half([[0, 0], [2.2, 0], [2.2, 0.14], [0, 0.14]], M.dark, M.cut);
    this._disc(g, 0.3, 0.5, M.steel, [0, 0.39, 0]); this._disc(g, 1.65, 0.36, M.iron, [0, 0.82, 0]);
    this._disc(g, 1.5, 0.04, M.silicon, [0, 1.02, 0]);
    this._disc(g, 1.75, 0.2, M.steel, [0, 2.7, 0]); this._disc(g, 0.22, 0.6, M.steel, [0, 3.1, 0]);
    this._rod(V3(0, 3.4, 0), V3(0, 4.1, 0), 0.12, M.steel, g); this._rod(V3(0, 4.1, 0), V3(-1.6, 4.1, 0), 0.12, M.steel, g);
    this._box(0.9, 0.7, 0.9, M.dark, [-2.95, 0.5, -0.4], g); this._rod(V3(-2.4, 0.5, -0.4), V3(-2.5, 0.5, -0.4), 0.2, M.body, g); // pump
  }

  // ================================================================= tools
  _siemens() {
    const g = this.tool.siemens, M = this.M;
    this._disc(g, 2.1, 0.3, M.iron, [0, 0.15, 0]);
    const pts = []; for (let i = 0; i <= 20; i++) { const a = (i / 20) * (Math.PI / 2); pts.push(new THREE.Vector2(1.85 * Math.cos(a), 3.2 + 1.5 * Math.sin(a))); }
    const jar = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(1.85, 0.3), ...pts], 48), new THREE.MeshStandardMaterial({ color: 0xcfe0ee, transparent: true, opacity: 0.13, roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false }));
    jar.renderOrder = 4; g.add(jar);
    this.rods = [];
    const hot = this._std(0xffa060, { emissive: 0xff4a12, emissiveIntensity: 1.5, roughness: 0.5 });
    for (const [x, z] of [[-0.75, -0.3], [0.75, 0.3], [0, 0.95]]) {
      const u = new THREE.Group(); u.position.set(x, 0, z); g.add(u);
      for (const dx of [-0.28, 0.28]) { const r = this._disc(u, 0.07, 3.3, hot, [dx, 1.95, 0], 16); this.rods.push(r); this._disc(u, 0.16, 0.2, M.copper, [dx, 0.4, 0], 16); }
      const top = this._rod(V3(-0.28, 3.6, 0), V3(0.28, 3.6, 0), 0.07, hot, u); this.rods.push(top);
    }
    this._rod(V3(-1.3, 0.3, 0.8), V3(-1.3, -0.4, 0.8), 0.09, M.steel, g); this._rod(V3(1.3, 0.3, -0.8), V3(1.3, -0.4, -0.8), 0.09, M.steel, g);
    this.sGas = this._pts(g, 120, 0x9fe8ff, 0.05);
    this.sGas.st.forEach((p) => { p.a = Math.random() * TAU; p.r = 0.2 + Math.random() * 1.5; p.u = Math.random(); p.sp = 0.1 + Math.random() * 0.2; });
    this.sLight = new THREE.PointLight(0xff6a2a, 2.5, 7); this.sLight.position.set(0, 2.2, 1.2); g.add(this.sLight);
  }
  _cz() {
    const g = this.tool.cz, M = this.M, half = (p, mat, cap) => this._arc(p, mat, cap, Math.PI / 2, Math.PI, g);
    half([[2.05, 0], [2.25, 0], [2.25, 3.3], [0.8, 4.3], [0.8, 6.5], [0.65, 6.5], [0.65, 4.2], [2.05, 3.2]], M.body, M.cut);
    half([[0, 0], [2.05, 0], [2.05, 0.14], [0, 0.14]], M.dark, M.cut);
    half([[1.52, 0.4], [1.68, 0.4], [1.68, 2.5], [1.52, 2.5]], this._glow(0xff7a30, 0.9, 0x40241a), this._glow(0xff7a30, 0.5, 0x40241a));
    half([[1.8, 0.3], [1.95, 0.3], [1.95, 2.9], [1.8, 2.9]], M.dark, M.cut); // insulation
    half([[0, 0.55], [1.38, 0.55], [1.38, 2.2], [1.26, 2.2], [1.26, 0.68], [0, 0.68]], M.ceramic, M.ceramic);
    this._disc(g, 0.16, 0.42, M.steel, [0, 0.34, 0]);
    this.melt = this._disc(g, 1.25, 0.92, this._std(0xffb060, { emissive: 0xff5a14, emissiveIntensity: 1.4, roughness: 0.3 }), [0, 1.14, 0]);
    const ing = (this.ingot = new THREE.Group()); ing.position.set(0, 1.6, 0); g.add(ing);
    const body = this._std(0x8a93a0, { roughness: 0.25, metalness: 0.8, emissive: 0xff5a14, emissiveIntensity: 0.12 });
    this.ingBody = this._mesh(new THREE.CylinderGeometry(0.55, 0.55, 1, 40), body, [0, 0.5, 0], ing);
    this.ingCone = this._mesh(new THREE.CylinderGeometry(0.05, 0.55, 0.45, 40), body, [0, 1.2, 0], ing);
    this.seed = this._mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 12), M.steel, [0, 2, 0], ing);
    this.czLight = new THREE.PointLight(0xff6a2a, 2.2, 6); this.czLight.position.set(0.4, 2.0, 1.4); g.add(this.czLight);
    this._box(1.1, 0.8, 0.9, M.dark, [-2.9, 0.5, -0.3], g);
  }
  _saw() {
    const g = this.tool.saw, M = this.M;
    this._box(5.2, 0.5, 3.2, M.dark, [0, 0.35, 0], g);
    for (const z of [-1.9, 1.9]) { const r = this._disc(g, 0.42, 4.4, M.iron, [0, 3.3, z], 32); r.rotation.z = Math.PI / 2; for (const x of [-2.25, 2.25]) this._box(0.2, 2.9, 0.5, M.body, [x, 1.9, z], g); }
    const ing = (this.sawIngot = new THREE.Group()); g.add(ing);
    // the ingot is modelled as its future wafers, so they can separate once the wires are through
    const sl = this._std(0x8a93a0, { roughness: 0.25, metalness: 0.8 });
    this.slices = [];
    for (let i = 0; i < 30; i++) { const d = this._disc(ing, 0.9, 0.122, sl, [0, 0, 0], 40); d.rotation.z = Math.PI / 2; this.slices.push(d); }
    this._box(3.8, 0.3, 1.0, M.steel, [0, -1.05, 0], ing);
    const pts = []; for (let i = 0; i <= 30; i++) { const x = -1.8 + i * 0.12; pts.push(V3(x, 0, -1.9), V3(x, 0, 1.9)); }
    this.wires = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.85 })); this.wires.position.y = 3.3; g.add(this.wires);
    this.sawDust = this._pts(g, 60, 0xbfd6e8, 0.05);
  }
  _wafer() {
    const g = this.tool.wafer;
    const sh = new THREE.Shape(); sh.absarc(0, 0, 3, -Math.PI / 2 + 0.035, (3 * Math.PI) / 2 - 0.035, false); sh.lineTo(0, -2.9); sh.closePath();
    const w = this._mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false, curveSegments: 128 }), this._std(0xc2cbd8, { roughness: 0.12, metalness: 0.9 }), [0, 1.0, 0], g);
    w.rotation.x = -Math.PI / 2; this.bareWafer = w;
    this._mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.9, 32), this.M.dark, [0, 0.5, 0], g);
    this._mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.06, 48), this.M.iron, [0, 0.96, 0], g);
    // finished, patterned wafer (shown on the opening and closing views): one tile per die
    const pg = (this.patt = new THREE.Group()); pg.position.y = 1.052; g.add(pg);
    const cells = []; for (let i = -7; i <= 6; i++) for (let j = -7; j <= 6; j++) { const x = (i + 0.5) * 0.42, z = (j + 0.5) * 0.42; if (Math.hypot(x, z) + 0.3 < 2.92) cells.push([x, z]); }
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.39, 0.004, 0.39), new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0.85 }), cells.length), mtx = new THREE.Matrix4(), col = new THREE.Color();
    cells.forEach(([x, z], k) => { mtx.setPosition(x, 0, z); im.setMatrixAt(k, mtx); const hsh = Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1; im.setColorAt(k, col.setHSL(0.55 + 0.25 * hsh, 0.45, 0.42 + 0.12 * ((k * 7) % 5) / 5)); });
    pg.add(im);
  }
  _dep() {
    const g = this.tool.dep, M = this.M; this._chamber(g);
    this._disc(g, 1.55, 0.03, this._glow(0xff7a30, 1.0, 0x40241a), [0, 0.99, 0]);
    const mk = (c) => { const s = this._pts(g, 150, c, 0.055); s.st.forEach((p) => { p.u = Math.random(); p.x = (Math.random() - 0.5) * 3; p.z = -Math.random() * 1.5 + 0.2; p.sp = 0.25 + Math.random() * 0.3; p.ph = Math.random() * TAU; }); return s; };
    this.depA = mk(0x7dffb0); this.depB = mk(0xff9a4a);
    this.filmMat = this._std(0x2fb7a6, { roughness: 0.3, metalness: 0.4, transparent: true, opacity: 0.92 });
    this.film = this._disc(g, 1.5, 0.03, this.filmMat, [0, 1.06, 0]);
    // lamp bank above the showerhead: only lit for epitaxy
    this.lamps = new THREE.Group(); g.add(this.lamps);
    const lm = this._glow(0xffa24a, 2.2, 0x402010);
    for (let i = -3; i <= 3; i++) this._rod(V3(i * 0.48, 3.06, -1.55), V3(i * 0.48, 3.06, -0.02), 0.07, lm, this.lamps, 12);
    this.depLight = new THREE.PointLight(0xff7a30, 0, 6); this.depLight.position.set(0, 2.2, 1.0); g.add(this.depLight);
    this.depInset = this._inset(g, [2.9, 3.1, 0.9], [0.9, 1.07, 0.3]);
  }
  _etch() {
    const g = this.tool.etch, M = this.M; this._chamber(g);
    for (let i = 0; i < 3; i++) this._mesh(new THREE.TorusGeometry(2.48, 0.07, 10, 64, Math.PI), M.copper, [0, 2.5 + i * 0.28, 0], g).rotation.set(Math.PI / 2, 0, Math.PI);
    this.plasma = this._mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.25, 48, 1, true, Math.PI / 2, Math.PI), new THREE.MeshBasicMaterial({ color: 0xc86bff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [0, 1.9, 0], g);
    this.plasma2 = this._mesh(new THREE.PlaneGeometry(3.4, 1.25), new THREE.MeshBasicMaterial({ color: 0xff6bd0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [0, 1.9, -0.02], g);
    this.ions = this._pts(g, 160, 0xffd0ff, 0.045);
    this.ions.st.forEach((p) => { p.u = Math.random(); p.x = (Math.random() - 0.5) * 2.9; p.z = -Math.random() * 1.4 + 0.15; p.sp = 0.9 + Math.random() * 0.6; p.ph = Math.random() * TAU; });
    this.eLight = new THREE.PointLight(0xd070ff, 1.6, 6); this.eLight.position.set(0, 1.9, 1.0); g.add(this.eLight);
    this.etchInset = this._inset(g, [2.9, 3.1, 0.9], [0.9, 1.07, 0.3]);
  }
  _euv() {
    const g = this.tool.euv, M = this.M, XC = 0xb08cff, N = (x, y) => V3(x, y, 0);
    // frame and vacuum vessel outline
    this._box(9.4, 6.3, 0.16, M.dark, [-0.7, 3.05, -1.25], g);
    this._box(9.6, 0.24, 2.6, M.body, [-0.7, -0.02, 0], g); this._box(9.6, 0.2, 2.6, M.body, [-0.7, 6.2, 0], g);
    for (const x of [-5.4, 4.0]) this._box(0.2, 6.3, 2.6, M.body, [x, 3.05, 0], g);
    // wall between source and scanner, with the intermediate-focus aperture
    this._box(0.14, 0.88, 2.4, M.body, [-1.85, 0.54, 0], g); this._box(0.14, 1.1, 2.4, M.body, [-1.85, 1.97, 0], g);
    for (const z of [-0.75, 0.75]) this._box(0.14, 0.44, 0.9, M.body, [-1.85, 1.2, z], g);
    // source: droplet generator, CO2 laser, collector mirror, plasma
    const col = new THREE.Mesh(new THREE.SphereGeometry(1.15, 40, 20, 0, TAU, 0, 0.95), this._std(0xcfd6e6, { roughness: 0.08, metalness: 1.0 }));
    col.rotation.z = Math.PI / 2; col.position.set(-3.55, 1.2, 0); g.add(col);
    this._rod(V3(-3.6, 2.7, 0), V3(-3.6, 2.2, 0), 0.07, M.steel, g); this._box(0.4, 0.4, 0.4, M.dark, [-3.6, 2.9, 0], g);
    this.droplets = this._pts(g, 6, 0xdfe6f0, 0.09);
    this._rod(V3(-5.3, 1.2, 0), V3(-4.75, 1.2, 0), 0.16, M.dark, g);
    this._rod(V3(-4.75, 1.2, 0), V3(-3.6, 1.2, 0), 0.022, new THREE.MeshBasicMaterial({ color: 0xff7a30, transparent: true, opacity: 0.9 }), g);
    this.plasmaBall = this._mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), [-3.6, 1.2, 0], g);
    this.euvGlow = this._mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshBasicMaterial({ color: XC, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }), [-3.6, 1.2, 0], g);
    // optical train in the xy plane: [point, beam radius there, kind]
    //   plasma -> collector -> intermediate focus -> 3 illuminator mirrors -> reticle -> 6 projection mirrors -> resist
    const O = (this.euvO = [
      [N(-3.6, 1.2), 0.03, 'src'], [N(-4.52, 1.2), 0.7, 'col'], [N(-1.85, 1.2), 0.035, 'if'],
      [N(-0.6, 1.05), 0.36, 'cc'], [N(-1.5, 3.3), 0.3, 'cc'], [N(-0.3, 2.75), 0.3, 'cc'],
      [N(0.9, 5.2), 0.32, 'ret'],
      [N(2.9, 4.2), 0.36, 'cc'], [N(1.0, 3.7), 0.2, 'cv'], [N(2.9, 3.1), 0.3, 'cc'], [N(1.0, 2.6), 0.14, 'cc'], [N(3.0, 2.0), 0.17, 'cv'], [N(1.2, 1.55), 0.56, 'cc'],
      [N(2.3, 0.705), 0.004, 'waf'],
    ]);
    const mir = this._std(0xdfe5f2, { roughness: 0.04, metalness: 1.0 }), back = M.iron;
    for (let i = 3; i < O.length - 1; i++) {
      const [P0, r, kind] = O[i]; if (kind === 'ret') continue;
      // mirror normal bisects the incoming and outgoing rays, so every segment ends on the surface
      const n = O[i - 1][0].clone().sub(P0).normalize().add(O[i + 1][0].clone().sub(P0).normalize()).normalize();
      const a = r * 1.45 + 0.05, Rc = a * 2.4, th = Math.asin(1 / 2.4), sag = Rc * (1 - Math.cos(th)), cv = kind === 'cv';
      // spherical cap: concave mirrors have their centre of curvature in front, convex ones behind
      const cap = this._mesh(new THREE.SphereGeometry(Rc, 36, 10, 0, TAU, 0, th), mir, null, g);
      cap.position.copy(P0).addScaledVector(n, cv ? -Rc : Rc); cap.quaternion.setFromUnitVectors(V3(0, 1, 0), cv ? n : n.clone().negate());
      const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), n), off = cv ? sag + 0.07 : 0.07;
      const b = this._mesh(new THREE.CylinderGeometry(a * 1.02, a * 0.82, 0.14, 32), back, null, g); b.position.copy(P0).addScaledVector(n, -off); b.quaternion.copy(q);
      this._rod(P0.clone().addScaledVector(n, -off - 0.06), P0.clone().addScaledVector(n, -off - 0.06).setZ(-1.17), 0.05, M.steel, g);
    }
    // reticle stage and reticle (absorber pattern facing down)
    this._box(1.9, 0.3, 1.5, M.dark, [0.9, 5.6, 0], g);
    this.reticle = this._box(0.95, 0.07, 0.95, this._std(0x2b2f3a, { roughness: 0.1, metalness: 0.9 }), [0.9, 5.24, 0], g);
    this._box(0.7, 0.012, 0.7, this._std(0x8a6cd8, { roughness: 0.2, metalness: 0.9 }), [0, -0.04, 0], this.reticle);
    this._box(0.66, 0.006, 0.2, this._glow(XC, 1.4, 0x201830), [0.9, 5.196, 0], g); // illuminated slit
    // wafer stage, wafer, resist
    this.wStage = new THREE.Group(); this.wStage.position.set(2.3, 0, 0); g.add(this.wStage);
    this._box(2.3, 0.3, 2.0, M.iron, [0, 0.3, 0], this.wStage); this._box(1.9, 0.16, 1.8, M.dark, [0, 0.55, 0], this.wStage);
    this._disc(this.wStage, 0.85, 0.04, M.silicon, [0, 0.67, 0]);
    this._disc(this.wStage, 0.85, 0.012, this._std(0xffb347, { roughness: 0.5, metalness: 0.1, transparent: true, opacity: 0.78 }), [0, 0.697, 0]); // photoresist, top at 0.703
    const gl = []; for (let v = -0.7; v <= 0.71; v += 0.28) { const hgt = Math.sqrt(Math.max(0, 0.72 - v * v)); gl.push(V3(v, 0.7045, -hgt), V3(v, 0.7045, hgt), V3(-hgt, 0.7045, v), V3(hgt, 0.7045, v)); }
    this.wStage.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gl), new THREE.LineBasicMaterial({ color: 0x3a2a10, transparent: true, opacity: 0.6 })));
    const exm = new THREE.MeshBasicMaterial({ color: 0x8a5cff, transparent: true, opacity: 0.75 });
    this.trail = this._box(0.24, 0.003, 1, exm, [0, 0.706, 0], this.wStage);
    this.done = [-1, 0, 1].map((j) => this._box(0.24, 0.003, 0.26, exm, [-j * 0.28, 0.706, 0], this.wStage));
    this.expo = this._box(0.26, 0.006, 0.035, new THREE.MeshBasicMaterial({ color: 0xffffff }), [2.3, 0.709, 0], g); // the focused slit, fixed under the optics
    // beam envelope: cones that widen and narrow between the optics, ending in a point on the resist
    const bm = new THREE.MeshBasicMaterial({ color: XC, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < O.length - 1; i++) this._cone(O[i][0], O[i + 1][0], O[i][1], O[i + 1][1], bm, g);
    const ray = this._line(O.map((o) => o[0]), 0xe6dcff, 0.55, g); ray.renderOrder = 6;
    this.euvLen = []; let tot = 0; for (let i = 0; i < O.length - 1; i++) { const l = O[i][0].distanceTo(O[i + 1][0]); this.euvLen.push(l); tot += l; } this.euvTot = tot;
    this.photons = this._pts(g, 170, 0xe0d0ff, 0.06);
    this.photons.st.forEach((p) => { p.u = Math.random(); p.rho = Math.sqrt(Math.random()); p.a = Math.random() * TAU; });
    this.srcLight = new THREE.PointLight(XC, 2, 5); this.srcLight.position.set(-3.3, 1.4, 0.8); g.add(this.srcLight);
  }
  _cmp() {
    const g = this.tool.cmp, M = this.M;
    this._disc(g, 2.75, 0.8, M.dark, [0, 0.5, 0]);
    // platen: turns about its own centre axis
    this.platen = new THREE.Group(); this.platen.position.set(0, 1.0, 0); g.add(this.platen);
    this._disc(this.platen, 2.5, 0.3, M.iron, [0, 0, 0]);
    this._disc(this.platen, 2.45, 0.06, this._std(0xd9d2c0, { roughness: 0.95, metalness: 0 }), [0, 0.18, 0]);
    const gr = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; gr.push(V3(Math.cos(a) * 0.3, 0.215, Math.sin(a) * 0.3), V3(Math.cos(a + 0.5) * 2.4, 0.215, Math.sin(a + 0.5) * 2.4)); }
    this.platen.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gr), new THREE.LineBasicMaterial({ color: 0x6f6962 })));
    this._box(0.5, 0.012, 0.16, M.copper, [2.1, 0.216, 0], this.platen);
    // carrier: column -> swing arm -> motor -> spindle -> head; the head spins about the spindle axis
    this._rod(V3(3.0, 0.1, -1.4), V3(3.0, 3.2, -1.4), 0.2, M.body, g);
    const arm = (this.headArm = new THREE.Group()); arm.position.set(3.0, 0, -1.4); g.add(arm);
    this._disc(arm, 0.3, 0.34, M.iron, [0, 3.1, 0]);
    this._rod(V3(0, 3.1, 0), V3(-2.1, 3.1, 1.7), 0.15, M.body, arm);
    this._disc(arm, 0.36, 0.56, M.dark, [-2.1, 3.0, 1.7]);
    this._rod(V3(-2.1, 2.75, 1.7), V3(-2.1, 1.85, 1.7), 0.1, M.steel, arm);
    this.head = new THREE.Group(); this.head.position.set(-2.1, 0, 1.7); arm.add(this.head);
    this._disc(this.head, 0.86, 0.035, M.silicon, [0, 1.25, 0]); this._disc(this.head, 0.95, 0.36, M.steel, [0, 1.45, 0]); this._disc(this.head, 0.5, 0.3, M.dark, [0, 1.78, 0]);
    this._box(0.16, 0.38, 0.05, M.copper, [0.74, 1.45, 0], this.head); this._box(0.5, 0.02, 0.1, M.copper, [0.55, 1.64, 0], this.head);
    // slurry: tank -> riser -> arm -> down-turned nozzle, one continuous pipe
    this._box(0.7, 0.7, 0.7, M.dark, [-3.3, 0.45, -1.3], g);
    const J = [V3(-3.0, 0.8, -1.3), V3(-3.0, 2.35, -1.3), V3(-1.0, 2.35, -0.4), V3(-1.0, 1.92, -0.4)];
    for (let i = 0; i < 3; i++) this._rod(J[i], J[i + 1], 0.06, M.steel, g, 14);
    for (const j of [J[1], J[2]]) this._mesh(new THREE.SphereGeometry(0.075, 14, 10), M.steel, [j.x, j.y, j.z], g);
    this._mesh(new THREE.CylinderGeometry(0.06, 0.03, 0.1, 12), M.copper, [-1.0, 1.87, -0.4], g);
    this.drops = this._pts(g, 14, 0xe8f0ff, 0.07); this.drops.st.forEach((p, i) => { p.u = i / 14; });
    this.slurry = this._pts(g, 120, 0xe8f0ff, 0.05); this.slurry.st.forEach((p) => { p.age = Math.random() * 3; p.j = Math.random(); });
    // pad conditioner: small diamond disc on its own swing arm
    this._rod(V3(0.4, 0.1, -3.0), V3(0.4, 2.05, -3.0), 0.1, M.body, g);
    const ca = (this.condArm = new THREE.Group()); ca.position.set(0.4, 0, -3.0); g.add(ca);
    this._disc(ca, 0.16, 0.2, M.iron, [0, 2.0, 0]);
    this._rod(V3(0, 2.0, 0), V3(-0.5, 2.0, 1.55), 0.07, M.body, ca);
    this._rod(V3(-0.5, 2.0, 1.55), V3(-0.5, 1.36, 1.55), 0.05, M.steel, ca);
    this.cond = new THREE.Group(); this.cond.position.set(-0.5, 0, 1.55); ca.add(this.cond);
    this._disc(this.cond, 0.4, 0.1, M.steel, [0, 1.3, 0]); this._disc(this.cond, 0.41, 0.03, this._std(0x2a2a2e, { roughness: 1, metalness: 0.2 }), [0, 1.235, 0]);
    this._box(0.3, 0.02, 0.07, M.copper, [0.2, 1.36, 0], this.cond);
    this.cmpInset = this._inset(g, [2.9, 3.3, 1.2], [1.6, 1.24, 0.9]);
  }
  _bond() {
    const g = this.tool.bond, M = this.M;
    this._disc(g, 2.5, 0.8, M.dark, [0, 0.5, 0]); this._disc(g, 2.35, 0.12, M.iron, [0, 0.95, 0]);
    this._gridWafer(g, 2.2, 1.05);
    this.carrierG = new THREE.Group(); g.add(this.carrierG);
    this._disc(this.carrierG, 2.2, 0.06, this.DM.carrier, [0, 0.03, 0]); this._disc(this.carrierG, 2.35, 0.3, M.iron, [0, 0.22, 0]); this._disc(this.carrierG, 0.5, 1.3, M.body, [0, 1.0, 0]);
    this.wave = this._mesh(new THREE.TorusGeometry(1, 0.03, 8, 64), new THREE.MeshBasicMaterial({ color: SIG.beam, transparent: true, opacity: 0.9 }), [0, 1.07, 0], g); this.wave.rotation.x = Math.PI / 2;
    for (const x of [-2.6, 2.6]) this._rod(V3(x, 0.1, -1.0), V3(x, 4.0, -1.0), 0.12, M.steel, g);
    this._box(5.6, 0.25, 0.5, M.body, [0, 4.0, -1.0], g);
  }
  _grind() {
    const g = this.tool.grind, M = this.M;
    this._disc(g, 2.5, 0.8, M.dark, [0, 0.5, 0]); this.gChuck = new THREE.Group(); g.add(this.gChuck);
    this._disc(this.gChuck, 2.35, 0.1, M.iron, [0, 0.95, 0]); this._disc(this.gChuck, 2.2, 0.08, this.DM.carrier, [0, 1.04, 0]);
    this._box(0.3, 0.02, 0.12, M.copper, [1.9, 1.09, 0], this.gChuck);
    this.thin = this._disc(g, 2.2, 0.3, this._std(0x8e98a8, { roughness: 0.5, metalness: 0.6 }), [0, 1.23, 0]);
    this.wheel = new THREE.Group(); this.wheel.position.set(1.0, 0, 0.2); g.add(this.wheel);
    this._mesh(new THREE.TorusGeometry(1.15, 0.09, 10, 48), this._std(0x9aa0a8, { roughness: 0.9, metalness: 0.3 }), [0, 0.06, 0], this.wheel).rotation.x = Math.PI / 2;
    this._disc(this.wheel, 1.25, 0.16, M.steel, [0, 0.22, 0]); this._disc(this.wheel, 0.35, 1.5, M.dark, [0, 1.05, 0]);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; this._box(0.22, 0.1, 0.1, M.copper, [Math.cos(a) * 1.15, 0.02, Math.sin(a) * 1.15], this.wheel).rotation.y = -a; }
    this._box(1.2, 0.7, 1.0, M.body, [1.0, 2.6, 0.2], g); this._rod(V3(1.6, 2.6, 0.2), V3(3.0, 2.6, -1.2), 0.16, M.body, g); this._rod(V3(3.0, 2.6, -1.2), V3(3.0, 0.1, -1.2), 0.2, M.body, g);
    this.swarf = this._pts(g, 70, 0xffd9a0, 0.05);
  }
  _insp() {
    const g = this.tool.insp, M = this.M;
    this._disc(g, 2.6, 0.7, M.dark, [0, 0.45, 0]); this.iStage = new THREE.Group(); g.add(this.iStage);
    this._box(4.6, 0.14, 4.0, M.iron, [0, 0.92, 0], this.iStage); this._gridWafer(this.iStage, 2.2, 1.05);
    const half = (p, mat, cap) => this._arc(p, mat, cap, Math.PI / 2, Math.PI, g);
    half([[0.18, 2.1], [0.6, 2.1], [0.6, 4.9], [0, 4.9], [0, 4.75], [0.45, 4.75], [0.45, 2.25], [0.18, 2.25]], M.body, M.cut);
    half([[0.08, 1.55], [0.2, 1.55], [0.55, 2.1], [0.2, 2.1]], M.iron, M.ironCut);
    half([[0.2, 2.6], [0.42, 2.6], [0.42, 3.0], [0.2, 3.0]], M.copper, M.copperCut); half([[0.2, 3.5], [0.42, 3.5], [0.42, 3.9], [0.2, 3.9]], M.copper, M.copperCut);
    this._mesh(new THREE.ConeGeometry(0.035, 0.22, 12), M.tip, [0, 4.5, 0], g).rotation.x = Math.PI;
    this.iBeam = this._beam([[4.4, 0.004], [3.7, 0.09], [3.25, 0.012], [2.8, 0.08], [1.9, 0.07], [1.07, 0.004]], 5); g.add(this.iBeam.mesh);
    this._rod(V3(0.95, 1.75, 0.2), V3(0.45, 1.5, 0.2), 0.07, M.se, g); this._rod(V3(1.6, 2.1, 0.2), V3(0.95, 1.75, 0.2), 0.09, M.dark, g);
    this.iSE = this._pts(g, 50, SIG.se, 0.05);
    this._box(0.8, 3.2, 0.3, M.body, [0, 3.3, -1.2], g); this._box(1.4, 0.3, 1.4, M.body, [0, 4.95, -0.5], g);
  }
  _probe() {
    const g = this.tool.probe, M = this.M;
    this._disc(g, 2.6, 0.7, M.dark, [0, 0.45, 0]); this.pChuck = new THREE.Group(); g.add(this.pChuck);
    this._disc(this.pChuck, 2.35, 0.2, M.iron, [0, 0.93, 0]); this._gridWafer(this.pChuck, 2.2, 1.05);
    this.pCard = new THREE.Group(); g.add(this.pCard);
    const pcb = this._std(0x2f6b45, { roughness: 0.7, metalness: 0.2 });
    this._arc([[0.55, 1.95], [1.7, 1.95], [1.7, 2.05], [0.55, 2.05]], pcb, pcb, 0, TAU * 0.999, this.pCard, 48);
    this._arc([[0.4, 1.8], [0.6, 1.8], [0.6, 2.2], [0.4, 2.2]], M.ceramic, M.ceramic, 0, TAU * 0.999, this.pCard, 32);
    for (let i = -3; i <= 3; i++) for (const s of [-1, 1]) { this._rod(V3(i * 0.055, 1.07, s * 0.15), V3(i * 0.1, 1.82, s * 0.42), 0.008, M.steel, this.pCard, 6); this._rod(V3(s * 0.15, 1.07, i * 0.055), V3(s * 0.42, 1.82, i * 0.1), 0.008, M.steel, this.pCard, 6); }
    this._arc([[0.9, 2.6], [1.9, 2.6], [1.9, 3.3], [0.9, 3.3]], M.dark, M.cut, Math.PI / 2, Math.PI, g, 40);
    for (let i = 0; i < 6; i++) { const a = Math.PI / 2 + ((i + 0.5) / 6) * Math.PI; this._rod(V3(Math.sin(a) * 1.4, 2.05, Math.cos(a) * 1.4), V3(Math.sin(a) * 1.4, 2.6, Math.cos(a) * 1.4), 0.03, M.gold, g, 8); }
    this.pDie = this._box(0.4, 0.012, 0.4, this._glow(0x18ff92, 1.0, 0x103020), [0, 1.062, 0], g);
  }
  _dice() {
    const g = this.tool.dice, M = this.M, ST = 0.42, R2 = 2.2 * 2.2 * 0.96;
    this._disc(g, 2.9, 0.7, M.dark, [0, 0.45, 0]);
    this._arc([[2.45, 0.9], [2.85, 0.9], [2.85, 0.98], [2.45, 0.98]], M.steel, M.steel, 0, TAU * 0.999, g, 64);
    this._disc(g, 2.45, 0.02, this._std(0x3a5f8a, { roughness: 0.6, metalness: 0.1, transparent: true, opacity: 0.7 }), [0, 0.99, 0]);
    this._gridWafer(g, 2.2, 1.05, ST, 0xffc730, 0.4);
    // kerfs: one per street, drawn in behind the laser. Streets 0..10 run along z, 11..21 along x.
    this.streets = [];
    const km = new THREE.MeshBasicMaterial({ color: 0x08080a });
    for (let k = 0; k < 22; k++) { const v = -2.1 + (k % 11) * ST, L = Math.sqrt(Math.max(0, R2 - v * v)), m = this._box(1, 0.004, 1, km, [0, 1.053, 0], g); this.streets.push({ v, L, m, alongZ: k < 11 }); }
    // the die that will be picked: until then it is simply part of the wafer
    this.hole = this._box(0.4, 0.004, 0.4, this._std(0x1c2a3a, { roughness: 0.9 }), [0.21, 1.0535, 0.21], g);
    this.die = new THREE.Group(); g.add(this.die);
    this._box(0.375, 0.045, 0.375, M.silicon, [0, 0, 0], this.die);
    this._box(0.33, 0.004, 0.33, this._std(0x7f8aa0, { roughness: 0.25, metalness: 0.85 }), [0, 0.024, 0], this.die);
    // pick-up collet (vacuum tip) on its own arm, parked above the die
    this.pick = new THREE.Group(); g.add(this.pick);
    this._mesh(new THREE.CylinderGeometry(0.05, 0.13, 0.14, 20), this._std(0x3a3a40, { roughness: 0.8, metalness: 0.2 }), [0, 0.07, 0], this.pick);
    this._rod(V3(0, 0.14, 0), V3(0, 1.5, 0), 0.05, M.steel, this.pick); this._box(0.3, 0.2, 0.3, M.dark, [0, 1.6, 0], this.pick);
    this._rod(V3(0, 1.6, 0), V3(0, 1.6, -0.8), 0.06, M.body, this.pick);
    // laser head on a gantry
    this.laser = new THREE.Group(); g.add(this.laser);
    this._box(0.7, 0.6, 0.7, M.dark, [0, 3.1, 0], this.laser); this._mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.4, 24), M.steel, [0, 2.65, 0], this.laser);
    this.lBeam = this._mesh(new THREE.CylinderGeometry(0.1, 0.008, 1.38, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x38ff7a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), [0, 1.76, 0], this.laser);
    this.lSpot = this._mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xcaffd8 }), [0, 1.065, 0], this.laser);
    this.sparks = this._pts(g, 30, 0xcaffd8, 0.04);
    this._box(6.2, 0.2, 0.3, M.body, [0, 3.5, -0.6], g); for (const x of [-3.0, 3.0]) this._rod(V3(x, 0.1, -0.6), V3(x, 3.5, -0.6), 0.12, M.steel, g);
  }
  _pack() {
    const g = this.tool.pack, M = this.M;
    this.layers = [];
    const L = (base, gap) => { const q = new THREE.Group(); g.add(q); this.layers.push({ q, base, gap }); return q; };
    const ball = (q, n, pitch, r, y, mat, ext) => { const geo = new THREE.SphereGeometry(r, 10, 8), im = new THREE.InstancedMesh(geo, mat, n * n), mtx = new THREE.Matrix4(); let k = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { mtx.setPosition((i - (n - 1) / 2) * pitch, y, (j - (n - 1) / 2) * pitch); im.setMatrixAt(k++, mtx); } q.add(im); return im; };
    const solder = this._std(0xc8ccd4, { roughness: 0.3, metalness: 0.9 });
    ball(L(0.5, 0), 9, 0.36, 0.11, 0, solder);                                                                    // BGA balls
    this._box(3.4, 0.22, 3.4, this._std(0x2f6b45, { roughness: 0.7, metalness: 0.15 }), [0, 0, 0], L(0.74, 0.25));  // substrate
    ball(L(0.92, 0.75), 13, 0.2, 0.055, 0, solder);                                                                 // C4
    this._box(2.8, 0.1, 2.8, M.silicon, [0, 0, 0], L(1.03, 1.2));                                                   // interposer
    ball(L(1.11, 1.6), 22, 0.115, 0.022, 0, M.gold);                                                                // microbumps
    const dies = L(1.2, 2.0);
    this._box(1.45, 0.12, 1.5, this._std(0x5d6672, { roughness: 0.2, metalness: 0.85 }), [-0.55, 0, 0], dies); this._box(1.2, 0.012, 1.25, M.copper, [-0.55, 0.066, 0], dies);
    for (let i = 0; i < 5; i++) this._box(0.85, 0.05, 1.5, this._std(i % 2 ? 0x4b5360 : 0x6b7684, { roughness: 0.25, metalness: 0.8 }), [0.78, -0.035 + i * 0.062, 0], dies);
    const lid = L(1.48, 2.9);
    this._box(3.1, 0.14, 3.1, this._std(0xaab0b8, { roughness: 0.3, metalness: 0.9, transparent: true, opacity: 0.55, depthWrite: false }), [0, 0.05, 0], lid);
    for (const [x, z, w, d] of [[0, 1.5, 3.1, 0.1], [0, -1.5, 3.1, 0.1], [1.5, 0, 0.1, 3.1], [-1.5, 0, 0.1, 3.1]]) this._box(w, 0.4, d, M.steel, [x, -0.2, z], lid);
    this._box(5.2, 0.12, 5.2, M.dark, [0, 0.2, 0], g);
  }
  _test() {
    const g = this.tool.test, M = this.M;
    this._box(4.6, 0.7, 3.6, M.dark, [0, 0.45, 0], g);
    this._box(4.2, 0.1, 3.2, this._std(0x2f6b45, { roughness: 0.7, metalness: 0.15 }), [0, 0.95, 0], g);
    const sock = M.dark;
    for (const [x, z, w, d] of [[0, 0.62, 1.4, 0.16], [0, -0.62, 1.4, 0.16], [0.62, 0, 0.16, 1.4], [-0.62, 0, 0.16, 1.4]]) this._box(w, 0.4, d, sock, [x, 1.2, z], g);
    this._box(1.1, 0.06, 1.1, M.ceramic, [0, 1.03, 0], g);
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) this._rod(V3(i * 0.11, 1.06, j * 0.11), V3(i * 0.11, 1.16, j * 0.11), 0.014, M.gold, g, 6);
    this.chip = new THREE.Group(); g.add(this.chip);
    this._box(1.02, 0.1, 1.02, this._std(0x2f6b45, { roughness: 0.7, metalness: 0.15 }), [0, 0, 0], this.chip); this._box(0.9, 0.12, 0.9, M.steel, [0, 0.11, 0], this.chip);
    this._disc(this.chip, 0.3, 0.2, M.dark, [0, 0.27, 0]); this._rod(V3(0, 0.3, 0), V3(0, 1.6, 0), 0.1, M.steel, this.chip);
    this._box(2.6, 0.3, 0.5, M.body, [1.0, 3.3, 0], g); this._rod(V3(2.2, 3.3, 0), V3(2.2, 0.8, 0), 0.16, M.body, g);
    this.led = this._box(0.3, 0.06, 0.16, this._glow(0x18ff92, 1.4, 0x103020), [-1.5, 1.03, 1.2], g);
    this._box(0.9, 0.05, 0.6, M.gold, [1.5, 1.02, -1.0], g); this._box(0.5, 0.24, 0.5, M.dark, [-1.5, 1.12, -0.9], g);
    this.sig = this._pts(g, 60, 0x18ff92, 0.05);
    this.sig.st.forEach((p) => { p.u = Math.random(); p.a = Math.floor(Math.random() * 4); });
  }

  // ================================================================= per-frame
  tick(state, dt) {
    const P = this.params, f = state.f, t = this.time;
    this._updateDevice(P.b || 0);
    this.pivot.rotation.x = Math.PI * sm(P.flip || 0);
    // tools change like a conveyor: the old one slides out to the left while the next slides in from the right
    this._tw = this._tw || {}; this._td = this._td || {};
    for (const n of TOOLS) {
      const w = P['t_' + n] || 0, prev = this._tw[n] ?? w, g = this.tool[n];
      if (w > prev + 1e-5) this._td[n] = 1; else if (w < prev - 1e-5) this._td[n] = -1;
      this._tw[n] = w;
      g.visible = w > 0.02; g.position.x = BAY[0] + (this._td[n] || 1) * (1 - sm(w)) * 11;
    }
    const T = this.tool, put = (set, i, x, y, z) => { const o = i * 3; set.pos[o] = x; set.pos[o + 1] = y; set.pos[o + 2] = z; };

    if (T.siemens.visible) {
      const k = 0.6 + 1.2 * f; this.rods.forEach((r) => r.scale.set(k, 1, k));
      const s = this.sGas;
      for (let i = 0; i < s.n; i++) { const p = s.st[i]; p.u = (p.u + dt * p.sp) % 1; put(s, i, Math.cos(p.a + t * 0.3) * p.r, 0.4 + p.u * 4, Math.sin(p.a + t * 0.3) * p.r * 0.9); }
      s.geo.attributes.position.needsUpdate = true; this.sLight.intensity = 2.3 + 0.3 * Math.sin(t * 5);
    }
    if (T.cz.visible) {
      const L = 0.25 + 3.3 * Math.min(1, f * 1.15);
      this.ingBody.scale.y = L; this.ingBody.position.y = L / 2; this.ingCone.position.y = L + 0.225;
      this.seed.scale.y = Math.max(0.1, 4.75 - L - 0.45); this.seed.position.y = L + 0.45 + this.seed.scale.y / 2;
      this.ingot.rotation.y = t * 0.8; this.melt.rotation.y = -t * 0.5; this.czLight.intensity = 2 + 0.3 * Math.sin(t * 3);
    }
    if (T.saw.visible) {
      const d = Math.min(1, f * 1.2), open = sm((d - 0.62) / 0.38);
      this.sawIngot.position.y = 1.9 + Math.min(d, 0.72) / 0.72 * 2.3; this.wires.position.z = Math.sin(t * 9) * 0.04;
      // once the wire web is through, the slices fan apart into separate wafers
      this.slices.forEach((sl, i) => { sl.position.x = (i - 14.5) * 0.12 * (1 + 0.42 * open); sl.rotation.x = open * 0.06 * Math.sin(i * 2.1); });
      const s = this.sawDust; s.obj.visible = d > 0.05 && d < 0.72;
      for (let i = 0; i < s.n; i++) { const p = s.st[i]; p.age += dt; if (p.age > p.life) { p.age = 0; p.life = 0.5 + Math.random() * 0.5; p.x = (Math.random() - 0.5) * 3.4; p.z = (Math.random() - 0.5) * 1.4; p.vz = (Math.random() - 0.5) * 0.8; } put(s, i, p.x, 3.3 - p.age * p.age * 3, p.z + p.vz * p.age); }
      s.geo.attributes.position.needsUpdate = true;
    }
    if (T.wafer.visible) { this.bareWafer.rotation.z = t * 0.12; this.patt.rotation.y = t * 0.12; this.patt.visible = (P.closed || 0) > 0.5; }
    const loop = (per) => Math.min(1, ((t / per) % 1) / 0.8); // process animations replay, holding the result briefly
    if (T.dep.visible) {
      const v = this._variant('dep'), pr = loop(v === 'ald' || v === 'hk' ? 14 : 10);
      // what the chamber feeds: [gas A, gas B, film colour]
      const K = { cvd: [0x7dffb0, 0, 0x2fb7a6], epi: [0x2fb7a6, 0, 0x2fb7a6], ald: [0x6fb6ff, 0xff9a4a, 0xe6d27a], sd: [0xff6b9d, 0x7ddc6e, 0], hk: [0xffc730, 0x6fb6ff, 0xffc730] }[v];
      let onA = true, onB = false, sweep = 0;
      if (v === 'epi') { const n = Math.min(5, Math.floor(pr * 6)); K[0] = K[2] = n % 2 ? 0xa9b8cc : 0x2fb7a6; }
      if (v === 'sd') onB = true;
      if (v === 'ald' || v === 'hk') {
        const N = v === 'ald' ? 8 : 9, ph = (pr * N) % 1;
        onA = ph < 0.3; onB = ph >= 0.5 && ph < 0.8; sweep = ph >= 0.3 && ph < 0.5 ? (ph - 0.3) / 0.2 : ph >= 0.8 ? (ph - 0.8) / 0.2 : 0;
        if (v === 'hk' && pr > 0.55) K[0] = K[2] = 0x7f74c9;
      }
      if (pr >= 1) { onA = onB = false; }
      const fall = (s, on, c, last) => {
        s.mat.color.setHex(c || 0xffffff);
        for (let i = 0; i < s.n; i++) {
          const p = s.st[i];
          if (on) { p.u += dt * p.sp; if (p.u > 1) { p.u = 0; p.x = (Math.random() - 0.5) * 3; p.z = -Math.random() * 1.5 + 0.2; } put(s, i, p.x + Math.sin(p.ph + p.u * 6) * 0.06, 2.58 - p.u * 1.5, p.z); }
          else if (last && sweep > 0) { const x = p.x - sweep * 4.2; put(s, i, x, x < -2.15 ? 999 : 2.58 - p.u * 1.5, p.z); } // purge: swept to the pump
          else put(s, i, 0, 999, 0);
        }
        s.geo.attributes.position.needsUpdate = true;
      };
      const purgeB = (v === 'ald' || v === 'hk') && ((pr * (v === 'ald' ? 8 : 9)) % 1) >= 0.8;
      fall(this.depA, onA, K[0], !purgeB); fall(this.depB, onB, K[1], purgeB);
      this.film.visible = !!K[2]; if (K[2]) this.filmMat.color.setHex(K[2]);
      const th = v === 'ald' ? Math.floor(pr * 8) / 8 : v === 'hk' ? Math.floor(pr * 9) / 9 : pr;
      this.film.scale.y = 0.15 + 1.4 * th; this.film.position.y = 1.045 + 0.015 * this.film.scale.y;
      const hot = v === 'epi' || v === 'sd';
      this.lamps.visible = hot; this.depLight.intensity = hot ? 2.2 + 0.3 * Math.sin(t * 4) : 0;
      drawInset(this.depInset.ctx, 'dep', v, pr, t); this.depInset.tex.needsUpdate = true;
    }
    if (T.etch.visible) {
      const v = this._variant('etch'), pr = loop(10), iso = v === 'iso';
      const col = { rie: 0xc86bff, gate: 0x5fd0ff, iso: 0x7dffb0, hole: 0xff6b9d }[v];
      const fl2 = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
      this.plasma.material.color.setHex(col); this.plasma2.material.color.setHex(col); this.eLight.color.setHex(col);
      // channel release uses a remote plasma: the glow stays up at the source and only neutral radicals reach the wafer
      for (const m of [this.plasma, this.plasma2]) { m.scale.y = iso ? 0.28 : 1; m.position.y = iso ? 2.42 : 1.9; }
      this.plasma.material.opacity = 0.2 * fl2; this.plasma2.material.opacity = 0.22 * fl2; this.eLight.intensity = (iso ? 0.8 : 1.6) * fl2;
      const s = this.ions; s.mat.color.setHex(iso ? 0x7dffb0 : 0xffd0ff);
      for (let i = 0; i < s.n; i++) {
        const p = s.st[i];
        if (iso) { p.u = (p.u + dt * 0.07) % 1; put(s, i, p.x + Math.sin(t * 0.9 + p.ph) * 0.35, 1.12 + ((p.u + 0.5 * Math.sin(t * 0.6 + p.ph * 3)) % 1 + 1) % 1 * 1.1, p.z + Math.cos(t * 0.7 + p.ph * 2) * 0.12); } // random drift, no direction
        else { p.u += dt * p.sp; if (p.u > 1) { p.u = 0; p.x = (Math.random() - 0.5) * 2.9; } put(s, i, p.x, 1.4 - p.u * 0.34, p.z); } // straight down across the sheath
      }
      s.geo.attributes.position.needsUpdate = true;
      drawInset(this.etchInset.ctx, 'etch', v, pr, t); this.etchInset.tex.needsUpdate = true;
    }
    if (T.euv.visible) {
      const pulse = (t * 6) % 1;
      this.plasmaBall.scale.setScalar(0.5 + 1.6 * Math.exp(-pulse * 6)); this.euvGlow.material.opacity = 0.2 + 0.5 * Math.exp(-pulse * 5); this.srcLight.intensity = 1 + 3 * Math.exp(-pulse * 5);
      const dr = this.droplets; for (let i = 0; i < dr.n; i++) put(dr, i, -3.6, 2.2 - (((t * 6 + i) % 6) / 6) * 1.0, 0); dr.geo.attributes.position.needsUpdate = true;
      // step and scan: the focused slit stays put, the wafer moves under it; the reticle scans the other way
      const per = 2.6, u = (t / per) % 1, j = Math.floor(t / per) % 3, sc = sm(Math.min(1, u / 0.8)), oz = lerp(0.13, -0.13, sc), ox = (j - 1) * 0.28;
      this.wStage.position.set(2.3 + ox, 0, oz); this.reticle.position.z = -oz * 1.5;
      const zb = -oz, len = Math.max(0.002, zb + 0.13);
      this.trail.scale.z = len; this.trail.position.set(-ox, 0.706, -0.13 + len / 2);
      this.done.forEach((m, k) => { m.visible = k < j; });
      const s = this.photons, O = this.euvO;
      for (let i = 0; i < s.n; i++) {
        const p = s.st[i]; p.u = (p.u + dt * 0.3) % 1; let d = p.u * this.euvTot, k = 0; while (k < this.euvLen.length - 1 && d > this.euvLen[k]) d -= this.euvLen[k++];
        const a = O[k][0], b = O[k + 1][0], q = d / this.euvLen[k], r = lerp(O[k][1], O[k + 1][1], q) * p.rho, L = this.euvLen[k];
        const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L, c = Math.cos(p.a) * r;
        put(s, i, lerp(a.x, b.x, q) + nx * c, lerp(a.y, b.y, q) + ny * c, Math.sin(p.a) * r);
      }
      s.geo.attributes.position.needsUpdate = true;
    }
    if (T.cmp.visible) {
      const v = this._variant('cmp'), om = 1.1, NZ = [-1.0, -0.4], r0 = Math.hypot(...NZ), a0 = Math.atan2(NZ[1], NZ[0]);
      this.platen.rotation.y = t * om;
      this.headArm.rotation.y = 0.07 * Math.sin(t * 0.7); this.head.rotation.y = t * 1.9;
      this.condArm.rotation.y = 0.2 * Math.sin(t * 0.45); this.cond.rotation.y = t * 4;
      const col = v === 'cu' ? 0x9fd0ff : 0xe8f0ff; this.drops.mat.color.setHex(col); this.slurry.mat.color.setHex(col);
      const dp = this.drops; for (let i = 0; i < dp.n; i++) { const q = (dp.st[i].u + t * 1.6) % 1; put(dp, i, NZ[0], 1.82 - q * q * 0.59, NZ[1]); } dp.geo.attributes.position.needsUpdate = true;
      // slurry lands under the nozzle and is carried round and outwards by the turning pad
      const s = this.slurry;
      for (let i = 0; i < s.n; i++) {
        const p = s.st[i]; p.age += dt; if (p.age > 3.2) { p.age = 0; p.j = Math.random(); }
        const r = r0 + (p.j - 0.5) * 0.16 + p.age * (0.25 + 0.25 * p.j), a = a0 - om * p.age;
        put(s, i, Math.cos(a) * r, r > 2.42 ? 999 : 1.228, Math.sin(a) * r);
      }
      s.geo.attributes.position.needsUpdate = true;
      drawInset(this.cmpInset.ctx, 'cmp', v, loop(9), t); this.cmpInset.tex.needsUpdate = true;
    }
    if (T.bond.visible) {
      const d = Math.min(1, f * 1.3), gap = 1.5 * (1 - sm(d / 0.75));
      this.carrierG.position.y = 1.06 + gap;
      const w = Math.max(0, (d - 0.75) / 0.25); this.wave.visible = w > 0.01 && w < 0.99; this.wave.scale.set(0.05 + 2.2 * w, 0.05 + 2.2 * w, 1);
    }
    if (T.grind.visible) {
      const th = 0.3 * (1 - 0.88 * Math.min(1, f * 1.15));
      this.thin.scale.y = th / 0.3; this.thin.position.y = 1.08 + th / 2; this.wheel.position.y = 1.08 + th; this.wheel.rotation.y = t * 9; this.gChuck.rotation.y = t * 0.6;
      const s = this.swarf;
      for (let i = 0; i < s.n; i++) { const p = s.st[i]; p.age += dt; if (p.age > p.life) { p.age = 0; p.life = 0.3 + Math.random() * 0.3; p.a = Math.random() * TAU; p.v = 1.5 + Math.random() * 2; } put(s, i, 1.0 + Math.cos(p.a) * (1.15 + p.v * p.age), 1.1 + th + p.age * 0.5 - p.age * p.age * 3, 0.2 + Math.sin(p.a) * (1.15 + p.v * p.age)); }
      s.geo.attributes.position.needsUpdate = true;
    }
    if (T.insp.visible) {
      const sx = 0.12 * (2 * ((t * 1.4) % 1) - 1), sz = 0.1 * (2 * (Math.floor(((t * 1.4) / 10) % 1 * 10) / 9) - 1);
      this.iBeam.set(1.07, (y, c) => { const k = y < 1.9 ? (1.9 - y) / 0.83 : 0; c.x = sx * k; c.z = sz * k; });
      this.iStage.position.x = 0.42 * Math.round(Math.sin(t * 0.25) * 2);
      const s = this.iSE;
      for (let i = 0; i < s.n; i++) { const p = s.st[i]; p.age += dt; if (p.age > p.life) { p.age = 0; p.life = 0.5 + Math.random() * 0.4; p.x0 = sx; p.z0 = sz; p.vx = (Math.random() - 0.5) * 0.5; p.vz = (Math.random() - 0.5) * 0.5; } const q = p.age / p.life; put(s, i, lerp(p.x0 + p.vx * q, 0.45, q * q), 1.07 + q * 0.43 + Math.sin(q * 3.1) * 0.12, lerp(p.z0 + p.vz * q, 0.2, q * q)); }
      s.geo.attributes.position.needsUpdate = true;
    }
    if (T.probe.visible) {
      const cyc = (t * 0.5) % 1, down = cyc > 0.25 && cyc < 0.85, step = Math.floor(t * 0.5) % 5;
      this.pChuck.position.set(0.42 * (step - 2), down ? 0 : -0.1, 0); this.pDie.visible = down; this.pDie.material.emissiveIntensity = 0.6 + 0.6 * Math.sin(t * 20);
    }
    if (T.dice.visible) {
      // everything follows the scroll: 22 streets cut one after another, then the collet picks one die
      const cut = Math.min(1, f / 0.8) * 22, k = Math.min(21, Math.floor(cut)), q = f >= 0.8 ? 1 : cut - k;
      this.streets.forEach((st, i) => {
        const fr2 = i < k ? 1 : i === k ? q : 0, len = Math.max(0.0001, 2 * st.L * fr2);
        st.m.visible = fr2 > 0.001;
        if (st.alongZ) { st.m.scale.set(0.045, 1, len); st.m.position.set(st.v, 1.053, -st.L + len / 2); }
        else { st.m.scale.set(len, 1, 0.045); st.m.position.set(-st.L + len / 2, 1.053, st.v); }
      });
      const st = this.streets[k], along = lerp(-st.L, st.L, q), away = sm((f - 0.8) / 0.08);
      const lx = st.alongZ ? st.v : along, lz = st.alongZ ? along : st.v;
      this.laser.position.set(lx, away * 1.3, lz); this.lBeam.visible = this.lSpot.visible = f < 0.8;
      const sp = this.sparks; sp.obj.visible = f > 0.002 && f < 0.8;
      for (let i = 0; i < sp.n; i++) { const p = sp.st[i]; p.age += dt; if (p.age > p.life) { p.age = 0; p.life = 0.15 + Math.random() * 0.2; p.a = Math.random() * TAU; p.x = lx; p.z = lz; } put(sp, i, p.x + Math.cos(p.a) * p.age * 0.8, 1.07 + p.age * 0.9 - p.age * p.age * 5, p.z + Math.sin(p.a) * p.age * 0.8); }
      sp.geo.attributes.position.needsUpdate = true;
      const down = sm((f - 0.8) / 0.08), lift = sm((f - 0.9) / 0.1);
      this.die.position.set(0.21, 1.031 + lift * 0.85, 0.21); this.hole.visible = lift > 0.02;
      this.pick.position.set(0.21, 1.058 + (1 - down) * 1.7 + lift * 0.85, 0.21);
    }
    if (T.pack.visible) {
      const e = 1 - sm(Math.min(1, f * 1.2)); // exploded at first, assembled as the stage proceeds
      for (const l of this.layers) l.q.position.y = l.base + l.gap * e * 0.75;
    }
    if (T.test.visible) {
      const cyc = (t * 0.35) % 1, seat = sm(Math.min(1, cyc / 0.2)) * (1 - sm((cyc - 0.85) / 0.15));
      this.chip.position.set(0, 1.21 + (1 - seat) * 1.1, 0);
      const on = seat > 0.98; this.led.material.emissiveIntensity = on ? 1.2 + 0.8 * Math.sin(t * 25) : 0.05;
      const s = this.sig; s.obj.visible = on;
      for (let i = 0; i < s.n; i++) { const p = s.st[i]; p.u = (p.u + dt * 1.2) % 1; const r = 0.6 + p.u * 1.4, sx = [1, -1, 0, 0][p.a], sz = [0, 0, 1, -1][p.a]; put(s, i, sx * r + sz * ((i % 7) - 3) * 0.1, 1.01, sz * r + sx * ((i % 7) - 3) * 0.1); }
      s.geo.attributes.position.needsUpdate = true;
    }
  }
}
