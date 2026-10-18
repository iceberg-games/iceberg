// Engine: owns the renderer, camera, shared avatar/player, the game loop and
// pointer routing. Games are plug-in modules (see src/games/*.js) that build
// their own scene and hand back an instance; the engine runs whichever one is
// active. Avatar, wallet and cosmetics are shared across all games.
import * as THREE from 'three';
import { Input } from './input.js';
import { PlayerController } from './player.js';
import { bus } from '../core/events.js';

export class Engine {
  constructor(container, { avatar, economy, music, models }) {
    this.container = container;
    this.avatar = avatar; this.economy = economy; this.music = music; this.models = models;
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
    container.appendChild(r.domElement);
    r.domElement.id = 'game-canvas';

    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1000);
    this.input = new Input(r.domElement);
    this.player = new PlayerController(this.camera, avatar, this.input);
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.game = null; this.def = null; this.running = false;

    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      r.setSize(innerWidth, innerHeight);
    });
    this._setupPointer(r.domElement);
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _setupPointer(el) {
    let down = null;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', (e) => { this._setMouse(e); this.game?.onPointerDown?.(e, this._ray()); down = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, button: e.button, moved: 0, shift: e.shiftKey }; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e) => {
      this._setMouse(e);
      if (down) {
        // iOS Safari reports movementX/Y = 0 for touch, so derive deltas from positions.
        const mx = e.clientX - down.lastX, my = e.clientY - down.lastY;
        down.lastX = e.clientX; down.lastY = e.clientY;
        e = { clientX: e.clientX, clientY: e.clientY, movementX: mx, movementY: my, shiftKey: e.shiftKey };
        down.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        if (down.moved > 4) { if (this.game?.cameraController) this.game.cameraController.drag(e.movementX, e.movementY, down.button); else this.player.orbit(e.movementX, e.movementY); }
      }
      if (this.game?.onHover) this.game.onHover(this._ray());
    });
    el.addEventListener('pointerup', (e) => {
      if (down && down.moved <= 4 && this.game?.onClick) {
        this._setMouse(e);
        this.game.onClick({ ray: this._ray(), button: down.button, shift: down.shift || e.shiftKey });
      }
      down = null;
    });
    el.addEventListener('wheel', (e) => { if (this.game?.cameraController) this.game.cameraController.wheel(e.deltaY); else this.player.zoom(e.deltaY); e.preventDefault(); }, { passive: false });
  }
  _setMouse(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  }
  _ray() { this.raycaster.setFromCamera(this.mouse, this.camera); return this.raycaster; }

  /** Load a game definition. params are passed to def.create (e.g. a custom game doc). */
  async loadGame(def, params = {}) {
    this.unloadGame();
    const ctx = { engine: this, avatar: this.avatar, economy: this.economy, models: this.models, music: this.music, bus, THREE };
    const game = await def.create(ctx, params);
    this.game = game; this.def = def;
    if (!game.hideAvatar) { game.scene.add(this.avatar.root); game.scene.add(this.avatar.trail); }
    this.player.mods = { speed: 1, gravity: 1, jump: 1, carpet: false };
    this.player.onFall = game.onFall || null;
    this.player.occluders = game.occluders || [];
    this.player.maxCamDist = game.maxCamDist || 16;
    this.player.camDist = Math.min(this.player.camDist, this.player.maxCamDist);
    this.player.teleport(game.spawn || new THREE.Vector3(0, 0, 0), game.spawnFacing || 0);
    this.player.updateCamera();
    this.music.play(game.music || 'none');
    this.running = true;
    bus.emit('game:loaded', { def, game });
    return game;
  }

  unloadGame() {
    if (!this.game) return;
    this.game.scene.remove(this.avatar.root); this.game.scene.remove(this.avatar.trail);
    this.game.dispose?.();
    this.game.scene.traverse(o => { o.geometry?.dispose?.(); });
    this.game = null; this.def = null; this.running = false;
    bus.emit('game:unloaded');
  }

  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    if (!this.running || !this.game) return;
    if (this.game.cameraController) this.game.cameraController.update(dt, this.input);
    else this.player.update(dt, this.game.collision);
    this.game.update?.(dt, t, this.player);
    this.renderer.render(this.game.scene, this.camera);
  }

  snapshot(w = 320, h = 180) {
    // small thumbnail from the current frame
    this.renderer.render(this.game.scene, this.camera);
    const src = this.renderer.domElement;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const ar = w / h, sar = src.width / src.height;
    let sw = src.width, sh = src.height, sx = 0, sy = 0;
    if (sar > ar) { sw = sh * ar; sx = (src.width - sw) / 2; } else { sh = sw / ar; sy = (src.height - sh) / 2; }
    g.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
    return c.toDataURL('image/jpeg', 0.8);
  }
}
