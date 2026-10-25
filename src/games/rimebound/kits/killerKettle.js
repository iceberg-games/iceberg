// Kettle — killer
export default {
  id: 'killer-kettle',
  name: 'Kettle',
  role: 'killer',
  lore: 'Miner who kept a silent canary; cold-blue lantern; the gas below is his.',
  skin: 'skin_killer-kettle_default',
  passive: { id: 'CanaryEar', name: 'CanaryEar', desc: 'Noise within 30 studs pings location', apply: (ctx) => ctx?.applyPassive?.('CanaryEar', ctx) },
  actives: [
    { id: 'LanternSweep', key: 'Q', cooldown: 25, name: 'LanternSweep', desc: 'Reveal survivors in 40° cone 3s', canUse: (ctx) => !ctx?.onCd?.('LanternSweep'), use: (ctx) => { ctx?.fx?.( 'LanternSweep', ctx); ctx?.audio?.( 'sfx_kettle_lantern'); ctx?.setCd?.( 'LanternSweep', 25); return true; }, tick: null },
    { id: 'GasVent', key: 'E', cooldown: 30, name: 'GasVent', desc: 'Vent cloud slows 30% for 4s', canUse: (ctx) => !ctx?.onCd?.('GasVent'), use: (ctx) => { ctx?.fx?.( 'GasVent', ctx); ctx?.audio?.( 'sfx_kettle_gasvent'); ctx?.setCd?.( 'GasVent', 30); return true; }, tick: null }
  ],
};
