// Map screen (N, brief §10): a stylised SVG of the current area — chambers, lit posts, chests, levers, the gate,
// the boss skull and party dots — or a village overview. North (−Z) is up.
const svgEsc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** shapes: [{c:[x,z],r}|{rect:[x0,z0,x1,z1]}]; marks: [{x,z,icon,label,cls}]; dots: [{x,z,me,name,down}] */
export function mapSVG({ shapes, marks = [], dots = [], gate = null, theme = {} }) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const s of shapes) { const b = s.c ? [s.c[0] - s.r, s.c[1] - s.r, s.c[0] + s.r, s.c[1] + s.r] : s.rect; x0 = Math.min(x0, b[0]); z0 = Math.min(z0, b[1]); x1 = Math.max(x1, b[2]); z1 = Math.max(z1, b[3]); }
  const pad = 5; x0 -= pad; z0 -= pad; x1 += pad; z1 += pad;
  const W = x1 - x0, H = z1 - z0, X = (x) => (x - x0).toFixed(1), Z = (z) => (z - z0).toFixed(1);
  const fill = theme.fill || '#2a2450', edge = theme.edge || '#8a7aff';
  const room = shapes.map(s => s.c ? `<circle cx="${X(s.c[0])}" cy="${Z(s.c[1])}" r="${s.r}"/>` : `<rect x="${X(s.rect[0])}" y="${Z(s.rect[1])}" width="${s.rect[2] - s.rect[0]}" height="${s.rect[3] - s.rect[1]}" rx="1"/>`).join('');
  const g = gate ? `<line x1="${X(gate.x0)}" y1="${Z((gate.z0 + gate.z1) / 2)}" x2="${X(gate.x1)}" y2="${Z((gate.z0 + gate.z1) / 2)}" stroke="${gate.closed ? '#ff5a5a' : '#5aff9a'}" stroke-width="1.2" stroke-dasharray="${gate.closed ? '0' : '1 1'}"/>` : '';
  const m = marks.map(k => `<g transform="translate(${X(k.x)} ${Z(k.z)})" class="${k.cls || ''}"><text font-size="${k.size || 4.2}" text-anchor="middle" dominant-baseline="central">${k.icon}</text>${k.label ? `<text y="${(k.size || 4.2) * 0.95}" font-size="2.3" fill="#ffe2b8" text-anchor="middle" dominant-baseline="hanging" font-weight="700">${svgEsc(k.label)}</text>` : ''}</g>`).join('');
  const d = dots.map(p => `<g transform="translate(${X(p.x)} ${Z(p.z)})"><circle r="${p.me ? 1.7 : 1.4}" fill="${p.down ? '#ff5a5a' : p.me ? '#ffd27a' : '#7ad0ff'}" stroke="#1a1030" stroke-width="0.5"/>${p.me ? `<circle r="3.2" fill="none" stroke="#ffd27a" stroke-width="0.4" opacity="0.7"><animate attributeName="r" values="2;4;2" dur="1.6s" repeatCount="indefinite"/></circle>` : ''}${p.name && !p.me ? `<text y="-2.6" font-size="2.2" fill="#cfe8ff" text-anchor="middle" font-weight="700">${svgEsc(p.name)}</text>` : ''}</g>`).join('');
  return `<svg class="lh-map" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" preserveAspectRatio="xMidYMid meet"><defs><filter id="lhglow"><feGaussianBlur stdDeviation="0.8"/></filter></defs>
    <g fill="${edge}" opacity="0.55" filter="url(#lhglow)">${room}</g><g fill="${fill}" stroke="none">${room}</g>${g}${m}${d}</svg>`;
}
