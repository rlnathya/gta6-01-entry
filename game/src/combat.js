// SOLMARA — combat.js
// Shooting, melee, bullets, explosions, particles and pickups.
// Weapons: fists, pistol, rifle. All projectiles are simple tracers.

var WEAPONS = {
  fists:  { name: 'Fists',  damage: 25, rate: 2.2, range: 46,  spread: 0,    bulletSpeed: 0,   auto: false },
  pistol: { name: 'Pistol', damage: 34, rate: 4.5, range: 520, spread: 0.05, bulletSpeed: 950, auto: false, mag: 12 },
  rifle:  { name: 'Rifle',  damage: 60, rate: 8,   range: 700, spread: 0.03, bulletSpeed: 1300, auto: true,  mag: 30 }
};

function fireBullet(x, y, angle, speed, damage, owner) {
  Game.bullets.push({
    x: x, y: y, angle: angle, speed: speed, damage: damage,
    owner: owner || 'player', life: 0.9,
    px: x, py: y
  });
}

function updateBullets(dt) {
  for (var i = Game.bullets.length - 1; i >= 0; i--) {
    var b = Game.bullets[i];
    b.px = b.x; b.py = b.y;
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    b.life -= dt;
    var dead = b.life <= 0 || solidAt(b.x, b.y, 2);
    if (!dead) {
      // Hit people.
      var targets = b.owner === 'player'
        ? Game.enemies.concat(Game.cops)
        : [Game.player];
      for (var j = 0; j < targets.length; j++) {
        var t = targets[j];
        if (t.hp <= 0 || t.dead) continue;
        var r = t === Game.player ? PLAYER_RADIUS : 13;
        if (dist(b.x, b.y, t.x, t.y) < r + 3) {
          if (t === Game.player) damagePlayer(b.damage);
          else damagePerson(t, b.damage, 'player');
          spawnHitPuff(b.x, b.y);
          dead = true;
          break;
        }
      }
      // Hit cars.
      if (!dead) {
        for (var k = 0; k < Game.cars.length; k++) {
          var c = Game.cars[k];
          if (c.dead) continue;
          if (circleHitsRect(b.x, b.y, 3, { x: c.x - c.w / 2, y: c.y - c.h / 2, w: c.w, h: c.h })) {
            damageCar(c, b.damage * 0.5);
            spawnSparks(b.x, b.y, 3);
            dead = true;
            break;
          }
        }
      }
    }
    if (dead) {
      if (solidAt(b.x, b.y, 2)) spawnSparks(b.x, b.y, 3);
      Game.bullets.splice(i, 1);
    }
  }
}

// Player shooting / punching toward the mouse.
function playerAttack(dt) {
  var p = Game.player;
  if (!p || p.car) return;
  p.aimAngle = angleTo(p.x, p.y, Game.mouse.wx, Game.mouse.wy);
  p.angle = p.aimAngle;
  var w = WEAPONS[p.weapon];
  p.fireTimer -= dt;
  var wantFire = w.auto ? Game.mouse.down : Game.mouse.clicked;
  if (wantFire && p.fireTimer <= 0) {
    p.fireTimer = 1 / w.rate;
    if (p.weapon === 'fists') {
      Game.audio.punch();
      // Punch: hurt the nearest person in front of the player.
      var victims = Game.enemies.concat(Game.cops).concat(Game.peds);
      for (var i = 0; i < victims.length; i++) {
        var v = victims[i];
        if (v.hp <= 0 || v.dead) continue;
        var d = dist(p.x, p.y, v.x, v.y);
        if (d < w.range) {
          var a = angleTo(p.x, p.y, v.x, v.y);
          if (Math.abs(angleDiff(p.aimAngle, a)) < 0.9) {
            damagePerson(v, w.damage, 'player');
            spawnHitPuff(v.x, v.y);
            if (v.kind === 'civilian' || v.kind === 'fare') addWanted(HEAT_HIT_PED);
            break;
          }
        }
      }
      return;
    }
    // Fire a bullet.
    if (p.ammo[p.weapon] <= 0) { reloadWeapon(p); return; }
    p.ammo[p.weapon]--;
    Game.stats.shotsFired++;
    var a = p.aimAngle + rndRange(-w.spread, w.spread);
    var mx = p.x + Math.cos(a) * 20, my = p.y + Math.sin(a) * 20;
    fireBullet(mx, my, a, w.bulletSpeed, w.damage, 'player');
    Game.audio.shoot(p.weapon === 'rifle');
    addWanted(HEAT_SHOT_FIRED);
    spawnMuzzle(mx, my, a);
    if (p.ammo[p.weapon] === 0) reloadWeapon(p);
  }
}

function reloadWeapon(p) {
  var w = WEAPONS[p.weapon];
  if (!w.mag) return;
  if (p.reserve[p.weapon] <= 0) { showToast('No ammo for the ' + w.name + ' — find ammo!'); return; }
  var need = w.mag - p.ammo[p.weapon];
  var take = Math.min(need, p.reserve[p.weapon]);
  p.reserve[p.weapon] -= take;
  p.ammo[p.weapon] += take;
  p.fireTimer = Math.max(p.fireTimer, 0.7);
  Game.audio.click();
}

