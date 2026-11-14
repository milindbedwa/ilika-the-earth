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

| File                                                                                                       | Where it appears                                                                                                   |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `courtyard-entrance`                                                                                       | Intro — first image                                                                                                |
| `farmhouse-front`                                                                                          | Intro — second image (also the social share image)                                                                 |
| `retreat-evening`                                                                                          | “Your private retreat. Every day.”                                                                                 |
| `verandah-evening`, `pool-court`                                                                           | “Where Life Returns to Its Roots”                                                                                  |
| `lime-plaster`                                                                                             | “Why lime plaster?”                                                                                                |
| `illus-vase`, `illus-seated`                                                                               | Line illustrations (transparent PNG)                                                                               |
| `spaces-sunset`                                                                                            | “Why curated spaces?”                                                                                              |
| `gallery-*`, `gazebo`                                                                                      | Curated spaces gallery                                                                                             |
| `pool-court-evening`                                                                                       | “Where Nature Meets Leisure.”                                                                                      |
| `pool-sunset`                                                                                              | Full-width sunset with dog                                                                                         |
| `wellness-yoga-deck`                                                                                       | “Why wellness?”                                                                                                    |
| `ritual-yoga`, `ritual-meditation`, `ritual-sunbath`, `ritual-mudbath`, `ritual-barefoot`, `ritual-copper` | The six wellness rituals                                                                                           |
| `clay-curves`                                                                                              | “Why sustainable design?”                                                                                          |
| `farmhouse-evening`, `vase-shadow-wall`                                                                    | Climate responsive design                                                                                          |
| `plan-first`                                                                                               | First-floor plan (cream lines on transparent PNG)                                                                  |
| `location-map`                                                                                             | Location map art (transparent PNG, no text — place labels and logo are live text in `src/svg/location-labels.svg`) |
| `masterplan`                                                                                               | Master plan illustration (transparent PNG); the 01–04 plot markers on top are positioned in `index.html`           |

Vector artwork (logo, icons, ground-floor plan) is in `src/svg` and `public/svg`. The clay backgrounds are a flat colour with a CSS grain overlay (`.grain` in `src/styles.css`), not photos.

## Brochure (PDF)

`public/ilika-the-earth-brochure.pdf` is a 31-page A4 landscape brochure in the same design as the site, live at `/ilika-the-earth-brochure.pdf`. Its pages are in `brochure/brochure.html` + `brochure/brochure.css` and use the same photos from `/images`, so after replacing photos regenerate it with:

```bash
npm run brochure   # needs Playwright's Chromium: npx playwright install chromium
```

## 3D tour

`tour.html` is a second page: a walkable 3D model of one farmhouse, opened from the "Take a tour" buttons in the header, the menu and the footer. It is built with three.js (only loaded on that page) and its leaves, water and sound are generated in the browser.

| File                    | What it holds                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `src/tour/plan.js`      | The measured plan: rooms, walls, openings, roof outline, site, guided tour stops. Start here. |
| `src/tour/build.js`     | Walls, floors, pool court, terraces, jaali crown, stair, boundary, pavilion structure         |
| `src/tour/furnish.js`   | Furniture and fittings                                                                        |
| `src/tour/garden.js`    | Planting                                                                                      |
| `src/tour/materials.js` | Painted textures, sky and water                                                               |
| `src/tour/nav.js`       | Collision and route finding                                                                   |
| `src/tour/main.js`      | Lighting, movement, guided tour, interface                                                    |

**Scanned materials, sky and models.** Plaster, stone, timber, cloth, cane, brick, lawn and bark are photo-scanned materials; the sky is a photographed panorama that also lights the scene; some furniture, vases, lanterns and plants are scanned 3D models. They come from [Poly Haven](https://polyhaven.com) and [ambientCG](https://ambientcg.com), both CC0 (free to use, no credit required), and are committed under `public/tour` (`tex`, `sky`, `models`), so the site builds without network access. To change one, edit the lists at the top of `scripts/build-tour-assets.mjs` (materials, skies) or `scripts/tour-models.mjs` (models), then run:

```bash
npm run tour-assets            # or: npm run tour-assets -- tex | sky | models
```

The bed and the sofa were generated for this villa with Higgsfield (text to 3D); their source files are kept in `scripts/tour-sources` and packed by the same command. The sofa is a bare shape that the tour dresses in the scanned linen.

That needs network access to `api.polyhaven.com`, `dl.polyhaven.org`, `ambientcg.com` and `acg-download.struffelproductions.com`; downloads are cached in `.cache/`. Phones load 512 px textures, desktops 1024 px. `src/tour/sky.js` loads the sky and `src/tour/models.js` the models.

Plan coordinates in `plan.js` are the drawing units of `public/svg/plan-ground.svg` (3.5 units to the foot), so a wall can be moved by reading its position straight off the SVG.

**What is documented and what is not**

- From the plans and schedules: room positions and sizes, doors and glazing, the pool and sunken sitting area, both terraces, the outside stair, the furniture layout. From the master plan: plot, gate, trees, garden pavilion.
- From the renders: terracotta plaster, the jaali crown, brick jaali screens at the entrance, planted pergolas, urns, late afternoon light.
- Design proposal (not on any drawing): interior finishes and furniture, lighting, bathroom fittings, ceiling heights (10 ft ground floor), the 2 ft plinth, planting species.
- Still open, and listed for visitors under the "i" button in the tour: the mud bath size (labelled 5′0″ × 32″, drawn about 10′0″ × 6′3″), the outdoor sitting size (20′ × 30″ running ft), the stair's risers and landing, the width of the upper volume (wider in the pool render than on the first floor plan), and the terrace sizes (labelled 21′6″ × 36′6″ but L-shaped on plan).

Add `?lock` to the URL to hold the resolution steady (useful for screenshots); otherwise it adapts to the device's frame rate.

## Editing content

All copy is in [`index.html`](index.html). Shorthand used there:

- `<img data-pic="name" alt="…" sizes="…">` — a photo from `/images` (expanded at build time into a responsive `<img>`). Add `data-parallax` for scroll parallax, `data-eager` for above-the-fold images.
- `<i data-svg="ph/sun"></i>` — inlines a [Phosphor](https://phosphoricons.com) light icon (browse the site for names); `<i data-svg="logo"></i>` inlines a file from `src/svg`. Both take the text colour.
- `data-split` (line reveal), `data-fade`, `data-stagger` (children), `data-reveal` (image wipe), `data-words` (word-by-word scrub).

## Before launch

- Add the Instagram and WhatsApp links: in `index.html`, search for `data-social` (two places: the mobile menu and the footer) and replace `href="#"` with the profile / `https://wa.me/<number>` link, adding `target="_blank" rel="noopener"`.
- Replace the placeholder phone number `+91 00000 00000` and confirm `hello@ilika.earth` (footer + enquiry form in `index.html`, and the form handler in `src/main.js`).
- The enquiry form opens the visitor’s email app with the details prefilled. To collect enquiries directly, point it at a form service (Formspree, Basin, a Vercel function, etc.).
