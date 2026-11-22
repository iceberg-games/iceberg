// Game 1: "Suds & Duds Laundromat" - corner laundromat tycoon/clicker.
// Built only from Studio features: parts, rigs, scripts (touch/press/enter/every/reach + variables,
// conditions, show/hide, colours, particles, leaderboard, win).
import { createDoc, A, R, IF, program, script, CONT } from './lib.mjs';

export const meta = {
  slug: 'suds-and-duds-laundromat',
  id: 'g_suds_and_duds',
  name: 'Suds & Duds Laundromat',
  description: 'Run the corner laundromat! Click the sorting table to wash loads, then step on glowing pads to buy washers, dryers, a vending machine and more. Knock down the wall to expand into the Dry-Cleaning Wing and light up the Grand Reopening sign. A cozy tycoon by gooberr478.',
  tagline: 'Tycoon · Clicker',
  flipZ: true,   // authored with the street at +z; mirrored so the player spawns facing the machines
};

const T = { teal: '#2bb5a0', tealD: '#1f8c7c', cream: '#fff4e0', navy: '#1d3a6e', yellow: '#ffd34d', pink: '#ff7ac8', white: '#f2f5f7', steel: '#c9d1d9', red: '#e2474b', blue: '#3f8fd0', orange: '#ff8c2a', green: '#3ddc84', wood: '#9a6b43', brick: '#b5533c' };
const FLOOR = 0.3;   // interior floor top (y)

