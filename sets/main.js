// Iceberg filming-set runtime: renderer + bloom/grade post, scripted shots, free cam,
// weather (snow → blizzard ramp), day/night, walkable avatar, clean (hide-UI) mode.
// Open: /sets/?set=winterhaven   (see sets/README.md for every key and URL parameter)
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SETS } from './registry.js';
import { Shot, FreeCam } from './lib/camera.js';
import { createSnow } from './lib/snow.js';

const Q = new URLSearchParams(location.search);
const num = (k, d) => (Q.has(k) && Q.get(k) !== '' && !isNaN(+Q.get(k)) ? +Q.get(k) : d);
const SET_ID = Q.get('set') || 'winterhaven';
const FIXED_W = num('w', 0), FIXED_H = num('h', 0);
const SNOW_LEVELS = [0, 0.3, 0.55, 0.8, 1.0];          // off, light, medium, heavy, blizzard
const SNOW_NAMES = ['off', 'light', 'medium', 'heavy', 'blizzard'];

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.32 }, uTime: { value: 0 }, uGrain: { value: 0.018 }, uLift: { value: new THREE.Vector3(0.0, 0.004, 0.012) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette, uTime, uGrain; uniform vec3 uLift; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5; float v = 1.0 - uVignette * smoothstep(0.25, 0.85, length(d * vec2(1.0, 0.8)) * 1.25);
      c.rgb = c.rgb * v + uLift; c.rgb += (h(vUv * 1000.0 + uTime) - 0.5) * uGrain * (0.3 + c.rgb); gl_FragColor = c; }`,
};

async function boot() {
  const stage = document.getElementById('stage');
  const loader = SETS[SET_ID];
  if (!loader) throw new Error(`Unknown set "${SET_ID}". Known: ${Object.keys(SETS).join(', ')}`);
  const def = (await loader()).default;
  document.title = `${def.name} · Iceberg Sets`;

  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(FIXED_W ? 1 : Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  stage.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 2500);

  const set = await def.create({ THREE, renderer, camera });
  const scene = set.scene;
  const snow = createSnow(set.snow || {});
  scene.add(snow.points);
  const gust = createSnow({ count: 50000, box: 34, height: 22 });     // dense near-field layer, only in heavy snow / blizzard
  scene.add(gust.points);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.55, 0.92);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader); composer.addPass(grade);
  composer.addPass(new OutputPass());

  function resize() {
    const w = FIXED_W || innerWidth, h = FIXED_H || innerHeight;
    renderer.setSize(w, h); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (FIXED_W) { const s = Math.min(innerWidth / w, innerHeight / h, 1); renderer.domElement.style.width = w * s + 'px'; renderer.domElement.style.height = h * s + 'px'; }
    snow.uniforms.uPixel.value = gust.uniforms.uPixel.value = h / 1080 * renderer.getPixelRatio();
    updateBars();
  }

  // ---------- state ----------
  const shots = set.shots.map((d) => new Shot(d));
  const S = {
    mode: 'shot', shot: Math.max(0, Math.min(shots.length - 1, num('shot', 1) - 1)), t: num('t', 0), playing: Q.has('shot') && !Q.has('t') && !Q.has('fixed'),
    loop: Q.get('loop') === '1', reel: Q.get('reel') === '1',
    night: num('night', 1), nightTarget: num('night', 1),
    weather: SNOW_LEVELS[num('snow', 2)] ?? 0.55, weatherFrom: 0, weatherTo: 0, rampT: -1, rampDur: num('ramp', 12),
    time: num('time', 0), paused: false, fixed: Q.get('fixed') === '1', clean: Q.get('clean') === '1',
    bars: num('bars', 0),
  };
  if (Q.has('free')) S.mode = 'free';

  // ---------- UI ----------
  const help = document.createElement('div'); help.id = 'help'; help.className = 'ui';
  const k = (x) => `<kbd>${x}</kbd>`;
  help.innerHTML = `<h1>❄ ${def.name} <span style="color:#8fb6d8;font-weight:400">· filming set</span></h1>
    <h2>Shots</h2>${shots.map((s, i) => `<div>${k(i + 1)} ${s.def.name} <span style="color:#8fb6d8">${s.duration}s</span></div>`).join('')}
    <div>${k('0')} play all shots (reel) &nbsp; ${k('Enter')} replay</div><div>${k('P')} pause/resume time &nbsp; ${k('L')} loop shot</div>
    <h2>Cameras</h2><div>${k('F')} free cam: ${k('W')}${k('A')}${k('S')}${k('D')} move, ${k('Q')}/${k('E')} down/up, drag = look,<br>wheel = speed, ${k('Shift')} fast, ${k('Alt')} slow, ${k('[')}/${k(']')} FOV</div>
    <div>${k('G')} walk the avatar (drag = orbit, wheel = zoom, ${k('Space')} jump)</div><div>${k('C')} copy camera pose (for new shots)</div>
    <h2>Look</h2><div>${k('B')} snow level &nbsp; ${k('Shift')}+${k('B')} blizzard ramp</div><div>${k('N')} day / night (smooth)</div>
    <div>${k('K')} letterbox 2.39:1 &nbsp; ${k('H')} hide all UI (clean mode)</div>
    <h2>URL</h2><div style="color:#b9d4ee">?set=${SET_ID}&amp;shot=1..${shots.length}&amp;clean=1&amp;snow=0..4&amp;night=0..1&amp;ramp=12&amp;loop=1&amp;reel=1&amp;free=1&amp;w=1920&amp;h=1080&amp;bars=2.39&amp;fixed=1&amp;t=secs</div>`;
  const status = document.createElement('div'); status.id = 'status'; status.className = 'ui';
  const toastEl = document.createElement('div'); toastEl.id = 'toast'; toastEl.className = 'ui';
  document.body.append(help, status, toastEl);
  let toastTimer = 0;
  const toast = (msg) => { toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1600); };
  const setClean = (on) => { S.clean = on; document.body.classList.toggle('clean', on); };
  setClean(S.clean);
  function updateBars() {
    const el = renderer.domElement, h = el.clientHeight, w = el.clientWidth;
    const bar = S.bars ? Math.max(0, (h - w / S.bars) / 2) : 0;
    const top = (innerHeight - h) / 2;
    document.getElementById('barT').style.height = (bar ? bar + top : 0) + 'px';
    document.getElementById('barB').style.height = (bar ? bar + top : 0) + 'px';
  }

  // ---------- cameras ----------
  const free = new FreeCam(camera, renderer.domElement);
  free.onSpeed = (s) => toast(`Free cam speed ${s.toFixed(1)}`);
  let walk = null;   // lazily created avatar + controller
  async function enterWalk() {
    if (!walk) {
      const [{ Avatar }, { PlayerController }, { Input }, { Collision }] = await Promise.all([
        import('../src/game/avatar.js'), import('../src/engine/player.js'), import('../src/engine/input.js'), import('../src/engine/collision.js')]);
      const avatar = new Avatar();
      if (set.avatarColors) avatar.setColors(set.avatarColors);   // Iceberg palette (not the classic default)
      const input = new Input(renderer.domElement);
      const player = new PlayerController(camera, avatar, input);
      const col = new Collision({ floorY: 0, bounds: set.walkBounds || null });
      const sp0 = set.spawn || { pos: [0, 0, 0] };
      set.addColliders?.(col);
      if (set.groundHeight) Object.defineProperty(col, 'floorY', { get: () => set.groundHeight(player.pos.x, player.pos.z) });   // walk over the terrain
      player.maxCamDist = 14; player.camDist = 8;
      let drag = null;
      renderer.domElement.addEventListener('pointerdown', (e) => { if (S.mode === 'walk') drag = { x: e.clientX, y: e.clientY }; });
      renderer.domElement.addEventListener('pointermove', (e) => { if (drag && S.mode === 'walk') { player.orbit(e.clientX - drag.x, e.clientY - drag.y); drag = { x: e.clientX, y: e.clientY }; } });
      addEventListener('pointerup', () => { drag = null; });
      renderer.domElement.addEventListener('wheel', (e) => { if (S.mode === 'walk') player.zoom(e.deltaY); });
      walk = { avatar, player, col };
      scene.add(avatar.root);
      const sp = set.spawn || { pos: [0, 0, 0], facing: 0 };
      player.teleport(new THREE.Vector3(...sp.pos), sp.facing);
    }
    walk.avatar.root.visible = true;
    camera.fov = 60; camera.updateProjectionMatrix();
    S.mode = 'walk';
  }

  function playShot(i, t = 0) { S.mode = 'shot'; S.shot = i; S.t = t; S.playing = true; if (walk) walk.avatar.root.visible = false; toast(`Shot ${i + 1}: ${shots[i].def.name}`); }
  function setWeatherLevel(i) { S.rampT = -1; S.snowIdx = i; S.weather = SNOW_LEVELS[i]; toast(`Snow: ${SNOW_NAMES[i]}`); }
  function blizzardRamp(dur = S.rampDur) { S.rampT = 0; S.rampDur = dur; S.weatherFrom = Math.min(S.weather, 0.3); S.weatherTo = 1; toast(`Blizzard ramp (${dur}s)`); }
  S.snowIdx = num('snow', 2);
  if (Q.get('blizzard') === '1') blizzardRamp();

  addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const c = e.code;
    if (/^Digit[1-9]$/.test(c) && +c[5] <= shots.length && S.mode !== 'free') { S.reel = false; playShot(+c[5] - 1); return; }
    if (/^Digit[1-9]$/.test(c) && +c[5] <= shots.length && S.mode === 'free' && !e.shiftKey) { S.reel = false; free.enabled = false; playShot(+c[5] - 1); return; }
    switch (c) {
      case 'Digit0': S.reel = true; playShot(0); break;
      case 'Enter': playShot(S.shot); break;
      case 'KeyP': S.paused = !S.paused; toast(S.paused ? 'Paused' : 'Playing'); break;
      case 'KeyL': S.loop = !S.loop; toast(`Loop ${S.loop ? 'on' : 'off'}`); break;
      case 'KeyF': if (S.mode === 'free') { free.enabled = false; S.mode = 'shot'; S.playing = false; toast('Free cam off'); } else { if (walk) walk.avatar.root.visible = false; S.mode = 'free'; free.enabled = true; free.takeOver(); toast('Free cam'); } break;
      case 'KeyG': if (S.mode === 'walk') { free.enabled = true; S.mode = 'free'; free.takeOver(); walk.avatar.root.visible = false; toast('Free cam'); } else { free.enabled = false; enterWalk().then(() => toast('Walk mode')); } break;
      case 'KeyB': if (e.shiftKey) blizzardRamp(); else setWeatherLevel((S.snowIdx + 1) % SNOW_LEVELS.length); break;
      case 'KeyN': S.nightTarget = S.nightTarget > 0.5 ? 0 : 1; toast(S.nightTarget ? 'Night' : 'Day'); break;
      case 'KeyH': setClean(!S.clean); break;
      case 'KeyK': S.bars = S.bars ? 0 : 2.39; updateBars(); break;
      case 'BracketLeft': camera.fov = Math.max(15, camera.fov - 5); camera.updateProjectionMatrix(); toast(`FOV ${camera.fov}`); break;
      case 'BracketRight': camera.fov = Math.min(100, camera.fov + 5); camera.updateProjectionMatrix(); toast(`FOV ${camera.fov}`); break;
      case 'KeyC': {
        const p = camera.position, d = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(30).add(p);
        const r = (v) => [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
        const txt = JSON.stringify({ pos: r(p), look: r(d), fov: camera.fov });
        console.log('[camera]', txt); navigator.clipboard?.writeText(txt).catch(() => {}); toast('Camera pose copied'); break;
      }
    }
  });

  // ---------- frame ----------
  function step(dt) {
    if (!S.paused) S.time += dt;
    // day/night (smooth 4 s transition)
    const dn = S.nightTarget - S.night; S.night += Math.sign(dn) * Math.min(Math.abs(dn), dt / 4);
    // weather ramp
    if (S.rampT >= 0) { S.rampT += dt; const u = Math.min(1, S.rampT / S.rampDur); S.weather = S.weatherFrom + (S.weatherTo - S.weatherFrom) * (u * u * (3 - 2 * u)); if (u >= 1) { S.rampT = -1; S.snowIdx = 4; } }
    set.setNight(S.night);
    set.setWeather(S.weather);
    const w = S.weather;
    snow.uniforms.uIntensity.value = w <= 0 ? 0 : 0.12 + w * 0.88;
    snow.uniforms.uSize.value = 1 + w * 0.5;
    snow.uniforms.uColor.value.set(S.night > 0.5 ? '#dbe8ff' : '#ffffff');
    gust.uniforms.uColor.value.copy(snow.uniforms.uColor.value);
    gust.uniforms.uIntensity.value = Math.max(0, (w - 0.6) / 0.4); gust.uniforms.uSize.value = 0.8;

    if (S.mode === 'shot') {
      const shot = shots[S.shot];
      if (S.playing) S.t += dt;
      const running = shot.apply(camera, S.t);
      if (!running && S.playing) {
        if (S.reel && S.shot < shots.length - 1) playShot(S.shot + 1);
        else if (S.loop || S.reel) playShot(S.reel ? 0 : S.shot);
        else S.playing = false;
      }
    } else if (S.mode === 'free') free.update(dt);
    else if (S.mode === 'walk' && walk) walk.player.update(dt, walk.col);

    set.update?.(dt, S.time, camera, S);
    const wind = set.wind?.(w) || { speed: 2.2 + w * 9, wind: [0.8 + w * 14, 0.3 + w * 4] };
    snow.update(dt, S.time, camera.position, wind);
    gust.update(dt, S.time, camera.position, { speed: wind.speed * 1.3, wind: wind.wind.map(v => v * 1.4) });
    { const bl = set.bloom?.(S.night, w) || {}; bloom.strength = bl.strength ?? 0.5; bloom.radius = bl.radius ?? 0.4; bloom.threshold = bl.threshold ?? 1; }
    grade.uniforms.uTime.value = S.time % 100;
    composer.render(dt);
    status.textContent = `${S.mode === 'shot' ? `shot ${S.shot + 1}/${shots.length} ${S.t.toFixed(1)}s${S.playing ? '' : ' (hold)'}` : S.mode}  ·  snow ${SNOW_NAMES[S.snowIdx] ?? ''}${S.rampT >= 0 ? ' (ramping)' : ''}  ·  ${S.night > 0.5 ? 'night' : 'day'}  ·  H hides UI`;
  }

  resize(); addEventListener('resize', resize);
  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (!S.fixed) step(dt);
  }
  // warm up the snow so it is already falling on the first frame
  for (let i = 0; i < 3; i++) step(1 / 30);
  if (S.fixed) step(0);
  loop();

  // Automation / deterministic capture hooks (Playwright: seek + render frame by frame).
  window.sets = {
    S, set, camera, renderer, shots: set.shots,
    play: (n) => playShot(n - 1),
    /** Pose shot n at t seconds, advance the world by dt, render once. */
    /** Hold an arbitrary camera pose (stills / custom framing). */
    pose(pos, look, fov = 50, dt = 0) { S.mode = 'pose'; camera.position.set(...pos); camera.lookAt(...look); camera.fov = fov; camera.updateProjectionMatrix(); step(dt); },
    seek(n, t, dt = 0) { S.mode = 'shot'; S.shot = n - 1; S.t = t; S.playing = false; step(dt); },
    step: (dt = 1 / 30) => step(dt),
    night: (v) => { S.night = S.nightTarget = v; },
    snow: (i) => setWeatherLevel(i), weather: (v) => { S.rampT = -1; S.weather = v; }, blizzard: blizzardRamp,
    clean: setClean, freecam: () => { S.mode = 'free'; free.enabled = true; free.takeOver(); }, walk: enterWalk,
    ready: true,
  };
}

boot().catch((e) => { console.error(e); document.body.append(Object.assign(document.createElement('pre'), { textContent: 'Set failed to load: ' + e.message, style: 'color:#fff;padding:20px' })); });
