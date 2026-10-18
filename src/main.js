// Iceberg — platform bootstrap. Wires shared services (economy, avatar,
// models, music) to the engine, the Games menu, the HUD and the creator.
import './style.css';
import { backend, modelStore, modelPrefs } from './backend/LocalBackend.js';
import { Economy } from './core/economy.js';
import { bus } from './core/events.js';
import { Avatar } from './game/avatar.js';
import { ModelLibrary } from './game/models.js';
import { Music } from './audio/music.js';
import { Engine } from './engine/engine.js';
import { UI } from './ui/ui.js';
import { Menu } from './ui/menu.js';
import { CreatorPanel } from './ui/creator.js';
import { h } from './ui/dom.js';
import { CREATOR, findGame } from './games/registry.js';
import { customGameDef } from './games/customGame.js';

async function boot() {
  const app = document.getElementById('app');
  const economy = new Economy(backend);
  const settings = modelPrefs.loadSettings();
  const music = new Music(settings, (s) => modelPrefs.saveSettings({ ...modelPrefs.loadSettings(), ...s }));
  const models = new ModelLibrary(modelStore);
  await models.init();

  const avatar = new Avatar();
  avatar.applyLoadout(economy.profile);
  const wear = modelPrefs.loadWear();
  if (wear && models.has(wear.modelId)) avatar.setCustomWear(models.instance(wear.modelId), wear);

  const engine = new Engine(app, { avatar, economy, music, models });
  let testingDoc = null;
  const backToEditor = h('button.btn.floating.hidden#back-to-editor', { onclick: () => edit(testingDoc) }, '✏️ Back to editor');

  const goHome = () => { engine.unloadGame(); testingDoc = null; backToEditor.classList.add('hidden'); menu.showGames(); music.play('winter'); };
  const play = async (def) => { menu.hide(); testingDoc = null; backToEditor.classList.add('hidden'); await engine.loadGame(def); };
  const edit = async (doc) => { menu.hide(); testingDoc = null; backToEditor.classList.add('hidden'); await engine.loadGame(CREATOR, { doc }); };

  const ui = new UI(app, { engine, economy, avatar, models, music, onHome: goHome });
  const menu = new Menu(app, {
    economy, models, ui, onPlay: play, onEdit: edit,
    onStart: () => {
      music.unlock(); music.play('winter');
      const got = economy.claimDailyBonus();
      if (got) ui.toast(`Daily bonus! +${got} Birg Bucks`, '🎁');
    },
  });
  new CreatorPanel(app, {
    engine, models, ui,
    onTest: async (doc) => { testingDoc = doc; menu.hide(); await engine.loadGame(customGameDef(doc)); backToEditor.classList.remove('hidden'); },
    onExit: goHome,
    onReload: (doc) => edit(doc),
  });
  app.append(backToEditor);

  // Browsers only allow audio after a user gesture.
  const unlock = () => music.unlock();
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  bus.on('inventory:changed', () => ui.updateRocketHint());

  setInterval(() => music.rocket(engine.running && engine.player.flying), 80);

  menu.showTitle();

  // Handy hooks for automated tests / debugging in the console.
  window.iceberg = { engine, economy, avatar, models, music, ui, menu, backend, play: (id) => play(findGame(id)), edit, goHome };
}

boot().catch((e) => { console.error(e); document.body.append(Object.assign(document.createElement('pre'), { textContent: 'Failed to start: ' + e.message })); });
