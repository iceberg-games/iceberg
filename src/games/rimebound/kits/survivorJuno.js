// Juno Vale — survivor
export default {
  id: 'survivor-juno',
  name: 'Juno Vale',
  role: 'survivor',
  lore: 'Ridge courier between resort and shipyard; knows every ledge in the ice.',
  skin: 'skin_survivor-juno_default',
  passive: { id: 'RidgeRunner', name: 'RidgeRunner', desc: '+30% sprint stamina, faster regen', apply: (ctx) => ctx?.applyPassive?.('RidgeRunner', ctx) },
  actives: [
    { id: 'IceGrapple', key: 'Q', cooldown: 22, name: 'IceGrapple', desc: '18-stud grapple to ledge', canUse: (ctx) => !ctx?.onCd?.('IceGrapple'), use: (ctx) => { ctx?.fx?.( 'IceGrapple', ctx); ctx?.audio?.( 'sfx_juno_grapple'); ctx?.setCd?.( 'IceGrapple', 22); return true; }, tick: null },
    { id: 'Slide', key: 'E', cooldown: 12, name: 'Slide', desc: 'Low-profile dash under obstacles', canUse: (ctx) => !ctx?.onCd?.('Slide'), use: (ctx) => { ctx?.fx?.( 'Slide', ctx); ctx?.audio?.( 'sfx_juno_slide'); ctx?.setCd?.( 'Slide', 12); return true; }, tick: null }
  ],
};
