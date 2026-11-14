// ILIKA tour: the sky. A photographed sky panorama (Poly Haven, CC0) lights the scene and is what
// you see overhead. public/tour/sky holds, for day and dusk, a small .hdr for lighting and a
// sharper image for the view; sky.json says where the sun is in each.
import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

// compass direction the sun comes from in the model (west-south-west), as an angle in the x-z plane
export const SUN_AZIMUTH = Math.atan2(0.5, -0.8);
const U_SUN = SUN_AZIMUTH / (Math.PI * 2) + 0.5; // the same, as a position across a panorama

export function sunDirection(elevationDeg) {
  const e = THREE.MathUtils.degToRad(elevationDeg);
  return new THREE.Vector3(Math.cos(e) * Math.cos(SUN_AZIMUTH), Math.sin(e), Math.cos(e) * Math.sin(SUN_AZIMUTH));
}

export function makeSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uMap: { value: null },
      uShift: { value: 0 },
      uV0: { value: 0.47 },
      uGain: { value: 1 },
      uHaze: { value: new THREE.Color('#d9cdb9') },
      uSun: { value: new THREE.Vector3(0, 1, 0) },
      uSunCol: { value: new THREE.Color('#fff1d6') },
    },
    vertexShader:
      'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vDir; uniform sampler2D uMap; uniform float uShift, uV0, uGain; uniform vec3 uHaze, uSun, uSunCol;
      void main(){
        vec3 d = normalize(vDir);
        float u = atan(d.z, d.x) / 6.2831853 + 0.5 + uShift;
        float v = asin(clamp(d.y, -1.0, 1.0)) / 3.14159265 + 0.5;
        float tv = (v - uV0) / (1.0 - uV0);
        vec3 c = texture2D(uMap, vec2(u, clamp(tv, 0.004, 0.996))).rgb * uGain;
        // below the horizon the photo ends: fade to the haze the distant trees dissolve into
        c = mix(uHaze, c, smoothstep(-0.02, 0.06, tv));
        // the photo clips at white where the sun is: put its disc and glare back
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += uSunCol * (pow(s, 3000.0) * 12.0 + pow(s, 300.0) * 0.5);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
  mesh.frustumCulled = false;
  return mesh;
}

let infoP = null;
const cache = {};
// loads one sky: resolves with the lighting map, the view texture and where its sun stands
export function loadSky(name, renderer) {
  if (cache[name]) return cache[name];
  infoP = infoP || fetch('/tour/sky/sky.json').then((r) => r.json());
  const env = new Promise((ok, fail) => new HDRLoader().load(`/tour/sky/${name}.hdr`, ok, undefined, fail));
  const view = new Promise((ok, fail) => new THREE.TextureLoader().load(`/tour/sky/${name}.webp`, ok, undefined, fail));
  cache[name] = Promise.all([infoP, env, view]).then(([info, hdr, map]) => {
    const i = info[name];
    // turn the panorama so its sun stands where the model's sun does: shift the columns
    const { data, width: w, height: h } = hdr.image;
    const shift = Math.round((U_SUN - i.sunU) * w);
    const row = new data.constructor(w * 4);
    for (let y = 0; y < h; y++) {
      const o = y * w * 4;
      for (let x = 0; x < w; x++) {
        const sx = (((x - shift) % w) + w) % w;
        for (let c = 0; c < 4; c++) row[x * 4 + c] = data[o + sx * 4 + c];
      }
      data.set(row, o);
    }
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    hdr.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(hdr);
    pmrem.dispose();
    hdr.dispose();
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.generateMipmaps = false;
    map.minFilter = map.magFilter = THREE.LinearFilter;
    return {
      env: rt.texture,
      map,
      shift: i.sunU - U_SUN,
      v0: 0.5 - i.below / 180,
      gain: 1 / i.gain,
      elevation: i.sunElevation,
    };
  });
  return cache[name];
}
