import { boot } from '../core/engine.js';
import { STAGES, PASSPORT } from '../fab/stages.js';
import { FabScene, HERO_CAM, VIEW } from '../fab/scene.js';
import { FabLab } from '../fab/lab.js';

const approx = (v) => String(v).replace(/^~/, '≈');
const cell = (l, v) => `<div><span>${l}</span><b>${approx(v)}</b></div>`;

boot({
  key: 'fab',
  standalone: true,
  me: { key: 'fab', href: 'fab.html', brand: ['Fab', 'Insight'], name: 'Wafer journey', short: 'Fab', accent: '#ff8f42' },
  stages: STAGES,
  Scene: FabScene,
  heroCam: HERO_CAM,
  heroState: { closed: 1, t_wafer: 1, b: 0, flip: 0 },
  endCam: VIEW.tool.pack,
  endState: { closed: 1, t_pack: 1, b: 14, flip: 1 },
  hero: {
    kicker: 'Semiconductor manufacturing / 2 nm-class logic',
    title: ['From sand', 'to a 2&nbsp;nm', 'chip.'],
    lede: 'Follow one 300 mm wafer through a leading-edge logic process: grown from quartz, patterned with extreme-ultraviolet light, built into gate-all-around nanosheet transistors, wired on both faces, tested, diced and packaged. Each step shows the tool, then what it did to the device.',
    chips: ['tool + device views', 'wafer passport'],
  },
  lab: {
    title: 'Virtual lithography',
    intro: 'Patterning sets the pace of every node. Choose the exposure tool, illumination, pitch and dose, and see the aerial image the optics deliver, the pattern the resist keeps, and where diffraction or photon statistics make it fail. Below it, replay the device build step by step and compare six generations of logic.',
    foot: 'Model: one-dimensional binary line/space mask with scalar, partially coherent imaging; no mask-3D effects or flare. The resist is a Gaussian blur plus a threshold, and the only noise source is photon shot noise, so line-edge roughness is optimistic. Thresholds and absorbed fractions are representative values. The cross-section replay is not flipped after bonding. The process flow throughout is a generic reconstruction from public papers and roadmaps, not any company’s recipe.',
    mount: (el) => new FabLab(el),
  },
  passport: (idx) => { const p = PASSPORT[idx]; return cell('Steps', p.steps) + cell('Masks', p.masks) + cell('Days', p.days) + cell('Feature', p.feature); },
  refs: [
    'IEEE International Roadmap for Devices and Systems (IRDS), <i>More Moore</i> chapter, 2023 edition.',
    'N. Loubet et al., “Stacked nanosheet gate-all-around transistor to enable scaling beyond FinFET”, <i>Symp. VLSI Technology</i>, T230 (2017).',
    'A. Veloso et al., “Nanosheet FETs and their potential for enabling continued Moore’s law scaling”, <i>IEDM</i> (2021); imec papers on backside power delivery and nano-through-silicon vias (2019–2023).',
    'C. A. Mack, <i>Fundamental Principles of Optical Lithography</i>, Wiley, 2007.',
    'V. Bakshi (ed.), <i>EUV Lithography</i>, 2nd ed., SPIE Press, 2018.',
    'J. D. Plummer, M. D. Deal and P. B. Griffin, <i>Silicon VLSI Technology: Fundamentals, Practice and Modeling</i>, Prentice Hall, 2000.',
    'S. Wolf, <i>Microchip Manufacturing</i>, Lattice Press, 2004.',
  ],
  footNote: 'Device geometry and tools in the 3D view are schematic and not to scale. Dimensions, step counts, mask counts and cycle times are published ranges or estimates for a 2 nm-class process and are marked approximate.',
});
