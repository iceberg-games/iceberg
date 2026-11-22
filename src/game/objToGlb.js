// Convert a Wavefront OBJ (positions + faces) to a binary glTF (.glb) so it can
// be published and fetched by other players. Materials and smooth groups are
// dropped; triangulated geometry is kept. No Three.js / DOM needed.

function textOf(data) {
  return typeof data === 'string' ? data : new TextDecoder().decode(data);
}

/** Parse v / f lines into triangulated positions (9 floats per triangle). */
export function parseObjMesh(data) {
  const verts = [];
  const tris = [];
  for (const raw of textOf(data).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [tag, ...rest] = line.split(/\s+/);
    if (tag === 'v' && rest.length >= 3) {
      verts.push([Number(rest[0]), Number(rest[1]), Number(rest[2])]);
    } else if (tag === 'f' && rest.length >= 3) {
      const idx = rest.map((tok) => {
        const n = parseInt(tok.split('/')[0], 10);
        if (!Number.isFinite(n) || n === 0) return -1;
        return n > 0 ? n - 1 : verts.length + n;
      }).filter((i) => i >= 0);
      for (let i = 1; i + 1 < idx.length; i++) tris.push([idx[0], idx[i], idx[i + 1]]);
    }
  }
  if (!verts.length || !tris.length) throw new Error('This .obj file has no mesh to convert');
  const positions = new Float32Array(tris.length * 9);
  let p = 0;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const [a, b, c] of tris) {
    for (const i of [a, b, c]) {
      const v = verts[i]; if (!v) throw new Error('This .obj file has a face that points at a missing vertex');
      positions[p++] = v[0]; positions[p++] = v[1]; positions[p++] = v[2];
      for (let k = 0; k < 3; k++) { if (v[k] < min[k]) min[k] = v[k]; if (v[k] > max[k]) max[k] = v[k]; }
    }
  }
  return { positions, min, max, triangleCount: tris.length };
}

function pad4(n) { return (4 - (n % 4)) % 4; }

/** Returns an ArrayBuffer of a .glb file. Throws if the OBJ has no usable mesh. */
export function convertObjToGlb(data) {
  const { positions, min, max } = parseObjMesh(data);
  const bin = new Uint8Array(positions.buffer);
  const json = JSON.stringify({
    asset: { version: '2.0', generator: 'iceberg-obj-to-glb' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min, max }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: bin.byteLength, target: 34962 }],
    buffers: [{ byteLength: bin.byteLength }],
  });
  const jsonBytes = new TextEncoder().encode(json);
  const jsonPad = pad4(jsonBytes.length), binPad = pad4(bin.byteLength);
  const jsonChunk = jsonBytes.length + jsonPad, binChunk = bin.byteLength + binPad;
  const total = 12 + 8 + jsonChunk + 8 + binChunk;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const u8 = new Uint8Array(out);
  view.setUint32(0, 0x46546c67, true); // glTF
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonChunk, true);
  view.setUint32(16, 0x4e4f534a, true); // JSON
  u8.set(jsonBytes, 20);
  for (let i = 0; i < jsonPad; i++) u8[20 + jsonBytes.length + i] = 0x20;
  const binOff = 20 + jsonChunk;
  view.setUint32(binOff, binChunk, true);
  view.setUint32(binOff + 4, 0x004e4942, true); // BIN\0
  u8.set(bin, binOff + 8);
  return out;
}

// Kept as a Promise so callers can await either implementation.
export async function convertObjToGlbAsync(data) { return convertObjToGlb(data); }
