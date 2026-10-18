export const CURRENCY = { name: 'Birg Bucks', short: 'BB', icon: '🧊' };
export const fmt = (n) => `${Math.floor(n).toLocaleString('en-US')} ${CURRENCY.short}`;
