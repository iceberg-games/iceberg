// Juno Vale — survivor
export default {
  id: 'survivor-juno', name: 'Juno Vale', role: 'survivor',
  lore: 'Ridge courier between resort and shipyard; knows every ledge in the ice.',
  skin: 'skin_survivor-juno_default',
  passive: { id: 'RidgeRunner', name: 'RidgeRunner', desc: '+30% sprint stamina, faster regen',
    apply: (ctx) => ctx.fx?.RidgeRunner?.() },
  actives: [
    { id: 'IceGrapple', key: 'Q', cooldown: 10, name: 'IceGrapple', desc: '18-stud grapple to ledge',
      canUse: (ctx) => !ctx.onCd('IceGrapple'),
      use: (ctx) => { ctx.fx.IceGrapple(); ctx.setCd('IceGrapple', 10); return true; }, tick: null },
    { id: 'Slide', key: 'E', cooldown: 6, name: 'Slide', desc: 'Low-profile dash under obstacles',
      canUse: (ctx) => !ctx.onCd('Slide'),
      use: (ctx) => { ctx.fx.Slide(); ctx.setCd('Slide', 6); return true; }, tick: null },
  ],
};
