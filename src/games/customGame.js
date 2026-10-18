// Game definitions for the Studio ("Create a Game") and user-made games.
// The editor lives in src/studio/editor.js, the player runtime in src/studio/runtime.js,
// the UI in src/ui/creator.js. Docs are plain JSON (see src/studio/instances.js).
import '../studio/studio.css';
import { createEditor } from '../studio/editor.js';
import { createRuntime } from '../studio/runtime.js';
import { TEMPLATES, newGameDoc, upgradeDoc } from '../studio/templates.js';
import { SKIES, GROUNDS } from '../studio/world.js';
import { drafts } from '../studio/store.js';

export { TEMPLATES, newGameDoc, upgradeDoc, SKIES, GROUNDS };

export const creatorDef = {
  id: 'creator',
  name: 'Create a Game',
  tagline: 'Iceberg Studio — build & publish your own game',
  description: 'Desktop studio: parts, gizmos, explorer & properties, plain-words scripts, gears, animator. Publish to the Games menu.',
  thumbnail: 'creator',
  isCreator: true,
  create: (ctx, { doc }) => { const dr = drafts.get(doc.id); const use = dr && (dr.updatedAt || 0) > (doc.updatedAt || 0) ? dr : doc; return createEditor(ctx, upgradeDoc(use)); },
};

export function customGameDef(doc) {
  const d = upgradeDoc(doc);
  const n = (d.instances || []).length;
  return {
    id: d.id, name: d.name, tagline: 'Made in Iceberg Studio', description: d.description || `${n} parts${d.mobile ? ' · 📱 mobile-ready' : ''}`,
    thumbnail: d.thumbnail || 'custom', custom: true, doc: d,
    create: (ctx) => createRuntime(ctx, d),
  };
}
