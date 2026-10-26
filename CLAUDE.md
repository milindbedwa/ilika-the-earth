# ILIKA The Earth: notes for Claude

Marketing site for ILIKA, lime-plastered farmhouses in Jilod, Anand, Gujarat. Static Vite site with GSAP + Lenis, deployed on Vercel (every push to `main` goes live; every branch gets a preview URL). See `README.md` for how the pieces fit.

## Rules

- **Website only.** Do not edit the brochure: `brochure/`, `scripts/build-brochure.mjs`, `public/ilika-the-earth-brochure.pdf`.
- **No em dashes (—) in visible copy.** Use a comma, colon or full stop. Ranges are written out ("25 to 30 min").
- All copy is in `index.html`; styles in `src/styles.css` (mobile-first, desktop at `min-width: 900px`); behaviour in `src/main.js`.
- Keep the design: cream / terracotta palette, serif display headings, minimal UI. Match the surrounding code's naming and comment style.
- Run `npx prettier --check index.html src/styles.css src/main.js` and `npm run build` before finishing; both must pass.

## Photos

- Sources live in `/images`; the build (`scripts/build-images.mjs`) makes responsive WebP sizes. Use them in HTML as `<img data-pic="name" alt="…" sizes="…">`.
- To replace a photo, keep the **same file name** and a lowercase extension (`.jpg`, `.png`, `.webp`). Two files with the same name but different extensions clash.
- Full-screen covers are cropped with `object-position` in `src/styles.css`; if a replacement photo frames its subject differently, re-aim the crop for phones.

## Contact details

- WhatsApp / phone: +91 86190 61319. All WhatsApp links prefill "Hello ILIKA, I'd love to know more about your project."
- Email: ilikatheearth26@gmail.com. Instagram: instagram.com/ilikatheearth26.
