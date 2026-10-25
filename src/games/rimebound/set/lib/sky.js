// Night/day sky dome: gradient, hash stars, animated aurora ribbons, moon disc. One shader, no textures.
import * as THREE from 'three';

export function createSky({ radius = 900 } = {}) {
  const uniforms = {
    uNight: { value: 1 }, uTime: { value: 0 },
    uDayTop: { value: new THREE.Color('#6fb0e8') }, uDayHorizon: { value: new THREE.Color('#e6f3ff') },
    uNightTop: { value: new THREE.Color('#050b1f') }, uNightHorizon: { value: new THREE.Color('#1d3557') },
    uMoonDir: { value: new THREE.Vector3(-0.35, 0.42, -0.84).normalize() },
    uSunDir: { value: new THREE.Vector3(0.4, 0.55, 0.3).normalize() },
    uAurora: { value: 1 }, uStorm: { value: 0 }, uStormColor: { value: new THREE.Color('#30435e') },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform float uNight, uTime, uAurora, uStorm; uniform vec3 uDayTop, uDayHorizon, uNightTop, uNightHorizon, uMoonDir, uSunDir, uStormColor;
      varying vec3 vDir;
      float h31(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5), b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5);
        float c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5), d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5);
        return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
      void main(){
        vec3 d = normalize(vDir); float y = max(d.y, 0.0);
        float g = pow(clamp(y * 1.4, 0.0, 1.0), 0.55);
        vec3 day = mix(uDayHorizon, uDayTop, g);
        vec3 night = mix(uNightHorizon, uNightTop, g);
        vec3 col = mix(day, night, uNight);
        // sun glow (day)
        float sd = max(dot(d, uSunDir), 0.0);
        col += (1.0 - uNight) * (vec3(1.0, 0.9, 0.7) * pow(sd, 400.0) * 6.0 + vec3(1.0, 0.85, 0.6) * pow(sd, 8.0) * 0.25);
        // stars
        vec3 sp = d * 380.0; vec3 cell = floor(sp); float r = h31(cell);
        float star = step(0.9965, r) * smoothstep(0.0, 0.25, y) * (0.6 + 0.4 * sin(uTime * (1.5 + r * 4.0) + r * 60.0));
        vec3 f = fract(sp) - 0.5; star *= smoothstep(0.5, 0.0, length(f) * 2.2);
        col += uNight * (1.0 - uStorm) * star * vec3(0.9, 0.95, 1.0) * 2.2;
        // aurora: layered curtains in the north-ish sky
        if (uAurora > 0.001) {
          float a = 0.0; vec3 ac = vec3(0.0);
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float h = 0.22 + fi * 0.07;
            vec2 q = vec2(atan(d.x, -d.z) * 3.0 + fi * 1.7, uTime * 0.04 + fi);
            float wave = h + 0.05 * sin(q.x * 2.0 + uTime * 0.25 + fi) + 0.04 * n2(q * vec2(2.0, 1.0));
            float band = smoothstep(wave - 0.02, wave, y) * exp(-(y - wave) * 9.0);
            float rays = 0.55 + 0.45 * n2(vec2(q.x * 14.0, uTime * 0.3 + fi * 3.0));
            float k = band * rays * smoothstep(-0.2, 0.6, -d.z + 0.3 * d.x);
            ac += k * mix(vec3(0.15, 1.0, 0.65), vec3(0.45, 0.35, 1.0), fi * 0.5 + 0.3 * sin(q.x));
          }
          col += ac * uAurora * uNight * (1.0 - uStorm) * 0.55;
        }
        // moon
        float md = dot(d, normalize(uMoonDir));
        float disc = smoothstep(0.99955, 0.99975, md);
        float halo = pow(max(md, 0.0), 180.0) * 0.5 + pow(max(md, 0.0), 12.0) * 0.07;
        col += uNight * (1.0 - uStorm * 0.85) * (disc * vec3(2.6, 2.6, 2.4) + halo * vec3(0.55, 0.7, 1.0));
        // storm overcast washes everything to fog color
        col = mix(col, uStormColor, uStorm * smoothstep(-0.2, 0.9, 1.0 - y * 0.6));
        // below horizon: fade to horizon colour (hidden by terrain mostly)
        if (d.y < 0.0) col = mix(uDayHorizon, uNightHorizon, uNight);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -1;
  return { mesh, uniforms };
}
