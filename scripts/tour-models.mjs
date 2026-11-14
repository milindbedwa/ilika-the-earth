// 3D models for the tour (Poly Haven, CC0): downloaded as glTF, reduced and packed to .glb.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, quantize, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

// name in the tour: Poly Haven id. tris: triangle budget. tex: texture size.
export const MODELS = {
  // planting: each of these is a small group of plants, used as a clump in a bed
  fern: { id: 'fern_02', tris: 6000 },
  calathea: { id: 'calathea_orbifolia_01', tris: 7000 },
  pachira: { id: 'pachira_aquatica_01', tris: 9000 },
  potplant: { id: 'potted_plant_01', tris: 9000 },
  potplant2: { id: 'potted_plant_02', tris: 8000 },
  // furniture
  coffee: { id: 'modern_coffee_table_01', tris: 4600 },
  sidetable: { id: 'side_table_01', tris: 2800 },
  cabinet: { id: 'modern_wooden_cabinet', tris: 9000 },
  // objects
  vase1: { id: 'ceramic_vase_01', tris: 2600, tex: 256 },
  vase2: { id: 'ceramic_vase_02', tris: 2800, tex: 256 },
  vase4: { id: 'ceramic_vase_04', tris: 2300, tex: 256 },
  claypot: { id: 'planter_pot_clay', tris: 3100, tex: 256 },
  pillows: { id: 'throw_pillows_01', tris: 6400 },
  basket: { id: 'wicker_basket_01', tris: 5000, tex: 256 },
  bowl: { id: 'wooden_bowl_01', tris: 3000, tex: 256 },
  diya: { id: 'brass_diya_lantern', tris: 4000, tex: 256 },
  lantern: { id: 'wooden_lantern_01', tris: 5000, tex: 256 },
  pendant: { id: 'modern_ceiling_lamp_01', tris: 4000, tex: 256 },
  // generated for this villa (Higgsfield text-to-3D); the source .glb files are kept in scripts/tour-sources
  bed: { file: 'bed.glb', tris: 16000, tex: 1024 },
  sofa: { file: 'sofa.glb', tris: 14000 },
};

export async function buildModels({ cache, out, curl, json }) {
  await MeshoptSimplifier.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const dir = path.join(out, 'models');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const info = {};
  let total = 0;
  for (const [name, m] of Object.entries(MODELS)) {
    let main;
    let polycount = m.tris;
    if (m.file) {
      main = path.join(import.meta.dirname, 'tour-sources', m.file);
      if (!fs.existsSync(main)) {
        console.log(`model ${name}: ${m.file} not in scripts/tour-sources, skipped`);
        continue;
      }
    } else {
      const src = path.join(cache, 'ph-models', m.id);
      const files = json(`https://api.polyhaven.com/files/${m.id}`, path.join(src, 'files.json'));
      const g = files.gltf['1k'].gltf;
      main = curl(g.url, path.join(src, path.basename(g.url)));
      for (const [rel, f] of Object.entries(g.include || {})) curl(f.url, path.join(src, rel));
      polycount = json(`https://api.polyhaven.com/info/${m.id}`, path.join(src, 'info.json')).polycount || m.tris;
    }
    const doc = await io.read(main);
    const ratio = Math.min(1, m.tris / polycount);
    await doc.transform(
      dedup(),
      flatten(),
      join(),
      weld(),
      ...(ratio < 0.95 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.02 })] : []),
      prune(),
      quantize(),
      textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [m.tex || 512, m.tex || 512], quality: 72 }),
    );
    const file = path.join(dir, `${name}.glb`);
    await io.write(file, doc);
    const size = fs.statSync(file).size;
    total += size;
    info[name] = { source: m.id || m.file, kB: Math.round(size / 1024) };
    console.log(`model ${name.padEnd(12)} ${(m.id || m.file).padEnd(28)} ${(size / 1024).toFixed(0).padStart(5)} kB`);
  }
  console.log(`models: ${Object.keys(info).length} files, ${(total / 1e6).toFixed(2)} MB`);
}
