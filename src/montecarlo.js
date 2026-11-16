// Single-scattering Monte Carlo for electron trajectories in a bulk solid
// (after D. C. Joy, "Monte Carlo Modeling for Electron Microscopy and Microanalysis", 1995).
//  - elastic scattering: screened Rutherford cross-section
//  - energy loss: continuous slowing down, Joy–Luo modified Bethe stopping power
// Lengths are in micrometres, energies in keV. The beam enters at the origin travelling
// along +z (into the specimen); the surface is the plane z = 0.

const NA = 6.02214076e23;

export function simulate(mat, E0, { nShow = 200, nCount = 1200, maxPts = 600, eMin = 0.05, rand = Math.random } = {}) {
  const { Z, A, rho } = mat;
  const J = (9.76 * Z + 58.5 * Z ** -0.19) * 1e-3; // mean ionisation potential [keV]
  const paths = [];
  let bse = 0;
  let maxDepth = 0;
  let bseEnergy = 0;
  const n = Math.max(nShow, nCount);

  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0;
    let cx = 0, cy = 0, cz = 1;
    let E = E0;
    const keep = i < nShow;
    const pts = keep ? [0, 0, 0] : null;
    let escaped = false;
    let guard = 0;

    while (E > eMin && guard++ < 20000) {
      // screening parameter and total elastic cross-section [cm^2]
      const al = (3.4e-3 * Z ** 0.67) / E;
      const sig = 5.21e-21 * ((Z * Z) / (E * E)) * ((4 * Math.PI) / (al * (1 + al))) * ((E + 511) / (E + 1024)) ** 2;
      const mfp = (A / (NA * rho * sig)) * 1e4; // [µm]
      const step = -mfp * Math.log(rand() || 1e-12);

      x += cx * step; y += cy * step; z += cz * step;
      if (pts && pts.length < maxPts * 3) pts.push(x, y, z);
      if (z < 0) { escaped = true; break; }
      if (z > maxDepth) maxDepth = z;

      // Joy–Luo stopping power [keV/cm] -> energy lost over this step
      const dEds = (78500 * rho * Z) / (A * E) * Math.log((1.166 * (E + 0.85 * J)) / J);
      E -= dEds * step * 1e-4;
      if (E <= eMin) break;

      // scattering angles
      const r1 = rand();
      const ct = 1 - (2 * al * r1) / (1 + al - r1);
      const st = Math.sqrt(Math.max(0, 1 - ct * ct));
      const ph = 2 * Math.PI * rand();
      // orthonormal basis around the current direction
      let ux, uy, uz;
      if (Math.abs(cz) < 0.999) { const s = Math.hypot(cx, cy); ux = -cy / s; uy = cx / s; uz = 0; }
      else { ux = 1; uy = 0; uz = 0; }
      const vx = cy * uz - cz * uy, vy = cz * ux - cx * uz, vz = cx * uy - cy * ux;
      const cp = Math.cos(ph), sp = Math.sin(ph);
      const nx = st * (cp * ux + sp * vx) + ct * cx;
      const ny = st * (cp * uy + sp * vy) + ct * cy;
      const nz = st * (cp * uz + sp * vz) + ct * cz;
      const nn = Math.hypot(nx, ny, nz);
      cx = nx / nn; cy = ny / nn; cz = nz / nn;
    }
    if (escaped) { if (i < nCount) { bse++; bseEnergy += E / E0; } }
    if (keep) paths.push({ pts: new Float32Array(pts), bse: escaped });
  }
  return {
    paths,
    eta: bse / Math.min(n, nCount),
    meanBseEnergy: bse ? bseEnergy / bse : 0,
    maxDepth,
  };
}
