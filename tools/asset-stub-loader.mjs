// Node ESM loader for unit tests that import browser modules: media/model imports (Vite `?url` / plain asset
// imports) resolve to a module whose default export is the file path, like Vite's URL import.
//   import { register } from 'node:module'; register('../tools/asset-stub-loader.mjs', import.meta.url);
const ASSET = /\.(ogg|mp3|wav|m4a|glb|gltf|bin|png|jpe?g|webp|svg)(\?.*)?$/i;
export async function load(url, context, next) {
  if (ASSET.test(url)) return { format: 'module', shortCircuit: true, source: `export default ${JSON.stringify(url.replace(/\?.*$/, ''))};` };
  return next(url, context);
}
export async function resolve(spec, context, next) {
  if (ASSET.test(spec)) { const r = await next(spec.replace(/\?.*$/, ''), context); return { ...r, url: r.url + (spec.includes('?') ? spec.slice(spec.indexOf('?')) : ''), shortCircuit: true }; }
  return next(spec, context);
}
