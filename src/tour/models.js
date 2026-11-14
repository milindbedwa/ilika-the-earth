// ILIKA tour: scanned 3D models (Poly Haven, CC0), packed by scripts/tour-models.mjs into
// public/tour/models. Every placement of a model is one instance, so twenty ferns cost one draw.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const MODEL_NAMES = [
  'fern',
  'calathea',
  'pachira',
  'potplant',
  'potplant2',
  'coffee',
  'sidetable',
  'cabinet',
  'vase1',
  'vase2',
  'vase4',
  'claypot',
  'pillows',
  'basket',
  'bowl',
  'diya',
  'lantern',
  'pendant',
];
const PLANTS = new Set(['fern', 'calathea', 'pachira', 'potplant', 'potplant2']);

export async function loadModels(M, { onProgress = () => {} } = {}) {
  const loader = new GLTFLoader();
  let done = 0;
  const lib = {};
  await Promise.all(
    MODEL_NAMES.map(async (name) => {
      try {
        const g = await loader.loadAsync(`/tour/models/${name}.glb`);
        g.scene.updateMatrixWorld(true);
        const parts = [];
        g.scene.traverse((o) => {
          if (!o.isMesh) return;
          const m = o.material;
          m.envMapIntensity = m.metalness > 0.5 ? 1 : 0.5;
          const leafy = m.alphaTest > 0 || (PLANTS.has(name) && name === 'pachira');
          if (m.transparent) m.userData.noCast = m.userData.noAO = true; // lantern glass
          if (leafy) {
            m.side = THREE.DoubleSide;
            m.userData.noAO = true;
            M.sway(m, { bend: 0.012, flutter: 0.006 });
            if (m.alphaTest > 0)
              m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: m.map, alphaTest: m.alphaTest });
          }
          parts.push({ geometry: o.geometry, material: m, matrix: o.matrixWorld.clone() });
        });
        lib[name] = { parts, list: new Map() };
      } catch (e) {
        console.warn('tour model missing', name, e); // the tour runs without it
      }
      onProgress(++done / MODEL_NAMES.length);
    }),
  );
  return lib;
}

const dummy = new THREE.Object3D();
// queue one placement: world position, turn about the vertical, scale
export function placeModel(ctx, name, group, x, y, z, yaw = 0, scale = 1) {
  const m = ctx.models && ctx.models[name];
  if (!m) return false;
  dummy.position.set(x, y, z);
  dummy.rotation.set(0, yaw, 0);
  dummy.scale.setScalar(scale);
  dummy.updateMatrix();
  if (!m.list.has(group)) m.list.set(group, []);
  m.list.get(group).push(dummy.matrix.clone());
  return true;
}

export function flushModels(ctx) {
  const mtx = new THREE.Matrix4();
  for (const m of Object.values(ctx.models || {}))
    for (const [group, mats] of m.list)
      for (const p of m.parts) {
        const mesh = new THREE.InstancedMesh(p.geometry, p.material, mats.length);
        mats.forEach((pm, i) => mesh.setMatrixAt(i, mtx.multiplyMatrices(pm, p.matrix)));
        mesh.castShadow = !p.material.userData.noCast;
        mesh.receiveShadow = !p.material.transparent;
        mesh.frustumCulled = false;
        if (p.material.userData.depth) mesh.customDepthMaterial = p.material.userData.depth;
        if (p.material.userData.noAO) mesh.userData.noAO = true;
        if (p.material.transparent) mesh.renderOrder = 2;
        ctx.groups[group].add(mesh);
      }
}
