// Render labeled stills of shared custom models (placeholder, loaded, fallback).
// Writes designs/editor-models/*.png. Run: node scripts/editor-models-screenshots.mjs
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'designs/editor-models');
const threeRoot = join(root, 'node_modules/three');
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html; charset=utf-8', '.json': 'application/json' };

const html = `<!doctype html>
<meta charset="utf-8">
<title>Editor models preview</title>
<style>
  html, body { margin: 0; background: #12151c; color: #e8eef5; font-family: ui-sans-serif, system-ui, sans-serif; }
  h1 { font-size: 22px; margin: 16px 24px 8px; font-weight: 650; }
  p.sub { margin: 0 24px 16px; color: #9aa6b4; max-width: 900px; line-height: 1.4; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 0 24px 24px; }
  figure { margin: 0; background: #1b2030; border-radius: 12px; overflow: hidden; border: 1px solid #2a3346; }
  canvas { display: block; width: 100%; height: auto; }
  figcaption { padding: 10px 14px 12px; font-size: 13px; line-height: 1.35; color: #c5ced8; }
  figcaption b { color: #fff; display: block; font-size: 14px; margin-bottom: 2px; }
</style>
<h1>Shared custom models</h1>
<p class="sub">What other players see when a Studio-placed or worn .glb is published: a light-blue placeholder while it loads, the real model once it arrives, and a pink fallback if the file is missing or fails checks.</p>
<div class="grid">
  <figure><canvas id="c-a" width="640" height="400"></canvas><figcaption><b>Player A (creator)</b> The imported model is already in this browser, so the placed object and the worn hat render immediately.</figcaption></figure>
  <figure><canvas id="c-load" width="640" height="400"></canvas><figcaption><b>Player B — loading</b> The published reference (hash + URL) is on the game and in the wear broadcast. A blue wireframe stands in until the file finishes downloading.</figcaption></figure>
  <figure><canvas id="c-ok" width="640" height="400"></canvas><figcaption><b>Player B — loaded</b> After a valid glTF passes the size, hash and URL checks, B sees the same placed model and the same custom hat as A.</figcaption></figure>
  <figure><canvas id="c-fail" width="640" height="400"></canvas><figcaption><b>Player B — fallback</b> If the fetch fails or the file is not a safe glTF, the existing pink placeholder stays so the game is still playable.</figcaption></figure>
</div>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from '/three/examples/jsm/loaders/GLTFLoader.js';

function fig(canvas, { model = null, wear = null, placed = 'missing' } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(2);
  renderer.setSize(640, 400, false);
  renderer.setClearColor(0x8fb8d8, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8fb8d8, 12, 28);
  const cam = new THREE.PerspectiveCamera(40, 640 / 400, 0.1, 50);
  cam.position.set(4.2, 2.6, 6.2); cam.lookAt(0, 1.1, 0);
  scene.add(new THREE.HemisphereLight(0xeef5ff, 0x6b7380, 1.1));
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.3); sun.position.set(4, 8, 3); scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(10, 48), new THREE.MeshStandardMaterial({ color: 0xe8eef4, roughness: 0.95 }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  const mkAvatar = (x, z, tint) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const skin = new THREE.MeshStandardMaterial({ color: 0xf2c8a0, roughness: 0.6 });
    const shirt = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.55 });
    const legs = new THREE.MeshStandardMaterial({ color: 0x3d4a63, roughness: 0.6 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.5), shirt); torso.position.y = 1.5; g.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), skin); head.position.y = 2.31; g.add(head);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), skin); armL.position.set(-0.75, 1.5, 0); g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.75; g.add(armR);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), legs); legL.position.set(-0.25, 0.5, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.25; g.add(legR);
    g.userData.head = head;
    scene.add(g);
    return g;
  };
  const you = mkAvatar(-1.15, 0.2, 0x3f8fd0);
  const them = mkAvatar(1.2, 0.4, 0xc45c7a);

  const ph = (color) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color, wireframe: true, transparent: true, opacity: 0.9 }));
    m.position.y = 0.5;
    return m;
  };
  const placedAt = new THREE.Group(); placedAt.position.set(0, 0, -1.4);
  if (placed === 'ok' && model) { const o = model.clone(true); o.scale.setScalar(1.4); placedAt.add(o); }
  else placedAt.add(ph(placed === 'loading' ? 0x8ecbff : 0xff66cc));
  scene.add(placedAt);

  const hat = new THREE.Group();
  if (wear === 'ok' && model) { const o = model.clone(true); o.scale.setScalar(0.45); o.position.y = 0.42; hat.add(o); }
  else if (wear === 'loading') { const p = ph(0x8ecbff); p.scale.setScalar(0.45); p.position.y = 0.35; hat.add(p); }
  else if (wear === 'fail') { const p = ph(0xff3355); p.scale.setScalar(0.45); p.position.y = 0.35; hat.add(p); }
  you.userData.head.add(hat);

  renderer.render(scene, cam);
}

async function loadModel() {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('/model.glb');
  const obj = gltf.scene;
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = 1.2 / Math.max(size.x, size.y, size.z, 1e-6);
  obj.scale.multiplyScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
  obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: 0.4, metalness: 0.1 }); } });
  const wrap = new THREE.Group(); wrap.add(obj);
  return wrap;
}

const model = await loadModel();
fig(document.getElementById('c-a'), { model, wear: 'ok', placed: 'ok' });
fig(document.getElementById('c-load'), { model, wear: 'loading', placed: 'loading' });
fig(document.getElementById('c-ok'), { model, wear: 'ok', placed: 'ok' });
fig(document.getElementById('c-fail'), { model, wear: 'fail', placed: 'missing' });
document.title = 'ready';
</script>
`;

const { makeMinimalGlb } = await import('../src/game/modelAssets.js');
const glb = Buffer.from(makeMinimalGlb());

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/' || u.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(html);
  }
  if (u.pathname === '/model.glb') {
    res.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': glb.length }); return res.end(glb);
  }
  if (u.pathname.startsWith('/three/')) {
    const f = join(threeRoot, u.pathname.slice('/three/'.length));
    if (!f.startsWith(threeRoot) || !existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream' });
    return createReadStream(f).pipe(res);
  }
  res.writeHead(404); res.end();
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 980 }, deviceScaleFactor: 2 });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.title === 'ready', { timeout: 20000 });
await mkdir(outDir, { recursive: true });
await page.screenshot({ path: join(outDir, 'overview.png'), fullPage: true });
const ids = { 'player-a.png': '#c-a', 'player-b-loading.png': '#c-load', 'player-b-loaded.png': '#c-ok', 'player-b-fallback.png': '#c-fail' };
for (const [name, sel] of Object.entries(ids)) {
  const el = await page.$(sel);
  await el.screenshot({ path: join(outDir, name) });
}
await writeFile(join(outDir, 'README.md'), `# Shared custom models

Stills from the \`feature/editor-models\` work. They show what two players see for a published Studio-placed model and a worn custom model.

- \`overview.png\` — all four states together
- \`player-a.png\` — the creator already has the file locally
- \`player-b-loading.png\` — blue wireframe placeholder while B fetches the published hash+URL
- \`player-b-loaded.png\` — same model after a valid glTF passes size, hash and URL checks
- \`player-b-fallback.png\` — pink placeholder if the fetch or validation fails

Generated by \`node scripts/editor-models-screenshots.mjs\`.
`);
await browser.close();
server.close();
console.log('wrote screenshots to designs/editor-models/');
