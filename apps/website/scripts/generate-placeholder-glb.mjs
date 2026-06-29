/**
 * Procedural placeholder GLBs for the fixture tires that declare `glbUrl`
 * (spec 04/05). Simple tire meshes — tread torus, sidewall discs, rim hub —
 * with matte rubber + metal materials. Real draco-compressed scans later
 * replace these files at the same URLs with zero code changes.
 *
 * Run:  node scripts/generate-placeholder-glb.mjs
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// GLTFExporter reads its assembled Blob via FileReader, which Node lacks —
// shim just the readAsArrayBuffer path it uses.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
};

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tires = JSON.parse(readFileSync(join(root, 'src', 'assets', 'data', 'tires.json'), 'utf8'));

function buildTire(tire) {
  const rubber = new MeshStandardMaterial({ color: 0x16161a, metalness: 0.05, roughness: 0.92 });
  const tread = new MeshStandardMaterial({ color: 0x101013, metalness: 0.05, roughness: 0.98 });
  const rim = new MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.35 });

  // Real-world-ish scale (m): OD = rim(in) + 2 × sidewall(mm).
  const rimR = (tire.size.rimDiameterInch * 0.0254) / 2;
  const sidewall = (tire.size.widthMm * tire.size.aspect) / 100 / 1000; // mm → m
  const odR = rimR + sidewall;
  const width = (tire.size.widthMm / 1000) * 0.92;
  const carcassR = (rimR + odR) / 2;
  const tubeR = (odR - rimR) / 2;

  const group = new Group();

  // tread band (slightly larger torus at the OD)
  const treadMesh = new Mesh(new TorusGeometry(carcassR, tubeR, 28, 80), tread);
  group.add(treadMesh);

  // carcass (rubber body, slightly inset)
  const carcass = new Mesh(new TorusGeometry(carcassR, tubeR * 0.94, 24, 72), rubber);
  group.add(carcass);

  // sidewalls — thin cylinders bridging rim to tread on each face
  for (const z of [width / 2, -width / 2]) {
    const wall = new Mesh(new CylinderGeometry(odR * 0.99, rimR * 1.02, 0.012, 64, 1, true), rubber);
    wall.rotation.x = Math.PI / 2;
    wall.position.z = z;
    group.add(wall);
  }

  // rim/hub disc
  const hub = new Mesh(new CylinderGeometry(rimR, rimR, width * 0.8, 48), rim);
  hub.rotation.x = Math.PI / 2;
  group.add(hub);

  return group;
}

const exporter = new GLTFExporter();
const targets = tires.filter((t) => t.media.glbUrl);
if (targets.length === 0) {
  console.log('no tires declare glbUrl — nothing to generate');
  process.exit(0);
}
let done = 0;
for (const tire of targets) {
  const scene = buildTire(tire);
  exporter.parse(
    scene,
    (glb) => {
      const file = join(root, 'src', tire.media.glbUrl.replace(/^\//, ''));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, Buffer.from(glb));
      console.log(`glb: ${tire.id} → ${tire.media.glbUrl} (${Math.round(glb.byteLength / 1024)} kB)`);
      if (++done === targets.length) process.exit(0);
    },
    (err) => {
      console.error(`glb FAILED for ${tire.id}:`, err);
      process.exit(1);
    },
    { binary: true },
  );
}
