// Generates test models: a plain box .glb and a rigged (2-bone) .glb with an embedded "Bend" animation.
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';
globalThis.FileReader = class { readAsArrayBuffer(b) { b.arrayBuffer().then(r => { this.result = r; this.onloadend?.(); }); } readAsDataURL(b) { b.arrayBuffer().then(r => { this.result = 'data:application/octet-stream;base64,' + Buffer.from(r).toString('base64'); this.onloadend?.(); }); } };
const exp = (obj, file, animations = []) => new Promise((res, rej) => new GLTFExporter().parse(obj, (buf) => { fs.writeFileSync(file, Buffer.from(buf)); res(); }, rej, { binary: true, animations }));

const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial({ color: '#ff8800' }));
await exp(box, 'scripts/fixtures/box.glb');

const geo = new THREE.CylinderGeometry(0.3, 0.3, 2, 8, 4); geo.translate(0, 1, 0);
const pos = geo.attributes.position, idx = [], wts = [];
for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const w = Math.min(1, Math.max(0, y - 0.5)); idx.push(0, 1, 0, 0); wts.push(1 - w, w, 0, 0); }
geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts, 4));
const b0 = new THREE.Bone(); b0.name = 'Base'; const b1 = new THREE.Bone(); b1.name = 'Tip'; b1.position.y = 1; b0.add(b1);
const mesh = new THREE.SkinnedMesh(geo, new THREE.MeshStandardMaterial({ color: '#33aaff' }));
const root = new THREE.Group(); root.name = 'Worm'; root.add(b0); root.add(mesh); mesh.bind(new THREE.Skeleton([b0, b1]));
const clip = new THREE.AnimationClip('Bend', 1, [new THREE.QuaternionKeyframeTrack('Tip.quaternion', [0, 0.5, 1], [0, 0, 0, 1, ...new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 1)).toArray(), 0, 0, 0, 1])]);
await exp(root, 'scripts/fixtures/worm-rig.glb', [clip]);
console.log('fixtures ok', fs.statSync('scripts/fixtures/box.glb').size, fs.statSync('scripts/fixtures/worm-rig.glb').size);