export function build() {
  const d = createDoc({ id: meta.id, name: meta.name, description: meta.description, sky: 'day', ground: 'baseplate', music: 'cozy', snow: false });
  const hidden = [];   // names hidden at start (revealed by purchases)
  const names = (arr) => { hidden.push(...arr); return arr; };

  // ================= WORLD: street, block, building shell =================
  d.slab('Block Pavement', -95, 95, -70, 44, 0.2, 0.2, '#c9ccd1');
  d.slab('Grass Verge', -95, 95, -70, -45, 0.25, 0.25, '#7fbf6a');
  d.slab('Street', -95, 95, 23, 38, 0.22, 0.22, '#3a3f47');
  for (let i = -8; i <= 8; i++) d.box('Lane Dash', [i * 11, 0.24, 30.5], [5, 0.04, 0.6], T.yellow, { collide: false });
  d.slab('Far Sidewalk', -95, 95, 38, 44, 0.25, 0.25, '#b9bcc2');
  d.slab('Curb', -95, 95, 22.4, 23, 0.32, 0.32, '#e8e8ea');
  // invisible edge walls so nobody wanders off the block
  for (const [n, p, s] of [['Edge N', [0, 15, -62], [200, 30, 2]], ['Edge W', [-92, 15, -9], [2, 30, 110]], ['Edge E', [92, 15, -9], [2, 30, 110]], ['Edge S', [0, 15, 44], [200, 30, 2]]]) d.box(n, p, s, '#ffffff', { transparency: 1 });

  // main store: floor, walls, front windows
  d.slab('Store Floor', -20.5, 20.5, -14.5, 14.5, FLOOR, 0.3, '#eaf6fa');
  for (let ix = 0; ix < 10; ix++) for (let iz = 0; iz < 7; iz++) if ((ix + iz) % 2 === 0) d.box('Floor Tile', [-18 + ix * 4, FLOOR + 0.02, -12 + iz * 4], [4, 0.04, 4], '#9fd6e6', { collide: false });
  const wallC = T.cream;
  d.box('Back Wall', [0, 4.8, -15], [42, 9, 1], wallC);
  d.box('Back Wall Stripe', [0, 3.2, -14.45], [41, 0.8, 0.1], T.teal, { collide: false });
  d.box('West Wall', [-21, 4.8, 0], [1, 9, 30], wallC);
  d.box('West Wall Stripe', [-20.45, 3.2, 0], [0.1, 0.8, 29], T.teal, { collide: false });
  for (const [side, x0, x1] of [['L', -20.5, -4], ['R', 4, 20.5]]) {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    d.box(`Front Sill ${side}`, [cx, 0.9, 14.5], [w, 1.2, 1], T.tealD);
    d.box(`Front Window ${side}`, [cx, 4.0, 14.5], [w, 5.2, 0.3], '#bfe9ff', { material: 'glass' });
    d.box(`Front Beam ${side}`, [cx, 7.7, 14.5], [w, 2.6, 1], T.teal);
    for (let i = 1; i < 4; i++) d.box('Window Frame', [x0 + (w * i) / 4, 4.0, 14.5], [0.3, 5.2, 0.5], T.tealD);
  }
  d.box('Door Header', [0, 7.7, 14.5], [8, 2.6, 1], T.teal);
  d.box('Door Mat', [0, FLOOR + 0.03, 12.6], [5, 0.06, 2], T.navy, { collide: false });
  // neon sign (washer icon + bars) above the door
  d.group('Neon Sign', () => {
    d.cyl('Sign Ring', [0, 7.9, 15.2], [4.6, 0.5, 4.6], '#1d3a6e', { rot: [90, 0, 0] });
    d.cyl('Sign Glass', [0, 7.9, 15.5], [3.6, 0.4, 3.6], '#9fd3f5', { rot: [90, 0, 0], material: 'neon' });
    d.cyl('Sign Bubble', [0, 7.9, 15.8], [1.9, 0.4, 1.9], '#ffffff', { rot: [90, 0, 0], material: 'neon', scripts: [script('Sign spin', program([], [CONT.spin('y', 40)]))] });
    d.box('Neon Bar L', [-9.5, 7.9, 15.3], [9, 0.5, 0.3], T.pink, { material: 'neon' });
    d.box('Neon Bar R', [9.5, 7.9, 15.3], [9, 0.5, 0.3], T.pink, { material: 'neon' });
    d.box('Open Sign', [6.6, 5.9, 15.2], [3.2, 1.0, 0.25], T.green, { material: 'neon' });
  });
  d.box('Awning', [0, 9.6, 16.8], [44, 0.4, 5], T.teal);
  for (let i = -10; i <= 10; i++) d.box('Awning Stripe', [i * 2, 9.62, 16.8], [1, 0.42, 5.02], i % 2 ? T.cream : T.teal, { collide: false });

  // east wing shell
  d.slab('Wing Floor', 20.5, 44.5, -14.5, 14.5, FLOOR, 0.3, '#fff0d8');
  for (let ix = 0; ix < 6; ix++) for (let iz = 0; iz < 7; iz++) if ((ix + iz) % 2 === 0) d.box('Wing Tile', [22 + ix * 4, FLOOR + 0.02, -12 + iz * 4], [4, 0.04, 4], '#f5c9a0', { collide: false });
  d.box('Wing Back Wall', [32.5, 4.8, -15], [26, 9, 1], '#fde6c8');
  d.box('East Wall', [45, 4.8, 0], [1, 9, 30], '#fde6c8');
  d.box('Wing Sill', [32.5, 0.9, 14.5], [24, 1.2, 1], '#c46b2c');
  d.box('Wing Window', [32.5, 4.0, 14.5], [24, 5.2, 0.3], '#bfe9ff', { material: 'glass' });
  d.box('Wing Beam', [32.5, 7.7, 14.5], [24, 2.6, 1], '#c46b2c');
  for (let i = 1; i < 6; i++) d.box('Window Frame', [20.5 + i * 4, 4.0, 14.5], [0.3, 5.2, 0.5], '#8a4a1c');
  d.box('Wing Door Header', [32.5, 9.4, 14.5], [24, 0.8, 1.2], '#c46b2c');
  // construction partition between store and wing (hidden when you expand)
  d.group('Partition', () => {
    d.box('Partition A', [20.5, 4.8, -9], [1, 9, 10], '#d9b382');
    d.box('Partition B', [20.5, 4.8, 0], [1, 9, 8], '#d9b382');
    d.box('Partition C', [20.5, 4.8, 9.5], [1, 9, 9], '#d9b382');
    for (const [i, z] of [[0, -11], [1, -4], [2, 3], [3, 10]]) d.box(`Hazard Stripe ${i}`, [19.9, 5, z], [0.15, 1.2, 5], i % 2 ? '#22262e' : T.yellow, { collide: false, rot: [0, 0, 0] });
  });
  const PARTITION = ['Partition A', 'Partition B', 'Partition C', 'Hazard Stripe 0', 'Hazard Stripe 1', 'Hazard Stripe 2', 'Hazard Stripe 3'];

  // outside decor: neighbours, lamps, trees, cars, bus stop
  const building = (nm, x0, x1, z0, z1, h, col, trim, signCol) => {
    d.group(nm, () => {
      d.box(`${nm} Wall`, [(x0 + x1) / 2, h / 2, (z0 + z1) / 2], [x1 - x0, h, z1 - z0], col);
      d.box(`${nm} Roof Trim`, [(x0 + x1) / 2, h + 0.3, (z0 + z1) / 2], [x1 - x0 + 1, 0.6, z1 - z0 + 1], trim);
      const zf = z1 + 0.1; const n = Math.floor((x1 - x0) / 7);
      for (let i = 0; i < n; i++) d.box(`${nm} Window`, [x0 + 3.5 + i * 7, 4.2, zf], [4, 3.6, 0.2], '#fff3a8', { material: 'neon', collide: false });
      d.box(`${nm} Door`, [(x0 + x1) / 2, 2.2, zf], [3, 4.4, 0.25], trim, { collide: false });
      d.box(`${nm} Sign`, [(x0 + x1) / 2, 6.8, zf + 0.2], [Math.min(14, x1 - x0 - 4), 1.8, 0.3], signCol, { material: 'neon', collide: false });
    });
  };
  building('Bubble Tea', -62, -26, -14, 14, 11, '#ffc8e2', '#ff7ac8', '#ff7ac8');
  building('Pharmacy', -96, -64, -14, 14, 13, '#d7f5e2', '#2f9e6a', '#3ddc84');
  building('Bakery', 48, 82, -14, 14, 10, '#ffe0b0', '#c46b2c', '#ff8c2a');
  building('Bank', 84, 94, -14, 14, 16, '#d9d9e6', '#5b6b7a', '#9fd3f5');
  for (let i = 0; i < 6; i++) building(`Flat ${i + 1}`, -90 + i * 32, -62 + i * 32, -44, -20, 18 + (i % 3) * 5, ['#c97b63', '#8fa7c9', '#d9c27a'][i % 3], '#4a4f57', '#fff3a8');
  for (const x of [-34, -12, 12, 34, 56]) d.group('Street Lamp', () => { d.cyl('Lamp Pole', [x, 3.5, 20], [0.4, 7, 0.4], '#3a3f47'); d.ball('Lamp Bulb', [x, 7.2, 20], 1.0, '#fff3a8', { material: 'neon', collide: false }); });
  for (const x of [-48, -40, 26, 40, 52, 66]) d.group('Tree', () => { d.cyl('Trunk', [x, 1.8, 19], [0.9, 3.4, 0.9], T.wood); d.ball('Crown', [x, 5.2, 19], 4.6, '#3f9e5a', { material: 'snow' }); d.ball('Crown Top', [x, 7.0, 19], 3.2, '#4fb86a', { material: 'snow' }); });
  d.group('Bus Stop', () => { d.box('Shelter Roof', [-28, 6, 19], [6, 0.3, 3], T.blue); d.box('Shelter Back', [-28, 3, 20.2], [6, 5.4, 0.2], '#bfe9ff', { material: 'glass' }); d.box('Shelter Bench', [-28, 1.1, 19.4], [4.8, 0.3, 1], T.wood); d.cyl('Shelter Pole L', [-30.8, 3, 17.7], [0.3, 6, 0.3], '#3a3f47'); d.cyl('Shelter Pole R', [-25.2, 3, 17.7], [0.3, 6, 0.3], '#3a3f47'); });
  d.group('Mailbox', () => { d.box('Mailbox Body', [23, 1.5, 18], [1.6, 1.6, 2.4], T.blue); d.cyl('Mailbox Top', [23, 2.3, 18], [1.6, 2.4, 1.6], T.blue, { rot: [90, 0, 0] }); });
  d.group('Hydrant', () => { d.cyl('Hydrant Body', [-8, 1.0, 20.5], [1.0, 1.8, 1.0], T.red); d.ball('Hydrant Cap', [-8, 2.0, 20.5], 1.0, T.red); });
  const car = (nm, x, z, col, moving) => d.group(nm, () => {
    const sc = moving ? [script(`${nm} drives`, program([], [CONT.move('x', moving.dist, moving.period)]))] : [];
    const o = { scripts: [] };
    d.box(`${nm} Body`, [x, 1.2, z], [8, 1.6, 3.6], col, { scripts: sc });
    d.box(`${nm} Cabin`, [x - 0.2, 2.6, z], [4.6, 1.4, 3.2], col, { scripts: moving ? [script(`${nm} cabin`, program([], [CONT.move('x', moving.dist, moving.period)]))] : [] });
    d.box(`${nm} Glass`, [x - 0.2, 2.65, z], [4.8, 1.0, 3.3], '#bfe9ff', { material: 'glass', collide: false, scripts: moving ? [script(`${nm} glass`, program([], [CONT.move('x', moving.dist, moving.period)]))] : [] });
    for (const [dx, dz] of [[-2.5, -1.9], [2.5, -1.9], [-2.5, 1.9], [2.5, 1.9]]) d.cyl(`${nm} Wheel`, [x + dx, 0.7, z + dz], [1.4, 0.6, 1.4], '#22262e', { rot: [90, 0, 0], collide: false, scripts: moving ? [script(`${nm} wheel`, program([], [CONT.move('x', moving.dist, moving.period)]))] : [] });
  });
  car('Red Car', -46, 25, T.red); car('Blue Car', 36, 25, T.blue); car('Yellow Van', 70, 25, T.yellow);
  car('Taxi', -60, 33, '#ffcf33', { dist: 120, period: 16 }); car('Green Truck', 60, 29, '#2f9e6a', { dist: -120, period: 22 });

  // ================= STORE DECOR (always visible) =================
  d.group('Front Counter', () => {
    d.box('Counter Base', [15, FLOOR + 1.6, 9], [8, 3.2, 3], T.wood);
    d.box('Counter Top', [15, FLOOR + 3.3, 9], [8.4, 0.3, 3.4], T.cream);
    d.box('Cash Register', [13.2, FLOOR + 4.1, 9], [1.8, 1.3, 1.4], '#3a3f47');
    d.box('Register Screen', [13.2, FLOOR + 4.9, 8.5], [1.4, 0.9, 0.1], T.green, { material: 'neon', collide: false });
    d.cyl('Candy Jar', [17, FLOOR + 4.2, 9], [1.2, 1.4, 1.2], '#ffb3d9', { material: 'glass' });
    d.box('Bell', [16.0, FLOOR + 3.65, 8.4], [0.7, 0.4, 0.7], T.yellow);
  });
  d.group('Waiting Bench', () => { for (const x of [-16, -12]) { d.box('Bench Seat', [x, FLOOR + 1.1, 12], [3.4, 0.4, 1.4], T.blue); d.box('Bench Back', [x, FLOOR + 2.1, 12.6], [3.4, 1.6, 0.3], T.blue); for (const dx of [-1.4, 1.4]) d.box('Bench Leg', [x + dx, FLOOR + 0.5, 12], [0.3, 1, 1.2], '#3a3f47'); } });
  for (const [x, z] of [[-18.5, -12.5], [18.5, 12.5], [-18.5, 12], [18.5, -4]]) d.group('Plant', () => { d.cyl('Pot', [x, FLOOR + 0.8, z], [1.6, 1.6, 1.6], '#c46b2c'); d.ball('Leaves', [x, FLOOR + 2.4, z], 2.4, '#3f9e5a', { material: 'snow' }); d.ball('Leaves Top', [x + 0.3, FLOOR + 3.4, z], 1.5, '#4fb86a', { material: 'snow' }); });
  for (const [i, x, col] of [[1, -17, T.pink], [2, -9, T.yellow], [3, 0, T.blue], [4, 9, T.orange], [5, 17, T.green]]) d.box(`Poster ${i}`, [x, 6.2, -14.4], [3.4, 2.6, 0.1], col, { collide: false });
  d.box('Clock Face', [0, 7.6, -14.4], [2.2, 2.2, 0.15], '#ffffff', { collide: false });
  d.box('Clock Hand', [0, 7.9, -14.3], [0.15, 1.0, 0.1], '#22262e', { collide: false, scripts: [] });
  for (const [x, z] of [[-19, 6], [-2, 11.5]]) d.group('Hamper', () => { d.box('Hamper Body', [x, FLOOR + 1.3, z], [2.2, 2.6, 2.2], '#d9b382'); d.box('Hamper Clothes', [x, FLOOR + 2.8, z], [1.9, 0.6, 1.9], T.pink); });

  // ================= CLICK STATION: the Sorting Table =================
  d.group('Sorting Station', () => {
    d.box('Sorting Table', [-10, FLOOR + 0.9, 0], [8, 1.8, 3.6], '#ffffff', {
      material: 'plastic',
      scripts: [script('Wash a load (click!)', program([
        R.press([A.add('cash', 1), A.add('points', 1), A.sound('coin')]),
        R.press([A.add('cash', 2), A.add('points', 2)], { if: IF('skill', '>=', 1) }),
        R.press([A.add('cash', 4), A.add('points', 4)], { if: IF('skill', '>=', 2) }),
        R.press([A.add('cash', 8), A.add('points', 8)], { if: IF('skill', '>=', 3) }),
        R.press([A.add('cash', 16), A.add('points', 16)], { if: IF('skill', '>=', 4) }),
      ]))],
    });
    d.box('Table Trim', [-10, FLOOR + 1.85, 0], [8.2, 0.2, 3.8], T.teal, { collide: false });
    d.ball('Pile Pink', [-12.5, FLOOR + 2.7, 0], 2.2, T.pink, { collide: false });
    d.ball('Pile Blue', [-10, FLOOR + 2.9, -0.4], 2.6, T.blue, { collide: false });
    d.ball('Pile Yellow', [-7.6, FLOOR + 2.6, 0.2], 2.1, T.yellow, { collide: false });
    d.box('Sock', [-9, FLOOR + 2.0, 1.2], [0.8, 0.3, 0.4], T.red, { collide: false });
    // upgrades that appear on the table
    names(['Detergent Bottle 1', 'Detergent Bottle 2'].map((n, i) => d.cyl(n, [-6.2 + i * 0.8, FLOOR + 2.4, -1.0], [0.7, 1.2, 0.7], i ? T.pink : T.blue, { collide: false }).name));
    names([d.box('Rolling Cart Base', [-3.2, FLOOR + 0.9, -1], [2.4, 0.3, 3], '#8a96a3').name, d.box('Rolling Cart Basket', [-3.2, FLOOR + 1.7, -1], [2.2, 1.4, 2.8], '#bfe9ff', { material: 'glass' }).name,
      ...[[-3.9, 0], [-2.5, 0]].flatMap(([x], i) => [d.cyl(`Cart Wheel ${i}`, [x, FLOOR + 0.5, -2.2], [0.8, 0.3, 0.8], '#22262e', { rot: [90, 0, 0], collide: false }).name, d.cyl(`Cart Wheel ${i + 2}`, [x, FLOOR + 0.5, 0.2], [0.8, 0.3, 0.8], '#22262e', { rot: [90, 0, 0], collide: false }).name])]);
    names([d.box('Card Stand', [-15.2, FLOOR + 1.8, 0], [0.4, 3.6, 2.4], T.navy).name, d.box('Card Display', [-15.0, FLOOR + 2.6, 0], [0.2, 1.4, 1.8], T.yellow, { material: 'neon', collide: false }).name]);
  });

  // ================= MACHINES (each purchase reveals these parts) =================
  const washer = (p, x, z, accent) => d.group(p, () => {
    d.box(`${p} Body`, [x, FLOOR + 2.3, z], [4, 4.4, 3.4], T.white);
    d.box(`${p} Lid`, [x, FLOOR + 4.55, z], [4.2, 0.3, 3.6], accent);
    d.box(`${p} Panel`, [x, FLOOR + 3.7, z + 1.72], [3.6, 0.8, 0.1], accent, { material: 'neon', collide: false });
    d.cyl(`${p} Ring`, [x, FLOOR + 2.0, z + 1.75], [2.6, 0.3, 2.6], '#8a96a3', { rot: [90, 0, 0], collide: false });
    d.cyl(`${p} Drum`, [x, FLOOR + 2.0, z + 1.9], [2.2, 0.3, 2.2], '#5fb7e8', { rot: [90, 0, 0], material: 'neon', collide: false, scripts: [script(`${p} spin`, program([], [CONT.spin('y', 220)]))] });
    d.box(`${p} Paddle`, [x, FLOOR + 2.0, z + 2.1], [1.6, 0.25, 0.1], '#ffffff', { collide: false, scripts: [script(`${p} paddle`, program([], [CONT.spin('z', 220)]))] });
    d.cyl(`${p} Knob`, [x + 1.4, FLOOR + 3.7, z + 1.8], [0.6, 0.3, 0.6], '#ffffff', { rot: [90, 0, 0], collide: false });
  });
  const dryer = (p, x, z) => d.group(p, () => {
    d.box(`${p} Body`, [x, FLOOR + 2.3, z], [4, 4.4, 3.4], '#f7e9d9');
    d.box(`${p} Lid`, [x, FLOOR + 4.55, z], [4.2, 0.3, 3.6], T.orange);
    d.box(`${p} Panel`, [x, FLOOR + 3.7, z + 1.72], [3.6, 0.8, 0.1], T.orange, { material: 'neon', collide: false });
    d.cyl(`${p} Ring`, [x, FLOOR + 2.0, z + 1.75], [2.6, 0.3, 2.6], '#8a96a3', { rot: [90, 0, 0], collide: false });
    d.cyl(`${p} Drum`, [x, FLOOR + 2.0, z + 1.9], [2.2, 0.3, 2.2], '#ffb066', { rot: [90, 0, 0], material: 'neon', collide: false, scripts: [script(`${p} spin`, program([], [CONT.spin('y', -300)]))] });
    d.box(`${p} Vent`, [x, FLOOR + 4.9, z - 1.2], [1.4, 0.7, 1.0], '#8a96a3');
  });
  const W1 = ['Washer 1', -15, T.blue], W2 = ['Washer 2', -10, T.green], W3 = ['Washer 3', -5, T.pink];
  names([W1, W2, W3].flatMap(([p, x, c]) => { const g = washer(p, x, -12, c); return d.instances.filter(i => i.parent === g.id).map(i => i.name); }));
  names(['Dryer 1', 'Dryer 2'].flatMap((p, i) => { const g = dryer(p, 5 + i * 5, -12); return d.instances.filter(i2 => i2.parent === g.id).map(i2 => i2.name); }));
  // vending machine
  names((() => { const g = d.group('Vending Machine', () => {
    d.box('Vending Body', [16.5, FLOOR + 3.2, -12.5], [3.4, 6.4, 2.6], T.red);
    d.box('Vending Window', [16.5, FLOOR + 3.8, -11.15], [2.4, 3.6, 0.1], '#bfe9ff', { material: 'glass', collide: false });
    [0, 1, 2, 3].forEach(r => [-0.8, 0, 0.8].forEach((dx, c) => d.box(`Vending Snack ${r}${c}`, [16.5 + dx, FLOOR + 5.0 - r * 0.9, -11.3], [0.6, 0.6, 0.3], [T.yellow, T.pink, T.green, T.blue][(r + c) % 4], { collide: false })));
    d.box('Vending Slot', [16.5, FLOOR + 1.2, -11.2], [1.8, 0.8, 0.2], '#22262e', { collide: false });
    d.box('Vending Light', [16.5, FLOOR + 6.2, -11.2], [3, 0.3, 0.2], T.yellow, { material: 'neon', collide: false });
  }); return d.instances.filter(i => i.parent === g.id).map(i => i.name); })());
  // wing machines
  names((() => { const g = d.group('Steam Press', () => {
    d.box('Press Table', [26, FLOOR + 1.4, -11], [5, 2.8, 3.4], '#8a96a3');
    d.box('Press Pad', [26, FLOOR + 3.0, -11], [4.6, 0.4, 3.0], '#ffffff');
    d.box('Press Head', [26, FLOOR + 4.6, -11], [4.2, 1.0, 2.6], T.red, { scripts: [script('Press head pumps', program([], [CONT.move('y', -1.1, 1.4)]))] });
    d.cyl('Press Arm', [26, FLOOR + 6.0, -12.2], [0.8, 2.6, 0.8], '#5b6b7a');
    d.ball('Steam Puff', [24.3, FLOOR + 3.6, -9.4], 0.9, '#ffffff', { collide: false, scripts: [script('Steam puff', program([], [CONT.move('y', 1.4, 1.4)]))] });
  }); return d.instances.filter(i => i.parent === g.id).map(i => i.name); })());
  names((() => { const g = d.group('Folding Robot', () => {
    d.box('Robot Base', [35, FLOOR + 1.0, -11.5], [5.4, 2.0, 3.6], '#3a3f47');
    d.box('Robot Body', [35, FLOOR + 3.4, -11.5], [3.2, 3.2, 2.6], '#cfd8e0');
    d.ball('Robot Head', [35, FLOOR + 5.7, -11.5], 2.0, '#e8eef3');
    d.ball('Robot Eye L', [34.4, FLOOR + 5.9, -10.6], 0.6, T.green, { material: 'neon', collide: false });
    d.ball('Robot Eye R', [35.6, FLOOR + 5.9, -10.6], 0.6, T.green, { material: 'neon', collide: false });
    d.box('Robot Arm L', [32.8, FLOOR + 3.6, -10.3], [0.8, 0.8, 3.0], T.blue, { scripts: [script('Fold left', program([], [CONT.move('y', 1.4, 1.0)]))] });
    d.box('Robot Arm R', [37.2, FLOOR + 3.6, -10.3], [0.8, 0.8, 3.0], T.pink, { scripts: [script('Fold right', program([], [CONT.move('y', -1.4, 1.0)]))] });
    d.box('Folded Stack', [35, FLOOR + 2.3, -8.6], [2.4, 1.6, 1.4], T.yellow, { collide: false });
  }); return d.instances.filter(i => i.parent === g.id).map(i => i.name); })());
  names((() => { const g = d.group('Arcade Corner', () => {
    [[24.5, '#8b6cf0'], [28.5, '#4dd2ff'], [32.5, '#ff7ac8']].forEach(([x, col], i) => {
      d.box(`Arcade Cabinet ${i + 1}`, [x, FLOOR + 3.0, 10.5], [3, 6, 2.4], '#22262e');
      d.box(`Arcade Screen ${i + 1}`, [x, FLOOR + 4.1, 9.25], [2.4, 1.8, 0.1], col, { material: 'neon', collide: false });
      d.box(`Arcade Stick ${i + 1}`, [x, FLOOR + 2.6, 9.0], [0.5, 0.5, 0.5], T.red, { collide: false });
    });
    d.box('Arcade Marquee', [28.5, FLOOR + 6.6, 10.5], [10, 0.8, 2.4], T.yellow, { material: 'neon', collide: false });
  }); return d.instances.filter(i => i.parent === g.id).map(i => i.name); })());
  names((() => { const g = d.group('Coffee Bar', () => {
    d.box('Bar Counter', [41, FLOOR + 1.7, 6], [3, 3.4, 10], T.wood);
    d.box('Bar Top', [41, FLOOR + 3.5, 6], [3.4, 0.3, 10.4], '#fff4e0');
    d.box('Espresso Machine', [41, FLOOR + 4.5, 4], [1.8, 1.6, 2.4], '#8a96a3');
    d.cyl('Coffee Cup 1', [41, FLOOR + 4.0, 8], [0.7, 0.6, 0.7], '#ffffff', { collide: false });
    d.cyl('Coffee Cup 2', [41, FLOOR + 4.0, 9], [0.7, 0.6, 0.7], T.pink, { collide: false });
    for (const z of [3, 6, 9]) { d.cyl(`Stool Seat ${z}`, [38.2, FLOOR + 2.0, z], [1.3, 0.3, 1.3], T.red, { collide: false }); d.cyl(`Stool Leg ${z}`, [38.2, FLOOR + 1.0, z], [0.3, 2.0, 0.3], '#3a3f47', { collide: false }); }
    d.box('Menu Board', [43.8, FLOOR + 5.4, 6], [0.2, 3, 6], '#22262e', { collide: false });
    d.box('Menu Chalk', [43.65, FLOOR + 5.4, 6], [0.1, 2.4, 5], '#ffffff', { material: 'neon', collide: false });
  }); return d.instances.filter(i => i.parent === g.id).map(i => i.name); })());
  // customers (rigs), appear as the shop grows, and wander about
  const rig = (nm, x, z, radius) => { d.add('rig', { name: nm, pos: [x, FLOOR, z], scripts: [script(`${nm} wanders`, program([], [CONT.wander(radius, 2, 2)]))] }); hidden.push(nm); return nm; };
  rig('Customer 1', -12, 8, 5); rig('Customer 2', 4, 6, 6); rig('Customer 3', 10, 2, 5); rig('Customer 4', 28, 2, 6); rig('Customer 5', 36, 8, 4); rig('Helper Hank', -9, 4, 3);
  // grand reopening: fireworks tower + lit sign
  names((() => { const g = d.group('Grand Reopening', () => {
    d.box('Banner Pole L', [-12, 11, 17.5], [0.4, 3, 0.4], '#5b6b7a', { collide: false });
    d.box('Banner Pole R', [12, 11, 17.5], [0.4, 3, 0.4], '#5b6b7a', { collide: false });
    d.box('Reopening Banner', [0, 11.2, 17.6], [24, 3, 0.2], T.yellow, { material: 'neon', collide: false });
    d.box('Reopening Banner Stripe', [0, 11.2, 17.75], [22, 0.8, 0.1], T.red, { material: 'neon', collide: false });
    for (let i = -5; i <= 5; i++) d.ball(`Balloon ${i + 5}`, [i * 2.2, 13.5 + (i % 2) * 0.8, 17.6], 1.5, [T.red, T.blue, T.yellow, T.green, T.pink][Math.abs(i) % 5], { collide: false });
  }); return d.instances.filter(i => i.parent === g.id).map(i => i.name); })());

  // blueprint plots show where each future machine will stand (hidden when it is bought)
  const PLOTS = { 'Pad Washer 1': [-15, -12, 4.8, 4], 'Pad Washer 2': [-10, -12, 4.8, 4], 'Pad Dryer 1': [5, -12, 4.8, 4], 'Pad Washer 3': [-5, -12, 4.8, 4], 'Pad Dryer 2': [10, -12, 4.8, 4], 'Pad Vending': [16.5, -12.4, 4, 3.4], 'Pad Press': [26, -11, 6, 4.2], 'Pad Robot': [35, -11.5, 6.4, 4.4], 'Pad Arcade': [28.5, 10.5, 11, 3.4], 'Pad Coffee': [41, 6, 3.8, 10.8] };
  for (const [k, [x, z, w, dd]] of Object.entries(PLOTS)) d.box(`Plot ${k.slice(4)}`, [x, FLOOR + 0.03, z], [w, 0.06, dd], '#a8d3ec', { collide: false });
  // ================= BUY PADS =================
  // chain A (machines & expansion): each purchase raises `level`; chain B (skills): raises `skill`.
  const pad = (nm, x, z, cost, label, reveal, next, okMsg, extra = []) => {
    const actions = [A.add('cash', -cost), ...(extra.includes('noLevel') ? [] : [A.add('level', 1)]), ...reveal.map(A.show), A.hide(), ...(next ? [A.show(next)] : []), A.sound('bell'), A.say(okMsg), ...extra.filter(e => typeof e === 'object')];
    d.cyl(nm, [x, FLOOR + 0.18, z], [3.8, 0.36, 3.8], T.red, { material: 'neon', scripts: [
      script('Buy', program([R.touch(actions, { if: IF('cash', '>=', cost) })])),
      script('Price tag', program([R.enter([A.say(`${label} - $${cost.toLocaleString('en-US')}. The pad turns green when you can afford it.`)])])),
      script('Affordable glow', program([R.every(1, [A.color(T.green, null, 0.4)], { if: IF('cash', '>=', cost), else: [A.color(T.red, null, 0.4)] })])),
    ] });
    return nm;
  };
  const chainA = [
    ['Pad Washer 1', -15, -7.2, 20, '🧺 Washer #1', ['Washer 1 Body', 'Washer 1 Lid', 'Washer 1 Panel', 'Washer 1 Ring', 'Washer 1 Drum', 'Washer 1 Paddle', 'Washer 1 Knob', 'Customer 1'], 'Washer #1 installed! It earns $1 every 2 seconds.'],
    ['Pad Washer 2', -10, -7.2, 60, '🧺 Washer #2', d.instances.filter(i => /^Washer 2 /.test(i.name)).map(i => i.name), 'Washer #2 humming along. +$3 per cycle.'],
    ['Pad Dryer 1', 5, -7.2, 150, '♨️ Dryer #1', d.instances.filter(i => /^Dryer 1 /.test(i.name)).map(i => i.name).concat('Customer 2'), 'Dryer #1 is toasty! +$6 per cycle.'],
    ['Pad Washer 3', -5, -7.2, 350, '🧺 Washer #3', d.instances.filter(i => /^Washer 3 /.test(i.name)).map(i => i.name), 'Washer #3 online. +$12 per cycle.'],
    ['Pad Dryer 2', 10, -7.2, 800, '♨️ Dryer #2', d.instances.filter(i => /^Dryer 2 /.test(i.name)).map(i => i.name).concat('Customer 3'), 'Dryer #2 spinning! +$24 per cycle.'],
    ['Pad Vending', 16.5, -7.2, 1800, '🥤 Snack & Soap Vending Machine', d.instances.filter(i => i.parent === d.byName('Vending Machine').id).map(i => i.name), 'Vending machine stocked! +$48 per cycle.'],
    ['Pad Expand', 16.5, 2, 4000, '🔨 Expand: knock down the wall into the Dry-Cleaning Wing', [], 'Wall down! The Dry-Cleaning Wing is open for business.', ['noIncome']],
    ['Pad Press', 26, -6.6, 8000, '👔 Steam Press', d.instances.filter(i => i.parent === d.byName('Steam Press').id).map(i => i.name), 'Steam Press hissing! +$96 per cycle.'],
    ['Pad Robot', 35, -6.6, 16000, '🤖 Folding Robot', d.instances.filter(i => i.parent === d.byName('Folding Robot').id).map(i => i.name).concat('Customer 4'), 'Folding Robot reporting for duty! +$192 per cycle.'],
    ['Pad Arcade', 28.5, 5, 32000, '🕹️ Arcade Corner', d.instances.filter(i => i.parent === d.byName('Arcade Corner').id).map(i => i.name), 'Arcade lit up! +$384 per cycle.'],
    ['Pad Coffee', 36, 8.5, 48000, '☕ Coffee Bar', d.instances.filter(i => i.parent === d.byName('Coffee Bar').id).map(i => i.name).concat('Customer 5'), 'Fresh coffee! +$768 per cycle.'],
  ];
  // special effects on purchase of the expansion + the finale are patched in below
  chainA.forEach((a, i) => {
    const next = i + 1 < chainA.length ? chainA[i + 1][0] : 'Pad Grand';
    const extra = [];
    if (PLOTS[a[0]]) extra.push(A.hide(`Plot ${a[0].slice(4)}`));
    if (a[0] === 'Pad Expand') { extra.push(...PARTITION.map(n => A.hide(n)), A.fx('explosion', 'Partition B', 1.2), A.sound('boom'), A.fx('smoke', 'Partition A', 2)); }
    pad(a[0], a[1], a[2], a[3], a[4], a[5], next, a[6], extra.concat(a[7] || []).filter(x => x !== 'noIncome'));
  });
  // finale pad (win)
  d.cyl('Pad Grand', [0, FLOOR + 0.18, 3], [4.6, 0.36, 4.6], T.yellow, { material: 'neon', scripts: [
    script('Grand Reopening!', program([R.touch([A.add('cash', -100000), A.add('level', 1), ...['Banner Pole L', 'Banner Pole R', 'Reopening Banner', 'Reopening Banner Stripe'].map(A.show), A.hide(), A.fx('fireworks', 'Reopening Banner', 2.5), A.sound('win'), A.wait(1.2), A.fx('confetti', 'Pad Grand', 2), A.fx('fireworks', 'Reopening Banner', 2.5), A.bucks(3), A.win('🎉 GRAND REOPENING! Suds & Duds is the best laundromat on the block. You win!')], { if: IF('cash', '>=', 100000) })])),
    script('Price tag', program([R.enter([A.say('🎉 Grand Reopening - $100,000. The final upgrade: bring in the whole neighbourhood!')])])),
    script('Affordable glow', program([R.every(1, [A.color(T.green, null, 0.4)], { if: IF('cash', '>=', 100000), else: [A.color(T.yellow, null, 0.4)] })])),
  ] });
  hidden.push(...[...chainA.slice(1).map(a => a[0]), 'Pad Grand']);
  const chainB = [
    ['Pad Detergent', -14, 7.5, 30, '🧴 Better Detergent (clicks earn $3)', ['Detergent Bottle 1', 'Detergent Bottle 2'], 'Better detergent! Each click is now worth $3.'],
    ['Pad Cart', -10, 7.5, 200, '🛒 Rolling Cart (clicks earn $7)', ['Rolling Cart Base', 'Rolling Cart Basket', 'Cart Wheel 0', 'Cart Wheel 1', 'Cart Wheel 2', 'Cart Wheel 3'], 'Rolling cart! Each click is now worth $7.'],
    ['Pad Helper', -6, 7.5, 1000, '🙋 Hire Helper Hank (clicks earn $15)', ['Helper Hank'], 'Hank is on the clock! Each click is now worth $15.'],
    ['Pad Cards', -2, 7.5, 6000, '💳 Loyalty Cards (clicks earn $31)', ['Card Stand', 'Card Display'], 'Loyalty cards! Each click is now worth $31.'],
  ];
  chainB.forEach((b, i) => {
    const nm = pad(b[0], b[1], b[2], b[3], b[4], b[5], i + 1 < chainB.length ? chainB[i + 1][0] : null, b[6], ['noLevel']);
    // skill pads raise `skill` instead of `level`
    const inst = d.byName(nm); inst.scripts[0].program.rules[0].actions.splice(1, 0, A.add('skill', 1));
    if (i) hidden.push(nm);
  });

  // ================= SHOP MANAGER (controller: setup, passive income, milestones) =================
  const incomePerTick = [1, 3, 6, 12, 24, 48, 0, 96, 192, 384, 768];   // level k => +income (level 7 is the expansion)
  const incomeRules = incomePerTick.map((inc, i) => inc && R.every(2, [A.add('cash', inc), A.add('points', inc)], { if: IF('level', '>=', i + 1) })).filter(Boolean);
  const ms = (n, text, fx = 'sparkles') => R.reach('points', '>=', n, [A.sound('chime'), A.say(text), A.fx(fx, 'Cash Register', 1.5)], { once: true });
  d.zone('Shop Manager', [0, 1, 0], [1, 1, 1], [
    script('Setup', program([R.start([...[...new Set(hidden)].map((n) => A.hide(n)), A.board(true), A.wait(1.2),
      A.say('🧺 Welcome to Suds & Duds! Click the white Sorting Table (or tap it) to wash a load and earn cash.'), A.wait(5),
      A.say('💡 Pads glow GREEN when you can afford them. Step on one to buy an upgrade!')])])),
    script('Passive income', program([...incomeRules, R.every(2, [A.fx('sparkles', 'Cash Register', 1)], { if: IF('level', '>=', 1) })])),
    script('Milestones', program([
      ms(50, '⭐ $50 earned: customers are starting to notice you!'), ms(500, '⭐ $500 earned: the neighbours are talking!'),
      ms(2500, '⭐ $2,500 earned: you made the local paper!', 'confetti'), ms(10000, '⭐ $10,000 earned: laundry royalty!', 'confetti'),
      ms(50000, '⭐ $50,000 earned: the whole street smells like fresh linen!', 'fireworks'), ms(250000, '🏆 $250,000 earned: legendary laundromat!', 'fireworks'),
      R.reach('level', '>=', 7, [A.say('🏗️ The Dry-Cleaning Wing is open! Walk east to find new upgrades.')], { once: true }),
    ])),
  ]);
  // spawn: just inside the door, facing the machines
  d.add('spawn', { pos: [0, FLOOR + 0.2, 4], size: [4, 0.4, 4], color: T.navy, transparency: 0, name: 'SpawnLocation' });
  return d;
}
