import { syncPlus } from './core/plus.js';
// Iceberg — platform bootstrap. Wires shared services (economy, avatar,
// models, music) to the engine, the Games menu, the HUD and the creator.
import { isBanned, showBanned } from './net/ban.js';
import './style.css';
import './ui/iceSkin.css';
import { backend, modelStore, modelPrefs } from './backend/LocalBackend.js';
import { Economy } from './core/economy.js';
import { bindQuests } from './core/quests.js';
import { getAudioListener, setAudioCamera } from './core/audio.js';
import { bus } from './core/events.js';
import { Avatar, loadBodyType } from './game/avatar.js';
import { ModelLibrary } from './game/models.js';
import { Music } from './audio/music.js';
import { Engine } from './engine/engine.js';
import { UI } from './ui/ui.js';
import { Menu } from './ui/menu.js';
import { CreatorPanel } from './ui/creator.js';
import { MobileStudio } from './ui/mobileStudio.js';
import { rigSpawn } from './game/avatarRig.js';
import { mountFriendsPanel } from './ui/friendsPanel.js';
import { h } from './ui/dom.js';
import { CREATOR, findGame } from './games/registry.js';
import { getServerGame } from './studio/store.js';
import { customGameDef } from './games/customGame.js';
import { showDevicePicker } from './ui/devicePicker.js';
import { mountTouchControls } from './ui/touchControls.js';
import { connectStoredSession } from './net/session.js';
import { CONFIG } from './net/config.js';
import { mountAuthGate, needsAccountGate } from './ui/accountGate.js';
import { watchAccountSession } from './net/account.js';
import { registerServiceWorker } from './net/pwa.js';
import { mountGameChat } from './chat/gameChat.js';
import { startPlaySession } from './net/gameStats.js';
import { createMultiplayer } from './mp/multiplayer.js';
import { initUiSounds } from './audio/uiSounds.js';
import { uiSoundOptions } from './audio/siteSounds.js';
import './net/install.js';   // captures beforeinstallprompt early (Download button)
import { isBlockedMobile, showMobileBlock } from './core/mobileGate.js';
import './ugc/store.js';   // registers saved UGC creations in the catalog before the avatar loadout applies
import { mountUgcEditor } from './ugc/editor.js';
import { refreshPublished } from './ugc/store.js';

// Multi-page site: the game lives in play/ and the portal opens it with ?game=<id>.
const params = new URLSearchParams(location.search);
const GAME_PARAM = params.get('game');
const SITE_ROOT = document.querySelector('meta[name="iceberg-root"]')?.content || null;   // set only in the site build

