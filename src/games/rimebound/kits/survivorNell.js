// Nell Okafor — survivor
export default {
  id: 'survivor-nell',
  name: 'Nell Okafor',
  role: 'survivor',
  lore: 'Expedition medic who walked into the mines after the rescue team; hands stay warm.',
  skin: 'skin_survivor-nell_default',
  passive: { id: 'WarmHands', name: 'WarmHands', desc: '+40% revive speed', apply: (ctx) => ctx?.applyPassive?.('WarmHands', ctx) },
  actives: [
    { id: 'ThawKit', key: 'Q', cooldown: 35, name: 'ThawKit', desc: 'Cleanse slow/freeze on self+ally in 6 studs', canUse: (ctx) => !ctx?.onCd?.('ThawKit'), use: (ctx) => { ctx?.fx?.( 'ThawKit', ctx); ctx?.audio?.( 'sfx_nell_thawkit'); ctx?.setCd?.( 'ThawKit', 35); return true; }, tick: null }
  ],
};
