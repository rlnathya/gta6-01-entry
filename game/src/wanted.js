// SOLMARA — wanted.js
// Wanted heat (0-100) and stars (0-5), police dispatch, hiding, and the
// wasted / busted endings that send the player to hospital or the station.

function heatToStars(heat) {
  if (heat <= 0) return 0;
  if (heat <= 20) return 1;
  if (heat <= 40) return 2;
  if (heat <= 60) return 3;
  if (heat <= 80) return 4;
  return 5;
}

function addWanted(heat) {
  var w = Game.wanted;
  var before = w.stars;
  w.heat = clamp(w.heat + heat, 0, WANTED_MAX_HEAT);
  w.stars = heatToStars(w.heat);
  w.hiddenTimer = 0;
  if (w.stars > before && w.stars >= 2) showToast('Wanted level ' + w.stars + ' — the police are coming!');
}

function updateWanted(dt) {
  var w = Game.wanted;
  if (w.stars === 0) return;
  // Are the police close enough to see the player?
  var seen = false;
  for (var i = 0; i < Game.cops.length; i++) {
    if (!Game.cops[i].dead && dist(Game.cops[i].x, Game.cops[i].y, Game.player.x, Game.player.y) < 560) { seen = true; break; }
  }
  if (!seen) {
    for (var j = 0; j < Game.cars.length; j++) {
      var c = Game.cars[j];
      if (c.driver === 'police' && !c.dead && dist(c.x, c.y, Game.player.x, Game.player.y) < 560) { seen = true; break; }
    }
  }
  if (seen) {
    w.hiddenTimer = 0;
  } else {
    w.hiddenTimer += dt;
    if (w.hiddenTimer > 3) {
      w.heat = Math.max(0, w.heat - HEAT_DECAY_PER_SEC * dt);
      w.stars = heatToStars(w.heat);
      if (w.stars === 0) {
        showToast('You lost the police.');
        Game.audio.missionDone();
      }
    }
  }
  dispatchPolice(dt);
}

var _dispatchTimer = 0;
function dispatchPolice(dt) {
  _dispatchTimer -= dt;
  if (_dispatchTimer > 0) return;
  _dispatchTimer = 0.8;
  var w = Game.wanted;
  var wantCars = w.stars >= 1 ? Math.min(1 + w.stars, 6) : 0;
  var wantCops = w.stars >= 1 ? Math.min(w.stars * 2, 8) : 0;
  var cars = 0, cops = 0;
  for (var i = 0; i < Game.cars.length; i++) if (Game.cars[i].driver === 'police' && !Game.cars[i].dead) cars++;
  for (var j = 0; j < Game.cops.length; j++) if (!Game.cops[j].dead) cops++;
  var p = Game.player;
  if (cars < wantCars) {
    // Spawn a patrol car off-screen, on a road.
    var a = rndRange(0, Math.PI * 2);
    var x = p.x + Math.cos(a) * rndRange(700, 950);
    var y = p.y + Math.sin(a) * rndRange(700, 950);
    x = clamp(x, 60, WORLD_SIZE - 60); y = clamp(y, 60, WORLD_SIZE - 60);
    var rp = nearestRoadPoint(x, y);
    spawnPoliceCar(rp.x, rp.y);
  }
  if (cops < wantCops) {
    var a2 = rndRange(0, Math.PI * 2);
    var x2 = clamp(p.x + Math.cos(a2) * rndRange(420, 620), 60, WORLD_SIZE - 60);
    var y2 = clamp(p.y + Math.sin(a2) * rndRange(420, 620), 60, WORLD_SIZE - 60);
    if (!solidAt(x2, y2, 12)) makeCop(x2, y2);
  }
}

function nearestRoadPoint(x, y) {
  var rx = nearestRoad(x), ry = nearestRoad(y);
  // Snap to the closer road line.
  if (Math.abs(x - rx) < Math.abs(y - ry)) return { x: rx, y: clamp(y, 80, WORLD_SIZE - 80) };
  return { x: clamp(x, 80, WORLD_SIZE - 80), y: ry };
}

function getWasted() {
  if (Game.screen !== 'play') return;
  Game.screen = 'over';
  Game.overKind = 'wasted';
  Game.audio.wasted();
  Game.audio.engineStop();
  var lost = Math.min(Game.cash, Math.max(50, Math.floor(Game.cash * 0.1)));
  Game.cash -= lost;
  Game._overLoss = lost;
}

function getBusted() {
  if (Game.screen !== 'play') return;
  Game.screen = 'over';
  Game.overKind = 'busted';
  Game.audio.busted();
  Game.audio.engineStop();
  var lost = Math.min(Game.cash, Math.max(50, Math.floor(Game.cash * 0.1)));
  Game.cash -= lost;
  Game._overLoss = lost;
  Game.wanted.heat = 0; Game.wanted.stars = 0;
}

// Respawn after wasted/busted: hospital or police station, mission step reset.
function respawnAfterOver() {
  var p = Game.player;
  var lm = Game.overKind === 'busted' ? Game.city.landmarks.police : Game.city.landmarks.hospital;
  p.x = lm.door.x; p.y = lm.door.y + 30;
  p.hp = PLAYER_HEALTH; p.armor = 0;
  p.angle = -Math.PI / 2;
  if (p.car) { p.car.driver = 'none'; p.car.ai.mode = 'parked'; p.car = null; }
  Game.wanted.heat = 0; Game.wanted.stars = 0;
  Game.cops = [];
  for (var i = 0; i < Game.cars.length; i++) {
    if (Game.cars[i].driver === 'police') { Game.cars[i].driver = 'none'; Game.cars[i].ai.mode = 'parked'; }
  }
  if (Game.mission) resetMissionToStep(Game.mission);
  Game.screen = 'play';
  showToast(Game.overKind === 'busted' ? 'Released. The mission is still waiting.' : 'Patched up. The mission is still waiting.');
}
