// GPU snowfall around the camera. Particles live in a wrapping box centred on the camera,
// so the snow is endless and costs nothing on the CPU. intensity 0..1 controls density;
// fall speed, wind and flake size are uniforms (the blizzard ramps all of them).
import * as THREE from 'three';

export function createSnow({ count = 60000, box = 110, height = 60 } = {}) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), rnd = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = Math.random() * box; pos[i * 3 + 1] = Math.random() * height; pos[i * 3 + 2] = Math.random() * box;
    rnd[i * 2] = Math.random(); rnd[i * 2 + 1] = Math.random();
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 2));
  const uniforms = {
    uCam: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(box, height, box) },
    uFall: { value: 0 }, uWind: { value: new THREE.Vector2() }, uTime: { value: 0 },
    uIntensity: { value: 0.5 }, uSize: { value: 1 }, uColor: { value: new THREE.Color('#eaf3ff') },
    uPixel: { value: 1 }, uStreak: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.NormalBlending, fog: false,
    vertexShader: `
      attribute vec2 aRnd; uniform vec3 uCam, uBox; uniform float uFall, uTime, uIntensity, uSize, uPixel; uniform vec2 uWind;
      varying float vA;
      void main(){
        float spd = 0.6 + aRnd.x * 0.8;
        vec3 p = position;
        p.y -= uFall * spd;
        p.x += uWind.x * spd + sin(uTime * (0.6 + aRnd.y) + aRnd.x * 40.0) * 0.6;
        p.z += uWind.y * spd + cos(uTime * (0.5 + aRnd.x) + aRnd.y * 40.0) * 0.6;
        vec3 o = uCam - uBox * vec3(0.5, 0.35, 0.5);
        p = mod(p - o, uBox) + o;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        float on = step(aRnd.y, uIntensity);
        vA = on * smoothstep(0.3, 2.0, dist) * (1.0 - smoothstep(uBox.x * 0.32, uBox.x * 0.5, dist));
        gl_PointSize = on * uSize * uPixel * (0.06 + aRnd.x * 0.07) * 600.0 / max(dist, 0.5);
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.1, d) * vA;
        if (a < 0.01) discard; gl_FragColor = vec4(uColor, a * 0.9); }`,
  });
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false; points.renderOrder = 5;
  const state = { fall: 0, wx: 0, wz: 0 };
  return {
    points, uniforms,
    /** speed: fall m/s, wind: Vector2 m/s */
    update(dt, t, camPos, { speed = 2.5, wind = [0.6, 0.2] } = {}) {
      state.fall += dt * speed; state.wx += dt * wind[0]; state.wz += dt * wind[1];
      uniforms.uFall.value = state.fall; uniforms.uWind.value.set(state.wx, state.wz);
      uniforms.uTime.value = t; uniforms.uCam.value.copy(camPos);
    },
  };
}
