// Upload a locally worn custom model and return a published ref others can fetch.
import { sha256hex, FORMAT_RE, bytesOf, parseWearRef } from './modelAssets.js';

export async function publishWearRef({ wear, library, remote, supabaseUrl }) {
  if (!wear || !library?.has?.(wear.modelId)) return null;
  const rec = library.info(wear.modelId);
  const format = String(rec.format || '').toLowerCase();
  if (!FORMAT_RE.test(format)) return null;
  if (!remote?.uploadGameModel) return null;
  const hash = await sha256hex(rec.data);
  const published = await remote.uploadGameModel({ hash, format, data: rec.data });
  const url = published?.url;
  const parsed = parseWearRef({
    id: rec.id, name: rec.name, format, hash, bytes: bytesOf(rec.data), url,
    bone: wear.bone, scale: wear.scale, x: wear.x, y: wear.y, z: wear.z, rotY: wear.rotY,
    _supabaseUrl: supabaseUrl || remote.client?.url,
  }, { supabaseUrl: supabaseUrl || remote.client?.url });
  return parsed.ok ? parsed.ref : null;
}
