// Snowball Siege — tunables + save shape. BB rewards modest, one-time.
export const GAME_ID = 'snowball-siege';
export const ROUND_SECS = 180;
export const TEAM_SIZE = 4;                 // you + 3 bots vs 4 bots
export const HALF_X = 20, HALF_Z = 34;      // arena bounds
export const FORT_Z = 26;                   // fort core distance from mid
export const FORT_HP = 100;
export const CAP_R = 5, CAP_SECS = 22;      // mid capture: hold alone to fill 0..1
export const HP = 3;                        // soft hits before you're "snowed in"
export const RESPAWN = 3.5, SPAWN_SHIELD = 1.5;
export const AMMO = 6, RELOAD_SECS = 1.1, THROW_CD = 0.32;
export const BALL_SPEED = 26, BALL_GRAV = 11, BALL_R = 0.95;
export const CHARGE_SECS = 0.75;            // full charge = 2 dmg + fort smash
export const CORE_DMG = 4, CORE_DMG_CHARGED = 9;
export const GRAV = 28, JUMP_V = 10;
export const TEAMS = [
  { id: 0, name: 'Frost', color: '#3fa8ff', dark: '#1d5fa8', flag: '#9fd8ff' },
  { id: 1, name: 'Berry', color: '#ff5d8a', dark: '#b02a55', flag: '#ffc2d4' },
];
export const BOT_NAMES = ['Pip', 'Mittens', 'Blizz', 'Nugget', 'Frosty', 'Tundra', 'Waddles', 'Sleet', 'Biscuit', 'Juniper'];
export const EMOTES = ['😂', '😤', '👋', '🥶'];
export const DEFAULT_SAVE = { wins: 0, rounds: 0, streak: 0, bestStreak: 0, tags: 0, fortsBroken: 0, caps: 0, milestones: [] };
export const MILESTONES = [
  { id: 'first-tag', bb: 5, label: 'First snow tag', test: (r, s) => s.tags >= 1 },
  { id: 'first-win', bb: 15, label: 'First siege won', test: (r, s) => s.wins >= 1 },
  { id: 'fort-breaker', bb: 20, label: 'Broke an enemy fort', test: (r, s) => s.fortsBroken >= 1 },
  { id: 'king-of-hill', bb: 20, label: 'Won by mid capture', test: (r, s) => s.caps >= 1 },
  { id: 'streak-3', bb: 25, label: '3-win streak', test: (r, s) => s.bestStreak >= 3 },
  { id: 'tags-50', bb: 20, label: '50 tags lifetime', test: (r, s) => s.tags >= 50 },
];
