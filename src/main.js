import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);
// iOS shows/hides its address bar while you scroll, which fires resize events; refreshing
// every ScrollTrigger mid-scroll is a classic source of judder, so ignore those
ScrollTrigger.config({ ignoreMobileResize: true });

const root = document.documentElement;
const body = document.body;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mm = gsap.matchMedia();
const EASE = 'expo.out';

/* ---------- smooth scroll ---------- */
scrollTo(0, 0);
let lenis = null;
if (motion) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, anchors: false });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}

const headerOffset = () => -(parseFloat(getComputedStyle(root).getPropertyValue('--header-h')) || 60);
function scrollToTarget(target) {
  if (!target) return;
  const isHero = target.id === 'top';
  if (lenis) lenis.scrollTo(isHero ? 0 : target, { offset: isHero ? 0 : headerOffset() + 1, duration: 1.6 });
  else target.scrollIntoView({ behavior: 'auto' });
}

/* ---------- menu ---------- */
const menu = $('[data-menu]');
const menuToggle = $('[data-menu-toggle]');
function setMenu(open) {
  body.classList.toggle('menu-open', open);
  menuToggle.setAttribute('aria-expanded', String(open));
  menu.setAttribute('aria-hidden', String(!open));
  menu.inert = !open;
  if (lenis) open ? lenis.stop() : lenis.start();
  queueChrome();
}
menu.inert = true;
menuToggle.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
addEventListener('keydown', (e) => e.key === 'Escape' && body.classList.contains('menu-open') && setMenu(false));

/* ---------- in-page links ---------- */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const target = document.getElementById(a.getAttribute('href').slice(1));
  if (!target) return;
  e.preventDefault();
  const wasOpen = body.classList.contains('menu-open');
  if (wasOpen) setMenu(false);
  setTimeout(() => scrollToTarget(target), wasOpen ? 450 : 0);
});

// Returning via the back button (page restored from cache) also starts at the cover
addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  if (lenis) lenis.scrollTo(0, { immediate: true });
  else scrollTo(0, 0);
});

/* ---------- header + browser bars ---------- */
// The page is a stack of coloured bands (sand, linen, clay, dark photo covers, the map…).
// Their positions and colours are measured once (and again on every ScrollTrigger refresh),
// so scrolling only does arithmetic — no DOM reads or hit-testing per frame.
const header = $('[data-header]');
const themeMeta = $('meta[name="theme-color"]');
const toHex = (rgb) =>
  '#' +
  rgb
    .match(/\d+/g)
    .slice(0, 3)
    .map((n) => (+n).toString(16).padStart(2, '0'))
    .join('');
const solid = (el) => {
  const bg = getComputedStyle(el).backgroundColor;
  const a = bg
    .match(/rgba?\(([^)]+)\)/)?.[1]
    .split(',')
    .map(Number);
  return a && (a[3] ?? 1) === 1 ? bg : null;
};
let bands = [];
let headerH = 60;
let viewH = innerHeight;
function buildBands() {
  const sy = lenis ? lenis.scroll : scrollY;
  headerH = header.getBoundingClientRect().height;
  viewH = innerHeight;
  bands = $$('main > *, .earth, .earth > section, .map__screen, .footer, .wellness, .gallery')
    .map((el) => {
      let bg = null;
      for (let e = el; e && !bg && e !== document.documentElement; e = e.parentElement) bg = solid(e);
      // a pinned element owns its whole pin distance
      const box = el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el;
      const r = box.getBoundingClientRect();
      return {
        top: r.top + sy,
        bottom: r.bottom + sy,
        bg: toHex(bg || 'rgb(233,227,214)'),
        grain: !!el.closest('.grain'),
        dark: !!el.closest('[data-theme="dark"]'),
      };
    })
    .filter((b) => b.bottom > b.top)
    .sort((a, b) => b.bottom - b.top - (a.bottom - a.top)); // big first, so smaller (inner) bands win
  updateBars(true);
}
const bandAt = (y) => {
  let hit = null;
  for (const b of bands) if (y >= b.top && y < b.bottom) hit = b;
  return hit || { bg: '#e9e3d6', grain: false, dark: false };
};