async function boot() {
  if (isBlockedMobile()) return showMobileBlock();   // phones are blocked for now (core/mobileGate.js, one flag)
  const app = document.getElementById('app');
  if (CONFIG.isSite) document.body.classList.add('iceberg-site');
  const economy = new Economy(backend);
  const quests = bindQuests(economy);   // games: import { quests } from '../core/quests.js' or window.iceberg.quests
  let remote = await connectStoredSession(economy);   // null = guest (localStorage only), or sign-in required when accounts are on
  if (needsAccountGate(remote)) {
    await new Promise((resolve) => {
      mountAuthGate(app, { economy, onSignedIn: (r) => { remote = r; resolve(); } });
    });
    app.replaceChildren();
  }
  if (await isBanned(remote)) return showBanned();      // banned (0012): no game, chat or multiplayer
  if (remote) watchAccountSession(remote, { onRevoked: async () => { try { await remote.client.signOut(); } catch {} location.reload(); } });
  await syncPlus(remote);                               // Iceberg Plus from the server (0015) before studio perks render
  const settings = modelPrefs.loadSettings();
  const music = new Music(settings, (s) => modelPrefs.saveSettings({ ...modelPrefs.loadSettings(), ...s }));
  const models = new ModelLibrary(modelStore);
  await models.init();

  const avatar = new Avatar();
  avatar.setBodyType(loadBodyType());
  avatar.applyLoadout(economy.profile);
  rigSpawn(avatar, { local: true });   // R15 seam: Iceberg Avatars' rig attaches here (designs/qol-r15-hooks.md)
  const wear = modelPrefs.loadWear();
  if (wear && models.has(wear.modelId)) avatar.setCustomWear(models.instance(wear.modelId), wear);

  const engine = new Engine(app, { avatar, economy, music, models });
  let testingDoc = null;
  const backToEditor = h('button.btn.floating.hidden#back-to-editor', { onclick: () => edit(testingDoc) }, '✏️ Back to editor');

  let session = null;
  const POPOUT = params.get('popout') === '1' && !!window.opener;   // game pop-out window opened from the PC home
  const goHome = () => { if (POPOUT) { try { window.close(); } catch { /* ignore */ } } session?.stop(); session = null; mp.leave(); gameChat.leave(); engine.unloadGame(); testingDoc = null; backToEditor.classList.add('hidden'); menu.showGames(); music.play('winter'); };
  const play = async (def, { friend = null } = {}) => {
    menu.hide(); testingDoc = null; backToEditor.classList.add('hidden');
    await engine.loadGame(def);
    gameChat.show(true);
    // multiplayer: pick/create a server instance (or the friend's from ?join=), then chat in that instance's room
    const joinFriend = friend || (def.id === GAME_PARAM ? params.get('join') : null);
    let joinErr = null;
    let inst = await mp.join(def.id, { friend: joinFriend }).catch((e) => { joinErr = e; console.warn('multiplayer unavailable', e); return null; });
    // Friend join failed (not friends / left / signed out): fall back to a normal server instead of playing solo.
    if (joinFriend && (!inst || inst.ok === false)) {
      const why = !remote ? 'sign in to join friends' : (inst?.reason || joinErr?.message || 'they are not in a server right now');
      ui.toast(`Couldn't join ${joinFriend}: ${String(why).replace(/_/g, ' ')}. Joined a normal server.`, '⚠️');
      inst = await mp.join(def.id).catch(() => null);
    } else if (inst?.note === 'friend_full') ui.toast('That server is full, so you joined another one.', '👥');
    else if (inst && joinFriend && !inst.note) ui.toast(`Joined ${joinFriend}'s server!`, '👋');
    gameChat.join(def.id, inst?.room).catch(() => {});
    session?.stop(); session = startPlaySession(remote, def.id);   // visit + 30 s heartbeats (portal tabs)
  };
  const edit = async (doc) => { menu.hide(); testingDoc = null; backToEditor.classList.add('hidden'); await engine.loadGame(CREATOR, { doc }); };

  const ui = new UI(app, { engine, economy, avatar, models, music, onHome: goHome });
  const me = remote ? { username: economy.profile.username, displayName: economy.profile.displayName } : null;
  const gameChat = mountGameChat({ engine, avatar, remote, me, root: document.body,
    speak: (username, text, ms) => mp.speak(username, text, ms), onSent: () => mp.hintChat() });
  // ONE AudioListener on the camera, shared by cosmetics/games/sfx (core/audio.js). The local avatar gets it now.
  setAudioCamera(engine.camera);
  try { avatar.attachWindAudio?.(getAudioListener()); } catch (e) { console.warn('audio listener', e); }
  const mp = createMultiplayer({ engine, getRemote: () => remote, bubbles: gameChat.bubbles, me: () => me, getListener: getAudioListener,
    localName: () => economy.profile.displayName || economy.profile.username || 'You' });
  engine.mp = mp;                  // games: ctx.mp (engine ctx) / ctx.engine.mp / window.iceberg.mp (docs/MULTIPLAYER_API.md)
  mp.onChatHint(() => gameChat.pollNow());
  addEventListener('pagehide', () => { mp.leave(); });
  bus.on('economy:rejected', (e) => ui.toast(e.action === 'buy' ? 'The server said no to that purchase; your Birg Bucks were refunded.' : 'Not enough Birg Bucks on the server.', '⚠️'));
  bus.on('economy:capped', (e) => { if (e.source !== 'build') ui.toast('Daily Birg Bucks limit reached for that. Come back tomorrow!', '⏰'); });
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') economy.resync().catch(() => {}); });
  const menu = new Menu(app, {
    economy, models, ui, avatar, renderer: engine.renderer, onPlay: play, onEdit: edit, onFriends: () => friends?.open(),
    onStart: () => {
      music.unlock(); music.play('winter');
      const got = economy.claimDailyBonus();
      if (got) ui.toast(`Daily bonus! +${got} Birg Bucks`, '🎁');
      const def = GAME_PARAM && findGame(GAME_PARAM);
      if (def) setTimeout(() => play(def), 0);   // after the menu renders the games list
      else if (GAME_PARAM) {   // not built-in / not on this device: try a server-published game (play-by-link), else say so
        getServerGame(GAME_PARAM).then(doc => { if (doc) play(customGameDef(doc)); else ui.toast(`Game not found: "${GAME_PARAM.slice(0, 40)}" (it may be unpublished)`, '❓'); },
          err => ui.toast(`Couldn't load game "${GAME_PARAM.slice(0, 40)}": ${err.message}`, '⚠️'));
      }
    },
  });
  const onTest = async (doc) => { testingDoc = doc; menu.hide(); await engine.loadGame(customGameDef(doc)); backToEditor.classList.remove('hidden'); };
  new CreatorPanel(app, { engine, models, ui, onTest, onExit: goHome, onReload: (doc) => edit(doc) });
  // Phones/tablets (device mode 'mobile') get the simple Mobile Studio on the same editor + save path.
  const mobileStudio = new MobileStudio(document.body, { engine, ui, onTest, onExit: goHome });
  app.append(backToEditor);

  // Browsers only allow audio after a user gesture.
  initUiSounds(uiSoundOptions());   // UI click/Play/popup sounds (one delegated listener); mute = music.muted
  const unlock = () => music.unlock();
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  bus.on('inventory:changed', () => ui.updateRocketHint());

  setInterval(() => music.rocket(engine.running && engine.player.flying), 80);

  mountTouchControls(engine);
  // Friends QoL: 👥 sheet (add/accept/list, online/playing, Join friend in-app)
  const friends = mountFriendsPanel({ getRemote: () => remote, ui, onJoin: async (gameId, username) => {
    const def = findGame(gameId); if (!def) { ui.toast('That game is not on this build.', '⚠️'); return; }
    if (engine.game) { mp.leave(); gameChat.leave(); }
    await play(def, { friend: username });
  } });
  const ugc = mountUgcEditor({ economy, ui });   // PC-only Accessory Editor (bus 'ugc:open'); hidden on phones
  refreshPublished().then(() => avatar.applyLoadout(economy.profile)).catch(() => {});
  await showDevicePicker(document.body);
  menu.showTitle();
  if (GAME_PARAM && params.get('autostart') === '1' && menu.mode === 'title') menu.el.querySelector('#start-btn')?.click();   // deep link from a PC tile: boot straight into the game

  // Handy hooks for automated tests / debugging in the console.
  window.iceberg = { engine, ugc, mobileStudio, economy, quests, getAudioListener, avatar, models, music, ui, menu, backend, remote, gameChat, mp, friends, play: (id) => play(findGame(id)), edit, goHome };
  if (SITE_ROOT) registerServiceWorker(SITE_ROOT);
}

boot().catch((e) => { console.error(e); document.body.append(Object.assign(document.createElement('pre'), { textContent: 'Failed to start: ' + e.message })); });
