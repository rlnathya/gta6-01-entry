// SOLMARA — vehicles.js
// Vehicle types, spawning, driving physics, traffic AI and police chases.
// A car is a rotated rectangle; physics samples three points along its spine
// for wall collision and uses circles for car-to-car bumps.

var CAR_TYPES = {
  sedan:  { name: 'Marlow S',    maxSpeed: 460, accel: 270, turn: 2.7, hp: 100, w: 46, h: 22, colors: ['#c0392b', '#2e6fb0', '#7d8a99', '#3a9e6e', '#d8d8d8', '#e0a030'] },
  sport:  { name: 'Veloce GT',   maxSpeed: 650, accel: 390, turn: 3.2, hp: 80,  w: 48, h: 21, colors: ['#e74c3c', '#f1c40f', '#1abc9c', '#8e44ad'] },
  taxi:   { name: 'City Cab',    maxSpeed: 470, accel: 280, turn: 2.7, hp: 100, w: 46, h: 22, colors: ['#f5c542'] },
  truck:  { name: 'Hauler',      maxSpeed: 380, accel: 180, turn: 2.0, hp: 170, w: 60, h: 26, colors: ['#5d6d7e', '#a04000', '#1e8449'] },
  van:    { name: 'Cargo Van',   maxSpeed: 420, accel: 220, turn: 2.2, hp: 120, w: 52, h: 24, colors: ['#95a5a6', '#2c3e50', '#b03a2e'] },
  police: { name: 'Interceptor', maxSpeed: 610, accel: 350, turn: 3.1, hp: 130, w: 48, h: 22, colors: ['#1a1a2e'] }
};

var _carId = 1;

function makeCar(type, x, y, angle) {
  var t = CAR_TYPES[type];
  return {
    id: _carId++, type: type, name: t.name,
    x: x, y: y, angle: angle || 0, speed: 0,
    maxSpeed: t.maxSpeed, accel: t.accel, turn: t.turn,
    hp: t.hp, maxHp: t.hp, w: t.w, h: t.h,
    color: rndPick(t.colors), dead: false, smoke: 0,
    driver: 'none', // none | traffic | player | police | mission
    ai: { mode: 'parked', dir: 'e', target: null, wait: 0, cruise: rndRange(130, 190) },
    skid: 0
  };
}

// Park a car along a road edge, aligned with the road.
function spawnParkedCar(type) {
  var p = randomRoadPoint();
  var horizontal = isRoad(p.x, p.y) === 'h';
  var angle = horizontal ? (rndChance(0.5) ? 0 : Math.PI) : (rndChance(0.5) ? Math.PI / 2 : -Math.PI / 2);
  var off = rndPick([-1, 1]) * (ROAD_W / 2 - 14);
  var x = horizontal ? p.x : p.x + off;
  var y = horizontal ? p.y + off : p.y;
  var car = makeCar(type || rndPick(['sedan', 'sedan', 'sport', 'van', 'taxi']), x, y, angle);
  car.driver = 'none';
  car.ai.mode = 'parked';
  Game.cars.push(car);
  return car;
}

// A traffic car driving its lane toward the next intersection.
function spawnTrafficCar() {
  var p = randomRoadPoint();
  var dir = rndPick(['n', 's', 'e', 'w']);
  var car = makeCar(rndPick(['sedan', 'sedan', 'sedan', 'sport', 'taxi', 'van', 'truck']), p.x, p.y, 0);
  car.driver = 'traffic';
  car.ai.mode = 'traffic';
  car.ai.dir = dir;
  car.ai.target = nextIntersection(p.x, p.y, dir);
  if (!car.ai.target) { car.ai.dir = oppositeDir(dir); car.ai.target = nextIntersection(p.x, p.y, car.ai.dir); }
  car.angle = dirAngle(dir);
  // Snap onto the correct lane.
  if (dir === 'e') car.y = nearestRoad(p.y) + LANE;
  if (dir === 'w') car.y = nearestRoad(p.y) - LANE;
  if (dir === 's') car.x = nearestRoad(p.x) - LANE;
  if (dir === 'n') car.x = nearestRoad(p.x) + LANE;
  car.speed = car.ai.cruise;
  Game.cars.push(car);
  return car;
}