const rotateMq = matchMedia('(orientation: landscape) and (max-height: 540px) and (hover: none) and (pointer: coarse)');
let lastY = lenis ? lenis.scroll : scrollY;
let chrome = '';
let chromeBottom = '';
function updateBars(force) {
  const y = lenis ? lenis.scroll : scrollY;
  // hide on scroll down, show on scroll up
  const goingDown = y > lastY + 2;
  const goingUp = y < lastY - 2;
  if (goingDown && y > 140 && !body.classList.contains('menu-open')) header.classList.add('is-hidden');
  else if (goingUp || y < 140) header.classList.remove('is-hidden');
  if (goingDown || goingUp || force) root.classList.toggle('header-visible', !header.classList.contains('is-hidden'));
  lastY = y;

  const hidden = header.classList.contains('is-hidden');
  header.classList.toggle('is-dark', bandAt(y + headerH / 2).dark);

  // top bar: the content just below the header (or the very top while it's hidden)
  let top = bandAt(y + (hidden ? 1 : headerH + 2));
  if (rotateMq.matches || body.classList.contains('menu-open')) top = { bg: '#8a4a32', grain: true };
  header.classList.toggle('is-grain', top.grain);
  if (top.bg !== chrome) {
    chrome = top.bg;
    themeMeta.content = chrome;
    root.style.setProperty('--chrome', chrome);
  }
  // bottom: page background behind Safari's toolbar and the overscroll area
  const b = bandAt(y + viewH - 2).bg;
  if (b !== chromeBottom) {
    chromeBottom = b;
    root.style.setProperty('--chrome-bottom', b);
  }
}
const queueChrome = () => updateBars(true);
lenis ? lenis.on('scroll', () => updateBars()) : addEventListener('scroll', () => updateBars(), { passive: true });
rotateMq.addEventListener?.('change', queueChrome);
ScrollTrigger.addEventListener('refresh', buildBands);
buildBands();

// no hover work while the page is moving: hit-testing content that slides under a
// still mouse is a large share of scroll cost
let scrollIdle;
const onScrollHover = () => {
  if (!body.classList.contains('is-scrolling')) body.classList.add('is-scrolling');
  clearTimeout(scrollIdle);
  scrollIdle = setTimeout(() => body.classList.remove('is-scrolling'), 140);
};
lenis ? lenis.on('scroll', onScrollHover) : addEventListener('scroll', onScrollHover, { passive: true });

// active nav link
$$('.header__nav a').forEach((a) => {
  const sec = document.getElementById(a.getAttribute('href').slice(1));
  if (!sec) return;
  ScrollTrigger.create({
    trigger: sec,
    start: 'top 40%',
    end: 'bottom 40%',
    onToggle: (st) => a.classList.toggle('is-active', st.isActive),
  });
});

