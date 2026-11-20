// SOLMARA — config.js
// Shared constants, tuning and the single global game state object.
// Every other source file reads and writes `Game` and the constants here.

var WORLD_SIZE = 3600;          // world is WORLD_SIZE x WORLD_SIZE pixels
var ROAD_GAP = 400;             // distance between road centre lines
var ROAD_W = 110;               // road width in pixels
var LANE = 26;                  // lane offset from a road centre line

var SAVE_KEY = 'solmara-save-v1';

// Player tuning
var WALK_SPEED = 210;
var SPRINT_SPEED = 320;
var PLAYER_RADIUS = 13;
var PLAYER_HEALTH = 100;
var PLAYER_ARMOR_MAX = 100;

// Wanted tuning (heat 0..100, stars derived from it)
var WANTED_MAX_HEAT = 100;
var HEAT_STEAL_CAR = 25;
var HEAT_HIT_PED = 15;
var HEAT_SHOT_FIRED = 4;
var HEAT_KILL_COP = 30;
var HEAT_KILL_PED = 20;
var HEAT_DECAY_PER_SEC = 9;

// The one global state object. Modules mutate its fields; main.js owns the loop.
var Game = {
  screen: 'title',        // title | play | pause | over | ending
  overKind: '',           // 'wasted' | 'busted' | ''
  time: 0,                // seconds since the run started
  night: false,           // night palette when true (shot mode / late hours)
  seed: 1,
  rng: null,              // seeded RNG (rng.js)
  city: null,             // city data (city.js)
  player: null,           // player entity
  cars: [],               // all cars (traffic + parked + police + mission)
  peds: [],               // pedestrians (incl. taxi fares)
  cops: [],               // police on foot
  enemies: [],            // armed hostiles (mission combat)
  bullets: [],            // projectiles
  particles: [],          // smoke, sparks, explosions, pickups sparkles
  pickups: [],            // health / armor / ammo / cash
  decals: [],             // skid marks, scorch marks (fade slowly)
  camera: { x: 0, y: 0, zoom: 1, shake: 0 },
  wanted: { heat: 0, stars: 0, hiddenTimer: 0 },
  cash: 250,
  missionIndex: 0,        // index into MISSIONS (missions.js)
  mission: null,          // active mission runtime state
  missionDone: [],        // completed mission ids
  objective: '',          // current objective line shown on the HUD
  dialog: null,           // {lines:[], who:''} shown in the dialog panel
  toast: '', toastTimer: 0,
  banner: '', bannerTimer: 0, bannerSub: '',
  race: null,             // active street race state
  taxi: null,             // active taxi fare state
  save: null,             // loaded save data (if any)
  audio: null,            // audio engine (audio.js)
  mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false, clicked: false },
  keys: {},
  stats: { carsStolen: 0, shotsFired: 0, kills: 0, missionsDone: 0, racesWon: 0, faresDone: 0 },
  shotMode: '',           // '' or cover|drive|mission|night (shots.js)
  debug: false
};

// ---- small helpers shared by every module ----
function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angleDiff(a, b) {
  var d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function fmtMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
function inRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
function circleHitsRect(cx, cy, cr, r) {
  var nx = clamp(cx, r.x, r.x + r.w), ny = clamp(cy, r.y, r.y + r.h);
  return dist2(cx, cy, nx, ny) < cr * cr;
}
