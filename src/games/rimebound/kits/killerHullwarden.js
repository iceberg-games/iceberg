// Hullwarden — killer
export default {
  id: 'killer-hullwarden', name: 'Hullwarden', role: 'killer',
  lore: 'Shipyard iron watchman welded into hull-plate; drags the last mooring chain.',
  skin: 'skin_killer-hullwarden_default',
  passive: { id: 'IronHull', name: 'IronHull', desc: '25% stun/blind reduction',
    apply: (ctx) => ctx.fx?.IronHull?.() },
  actives: [
    { id: 'RimeHook', key: 'Q', cooldown: 10, name: 'RimeHook', desc: 'Chain pull 20 studs',
      canUse: (ctx) => !ctx.onCd('RimeHook'),
      use: (ctx) => { ctx.fx.RimeHook(); ctx.setCd('RimeHook', 10); return true; }, tick: null },
    { id: 'ShatterSwing', key: 'R', cooldown: 8, name: 'ShatterSwing', desc: 'Empowered M1; breaks pallets/ice',
      canUse: (ctx) => !ctx.onCd('ShatterSwing'),
      use: (ctx) => { ctx.fx.ShatterSwing(); ctx.setCd('ShatterSwing', 8); return true; }, tick: null },
  ],
};