// ---- enemies (mission hostiles) ----
function spawnEnemy(x, y, weapon) {
  var e = {
    kind: 'enemy', x: x, y: y, angle: 0, speed: 150, hp: 100,
    shirt: rndPick(['#7a1f1f', '#3d2c1e', '#243447']), pants: '#1c1c1c',
    weapon: weapon || 'pistol', shootTimer: rndRange(0.5, 1.5),
    walkPhase: 0, dead: false, fleeing: false
  };
  Game.enemies.push(e);
  return e;
}

function updateEnemy(e, dt) {
  if (e.dead) return;
  var p = Game.player;
  var d = dist(e.x, e.y, p.x, p.y);
  if (d > 900) return;
  var want = angleTo(e.x, e.y, p.x, p.y);
  e.angle = want;
  if (e.hp < 30) {
    // Low health: run away.
    moveWithCollision(e, -Math.cos(want) * e.speed * dt, -Math.sin(want) * e.speed * dt, 11);
    e.walkPhase += dt * 10;
    return;
  }
  if (d > 300) {
    moveWithCollision(e, Math.cos(want) * e.speed * dt, Math.sin(want) * e.speed * dt, 11);
    e.walkPhase += dt * 9;
  } else {
    e.shootTimer -= dt;
    if (e.shootTimer <= 0) {
      e.shootTimer = rndRange(0.8, 1.6);
      var w = WEAPONS[e.weapon];
      fireBullet(e.x, e.y, want + rndRange(-0.14, 0.14), w.bulletSpeed, w.damage * 0.55, 'enemy');
      Game.audio.shoot(e.weapon === 'rifle');
      spawnMuzzle(e.x + Math.cos(want) * 16, e.y + Math.sin(want) * 16, want);
    }
  }
}

// ---- particles, decals, pickups ----
function spawnParticles(x, y, n, color, speed, life, size) {
  for (var i = 0; i < n; i++) {
    var a = rndRange(0, Math.PI * 2), s = rndRange(speed * 0.3, speed);
    Game.particles.push({
      x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rndRange(life * 0.5, life), maxLife: life,
      size: rndRange(size * 0.6, size * 1.4), color: color, kind: 'dot'
    });
  }
  if (Game.particles.length > 500) Game.particles.splice(0, Game.particles.length - 500);
}
function spawnSparks(x, y, n) { spawnParticles(x, y, n, '#ffd34d', 260, 0.35, 3); }
function spawnSmoke(x, y, n) {
  for (var i = 0; i < n; i++) {
    Game.particles.push({
      x: x + rndRange(-8, 8), y: y + rndRange(-8, 8),
      vx: rndRange(-12, 12), vy: rndRange(-46, -18),
      life: rndRange(0.8, 1.4), maxLife: 1.4, size: rndRange(7, 13),
      color: '#8a8a8a', kind: 'smoke'
    });
  }
}
function spawnExplosion(x, y) {
  spawnParticles(x, y, 26, '#ff7b1c', 320, 0.7, 6);
  spawnParticles(x, y, 14, '#ffd34d', 200, 0.5, 5);
  spawnSmoke(x, y, 10);
  Game.decals.push({ kind: 'scorch', x: x, y: y, r: 34, life: 14 });
}
function spawnHitPuff(x, y) { spawnParticles(x, y, 6, '#c0392b', 140, 0.3, 3); }
function spawnBlood(x, y) { spawnParticles(x, y, 10, '#a93226', 120, 0.5, 3); }
function spawnMuzzle(x, y, a) {
  Game.particles.push({
    x: x, y: y, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60,
    life: 0.07, maxLife: 0.07, size: 9, color: '#ffe27a', kind: 'flash'
  });
}

function updateParticles(dt) {
  for (var i = Game.particles.length - 1; i >= 0; i--) {
    var pt = Game.particles[i];
    pt.life -= dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= (1 - dt * 2); pt.vy *= (1 - dt * 2);
    if (pt.life <= 0) Game.particles.splice(i, 1);
  }
  for (var j = Game.decals.length - 1; j >= 0; j--) {
    Game.decals[j].life -= dt;
    if (Game.decals[j].life <= 0) Game.decals.splice(j, 1);
  }
}

function spawnPickup(x, y, kind) {
  Game.pickups.push({ x: x, y: y, kind: kind, bob: rndRange(0, 6) });
}
function spawnCashDrop(x, y, amount) {
  Game.pickups.push({ x: x, y: y, kind: 'cash', amount: amount, bob: 0 });
}

function updatePickups(dt) {
  var p = Game.player;
  for (var i = Game.pickups.length - 1; i >= 0; i--) {
    var pk = Game.pickups[i];
    pk.bob += dt;
    if (dist(p.x, p.y, pk.x, pk.y) < 30) {
      if (pk.kind === 'health') { p.hp = Math.min(PLAYER_HEALTH, p.hp + 50); showToast('Health +50'); }
      else if (pk.kind === 'armor') { p.armor = Math.min(PLAYER_ARMOR_MAX, p.armor + 50); showToast('Armor +50'); }
      else if (pk.kind === 'ammo') {
        p.reserve.pistol += 24; p.reserve.rifle += 30;
        showToast('Ammo restocked');
      }
      else if (pk.kind === 'cash') { addCash(pk.amount || 25); }
      Game.audio.pickup();
      Game.pickups.splice(i, 1);
    }
  }
}

function addCash(n) {
  Game.cash += n;
  showToast('+' + fmtMoney(n));
  Game.audio.cash();
}
