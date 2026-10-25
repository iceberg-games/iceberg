// Pip Harlow — survivor
export default {
  id: 'survivor-pip',
  name: 'Pip Harlow',
  role: 'survivor',
  lore: 'Apprentice core-tender of the drowned shipyard; spark-flint from the last warm furnace.',
  skin: 'skin_survivor-pip_default',
  passive: { id: 'CoreSpark', name: 'CoreSpark', desc: '+25% thaw-core repair speed', apply: (ctx) => ctx?.applyPassive?.('CoreSpark', ctx) },
  actives: [
    { id: 'FlareBlind', key: 'Q', cooldown: 30, name: 'FlareBlind', desc: 'Flare blinds killer 2s in cone', canUse: (ctx) => !ctx?.onCd?.('FlareBlind'), use: (ctx) => { ctx?.fx?.( 'FlareBlind', ctx); ctx?.audio?.( 'sfx_pip_flare'); ctx?.setCd?.( 'FlareBlind', 30); return true; }, tick: null }
  ],
};
