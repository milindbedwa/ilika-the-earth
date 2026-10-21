import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

const root = import.meta.dirname;
const svgDir = path.join(root, 'src', 'svg');

const attr = (s, name) => (s.match(new RegExp(`\\b${name}="([^"]*)"`)) || [])[1];
const strip = (s, ...names) => names.reduce((a, n) => a.replace(new RegExp(`\\s*\\b${n}(="[^"]*")?`, 'g'), ''), s);

// Expands two shorthand tags in index.html at dev and build time:
//   <img data-pic="name" alt="…" sizes="…">  → responsive <img> with srcset, size and blur preview
//   <i data-svg="icons/spiral" class="…"></i> → the inline SVG from src/svg (inherits currentColor)
function ilikaHtml() {
  return {
    name: 'ilika-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src', 'image-manifest.json'), 'utf8'));

        html = html.replace(/<img\b([^>]*?)\bdata-pic="([^"]+)"([^>]*)>/g, (m, a, name, b) => {
          const pic = manifest[name];
          if (!pic) throw new Error(`Unknown image "${name}" — add images/${name}.jpg`);
          const rest = strip(`${a} ${b}`.replace(/\/\s*$/, ''), 'data-eager').trim();
          const eager = /\bdata-eager\b/.test(m);
          const sizes = attr(rest, 'sizes') ? '' : ' sizes="100vw"';
          const mid = pic.variants.find((v) => v.w >= 1200) || pic.variants.at(-1);
          const srcset = pic.variants.map((v) => `${v.src} ${v.w}w`).join(', ');
          const bg = pic.lqip ? ` style="background-image:url(${pic.lqip})"` : '';
          return `<img ${rest}${sizes} src="${mid.src}" srcset="${srcset}" width="${pic.width}" height="${pic.height}" ${
            eager ? 'fetchpriority="high"' : 'loading="lazy"'
          } decoding="async"${bg}>`;
        });

        html = html.replace(/<i\b([^>]*?)\bdata-svg="([^"]+)"([^>]*)><\/i\s*>/g, (m, a, name, b) => {
          // "ph/<icon>" → Phosphor light icon from node_modules, otherwise a file in src/svg
          const file = name.startsWith('ph/')
            ? path.join(root, 'node_modules/@phosphor-icons/core/assets/light', `${name.slice(3)}-light.svg`)
            : path.join(svgDir, `${name}.svg`);
          const svg = fs.readFileSync(file, 'utf8').trim();
          const cls = attr(`${a} ${b}`, 'class');
          const label = attr(`${a} ${b}`, 'aria-label');
          const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true" focusable="false"';
          return svg.replace('<svg', `<svg ${cls ? `class="${cls}" ` : ''}${a11y}`);
        });

        return html;
      },
    },
  };
}

export default defineConfig({
  plugins: [ilikaHtml()],
  build: { target: 'es2020', assetsInlineLimit: 0 },
});
