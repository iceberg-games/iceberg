// Game 2: "Midnight at Maple Mall" - explore / scavenger-hunt adventure in a shopping mall after hours.
// Built only from Studio features: parts, coins, checkpoints, a gear giver, rigs (NPC hints),
// moving platforms (service elevator), doors, variables + conditions, timer, leaderboard, win.
import { createDoc, A, R, IF, program, script, CONT } from './lib.mjs';

export const meta = {
  slug: 'midnight-at-maple-mall',
  id: 'g_midnight_at_maple_mall',
  name: 'Midnight at Maple Mall',
  description: 'You fell asleep in the beanbag aisle and the mall locked up for the night! Explore the Toy Kingdom, Pet Paradise, Arcade, Cinema and Food Court, find 6 security keycards, hunt 20 lost coins and 3 secret golden ducks, then unlock the Loading Dock and escape before morning. An after-hours adventure by gooberr478.',
  tagline: 'Adventure · Scavenger hunt',
};

const FLOOR = 0.3, MEZ = FLOOR + 17 * 0.576, ROOF = 22.5;
const C = { lav: '#cdbfe0', lavD: '#9f8bc4', cream: '#e9e2d3', tile: '#cfc5b0', navy: '#1d2a4d', pink: '#ff6fb5', cyan: '#4dd2ff', yellow: '#ffd34d', green: '#3ddc84', red: '#e2474b', orange: '#ff8c2a', purple: '#8b6cf0', wood: '#9a6b43', steel: '#8a96a3', white: '#f4f6f8', dark: '#22262e' };

