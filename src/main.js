import './styles.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);

const root = document.documentElement;
const body = document.body;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const mm = gsap.matchMedia();
const EASE = 'expo.out';

/* ---------- smooth scroll ---------- */
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
  history.replaceState(null, '', a.getAttribute('href'));
});

/* ---------- header: hide on scroll down, adapt over dark sections ---------- */
const header = $('[data-header]');
let lastY = scrollY;
const darkSections = $$('[data-theme="dark"]');
function updateHeader() {
  const y = lenis ? lenis.scroll : scrollY;
  const goingDown = y > lastY + 2;
  const goingUp = y < lastY - 2;
  if (goingDown && y > 140 && !body.classList.contains('menu-open')) header.classList.add('is-hidden');
  else if (goingUp || y < 140) header.classList.remove('is-hidden');
  lastY = y;
  root.classList.toggle('header-visible', !header.classList.contains('is-hidden'));
  header.classList.toggle('is-top', y < innerHeight * 0.6);

  const probe = header.offsetHeight / 2;
  header.classList.toggle(
    'is-dark',
    darkSections.some((s) => {
      const r = s.getBoundingClientRect();
      return r.top <= probe && r.bottom >= probe;
    }),
  );
}
lenis ? lenis.on('scroll', updateHeader) : addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

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

/* ---------- hero intro ---------- */
function intro() {
  const logo = $('.hero__logo svg');
  const tl = gsap.timeline({
    defaults: { ease: EASE },
    onComplete: () => lenis?.start(),
  });
  if (!motion) {
    body.classList.add('is-ready');
    return;
  }
  tl.to(logo, { maskPosition: '0% 0', webkitMaskPosition: '0% 0', duration: 2.1, ease: 'power2.inOut' }, 0.25)
    .fromTo(logo, { y: 18 }, { y: 0, duration: 2.2 }, 0.25)
    .to('[data-hero-line]', { opacity: 1, y: 0, duration: 1.2, stagger: 0.12 }, 1.6)
    .add(() => body.classList.add('is-ready'), 1.5);
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
    const distance = () => track.scrollWidth - innerWidth;
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: gallery,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.6,
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
function selectTab(btn, focus) {
  tabs.forEach((t) => {
    const on = t === btn;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    const panel = $(`[data-panel="${t.dataset.tab}"]`);
    panel.hidden = !on;
    if (on && motion) gsap.fromTo(panel, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9, ease: EASE });
  });
  moveInd(btn);
  if (focus) btn.focus();
  ScrollTrigger.refresh();
}
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    selectTab(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
  });
});
if (tabs.length) {
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

/* ---------- map ---------- */
const map = $('[data-map]');
if (map) {
  const scroller = $('[data-map-scroller]', map);
  const img = $('[data-map-img]', map);
  // ILIKA's pin sits ~49% across the illustrated map — start the swipeable map there
  const centre = () => {
    if (scroller.scrollWidth > scroller.clientWidth) scroller.scrollLeft = img.offsetWidth * 0.49 - scroller.clientWidth / 2;
  };
  img.complete ? centre() : img.addEventListener('load', centre, { once: true });
  addEventListener('resize', centre);

  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.fromTo(
      img,
      { scale: 1.18, transformOrigin: '49% 88%' },
      { scale: 1, ease: 'none', scrollTrigger: { trigger: map, start: 'top bottom', end: 'center center', scrub: true } },
    );
  });
}

/* ---------- footer logo writes itself in ---------- */
const footLogo = $('[data-footer-logo] svg');
if (footLogo && motion) {
  gsap.set(footLogo, {
    maskImage: 'linear-gradient(100deg, #000 45%, transparent 55%)',
    webkitMaskImage: 'linear-gradient(100deg, #000 45%, transparent 55%)',
    maskSize: '260% 100%',
    webkitMaskSize: '260% 100%',
    maskPosition: '100% 0',
    webkitMaskPosition: '100% 0',
  });
  gsap.to(footLogo, {
    maskPosition: '0% 0',
    webkitMaskPosition: '0% 0',
    duration: 2.2,
    ease: 'power2.inOut',
    scrollTrigger: { trigger: footLogo, start: 'top 85%', once: true },
  });
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
    if (!e.target.closest?.('input, textarea')) cursor.classList.remove('is-hidden');
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
    cursor.classList.toggle('is-hidden', !!e.target.closest('input, textarea'));
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
