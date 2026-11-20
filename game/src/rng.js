// SOLMARA — rng.js
// Deterministic seeded random numbers (mulberry32). The city, traffic and
// screenshot scenes all draw from one seeded stream so ?seed=1 replays exactly.

function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Create the game's RNG from a numeric seed and store it on Game.
function makeRng(seed) {
  Game.rng = mulberry32(seed);
  return Game.rng;
}
function rnd() { return Game.rng(); }
function rndRange(a, b) { return a + Game.rng() * (b - a); }
function rndInt(a, b) { return Math.floor(rndRange(a, b + 1)); }
function rndPick(arr) { return arr[Math.floor(Game.rng() * arr.length)]; }
function rndChance(p) { return Game.rng() < p; }
