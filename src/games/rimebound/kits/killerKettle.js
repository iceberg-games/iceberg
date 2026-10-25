// Kettle — killer
export default {
  id: 'killer-kettle', name: 'Kettle', role: 'killer',
  lore: 'Miner who kept a silent canary; cold-blue lantern; the gas below is his.',
  skin: 'skin_killer-kettle_default',
  passive: { id: 'CanaryEar', name: 'CanaryEar', desc: 'Noise within 30 studs pings location',
    apply: (ctx) => ctx.fx?.CanaryEar?.() },
  actives: [
    { id: 'LanternSweep', key: 'Q', cooldown: 12, name: 'LanternSweep', desc: 'Reveal survivors in 40° cone 3s',
      canUse: (ctx) => !ctx.onCd('LanternSweep'),
      use: (ctx) => { ctx.fx.LanternSweep(); ctx.setCd('LanternSweep', 12); return true; }, tick: null },
    { id: 'GasVent', key: 'E', cooldown: 14, name: 'GasVent', desc: 'Vent cloud slows 30% for 4s',
      canUse: (ctx) => !ctx.onCd('GasVent'),
      use: (ctx) => { ctx.fx.GasVent(); ctx.setCd('GasVent', 14); return true; }, tick: null },
  ],
};
