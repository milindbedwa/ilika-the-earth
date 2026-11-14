// ILIKA · Take a tour. Scene set-up, lighting, movement, guided tour and the small interface.
import * as THREE from 'three';
import * as P from './plan.js';
import { makeMaterials } from './materials.js';
import { makeSky, loadSky, sunDirection } from './sky.js';
import { buildHouse, finish } from './build.js';
import { plantGarden, makeGrass } from './garden.js';
import { furnish } from './furnish.js';
import { Nav } from './nav.js';
import { loadModels, flushModels } from './models.js';
import { Ambience } from './audio.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(hover: none) and (pointer: coarse)').matches;
const lockDpr = new URLSearchParams(location.search).has('lock'); // fixed resolution, for screenshots
const plain = new URLSearchParams(location.search).has('plain'); // no post-processing, for quick checks
const lite = coarse || (navigator.hardwareConcurrency || 8) <= 4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

function hasWebGL() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}
function fallback() {
  $('#load').hidden = true;
  $('#fallback').hidden = false;
  document.body.classList.remove('is-loading');
}

if (!hasWebGL()) fallback();
else
  boot().catch((e) => {
    console.error(e);
    fallback();
  });

async function boot() {
  const bar = $('#load-bar');
  const step = async (k, text) => {
    bar.style.transform = `scaleX(${k})`;
    $('#load-text').textContent = text;
    await tick();
  };

  // ---------- renderer ----------
  const canvas = $('#scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  // phones are held close: never render below 1.5 device pixels per point there
  const maxDpr = Math.min(window.devicePixelRatio || 1, 2);
  const minDpr = Math.min(maxDpr, coarse ? 1.5 : 1);
  let dpr = maxDpr;
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // nothing that casts a shadow moves
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.08, 500);
  camera.rotation.order = 'YXZ';

  await step(0.08, 'Mixing lime plaster');
  const M = makeMaterials({
    aniso: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    lite,
    onProgress: (k) => (bar.style.transform = `scaleX(${0.3 + 0.6 * k})`),
  });
  const modelsP = loadModels(M);
  await step(0.14, 'Raising the walls');
  const ctx = buildHouse(M, { lite });
  await step(0.2, 'Planting the garden');
  ctx.models = await modelsP;
  plantGarden(ctx);
  await step(0.25, 'Furnishing the rooms');
  furnish(ctx);
  ctx.plantFlush();
  flushModels(ctx);
  makeGrass(ctx);
  finish(ctx);
  for (const g of Object.values(ctx.groups)) scene.add(g);
  await step(0.28, 'Checking every doorway');
  const nav = new Nav(ctx);

  // ---------- light ----------
  await step(0.3, 'Bringing in stone, timber and sky');
  const sky = makeSky();
  scene.add(sky);
  const sun = new THREE.DirectionalLight('#ffd2a0', 3);
  sun.castShadow = true;
  const sm = Math.min(4096, renderer.capabilities.maxTextureSize);
  sun.shadow.mapSize.set(sm, sm);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 21, bottom: -19, near: 1, far: 170 });
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight('#e6ecf2', '#c9a989', 0.06); // a whisper of bounce from the ground
  scene.add(hemi);
  scene.fog = new THREE.Fog('#e9d2b6', 40, 185);
  // every room's lamp on desktops; the eight that matter most on phones
  const lampLights = [...ctx.lamps]
    .sort((a, b) => b.power * b.dist - a.power * a.dist)
    .slice(0, lite ? 8 : 12)
    .map((l) => {
      const pl = new THREE.PointLight('#ffc88f', 0, l.dist, 1.6);
      pl.position.set(l.x, l.y, l.z);
      pl.userData.power = l.power;
      pl.visible = false;
      scene.add(pl);
      return pl;
    });
  // Day and dusk. The sky photo supplies the soft light from all around; the sun is a lamp placed
  // where the photo's sun stands, because only a lamp can cast the shadows.
  const LIGHT = {
    day: {
      sky: 'day',
      minElev: 0,
      sun: '#ffd8ac',
      sunI: 9,
      hemi: 0.05,
      glow: '#fff1d6',
      haze: '#ddd2c0',
      env: 0.8,
      exp: 1.0,
      pool: 1,
      top: '#5d8fc6',
      mid: '#dcd6c8',
    },
    // twilight: the sky is dim and blue, the last warmth is low in the west, and the house glows
    dusk: {
      sky: 'dusk',
      minElev: 10,
      sun: '#ff9f7a',
      sunI: 0.8,
      hemi: 0.02,
      glow: '#000000',
      haze: '#3f4260',
      env: 0.15,
      skyK: 0.3,
      exp: 1.5,
      pool: 0.08,
      poolGlow: [0.1, 0.62, 0.66],
      top: '#1f2748',
      mid: '#45415f',
    },
  };
  let dusk = false;
  let baseExp = 1;
  let mode = 'intro';
  let lightJob = 0;
  async function setLight(isDusk) {
    dusk = isDusk;
    const L = isDusk ? LIGHT.dusk : LIGHT.day;
    const job = ++lightJob;
    const s = await loadSky(L.sky, renderer);
    if (job !== lightJob) return; // a newer choice was made while this sky was loading
    const d = sunDirection(Math.max(s.elevation, L.minElev));
    sun.position
      .copy(d)
      .multiplyScalar(80)
      .add(new THREE.Vector3(0, 0, 0.5));
    sun.target.position.set(0, 0, 0.5);
    sun.color.set(L.sun);
    sun.intensity = L.sunI;
    hemi.intensity = L.hemi;
    const u = sky.material.uniforms;
    u.uMap.value = s.map;
    u.uShift.value = s.shift;
    u.uV0.value = s.v0;
    u.uGain.value = s.gain * (L.skyK || 1);
    u.uHaze.value.set(L.haze);
    u.uSunCol.value.set(L.glow);
    u.uSun.value.copy(sunDirection(s.elevation));
    scene.fog.color.set(L.haze);
    baseExp = L.exp;
    if (!renderer.toneMappingExposure || mode === 'intro') renderer.toneMappingExposure = L.exp * 1.15;
    const w = ctx.water.material.uniforms;
    w.uSun.value.copy(d);
    w.uSky.value.set(L.top);
    w.uHorizon.value.set(L.mid);
    w.uSunCol.value.set(L.glow);
    w.uLight.value = L.pool;
    w.uGlow.value.fromArray(L.poolGlow || [0, 0, 0]);
    M.setDusk(isDusk ? 1 : 0);
    for (const pl of lampLights) {
      pl.visible = isDusk;
      pl.intensity = isDusk ? 11 * pl.userData.power : 0;
    }
    scene.environment = s.env;
    scene.environmentIntensity = L.env;
    renderer.shadowMap.needsUpdate = true;
  }
  await Promise.all([setLight(false), M.ready]);

  // ---------- post-processing: anti-aliasing, ambient occlusion in corners and under furniture ----------
  const target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const ao = new GTAOPass(scene, camera, 4, 4);
  ao.updateGtaoMaterial({ radius: 0.7, distanceExponent: 1.4, thickness: 1.2, scale: 1.15, samples: lite ? 8 : 16, distanceFallOff: 1 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: lite ? 8 : 16 });
  ao.blendIntensity = 0.9;
  // glass, water, sheers and leaf cards must not write occlusion
  const aoHide = ao._overrideVisibility.bind(ao);
  ao._overrideVisibility = function () {
    aoHide();
    const cache = this._visibilityCache;
    scene.traverse((o) => {
      if (o.visible && o.userData.noAO) {
        o.visible = false;
        cache.push(o);
      }
    });
  };
  sky.userData.noAO = true;
  composer.addPass(ao);
  composer.addPass(new OutputPass());
  let aoOn = true;

  // ---------- visitor ----------
  const me = { x: 0, z: 0, lv: 0, yaw: 0, pitch: 0, y: P.EYE };
  const place = (lv, x, z, lookX, lookZ, pitch = -0.03) => {
    me.lv = lv;
    me.x = x;
    me.z = z;
    me.yaw = Math.atan2(-(lookX - x), -(lookZ - z));
    me.pitch = pitch;
    me.y = nav.height(lv, x, z) + P.EYE;
    walk = null;
    syncFloorUi();
  };
  const planPt = (s) => (s.world ? { p: s.p, l: s.l } : { p: P.W(...s.p), l: P.W(...s.l) });
  let walk = null; // { pts, i, speed, done, face }
  const keys = new Set();
  const pad = { x: 0, y: 0 };
  const orbit = { az: -0.62, pol: 0.92, rad: 46, auto: !reduce };
  const orbitTarget = new THREE.Vector3(0, 2.2, 2.4);
  let cut = 0;

  // destination ring for tap-to-move
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.16, 0.22, 40),
    new THREE.MeshBasicMaterial({ color: '#f1e7d6', transparent: true, opacity: 0, depthTest: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 5;
  scene.add(ring);

  // ---------- fades ----------
  const fadeEl = $('#fade');
  let fading = false;
  async function fade(fn) {
    if (fading) return;
    fading = true;
    fadeEl.classList.add('is-on');
    await new Promise((r) => setTimeout(r, reduce ? 30 : 460));
    fn();
    await tick();
    fadeEl.classList.remove('is-on');
    fading = false;
  }

  // ---------- plan drawings ----------
  const planSvg = (lv, big) => {
    const vb = lv === 0 ? [318, 58, 216, 296] : [340, 58, 196, 296];
    let s = `<svg class="plan" viewBox="${vb.join(' ')}" xmlns="http://www.w3.org/2000/svg" ${big ? `role="group" aria-label="${lv ? 'First' : 'Ground'} floor plan"` : 'aria-hidden="true"'}>`;
    const rc = (r, cls, extra = '') =>
      `<rect class="${cls}" x="${r[0]}" y="${r[1]}" width="${r[2] - r[0]}" height="${r[3] - r[1]}" ${extra}/>`;
    for (const r of P.ROOF) s += rc(r, 'roof');
    if (lv === 0) s += rc([502, 77, 517.7, 164.7], 'roof') + rc([502, 245.5, 517.7, 332], 'roof') + rc([321, 172.6, 362, 233.4], 'roof');
    s += rc([372, 333.4, 460, 347.5], 'roof');
    if (lv === 1) s += rc([474.6, 165, 517.7, 245.5], 'water', 'opacity="0.35"');
    const rooms = P.ROOMS.filter((r) => r.lv === lv);
    for (const r of rooms)
      s += rc(
        r.r,
        (r.id === 'g20' ? 'water' : 'room') + (big ? ' hit' : ''),
        big ? `data-room="${r.id}" tabindex="0" role="button" aria-label="${r.n}. ${r.name}, ${r.dim}"` : '',
      );
    if (big)
      for (const r of rooms) {
        const cx = (r.r[0] + r.r[2]) / 2;
        const cy = (r.r[1] + r.r[3]) / 2;
        s += `<g class="num"><circle cx="${cx}" cy="${cy}" r="5"/><text x="${cx}" y="${cy + 2.3}">${r.n}</text></g>`;
      }
    s += `<g class="who"><path class="cone" d="M0 0L26-13A29 29 0 0 1 26 13Z"/><circle class="me" r="${big ? 4 : 5.5}"/></g></svg>`;
    return s;
  };
  const miniBody = $('#mini-body');
  const planBox = $('#plan-svg');
  let planLv = 0;
  let whoEls = [];
  function drawMini() {
    miniBody.innerHTML = planSvg(me.lv, false);
    $('#mini-floor').textContent = me.lv ? 'First' : 'Ground';
    whoEls = $$('.plan .who');
  }
  function drawPlan(lv) {
    planLv = lv;
    planBox.innerHTML = planSvg(lv, true);
    $('#plan-list').innerHTML = P.ROOMS.filter((r) => r.lv === lv)
      .map(
        (r) =>
          `<li><button type="button" data-room="${r.id}"><span class="n">${r.n}</span><span class="name">${r.name}</span><span class="dim">${r.dim}</span></button></li>`,
      )
      .join('');
    $$('#plan-tabs button').forEach((b) => {
      const on = +b.dataset.plan === lv;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on);
    });
    whoEls = $$('.plan .who');
  }
  function syncFloorUi() {
    $$('#floors button').forEach((b) => b.classList.toggle('is-on', +b.dataset.floor === me.lv));
    drawMini();
    if (!$('#plan').hidden) drawPlan(planLv);
  }
  function updateWho() {
    const [px, py] = P.toPlan(me.x, me.z);
    const fx = -Math.sin(me.yaw);
    const fz = -Math.cos(me.yaw);
    const a = (Math.atan2(-fx, fz) * 180) / Math.PI;
    for (const el of whoEls) {
      const svg = el.ownerSVGElement;
      const vb = svg.viewBox.baseVal;
      const onPlan = svg.parentElement === miniBody || planLv === me.lv;
      el.style.display = onPlan && mode !== 'overview' ? '' : 'none';
      const cx = clamp(px, vb.x + 5, vb.x + vb.width - 5);
      const cy = clamp(py, vb.y + 5, vb.y + vb.height - 5);
      el.setAttribute('transform', `translate(${cx.toFixed(1)} ${cy.toFixed(1)}) rotate(${a.toFixed(0)})`);
    }
  }

  // ---------- modes ----------
  const hud = $('#hud');
  function setMode(m) {
    if (m === 'plan') {
      openPanel('plan');
      return;
    }
    closePanels();
    if (mode === 'tour' && m !== 'tour') tourStop();
    mode = m;
    $$('#modes button').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === m));
    document.body.classList.toggle('is-explore', m === 'explore');
    $('#floors').hidden = m === 'overview';
    $('#cut').hidden = m !== 'overview';
    $('#mini').hidden = m === 'overview';
    $('#tourbar').hidden = m !== 'tour';
    document.body.classList.toggle('has-tourbar', m === 'tour');
    if (m !== 'overview') setCut(0);
    if (m === 'overview') {
      orbit.auto = !reduce;
      walk = null;
    }
    if (m === 'tour') tourStart();
    if (m === 'explore' && !sessionStorage.getItem('ilika-tour-help')) $('#help').hidden = false;
    else $('#help').hidden = true;
  }
  function setCut(c) {
    if (cut === c) return;
    cut = c;
    ctx.groups.crown.visible = c < 1;
    ctx.groups.upper.visible = c < 2;
    ctx.groups.slab.visible = c < 2;
    $$('#cut button').forEach((b) => b.classList.toggle('is-on', +b.dataset.cut === c));
    renderer.shadowMap.needsUpdate = true;
  }
  function openPanel(id) {
    closePanels();
    $('#' + id).hidden = false;
    if (id === 'plan') {
      drawPlan(me.lv);
      $$('#modes button').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === 'plan'));
    }
    $('#' + id + ' [data-close]').focus({ preventScroll: true });
  }
  function closePanels() {
    for (const p of $$('.t-panel')) p.hidden = true;
    $$('#modes button').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === mode));
  }
  function goRoom(id) {
    const r = P.ROOMS.find((q) => q.id === id);
    if (!r) return;
    if (mode !== 'explore') setMode('explore');
    else closePanels();
    const [x, z] = P.W(...r.v);
    const [lx, lz] = P.W(...r.l);
    fade(() => place(r.lv, x, z, lx, lz));
  }
  function goFloor(lv) {
    if (lv === me.lv && mode === 'explore') return;
    if (mode !== 'explore') setMode('explore');
    const v = lv ? { p: P.W(446, 318), l: P.W(404, 262) } : { p: P.W(372, 203), l: P.W(420, 172) };
    fade(() => place(lv, v.p[0], v.p[1], v.l[0], v.l[1]));
  }
  function reset() {
    if (mode === 'overview') Object.assign(orbit, { az: -0.62, pol: 0.92, rad: 46 });
    else if (mode === 'tour') tourGo(0, true);
    else fade(() => place(P.START.lv, P.START.p[0], P.START.p[1], P.START.l[0], P.START.l[1], 0.02));
  }

  // ---------- guided tour ----------
  const tour = { i: 0, playing: false, phase: 'idle', t: 0 };
  const playBtn = $('#tour-play');
  $('#tour-of').textContent = P.TOUR.length;
  function tourUi() {
    const s = P.TOUR[tour.i];
    $('#tour-n').textContent = tour.i + 1;
    $('#tour-title').textContent = s.t;
    $('#tour-cap').textContent = s.c;
    playBtn.classList.toggle('is-paused', !tour.playing);
    playBtn.setAttribute('aria-label', tour.playing ? 'Pause tour' : 'Resume tour');
  }
  function tourStart() {
    tour.playing = true;
    tourGo(0, true);
  }
  function tourStop() {
    tour.playing = false;
    tour.phase = 'idle';
    walk = null;
  }
  function tourArrive() {
    tour.phase = 'dwell';
    tour.t = 7;
  }
  function tourGo(i, cutTo = false) {
    tour.i = (i + P.TOUR.length) % P.TOUR.length;
    const s = P.TOUR[tour.i];
    const { p, l } = planPt(s);
    tourUi();
    const jump = () => {
      place(s.lv, p[0], p[1], l[0], l[1]);
      tourArrive();
    };
    const route = !cutTo && !reduce && s.lv === me.lv ? nav.path(me.lv, me, { x: p[0], z: p[1] }) : null;
    if (!route || route.length_m > 30 || route.length_m < 0.3) {
      tour.phase = 'fade';
      fade(jump);
      return;
    }
    tour.phase = 'move';
    walk = { pts: route, i: 1, speed: 1.25, turn: true, face: l, done: tourArrive };
  }
  function tourToggle() {
    tour.playing = !tour.playing;
    if (tour.playing && tour.phase === 'idle') tourGo(tour.i + 1);
    tourUi();
  }

  // ---------- input ----------
  const pointers = new Map();
  let drag = null;
  let pinch = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (mode === 'intro') return;
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
    canvas.classList.add('is-drag');
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
    orbit.auto = false;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && mode === 'overview') {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) orbit.rad = clamp((orbit.rad * pinch) / d, 16, 80);
      pinch = d;
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
    if (!drag.moved) return;
    const k = (camera.fov / 58) * (e.pointerType === 'touch' ? 0.0052 : 0.0034);
    if (mode === 'overview') {
      orbit.az -= dx * 0.006;
      orbit.pol = clamp(orbit.pol - dy * 0.005, 0.12, 1.45);
    } else {
      me.yaw += dx * k;
      me.pitch = clamp(me.pitch + dy * k, -1.1, 1.1);
      if (walk && walk.turn) walk.hold = 2.2;
    }
  });
  const up = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    pinch = 0;
    canvas.classList.remove('is-drag');
    if (drag && !drag.moved && performance.now() - drag.t < 450 && mode === 'explore' && e.type === 'pointerup')
      tapMove(e.clientX, e.clientY);
    drag = pointers.size ? { ...[...pointers.values()][0], sx: 0, sy: 0, t: 0, moved: true } : null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      if (mode === 'overview') {
        orbit.rad = clamp(orbit.rad * (1 + Math.sign(e.deltaY) * 0.08), 16, 80);
        orbit.auto = false;
      }
    },
    { passive: false },
  );
  const ray = new THREE.Raycaster();
  function tapMove(cx, cy) {
    const ndc = new THREE.Vector2((cx / sizeW) * 2 - 1, -(cy / sizeH) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin;
    const d = ray.ray.direction;
    let best = null;
    const hs = me.lv ? [P.F1] : [P.PLINTH, 0, P.PIT, P.PAVILION.h];
    if (d.y < -0.02)
      for (const h of hs) {
        const t = (h - o.y) / d.y;
        if (t <= 0 || t > 40) continue;
        const x = o.x + d.x * t;
        const z = o.z + d.z * t;
        if (Math.abs(nav.height(me.lv, x, z) - h) > 0.2) continue;
        if (!best || t < best.t) best = { t, x, z };
      }
    if (!best) {
      // tapped a wall or the sky: walk a few steps that way
      const n = Math.hypot(d.x, d.z) || 1;
      best = { x: me.x + (d.x / n) * 5, z: me.z + (d.z / n) * 5 };
    }
    // stop short of whatever is in the way along the line of sight
    const dist = Math.hypot(best.x - me.x, best.z - me.z);
    const n = Math.ceil(dist / 0.12);
    let goal = { x: best.x, z: best.z };
    let blockedAt = -1;
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (nav.hit(me.lv, me.x + (best.x - me.x) * k, me.z + (best.z - me.z) * k, 0.05)) {
        blockedAt = i;
        break;
      }
    }
    if (blockedAt > 0) {
      const k = Math.max(0, (blockedAt - 3) / n);
      goal = { x: me.x + (best.x - me.x) * k, z: me.z + (best.z - me.z) * k };
      // a low thing (sofa, bench, pool edge) with floor beyond it: go round to the point tapped
      if (!nav.hit(me.lv, best.x, best.z) && dist < 14) goal = { x: best.x, z: best.z };
    }
    const route = nav.path(me.lv, me, goal);
    if (!route || route.length < 2 || route.length_m > 45) return;
    const end = route[route.length - 1];
    ring.position.set(end.x, nav.height(me.lv, end.x, end.z) + 0.03, end.z);
    ring.material.opacity = 0.9;
    walk = { pts: route, i: 1, speed: 2.1, turn: false, done: () => {} };
    $('#help').hidden = true;
  }
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key === 'Escape') {
      if ($$('.t-panel').some((p) => !p.hidden)) closePanels();
      else if (mode === 'tour' || mode === 'overview') setMode('explore');
      return;
    }
    if (mode !== 'explore') return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (['w', 'a', 's', 'd', 'q', 'e', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'].includes(k)) {
      keys.add(k);
      if (k !== 'Shift') {
        walk = null;
        $('#help').hidden = true;
      }
      if (k.startsWith('Arrow')) e.preventDefault();
    }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  addEventListener('blur', () => keys.clear());
  // touch pad
  const padEl = $('#pad');
  const knob = $('#pad-knob');
  let padId = null;
  const padMove = (e) => {
    const r = padEl.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2);
    let y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    pad.x = x;
    pad.y = y;
    knob.style.transform = `translate(${x * 28}px, ${y * 28}px)`;
  };
  padEl.addEventListener('pointerdown', (e) => {
    padId = e.pointerId;
    padEl.setPointerCapture(padId);
    walk = null;
    $('#help').hidden = true;
    padMove(e);
  });
  padEl.addEventListener('pointermove', (e) => e.pointerId === padId && padMove(e));
  const padUp = (e) => {
    if (e.pointerId !== padId) return;
    padId = null;
    pad.x = pad.y = 0;
    knob.style.transform = '';
  };
  padEl.addEventListener('pointerup', padUp);
  padEl.addEventListener('pointercancel', padUp);

  // ---------- interface wiring ----------
  $('#modes').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setMode(b.dataset.mode);
  });
  $('#floors').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) goFloor(+b.dataset.floor);
  });
  $('#cut').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setCut(+b.dataset.cut);
  });
  $('#plan-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) drawPlan(+b.dataset.plan);
  });
  const pick = (e) => {
    const el = e.target.closest('[data-room]');
    if (el && (e.type === 'click' || e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      goRoom(el.dataset.room);
    }
  };
  $('#plan').addEventListener('click', pick);
  $('#plan').addEventListener('keydown', pick);
  for (const b of $$('[data-close]')) b.addEventListener('click', closePanels);
  $('#btn-info').addEventListener('click', () => openPanel('info'));
  $('#btn-reset').addEventListener('click', reset);
  $('#btn-light').addEventListener('click', (e) => {
    // day turns to evening behind a short fade
    const btn = e.currentTarget;
    const to = !dusk;
    btn.setAttribute('aria-pressed', to);
    fadeEl.classList.add('is-on');
    setTimeout(
      async () => {
        await setLight(to);
        await tick();
        fadeEl.classList.remove('is-on');
      },
      reduce ? 30 : 460,
    );
  });
  const amb = new Ambience();
  $('#btn-sound').addEventListener('click', (e) => {
    if (amb.on) amb.stop();
    else amb.start();
    e.currentTarget.setAttribute('aria-pressed', amb.on);
  });
  $('#mini-toggle').addEventListener('click', (e) => {
    const closed = $('#mini').classList.toggle('is-closed');
    e.currentTarget.setAttribute('aria-expanded', !closed);
  });
  miniBody.addEventListener('click', () => openPanel('plan'));
  $('#help-ok').addEventListener('click', () => {
    $('#help').hidden = true;
    sessionStorage.setItem('ilika-tour-help', '1');
  });
  $('#tour-prev').addEventListener('click', () => tourGo(tour.i - 1, true));
  $('#tour-next').addEventListener('click', () => tourGo(tour.i + 1, true));
  playBtn.addEventListener('click', tourToggle);
  $('#enter').addEventListener('click', () => {
    $('#intro').classList.add('is-out');
    setTimeout(() => ($('#intro').hidden = true), 950);
    hud.hidden = false;
    setMode('explore');
    canvas.focus({ preventScroll: true });
  });

  // ---------- frame ----------
  let sizeW = 0;
  let sizeH = 0;
  function resize() {
    const w = (sizeW = canvas.clientWidth || innerWidth);
    const h = (sizeH = canvas.clientHeight || innerHeight);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 74 : 58;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  addEventListener('orientationchange', resize);
  resize();

  const poolC = P.W(496, 205);
  let last = performance.now();
  let slow = 0;
  let fast = 0;
  let labelT = 0;
  let time = 0;
  function update(dt) {
    time += dt;
    // the eye adapts: rooms are exposed brighter than the garden, as a camera or a person would
    const [ex, ey] = P.toPlan(me.x, me.z);
    const inside =
      mode !== 'overview' &&
      mode !== 'intro' &&
      ex > 362 &&
      (me.lv
        ? ex < 429 && ey > 152.5 && ey < 255
        : (ex < 429 && ey > 78.5 && ey < 331) || (ex < 484.5 && (ey < 134.4 || ey > 276) && ey > 78.5 && ey < 331));
    const expT = baseExp * (inside ? (dusk ? 0.8 : 1.75) : 1.15);
    renderer.toneMappingExposure += (expT - renderer.toneMappingExposure) * Math.min(1, dt * 1.6);
    if (!reduce) {
      ctx.water.material.uniforms.uTime.value = time;
      M.wind.value = time;
    }
    if (ring.material.opacity > 0) {
      ring.material.opacity = Math.max(0, ring.material.opacity - dt * (walk ? 0.25 : 2.5));
      ring.scale.setScalar(1 + 0.12 * Math.sin(time * 5));
    }
    if (mode === 'overview') {
      $('#room').hidden = true;
      if (orbit.auto) orbit.az += dt * 0.05;
      const sp = Math.sin(orbit.pol);
      camera.position.set(
        orbitTarget.x + orbit.rad * sp * Math.sin(orbit.az),
        orbitTarget.y + orbit.rad * Math.cos(orbit.pol),
        orbitTarget.z + orbit.rad * sp * Math.cos(orbit.az),
      );
      camera.lookAt(orbitTarget);
      return;
    }
    if (mode === 'intro') {
      // a slow breath of movement while the title is up
      const s = reduce ? 0 : Math.sin(time * 0.12);
      camera.position.set(me.x + s * 0.9, me.y + 0.05, me.z);
      camera.rotation.set(me.pitch, me.yaw + s * 0.02, 0);
      return;
    }
    // walking a route (tap-to-move or guided tour)
    if (walk && !(mode === 'tour' && !tour.playing)) {
      const tgt = walk.pts[walk.i];
      const dx = tgt.x - me.x;
      const dz = tgt.z - me.z;
      const d = Math.hypot(dx, dz);
      const lastPt = walk.pts[walk.pts.length - 1];
      const toEnd = Math.hypot(lastPt.x - me.x, lastPt.z - me.z);
      const sp = walk.speed * clamp(toEnd / 0.9 + 0.2, 0.2, 1) * dt;
      if (d <= sp) {
        me.x = tgt.x;
        me.z = tgt.z;
        walk.i++;
        if (walk.i >= walk.pts.length) {
          const done = walk.done;
          walk = null;
          done();
        }
      } else {
        me.x += (dx / d) * sp;
        me.z += (dz / d) * sp;
      }
      if (walk && walk.turn) {
        walk.hold = Math.max(0, (walk.hold || 0) - dt);
        if (!walk.hold) {
          const face = toEnd < 1.6 ? Math.atan2(-(walk.face[0] - me.x), -(walk.face[1] - me.z)) : Math.atan2(-dx, -dz);
          me.yaw += clamp(angDiff(me.yaw, face), -1.5 * dt, 1.5 * dt);
          me.pitch += (-0.03 - me.pitch) * Math.min(1, dt * 2);
        }
      }
    } else if (mode === 'explore') {
      let mx = pad.x;
      let mz = -pad.y;
      if (keys.has('w') || keys.has('ArrowUp')) mz += 1;
      if (keys.has('s') || keys.has('ArrowDown')) mz -= 1;
      if (keys.has('a')) mx -= 1;
      if (keys.has('d')) mx += 1;
      const turn = (keys.has('ArrowLeft') || keys.has('q') ? 1 : 0) - (keys.has('ArrowRight') || keys.has('e') ? 1 : 0);
      me.yaw += turn * 1.6 * dt;
      const m = Math.hypot(mx, mz);
      if (m > 0.05) {
        const sp = (keys.has('Shift') ? 3.4 : 2.0) * Math.min(1, m) * dt;
        const fx = -Math.sin(me.yaw);
        const fz = -Math.cos(me.yaw);
        const q = nav.move(me.lv, me, ((fx * mz - fz * mx) / m) * sp, ((fz * mz + fx * mx) / m) * sp);
        me.x = q.x;
        me.z = q.z;
      }
    }
    if (mode === 'tour' && tour.playing && tour.phase === 'dwell') {
      tour.t -= dt;
      if (tour.t <= 0) {
        if (tour.i === P.TOUR.length - 1) {
          tour.playing = false;
          tour.phase = 'idle';
          tourUi();
        } else tourGo(tour.i + 1);
      }
    }
    const ty = nav.height(me.lv, me.x, me.z) + P.EYE;
    me.y += (ty - me.y) * Math.min(1, dt * 9);
    camera.position.set(me.x, me.y, me.z);
    camera.rotation.set(me.pitch, me.yaw, 0);

    labelT -= dt;
    if (labelT <= 0) {
      labelT = 0.25;
      $('#room').textContent = P.roomAt(me.lv, me.x, me.z);
      $('#room').hidden = false;
      updateWho();
      if (amb.on) {
        amb.setWater(clamp(1 - Math.hypot(me.x - poolC[0], me.z - poolC[1]) / 16, 0, 1));
        const [px, py] = P.toPlan(me.x, me.z);
        amb.setIndoors(px > 362 && px < 430 && py > 78 && py < 331 ? 1 : 0);
      }
    }
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    const raw = (now - last) / 1000;
    last = now;
    if (canvas.clientWidth !== sizeW || canvas.clientHeight !== sizeH) resize(); // catches rotation and browser bars
    update(Math.min(0.05, raw));
    // the patch of grass blades sits just ahead of the visitor
    const gt = ctx.grass.uniforms.uTile.value * 0.26;
    ctx.grass.uniforms.uCam.value.set(camera.position.x - Math.sin(me.yaw) * gt, camera.position.z - Math.cos(me.yaw) * gt);
    ctx.grass.mesh.visible = mode !== 'overview';
    ao.enabled = aoOn;
    if (plain) renderer.render(scene, camera);
    else composer.render();
    window.__tour.frames++;
    // adaptive resolution: drop when frames run long, climb back slowly
    if (lockDpr) return;
    // Quality governor. 30 fps is a normal ceiling (phones in Low Power Mode), so only frames
    // slower than about 22 fps count as slow. Ambient occlusion goes first, resolution second.
    if (raw > 0.045) {
      slow += raw;
      fast = 0;
    } else {
      fast += raw;
      slow = Math.max(0, slow - raw * 0.5);
    }
    if (time < 4) slow = 0; // ignore the stutter of first-time shader compilation
    if (slow > 2) {
      slow = 0;
      if (aoOn) aoOn = false;
      else if (dpr > minDpr) {
        dpr = Math.max(minDpr, dpr * 0.85);
        renderer.setPixelRatio(dpr);
        resize();
      }
    } else if (fast > 12 && dpr < maxDpr) {
      dpr = Math.min(maxDpr, dpr * 1.1);
      renderer.setPixelRatio(dpr);
      resize();
      fast = 0;
    }
  }

  // handle for automated checks
  window.__tour = {
    frames: 0,
    composer,
    ao,
    sun,
    P,
    nav,
    me,
    ctx,
    place,
    goRoom,
    goFloor,
    setMode,
    setLight,
    setCut,
    orbit,
    tour,
    renderer,
    scene,
    camera,
  };

  place(P.START.lv, P.START.p[0], P.START.p[1], P.START.l[0], P.START.l[1], 0.02);
  renderer.compile(scene, camera);
  await step(1, 'Ready');
  requestAnimationFrame(frame);
  await tick();
  $('#load').classList.add('is-done');
  setTimeout(() => ($('#load').hidden = true), 900);
  $('#intro').hidden = false;
  document.body.classList.remove('is-loading');
  canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
}
