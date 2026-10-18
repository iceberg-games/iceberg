// Collision tests: exact GJK for rotated/stretched spheres and cylinders. Run: node scripts/collision-tests.mjs
import * as THREE from 'three';
import { makeAffineShape, aabbVsConvex } from '../src/engine/collision.js';
let fails = 0; const T = (n, c) => { if (!c) { fails++; console.log('FAIL', n); } };
// unit sphere radius 2 at origin
const m = new THREE.Matrix4().compose(new THREE.Vector3(0,0,0), new THREE.Quaternion(), new THREE.Vector3(4,4,4));
const s = makeAffineShape('sphere', m.elements);
T('sphere aabb', Math.abs(s.aabb.maxX - 2) < 1e-9);
T('box at corner outside', !aabbVsConvex(1.5,1.5,1.5,3,3,3,s));   // corner dist sqrt(3)*1.5=2.6 > 2
T('box touching side', aabbVsConvex(1.9,-0.5,-0.5,3,0.5,0.5,s));
T('box inside', aabbVsConvex(-0.1,-0.1,-0.1,0.1,0.1,0.1,s));
T('box enclosing', aabbVsConvex(-5,-5,-5,5,5,5,s));
T('box above', !aabbVsConvex(-0.4,2.01,-0.4,0.4,4.6,0.4,s));
T('box resting slightly in', aabbVsConvex(-0.4,1.98,-0.4,0.4,4.6,0.4,s));
// cylinder r=1 h=4 rotated 90° about z (lying along x)
const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,Math.PI/2));
const cm = new THREE.Matrix4().compose(new THREE.Vector3(0,0,0), q, new THREE.Vector3(2,4,2));
const c = makeAffineShape('cylinder', cm.elements);
T('cyl aabb x', Math.abs(c.aabb.maxX - 2) < 1e-6 && Math.abs(c.aabb.maxY - 1) < 1e-6);
T('player on top of lying cyl', !aabbVsConvex(-0.42,1.01,-0.42,0.42,3.6,0.42,c));
T('player sunk into lying cyl', aabbVsConvex(-0.42,0.95,-0.42,0.42,3.6,0.42,c));
T('box at curved corner outside', !aabbVsConvex(-0.4,0.8,0.8,0.4,2,2,c)); // (y,z)=(0.8,0.8) dist 1.13>1
T('box near end cap', aabbVsConvex(1.9,-0.2,-0.2,3,0.2,0.2,c));
T('box past end cap', !aabbVsConvex(2.05,-0.2,-0.2,3,0.2,0.2,c));
// random fuzz vs sampling
let mism = 0;
for (let k = 0; k < 3000; k++) {
  const sh = Math.random() < 0.5 ? 'sphere' : 'cylinder';
  const mm = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().random(), new THREE.Vector3(1+Math.random()*3,1+Math.random()*3,1+Math.random()*3));
  const S = makeAffineShape(sh, mm.elements);
  const cx = (Math.random()-0.5)*5, cy=(Math.random()-0.5)*5, cz=(Math.random()-0.5)*5, h=0.3+Math.random();
  const got = aabbVsConvex(cx-h,cy-h,cz-h,cx+h,cy+h,cz+h,S,0);
  // brute: sample points in box, map to local, test inside
  const inv = mm.clone().invert(); let inside = false; const v = new THREE.Vector3();
  for (let i=0;i<=8&&!inside;i++) for (let j=0;j<=8&&!inside;j++) for (let l=0;l<=8&&!inside;l++) { v.set(cx-h+2*h*i/8, cy-h+2*h*j/8, cz-h+2*h*l/8).applyMatrix4(inv); inside = sh==='sphere' ? v.length()<=0.5 : (Math.abs(v.y)<=0.5 && Math.hypot(v.x,v.z)<=0.5); }
  if (inside && !got) { const g2 = aabbVsConvex(cx-h-0.001,cy-h-0.001,cz-h-0.001,cx+h+0.001,cy+h+0.001,cz+h+0.001,S,0); if (!g2) mism++; else console.log("boundary-only miss"); } // sampling can only under-detect, so only this direction is a definite error
}
T('fuzz no missed overlaps ('+mism+')', mism === 0);
console.log(fails ? fails + ' failures' : 'all gjk tests pass');