/* ---------- logo written by an invisible pen ---------- */
// Each stroke in src/svg/logo.svg carries its traced centre line (data-pen). A white
// pen line in a mask draws along it, so the ink appears in writing order.
let inkCount = 0;
function prepareInk(svg) {
  const NS = 'http://www.w3.org/2000/svg';
  const defs = document.createElementNS(NS, 'defs');
  const vb = svg.viewBox.baseVal;
  svg.prepend(defs);
  const pens = [];
  $$('path[data-pen]', svg).forEach((fill) => {
    const mask = document.createElementNS(NS, 'mask');
    mask.id = `ink-${++inkCount}`;
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    Object.entries({ x: vb.x, y: vb.y, width: vb.width, height: vb.height }).forEach(([k, v]) => mask.setAttribute(k, v));
    fill.dataset.pen.split(/(?=M)/).forEach((d) => {
      const pen = document.createElementNS(NS, 'path');
      pen.setAttribute('d', d.trim());
      pen.setAttribute('fill', 'none');
      pen.setAttribute('stroke', '#fff');
      pen.setAttribute('stroke-width', fill.dataset.penW);
      pen.setAttribute('stroke-linecap', 'round');
      pen.setAttribute('stroke-linejoin', 'round');
      pen.style.visibility = 'hidden';
      mask.append(pen);
      defs.append(mask);
      const len = pen.getTotalLength();
      pen.style.strokeDasharray = `${len} ${len + 1}`;
      pen.style.strokeDashoffset = len;
      pens.push({ pen, len });
    });
    fill.setAttribute('mask', `url(#${mask.id})`);
  });
  svg.style.visibility = 'visible';
  return pens;
}
function writeInk(svg, pens, speed = 160) {
  const tl = gsap.timeline({
    onComplete: () => $$('[mask]', svg).forEach((f) => f.removeAttribute('mask')),
  });
  pens.forEach(({ pen, len }, i) =>
    tl.to(
      pen,
      {
        strokeDashoffset: 0,
        duration: Math.max(0.1, len / speed),
        ease: 'sine.inOut',
        onStart: () => (pen.style.visibility = 'visible'),
      },
      i ? '>-0.02' : 0,
    ),
  );
  return tl;
}

/* ---------- hero intro ---------- */
function intro() {
  const logo = $('.hero__logo svg');
  if (!motion) {
    body.classList.add('is-ready');
    return;
  }
  const tl = gsap.timeline({ defaults: { ease: EASE } });
  tl.add(writeInk(logo, prepareInk(logo)), 0.35)
    .to('[data-hero-line]', { opacity: 1, y: 0, duration: 1.2 }, '>-0.6')
    .add(() => {
      body.classList.add('is-ready');
      lenis?.start();
    }, 1.2);
}
let started = false;
const go = () => {
  if (started) return;
  started = true;
  body.classList.remove('is-loading');
  intro();
};
Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 2200))]).then(go);

// hero drifts away as you scroll
if (motion) {
  gsap.to('.hero__center', {
    yPercent: 35,
    opacity: 0,
    ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
}

/* ---------- text reveals ---------- */
if (motion) {
  $$('[data-split]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit(self) {
        gsap.set(el, { visibility: 'visible' });
        return gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.3,
          ease: EASE,
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      },
    });
  });

  // statement: words light up as you scroll
  $$('[data-words]').forEach((el) => {
    const split = SplitText.create(el, { type: 'words' });
    gsap.fromTo(
      split.words,
      { opacity: 0.14 },
      {
        opacity: 1,
        stagger: 0.12,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
      },
    );
  });

  $$('[data-fade]').forEach((el) =>
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1.4,
      ease: EASE,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    }),
  );

  $$('[data-stagger]').forEach((list) =>
    ScrollTrigger.batch(list.children, {
      start: 'top 92%',
      once: true,
      onEnter: (items) => gsap.to(items, { opacity: 1, y: 0, duration: 1.2, ease: EASE, stagger: 0.08 }),
    }),
  );

  /* ---------- image reveals + parallax ---------- */
  $$('[data-reveal]').forEach((el) => {
    const img = $('img', el);
    gsap.to(el, {
      clipPath: 'inset(0% 0 0 0)',
      duration: 1.6,
      ease: 'expo.inOut',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
    if (img && !img.hasAttribute('data-parallax'))
      gsap.from(img, { scale: 1.25, duration: 2, ease: EASE, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });

  $$('img[data-parallax]').forEach((img) => {
    const strong = img.dataset.parallax === 'strong';
    const box = img.closest('.media, .cover__media') || img.parentElement;
    gsap.fromTo(
      img,
      { yPercent: strong ? -10 : -6 },
      {
        yPercent: strong ? 10 : 6,
        ease: 'none',
        scrollTrigger: { trigger: box, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    );
  });
} else {
  $$('[data-split]').forEach((el) => (el.style.visibility = 'visible'));
}

/* ---------- gallery ---------- */
const gallery = $('[data-gallery]');
if (gallery) {
  const viewport = $('[data-gallery-viewport]', gallery);
  const track = $('[data-gallery-track]', gallery);
  const bar = $('[data-gallery-bar]', gallery);

  // touch / small screens: native swipe, bar follows scroll
  const syncBar = () => {
    const max = viewport.scrollWidth - viewport.clientWidth;
    bar.style.transform = `scaleX(${max > 0 ? Math.max(0.08, viewport.scrollLeft / max) : 1})`;
  };
  viewport.addEventListener('scroll', syncBar, { passive: true });
  syncBar();

  // desktop: pin and translate the track with vertical scroll
  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    gallery.classList.add('is-pinned');
    const GALLERY_SLOWNESS = 10; // higher = slower
    const distance = () => track.scrollWidth - innerWidth;
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: gallery,
        start: 'top top',
        // 10px of scrolling per 1px of sideways travel: the photos drift slowly past
        end: () => `+=${distance() * GALLERY_SLOWNESS}`,
        pin: true,
        anticipatePin: 1,
        scrub: 1.2,
        invalidateOnRefresh: true,
        onUpdate: (st) => (bar.style.transform = `scaleX(${Math.max(0.08, st.progress)})`),
      },
    });
    return () => {
      gallery.classList.remove('is-pinned');
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(track, { clearProps: 'x' });
    };
  });

  // mouse drag on desktop without pin (reduced motion / mid widths)
  let down = false,
    startX = 0,
    startLeft = 0;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || gallery.classList.contains('is-pinned')) return;
    down = true;
    startX = e.clientX;
    startLeft = viewport.scrollLeft;
    viewport.style.scrollSnapType = 'none';
  });
  addEventListener('pointermove', (e) => down && (viewport.scrollLeft = startLeft - (e.clientX - startX)));
  addEventListener('pointerup', () => {
    if (!down) return;
    down = false;
    viewport.style.scrollSnapType = '';
  });
}

