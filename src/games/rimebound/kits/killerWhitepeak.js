// Mrs. Whitepeak — killer
export default {
  id: 'killer-whitepeak', name: 'Mrs. Whitepeak', role: 'killer',
  lore: 'Resort concierge; check-in mandatory, check-out never offered.',
  skin: 'skin_killer-whitepeak_default',
  passive: { id: 'ConciergeSmile', name: 'ConciergeSmile', desc: '+20% terror radius; hidden while still',
    apply: (ctx) => ctx.fx?.ConciergeSmile?.() },
  actives: [
    { id: 'Whiteout', key: 'Q', cooldown: 18, name: 'Whiteout', desc: '6s storm; survivor vision cut',
      canUse: (ctx) => !ctx.onCd('Whiteout'),
      use: (ctx) => { ctx.fx.Whiteout(); ctx.setCd('Whiteout', 18); return true; }, tick: null },
    { id: 'CheckIn', key: 'E', cooldown: 10, name: 'CheckIn', desc: 'Bell snare roots 1.5s',
      canUse: (ctx) => !ctx.onCd('CheckIn'),
      use: (ctx) => { ctx.fx.CheckIn(); ctx.setCd('CheckIn', 10); return true; }, tick: null },
  ],
};