function oppositeDir(d) { return d === 'n' ? 's' : d === 's' ? 'n' : d === 'e' ? 'w' : 'e'; }
function dirAngle(d) { return d === 'e' ? 0 : d === 's' ? Math.PI / 2 : d === 'w' ? Math.PI : -Math.PI / 2; }

function spawnPoliceCar(x, y) {
  var car = makeCar('police', x, y, 0);
  car.driver = 'police';
  car.ai.mode = 'chase';
  Game.cars.push(car);
  return car;
}

function spawnTraffic(n) { for (var i = 0; i < n; i++) spawnTrafficCar(); }
function spawnParked(n) { for (var i = 0; i < n; i++) spawnParkedCar(); }

// ---- driving ----
function drivePlayerCar(car, dt) {
  var p = Game.player;
  var throttle = (keyDown('KeyW', 'ArrowUp') ? 1 : 0) - (keyDown('KeyS', 'ArrowDown') ? 1 : 0);
  var steer = (keyDown('KeyA', 'ArrowLeft') ? -1 : 0) + (keyDown('KeyD', 'ArrowRight') ? 1 : 0);
  var handbrake = keyDown('Space', 'ShiftLeft');
  if (throttle > 0) car.speed += car.accel * dt;
  else if (throttle < 0) {
    if (car.speed > 20) car.speed -= car.accel * 1.4 * dt;   // brake
    else car.speed -= car.accel * 0.55 * dt;                  // reverse
  }
  if (handbrake) car.speed *= Math.pow(0.12, dt);
  car.speed -= car.speed * 0.35 * dt;                          // drag
  car.speed = clamp(car.speed, -140, car.maxSpeed);
  if (Math.abs(car.speed) > 4) {
    var grip = car.turn * (1 - Math.min(0.55, Math.abs(car.speed) / car.maxSpeed * 0.55));
    car.angle += steer * grip * (car.speed / car.maxSpeed) * dt * (car.speed < 0 ? -1 : 1) * 2.2;
    if (handbrake && Math.abs(car.speed) > 120) {
      car.angle += steer * 1.4 * dt;
      addSkid(car);
    }
  }
  var nx = car.x + Math.cos(car.angle) * car.speed * dt;
  var ny = car.y + Math.sin(car.angle) * car.speed * dt;
  var hit = moveCarWithCollision(car, nx, ny);
  if (hit) {
    var impact = Math.abs(car.speed);
    if (impact > 160) {
      damageCar(car, impact * 0.06);
      Game.audio.crash(impact > 320);
      spawnSparks(car.x + Math.cos(car.angle) * car.w / 2, car.y + Math.sin(car.angle) * car.w / 2, 6);
      Game.camera.shake = Math.min(10, impact * 0.02);
    }
    car.speed *= -0.25;
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (car.hp < car.maxHp * 0.4 && rndChance(dt * 6)) spawnSmoke(car.x, car.y, 1);
  if (car.hp <= 0 && !car.dead) explodeCar(car);
}

function moveCarWithCollision(car, nx, ny) {
  // Sample front, middle and rear points along the car's spine.
  var pts = [
    { x: nx + Math.cos(car.angle) * car.w * 0.42, y: ny + Math.sin(car.angle) * car.w * 0.42 },
    { x: nx, y: ny },
    { x: nx - Math.cos(car.angle) * car.w * 0.42, y: ny - Math.sin(car.angle) * car.w * 0.42 }
  ];
  for (var i = 0; i < pts.length; i++) if (solidAt(pts[i].x, pts[i].y, car.h * 0.55)) return true;
  car.x = nx; car.y = ny;
  return false;
}

function damageCar(car, dmg) {
  if (car.dead) return;
  car.hp -= dmg;
  if (car.hp <= 0) { car.hp = 0; explodeCar(car); }
}

function explodeCar(car) {
  if (car.dead) return;
  car.dead = true;
  car.speed = 0;
  spawnExplosion(car.x, car.y);
  Game.audio.crash(true);
  Game.camera.shake = 14;
  // Hurt everyone nearby, including the player if they are in it.
  var victims = Game.enemies.concat(Game.cops).concat(Game.peds);
  for (var i = 0; i < victims.length; i++) {
    var v = victims[i];
    if (v.hp > 0 && dist(v.x, v.y, car.x, car.y) < 110) damagePerson(v, 90, null);
  }
  if (Game.player.car === car || dist(Game.player.x, Game.player.y, car.x, car.y) < 110) {
    damagePlayer(55);
  }
  if (Game.player.car === car) exitCar();
}

// ---- traffic AI ----
function updateTrafficCar(car, dt) {
  if (car.dead) return;
  if (car.ai.mode === 'parked') return;
  if (car.ai.mode === 'traffic') {
    var t = car.ai.target;
    if (!t) { car.ai.dir = oppositeDir(car.ai.dir); car.ai.target = nextIntersection(car.x, car.y, car.ai.dir); return; }
    var want = angleTo(car.x, car.y, t.x, t.y);
    car.angle += clamp(angleDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
    // Slow down for the car ahead in the same lane.
    var ahead = nearestCarAhead(car);
    var targetSpeed = car.ai.cruise;
    if (ahead && ahead.d < 85) targetSpeed = Math.min(targetSpeed, Math.max(0, ahead.car.speed * 0.9));
    if (dist(car.x, car.y, t.x, t.y) < 30) targetSpeed = Math.min(targetSpeed, 90);
    car.speed = lerp(car.speed, targetSpeed, Math.min(1, dt * 1.6));
    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!moveCarWithCollision(car, nx, ny)) { /* moved */ }
    else { car.speed *= 0.4; }
    if (dist(car.x, car.y, t.x, t.y) < 26) {
      // Reached the intersection: pick a new direction.
      var dirs = ['n', 's', 'e', 'w'].filter(function (d) { return d !== oppositeDir(car.ai.dir); });
      var nd = rndChance(0.55) ? car.ai.dir : rndPick(dirs);
      car.ai.dir = nd;
      car.ai.target = nextIntersection(car.x, car.y, nd);
      if (!car.ai.target) { car.ai.dir = oppositeDir(nd); car.ai.target = nextIntersection(car.x, car.y, car.ai.dir); }
    }
  } else if (car.ai.mode === 'chase') {
    updatePoliceCar(car, dt);
  } else if (car.ai.mode === 'flee') {
    var p = Game.player;
    var want = angleTo(car.x, car.y, car.x + (car.x - p.x), car.y + (car.y - p.y));
    car.angle += clamp(angleDiff(car.angle, want), -3 * dt, 3 * dt);
    car.speed = lerp(car.speed, car.maxSpeed * 0.85, dt);
    var nx2 = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny2 = car.y + Math.sin(car.angle) * car.speed * dt;
    if (moveCarWithCollision(car, nx2, ny2)) car.speed *= -0.3;
  }
}

function nearestCarAhead(car) {
  var best = null, bd = 1e9;
  for (var i = 0; i < Game.cars.length; i++) {
    var o = Game.cars[i];
    if (o === car || o.dead) continue;
    var dx = o.x - car.x, dy = o.y - car.y;
    var fwd = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    var side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (fwd > 0 && fwd < 130 && side < 26 && fwd < bd) { bd = fwd; best = o; }
  }
  return best ? { car: best, d: bd } : null;
}

// Police car: steer toward the player and ram.
function updatePoliceCar(car, dt) {
  var p = Game.player;
  var px = p.x + Math.cos(p.angle || 0) * 40, py = p.y + Math.sin(p.angle || 0) * 40;
  var want = angleTo(car.x, car.y, px, py);
  car.angle += clamp(angleDiff(car.angle, want), -3.4 * dt, 3.4 * dt);
  var d = dist(car.x, car.y, p.x, p.y);
  var targetSpeed = d > 260 ? car.maxSpeed : car.maxSpeed * 0.8;
  car.speed = lerp(car.speed, targetSpeed, Math.min(1, dt * 2));
  var nx = car.x + Math.cos(car.angle) * car.speed * dt;
  var ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (moveCarWithCollision(car, nx, ny)) car.speed *= 0.3;
  if (car.hp < car.maxHp * 0.4 && rndChance(dt * 6)) spawnSmoke(car.x, car.y, 1);
  if (car.hp <= 0 && !car.dead) explodeCar(car);
}

// ---- car-to-car bumps ----
function resolveCarCollisions() {
  var cars = Game.cars;
  for (var i = 0; i < cars.length; i++) {
    for (var j = i + 1; j < cars.length; j++) {
      var a = cars[i], b = cars[j];
      if (a.dead || b.dead) continue;
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var min = (a.w + b.w) * 0.32;
      if (d > 0.01 && d < min) {
        var push = (min - d) / 2;
        var ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        var rel = Math.abs(a.speed - b.speed);
        if (rel > 120) {
          damageCar(a, rel * 0.03); damageCar(b, rel * 0.03);
          spawnSparks((a.x + b.x) / 2, (a.y + b.y) / 2, 4);
          if (a.driver === 'player' || b.driver === 'player') Game.audio.crash(false);
        }
        a.speed *= 0.94; b.speed *= 0.94;
      }
    }
  }
}

// ---- entering and exiting ----
function nearestCarTo(x, y, maxD) {
  var best = null, bd = maxD;
  for (var i = 0; i < Game.cars.length; i++) {
    var c = Game.cars[i];
    if (c.dead) continue;
    var d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  var p = Game.player;
  if (car.driver === 'traffic') {
    // Yank the driver out onto the sidewalk.
    var driver = makePed(car.x + 30, car.y + 30, 'civilian');
    driver.fleeing = true; driver.fleeTimer = 3;
    Game.peds.push(driver);
    addWanted(HEAT_STEAL_CAR);
    Game.stats.carsStolen++;
    showToast('You stole the ' + car.name + '! The police noticed.');
  } else if (car.driver === 'police') {
    addWanted(40);
    Game.stats.carsStolen++;
    showToast('You stole a police Interceptor!');
  }
  car.driver = 'player';
  p.car = car;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  Game.audio.click();
}

function exitCar() {
  var p = Game.player;
  var car = p.car;
  if (!car) return;
  car.driver = 'none';
  car.ai.mode = 'parked';
  car.speed = 0;
  p.car = null;
  // Step out on the driver's side.
  var sx = car.x - Math.sin(car.angle) * 26, sy = car.y + Math.cos(car.angle) * 26;
  if (!solidAt(sx, sy, PLAYER_RADIUS)) { p.x = sx; p.y = sy; }
  else { p.x = car.x + Math.sin(car.angle) * 26; p.y = car.y - Math.cos(car.angle) * 26; }
  p.angle = car.angle;
}

function addSkid(car) {
  Game.decals.push({
    kind: 'skid',
    x1: car.x - Math.cos(car.angle) * car.w * 0.4 - Math.sin(car.angle) * 10,
    y1: car.y - Math.sin(car.angle) * car.w * 0.4 + Math.cos(car.angle) * 10,
    x2: car.x - Math.cos(car.angle) * car.w * 0.4 + Math.sin(car.angle) * 10,
    y2: car.y - Math.sin(car.angle) * car.w * 0.4 - Math.cos(car.angle) * 10,
    life: 6
  });
  if (Game.decals.length > 220) Game.decals.shift();
}
