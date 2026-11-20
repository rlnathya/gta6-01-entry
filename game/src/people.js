// SOLMARA — people.js
// Pedestrians on the sidewalks and police officers on foot.
// Peds stroll, chat and flee danger; cops chase, arrest or shoot.

var PED_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8', '#00cec9'];
var PED_SHIRTS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#f5f5f5'];

function makePed(x, y, kind) {
  return {
    kind: kind || 'civilian', // civilian | fare | cop
    x: x, y: y, angle: rndRange(0, Math.PI * 2),
    speed: rndRange(45, 75), hp: 100,
    shirt: rndPick(PED_SHIRTS), pants: rndPick(['#2c3e50', '#5d4037', '#37474f']),
    walkPhase: rndRange(0, 6), fleeing: false, fleeTimer: 0,
    road: nearestRoad(x), dir: rndPick(['n', 's', 'e', 'w']),
    target: null, wait: 0, dead: false, fare: null
  };
}

function spawnPeds(n) {
  for (var i = 0; i < n; i++) {
    var p = randomRoadPoint();
    var ped = makePed(p.x, p.y, 'civilian');
    Game.peds.push(ped);
  }
}

// A waiting taxi fare: stands on a sidewalk corner with a $ marker.
function spawnFare() {
  var p = randomRoadPoint();
  var fare = makePed(p.x, p.y, 'fare');
  var dest = randomRoadPoint();
  fare.fare = { dest: dest, pay: rndInt(40, 90) };
  fare.speed = 0;
  Game.peds.push(fare);
  return fare;
}

function makeCop(x, y) {
  var c = makePed(x, y, 'cop');
  c.shirt = '#1a2a4a'; c.pants = '#1a2a4a';
  c.speed = 175; c.hp = 100;
  c.arrestTimer = 0; c.shootTimer = 0;
  Game.cops.push(c);
  return c;
}

function updatePed(ped, dt) {
  if (ped.dead) return;
  var danger = nearestDanger(ped.x, ped.y);
  if (danger && danger.d < 190) { ped.fleeing = true; ped.fleeTimer = 2.5; }
  if (ped.fleeTimer > 0) {
    ped.fleeTimer -= dt;
    var a = angleTo(danger ? danger.x : Game.player.x, danger ? danger.y : Game.player.y, ped.x, ped.y);
    ped.angle = a;
    var sp = 240;
    moveWithCollision(ped, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, 10);
    ped.walkPhase += dt * 14;
    if (ped.fleeTimer <= 0) ped.fleeing = false;
    return;
  }
  if (ped.kind === 'fare') return; // fares wait where they stand
  if (ped.wait > 0) { ped.wait -= dt; return; }
  // Stroll along the sidewalk of their road.
  if (!ped.target) {
    ped.target = nextIntersection(ped.x, ped.y, ped.dir);
    if (!ped.target) { ped.dir = oppositeDir(ped.dir); ped.target = nextIntersection(ped.x, ped.y, ped.dir); }
  }
  var t = ped.target;
  var want = angleTo(ped.x, ped.y, t.x, t.y);
  ped.angle = want;
  var laneOff = 72;
  // Walk on the sidewalk: offset perpendicular to the walking direction.
  var tx = t.x + Math.cos(want + Math.PI / 2) * 0;
  var ty = t.y + Math.sin(want + Math.PI / 2) * 0;
  moveWithCollision(ped, Math.cos(want) * ped.speed * dt, Math.sin(want) * ped.speed * dt, 10);
  ped.walkPhase += dt * 8;
  if (dist(ped.x, ped.y, t.x, t.y) < 24) {
    ped.target = null;
    if (rndChance(0.4)) ped.dir = rndPick(['n', 's', 'e', 'w']);
    if (rndChance(0.25)) ped.wait = rndRange(1, 4);
  }
}

function nearestDanger(x, y) {
  var best = null, bd = 1e9;
  // Gunfire / explosions near the player count as danger for everyone nearby.
  for (var i = 0; i < Game.bullets.length; i++) {
    var b = Game.bullets[i];
    var d = dist(x, y, b.x, b.y);
    if (d < bd) { bd = d; best = b; }
  }
  var p = Game.player;
  if (p.car && Math.abs(p.car.speed) > 200) {
    var d2 = dist(x, y, p.x, p.y);
    if (d2 < bd) { bd = d2; best = p; }
  }
  if (best && bd < 260) return { x: best.x, y: best.y, d: bd };
  return null;
}

// ---- foot police ----
function updateCop(cop, dt) {
  if (cop.dead) return;
  var p = Game.player;
  var d = dist(cop.x, cop.y, p.x, p.y);
  var stars = Game.wanted.stars;
  if (stars === 0) { cop.dead = true; return; } // stands down when the heat is gone
  if (d > 900) { cop.dead = true; return; }     // too far: despawn
  var want = angleTo(cop.x, cop.y, p.x, p.y);
  cop.angle = want;
  if (stars >= 3 && d < 420 && d > 60) {
    // Shoot at the player from range.
    cop.shootTimer -= dt;
    if (cop.shootTimer <= 0) {
      cop.shootTimer = rndRange(0.9, 1.5);
      fireBullet(cop.x, cop.y, want + rndRange(-0.12, 0.12), 520, 9, 'cop');
      Game.audio.shoot(false);
    }
    if (d > 200) moveWithCollision(cop, Math.cos(want) * cop.speed * 0.8 * dt, Math.sin(want) * cop.speed * 0.8 * dt, 10);
  } else {
    // Close in to arrest.
    moveWithCollision(cop, Math.cos(want) * cop.speed * dt, Math.sin(want) * cop.speed * dt, 10);
    cop.walkPhase += dt * 10;
  }
  if (d < 30 && !p.car) {
    cop.arrestTimer += dt;
    if (cop.arrestTimer > 1.4) {
      if (stars <= 2) getBusted();
      else damagePlayer(25 * dt * 2);
    }
  } else {
    cop.arrestTimer = Math.max(0, cop.arrestTimer - dt * 2);
  }
}

// ---- shared damage ----
function damagePerson(person, dmg, source) {
  if (person.dead) return;
  person.hp -= dmg;
  if (person.hp <= 0) {
    person.hp = 0; person.dead = true;
    spawnBlood(person.x, person.y);
    if (person.kind === 'cop') { addWanted(HEAT_KILL_COP); Game.stats.kills++; }
    else if (person.kind === 'civilian' || person.kind === 'fare') { addWanted(HEAT_KILL_PED); }
    else { Game.stats.kills++; }
    if (rndChance(0.35)) spawnPickup(person.x, person.y, rndPick(['health', 'ammo', 'cash']));
  }
}

function damagePlayer(dmg) {
  var p = Game.player;
  if (!p || p.hp <= 0 || Game.screen !== 'play') return;
  var absorbed = 0;
  if (p.armor > 0) { absorbed = Math.min(p.armor, dmg * 0.6); p.armor -= absorbed; }
  p.hp -= (dmg - absorbed);
  p.lastDamageAt = Game.time;
  Game.camera.shake = Math.max(Game.camera.shake, 4);
  if (p.hp <= 0) {
    p.hp = 0;
    getWasted();
  }
}