/* ---------- wellness: ritual chips follow the scroll ---------- */
const ritualNav = $('[data-rituals-nav]');
if (ritualNav) {
  const chips = $$('a', ritualNav);
  chips.forEach((chip) => {
    const sec = document.getElementById(chip.getAttribute('href').slice(1));
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (st) => {
        chip.classList.toggle('is-active', st.isActive);
        if (st.isActive)
          ritualNav.scrollTo({
            left: chip.offsetLeft - (ritualNav.clientWidth - chip.offsetWidth) / 2,
            behavior: motion ? 'smooth' : 'auto',
          });
      },
    });
  });
}

/* ---------- plan tabs + zoom ---------- */
const tabs = $$('[data-tab]');
const ind = $('.plan__tabs-ind');
function moveInd(btn) {
  if (!ind) return;
  ind.style.width = `${btn.offsetWidth}px`;
  ind.style.transform = `translateX(${btn.offsetLeft}px)`;
}
// Both floors share one grid cell (see .plan__panels), so switching never changes the
// section height and the page stays exactly where it is.
function selectTab(btn, focus) {
  tabs.forEach((t) => {
    const on = t === btn;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    const panel = $(`[data-panel="${t.dataset.tab}"]`);
    panel.hidden = false;
    panel.classList.toggle('is-active', on);
    panel.inert = !on;
    panel.setAttribute('aria-hidden', String(!on));
    if (on && motion) gsap.fromTo(panel, { y: 16 }, { y: 0, duration: 0.9, ease: EASE });
  });
  moveInd(btn);
  if (focus) btn.focus({ preventScroll: true });
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
  });
});
if (tabs.length) {
  selectTab(tabs[0]);
  requestAnimationFrame(() => moveInd(tabs[0]));
  addEventListener('resize', () => moveInd(tabs.find((t) => t.getAttribute('aria-selected') === 'true')));
}
$$('[data-zoom]').forEach((img) => {
  const fig = img.closest('.plan__drawing');
  img.addEventListener('click', (e) => {
    const r = img.getBoundingClientRect();
    img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    fig.classList.toggle('is-zoomed');
  });
});

