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
  'bed',
  'sofa',
];
// Generated pieces arrive at any size and facing any way: fit their longest side to this many
// metres, stand them on the floor at the origin and turn them to face +z.
const FIT = { bed: { long: 2.3, yaw: Math.PI }, sofa: { long: 2.3, yaw: Math.PI } };
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
        if (FIT[name]) {
          const box = new THREE.Box3();
          for (const p of parts) box.union(new THREE.Box3().setFromBufferAttribute(p.geometry.attributes.position).applyMatrix4(p.matrix));
          const size = box.getSize(new THREE.Vector3());
          const c = box.getCenter(new THREE.Vector3());
          const k = FIT[name].long / Math.max(size.x, size.z);
          const fit = new THREE.Matrix4()
            .makeRotationY(FIT[name].yaw)
            .multiply(new THREE.Matrix4().makeScale(k, k, k))
            .multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
          for (const p of parts) p.matrix.premultiply(fit);
        }
        // the sofa comes as a bare shape: dress it in the scanned linen, mapped at true scale
        if (name === 'sofa')
          for (const p of parts) {
            p.geometry = clothUV(p.geometry, p.matrix);
            p.material = M.linen;
          }
        lib[name] = { parts, list: new Map() };
      } catch (e) {
        console.warn('tour model missing', name, e); // the tour runs without it
      }
      onProgress(++done / MODEL_NAMES.length);
    }),
  );
  return lib;
}

// box-mapped UVs in metres: each triangle is projected along the axis it faces most
function clothUV(geometry, matrix) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const n = new THREE.Vector3();
  const e = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 3) {
    for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(pos, i + k).applyMatrix4(matrix);
    n.subVectors(v[1], v[0]).cross(e.subVectors(v[2], v[0]));
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);
    for (let k = 0; k < 3; k++) {
      const p = v[k];
      if (ax >= ay && ax >= az) uv.set([p.z, p.y], (i + k) * 2);
      else if (ay >= az) uv.set([p.x, p.z], (i + k) * 2);
      else uv.set([p.x, p.y], (i + k) * 2);
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
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
