/**
 * Placeholder asset generator — Phase R1 (spec 05/07 asset contracts).
 *
 * Real car renders and tire photography do not exist yet. This script generates
 * programmatic SVG stand-ins that fully satisfy the VehicleVisual / tire media
 * contracts, so the configurator is built against the REAL contract and real
 * assets are later a drop-in replacement (swap the file / fixture URL — zero
 * code changes):
 *
 *  - Car side profiles → src/assets/cars/<name>.svg
 *      2400×1260 stage space. Car WITH rims (tires removed): a metallic rim disc
 *      is drawn at each WheelAnchor's rimRadiusPx; the dark wheel-well behind it
 *      is sized to the OEM tire outer radius (rimRadiusPx + oemSidewallPx). The
 *      composited tire ring fills the gap. Body silhouette per bodyType.
 *  - Tire sidewall → src/assets/tires/<id>/sidewall.svg
 *      Square canvas, tire OD touches the edges, transparent center hole sized to
 *      the tire's rim/overall ratio so the renderer's ring maps onto rimRadiusPx
 *      exactly. Black sidewall with brand + size lettering and shoulder tread.
 *  - Tire catalog (3/4 studio) and tread (top-down pattern) per tire.
 *  - Showcase tire layers for the home anatomy scene.
 *
 * DELIBERATELY SKIPPED: /assets/cars/nissan-370z-z34-nismo.webp (the NISMO trim)
 * — the fixture that exercises the CarStage silhouette-fallback path (spec 03).
 *
 * Run:  node scripts/generate-placeholder-assets.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'src', 'assets', 'data');
const vehicles = JSON.parse(readFileSync(join(dataDir, 'vehicles.json'), 'utf8'));
const tires = JSON.parse(readFileSync(join(dataDir, 'tires.json'), 'utf8'));
const brands = JSON.parse(readFileSync(join(dataDir, 'brands.json'), 'utf8'));

const STAGE_W = 2400;
const STAGE_H = 1260;
const n = (v) => +v.toFixed(1);

// ---------------------------------------------------------------------------
// Car side-profile silhouettes (with rims, tires removed)
// ---------------------------------------------------------------------------

/** Greenhouse/body proportions per body type, in units of the OEM tire OD `d`. */
const BODY = {
  sedan: { roofH: 1.3, beltH: 0.52, ghRear: 0.5, ghFront: -0.75, apexBias: 0.42, rearOh: 0.95, frontOh: 0.95, rocker: 0.3 },
  coupe: { roofH: 1.08, beltH: 0.45, ghRear: 0.15, ghFront: -0.8, apexBias: 0.38, rearOh: 0.9, frontOh: 1.0, rocker: 0.32 },
  hatchback: { roofH: 1.4, beltH: 0.52, ghRear: 0.0, ghFront: -0.6, apexBias: 0.3, rearOh: 0.78, frontOh: 0.85, rocker: 0.3 },
  suv: { roofH: 1.58, beltH: 0.62, ghRear: -0.1, roofRear: 0.5, roofFront: -1.3, ghFront: -0.55, rearOh: 0.85, frontOh: 0.9, rocker: 0.2 },
  wagon: { roofH: 1.45, beltH: 0.55, ghRear: -0.05, roofRear: 0.45, roofFront: -1.4, ghFront: -0.55, rearOh: 0.95, frontOh: 0.95, rocker: 0.3 },
  pickup: { roofH: 1.55, beltH: 0.62, ghRear: 1.6, roofRear: 2.1, roofFront: -1.25, ghFront: -0.5, rearOh: 1.1, frontOh: 0.9, rocker: 0.2 },
};

/** OEM tire outer radius at an anchor = rim radius + OEM sidewall. */
const odRadius = (a) => a.rimRadiusPx + a.oemSidewallPx;