/* ---------- master plan hotspots ---------- */
const mp = $('[data-mp]');
if (mp) {
  const spots = $$('.mp__spot', mp);
  const rows = $$('[data-mp-list] li', mp);
  const setPlot = (id) => {
    mp.classList.toggle('has-active', !!id);
    spots.forEach((s) => s.classList.toggle('is-active', s.dataset.plot === id));
    rows.forEach((r) => r.classList.toggle('is-active', r.dataset.plot === id));
  };
  [...spots, ...rows].forEach((el) => {
    if (finePointer) el.addEventListener('mouseenter', () => setPlot(el.dataset.plot));
    el.addEventListener('focus', () => setPlot(el.dataset.plot));
    el.addEventListener('click', () => setPlot(el.dataset.plot));
  });
  if (finePointer) mp.addEventListener('mouseleave', () => setPlot(null));
}

/* ---------- map: the drive from Gotri to ILIKA draws itself as you scroll ---------- */
const map = $('[data-map]');
if (map) {
  const screen = $('.map__screen', map);
  const route = $('[data-map-route]', map);
  const glow = $('[data-map-route-glow]', map);
  const car = $('[data-map-car]', map);
  const cam = $('[data-map-cam]', map);
  const now = $('[data-map-now]', map);
  const label = $('[data-map-label]', map);
  const bar = $('[data-map-bar]', map);
  const stops = $$('.map__stop', map);
  const labels = $$('.map__labels [data-stop]', map);
  const total = route.getTotalLength();

  // where along the route each stop sits (0–1)
  const nearestAt = (x, y) => {
    let best = 0;
    let bestD = Infinity;
    for (let l = 0; l <= total; l += 4) {
      const p = route.getPointAtLength(l);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) [bestD, best] = [d, l];
    }
    return best / total;
  };
  stops.forEach((s) => {
    const cs = getComputedStyle(s);
    s.at = s.dataset.at ? +s.dataset.at : nearestAt(+cs.getPropertyValue('--x'), +cs.getPropertyValue('--y'));
  });

  route.style.strokeDasharray = glow.style.strokeDasharray = `${total} ${total}`;

  // sample the route once (position + heading), so each frame is just a lookup
  const N = 600;
  const lut = Array.from({ length: N + 1 }, (_, i) => {
    const l = (total * i) / N;
    const p = route.getPointAtLength(l);
    const a = route.getPointAtLength(Math.min(total, l + 14));
    const b = route.getPointAtLength(Math.max(0, l - 14));
    return { x: p.x, y: p.y, h: (Math.atan2(a.y - b.y, a.x - b.x) * 180) / Math.PI };
  });
  const lerpAngle = (a, b, f) => a + (((b - a + 540) % 360) - 180) * f;

  let lastStop = null;
  let lastT = -1;
  const render = (t) => {
    if (Math.abs(t - lastT) < 0.0004) return;
    lastT = t;
    const dash = total * (1 - t);
    route.style.strokeDashoffset = glow.style.strokeDashoffset = dash;
    const f = t * N;
    const i = Math.min(N - 1, Math.floor(f));
    const k = f - i;
    const A = lut[i];
    const B = lut[i + 1];
    car.setAttribute(
      'transform',
      `translate(${(A.x + (B.x - A.x) * k).toFixed(1)} ${(A.y + (B.y - A.y) * k).toFixed(1)}) rotate(${lerpAngle(A.h, B.h, k).toFixed(1)}) scale(1.35)`,
    );
    bar.style.transform = `scaleX(${t})`;

    let current = stops[0];
    for (const s of stops) if (t >= s.at - 0.002) current = s;
    if (current === lastStop) return; // stops, labels and text only change at a stop
    lastStop = current;
    stops.forEach((s) => s.classList.toggle('is-reached', t >= s.at - 0.002));
    labels.forEach((l) => l.classList.toggle('is-lit', l.dataset.stop === current.dataset.stop));
    now.textContent = current.dataset.name;
    label.textContent = current.dataset.at === '1' ? 'You have arrived' : 'The drive';
  };

  let st = null;
  if (motion) {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: screen,
        start: 'top top',
        end: () => `+=${innerHeight * 1.6}`,
        pin: true,
        anticipatePin: 1,
        scrub: 0.8,
        invalidateOnRefresh: true,
      },
    });
    const state = { t: 0 };
    tl.to(state, { t: 1, ease: 'none', duration: 1, onUpdate: () => render(state.t) }, 0).fromTo(
      cam,
      { scale: 1 },
      { scale: () => (innerWidth < 900 ? 1.22 : 1.35), ease: 'power2.inOut', duration: 0.45 },
      0.6,
    );
    st = tl.scrollTrigger;
  } else {
    render(1);
  }

  // tap / click a stop to drive there
  stops.forEach((s) =>
    s.addEventListener('click', () => {
      if (!st) return;
      const y = st.start + (st.end - st.start) * Math.min(s.at, 1);
      lenis ? lenis.scrollTo(y, { duration: 1.4 }) : scrollTo({ top: y, behavior: 'smooth' });
    }),
  );
}

