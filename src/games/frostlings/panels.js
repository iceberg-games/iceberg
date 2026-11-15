// Frostlings modal panels: Care Den, Snow Shop, Quest Board, Frostdex, Party, Bag, Battle Ring, Elder tips,
// starter pick, duel invite. Panels re-render on open/action (never per frame).
import { typeBadge } from './ui.js';

export function createPanels(o) {
  const { ui, C, B, portraits, audio } = o;
  const { SPECIES_BY_ID: SP, MOVES, TYPES, ITEMS, HATS, AREAS } = C;
  const S = () => o.save;
  const hearts = (pts) => { const l = B.bondLevel(pts); return '💗'.repeat(l) + '🤍'.repeat(5 - l); };
  const rar = (r) => `<span class="fl-rar" style="background:${C.RARITY[r].color}">${C.RARITY[r].name}</span>`;
  const bar = (v, max, col) => `<div class="fl-bar" style="height:7px;margin:2px 0 4px"><i style="width:${Math.min(100, v / max * 100)}%;background:${col}"></i></div>`;
  const bind = (root, sel, fn) => root.querySelectorAll(sel).forEach(el => el.addEventListener('click', (e) => { e.stopPropagation(); audio.sfx('ui_click'); fn(el, e); }));
  const PET_CD = 90 * 1000;

  // ---------- mon detail (shared by Care Den + Party) ----------
  function monDetail(m, inDen) {
    const sp = SP[m.sp], st = B.statsOf(m), s = S(), inParty = s.party.includes(m.uid), lead = s.party[0] === m.uid;
    const petLeft = Math.max(0, PET_CD - (Date.now() - (s.petAt[m.uid] || 0)));
    const evo = sp.evolveTo ? `Evolves into <b>${SP[sp.evolveTo].name}</b> at Lv ${sp.evolveAt}` : 'Final form';
    const nextBond = C.BOND_LEVELS[B.bondLevel(m.bond) + 1];
    return `<div style="display:flex;gap:14px;flex-wrap:wrap">
      <div style="text-align:center;min-width:150px"><img src="${portraits[m.sp]}" style="width:140px;height:140px"><div style="font-weight:900;font-size:18px">${sp.name} <span style="opacity:.6">Lv${m.lv}</span></div>${typeBadge(sp.type)} ${rar(sp.rarity)}
        <div style="margin-top:4px;font-size:16px" title="bond">${hearts(m.bond)}</div><div style="font-size:11px;opacity:.7">Bond ${B.bondLevel(m.bond)}/5 · +${B.bondLevel(m.bond) * 3}% stats${nextBond ? ` · ${nextBond - m.bond} pts to next` : ''}</div></div>
      <div style="flex:1;min-width:220px;font-size:12px;font-weight:800">
        HP ${Math.ceil(m.hp)}/${st.hp}${bar(m.hp, st.hp, m.hp / st.hp > 0.5 ? '#5be37d' : '#ffc44a')}
        ATK ${st.atk} · DEF ${st.def} · SPD ${st.spd}${bar(m.lv >= C.LEVEL_CAP ? 1 : m.xp, m.lv >= C.LEVEL_CAP ? 1 : B.xpToNext(m.lv), '#6cb8ff')}
        <div style="opacity:.7;margin-bottom:6px">${m.lv >= C.LEVEL_CAP ? 'Max level!' : `${B.xpToNext(m.lv) - m.xp} XP to Lv ${m.lv + 1}`} · ${evo}</div>
        ${m.moves.map(id => { const mv = MOVES[id]; return `<div style="display:flex;justify-content:space-between;background:${TYPES[mv.type].color}33;border-left:5px solid ${TYPES[mv.type].dark};border-radius:8px;padding:4px 8px;margin:3px 0"><span>${TYPES[mv.type].icon} ${mv.name}</span><span style="opacity:.75">${mv.pow ? mv.pow + ' pow · ' + mv.acc + '%' : mv.desc}</span></div>`; }).join('')}
        <div class="fl-row" style="margin-top:8px">
          ${inDen ? `<button class="fl-big blue" data-a="lead" ${lead ? 'disabled' : ''}>⭐ Make lead</button>
          <button class="fl-big gray" data-a="party">${inParty ? '➖ Leave party' : '➕ Join party'}</button>
          <button class="fl-big" data-a="feed" ${(s.items.berry || 0) <= 0 ? 'disabled' : ''}>🫐 Feed (${s.items.berry || 0})</button>
          <button class="fl-big" data-a="pet" ${petLeft > 0 ? 'disabled' : ''}>🤚 Pet${petLeft > 0 ? ` (${Math.ceil(petLeft / 1000)}s)` : ''}</button>` :
          `<button class="fl-big blue" data-a="lead" ${lead || !inParty ? 'disabled' : ''}>⭐ Make lead</button>`}
        </div>
        ${inDen ? `<div style="margin-top:8px">Hat: <span class="fl-row" style="display:inline-flex">${['', ...s.hats].map(h => `<button class="fl-big ${m.hat === (h || null) ? 'blue' : 'gray'}" style="padding:6px 10px;min-height:36px" data-hat="${h}">${h ? HATS[h].icon + ' ' + HATS[h].name : 'None'}</button>`).join('')}</span>${s.hats.length ? '' : ' <span style="opacity:.6">(buy hats at the Snow Shop)</span>'}</div>` : ''}
      </div></div>
      <div style="font-size:12px;opacity:.75;margin-top:6px">${sp.blurb}</div>`;
  }
  function monsView(inDen) {
    let sel = S().party[0] ?? S().mons[0]?.uid;
    const render = () => {
      const s = S(), mons = inDen ? [...s.mons].sort((a, b) => (s.party.includes(b.uid) - s.party.includes(a.uid)) || b.lv - a.lv) : o.partyMons();
      const m = o.monBy(sel) || mons[0];
      const panel = ui.modal(`<h2>${inDen ? '🏠 Frostling Care Den' : '🐾 Your Party'}</h2><div class="sub">${inDen ? 'Rest, feed, pet and dress up your Frostlings. Pick your party of 3 (the ⭐ lead follows you around).' : 'Your active team. Manage the party at the 🏠 Care Den in the village.'}</div>
        ${inDen ? '<div class="fl-row" style="margin-bottom:10px"><button class="fl-big blue" data-rest>💤 Rest everyone (full heal)</button></div>' : ''}
        <div class="fl-grid" style="grid-template-columns:repeat(auto-fill,minmax(110px,1fr))">${mons.map(x => `<div class="fl-tile${x.uid === m?.uid ? ' sel' : ''}" data-m="${x.uid}" style="cursor:pointer"><img src="${portraits[x.sp]}" style="width:72px;height:72px"><div>${SP[x.sp].name}</div><div style="opacity:.7">Lv${x.lv} ${s.party[0] === x.uid ? '⭐' : s.party.includes(x.uid) ? '🎒' : ''}${x.hat ? HATS[x.hat]?.icon || '' : ''}</div>${bar(x.hp, B.statsOf(x).hp, x.hp > 0 ? '#5be37d' : '#ff5d5d')}</div>`).join('')}</div>
        <div style="margin-top:12px">${m ? monDetail(m, inDen) : 'No Frostlings yet!'}</div>`);
      bind(panel, '[data-m]', (el) => { sel = +el.dataset.m; render(); });
      bind(panel, '[data-rest]', () => { for (const x of s.mons) { x.hp = B.statsOf(x).hp; x.status = null; } audio.sfx('sfx_heal'); o.onRest(); ui.toast('💤 Everyone is cozy and fully rested!'); render(); });
      bind(panel, '[data-a]', (el) => {
        const a = el.dataset.a; if (!m) return;
        if (a === 'lead') { s.party = [m.uid, ...s.party.filter(u => u !== m.uid)].slice(0, C.PARTY_MAX); o.refreshCompanion(); }
        else if (a === 'party') {
          if (s.party.includes(m.uid)) { if (s.party.length <= 1) { ui.toast('You need at least one Frostling in your party!'); return; } s.party = s.party.filter(u => u !== m.uid); }
          else { if (s.party.length >= C.PARTY_MAX) { ui.toast(`Party is full (${C.PARTY_MAX}). Remove one first.`); return; } s.party.push(m.uid); }
          o.refreshCompanion();
        } else if (a === 'feed') { if ((s.items.berry || 0) <= 0) return; s.items.berry--; m.bond = (m.bond || 0) + 2; audio.sfx('sfx_care'); ui.toast(`🫐 ${SP[m.sp].name} loved that! ${hearts(m.bond)}`); o.questEvent('bond'); o.checkMilestones(); }
        else if (a === 'pet') { s.petAt[m.uid] = Date.now(); m.bond = (m.bond || 0) + 1; audio.sfx('sfx_care'); ui.toast(`🤚 ${SP[m.sp].name} wiggles happily! ${hearts(m.bond)}`); o.questEvent('bond'); }
        o.commit(); render();
      });
      bind(panel, '[data-hat]', (el) => { m.hat = el.dataset.hat || null; o.refreshCompanion(); o.commit(); render(); });
    };
    render();
  }

  // ---------- shop ----------
  function shop() {
    let tab = 'items';
    const render = () => {
      const s = S();
      const row = (k, it, owned) => `<div class="it"><div><b>${it.icon} ${it.name}</b> ${owned != null ? `<span style="opacity:.6">×${owned}</span>` : ''}<div style="opacity:.75;font-size:12px">${it.desc || 'A cute hat for your Frostling.'}</div></div>
        <div class="fl-row">${s.rank < it.rank ? `<span style="font-weight:900;opacity:.7">🔒 Rank ${it.rank}</span>` : tab === 'items' ? `<button class="fl-big" data-buy="${k}" data-n="1" ${s.flakes < it.price ? 'disabled' : ''}>${it.price} ❄</button><button class="fl-big gray" data-buy="${k}" data-n="5" ${s.flakes < it.price * 5 ? 'disabled' : ''}>×5 · ${it.price * 5}</button>` :
          s.hats.includes(k) ? '<b style="color:#2a9a68">Owned ✓</b>' : `<button class="fl-big" data-hatbuy="${k}" ${s.flakes < it.price ? 'disabled' : ''}>${it.price} ❄</button>`}</div></div>`;
      const panel = ui.modal(`<h2>🛒 Snow Shop</h2><div class="sub">You have <b>${s.flakes} ❄ flakes</b> · Tamer Rank ${s.rank} (higher ranks unlock better stock)</div>
        <div class="fl-tabs"><button class="${tab === 'items' ? 'on' : ''}" data-tab="items">Snares & Items</button><button class="${tab === 'hats' ? 'on' : ''}" data-tab="hats">Hats</button></div>
        <div class="fl-list">${tab === 'items' ? Object.entries(ITEMS).map(([k, it]) => row(k, it, s.items[k] || 0)).join('') : Object.entries(HATS).map(([k, it]) => row(k, it, null)).join('')}</div>`);
      bind(panel, '[data-tab]', (el) => { tab = el.dataset.tab; render(); });
      bind(panel, '[data-buy]', (el) => { const k = el.dataset.buy, n = +el.dataset.n, cost = ITEMS[k].price * n; if (s.flakes < cost) return; s.flakes -= cost; s.items[k] = (s.items[k] || 0) + n; audio.sfx('sfx_care'); ui.toast(`Bought ${n} ${ITEMS[k].icon} ${ITEMS[k].name}`); o.commit(); render(); });
      bind(panel, '[data-hatbuy]', (el) => { const k = el.dataset.hatbuy; if (s.flakes < HATS[k].price || s.hats.includes(k)) return; s.flakes -= HATS[k].price; s.hats.push(k); audio.sfx('sfx_care'); ui.toast(`Bought ${HATS[k].icon} ${HATS[k].name}! Equip it at the Care Den.`); o.commit(); render(); });
    };
    render();
  }

  // ---------- quests ----------
  function quests(atBoard) {
    const render = () => {
      const s = S(), act = o.activeQuests(), done = s.questDone.length, total = C.QUESTS.length;
      const panel = ui.modal(`<h2>📜 Quest Board</h2><div class="sub">${done}/${total} quests complete · ${atBoard ? 'turn in finished quests for flakes, items and rank XP.' : 'Turn in finished quests at the 📜 board in the village.'}</div>
        <div class="fl-list">${act.map(q => { const st = o.questState(q); const r = q.reward; return `<div class="it" style="${st.ready ? 'border-color:#5be37d' : ''}"><div style="flex:1"><b>${q.name}</b><div style="font-size:12px;opacity:.8">${q.desc}</div>${bar(st.have, st.n, st.ready ? '#5be37d' : '#6cb8ff')}<div style="font-size:11px;opacity:.7">${Math.min(st.have, st.n)}/${st.n} · Reward: ${r.flakes} ❄ ${Object.entries(r.items || {}).map(([k, v]) => `${v}× ${ITEMS[k].icon}`).join(' ')} · ${r.rankXp} rank XP</div></div>
          ${atBoard ? `<button class="fl-big" data-q="${q.id}" ${st.ready ? '' : 'disabled'}>${st.ready ? 'Turn in!' : 'In progress'}</button>` : st.ready ? '<b style="color:#2a9a68">Ready ✓</b>' : ''}</div>`; }).join('') || '<div class="it">All quests complete — you are a true Frostling Master! 🏆</div>'}</div>
        ${C.QUESTS.length - done - act.length > 0 ? `<div style="font-size:12px;opacity:.65;margin-top:6px">${C.QUESTS.length - done - act.length} more quests will appear as you finish these.</div>` : ''}`);
      bind(panel, '[data-q]', (el) => { const q = C.QUESTS.find(x => x.id === el.dataset.q); o.turnIn(q); render(); });
    };
    render();
  }

  // ---------- Frostdex ----------
  function dex() {
    let sel = null;
    const render = () => {
      const s = S(), n = C.dexCount(s), seen = Object.keys(s.dex).length;
      const tile = (sp) => { const v = s.dex[sp.id] || 0; return `<div class="fl-tile ${v === 2 ? '' : v === 1 ? 'sil' : 'unk'}${sel === sp.id ? ' sel' : ''}" data-d="${sp.id}" style="cursor:${v ? 'pointer' : 'default'}"><span class="no">#${String(sp.no).padStart(2, '0')}</span><img src="${portraits[sp.id]}"><div>${v ? sp.name : '???'}</div>${v === 2 ? typeBadge(sp.type) : v === 1 ? '<span style="opacity:.6">seen</span>' : ''}</div>`; };
      const d = sel && SP[sel], v = d ? s.dex[sel] : 0;
      const where = d ? Object.values(AREAS).filter(a => a.pool?.some(([id]) => id === d.id)).map(a => a.name).join(', ') || 'Evolution only' : '';
      const panel = ui.modal(`<h2>📖 Frostdex</h2><div class="sub">Tamed <b>${n}/${C.SPECIES.length}</b> (${Math.round(n / C.SPECIES.length * 100)}%) · Seen ${seen}</div>
        ${bar(n, C.SPECIES.length, 'linear-gradient(90deg,#8fd8ff,#ff7ad9)')}
        <div style="font-size:12px;margin:4px 0 10px">${C.MILESTONES.filter(m => m.id.startsWith('dex') || m.id === 'legend').map(m => `<span style="margin-right:10px;${s.milestones.includes(m.id) ? 'color:#2a9a68' : 'opacity:.6'}">${s.milestones.includes(m.id) ? '✅' : '⬜'} ${m.label} (+${m.bb} BB)</span>`).join('')}</div>
        ${d && v ? `<div class="card" style="padding:10px;margin-bottom:10px;display:flex;gap:12px;flex-wrap:wrap;background:#fff"><img src="${portraits[d.id]}" style="width:120px;height:120px;${v === 1 ? 'filter:brightness(0) opacity(.35)' : ''}"><div style="flex:1;min-width:220px;font-size:13px;font-weight:700">
          <div style="font-size:20px;font-weight:900">#${String(d.no).padStart(2, '0')} ${d.name}</div>${v === 2 ? `${typeBadge(d.type)} ${rar(d.rarity)}` : '<i>Tame one to learn more!</i>'}
          ${v === 2 ? `<div style="margin-top:4px">${d.blurb}</div><div style="opacity:.75;margin-top:4px">📍 ${where}${d.night ? ' · 🌙 night only' : d.day ? ' · ☀ day only' : d.aurora ? ' · 🌌 aurora only' : ''}</div>
          <div style="opacity:.75">${d.evolveTo ? `Evolves into ${SP[d.evolveTo].name} at Lv ${d.evolveAt}` : ''}</div>
          ${['hp', 'atk', 'def', 'spd'].map(k => `<div style="display:flex;gap:6px;align-items:center;font-size:11px"><span style="width:28px">${k.toUpperCase()}</span><div style="flex:1">${bar(d.base[k], 120, TYPES[d.type].color)}</div><span>${d.base[k]}</span></div>`).join('')}` : `<div style="opacity:.75;margin-top:4px">📍 ${where}</div>`}</div></div>` : ''}
        <div class="fl-grid" style="grid-template-columns:repeat(auto-fill,minmax(112px,1fr))">${C.SPECIES.map(tile).join('')}</div>
        <div style="margin-top:10px;font-size:12px;opacity:.75"><b>Type chart:</b> ${Object.entries(C.CHART.SE).map(([a, ds]) => `${TYPES[a].icon} beats ${ds.map(x => TYPES[x].icon).join('')}`).join(' · ')}</div>`);
      bind(panel, '[data-d]', (el) => { if (!S().dex[el.dataset.d]) return; sel = el.dataset.d; render(); });
    };
    render();
  }

  // ---------- bag ----------
  function bag() {
    let target = null;
    const render = () => {
      const s = S();
      const panel = ui.modal(`<h2>🎒 Bag</h2><div class="sub">${s.flakes} ❄ flakes · Snares tame wild Frostlings; weaken them first! Berries in battle make taming easier.</div>
        <div class="fl-list">${Object.entries(ITEMS).map(([k, it]) => `<div class="it"><div><b>${it.icon} ${it.name}</b> <span style="opacity:.6">×${s.items[k] || 0}</span><div style="opacity:.75;font-size:12px">${it.desc}</div></div>${it.kind === 'heal' && s.items[k] > 0 ? `<button class="fl-big blue" data-use="${k}">Use</button>` : ''}</div>`).join('')}</div>
        ${target ? `<div style="margin-top:8px;font-weight:900">Use ${ITEMS[target].name} on:</div><div class="fl-row">${o.partyMons().map(m => `<button class="fl-big gray" data-on="${m.uid}" ${m.hp >= B.statsOf(m).hp ? 'disabled' : ''}>${SP[m.sp].name} ${Math.ceil(m.hp)}/${B.statsOf(m).hp}</button>`).join('')}</div>` : ''}`);
      bind(panel, '[data-use]', (el) => { target = el.dataset.use; render(); });
      bind(panel, '[data-on]', (el) => { const m = o.monBy(+el.dataset.on); if (!m || !(s.items[target] > 0)) return; s.items[target]--; o.heal(m, ITEMS[target].heal); audio.sfx('sfx_heal'); ui.toast(`☕ ${SP[m.sp].name} feels better!`); target = null; o.commit(); render(); });
    };
    render();
  }

  // ---------- battle ring ----------
  function ring() {
    const near = o.nearbyPlayers();
    const panel = ui.modal(`<h2>⚔ Battle Ring</h2><div class="sub">3-on-3 battles. Win to earn flakes and rank XP (counts toward the Ring Rookie quest).</div>
      <div class="fl-list"><div class="it"><div><b>Ring Champ Juno</b><div style="font-size:12px;opacity:.75">Random team scaled to your party's level. Rematch anytime!</div></div><button class="fl-big" data-champ>Challenge</button></div></div>
      <div style="font-weight:900;margin-top:10px">Friendly duels with tamers nearby</div>
      <div class="fl-list">${near.length ? near.map(p => `<div class="it"><b>👤 ${String(p.name || p.id).replace(/[<>&"]/g, '')}</b><button class="fl-big blue" data-p="${String(p.id).replace(/"/g, '')}" data-n="${String(p.name || p.id).replace(/[<>&"]/g, '')}">⚔ Duel</button></div>`).join('') : '<div class="it" style="opacity:.7">No other tamers nearby — bring a friend to the Ring for a friendly duel!</div>'}</div>`);
    bind(panel, '[data-champ]', () => { ui.closeModal(); o.challengeRing(); });
    bind(panel, '[data-p]', (el) => { ui.closeModal(); o.challengePlayer(el.dataset.p, el.dataset.n); });
  }

  // ---------- elder tips ----------
  function elder() {
    const s = S(), next = C.TAMER_ORDER.find(t => !s.beaten.includes(t)), T = next && C.TAMERS[next];
    const tips = [
      T ? `Your next challenge: <b>${T.name}</b> in <b>${AREAS[T.area].name}</b>. Beat them to melt the next ice gate!` : 'You have beaten every tamer! Look for legendary Frostlings on Aurora Peak during the aurora.',
      'Weaken a wild Frostling before throwing a snare. Chilled, sleeping or burned ones are easier to tame!',
      'Toss Frostberries in battle (up to 3) to make a wild one trust you.',
      'Some Frostlings only come out at night 🌙, a few only while the aurora 🌌 dances in the sky.',
      `Type tips: ${Object.entries(C.CHART.SE).map(([a, ds]) => `${TYPES[a].icon}→${ds.map(x => TYPES[x].icon).join('')}`).join('  ')}`,
      'Pet and feed your Frostlings at the Care Den. Higher bond = stronger stats (and more critical hits at Bond 5)!',
    ];
    let i = 0;
    const render = () => { const p = ui.modal(`<h2>💬 Elder Pine</h2><div style="font-size:16px;font-weight:700;margin:10px 0 14px;min-height:48px">${tips[i]}</div><div class="fl-row"><button class="fl-big blue" data-next>More tips ▶</button><button class="fl-big gray" data-close2>Thanks!</button></div>`);
      bind(p, '[data-next]', () => { i = (i + 1) % tips.length; render(); }); bind(p, '[data-close2]', () => ui.closeModal()); };
    render();
  }

  // ---------- starter ----------
  function starter(cb) {
    const pickIt = (id) => { if (!C.STARTERS.includes(id)) return; ui.closeModal(); cb(id); };
    o._starterPick = pickIt; api._starterPick = pickIt;
    const panel = ui.modal(`<h2>❄ Welcome to Snowdrift Village!</h2><div class="sub">Elder Pine: "Every tamer starts with a partner. Choose wisely — they'll be your best friend!"</div>
      <div class="fl-grid" style="grid-template-columns:repeat(3,1fr)">${C.STARTERS.map(id => { const sp = SP[id]; return `<div class="fl-tile" style="padding:12px"><img src="${portraits[id]}" style="width:120px;height:120px"><div style="font-size:18px;font-weight:900">${sp.name}</div>${typeBadge(sp.type)}<div style="font-size:12px;margin:6px 0;opacity:.8">${sp.blurb}</div><div style="font-size:11px;opacity:.7">Strong vs ${C.CHART.SE[sp.type].map(t => TYPES[t].icon + ' ' + TYPES[t].name).join(', ')}</div><button class="fl-big" style="margin-top:8px;width:100%" data-st="${id}">Choose ${sp.name}</button></div>`; }).join('')}</div>`, { closable: false });
    bind(panel, '[data-st]', (el) => pickIt(el.dataset.st));
  }
  function duelInvite(name, cb) {
    let done = false; const fin = (y) => { if (done) return; done = true; ui.closeModal(); cb(y); };
    const panel = ui.modal(`<h2>⚔ Duel challenge!</h2><div style="font-size:17px;font-weight:800;margin:10px 0">${name.replace(/[<>&"]/g, '')} wants a friendly 3-on-3 duel. (No XP, full HP, just for fun!)</div><div class="fl-row"><button class="fl-big" data-y>Accept!</button><button class="fl-big gray" data-n>No thanks</button></div>`, { closable: false });
    bind(panel, '[data-y]', () => fin(true)); bind(panel, '[data-n]', () => fin(false));
    setTimeout(() => fin(false), 20000);
  }
  const api = {
    open(id) {
      if (id === 'den') monsView(true); else if (id === 'party') monsView(false); else if (id === 'shop') shop();
      else if (id === 'quests') quests(o.atBoard?.() ?? true); else if (id === 'dex') dex(); else if (id === 'bag') bag(); else if (id === 'ring') ring();
    },
    elder, starter, duelInvite, _starterPick: null,
  };
  return api;
}
