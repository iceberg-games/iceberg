// Pip Harlow — survivor
export default {
  id: 'survivor-pip', name: 'Pip Harlow', role: 'survivor',
  lore: 'Apprentice core-tender of the drowned shipyard; spark-flint from the last warm furnace.',
  skin: 'skin_survivor-pip_default',
  passive: { id: 'CoreSpark', name: 'CoreSpark', desc: '+25% thaw-core repair speed',
    apply: (ctx) => ctx.fx?.CoreSpark?.() },
  actives: [{
    id: 'FlareBlind', key: 'Q', cooldown: 12, name: 'FlareBlind',
    desc: 'Flare blinds killer 2s in cone',
    canUse: (ctx) => !ctx.onCd('FlareBlind'),
    use: (ctx) => { if (!ctx.canUse?.() && ctx.onCd('FlareBlind')) return false; ctx.fx.FlareBlind(); ctx.setCd('FlareBlind', 12); return true; },
    tick: null,
  }],
};
