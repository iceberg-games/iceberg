#!/usr/bin/env node
// Builds the deployable multi-page site (static; works at / or any sub-path):
//   <out>/index.html          portal (sign in, games, Safe Chat room, friends, settings)
//   <out>/play/index.html     the game (opened in a new tab: play/?game=<id>)
//   <out>/manifest.webmanifest, sw.js, icons/   PWA
// Each page is a single self-contained HTML file (vite-plugin-singlefile), base './', EXCEPT big media
// (3D models, audio: BIG_MEDIA) which are emitted as files next to the page (<page dir>/<name>-<hash>.<ext>) and only
// downloaded when a game actually uses them. The service worker never precaches them (shell = HTML only).
//
//   node scripts/build-site.mjs [--out dist-site] [--demo]
// Env (baked in): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_USERNAME_EMAIL_DOMAIN.
// VITE_ICEBERG_SITE=1 is forced (no free demo bucks) unless --demo is passed (test builds only).
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { mkdir, cp, rm, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = resolve(ROOT, arg('--out', 'dist-site'));
const DEMO = process.argv.includes('--demo');
process.env.VITE_ICEBERG_SITE = DEMO ? '0' : '1';
process.env.VITE_ICEBERG_PAGES = '1';   // multi-page site: UI sounds are fetched from audio/ui/, not inlined

const BIG_MEDIA = /\.(glb|gltf|bin|mp3|ogg|wav|m4a)$/i;

const pages = [
  { html: 'site/portal/index.html', dest: 'index.html' },
  { html: 'site/play/index.html', dest: 'play/index.html' },
];

await rm(OUT, { recursive: true, force: true });
await mkdir(resolve(OUT, 'play'), { recursive: true });
const tmp = resolve(OUT, '.tmp');
for (const p of pages) {
  const outDir = resolve(tmp, p.dest.replace(/\W+/g, '_'));
  await build({
    configFile: false, root: ROOT, base: './', publicDir: false, logLevel: 'warn',
    plugins: [viteSingleFile({ useRecommendedBuildConfig: false })],
    build: { outDir, emptyOutDir: true, chunkSizeWarningLimit: 100000000, cssCodeSplit: false, assetsDir: '',
      assetsInlineLimit: (file) => !BIG_MEDIA.test(file),                    // everything else inlined (single file)
      rollupOptions: { input: resolve(ROOT, p.html), output: { inlineDynamicImports: true } } },
  });
  await copyFile(resolve(outDir, p.html), resolve(OUT, p.dest));
  // Vite resolves inlined-script asset URLs against the page itself (import.meta.url), so media sits beside it.
  for (const f of (await readdir(outDir)).filter(f => BIG_MEDIA.test(f))) await copyFile(resolve(outDir, f), resolve(OUT, dirname(p.dest), f));
}
await rm(tmp, { recursive: true, force: true });
await cp(resolve(ROOT, 'site/public'), OUT, { recursive: true });
await cp(resolve(ROOT, 'src/assets/events'), resolve(OUT, 'events'), { recursive: true });   // event posters (portal popup, lazy)
await cp(resolve(ROOT, 'src/assets/thumbnails'), resolve(OUT, 'thumbnails'), { recursive: true });   // game card art (ui/thumbs.js GAME_THUMBS)

// cache-busting id for the service worker = hash of the built pages
const h = createHash('sha256');
for (const p of pages) h.update(await readFile(resolve(OUT, p.dest)));
const id = h.digest('hex').slice(0, 12);
const swPath = resolve(OUT, 'sw.js');
await writeFile(swPath, (await readFile(swPath, 'utf8')).replace('__BUILD_ID__', id));
await writeFile(resolve(OUT, '.nojekyll'), '');                       // GitHub Pages: serve as-is
console.log(`site built -> ${OUT}  (build ${id}${DEMO ? ', DEMO bucks enabled' : ''}; accounts ${process.env.VITE_SUPABASE_URL ? 'ON: ' + process.env.VITE_SUPABASE_URL : 'OFF (guest only)'})`);
