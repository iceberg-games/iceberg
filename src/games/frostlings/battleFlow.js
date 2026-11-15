// Frostlings battle flow: stage entry/exit, turn loop (wild / tamer / ring / PvP duel), log playback with juice,
// snare catching, XP + level-ups + move learning, evolution cinematics, rewards. Uses the shared state bag G.
import * as THREE from 'three';
import * as C from './config.js';
import * as B from './battle.js';
import { buildFrostling, animFrostling, flash, buildSnare, buildTamer } from './models.js';
import { typeBadge } from './ui.js';

const { SPECIES_BY_ID: SP, MOVES, TYPES, AREAS, TAMERS, ITEMS } = C;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const wait = (ms) => new Promise(res => setTimeout(res, ms));
class Gone extends Error {}

export function createBattle(G) {
  const { scene, player, cam, collision, stage, audio, ui, portraits, world } = G;
  const tween = G.tween, burst = (...a) => G.burst(...a), pop = (...a) => G.pop(...a);
  let BT = null;
  const guard = () => { if (!G.alive) throw new Gone(); };
  const camTmp = new THREE.Vector3(), v3 = new THREE.Vector3();

  function battleModel(c, side) {
    const pos = side === BT.ME ? stage.myPos : stage.foePos, other = side === BT.ME ? stage.foePos : stage.myPos;
    const old = BT.models[side]; if (old) scene.remove(old);
    const m = buildFrostling(c.sp, { hat: c.mon?.hat && side === BT.ME ? c.mon.hat : null, scale: 1.25 });
    m.position.copy(pos); m.rotation.y = Math.atan2(other.x - pos.x, other.z - pos.z); scene.add(m); BT.models[side] = m;
    m.userData.home = pos.clone(); m.userData.s0 = m.scale.x; return m;
  }
  function cardFor(side) {
    const c = B.active(BT.b, side), me = side === BT.ME, rar = C.RARITY[SP[c.sp].rarity];
    const xpFrac = me && c.mon && !BT.duel ? (c.mon.lv >= C.LEVEL_CAP ? 1 : c.mon.xp / B.xpToNext(c.mon.lv)) : null;
    ui.battleCard(me ? 'me' : 'foe', { key: side + ':' + BT.b.sides[side].active + ':' + c.sp, name: c.name, lv: c.lv, type: c.type, hp: c.hp, maxHp: c.maxHp, status: c.status, xpFrac },
      !me && BT.kind === 'wild' ? `<span class="fl-rar" style="background:${rar.color}">${rar.name}</span>${G.save.dex[c.sp] === 2 ? ' <span title="already tamed">⭕</span>' : ''}` : '');
  }
  const cards = () => { cardFor(BT.ME); cardFor(BT.FOE); };
  const say = async (html, ms = 900) => { guard(); ui.battleMsg(html); await wait(ms); guard(); };

  async function enterStage(kind, area, foeTamer) {
    G.mode = 'battle'; ui.closeModal(); ui.wipe(true); audio.sfx(kind === 'wild' ? 'sfx_encounter' : 'sfx_tamer_intro');
    await wait(380); guard();
    BT.ret = { pos: player.pos.clone(), facing: player.facing, camYaw: player.camYaw, camPitch: player.camPitch };
    collision.bounds = null; player.teleport(stage.myTamer, Math.atan2(stage.center.x - stage.myTamer.x, stage.center.z - stage.myTamer.z)); player.enabled = false;
    stage.setTheme(kind === 'ring' || kind === 'duel' ? 'ring' : area);
    if (G.comp) G.comp.mesh.visible = false;
    if (foeTamer) { BT.foeTamer = buildTamer(foeTamer.color, { hat: foeTamer.hat || foeTamer.color }); BT.foeTamer.position.copy(stage.foeTamer); BT.foeTamer.rotation.y = Math.atan2(stage.center.x - stage.foeTamer.x, stage.center.z - stage.foeTamer.z); scene.add(BT.foeTamer); }
    ui.battleShow(true); audio.amb(null); audio.music_(kind === 'wild' ? 'bgm_battle_wild' : 'bgm_battle_tamer');
    BT.camT = 0; ui.wipe(false);
  }
  async function leaveStage() {
    ui.wipe(true); await wait(380);
    for (const m of BT.models) if (m) scene.remove(m);
    if (BT.foeTamer) scene.remove(BT.foeTamer);
    if (BT.snare) scene.remove(BT.snare);
    ui.battleShow(false); ui.clearOptions();
    collision.bounds = G.BOUNDS; player.enabled = true;
    const r = BT.ret; player.teleport(r.toDen ? new THREE.Vector3(-14, 0, -10) : r.pos, r.facing); if (!r.toDen) { player.camYaw = r.camYaw; player.camPitch = r.camPitch; }
    if (G.comp) { G.comp.mesh.visible = true; G.comp.mesh.position.copy(player.pos).add(v3.set(1.5, 0, 1.5)); }
    BT = null; G.mode = 'world'; ui.wipe(false); audio.bgm = null; audio.ambName = null;
    G.refreshCompanion(); G.commit();
  }

  // ----- log playback -----
  async function lunge(side) {
    const m = BT.models[side], other = BT.models[1 - side]; if (!m || !other) return;
    const home = m.userData.home, dir = other.position.clone().sub(home).setY(0).normalize();
    await tween(0.24, (k) => { const e = Math.sin(k * Math.PI); m.position.copy(home).addScaledVector(dir, e * 2.2); m.position.y = e * 0.6; });
    m.position.copy(home);
  }
  async function projectile(side, type) {
    const a = BT.models[side], d = BT.models[1 - side]; if (!a || !d) return;
    const from = a.position.clone().setY(1.3), to = d.position.clone().setY(1.3), col = TYPES[type].color;
    await tween(0.34, (k) => { const p = from.clone().lerp(to, k); p.y += Math.sin(k * Math.PI) * 1.4; burst(p.x, p.y, p.z, 4, col, 1.2, 0, 0.45); burst(p.x, p.y, p.z, 1, '#ffffff', 0.5, 0, 0.3); });
  }
  const STAT = { atk: 'Attack', def: 'Defense', spd: 'Speed' };
  const nm = (s) => `${s === BT.FOE ? (BT.kind === 'wild' ? 'Wild ' : 'Foe ') : ''}<b>${B.active(BT.b, s).name}</b>`;
  async function playLog(log) {
    for (const e of log) {
      guard();
      const c = B.active(BT.b, e.side), mdl = BT.models[e.side];
      switch (e.t) {
        case 'move': {
          const mv = MOVES[e.move]; ui.battleMsg(`${nm(e.side)} used <b style="color:${TYPES[mv.type].dark}">${mv.name}</b>!`);
          audio.sfx('sfx_move_' + mv.type);
          if (mv.pow) { if (mv.type === 'plain' || mv.pow >= 80) await lunge(e.side); else await projectile(e.side, mv.type); }
          else { const p = mdl.position; burst(p.x, 1.5, p.z, 24, TYPES[mv.type].color, 3, -2, 1); await wait(450); }
          break;
        }
        case 'miss': await say(`...but it missed!`, 750); break;
        case 'fail': await say(`...but nothing happened!`, 750); break;
        case 'dmg': {
          const p = mdl.position; flash(mdl); BT.recoil[e.side] = 0.3;
          audio.sfx(e.eff > 1 ? 'sfx_hit_super' : 'sfx_hit');
          G.fx.hitstop = e.eff > 1 || e.crit ? 0.14 : 0.07; G.fx.shake = Math.max(G.fx.shake, e.eff > 1 ? 0.5 : e.crit ? 0.4 : 0.22);
          burst(p.x, 1.4, p.z, e.eff > 1 ? 44 : 22, TYPES[e.type].color, 6, 8, 0.7); burst(p.x, 1.4, p.z, 10, '#ffffff', 4, 8, 0.5);
          pop(`-${e.amt}`, p.x + rand(-0.4, 0.4), 3.4, p.z, e.eff > 1 ? '#ffd24a' : e.eff < 1 ? '#b9c3d1' : '#ffffff', e.crit || e.eff > 1 ? 1.4 : 1);
          c.hp = e.hp; cards();
          await wait(420);
          if (e.crit) await say('A critical hit!', 650);
          if (e.eff > 1) await say(`<span style="color:#e07a10">It's super effective!</span>`, 800); else if (e.eff < 1) await say(`It's not very effective…`, 700);
          break;
        }
        case 'status': {
          const p = mdl.position, col = { chill: '#8fd8ff', sleep: '#c9b8ff', burn: '#ff8a4c' }[e.status];
          audio.sfx('sfx_status_' + e.status); burst(p.x, 1.6, p.z, 30, col, 3, e.status === 'burn' ? -3 : 2, 1); cards();
          await say(`${nm(e.side)} ${{ chill: 'is chilled! 🧊', sleep: 'fell asleep! 💤', burn: 'was burned! 🔥' }[e.status]}`, 900); break;
        }
        case 'heal': { const p = mdl.position; audio.sfx('sfx_heal'); burst(p.x, 1, p.z, 30, '#5be37d', 3, -3, 1.1); c.hp = e.hp; cards(); await say(`${nm(e.side)} recovered ${e.amt} HP!`, 800); break; }
        case 'cure': cards(); await say(`${nm(e.side)}'s burn was soothed.`, 650); break;
        case 'buff': { const p = mdl.position; audio.sfx('sfx_level_up'); burst(p.x, 1, p.z, 26, '#ffd24a', 3, -4, 1); await say(`${nm(e.side)}'s ${STAT[e.stat]} rose sharply!`, 800); break; }
        case 'skip': if (e.why === 'sleep') { pop('💤', mdl.position.x, 3, mdl.position.z, '#c9b8ff'); await say(`${nm(e.side)} is fast asleep…`, 800); } else { burst(mdl.position.x, 1.4, mdl.position.z, 14, '#8fd8ff', 2, 2, 0.7); await say(`${nm(e.side)} is too chilly to move!`, 800); } break;
        case 'wake': cards(); await say(`${nm(e.side)} woke up!`, 650); break;
        case 'thaw': cards(); await say(`${nm(e.side)} ${e.status === 'chill' ? 'warmed up' : 'is no longer burned'}.`, 600); break;
        case 'burn': { flash(mdl); c.hp = e.hp; cards(); burst(mdl.position.x, 1.2, mdl.position.z, 14, '#ff8a4c', 3, -2, 0.7); audio.sfx('sfx_status_burn'); await say(`${nm(e.side)} is hurt by its burn!`, 750); break; }
        case 'faint': {
          audio.sfx('sfx_faint'); c.hp = 0; cards(); const s0 = mdl.userData.s0;
          await tween(0.5, (k) => { mdl.scale.setScalar(s0 * (1 - k * 0.9)); mdl.rotation.z = k * 1.2; mdl.position.y = -k * 0.4; });
          mdl.visible = false; burst(mdl.position.x, 0.8, mdl.position.z, 30, '#ffffff', 4, 4, 0.9);
          await say(`${nm(e.side)} fainted!`, 900); break;
        }
        case 'swap': await sendOut(e.side); break;
      }
    }
  }
  async function sendOut(side, first = false) {
    const c = B.active(BT.b, side); const m = battleModel(c, side);
    const home = m.userData.home, s0 = m.userData.s0;
    m.scale.setScalar(0.01);
    audio.sfx('sfx_snare_throw'); burst(home.x, 1.2, home.z, 30, TYPES[c.type].color, 5, 2, 0.8);
    ui.battleMsg(side === BT.ME ? `Go, <b>${c.name}</b>!` : BT.kind === 'wild' ? `A wild <b>${c.name}</b> appeared!` : `${BT.foeName} sends out <b>${c.name}</b>!`);
    cards();
    await tween(0.35, (k) => { m.scale.setScalar(s0 * Math.max(0.01, k < 0.7 ? k / 0.7 * 1.15 : 1.15 - (k - 0.7) / 0.3 * 0.15)); });
    await wait(first ? 500 : 650); guard();
    if (side === BT.FOE) G.setDex(c.sp, 1);
  }

  // ----- player choice -----
  function choose(items) { return new Promise(res => ui.battleOptions(items.map(it => ({ ...it, pick: () => { ui.clearOptions(); res(it.value); } })))); }
  const effTag = (mv, foe) => { if (!mv.pow) return ''; const m = C.typeMult(mv.type, foe.type); return m > 1 ? 'SUPER ×2' : m < 1 ? 'weak ×½' : ''; };
  const tb = (t) => `${TYPES[t].icon} ${TYPES[t].name}`;
  const BACK = (v = null) => ({ label: '◀ Back', color: '#98a4b3', value: v, wide: true });
  async function pickAction() {
    const me = B.active(BT.b, BT.ME), foe = B.active(BT.b, BT.FOE), wild = BT.kind === 'wild', items = G.save.items;
    while (true) {
      guard(); ui.battleMsg(`What will <b>${me.name}</b> do?`);
      const top = await choose([
        { label: '⚔ FIGHT', sub: 'pick a move', color: '#ff7a4c', value: 'fight' },
        { label: '🔄 SWAP', sub: 'switch Frostling', color: '#4f8fe0', value: 'swap', disabled: BT.b.sides[BT.ME].team.filter(c => c.hp > 0).length < 2 },
        ...(BT.duel ? [{ label: '🏳 FORFEIT', sub: 'end the duel', color: '#98a4b3', value: 'ff', wide: true }] : [
          { label: '⭕ SNARE', sub: wild ? 'tame it!' : 'can\'t tame a tamer\'s pal', color: '#9a5cf0', value: 'snare', disabled: !wild },
          { label: '🎒 BAG', sub: 'potions & berries', color: '#3fae78', value: 'bag' },
          { label: '🏃 RUN', sub: wild ? 'flee to the overworld' : 'can\'t flee a tamer!', color: '#8a96a8', value: 'run', disabled: !wild, wide: true }]),
      ]);
      if (top === 'fight') {
        const mv = await choose([...me.moves.map(id => { const m = MOVES[id]; return { label: `${TYPES[m.type].icon} ${m.name}`, sub: m.pow ? `${TYPES[m.type].name} · ${m.pow} pow · ${m.acc}%` : m.desc, color: TYPES[m.type].dark, tag: effTag(m, foe), value: id }; }), BACK()]);
        if (mv) return { kind: 'move', move: mv };
      } else if (top === 'swap') {
        const team = BT.b.sides[BT.ME].team;
        const idx = await choose([...team.map((c, i) => ({ label: `${c.name} Lv${c.lv}`, sub: `${tb(c.type)} · ${Math.ceil(c.hp)}/${c.maxHp} HP`, color: TYPES[c.type].dark, disabled: c.hp <= 0 || i === BT.b.sides[BT.ME].active, value: i })), BACK(-1)]);
        if (idx >= 0) return { kind: 'swap', idx };
      } else if (top === 'snare') {
        const snares = ['snare', 'frostsnare', 'aurorasnare'].filter(k => items[k] > 0);
        const k = await choose([...snares.map(k => ({ label: `${ITEMS[k].icon} ${ITEMS[k].name} ×${items[k]}`, sub: `catch chance ~${Math.round(B.catchChance(foe, ITEMS[k].mult, BT.berries) * 100)}%`, color: '#7a3fd0', value: k })),
          ...(snares.length ? [] : [{ label: 'No snares!', sub: 'buy some at the Snow Shop', color: '#98a4b3', disabled: true, value: null }]), BACK()]);
        if (k) return { kind: 'snare', item: k };
      } else if (top === 'bag') {
        const opts = [];
        if (wild && items.berry > 0) opts.push({ label: `🫐 Toss a Frostberry ×${items.berry}`, sub: `+catch chance (${BT.berries}/3 fed)`, color: '#4a6bd8', value: { kind: 'berry' }, disabled: BT.berries >= 3 });
        for (const k of ['potion', 'superpotion']) if (items[k] > 0) opts.push({ label: `${ITEMS[k].icon} ${ITEMS[k].name} ×${items[k]}`, sub: ITEMS[k].desc, color: '#2a9a68', value: { kind: 'heal', item: k } });
        if (!opts.length) opts.push({ label: 'Bag is empty', sub: 'visit the Snow Shop', color: '#98a4b3', disabled: true, value: null });
        const it = await choose([...opts, BACK()]);
        if (it?.kind === 'berry') return it;
        if (it?.kind === 'heal') {
          const team = BT.b.sides[BT.ME].team;
          const idx = await choose([...team.map((c, i) => ({ label: `${c.name}`, sub: `${Math.ceil(c.hp)}/${c.maxHp} HP${c.status ? ' · ' + c.status.id : ''}`, color: '#2a9a68', disabled: c.hp <= 0 || (c.hp >= c.maxHp && !c.status), value: i })), BACK(-1)]);
          if (idx >= 0) return { kind: 'heal', item: it.item, idx };
        }
      } else if (top === 'run') return { kind: 'run' };
      else if (top === 'ff') return { kind: 'ff' };
    }
  }
  async function forcedSwap() {
    const team = BT.b.sides[BT.ME].team;
    ui.battleMsg('Choose your next Frostling!');
    const idx = await choose(team.map((c, i) => ({ label: `${c.name} Lv${c.lv}`, sub: `${tb(c.type)} · ${Math.ceil(c.hp)}/${c.maxHp} HP`, color: TYPES[c.type].dark, disabled: c.hp <= 0, value: i })));
    BT.b.sides[BT.ME].active = idx; BT.b.sides[BT.ME].participants.add(idx); await sendOut(BT.ME);
  }

  // ----- catching -----
  async function throwSnare(item) {
    G.save.items[item]--; const foe = B.active(BT.b, BT.FOE), fm = BT.models[BT.FOE];
    const p = B.catchChance(foe, ITEMS[item].mult, BT.berries), shakes = B.rollCatch(p);
    ui.battleMsg(`You threw a <b>${ITEMS[item].name}</b>!`); audio.sfx('sfx_snare_throw');
    const sn = BT.snare = buildSnare(item); scene.add(sn);
    const from = stage.myTamer.clone().setY(2), to = fm.position.clone().setY(1.2);
    await tween(0.6, (k) => { sn.position.copy(from).lerp(to, k); sn.position.y += Math.sin(k * Math.PI) * 3; sn.rotation.set(k * 12, k * 6, 0); }); guard();
    burst(to.x, to.y, to.z, 40, '#ffffff', 5, 0, 0.6); const s0 = fm.userData.s0;
    await tween(0.3, (k) => { fm.scale.setScalar(Math.max(0.01, s0 * (1 - k))); }); fm.visible = false;
    const ground = to.clone().setY(0.45);
    await tween(0.3, (k) => { sn.position.lerpVectors(to, ground, k); sn.rotation.set(Math.PI / 2, 0, 0); }); guard();
    for (let i = 0; i < 3; i++) {
      await wait(420); guard();
      if (i >= shakes) break;
      audio.sfx('sfx_snare_shake', i); ui.battleMsg(['…', '… …', '… … …'][i]);
      await tween(0.35, (k) => { sn.rotation.z = Math.sin(k * Math.PI * 3) * 0.6; });
    }
    guard();
    if (shakes >= 3) {
      audio.sfx('sfx_catch_success'); burst(ground.x, 1, ground.z, 70, '#ffd24a', 6, 3, 1.3); burst(ground.x, 1, ground.z, 40, TYPES[foe.type].color, 5, 3, 1.2);
      G.fx.shake = 0.2; await wait(600); return true;
    }
    audio.sfx('sfx_catch_fail'); scene.remove(sn); BT.snare = null; fm.visible = true; burst(to.x, to.y, to.z, 40, '#bfe6ff', 6, 6, 0.8);
    await tween(0.25, (k) => fm.scale.setScalar(Math.max(0.01, s0 * k)));
    await say(['Oh no! It broke free!', 'Argh! Almost had it!', 'So close!!'][Math.min(2, shakes)], 900);
    return false;
  }

  // ----- XP / level ups / learning / evolution -----
  async function awardXp(fainted) {
    if (BT.duel) return;
    const xp = B.xpYield(fainted, BT.kind !== 'wild'), team = BT.b.sides[BT.ME].team, part = BT.b.sides[BT.ME].participants;
    for (let i = 0; i < team.length; i++) {
      const c = team[i]; if (c.hp <= 0 || !c.mon || c.mon.lv >= C.LEVEL_CAP) continue;
      const amt = part.has(i) ? xp : Math.round(xp * 0.5);
      c.mon.hp = c.hp; const evs = B.addXp(c.mon, amt);
      if (i === BT.b.sides[BT.ME].active) { cards(); await say(`<b>${c.name}</b> gained ${amt} XP!`, 700); }
      for (const ev of evs) {
        const st = B.statsOf(c.mon); Object.assign(c, { lv: c.mon.lv, maxHp: st.hp, atk: st.atk, def: st.def, spd: st.spd, hp: c.mon.hp });
        audio.sfx('sfx_level_up'); cards();
        if (i === BT.b.sides[BT.ME].active && BT.models[BT.ME]) { const p = BT.models[BT.ME].position; burst(p.x, 1, p.z, 50, '#ffd24a', 5, -3, 1.2); }
        await new Promise(res => ui.cine(`<div class="cc fl-card"><div style="font-size:13px;letter-spacing:3px;font-weight:900;color:#e07a10">LEVEL UP!</div><img src="${portraits[c.sp]}"><h2>${c.name} → Lv ${ev.lv}</h2>
          <div style="font-weight:800;font-size:14px">HP +${ev.gain.hp} · ATK +${ev.gain.atk} · DEF +${ev.gain.def} · SPD +${ev.gain.spd}</div>
          ${ev.learned.map(m => `<div style="margin-top:6px;font-weight:900">✨ Learned <span style="color:${TYPES[MOVES[m].type].dark}">${MOVES[m].name}</span>!</div>`).join('')}
          <button class="fl-big" data-ok style="margin-top:10px">Nice!</button></div>`, 0, res)); guard();
        c.moves = [...c.mon.moves];
        for (const nmv of ev.pending) await learnPrompt(c, nmv);
      }
    }
  }
  async function learnPrompt(c, moveId) {
    const mv = MOVES[moveId];
    ui.battleMsg(`<b>${c.name}</b> wants to learn <b style="color:${TYPES[mv.type].dark}">${mv.name}</b>! Forget a move?`);
    const forget = await choose([...c.mon.moves.map(id => ({ label: `Forget ${MOVES[id].name}`, sub: `${TYPES[MOVES[id].type].name} · ${MOVES[id].pow || '—'} pow`, color: TYPES[MOVES[id].type].dark, value: id })),
      { label: `Keep old moves`, sub: `skip ${mv.name} (${mv.pow || '—'} pow, ${TYPES[mv.type].name})`, color: '#98a4b3', value: null, wide: true }]);
    if (forget) { c.mon.moves[c.mon.moves.indexOf(forget)] = moveId; c.moves = [...c.mon.moves]; audio.sfx('sfx_level_up'); await say(`1, 2, and… poof! <b>${c.name}</b> forgot ${MOVES[forget].name} and learned <b>${mv.name}</b>!`, 1300); }
  }
  async function evolveSequence(mon) {
    const from = SP[mon.sp], to = SP[from.evolveTo];
    const team = BT.b.sides[BT.ME].team, idx = team.findIndex(c => c.mon === mon);
    BT.b.sides[BT.ME].active = idx; const c = team[idx];
    if (BT.models[BT.FOE]) BT.models[BT.FOE].visible = false;
    let m = battleModel(c, BT.ME); cards();
    ui.clearOptions(); ui.battleMsg(`What? <b>${from.name}</b> is evolving!`); audio.music_(null); audio.sfx('sfx_evolve');
    BT.camFocus = 1; const s0 = m.userData.s0, mat = m.userData.bodyMat;
    await tween(3.0, (k) => { const f = Math.sin(k * k * 60); m.scale.setScalar(s0 * (1 + f * 0.14 * k)); mat.emissive.setRGB(k, k, k); mat.emissiveIntensity = k * 1.6; if (Math.random() < 0.6) burst(m.position.x + rand(-2, 2), rand(0, 3), m.position.z + rand(-2, 2), 2, '#ffffff', 1, -2, 0.8); });
    guard(); ui.flash(); G.fx.shake = 0.4;
    const res = B.evolve(mon);
    Object.assign(c, B.combatant(mon, BT.ME), { hp: mon.hp });
    m = battleModel(c, BT.ME); burst(m.position.x, 1.5, m.position.z, 90, TYPES[to.type].color, 8, 3, 1.4); burst(m.position.x, 1.5, m.position.z, 50, '#ffffff', 6, 3, 1.2);
    cards(); G.save.stats.evolved++; G.questEvent('evolve');
    const wasNew = G.setDex(to.id, 2) < 2;
    if (wasNew) setTimeout(() => G.alive && audio.sfx('sfx_frostdex_new'), 700);
    await new Promise(r => ui.cine(`<div class="cc fl-card"><div style="font-size:13px;letter-spacing:3px;font-weight:900;color:#a43b9a">EVOLUTION!</div><img src="${portraits[to.id]}"><h2>${from.name} evolved into ${to.name}!</h2>${typeBadge(to.type)}
      ${res.learned.map(mv => `<div style="margin-top:6px;font-weight:900">✨ Learned ${MOVES[mv].name}!</div>`).join('')}${wasNew ? '<div style="margin-top:6px;font-weight:900;color:#e07a10">📖 New Frostdex entry!</div>' : ''}
      <button class="fl-big" data-ok style="margin-top:10px">Amazing!</button></div>`, 0, r));
    BT.camFocus = 0; G.checkMilestones();
  }

  // ----- entry points -----
  const partyCombatants = () => G.partyMons().map(m => B.combatant(m, 0));
  function canFight() { if (G.partyMons().some(m => m.hp > 0)) return true; ui.toast('😴 Your Frostlings are worn out — rest them at the 🏠 Care Den!'); return false; }
  function battleErr(e) {
    if (e instanceof Gone) return; console.error('frostlings battle', e);
    if (BT && G.alive && BT.ret) leaveStage().catch(() => {});
    else if (G.alive) { G.mode = 'world'; ui.battleShow(false); }
  }
  function startWild(w) {
    if (G.mode !== 'world') return;
    if (!canFight()) { w.cool = 4; return; }
    runBattle({ kind: 'wild', area: w.area, foeTeam: [B.combatant(B.makeMon(w.id, w.lv), 1)], wildRef: w }).catch(battleErr);
  }
  function startTamer(id) {
    const T = TAMERS[id]; if (G.mode !== 'world' || !canFight()) return;
    const re = G.save.beaten.includes(id);
    const team = T.team.map(([sp, lv]) => B.combatant(B.makeMon(sp, re ? Math.min(C.LEVEL_CAP, lv + 2) : lv), 1));
    runBattle({ kind: 'tamer', area: T.area, foeTeam: team, tamer: T, rematch: re }).catch(battleErr);
  }
  function startRing() {
    if (G.mode !== 'world' || !canFight()) return;
    const pm = G.partyMons(), avg = Math.round(pm.reduce((a, m) => a + m.lv, 0) / pm.length);
    const pool = [...new Set(C.AREA_ORDER.filter(G.unlocked).flatMap(a => AREAS[a].pool.map(([id]) => id)).filter(id => SP[id].rarity !== 'legendary'))];
    const team = Array.from({ length: 3 }, (_, i) => B.combatant(B.makeMon(pick(pool), Math.max(2, Math.min(C.LEVEL_CAP, avg + (i === 2 ? 1 : 0)))), 1));
    runBattle({ kind: 'ring', area: 'ring', foeTeam: team, tamer: { id: 'champ', name: 'Ring Champ Juno', title: 'Battle Ring Champion', color: '#ff5d8a', hat: '#3fa8ff', quote: 'Three on three, no hard feelings — give it everything!', flakes: 40 + avg * 5 } }).catch(battleErr);
  }

  async function runBattle(o) {
    if (G.mode !== 'world') return;
    const mine = o.duel ? o.myTeam : partyCombatants();
    const ME = o.duel ? o.meSide : 0, FOE = 1 - ME;
    const teams = []; teams[ME] = mine; teams[FOE] = o.foeTeam;
    BT = { kind: o.kind, duel: !!o.duel, ME, FOE, b: B.newBattle(teams, { kind: o.kind, seed: o.seed ?? ((Math.random() * 2 ** 31) | 0) }), models: [null, null], recoil: [0, 0], berries: 0, foeName: o.tamer?.name || o.foeName || 'Foe', area: o.area, camT: 0 };
    if (!o.duel) BT.b.rng = Math.random;
    await enterStage(o.kind, o.area, o.tamer ? o.tamer : o.duel ? { color: '#3fa8ff', hat: '#ffd24a' } : null);
    if (o.tamer) { ui.bossIntro(o.tamer, 2300); await wait(2400); guard(); }
    else if (o.duel) { ui.bossIntro({ name: o.foeName, title: 'Friendly Duel', color: '#3fa8ff', quote: 'Good luck, have fun!' }, 2000); await wait(2100); guard(); }
    await sendOut(FOE, true); await sendOut(ME, true);
    let outcome = null;
    while (!outcome) {
      guard();
      const act = await pickAction(); guard();
      let log;
      const foeTurn = (myAct) => { const a = []; a[ME] = myAct; a[FOE] = B.aiChoose(BT.b, FOE); return a; };
      if (BT.duel) {
        if (act.kind === 'ff') { G.sendNet({ k: 'duel', t: 'ff', id: duel?.id }); outcome = 'lose'; break; }
        const foeAct = await duelExchange(act); guard();
        if (foeAct === 'ff') { await say(`<b>${BT.foeName}</b> left the duel!`, 1100); outcome = 'win'; break; }
        const acts = []; acts[ME] = act.kind === 'swap' ? { kind: 'swap', idx: act.idx } : act; acts[FOE] = foeAct; log = B.resolveTurn(BT.b, acts);
      } else if (act.kind === 'run') {
        const me = B.active(BT.b, ME), foe = B.active(BT.b, FOE);
        if (Math.random() < 0.6 + 0.4 * Math.min(1, me.spd / foe.spd)) { await say('Got away safely!', 800); outcome = 'flee'; break; }
        await say(`Couldn't get away!`, 700); log = B.resolveTurn(BT.b, foeTurn({ kind: 'pass' }));
      } else if (act.kind === 'snare') {
        if (await throwSnare(act.item)) { outcome = 'caught'; break; }
        log = B.resolveTurn(BT.b, foeTurn({ kind: 'pass' }));
      } else if (act.kind === 'berry') {
        G.save.items.berry--; BT.berries++; audio.sfx('sfx_care'); const p = BT.models[FOE].position; burst(p.x, 1.5, p.z, 24, '#ff7ad9', 3, -2, 1);
        await say(`You tossed a Frostberry! Wild <b>${B.active(BT.b, FOE).name}</b> munches happily… 💗 (easier to tame)`, 1200);
        log = B.resolveTurn(BT.b, foeTurn({ kind: 'pass' }));
      } else if (act.kind === 'heal') {
        G.save.items[act.item]--; const c = BT.b.sides[ME].team[act.idx], it = ITEMS[act.item];
        c.hp = Math.min(c.maxHp, c.hp + Math.round(c.maxHp * it.heal)); if (it.heal >= 1) c.status = null;
        audio.sfx('sfx_heal'); if (act.idx === BT.b.sides[ME].active) { const p = BT.models[ME].position; burst(p.x, 1, p.z, 30, '#5be37d', 3, -3, 1); }
        cards(); await say(`<b>${c.name}</b> sipped ${it.name}! ☕`, 900);
        log = B.resolveTurn(BT.b, foeTurn({ kind: 'pass' }));
      } else log = B.resolveTurn(BT.b, foeTurn(act));
      await playLog(log); guard();
      const foeC = B.active(BT.b, FOE);
      if (foeC.hp <= 0) {
        if (!BT.duel) await awardXp(foeC);
        const nxt = B.nextAlive(BT.b, FOE);
        if (nxt < 0) { outcome = 'win'; break; }
        BT.b.sides[FOE].active = nxt; await sendOut(FOE);
      }
      if (B.active(BT.b, ME).hp <= 0) {
        const nxt = B.nextAlive(BT.b, ME);
        if (nxt < 0) { outcome = 'lose'; break; }
        if (BT.duel) { BT.b.sides[ME].active = nxt; await sendOut(ME); } else await forcedSwap();
      }
      BT.b.over = false;
    }
    await finishBattle(o, outcome);
  }

  async function finishBattle(o, outcome) {
    guard(); ui.clearOptions(); const s = G.save;
    if (!BT.duel) for (const c of BT.b.sides[BT.ME].team) if (c.mon) { c.mon.hp = Math.max(0, Math.round(c.hp)); c.mon.status = null; }
    const foe = B.active(BT.b, BT.FOE);
    if (outcome === 'win') {
      audio.music_(null); audio.sfx('sfx_victory');
      let flakes = 0;
      if (o.kind === 'wild') { flakes = 6 + foe.lv * 2; s.stats.wins++; s.stats.areaWins[o.area] = (s.stats.areaWins[o.area] || 0) + 1; G.questEvent('winArea', { area: o.area }); G.addRankXp(8 + foe.lv); }
      else if (o.kind === 'tamer') {
        const T = o.tamer, first = !s.beaten.includes(T.id); flakes = first ? T.flakes : Math.round(T.flakes / 3); s.stats.wins++;
        if (first) { s.beaten.push(T.id); G.addRankXp(80 + C.TAMER_ORDER.indexOf(T.id) * 60); G.notifyReady(); } else G.addRankXp(20);
      } else if (o.kind === 'ring') { flakes = o.tamer.flakes; s.stats.ring++; s.stats.wins++; G.questEvent('ring'); G.addRankXp(30); }
      else if (o.kind === 'duel') { flakes = 30; s.stats.ring++; G.questEvent('ring'); G.addRankXp(25); }
      s.flakes += flakes;
      ui.banner('🏆 VICTORY!', flakes ? `+${flakes} ❄ flakes` : '', 2000);
      const p = stage.myTamer; for (let i = 0; i < 4; i++) setTimeout(() => G.alive && burst(p.x + rand(-3, 3), 3, p.z + rand(-3, 3), 30, ['#ffd24a', '#5be37d', '#ff7ad9', '#3fa8ff'][i], 7, 5, 1.2), i * 180);
      if (o.kind === 'tamer') await say(`<b>${o.tamer.name}</b>: "${o.rematch ? 'You keep getting stronger!' : 'Wow… you and your Frostlings are a real team!'}"`, 2000);
      else await say(`You won! ${flakes ? `+${flakes} ❄` : ''}`, 1300);
      if (o.kind === 'tamer' && !o.rematch) {
        const nextArea = C.AREA_ORDER.find(a => AREAS[a].unlock === o.tamer.id);
        if (nextArea) { world.openGate(nextArea); await say(`🧊 The ice gate to <b>${AREAS[nextArea].name}</b> is melting!`, 1800); }
        else await say(`🌈 The aurora shines brighter… <b>legendary Frostlings</b> may now appear on Aurora Peak!`, 2200);
      }
      for (const c of BT.b.sides[BT.ME].team) if (c.mon && B.canEvolve(c.mon)) await evolveSequence(c.mon);
    } else if (outcome === 'lose') {
      audio.music_(null); audio.sfx('sfx_defeat');
      if (o.kind === 'duel') await say('You lost the duel — good game!', 1500);
      else { await say('Your Frostlings are all tuckered out… back to the Care Den to rest!', 2000); BT.ret.toDen = true; for (const m of G.partyMons()) { m.hp = B.statsOf(m).hp; m.status = null; } }
    } else if (outcome === 'caught') {
      const sp = SP[foe.sp], mon = G.addMon(foe.sp, foe.lv); mon.hp = Math.max(1, Math.round(foe.hp));
      s.stats.caught++; if (sp.rarity === 'legendary') { s.stats.legends++; G.questEvent('legend'); }
      G.questEvent('catch'); G.questEvent('catchType', { type: sp.type }); G.questEvent('catchSpecies', { species: sp.id });
      if (sp.type === 'aurora' && C.isAurora(G.dayPhase())) G.questEvent('catchAurora');
      G.addRankXp(12 + foe.lv + (sp.rarity === 'rare' ? 20 : sp.rarity === 'legendary' ? 80 : 0));
      const wasNew = G.setDex(sp.id, 2) < 2;
      audio.music_(null); if (wasNew) setTimeout(() => G.alive && audio.sfx('sfx_frostdex_new'), 900);
      await new Promise(r => ui.cine(`<div class="cc fl-card"><div style="font-size:13px;letter-spacing:3px;font-weight:900;color:#2a9a68">TAMED!</div><img src="${portraits[sp.id]}"><h2>Gotcha! ${sp.name} joined you!</h2>
        ${typeBadge(sp.type)} <span class="fl-rar" style="background:${C.RARITY[sp.rarity].color}">${C.RARITY[sp.rarity].name}</span> · Lv ${foe.lv}
        <div style="margin-top:6px;font-size:13px;font-weight:700;opacity:.8">${sp.blurb}</div>
        ${wasNew ? `<div style="margin-top:6px;font-weight:900;color:#e07a10">📖 New Frostdex entry! (${C.dexCount(s)}/${C.SPECIES.length})</div>` : ''}
        <div style="margin-top:4px;font-size:12px">${s.party.includes(mon.uid) ? 'Added to your party!' : 'Sent to the Care Den (party is full).'}</div>
        <button class="fl-big" data-ok style="margin-top:10px">Yay!</button></div>`, 0, r));
    }
    if (o.wildRef) { if (outcome === 'flee') o.wildRef.cool = 5; else if (!o.wildRef.fake) G.removeWild(o.wildRef); }
    G.checkMilestones(); G.notifyReady(); G.refreshNpcTags();
    if (BT.duel) duel = null;
    await leaveStage();
  }

  // ----- PvP duel: canonical sides A=challenger(0) B=accepter(1), shared seed, each turn's actions exchanged -----
  let duel = null, pendingReq = null;
  const duelTeam = () => G.partyMons().slice(0, 3).map(m => ({ sp: m.sp, lv: m.lv, moves: m.moves.slice(0, 4), bond: m.bond || 0 }));
  const validTeam = (t) => Array.isArray(t) && t.length >= 1 && t.length <= 3 && t.every(m => SP[m?.sp] && m.lv >= 1 && m.lv <= C.LEVEL_CAP && Array.isArray(m.moves) && m.moves.length && m.moves.length <= 4 && m.moves.every(x => MOVES[x]));
  const toCombatants = (t, side) => t.map(m => { const mon = { sp: m.sp, lv: m.lv | 0, moves: m.moves.slice(0, 4), bond: Math.max(0, Math.min(40, m.bond | 0)), xp: 0, hat: null, status: null }; mon.hp = B.statsOf(mon).hp; const c = B.combatant(mon, side); c.mon = null; return c; });
  const myName = () => G.economy.profile.displayName || G.economy.profile.username || 'Tamer';
  function requestDuel(id, name) {
    if (!G.partyMons().length) return;
    pendingReq = { id: Math.random().toString(36).slice(2, 9), to: String(id), name };
    G.sendNet({ k: 'duel', t: 'req', id: pendingReq.id, to: pendingReq.to, team: duelTeam(), name: myName() });
    ui.toast(`⚔ Challenge sent to <b>${name}</b>…`);
  }
  function onDuelMsg(from, p) {
    if (p.t === 'req' && String(p.to) === G.localId()) {
      if (G.mode !== 'world' || ui.modalOpen || !validTeam(p.team)) { G.sendNet({ k: 'duel', t: 'no', id: p.id, to: from }); return; }
      audio.sfx('sfx_tamer_intro');
      G.panels.duelInvite(String(p.name || from).slice(0, 20), (yes) => {
        if (!yes || G.mode !== 'world') { G.sendNet({ k: 'duel', t: 'no', id: p.id, to: from }); return; }
        const seed = (Math.random() * 2 ** 31) | 0, myTeam = duelTeam();
        G.sendNet({ k: 'duel', t: 'acc', id: p.id, to: from, team: myTeam, seed });
        startDuel({ id: p.id, foe: from, foeName: String(p.name || from).slice(0, 20), meSide: 1, seed, teamA: p.team, teamB: myTeam });
      });
    } else if (p.t === 'acc' && pendingReq && p.id === pendingReq.id && String(p.to) === G.localId() && validTeam(p.team)) {
      const r = pendingReq; pendingReq = null;
      startDuel({ id: r.id, foe: from, foeName: r.name, meSide: 0, seed: p.seed | 0, teamA: duelTeam(), teamB: p.team });
    } else if (p.t === 'no' && pendingReq && p.id === pendingReq.id) { pendingReq = null; ui.toast('⚔ Challenge declined.'); }
    else if (duel && p.id === duel.id && from === duel.foe) {
      if (p.t === 'act' && typeof p.turn === 'number') duel.acts[p.turn] = p.a;
      else if (p.t === 'ff') duel.acts[duel.turn] = 'ff';
      duel.wake?.();
    }
  }
  function startDuel(d) {
    if (G.mode !== 'world') return; ui.closeModal();
    duel = { ...d, turn: 0, acts: {}, wake: null };
    const A = toCombatants(d.teamA, 0), Bt = toCombatants(d.teamB, 1);
    runBattle({ kind: 'duel', duel: true, meSide: d.meSide, myTeam: d.meSide === 0 ? A : Bt, foeTeam: d.meSide === 0 ? Bt : A, seed: d.seed, foeName: d.foeName, area: 'ring' }).catch(battleErr);
  }
  async function duelExchange(act) {
    const turn = duel.turn, a = act.kind === 'swap' ? { kind: 'swap', idx: act.idx | 0 } : { kind: 'move', move: act.move };
    G.sendNet({ k: 'duel', t: 'act', id: duel.id, turn, a });
    ui.battleMsg(`Waiting for <b>${BT.foeName}</b>…`);
    const t0 = performance.now(); let lastSend = t0;
    while (!(turn in duel.acts)) {
      guard(); await new Promise(r => { duel.wake = r; setTimeout(r, 500); }); guard();
      const el = performance.now() - t0;
      if (el > 60000 || (G.has('players') && !G.mp.players().some(p => String(p.id) === duel.foe))) duel.acts[turn] = 'ff';
      if (performance.now() - lastSend > 4000) { lastSend = performance.now(); G.sendNet({ k: 'duel', t: 'act', id: duel.id, turn, a }); }   // resend (packet loss)
    }
    const f = duel.acts[turn]; duel.turn++;
    if (f === 'ff') return 'ff';
    const foeSide = BT.b.sides[BT.FOE];
    if (f?.kind === 'swap' && foeSide.team[f.idx]?.hp > 0) return { kind: 'swap', idx: f.idx | 0 };
    if (f?.kind === 'move' && B.active(BT.b, BT.FOE).moves.includes(f.move)) return { kind: 'move', move: f.move };
    return { kind: 'move', move: B.active(BT.b, BT.FOE).moves[0] };
  }

  // ----- per-frame (battle mode) -----
  function update(dt0, dt, t, ph, auroraK, nightK) {
    if (!BT) return;
    const A = AREAS[BT.area] || AREAS.village;
    world.update(dt0, t, ph, auroraK, nightK * (BT.area === 'caverns' ? 0.4 : 1), A.x, A.z, stage.center.x, stage.center.z);
    BT.camT += dt0;
    camTmp.copy(stage.cam).add(v3.set(Math.sin(BT.camT * 0.25) * 1.2, Math.sin(BT.camT * 0.4) * 0.3, 0));
    if (BT.camFocus) { camTmp.lerp(v3.copy(stage.myPos).add(new THREE.Vector3(-4.5, 3, 5.5)), 0.75); cam.position.copy(camTmp); cam.lookAt(stage.myPos.x, 1.4, stage.myPos.z); }
    else { cam.position.copy(camTmp); cam.lookAt(stage.look); }
    BT.models.forEach((m, i) => { if (m && m.visible) { animFrostling(m, t, 0, dt); if (BT.recoil[i] > 0) { BT.recoil[i] -= dt; m.position.x = m.userData.home.x + Math.sin(BT.recoil[i] * 60) * 0.14; } } });
    if (BT.foeTamer) BT.foeTamer.userData.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 2 + i) * 0.15; });
    if (BT.snare) BT.snare.userData.core.rotation.y += dt * 3;
  }
  return { startWild, startTamer, startRing, requestDuel, onDuelMsg, update, get current() { return BT; } };
}
