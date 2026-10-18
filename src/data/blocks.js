// Build palette. `look` drives the material; add new block types here.
export const BLOCK_TYPES = [
  { id: 'snow',     name: 'Snow',        color: '#f7fbff', roughness: 0.95 },
  { id: 'ice',      name: 'Clear Ice',   color: '#bfe9ff', roughness: 0.05, opacity: 0.6, transparent: true },
  { id: 'packed',   name: 'Packed Ice',  color: '#7cc4ec', roughness: 0.2 },
  { id: 'glacier',  name: 'Glacier',     color: '#3f8fd0', roughness: 0.25 },
  { id: 'frost',    name: 'Frost Brick', color: '#dfeefa', roughness: 0.6 },
  { id: 'stone',    name: 'Stone',       color: '#8a96a3', roughness: 0.9 },
  { id: 'wood',     name: 'Pine Wood',   color: '#9a6b43', roughness: 0.8 },
  { id: 'red',      name: 'Berry Red',   color: '#e2474b', roughness: 0.6 },
  { id: 'yellow',   name: 'Sun Yellow',  color: '#f5c542', roughness: 0.6 },
  { id: 'green',    name: 'Pine Green',  color: '#2f8f5b', roughness: 0.7 },
  { id: 'purple',   name: 'Aurora',      color: '#8b6cf0', roughness: 0.4, emissive: '#2a1a66' },
  { id: 'black',    name: 'Obsidian',    color: '#22262e', roughness: 0.3 },
];
export const BLOCK_BY_ID = Object.fromEntries(BLOCK_TYPES.map(b => [b.id, b]));
