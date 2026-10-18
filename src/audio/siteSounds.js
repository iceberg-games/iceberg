// Options for initUiSounds() (src/audio/uiSounds.js) shared by the portal and the play page:
//  - context: the ONE shared AudioContext (core/audio.js = the THREE.AudioListener's), also published as
//    window.__icebergSfx so Studio playSfx uses the same one.
//  - inline: base64 sounds ONLY in the single-file (file://) build. The Pages build (scripts/build-site.mjs sets
//    VITE_ICEBERG_PAGES=1) fetches site/public/audio/ui/* instead, and the 122 KB inline module is tree-shaken out.
import { getAudioContext } from '../core/audio.js';
import { UI_SOUNDS_INLINE } from './uiSoundsInline.js';

export function uiSoundOptions() {
  let context;
  try { context = window.__icebergSfx || getAudioContext(); window.__icebergSfx ||= context; } catch { /* no Web Audio */ }
  return { context, inline: import.meta.env.VITE_ICEBERG_PAGES === '1' ? undefined : UI_SOUNDS_INLINE };
}