/** Dark wheel well + a metallic rim disc (the car keeps its rims; tire is composited). */
function rimAt(a) {
  const od = odRadius(a);
  const rr = a.rimRadiusPx;
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    return `<line x1="${n(a.cx)}" y1="${n(a.cy)}" x2="${n(a.cx + rr * 0.82 * Math.cos(ang))}" y2="${n(a.cy + rr * 0.82 * Math.sin(ang))}" stroke="#2c2e33" stroke-width="${n(rr * 0.12)}" stroke-linecap="round"/>`;
  }).join('');
  return (
    `<circle cx="${n(a.cx)}" cy="${n(a.cy)}" r="${n(od)}" fill="#08080a"/>` +
    `<circle cx="${n(a.cx)}" cy="${n(a.cy)}" r="${n(rr)}" fill="#3a3d44"/>` +
    `<circle cx="${n(a.cx)}" cy="${n(a.cy)}" r="${n(rr * 0.96)}" fill="#23252a"/>` +
    spokes +
    `<circle cx="${n(a.cx)}" cy="${n(a.cy)}" r="${n(rr * 0.2)}" fill="#16171a" stroke="#4a4d54" stroke-width="3"/>`
  );
}

function carSvg({ front, rear, bodyType, label }) {
  const d = (odRadius(front) * 2 + odRadius(rear) * 2) / 2;
  const p = BODY[bodyType] ?? BODY.sedan;
  const cy = (front.cy + rear.cy) / 2;
  const fx = front.cx;
  const rx = rear.cx;

  const rockerY = cy + p.rocker * d;
  const beltY = cy - p.beltH * d;
  const roofY = cy - p.roofH * d;
  const xr = rx - p.rearOh * d;
  const xf = fx + p.frontOh * d;
  const ghRearX = rx + p.ghRear * d;
  const ghFrontX = fx + p.ghFront * d;
  const noseY = beltY + 0.18 * d;
  const gi = 0.09 * d;

  let greenhouse;
  let glass;
  let pillarX;
  if (p.apexBias !== undefined) {
    const apexX = ghRearX + p.apexBias * (ghFrontX - ghRearX);
    greenhouse = [
      `Q ${n(ghRearX + 0.4 * (apexX - ghRearX))} ${n(roofY + 0.02 * d)} ${n(apexX)} ${n(roofY)}`,
      `Q ${n(apexX + 0.55 * (ghFrontX - apexX))} ${n(roofY + 0.05 * d)} ${n(ghFrontX)} ${n(beltY + 0.04 * d)}`,
    ].join(' ');
    glass = [
      `M ${n(ghRearX + 1.2 * gi)} ${n(beltY - 0.3 * gi)}`,
      `Q ${n(ghRearX + 0.42 * (apexX - ghRearX) + gi)} ${n(roofY + gi)} ${n(apexX)} ${n(roofY + gi)}`,
      `Q ${n(apexX + 0.52 * (ghFrontX - apexX))} ${n(roofY + gi + 0.05 * d)} ${n(ghFrontX - 0.9 * gi)} ${n(beltY - 0.2 * gi)}`,
      'Z',
    ].join(' ');
    pillarX = n(apexX + 0.08 * d);
  } else {
    const roofRearX = rx + p.roofRear * d;
    const roofFrontX = fx + p.roofFront * d;
    greenhouse = [
      `Q ${n(ghRearX + 0.42 * (roofRearX - ghRearX))} ${n(roofY)} ${n(roofRearX)} ${n(roofY)}`,
      `L ${n(roofFrontX)} ${n(roofY)}`,
      `Q ${n(ghFrontX - 0.45 * (ghFrontX - roofFrontX))} ${n(beltY + 0.02 * d)} ${n(ghFrontX)} ${n(beltY + 0.06 * d)}`,
    ].join(' ');
    glass = [
      `M ${n(ghRearX + 1.2 * gi)} ${n(beltY - 0.3 * gi)}`,
      `Q ${n(ghRearX + 0.42 * (roofRearX - ghRearX) + gi)} ${n(roofY + gi)} ${n(roofRearX + gi)} ${n(roofY + gi)}`,
      `L ${n(roofFrontX - 0.6 * gi)} ${n(roofY + gi)}`,
      `Q ${n(ghFrontX - 0.4 * (ghFrontX - roofFrontX))} ${n(beltY)} ${n(ghFrontX - 0.9 * gi)} ${n(beltY - 0.2 * gi)}`,
      'Z',
    ].join(' ');
    pillarX = n((roofRearX + roofFrontX) / 2 + 0.1 * d);
  }

  const body = [
    `M ${n(xr + 0.05 * d)} ${n(rockerY)}`,
    `Q ${n(xr - 0.04 * d)} ${n(rockerY - 0.3 * d)} ${n(xr)} ${n(beltY + 0.28 * d)}`,
    `Q ${n(xr + 0.02 * d)} ${n(beltY + 0.04 * d)} ${n(xr + 0.22 * d)} ${n(beltY)}`,
    `L ${n(ghRearX)} ${n(beltY)}`,
    greenhouse,
    `Q ${n(fx - 0.1 * d)} ${n(noseY - 0.1 * d)} ${n(xf - 0.2 * d)} ${n(noseY)}`,
    `Q ${n(xf)} ${n(noseY + 0.04 * d)} ${n(xf - 0.02 * d)} ${n(beltY + 0.5 * d)}`,
    `Q ${n(xf)} ${n(rockerY - 0.12 * d)} ${n(xf - 0.12 * d)} ${n(rockerY)}`,
    'Z',
  ].join(' ');

  // Wheel arches (cutouts) sized to the OEM tire OD so the composited ring tucks in.
  const archCut = (a) =>
    `<circle cx="${n(a.cx)}" cy="${n(a.cy)}" r="${n(odRadius(a) * 1.04)}" fill="#0a0a0c"/>` +
    `<path d="M ${n(a.cx - odRadius(a) * 1.06)} ${n(a.cy)} A ${n(odRadius(a) * 1.06)} ${n(odRadius(a) * 1.06)} 0 0 1 ${n(a.cx + odRadius(a) * 1.06)} ${n(a.cy)}" fill="none" stroke="#ffffff14" stroke-width="3"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STAGE_W} ${STAGE_H}" width="${STAGE_W}" height="${STAGE_H}" fill="none">
  <defs>
    <linearGradient id="paint" x1="0" y1="${n(roofY)}" x2="0" y2="${n(rockerY)}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#33333b"/>
      <stop offset="0.55" stop-color="#26262c"/>
      <stop offset="1" stop-color="#1a1a1f"/>
    </linearGradient>
  </defs>
  ${archCut(rear)}
  ${archCut(front)}
  <path d="${body}" fill="url(#paint)" stroke="#ffffff1f" stroke-width="3"/>
  <path d="${glass}" fill="#3b3b46" opacity="0.9"/>
  <rect x="${pillarX}" y="${n(roofY + gi)}" width="${n(0.1 * d)}" height="${n(beltY - roofY - 1.4 * gi)}" fill="url(#paint)"/>
  <line x1="${n(xr + 0.3 * d)}" y1="${n(beltY + 0.3 * d)}" x2="${n(xf - 0.4 * d)}" y2="${n(beltY + 0.3 * d)}" stroke="#ffffff21" stroke-width="3"/>
  ${rimAt(rear)}
  ${rimAt(front)}
  <text x="${n(xr)}" y="${n(roofY - 0.25 * d)}" fill="#9c9b94" opacity="0.35" font-family="system-ui, sans-serif" font-size="40" letter-spacing="6">${label.toUpperCase()} · PLACEHOLDER RENDER</text>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Tire artwork
// ---------------------------------------------------------------------------

const brandNameById = new Map(brands.map((b) => [b.id, b.name]));

const SEASON_TINT = {
  summer: { ring: '#1c1c20', deep: '#0e0e11', text: '#7a7a82' },
  winter: { ring: '#1a1d22', deep: '#0d0f12', text: '#8da3b5' },
  'all-season': { ring: '#1b1e1e', deep: '#0d0f0f', text: '#8a938f' },
};

const sizeLabel = (s) => `${s.widthMm}/${s.aspect} R${s.rimDiameterInch}`;

/** Hole ratio = rim diameter / overall diameter (so the ring maps onto rimRadiusPx). */
function holeRatio(size) {
  const rimMm = size.rimDiameterInch * 25.4;
  const overallMm = rimMm + 2 * ((size.widthMm * size.aspect) / 100);
  return rimMm / overallMm;
}

/** Square sidewall view: black annulus with transparent hub, lettering + shoulder blocks. */
function sidewallSvg(tire) {
  const S = 800;
  const C = S / 2;
  const Ro = 396;
  const Ri = holeRatio(tire.size) * Ro;
  const tint = SEASON_TINT[tire.season] ?? SEASON_TINT.summer;
  const brand = (brandNameById.get(tire.brandId) ?? tire.brandId).toUpperCase();

  const treadBlocks = Array.from({ length: 48 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 48;
    const r1 = Ro - 2;
    const r2 = Ro - 26;
    return `<line x1="${n(C + r1 * Math.cos(a))}" y1="${n(C + r1 * Math.sin(a))}" x2="${n(C + r2 * Math.cos(a))}" y2="${n(C + r2 * Math.sin(a))}" stroke="#050506" stroke-width="6"/>`;
  }).join('');

  // sidewall lettering sits in the mid-band of the annulus
  const textR = (Ro + Ri) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}" fill="none">
  <defs>
    <radialGradient id="tire" cx="0.4" cy="0.36" r="0.75">
      <stop offset="0.55" stop-color="${tint.ring}"/>
      <stop offset="1" stop-color="${tint.deep}"/>
    </radialGradient>
    <mask id="hole">
      <circle cx="${C}" cy="${C}" r="${n(Ro)}" fill="#fff"/>
      <circle cx="${C}" cy="${C}" r="${n(Ri)}" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#hole)">
    <circle cx="${C}" cy="${C}" r="${n(Ro)}" fill="url(#tire)"/>
    ${treadBlocks}
    <circle cx="${C}" cy="${C}" r="${n(Ri + 10)}" fill="none" stroke="#000" stroke-width="4" opacity="0.6"/>
    <text x="${C}" y="${n(C - textR + 22)}" text-anchor="middle" fill="${tint.text}" font-family="system-ui, sans-serif" font-size="34" font-weight="700" letter-spacing="3">${brand}</text>
    <text x="${C}" y="${n(C + textR - 8)}" text-anchor="middle" fill="${tint.text}" font-family="system-ui, sans-serif" font-size="30" letter-spacing="2">${sizeLabel(tire.size)}</text>
  </g>
</svg>
`;
}

