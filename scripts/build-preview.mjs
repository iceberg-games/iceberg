#!/usr/bin/env node
// Builds the DEVELOPERS-ONLY preview of an app tree into <out> (deployed at /iceberg/preview/):
//   <out>/index.html, <out>/play/index.html   same pages as the site, entries src/preview/*-entry.js
//   + robots noindex, a 'DEV PREVIEW, test data only' banner, NO manifest / PWA install, NO service worker,
//   storage namespaced away from the real site, and a gate on the PROD is_dev() (see src/preview/gate.js).
// The app talks ONLY to the sandbox Supabase project ('iceberg-preview').
//
//   node scripts/build-preview.mjs [--root <app tree, default this repo>] [--out dist-preview]
// Env: VITE_PREVIEW_SUPABASE_URL / VITE_PREVIEW_SUPABASE_ANON_KEY  (sandbox project; baked in as the app backend)
//      VITE_PROD_SUPABASE_URL / VITE_PROD_SUPABASE_ANON_KEY        (prod, used only for the read-only is_dev() gate)
// --root lets CI build an older/newer branch (e.g. release/a) with THIS repo's preview tooling: src/preview/ is
// copied into that tree first (it only imports net/supabaseClient.js, net/auth.js, net/config.js, portal/portal.js, main.js).
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { mkdir, cp, rm, readFile, writeFile, copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = resolve(arg('--root', HERE));
const OUT = resolve(arg('--out', 'dist-preview'));
const e = process.env;
const SB = (e.VITE_PREVIEW_SUPABASE_URL || '').replace(/\/+$/, ''), SBK = e.VITE_PREVIEW_SUPABASE_ANON_KEY || '';
const PROD = (e.VITE_PROD_SUPABASE_URL || e.VITE_SUPABASE_URL || '').replace(/\/+$/, ''), PRODK = e.VITE_PROD_SUPABASE_ANON_KEY || e.VITE_SUPABASE_ANON_KEY || '';
const die = (m) => { console.error('build-preview: ' + m); process.exit(1); };
if (!SB || !SBK) die('set VITE_PREVIEW_SUPABASE_URL + VITE_PREVIEW_SUPABASE_ANON_KEY (sandbox project)');
if (!PROD || !PRODK) die('set VITE_PROD_SUPABASE_URL + VITE_PROD_SUPABASE_ANON_KEY (prod, for the is_dev gate)');
if (SB === PROD || SBK === PRODK) die('the preview must NOT use the production project');
for (const f of ['src/portal/portal.js', 'src/main.js', 'src/net/supabaseClient.js', 'src/net/auth.js', 'src/net/config.js', 'site/portal/index.html', 'site/play/index.html'])
  if (!existsSync(resolve(ROOT, f))) die(`app tree ${ROOT} has no ${f}`);

// the app tree gets this repo's preview tooling
if (ROOT !== HERE) await cp(resolve(HERE, 'src/preview'), resolve(ROOT, 'src/preview'), { recursive: true });

Object.assign(process.env, { VITE_SUPABASE_URL: SB, VITE_SUPABASE_ANON_KEY: SBK, VITE_PROD_SUPABASE_URL: PROD, VITE_PROD_SUPABASE_ANON_KEY: PRODK,
  VITE_ICEBERG_SITE: '1', VITE_ICEBERG_PREVIEW: '1', VITE_USERNAME_EMAIL_DOMAIN: e.VITE_USERNAME_EMAIL_DOMAIN || 'users.iceberg.invalid' });

const BIG_MEDIA = /\.(glb|gltf|bin|mp3|ogg|wav|m4a)$/i;
const pages = [
  { src: 'site/portal/index.html', html: 'site/.preview-pages/index.html', dest: 'index.html', entry: '/src/preview/portal-entry.js', main: '../' },
  { src: 'site/play/index.html', html: 'site/.preview-pages/play/index.html', dest: 'play/index.html', entry: '/src/preview/play-entry.js', main: '../../' },
];
export function previewHtml(html, { entry, main }) {
  let out = html
    .replace(/<script type="module" src="[^"]+"><\/script>/, `<script type="module" src="${entry}"></script>`)
    .replace(/\s*<link rel="manifest"[^>]*>/g, '')
    .replace(/\s*<link rel="apple-touch-icon"[^>]*>/g, '')
    .replace(/<title>([^<]*)<\/title>/, '<title>DEV PREVIEW · $1</title>')
    .replace(/(<meta charset="UTF-8" \/>)/i, `$1\n  <meta name="robots" content="noindex, nofollow, noarchive" />\n  <meta name="iceberg-main-site" content="${main}" />`)
    .replace(/href="\.\.\/icons\//g, 'href="../../icons/').replace(/href="\.\/icons\//g, 'href="../icons/');   // icons come from the main site
  if (!out.includes(entry) || !out.includes('noindex')) throw new Error('preview html rewrite failed');
  return out;
}

await rm(OUT, { recursive: true, force: true });
await mkdir(resolve(OUT, 'play'), { recursive: true });
const tmp = resolve(OUT, '.tmp');
try {
  for (const p of pages) {
    await mkdir(dirname(resolve(ROOT, p.html)), { recursive: true });
    await writeFile(resolve(ROOT, p.html), previewHtml(await readFile(resolve(ROOT, p.src), 'utf8'), p));
    const outDir = resolve(tmp, p.dest.replace(/\W+/g, '_'));
    await build({
      configFile: false, root: ROOT, base: './', publicDir: false, logLevel: 'warn', envDir: resolve(OUT, '.noenv'),
      plugins: [viteSingleFile({ useRecommendedBuildConfig: false })],
      build: { outDir, emptyOutDir: true, sourcemap: false, minify: 'esbuild',   // never ship source maps (source protection)
      target: 'es2022', chunkSizeWarningLimit: 100000000, cssCodeSplit: false, assetsDir: '',
        assetsInlineLimit: (file) => !BIG_MEDIA.test(file),
        rollupOptions: { input: resolve(ROOT, p.html), output: { inlineDynamicImports: true } } },
    });
    await copyFile(resolve(outDir, p.html), resolve(OUT, p.dest));
    for (const f of (await readdir(outDir)).filter(f => BIG_MEDIA.test(f))) await copyFile(resolve(outDir, f), resolve(OUT, dirname(p.dest), f));
  }
} finally {
  await rm(resolve(ROOT, 'site/.preview-pages'), { recursive: true, force: true });
  await rm(tmp, { recursive: true, force: true });
}
// static files the pages use (audio, featured images...), but never the PWA bits
await cp(resolve(ROOT, 'site/public'), OUT, { recursive: true, filter: (s) => !/(^|[/\\])(sw\.js|manifest\.webmanifest|icons)$/.test(s) });
for (const p of pages) {
  const html = await readFile(resolve(OUT, p.dest), 'utf8');
  if (!html.includes(SB)) die(`${p.dest}: sandbox URL not baked in`);
  if (!html.includes('noindex') || /rel="manifest"/.test(html) || !html.includes('dev-preview-banner')) die(`${p.dest}: preview safety checks failed`);
}
await writeFile(resolve(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`dev preview built -> ${OUT}  (app tree ${ROOT}; sandbox ${SB}; gate on ${PROD} is_dev())`);
