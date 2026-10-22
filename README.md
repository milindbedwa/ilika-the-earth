# ILIKA — The Earth

Website for ILIKA, premium lime-plastered farmhouses in Navakhal, Vadodara.

Static site built with **Vite**, **GSAP** (ScrollTrigger + SplitText) and **Lenis** smooth scroll. Mobile-first, deployed on **Vercel** — every push to `main` goes live.

```bash
npm install
npm run dev      # local dev server (builds images first)
npm run build    # production build → dist/
npm run preview  # serve the production build
```

## Replacing photos with high-res versions

All photos live in [`/images`](images). On every build, `scripts/build-images.mjs` turns each one into responsive WebP sizes (480–2400 px), adds a blurred preview and writes cache-safe hashed filenames.

**To swap a photo:** drop the new file into `/images` with the **same name** (any of `.jpg .png .webp .avif .tif` — delete the old one if the extension changes), commit and push. No code changes needed. Use at least **2400 px** wide for full-screen images.

| File                                                                                                       | Where it appears                                   |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `courtyard-entrance`                                                                                       | Intro — first image                                |
| `farmhouse-front`                                                                                          | Intro — second image (also the social share image) |
| `retreat-evening`                                                                                          | “Your private retreat. Every day.”                 |
| `verandah-evening`, `pool-court`                                                                           | “Where Life Returns to Its Roots”                  |
| `lime-plaster`                                                                                             | “Why lime plaster?”                                |
| `illus-vase`, `illus-seated`                                                                               | Line illustrations (transparent PNG)               |
| `spaces-sunset`                                                                                            | “Why curated spaces?”                              |
| `gallery-*`, `gazebo`                                                                                      | Curated spaces gallery                             |
| `pool-court-evening`                                                                                       | “Where Nature Meets Leisure.”                      |
| `pool-sunset`                                                                                              | Full-width sunset with dog                         |
| `wellness-yoga-deck`                                                                                       | “Why wellness?”                                    |
| `ritual-yoga`, `ritual-meditation`, `ritual-sunbath`, `ritual-mudbath`, `ritual-barefoot`, `ritual-copper` | The six wellness rituals                           |
| `clay-curves`                                                                                              | “Why sustainable design?”                          |
| `farmhouse-evening`, `vase-shadow-wall`                                                                    | Climate responsive design                          |
| `plan-first`                                                                                               | First-floor plan (cream lines on transparent PNG)  |
| `location-map`                                                                                             | Illustrated location map                           |

Vector artwork (logo, icons, ground-floor plan, master plan) is in `src/svg` and `public/svg`. The clay backgrounds are a flat colour with a CSS grain overlay (`.grain` in `src/styles.css`), not photos.

## Brochure (PDF)

`public/ilika-the-earth-brochure.pdf` is a 31-page A4 landscape brochure in the same design as the site, live at `/ilika-the-earth-brochure.pdf`. Its pages are in `brochure/brochure.html` + `brochure/brochure.css` and use the same photos from `/images`, so after replacing photos regenerate it with:

```bash
npm run brochure   # needs Playwright's Chromium: npx playwright install chromium
```

## Editing content

All copy is in [`index.html`](index.html). Shorthand used there:

- `<img data-pic="name" alt="…" sizes="…">` — a photo from `/images` (expanded at build time into a responsive `<img>`). Add `data-parallax` for scroll parallax, `data-eager` for above-the-fold images.
- `<i data-svg="ph/sun"></i>` — inlines a [Phosphor](https://phosphoricons.com) light icon (browse the site for names); `<i data-svg="logo"></i>` inlines a file from `src/svg`. Both take the text colour.
- `data-split` (line reveal), `data-fade`, `data-stagger` (children), `data-reveal` (image wipe), `data-words` (word-by-word scrub).

## Before launch

- Replace the placeholder phone number `+91 00000 00000` and confirm `hello@ilika.earth` (footer + enquiry form in `index.html`, and the form handler in `src/main.js`).
- The enquiry form opens the visitor’s email app with the details prefilled. To collect enquiries directly, point it at a form service (Formspree, Basin, a Vercel function, etc.).