/* ---------- footer logo is written in when it scrolls into view ---------- */
const footLogo = $('[data-footer-logo] svg');
if (footLogo && motion) {
  const pens = prepareInk(footLogo);
  ScrollTrigger.create({ trigger: footLogo, start: 'top 82%', once: true, onEnter: () => writeInk(footLogo, pens) });
}

/* ---------- enquiry form → prefilled email ---------- */
const form = $('[data-enquire]');
if (form) {
  const status = $('[data-enquire-status]', form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    $$('[required]', form).forEach((f) => {
      const bad = !f.value.trim();
      f.closest('.field').classList.toggle('is-invalid', bad);
      if (bad && ok) {
        f.focus();
        ok = false;
      }
    });
    if (!ok) {
      status.textContent = 'Please add your name and phone number.';
      return;
    }
    const d = Object.fromEntries(new FormData(form));
    const text = `Name: ${d.name}\nPhone: ${d.phone}\nEmail: ${d.email || '—'}\n\n${d.message || 'I would like to book a private viewing of ILIKA.'}`;
    location.href = `mailto:hello@ilika.earth?subject=${encodeURIComponent('Private viewing — ILIKA')}&body=${encodeURIComponent(text)}`;
    status.textContent = 'Thank you — your email app will open with the details ready to send.';
  });
  form.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('is-invalid'));
}

/* ---------- cursor + magnetic buttons (mouse only) ---------- */
if (finePointer && motion) {
  const cursor = $('.cursor');
  const label = $('.cursor__label', cursor);
  cursor.classList.add('is-hidden');
  const xTo = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3' });
  const yTo = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3' });
  addEventListener('mousemove', (e) => {
    if (!e.target.closest?.('input, textarea, .map__screen')) cursor.classList.remove('is-hidden');
    xTo(e.clientX);
    yTo(e.clientY);
  });
  document.addEventListener('mouseover', (e) => {
    const labelled = e.target.closest('[data-cursor]');
    const link = e.target.closest('a, button, input, textarea, label');
    if (labelled) {
      const zoomed = labelled.classList.contains('is-zoomed');
      label.textContent = zoomed ? 'Close' : labelled.dataset.cursor;
    }
    cursor.classList.toggle('is-label', !!labelled && !link?.matches('.mp__spot, .btn'));
    cursor.classList.toggle('is-link', !!link && !labelled);
    cursor.classList.toggle('is-hidden', !!e.target.closest('input, textarea, .map__screen'));
  });
  document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
  document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));

  $$('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * 0.3);
      y((e.clientY - r.top - r.height / 2) * 0.4);
    });
    el.addEventListener('mouseleave', () => {
      x(0);
      y(0);
    });
  });
}

/* ---------- misc ---------- */
$$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
addEventListener('load', () => ScrollTrigger.refresh());