/** 3/4 studio catalog shot: the sidewall on a pedestal with a floor shadow. */
function catalogSvg(tire) {
  const inner = sidewallSvg(tire)
    .replace(/^[\s\S]*?<g mask/, '<g mask')
    .replace(/<\/svg>\s*$/, '');
  // reuse the masked group, squashed + a shadow + reuse defs
  const defs = sidewallSvg(tire).match(/<defs>[\s\S]*?<\/defs>/)[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" fill="none">
  ${defs}
  <ellipse cx="400" cy="712" rx="280" ry="34" fill="#000" opacity="0.5"/>
  <g transform="translate(400 392) rotate(-7) scale(0.9 0.84) translate(-400 -400)">
    ${inner}
  </g>
</svg>
`;
}

/** Top-down tread strip, pattern varied by season. */
function treadSvg(tire) {
  const tint = SEASON_TINT[tire.season] ?? SEASON_TINT.summer;
  let pattern = '';
  if (tire.season === 'summer') {
    // directional V grooves
    pattern = Array.from({ length: 9 }, (_, i) => {
      const y = 70 + i * 70;
      return `<path d="M 120 ${y} L 400 ${y - 34} L 680 ${y}" fill="none" stroke="#040405" stroke-width="20"/>`;
    }).join('');
  } else if (tire.season === 'winter') {
    // blocky siped pattern
    pattern = Array.from({ length: 8 }, (_, i) => {
      const y = 80 + i * 80;
      return (
        `<rect x="150" y="${y}" width="220" height="48" rx="8" fill="#0a0c0f"/>` +
        `<rect x="430" y="${y}" width="220" height="48" rx="8" fill="#0a0c0f"/>`
      );
    }).join('');
  } else {
    // mixed circumferential + blocks
    pattern =
      `<line x1="280" y1="40" x2="280" y2="760" stroke="#050606" stroke-width="22"/>` +
      `<line x1="520" y1="40" x2="520" y2="760" stroke="#050606" stroke-width="22"/>` +
      Array.from({ length: 8 }, (_, i) => `<rect x="150" y="${70 + i * 86}" width="100" height="40" rx="6" fill="#0a0d0d"/><rect x="550" y="${110 + i * 86}" width="100" height="40" rx="6" fill="#0a0d0d"/>`).join('');
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" fill="none">
  <rect x="100" y="20" width="600" height="760" rx="40" fill="${tint.ring}"/>
  ${pattern}
  <rect x="100" y="20" width="600" height="760" rx="40" fill="none" stroke="#000" stroke-width="6" opacity="0.5"/>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------

const FALLBACK_DEMO_URL = '/assets/cars/nissan-370z-z34-nismo.webp';
const modelsById = new Map(vehicles.models.map((m) => [m.id, m]));

const carsDir = join(root, 'src', 'assets', 'cars');
mkdirSync(carsDir, { recursive: true });
const emittedCars = new Set();
for (const trim of vehicles.trims) {
  const url = trim.visual.sideProfileUrl;
  if (url === FALLBACK_DEMO_URL) continue;
  const file = url.replace(/^\/assets\/cars\//, '').replace(/\.\w+$/, '.svg');
  if (emittedCars.has(file)) continue;
  emittedCars.add(file);
  const model = modelsById.get(trim.modelId);
  writeFileSync(
    join(carsDir, file),
    carSvg({
      front: trim.visual.frontWheel,
      rear: trim.visual.rearWheel,
      bodyType: model.bodyType,
      label: `${model.name} ${model.generation}`,
    }),
  );
}

const tiresDir = join(root, 'src', 'assets', 'tires');
for (const tire of tires) {
  const dir = join(tiresDir, tire.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'sidewall.svg'), sidewallSvg(tire));
  writeFileSync(join(dir, 'catalog.svg'), catalogSvg(tire));
  writeFileSync(join(dir, 'tread.svg'), treadSvg(tire));
}

// Home showcase (spec 06/07): one showcase tire as full + anatomy-ish layers.
const SHOWCASE_ID = 'aurelia-sportcontact-7-24540r19';
const showcase = tires.find((t) => t.id === SHOWCASE_ID) ?? tires[0];
const showcaseDir = join(root, 'src', 'assets', 'showcase');
mkdirSync(showcaseDir, { recursive: true });
writeFileSync(join(showcaseDir, 'tire-full.svg'), sidewallSvg(showcase));
writeFileSync(join(showcaseDir, 'tire-tread.svg'), treadSvg(showcase));
writeFileSync(join(showcaseDir, 'tire-catalog.svg'), catalogSvg(showcase));

console.log(`cars: ${emittedCars.size} silhouettes → src/assets/cars/`);
console.log(`tires: ${tires.length} × (sidewall+catalog+tread) → src/assets/tires/<id>/`);
console.log(`showcase: full + tread + catalog → src/assets/showcase/ (${SHOWCASE_ID})`);
console.log(`skipped (fallback demo): ${FALLBACK_DEMO_URL}`);
