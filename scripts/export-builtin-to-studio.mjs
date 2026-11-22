// Converts a built-in scene-module game (BIRG HQ, Frost Fields) into a Studio doc by loading the REAL game in a headless
// browser and turning every visible Box / Cylinder / Sphere / Plane / other mesh into Studio parts (position, size,
// rotation, color from the material or the texture's average). Output: <out>/<name>.iceberg.json (Import game file) and
// <out>/<name>.doc.json (raw doc, used by the SQL seed generator).
// Usage: node scripts/export-builtin-to-studio.mjs [baseUrl] [outDir]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE = process.argv[2] || 'http://127.0.0.1:5216/';
const OUT = process.argv[3] || new URL('../designs/editor-update/studio-copies/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const JOBS = [
  { game: 'birg-hq', key: 'g_birg_hq_studio', name: 'BIRG HQ (Studio)', file: 'birg-hq-studio', sky: 'sunset', ground: 'void', snow: false, description: 'The BIRG HQ log cabin, editable in Studio.' },
  { game: 'frost-fields', key: 'g_frost_fields_studio', name: 'Frost Fields (Studio)', file: 'frost-fields-studio', sky: 'day', ground: 'island', snow: true, description: 'The Frost Fields glacier island, editable in Studio.' },
];
const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', e => console.log('pageerror', e.message));
await p.goto(BASE); await p.click('#start-btn'); await p.waitForSelector('#pc-home');
for (const job of JOBS) {
  await p.evaluate((g) => window.iceberg.play(g), job.game);
  await p.waitForFunction((g) => window.iceberg?.engine?.def?.id === g && window.iceberg.engine.game, job.game, { timeout: 30000 }); await p.waitForTimeout(800);
  const res = await p.evaluate(() => {
    const e = window.iceberg.engine, g = e.game, scene = g.scene, av = e.avatar.root, T = scene.children[0].constructor; 
    const avatarKids = new Set(); av.traverse(o => avatarKids.add(o)); e.avatar.trail?.traverse?.(o => avatarKids.add(o));
    const hex = (c) => '#' + c.getHexString();
    const avgMap = (m) => { try { const im = m.map?.image; if (!im || !im.getContext) return null; const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 8, 8); const d = x.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, bb = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; bb += d[i + 2]; } const n = d.length / 4; return '#' + [r, gg, bb].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join(''); } catch { return null; } };
    const out = []; scene.updateMatrixWorld(true);
    const P = new scene.position.constructor(), Q = new (e.camera.quaternion.constructor)(), S = new scene.position.constructor();
    const E = new (e.camera.rotation.constructor)();
    scene.traverse(o => {
      if (!o.isMesh || avatarKids.has(o) || o.userData?.env) return;
      let v = o; while (v) { if (v.visible === false) return; v = v.parent; }
      const geo = o.geometry, mat = Array.isArray(o.material) ? o.material[0] : o.material; if (!geo || !mat) return;
      if (mat.type === 'ShaderMaterial' || mat.type === 'MeshBasicMaterial' && mat.side === 1) return;   // sky domes
      o.matrixWorld.decompose(P, Q, S); E.setFromQuaternion(Q, 'XYZ');
      const pr = geo.parameters || {}; let shape = 'box', size = null, pos = P.toArray(), rotExtra = null;
      const sx = Math.abs(S.x), sy = Math.abs(S.y), sz = Math.abs(S.z);
      if (geo.type === 'BoxGeometry') size = [pr.width * sx, pr.height * sy, pr.depth * sz];
      else if (geo.type === 'CylinderGeometry') { shape = 'cylinder'; const r = ((pr.radiusTop ?? 1) + (pr.radiusBottom ?? 1)) / 2; size = [2 * r * sx, pr.height * sy, 2 * r * sz]; if (Math.min(pr.radiusTop, pr.radiusBottom) < 0.02 * Math.max(pr.radiusTop, pr.radiusBottom)) { shape = 'cylinder'; size[0] *= 0.7; size[2] *= 0.7; } }
      else if (geo.type === 'SphereGeometry') { shape = 'sphere'; size = [2 * pr.radius * sx, 2 * pr.radius * sy, 2 * pr.radius * sz]; }
      else if (geo.type === 'PlaneGeometry') { size = [pr.width * sx, 0.05, pr.height * sy]; E.set(E.x - Math.PI / 2, E.y, E.z); }
      else if (geo.type === 'CircleGeometry') { shape = 'cylinder'; size = [2 * pr.radius * sx, 0.05, 2 * pr.radius * sy]; E.set(E.x - Math.PI / 2, E.y, E.z); }
      else { geo.computeBoundingBox(); const bb = geo.boundingBox; const c = bb.getCenter(new scene.position.constructor()).applyMatrix4(o.matrixWorld); pos = c.toArray(); size = [(bb.max.x - bb.min.x) * sx, (bb.max.y - bb.min.y) * sy, (bb.max.z - bb.min.z) * sz]; }
      if (!size || size.some(s => !isFinite(s))) return;
      if (Math.max(size[0], size[2]) > 110) return;   // ground discs, sea, sky
      size = size.map(s => Math.max(0.05, Math.round(s * 100) / 100));
      const color = avgMap(mat) || (mat.color ? hex(mat.color) : '#cccccc'); const op = mat.transparent ? mat.opacity : 1;
      const emis = mat.emissive && mat.emissiveIntensity > 0.3 && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.3;
      out.push({ shape, pos: pos.map(x => Math.round(x * 100) / 100), size, rot: [E.x, E.y, E.z].map(r => Math.round(r * 180 / Math.PI * 10) / 10), color, transparency: Math.round((1 - op) * 100) / 100, material: emis ? 'neon' : (op < 0.5 ? 'glass' : 'plastic'), name: o.name || geo.type.replace('Geometry', '') });
    });
    let thumb = null; try { thumb = e.snapshot(480, 270); } catch { /* no frame */ }
    const sp = g.spawn; return { thumb, parts: out, spawn: sp ? [sp.x, sp.y, sp.z] : [0, 0, 0] };
  });
  console.log(job.game, 'meshes ->', res.parts.length, 'spawn', res.spawn.map(x => +x.toFixed(2)));
  const id = () => 'i_' + Math.random().toString(36).slice(2, 10);
  const inst = res.parts.map(q => ({ id: id(), type: 'part', name: q.name, shape: q.shape, pos: q.pos, rot: q.rot, size: q.size, color: q.color, material: q.material, transparency: q.transparency, collide: q.transparency < 0.6, anchored: true }));
  inst.unshift({ id: id(), type: 'spawn', name: 'SpawnLocation', pos: [res.spawn[0], res.spawn[1] + 0.2, res.spawn[2]], rot: [0, 0, 0], size: [4, 0.4, 4], color: '#3f9de0', material: 'plastic', transparency: 0.6, collide: false, anchored: true });
  const doc = { id: job.key, version: 2, name: job.name, description: job.description, music: 'winter', snow: job.snow, mobile: false, ground: job.ground, sky: job.sky, starterGears: [], animations: [], instances: inst, template: 'blank', createdAt: Date.now(), updatedAt: Date.now(), sourceGame: job.game, thumbnail: res.thumb || undefined };
  writeFileSync(OUT + job.file + '.doc.json', JSON.stringify(doc));
  writeFileSync(OUT + job.file + '.iceberg.json', JSON.stringify({ format: 'iceberg-game', version: 1, game: doc, models: [] }));
  console.log('wrote', job.file, (JSON.stringify(doc).length / 1024).toFixed(0) + ' KB');
  await p.evaluate(() => window.iceberg.goHome()); await p.waitForSelector('#pc-home');
}
await b.close();