export function build() {
  const d = createDoc({ id: meta.id, name: meta.name, description: meta.description, sky: 'night', ground: 'baseplate', music: 'winter', snow: false });
  /** box by bounds */
  const B = (name, x0, x1, y0, y1, z0, z1, color, o = {}) => d.box(name, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], [Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)], color, o);
  const lights = []; const glowNames = (n) => { lights.push(n); return n; };

  // ============================== SHELL ==============================
  d.slab('Outside Ground', -140, 140, -110, 120, 0.2, 0.2, '#2d333b');
  d.slab('Parking Lot', -100, 100, -100, -52, 0.25, 0.25, '#3a3f47');
  for (let i = -8; i <= 8; i++) B('Parking Line', i * 10 - 0.2, i * 10 + 0.2, 0.25, 0.3, -90, -78, '#e8e8ea', { collide: false });
  for (const [x, c] of [[-45, '#e2474b'], [-25, '#3f8fd0'], [35, '#ffd34d'], [55, '#2f9e6a']]) d.group('Parked Car', () => { d.box('Car Body', [x, 1.3, -84], [3.6, 1.6, 8], c); d.box('Car Cabin', [x, 2.7, -84.4], [3.2, 1.3, 4.6], c); d.box('Car Glass', [x, 2.75, -84.4], [3.3, 1.0, 4.8], '#bfe9ff', { material: 'glass', collide: false }); });
  d.slab('Mall Floor', -70.5, 70.5, -50.5, 68.5, FLOOR, 0.3, C.cream);
  // concourse runner + atrium rose + foyer carpet
  B('Runner EW', -70, 70, FLOOR, FLOOR + 0.03, -5, 5, C.tile, { collide: false });
  B('Runner NS', -5, 5, FLOOR, FLOOR + 0.03, -50, 68, C.tile, { collide: false });
  d.cyl('Atrium Rose', [0, FLOOR + 0.03, 0], [30, 0.06, 30], '#d9cdb3', { collide: false });
  d.cyl('Atrium Rose Inner', [0, FLOOR + 0.05, 0], [22, 0.06, 22], '#cbbfa6', { collide: false });
  B('Foyer Carpet', -14, 14, FLOOR, FLOOR + 0.04, -46, -20, '#7a3a55', { collide: false });
  // perimeter walls (lavender with neon trim)
  B('South Wall W', -71, -6, 0, 16, -51, -50, C.lav); B('South Wall E', 6, 71, 0, 16, -51, -50, C.lav);
  B('South Wall Top', -6, 6, 9, 16, -51, -50, C.lav);
  B('North Wall W', -71, -4, 0, 16, 68, 69, C.lav); B('North Wall E', 4, 71, 0, 16, 68, 69, C.lav); B('North Wall Top', -4, 4, 9, 16, 68, 69, C.lav);
  B('West Wall', -71, -70, 0, 16, -51, 69, C.lav); B('East Wall', 70, 71, 0, 16, -51, 69, C.lav);
  B('Trim South', -70, 70, 9, 9.5, -50, -49.6, C.pink, { material: 'neon', collide: false });
  B('Trim North', -70, 70, 9, 9.5, 67.6, 68, C.cyan, { material: 'neon', collide: false });
  B('Trim West', -70, -69.6, 9, 9.5, -50, 68, C.purple, { material: 'neon', collide: false });
  B('Trim East', 69.6, 70, 9, 9.5, -50, 68, C.purple, { material: 'neon', collide: false });
  for (const [n, p, s] of [['Edge S', [0, 15, -108], [280, 30, 2]], ['Edge W', [-138, 15, 5], [2, 30, 230]], ['Edge E', [138, 15, 5], [2, 30, 230]], ['Edge N', [0, 15, 118], [280, 30, 2]]]) d.box(n, p, s, '#ffffff', { transparency: 1 });
  // main entrance doors (locked)
  d.group('Main Doors', () => {
    B('Door Frame', -6, 6, 0, 9, -50.6, -49.9, C.steel);
    B('Door Glass L', -5.4, -0.2, 0.3, 8.4, -50.4, -50.2, '#bfe9ff', { material: 'glass' });
    B('Door Glass R', 0.2, 5.4, 0.3, 8.4, -50.4, -50.2, '#bfe9ff', { material: 'glass' });
    B('Door Lock Bar', -5.6, 5.6, 4, 4.5, -49.9, -49.7, C.red, { material: 'neon', collide: false });
    B('Closed Sign', -1.6, 1.6, 6.2, 7.6, -49.7, -49.6, C.red, { material: 'neon', collide: false });
  });

  // ============================== ATRIUM ==============================
  d.group('Fountain', () => {
    d.cyl('Fountain Basin', [0, FLOOR + 0.6, 0], [15, 1.2, 15], '#b9b2c4');
    d.cyl('Fountain Water', [0, FLOOR + 1.0, 0], [13.4, 0.5, 13.4], '#4aa8e0', { material: 'glass', collide: false });
    d.cyl('Fountain Pillar', [0, FLOOR + 3.2, 0], [2.2, 5.4, 2.2], '#cfc6dc');
    d.cyl('Fountain Bowl', [0, FLOOR + 5.9, 0], [6, 0.8, 6], '#b9b2c4');
    d.ball('Fountain Jewel', [0, FLOOR + 7.2, 0], 2.2, C.cyan, { material: 'neon', collide: false });
    d.cyl('Fountain Spray', [0, FLOOR + 7.0, 0], [0.5, 4, 0.5], '#e9f8ff', { material: 'glass', collide: false });
  });
  lights.push('Fountain Jewel');
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; d.group('Atrium Bench', () => { const x = Math.cos(a) * 11.5, z = Math.sin(a) * 11.5; d.box('Bench Seat', [x, FLOOR + 1.1, z], [3.6, 0.4, 1.3], C.wood, { rot: [0, -(a * 180 / Math.PI) + 90, 0] }); d.box('Bench Legs', [x, FLOOR + 0.5, z], [3.2, 0.9, 0.5], C.dark, { rot: [0, -(a * 180 / Math.PI) + 90, 0], collide: false }); }); }
  for (const [x, z] of [[-18, -12], [18, -12], [-18, 12], [18, 12]]) d.group('Atrium Planter', () => { d.cyl('Planter Pot', [x, FLOOR + 0.9, z], [3, 1.8, 3], '#7a5a44'); d.ball('Planter Bush', [x, FLOOR + 3, z], 3.4, '#2f8f55', { material: 'snow' }); d.ball('Planter Bush Top', [x + 0.3, FLOOR + 4.4, z], 2, '#3fae6a', { material: 'snow' }); });
  for (const [x, z] of [[-9, -17], [9, -17], [-9, 17], [9, 17]]) { d.cyl('Atrium Pillar', [x, 7, z], [1.6, 14, 1.6], '#e4dcf0'); d.box('Pillar Neon', [x, 6, z], [1.9, 0.3, 1.9], C.pink, { material: 'neon', collide: false }); }

  // mezzanine ring, stairs, rails
  const ringTop = MEZ, ringThick = 0.5;
  B('Mezzanine N', -21, 21, ringTop - ringThick, ringTop, 11, 16, C.lavD); B('Mezzanine S', -21, 21, ringTop - ringThick, ringTop, -16, -11, C.lavD);
  B('Mezzanine W', -21, -16, ringTop - ringThick, ringTop, -16, 16, C.lavD); B('Mezzanine E', 16, 21, ringTop - ringThick, ringTop, -16, 16, C.lavD);
  B('Mezzanine Glow', -21, 21, ringTop - 0.7, ringTop - 0.5, -16, -15.8, C.cyan, { material: 'neon', collide: false });
  for (const [n, x0, x1, z0, z1] of [['Rail Inner N', -16, 16, 11, 11.3], ['Rail Inner S', -16, 16, -11.3, -11], ['Rail Inner W', -16.3, -16, -11, 11], ['Rail Inner E', 16, 16.3, -11, 11], ['Rail Outer N', -21, 21, 15.7, 16], ['Rail Outer E', 20.7, 21, -16, 16], ['Rail Outer S', -17, 21, -16, -15.7], ['Rail Outer W', -21, -20.7, -15, 16]]) B(n, x0, x1, ringTop, ringTop + 1.3, z0, z1, '#bfe9ff', { material: 'glass' });
  d.group('Mezzanine Stairs', () => { for (let i = 0; i < 17; i++) { const h = (i + 1) * 0.576; B('Stair', -21, -17, FLOOR, FLOOR + h, -41.5 + i * 1.5, -41.5 + (i + 1) * 1.5, i % 2 ? '#c9bde0' : '#b4a6d3'); } B('Stair Rail', -21.2, -21, FLOOR, FLOOR + 5, -41.5, -16, '#bfe9ff', { material: 'glass' }); B('Stair Rail 2', -17, -16.8, FLOOR, FLOOR + 5, -41.5, -17.5, '#bfe9ff', { material: 'glass', collide: false }); });
  B('Stairs Glow', -21, -17, FLOOR, FLOOR + 0.12, -43.5, -41.5, C.yellow, { material: 'neon', collide: false });

  // ============================== STORES ==============================
  /** store with open side `open` ('S' faces -z, 'N' faces +z). returns bounds helpers */
  const store = (nm, x0, x1, z0, z1, open, wall, tint, sign) => {
    const H = 9, t = 1;
    d.group(nm, () => {
      B(`${nm} Floor`, x0, x1, FLOOR, FLOOR + 0.04, z0, z1, tint, { collide: false });
      B(`${nm} Wall W`, x0 - t, x0, 0, H, z0 - (open === 'N' ? t : 0), z1 + (open === 'S' ? t : 0), wall);
      B(`${nm} Wall E`, x1, x1 + t, 0, H, z0 - (open === 'N' ? t : 0), z1 + (open === 'S' ? t : 0), wall);
      if (open === 'S') { B(`${nm} Wall Back`, x0, x1, 0, H, z1, z1 + t, wall); B(`${nm} Header`, x0, x1, 6.4, H, z0 - 0.2, z0 + 0.6, wall); B(`${nm} Sign Bar`, x0 + 3, x1 - 3, 6.8, 8.6, z0 - 0.4, z0 - 0.2, sign, { material: 'neon', collide: false }); }
      else { B(`${nm} Wall Back`, x0, x1, 0, H, z0 - t, z0, wall); B(`${nm} Header`, x0, x1, 6.4, H, z1 - 0.6, z1 + 0.2, wall); B(`${nm} Sign Bar`, x0 + 3, x1 - 3, 6.8, 8.6, z1 + 0.2, z1 + 0.4, sign, { material: 'neon', collide: false }); }
    });
    glowNames(`${nm} Sign Bar`);
  };
  store('Toy Kingdom', -70, -46, 8, 24, 'S', '#ffd9ec', '#ffc2e0', C.pink);
  store('Pet Paradise', -44, -22, 8, 24, 'S', '#d8f5d8', '#bfe8c0', C.green);
  store('Bookworm', -70, -46, -24, -8, 'N', '#e3d3bd', '#c9ad88', C.orange);
  store('Sneaker Hub', -44, -22, -24, -8, 'N', '#dfe7f5', '#c4d3ee', C.cyan);
  store('Arcade Galaxy', 22, 44, 8, 24, 'S', '#2a2250', '#1d1740', C.purple);
  store('Starlight Cinema', 46, 70, 8, 24, 'S', '#4a1f2d', '#35141f', C.red);
  store('Tech Zone', 22, 44, -24, -8, 'N', '#d9dde3', '#bcc4cf', C.cyan);
  store('Sweet Treats', 46, 70, -24, -8, 'N', '#ffe6f2', '#ffd1e8', C.pink);
  const Y = FLOOR;

  // ---- Toy Kingdom (x -70..-46, z 8..24)
  d.group('Toy Castle', () => {
    B('Castle Wall S', -66, -58, Y, Y + 5, 11, 12, '#ff9ecb'); B('Castle Wall E', -58, -57, Y, Y + 5, 11, 19, '#ffb3d9'); B('Castle Wall W', -67, -66, Y, Y + 5, 11, 19, '#ffb3d9'); B('Castle Wall N', -67, -57, Y, Y + 5, 18, 19, '#ff9ecb');
    for (const x of [-66.5, -57.5]) for (const z of [11.5, 18.5]) { d.cyl('Castle Tower', [x, Y + 4, z], [2.2, 8, 2.2], '#ff7ac8'); d.add('part', { name: 'Tower Roof', shape: 'cylinder', pos: [x, Y + 8.6, z], size: [1.2, 2, 1.2], color: C.yellow }); }
    B('Castle Gate Gap Sign', -63, -61, Y + 5, Y + 6.2, 11, 11.4, C.yellow, { material: 'neon', collide: false });
  });
  [[-52, 1.0, '#e2474b'], [-52, 2.6, '#3f8fd0'], [-52, 4.2, '#ffd34d']].forEach(([x, y, c], i) => B(`Toy Block ${i + 1}`, x - 1.6, x + 1.6, Y + y - 0.8 - (i ? 0 : 0), Y + y + 0.8, 14 - 1.6 - i * 0, 14 + 1.6, c));
  // stepped toy-block tower: steps up to the Golden Duck
  [[-50, 1.8, 1.9, 21.2], [-53.2, 3.6, 1.9, 21.2], [-56.4, 5.4, 1.9, 21.2]].forEach(([x, top, w, z], i) => B(`Tower Step ${i + 1}`, x - 1.6, x + 1.6, Y, Y + top, z - 1.6, z + 1.6, ['#3f8fd0', '#2f9e6a', '#e2474b'][i]));
  B('Tower Top', -60.2, -56.8, Y, Y + 7.3, 19.6, 22.8, C.yellow);
  for (let i = 0; i < 6; i++) d.ball(`Toy Ball ${i + 1}`, [-48 + i * 0.7, Y + 1.2, 10 + (i % 2)], 2, [C.red, C.cyan, C.yellow, C.green, C.pink, C.purple][i], { collide: false });
  d.cyl('Toy Drum', [-47.5, Y + 1.2, 22], [3, 2.4, 3], C.red); d.box('Toy Train Car', [-62, Y + 0.9, 8.8], [6, 1.6, 2], C.green, { scripts: [script('Train rolls', program([], [CONT.move('x', 8, 6)]))] }); d.box('Toy Train Cab', [-60, Y + 2.2, 8.8], [2, 1.4, 1.8], C.yellow, { scripts: [script('Train cab', program([], [CONT.move('x', 8, 6)]))] });
  d.add('part', { name: 'Teddy', shape: 'sphere', pos: [-48, Y + 3.2, 21], size: [3.2, 3.2, 3.2], color: '#b07a4a', collide: false }); d.ball('Teddy Head', [-48, Y + 5.4, 21], 2.2, '#b07a4a', { collide: false });

  // ---- Pet Paradise (x -44..-22, z 8..24)
  d.group('Fish Tank', () => { B('Tank Base', -43, -35, Y, Y + 2.2, 21.5, 23.5, '#4a4f57'); B('Tank Glass', -43, -35, Y + 2.2, Y + 6.4, 21.6, 23.4, '#7fd0ff', { material: 'glass' }); B('Tank Light', -43, -35, Y + 6.4, Y + 6.7, 21.5, 23.5, C.cyan, { material: 'neon', collide: false }); for (let i = 0; i < 3; i++) d.ball(`Fish ${i + 1}`, [-41 + i * 2.4, Y + 4 + (i % 2), 22.5], 0.9, [C.orange, C.yellow, C.pink][i], { material: 'neon', collide: false, scripts: [script(`Fish ${i + 1} swims`, program([], [CONT.move('x', 2.4, 3 + i)]))] }); });
  [[-40, 12.5], [-36, 12.5], [-32, 12.5], [-28, 12.5]].forEach(([x, z], i) => { B(`Cage ${i + 1}`, x - 1.5, x + 1.5, Y, Y + 2.6, z - 1.5, z + 1.5, '#d0d6dd', { material: 'glass' }); d.ball(`Pet ${i + 1}`, [x, Y + 0.8, z], 1.2, ['#e8c9a0', '#9a9a9a', '#ffffff', '#c9a06a'][i], { collide: false }); });
  d.group('Hamster Habitat', () => { B('Habitat Floor', -29, -23, Y, Y + 0.6, 17, 23, '#e8d6b0'); [[-27.5, 20, 1.2], [-25.5, 20, 2.4]].forEach(([x, z, h], i) => B(`Habitat Crate ${i + 1}`, x - 1, x + 1, Y, Y + h + 0.6, z - 1, z + 1, C.wood)); B('Habitat Shelf', -26.4, -23.2, Y + 3.0, Y + 3.5, 20, 23, '#d9b382'); d.cyl('Hamster Wheel', [-24.2, Y + 1.8, 18.2], [3, 0.6, 3], '#cfd8e0', { rot: [0, 0, 90], scripts: [script('Wheel spins', program([], [CONT.spin('x', 160)]))] }); });
  [[-22.8, 16.5], [-22.8, 11]].forEach(([x, z], i) => d.cyl(`Pet Bed ${i + 1}`, [x - 1, Y + 0.3, z], [2.6, 0.6, 2.6], '#c9556f', { collide: false }));
  for (let i = 0; i < 3; i++) d.box(`Kibble Bag ${i + 1}`, [-34 + i * 1.9, Y + 1.3, 17], [1.6, 2.6, 1], [C.red, C.green, C.orange][i]);

  // ---- Bookworm (x -70..-46, z -24..-8): shelves + secret shelf
  for (let r = 0; r < 4; r++) { const z0 = -22 + r * 3.4; B(`Bookshelf ${r + 1}`, -66, -52, Y, Y + 5.2, z0, z0 + 0.8, '#7a5236'); for (let b = 0; b < 12; b++) B(`Book ${r}${b}`, -65.5 + b * 1.15, -64.5 + b * 1.15, Y + 1.0 + (b % 3) * 1.4, Y + 1.0 + (b % 3) * 1.4 + 0.9, z0 - 0.5, z0, ['#e2474b', '#3f8fd0', '#ffd34d', '#2f9e6a', '#8b6cf0', '#ff8c2a'][(b + r) % 6], { collide: false }); }
  B('Reading Nook Rug', -64, -58, Y, Y + 0.05, -13, -9, '#8b6cf0', { collide: false }); d.group('Beanbag', () => { d.ball('Beanbag A', [-62, Y + 1, -11], 3, C.orange); d.ball('Beanbag B', [-59, Y + 1, -11.4], 3, C.cyan); });
  B('Fake Shelf', -50.5, -47, Y, Y + 5.2, -22.5, -21.7, '#7a5236', { scripts: [] });
  d.add('part', { name: 'Strange Book', shape: 'box', pos: [-48.6, Y + 2.6, -20.6], size: [1.1, 1.5, 0.5], color: '#ff3fa4', material: 'neon', collide: false, scripts: [script('Pull the book', program([R.press([A.hide('Fake Shelf'), A.sound('whoosh'), A.say('📚 *click* The shelf slides aside... there is a secret alcove behind it!')], { once: true })]))] });
  B('Alcove Floor', -50.5, -47, Y, Y + 0.1, -24, -22.5, '#2a2250', { collide: false });

  // ---- Sneaker Hub (x -44..-22, z -24..-8): shoe wall + Pogo Boots
  for (let i = 0; i < 8; i++) { B(`Shoe Shelf ${i + 1}`, -42 + i * 2.4, -40.4 + i * 2.4, Y, Y + 4.4, -23.6, -22.6, '#4a4f57'); d.wedge(`Sneaker ${i + 1}`, [-41.2 + i * 2.4, Y + 3.2, -22.2], [1.4, 0.9, 1.6], [C.red, C.cyan, C.yellow, C.green, C.pink, C.orange, C.purple, C.white][i], { rot: [0, 180, 0], collide: false }); }
  d.cyl('Try-On Bench', [-32, Y + 0.8, -14], [6, 1.6, 2], '#5b6b7a'); d.add('gear', { name: 'Pogo Boots (Gravity Coil)', pos: [-27, Y + 0.5, -14], size: [3, 1, 3], color: '#5b6b7a', gearId: 'gravityCoil' });

  // ---- Arcade Galaxy (x 22..44, z 8..24)
  [[26, 13], [30, 13], [34, 13], [38, 13], [42, 13]].forEach(([x, z], i) => { d.box(`Cabinet ${i + 1}`, [x, Y + 3, z + 4], [2.8, 6, 2.4], C.dark); d.box(`Cabinet Screen ${i + 1}`, [x, Y + 4.2, z + 2.75], [2.2, 1.7, 0.1], [C.purple, C.cyan, C.pink, C.green, C.yellow][i], { material: 'neon', collide: false }); });
  d.group('Prize Case', () => { B('Case Back', 31, 37, Y, Y + 5, 22.6, 23, '#bfe9ff', { material: 'glass' }); B('Case Side L', 30.6, 31, Y, Y + 5, 20.4, 23, '#bfe9ff', { material: 'glass' }); B('Case Side R', 37, 37.4, Y, Y + 5, 20.4, 23, '#bfe9ff', { material: 'glass' }); B('Case Top', 30.6, 37.4, Y + 5, Y + 5.3, 20.4, 23, '#bfe9ff', { material: 'glass' }); B('Prize Case Door', 31, 37, Y, Y + 5, 20.4, 20.8, '#bfe9ff', { material: 'glass', color: '#9fe3ff' }); d.cyl('Prize Pedestal', [34, Y + 0.8, 21.8], [2.4, 1.6, 2.4], C.yellow, { material: 'neon', collide: false }); for (let i = 0; i < 3; i++) d.ball(`Prize Plush ${i + 1}`, [31.8 + i * 2.2, Y + 0.8, 22.2], 1.3, [C.pink, C.cyan, C.green][i], { collide: false }); });
  d.box('Token Machine', [24, Y + 2.2, 21], [2.6, 4.4, 2], C.red); d.box('Token Slot', [24, Y + 3, 19.95], [1.4, 0.4, 0.1], C.yellow, { material: 'neon', collide: false });
  d.cyl('Dance Pad Mat', [40, Y + 0.1, 20.5], [5, 0.2, 5], C.pink, { material: 'neon', collide: false });

  // ---- Starlight Cinema (x 46..70, z 8..24)
  d.group('Cinema Screen', () => { B('Screen Frame', 49, 67, Y + 2, Y + 9, 23.2, 23.6, C.dark); B('Screen Glow', 49.5, 66.5, Y + 2.5, Y + 8.5, 23, 23.2, '#e7f4ff', { material: 'neon', collide: false }); });
  [50, 52, 54, 56, 58].forEach((x, i) => { d.box(`Seat Back ${i + 1}`, [x, Y + 2.4, 13], [1.6, 2.2, 0.5], C.red, { collide: false }); d.add('part', { name: `Seat ${i + 1}`, shape: 'box', pos: [x, Y + 0.9, 12.2], size: [1.6, 1.8, 1.6], color: C.red, scripts: [] }); });
  [51, 53, 55, 57].forEach((x, i) => { d.box(`Front Seat Back ${i + 1}`, [x, Y + 2.4, 17.5], [1.6, 2.2, 0.5], '#b8323a', { collide: false }); d.box(`Front Seat ${i + 1}`, [x, Y + 0.9, 16.8], [1.6, 1.8, 1.6], '#b8323a'); });
  d.group('Projection Booth', () => { B('Booth Floor', 64.5, 69.5, Y, Y + 0.1, 8.5, 15, '#35141f', { collide: false }); B('Booth Wall Back', 69, 69.6, Y, 9, 8, 15.5, '#6b3040'); B('Booth Wall N', 64, 69.6, Y, 9, 15, 15.5, '#6b3040'); B('Booth Wall S', 64, 69.6, Y, 9, 8, 8.5, '#6b3040'); B('Booth Door', 64, 64.5, Y, 6, 8.5, 15, '#9a3a4a'); d.box('Projector', [67.4, Y + 2.2, 11.7], [2, 1.6, 2.4], C.steel); d.cyl('Projector Lens', [66.2, Y + 2.2, 11.7], [1.1, 0.8, 1.1], C.cyan, { rot: [0, 0, 90], material: 'neon', collide: false }); });
  // marquee ledge for Golden Duck 3 + crate steps
  B('Marquee Ledge', 50, 60, 5.0, 5.6, 6.0, 8.6, '#7a2a3a'); B('Marquee Bulbs', 50, 60, 5.6, 5.9, 6.0, 6.3, C.yellow, { material: 'neon', collide: false });
  B('Ticket Crate', 47.2, 49.6, Y, Y + 2.0, 6.2, 8.0, C.wood);

  // ---- Tech Zone (x 22..44, z -24..-8)
  for (let i = 0; i < 5; i++) { d.box(`TV ${i + 1}`, [24.5 + i * 3.6, Y + 5, -23.2], [3, 2.2, 0.3], C.dark); d.box(`TV Screen ${i + 1}`, [24.5 + i * 3.6, Y + 5, -23.0], [2.7, 1.9, 0.1], [C.cyan, C.pink, C.green, C.yellow, C.purple][i], { material: 'neon', collide: false }); }
  d.box('Tech Counter', [33, Y + 1.3, -15], [10, 2.6, 2.4], '#cfd5dc'); d.box('Tech Laptop', [31, Y + 2.9, -15], [2, 0.3, 1.5], C.dark); d.box('Tech Laptop Screen', [31, Y + 3.7, -15.6], [2, 1.3, 0.12], C.cyan, { material: 'neon', collide: false });
  d.cyl('Robot Vacuum', [28, Y + 0.3, -18], [2.4, 0.6, 2.4], '#cfd5dc', { scripts: [script('Vacuum roams', program([], [CONT.wander(4, 2, 1)]))] });

  // ---- Sweet Treats (x 46..70, z -24..-8)
  for (let i = 0; i < 5; i++) { d.cyl(`Candy Jar ${i + 1}`, [49 + i * 3.4, Y + 2.8, -22.6], [2.4, 3.6, 2.4], '#e9f8ff', { material: 'glass' }); d.ball(`Candy Fill ${i + 1}`, [49 + i * 3.4, Y + 2.4, -22.6], 2.1, [C.pink, C.yellow, C.green, C.orange, C.purple][i], { collide: false }); }
  d.box('Sweets Counter', [58, Y + 1.3, -16], [12, 2.6, 2.4], '#ffb3d9'); d.box('Sweets Counter Top', [58, Y + 2.7, -16], [12.4, 0.3, 2.8], C.white);
  for (let i = 0; i < 4; i++) d.cyl(`Candy Cane ${i + 1}`, [63 + i * 1.6, Y + 3.8, -16], [0.5, 2, 0.5], i % 2 ? C.red : C.white, { collide: false });

  // ============================== FOOD COURT ==============================
  const stall = (nm, x, z, face, col, awn) => d.group(nm, () => {
    const s = face; // +1 faces +x (stall on west side), -1 faces -x
    B(`${nm} Counter`, x - 1.2, x + 1.2, Y, Y + 3.2, z - 4, z + 4, col); B(`${nm} Counter Top`, x - 1.5, x + 1.5, Y + 3.2, Y + 3.5, z - 4.3, z + 4.3, C.white);
    B(`${nm} Back Wall`, x - s * 4.5 - 0.5, x - s * 4.5 + 0.5, Y, 8, z - 4.5, z + 4.5, '#d9d2c4');
    B(`${nm} Awning`, x - 2.8 + s * 0.5, x + 3.2, 7.2, 7.6, z - 4.6, z + 4.6, awn);
    B(`${nm} Menu`, x - s * 4.0 - 0.1, x - s * 4.0 + 0.1, 4.2, 6.6, z - 3, z + 3, C.dark, { collide: false }); B(`${nm} Menu Glow`, x - s * 3.9 - 0.05, x - s * 3.9 + 0.05, 4.4, 6.4, z - 2.8, z + 2.8, awn, { material: 'neon', collide: false });
  });
  stall('Burger Barn', -16, 28, 1, '#b5533c', C.red); stall('Pizza Planet', -16, 44, 1, '#c97b2a', C.orange); stall('Taco Town', 16, 28, -1, '#2f9e6a', C.green); stall('Sushi Spot', 16, 44, -1, '#3f8fd0', C.cyan);
  d.group('Pizza Oven', () => { B('Oven Body', -19, -16.6, Y, Y + 3.6, 49.5, 52.5, '#7a4a3a'); B('Oven Mouth', -16.6, -16.5, Y + 0.8, Y + 2.4, 50.2, 51.8, C.orange, { material: 'neon', collide: false }); });
  [[-6, 30], [6, 30], [-6, 40], [6, 40], [-6, 50], [0, 35], [0, 45]].forEach(([x, z], i) => d.group('Food Table', () => { d.cyl(`Table Top ${i + 1}`, [x, Y + 2.2, z], [3.2, 0.3, 3.2], C.white); d.cyl(`Table Pole ${i + 1}`, [x, Y + 1.1, z], [0.6, 2.2, 0.6], C.steel); for (const [dx, dz] of [[-2.4, 0], [2.4, 0]]) d.cyl('Stool', [x + dx, Y + 1.3, z + dz], [1.3, 0.3, 1.3], [C.red, C.cyan, C.yellow][i % 3], { collide: false }); }));
  d.ball('Pretzel Health 1', [0, Y + 1.0, 24], 1.4, '#d9a05b', { collide: false, scripts: [script('Pretzel heals', program([R.touch([A.heal(50), A.say('🥨 A warm pretzel! +50 health.'), A.hide(null, 25)])]))] });
  d.ball('Pretzel Health 2', [-52, Y + 1.0, 0], 1.4, '#d9a05b', { collide: false, scripts: [script('Pretzel heals', program([R.touch([A.heal(50), A.say('🥨 A warm pretzel! +50 health.'), A.hide(null, 25)])]))] });

  // security booth + dock gate + closet
  d.group('Security Booth', () => { B('Booth Floor S', -17, -7, Y, Y + 0.1, 58, 67, '#4a4f57', { collide: false }); B('Sec Wall W', -17.6, -17, Y, 7, 57.5, 67.5, C.steel); B('Sec Wall N', -17, -7, Y, 7, 67, 67.6, C.steel); B('Sec Wall E', -7, -6.4, Y, 7, 62, 67.6, C.steel); B('Sec Wall S', -17, -11, Y, 7, 57.4, 58, C.steel); B('Sec Desk', -15, -9, Y, Y + 2.6, 64, 66, C.wood); for (let i = 0; i < 3; i++) d.box(`Sec Monitor ${i + 1}`, [-14 + i * 2, Y + 3.3, 65.3], [1.6, 1.3, 0.2], C.green, { material: 'neon', collide: false }); d.box('Sec Light', [-12, 6.8, 62], [10, 0.3, 0.6], C.red, { material: 'neon', collide: false }); });
  d.add('rig', { name: 'Gus the Guard', pos: [-11.5, Y + 0.1, 62], scripts: [script('Gus mumbles in his sleep', program([
    R.enter([A.say('💤 Gus: "Zzz... lost my keycards... Food Court... behind the pizza oven... Zzz..."')], { if: IF('keycards', '==', 0) }),
    R.enter([A.say('💤 Gus: "Zzz... one more? Try the Toy Kingdom... castle courtyard... Zzz..."')], { if: IF('keycards', '==', 1) }),
    R.enter([A.say('💤 Gus: "Zzz... Pet Paradise... hamster shelf... hop the crates... Zzz..."')], { if: IF('keycards', '==', 2) }),
    R.enter([A.say('💤 Gus: "Zzz... Arcade prize case... needs 8 tokens... Zzz..."')], { if: IF('keycards', '==', 3) }),
    R.enter([A.say('💤 Gus: "Zzz... Cinema booth... center seat, back row... Zzz..."')], { if: IF('keycards', '==', 4) }),
    R.enter([A.say('💤 Gus: "Zzz... last one on the rooftop telescope... service elevator needs 3 cards... Zzz..."')], { if: IF('keycards', '==', 5) }),
    R.enter([A.say('💤 Gus: "Zzz... all six! Dock gate is right behind me... Zzz..."')], { if: IF('keycards', '>=', 6) }),
  ]))] });
  d.group('Janitor Closet', () => { B('Closet Floor', 7, 17, Y, Y + 0.1, 62, 67.5, '#2a2250', { collide: false }); B('Closet Wall E', 17, 17.6, Y, 7, 62, 67.6, C.steel); B('Closet Wall N', 7, 17, Y, 7, 67, 67.6, C.steel); B('Closet Wall W', 6.4, 7, Y, 7, 62, 67.6, C.steel); B('Closet Door Frame L', 7, 10.2, Y, 7, 61.4, 62, C.steel); B('Closet Door Frame R', 13.8, 17, Y, 7, 61.4, 62, C.steel); B('Closet Header', 10.2, 13.8, 5.6, 7, 61.4, 62, C.steel); B('Closet Door', 10.2, 13.8, Y, 5.6, 61.5, 61.9, '#7a8da0'); B('Closet Plaque', 11.2, 12.8, 4.2, 5.2, 61.3, 61.5, C.yellow, { material: 'neon', collide: false });
    B('Trophy Base', 11, 13, Y, Y + 1.2, 64, 66, C.dark); d.cyl('Trophy Cup', [12, Y + 2.6, 65], [1.6, 2.4, 1.6], C.yellow, { material: 'neon', collide: false }); d.ball('Trophy Star', [12, Y + 4.4, 65], 1.2, '#fff6b0', { material: 'neon', collide: false }); });
  for (let i = 0; i < 5; i++) d.coin([8.5 + i * 1.8, Y + 1.4, 63], 1, 'Vault Coin');
  d.group('Dock Gate', () => { B('Dock Gate Frame L', -7, -4, Y, 9, 68, 69.2, C.steel); B('Dock Gate Frame R', 4, 7, Y, 9, 68, 69.2, C.steel); B('Dock Gate', -4, 4, Y, 8.6, 68.2, 69, '#5b6b7a'); B('Dock Gate Stripe', -4, 4, 6.5, 7.5, 67.9, 68.2, C.yellow, { collide: false }); B('Dock Gate Light', -1.5, 1.5, 8.7, 9.3, 67.9, 68.3, C.red, { material: 'neon', collide: false }); });
  d.slab('Loading Dock', -30, 30, 69, 100, 0.3, 0.3, '#8b8f96'); d.group('Truck', () => { d.box('Truck Box', [10, 4.5, 84], [8, 8, 18], C.white); d.box('Truck Cab', [10, 3, 74], [7, 5.5, 5], C.red); d.box('Truck Stripe', [10, 4.5, 84], [8.2, 1.2, 18.2], C.cyan, { collide: false }); });
  d.box('Dock Exit Sign', [-8, 6, 71], [6, 1.6, 0.3], C.green, { material: 'neon', collide: false });
  for (let i = 0; i < 6; i++) d.cyl(`Dock Bollard ${i}`, [-24 + i * 3, 1.2, 98], [1, 2, 1], C.yellow);
  d.cyl('Night Moon', [30, 70, 130], [14, 1, 14], '#fff6d0', { rot: [90, 0, 0], collide: false, material: 'neon' });

  // ============================== SERVICE ELEVATOR + ROOFTOP GARDEN ==============================
  B('Roof Deck', -18, 14, ROOF - 0.5, ROOF, 38, 62, '#6bbf6a'); B('Roof Deck Edge', -18, 14, ROOF - 1.2, ROOF - 0.5, 38, 62, '#8a96a3');
  for (const [x, z] of [[-17, 39], [13, 39], [-17, 61], [-17, 50], [13, 50]]) B('Roof Support', x - 0.6, x + 0.6, Y, ROOF - 1.2, z - 0.6, z + 0.6, '#8a96a3');
  for (const [n, x0, x1, z0, z1] of [['Roof Rail S', -18, 14, 38, 38.3], ['Roof Rail W', -18, -17.7, 38, 62], ['Roof Rail N', -18, 19, 61.7, 62]]) B(n, x0, x1, ROOF, ROOF + 1.3, z0, z1, '#bfe9ff', { material: 'glass' });
  d.group('Service Elevator', () => {
    B('Shaft East', 19.5, 20.3, Y, 25, 52, 62.5, '#6b7685'); B('Shaft North', 13.5, 20.3, Y, 25, 62, 62.7, '#6b7685');
    B('Shaft West', 13, 13.6, Y, 21, 55.5, 62.5, '#6b7685'); B('Shaft South L', 13, 15.4, Y, 25, 55, 55.6, '#6b7685'); B('Shaft South R', 18.2, 20.3, Y, 25, 55, 55.6, '#6b7685'); B('Shaft South Top', 15.4, 18.2, 6.4, 25, 55, 55.6, '#6b7685');
    B('Service Door', 15.4, 18.2, Y, 6.4, 55.05, 55.55, '#d9b34a', { scripts: [] });
    d.box('Service Elevator Cab', [16.5, FLOOR + 0.25, 58.5], [5.6, 0.5, 5.6], '#b9c2cc', { scripts: [script('Elevator rides', program([], [CONT.path([[16.5, FLOOR + 0.25, 58.5], [16.5, ROOF - 0.25, 58.5]], 6, 4)]))] });
    d.box('Elevator Glow', [16.5, FLOOR + 0.55, 58.5], [4.6, 0.12, 4.6], C.cyan, { material: 'neon', collide: false, scripts: [script('Elevator glow rides', program([], [CONT.path([[16.5, FLOOR + 0.55, 58.5], [16.5, ROOF - 0.0, 58.5]], 6, 4)]))] });
  });
  d.group('Rooftop Garden', () => {
    for (const [x, z] of [[-14, 42], [-10, 58], [8, 44], [10, 58], [-2, 41]]) { d.cyl('Garden Trunk', [x, ROOF + 1.5, z], [0.8, 3, 0.8], C.wood); d.ball('Garden Tree', [x, ROOF + 4, z], 4, '#2f8f55', { material: 'snow' }); d.ball('Garden Tree Top', [x, ROOF + 5.6, z], 2.6, '#3fae6a', { material: 'snow' }); }
    for (const [x, z] of [[-6, 54], [4, 54]]) { d.box('Garden Bench Seat', [x, ROOF + 1, z], [4, 0.4, 1.3], C.wood); d.box('Garden Bench Back', [x, ROOF + 2, z + 0.6], [4, 1.4, 0.3], C.wood); }
    B('Picnic Blanket', -4, 4, ROOF, ROOF + 0.06, 46, 52, '#e2474b', { collide: false });
    for (let i = 0; i < 9; i++) d.ball(`Fairy Light ${i + 1}`, [-17 + i * 4, ROOF + 4.2 + (i % 2) * 0.5, 38.6], 0.6, '#fff3a8', { material: 'neon', collide: false });
    d.cyl('Telescope Stand', [0, ROOF + 1.2, 58], [0.5, 2.4, 0.5], '#5b6b7a'); d.cyl('Telescope Tube', [0, ROOF + 2.9, 58.6], [0.9, 3.6, 0.9], C.steel, { rot: [60, 0, 0] });
  });

  // ============================== COLLECTIBLES ==============================
  const pickup = (name, pos, color, v, text, pts, extra = []) => d.box(name, pos, [1.5, 1.0, 0.25], color, { material: 'neon', collide: false, scripts: [
    script(`Collect ${name}`, program([R.touch([A.add(v, 1), A.add('points', pts), A.hide(), A.sound('chime'), A.fx('sparkles', null, 1.2), A.say(text), ...extra], { once: true })], [CONT.spin('y', 120), CONT.move('y', 0.5, 2)]))] });
  const kc = (n, pos, where) => pickup(`Keycard ${n}`, pos, '#ffe066', 'keycards', `🔑 Keycard ${n}/6 from ${where}! You now have {keycards} of 6.`, 100);
  kc(1, [-17.2, Y + 5.2, 51], 'the Food Court');
  kc(2, [-62, Y + 1.8, 15], 'the Toy Kingdom');
  kc(3, [-24.6, Y + 4.6, 21.5], 'Pet Paradise');
  kc(4, [34, Y + 2.2, 21.8], 'the Arcade prize case');
  kc(5, [67.4, Y + 3.8, 11.7], 'the Cinema projection booth');
  kc(6, [0, ROOF + 4.0, 57.5], 'the Rooftop telescope');
  const duck = (n, pos, text) => d.ball(`Golden Duck ${n}`, pos, 1.5, '#ffcc00', { material: 'neon', collide: false, scripts: [script(`Collect Golden Duck ${n}`, program([R.touch([A.add('ducks', 1), A.add('points', 250), A.hide(), A.sound('win'), A.fx('stars', null, 1.5), A.say(text)], { once: true })], [CONT.spin('y', 90), CONT.move('y', 0.4, 1.6)]))] });
  duck(1, [-48.8, Y + 1.3, -23.2], '🦆 Golden Duck {ducks}/3: hidden behind the Bookworm shelf!');
  duck(2, [-58.5, Y + 8.4, 21.2], '🦆 Golden Duck {ducks}/3: top of the toy-block tower!');
  duck(3, [55, 5.6 + 1.2, 7.3], '🦆 Golden Duck {ducks}/3: the cinema marquee ledge!');
  const coins = [[-3, Y + 1.4, -40], [4, Y + 1.4, -34], [0, Y + 1.4, -18], [-12, Y + 1.4, 3], [12, Y + 1.4, -3], [0, Y + 6.2, 12.4],
    [-50, Y + 1.4, 12], [-47, Y + 1.4, 20], [-36, Y + 1.4, 14], [-30, Y + 1.4, 20], [-55, Y + 1.4, -12], [-62, Y + 1.4, -20], [-30, Y + 1.4, -20],
    [26, Y + 1.4, 11], [40, Y + 1.4, 18], [52, Y + 1.4, 20], [28, Y + 1.4, -12], [62, Y + 1.4, -12], [-4, Y + 1.4, 36], [6, Y + 1.4, 46], [0, MEZ + 1.4, -13.5], [-18.5, MEZ + 1.4, -6]];
  coins.slice(0, 20).forEach((p, i) => d.coin(p, 1, `Lost Change ${i + 1}`));
  d.coin([-18.5, MEZ + 1.4, 6], 1, 'Lost Change 21');

  // ============================== HINT SIGNS ==============================
  const sign = (nm, x, z, text, y = 0) => d.group(nm, () => { d.cyl(`${nm} Post`, [x, Y + 1.6 + y, z], [0.35, 3.2, 0.35], '#5b6b7a', { collide: false }); d.box(`${nm} Board`, [x, Y + 3.6 + y, z], [2.6, 1.8, 0.25], C.yellow, { material: 'neon', collide: false }); d.zone(`${nm} Zone`, [x, Y + 2 + y, z], [7, 5, 7], [script(`${nm} text`, program([R.enter([A.say(text)])]))]); });
  sign('Directory Kiosk', 6, -34, '🗺️ MAPLE MALL DIRECTORY: Toy Kingdom & Pet Paradise (west) · Arcade & Cinema (east) · Food Court & Loading Dock (north). Find 6 keycards to unlock the dock!');
  sign('Info Sign', -6, -22, '💡 Tip: touch glowing keycards 🔑, spin-y coins 🪙 and secret golden ducks 🦆. Stairs to the upper walkway are on the left.');
  sign('Atrium Sign', 14, -2, '⛲ Beware the cleaning bots! They bump you a little when you touch them.');
  sign('Toy Sign', -48, 6, '🧸 Toy Kingdom: "A keycard glitters in the castle courtyard... and something golden sits atop the tallest block tower."');
  sign('Pet Sign', -33, 6, '🐹 Pet Paradise: "The hamsters hoard shiny things up on their shelf. Hop the crates!"');
  sign('Book Sign', -48, -6, '📚 Bookworm: "Some books are not meant for reading... one of them pulls back." Press the pink book.');
  sign('Sneaker Sign', -33, -6, '👟 Sneaker Hub: grab the Pogo Boots (gravity coil) from the try-on bench. Press its number to equip!');
  sign('Arcade Sign', 33, 6, '🕹️ Arcade Galaxy: the prize case opens for 8 Lost Change tokens. Check your coin count!');
  sign('Cinema Sign', 58, 6, '🎬 Starlight Cinema: "The projectionist always sat dead center of the back row." The ledge above holds a golden duck.');
  sign('Tech Sign', 33, -6, '💻 Tech Zone: a sticky note says "Booth door opens from the middle seat - row nearest the exit."');
  sign('Sweets Sign', 58, -6, '🍭 Sweet Treats: sugar rush! Coins hide behind the candy jars.');
  sign('Food Sign', 0, 20, '🍔 Food Court: a keycard sits on the pizza oven. The service elevator (back right) needs 3 keycards.', 0);
  sign('Roof Sign', -12, 45, '🌃 Rooftop Garden: the telescope holds the last keycard. Look through it! (touch the glowing card)', ROOF - Y);
  sign('Mezzanine Sign', -4, -13.5, '🛍️ Upper walkway: the view is great and the loose change is even better.', MEZ - Y);
  sign('Dock Sign', 0, 62, '🚪 Loading Dock gate: it needs all 6 keycards. Gus has the key reader... if he would stop snoring.');

  // ============================== NPC, HAZARDS, GATES ==============================
  d.add('rig', { name: 'Janitor Joan', pos: [14, Y + 0.1, -8], scripts: [script('Joan wanders and gossips', program([R.enter([{ do: 'random', options: [
    A.say('🧹 Joan: "Ducks? Three golden ones, they say... one hides where books slide."'), A.say('🧹 Joan: "The cinema booth? Sit in the middle of the back row, hon."'), A.say('🧹 Joan: "Eight tokens opens the arcade prize case. Coins are everywhere!"'),
    A.say('🧹 Joan: "Need the roof? Three keycards wake the service elevator."'), A.say('🧹 Joan: "Careful of my cleaning bots - they bump."')] }])], [CONT.wander(9, 2, 2)]))] });
  d.checkpoint = d.add('checkpoint', { name: 'Checkpoint Atrium', pos: [0, FLOOR + 0.2, -8], order: 1 });
  d.add('checkpoint', { name: 'Checkpoint Food Court', pos: [0, FLOOR + 0.2, 26], order: 2 });
  d.add('checkpoint', { name: 'Checkpoint Rooftop', pos: [-8, ROOF + 0.2, 44], order: 3 });
  const bot = (nm, pts, y0) => { const mk = (suffix, yy, size, color, shape, o = {}) => d.add('part', { name: `${nm} ${suffix}`, shape, pos: [pts[0][0], y0 + yy, pts[0][1]], size, color, ...o, scripts: [script(`${nm} ${suffix} patrols`, program([...(suffix === 'Body' ? [R.touch([A.damage(10), A.bounce(16), A.say('🤖 Beep boop! Wet floor!')])] : [])], [CONT.path(pts.map(p => [p[0], y0 + yy, p[1]]), 5, 0.4)]))] });
    mk('Body', 0.7, [2.6, 1.4, 2.6], C.yellow, 'cylinder'); mk('Dome', 1.8, [1.6, 1.2, 1.6], '#cfd8e0', 'sphere', { collide: false }); mk('Eye', 1.9, [0.7, 0.4, 0.7], C.red, 'sphere', { material: 'neon', collide: false }); };
  bot('Cleaning Bot A', [[-12, -9], [12, -9], [12, -26], [-12, -26]], FLOOR);
  bot('Cleaning Bot B', [[-14, 8], [14, 8], [14, 22], [-14, 22]], FLOOR);

  // gates & puzzles live on zones/parts so each rule has a clear owner
  d.zone('Prize Counter Zone', [34, Y + 2, 17.2], [8, 4, 4], [script('Prize case needs 8 coins', program([R.enter([A.door('Prize Case Door'), A.sound('bell'), A.say('🎁 The prize case swings open!')], { if: IF('coins', '>=', 8), else: [A.say('🎁 Prize Counter: bring 8 Lost Change tokens (you have {coins}).')] })]))]);
  d.zone('Service Gate Zone', [16.5, Y + 2, 52], [6, 4, 4], [script('Service elevator needs 3 keycards', program([R.enter([A.door('Service Door'), A.sound('bell'), A.say('🛗 Service elevator unlocked! Ride it up when the cab arrives.')], { if: IF('keycards', '>=', 3), else: [A.say('🛗 Service elevator locked: needs 3 keycards (you have {keycards}).')] })]))]);
  d.zone('Dock Gate Zone', [0, Y + 2, 64], [10, 4, 4], [script('Dock gate needs 6 keycards', program([R.enter([A.door('Dock Gate'), A.sound('alarm'), A.say('🚪 Gate unlocked! Run out to the Loading Dock!')], { if: IF('keycards', '>=', 6), else: [A.say('🚪 Dock gate locked: needs 6 keycards (you have {keycards}).')] })]))]);
  d.zone('Dock Finish', [0, Y + 3, 78], [24, 6, 14], [script('Escape!', program([
    R.enter([A.bucks(3), A.win('🌅 You escaped Maple Mall AND found every golden duck - Mall Legend! Time: check the clock!'), A.fx('fireworks', null, 2.5)], { if: IF('ducks', '>=', 3), once: true }),
    R.enter([A.bucks(3), A.win('🌅 You escaped Maple Mall before the morning crew arrived! (Find all 3 golden ducks for the secret ending.)'), A.fx('confetti', null, 2.5)], { if: IF('ducks', '<', 3), once: true }),
  ]))]);
  d.zone('Cinema Entrance Zone', [58, Y + 2, 10], [26, 4, 3], []);   // (kept empty: placeholder so the Studio Explorer groups the cinema)
  // Seat puzzle: only the centre seat of the back row opens the booth
  for (const [i, nm] of [[1, 'Seat 1'], [2, 'Seat 2'], [4, 'Seat 4'], [5, 'Seat 5']]) d.byName(nm).scripts.push(script(`${nm} creaks`, program([R.press([A.sound('buzz'), A.say('💺 Squeak... nothing happens. Not this seat.')])])));
  d.byName('Seat 3').scripts.push(script('Seat 3 is special', program([R.press([A.door('Booth Door'), A.sound('chime'), A.say('💺 *clunk* The projection booth door slides open!')], { once: true })])));
  // Secret closet opens with all 3 ducks
  d.byName('Closet Plaque').scripts.push(script('Closet opens for ducks', program([R.reach('ducks', '>=', 3, [A.door('Closet Door'), A.sound('bell'), A.say('🦆🦆🦆 All 3 golden ducks! Somewhere north a closet door clicks open...')], { once: true })])));
  // ============================== CONTROLLER ==============================
  d.zone('Mall Manager', [0, 1, -40], [1, 1, 1], [
    script('Setup', program([R.start([A.board(true), A.timer(true), ...lights.map(n => A.light(true, null, n)), A.wait(1.0),
      A.say('🌙 Midnight at Maple Mall: the doors are locked and the lights are low. Find 6 keycards 🔑 to unlock the Loading Dock!'), A.wait(6),
      A.say('🪙 Bonus: 21 Lost Change coins, 3 secret golden ducks 🦆. Speedrun clock is top-center.')])])),
    script('Milestones', program([
      R.reach('keycards', '>=', 1, [A.say('🔑 One down, five to go!')], { once: true }),
      R.reach('keycards', '>=', 3, [A.say('🛗 3 keycards: the service elevator to the rooftop is now unlocked!')], { once: true }),
      R.reach('keycards', '>=', 6, [A.sound('win'), A.say('🔑🔑🔑 All 6 keycards! Head north to the Loading Dock gate behind the Food Court!')], { once: true }),
      R.reach('coins', '>=', 8, [A.say('🪙 8 coins: the Arcade prize case will open for you!')], { once: true }),
      R.reach('coins', '>=', 20, [A.sound('chime'), A.say('🪙 20 coins! The mall fountain is jealous.')], { once: true }),
    ])),
  ]);
  d.add('spawn', { pos: [0, FLOOR + 0.2, -32], size: [5, 0.4, 5], color: C.pink, name: 'SpawnLocation' });
  return d;
}
