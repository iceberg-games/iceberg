#!/usr/bin/env node
// Regenerates community-seeds/<slug>.json (Studio project docs) from scripts/community-seeds/*.mjs.
// Pure node, no network, no DB. If community-seeds/<slug>.thumb.jpg exists (captured from the
// running game by scripts/community-seeds-smoke.mjs) it is embedded as doc.thumbnail (data URL, <300 KB).
//   node scripts/build-community-seeds.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'community-seeds');
fs.mkdirSync(out, { recursive: true });
const games = [await import('./community-seeds/suds.mjs'), await import('./community-seeds/mall.mjs').catch(() => null)].filter(Boolean);
const index = [];
for (const g of games) {
  const { meta } = g; const b = g.build();
  const tp = path.join(out, `${meta.slug}.thumb.jpg`);
  const thumbnail = fs.existsSync(tp) ? `data:image/jpeg;base64,${fs.readFileSync(tp).toString('base64')}` : undefined;
  const { doc, problems } = b.build({ thumbnail });
  if (problems.length) { console.error(`✗ ${meta.slug}:\n  ${problems.join('\n  ')}`); process.exitCode = 1; continue; }
  const json = JSON.stringify(doc);
  fs.writeFileSync(path.join(out, `${meta.slug}.json`), json);
  const bytes = Buffer.byteLength(json);
  console.log(`✓ ${meta.slug}.json  ${doc.instances.length} instances, ${(bytes / 1024).toFixed(0)} KB${thumbnail ? ' (thumbnail embedded)' : ' (no thumbnail yet)'}`);
  index.push({ slug: meta.slug, gameId: doc.id, name: doc.name, description: doc.description, tagline: meta.tagline, creator: 'gooberr478', file: `${meta.slug}.json`, thumbnail: `${meta.slug}.png`, instances: doc.instances.length, bytes });
}
fs.writeFileSync(path.join(out, 'metadata.json'), JSON.stringify({ creator: 'gooberr478', games: index }, null, 2) + '\n');
