// SOLMARA — shots.js
// Deterministic screenshot scenes (?shot=cover|drive|mission|night&seed=1).
// Each scene stages the real game state (real entities, real render path) and
// then freezes the simulation, so the same seed always gives the same frame.

function resetWorldForShot(seed) {
  buildCity(seed || 1);
  Game.cars = []; Game.peds = []; Game.cops = []; Game.enemies = [];
  Game.bullets = []; Game.particles = []; Game.pickups = []; Game.decals = [];
  Game.wanted = { heat: 0, stars: 0, hiddenTimer: 0 };
  Game.mission = null; Game.race = null; Game.taxi = null;
  Game.dialog = null; Game.toast = ''; Game.banner = ''; Game.bannerTimer = 0;
  Game.time = 12.5; // fixed time of day for repeatable waves and flashes
  Game.night = false;
  Game.cash = 1250;
  Game.missionIndex = 0; Game.missionDone = [];
  Game.stats = { carsStolen: 3, shotsFired: 41, kills: 5, missionsDone: 4, racesWon: 1, faresDone: 2 };
  spawnTraffic(14);
  spawnParked(10);
  spawnPeds(16);
  spawnFare(); spawnFare();
  spawnPickup(1200, 620, 'health');
  spawnPickup(2600, 1000, 'armor');
  spawnPickup(1800, 2600, 'ammo');
}

function placePlayerInCar(car, weapon) {
  var p = makePlayer(car.x, car.y);
  p.car = car;
  car.driver = 'player';
  p.angle = car.angle;
  if (weapon) { p.weapon = weapon; if (p.weapons.indexOf(weapon) < 0) p.weapons.push(weapon); }
  Game.player = p;
  return p;
}

function placePlayerOnFoot(x, y, weapon) {
  var p = makePlayer(x, y);
  p.angle = -Math.PI / 2;
  if (weapon) { p.weapon = weapon; if (p.weapons.indexOf(weapon) < 0) p.weapons.push(weapon); }
  Game.player = p;
  return p;
}

function setWantedStars(stars) {
  Game.wanted.heat = stars === 0 ? 0 : (stars - 1) * 20 + 10;
  Game.wanted.stars = stars;
}

function setMissionForShot(index, stepText) {
  var def = MISSIONS[index];
  Game.missionIndex = index;
  Game.mission = { def: def, step: 0, state: {}, startedAt: 0 };
  Game.objective = stepText || def.steps[0].text;
}

// Stage the named scene and freeze the game on it.
function stageShot(name) {
  Game.shotMode = name || 'cover';
  var seed = 1;
  try {
    var q = new URLSearchParams(window.location.search);
    seed = parseInt(q.get('seed') || '1', 10) || 1;
  } catch (e) { seed = 1; }
  resetWorldForShot(seed);
  Game.screen = 'play';
  var cam = Game.camera;
  cam.zoom = 1;

  if (name === 'drive') {
    // Coastal boulevard drive: sedan at speed, beach and sea in frame.
    var car = makeCar('sedan', 1150, 3426, 0);
    car.color = '#2e6fb0'; car.driver = 'player'; car.speed = 480;
    Game.cars.push(car);
    placePlayerInCar(car, 'pistol');
    var taxi = makeCar('taxi', 1500, 3374, Math.PI);
    taxi.driver = 'traffic'; taxi.ai.mode = 'traffic'; taxi.ai.dir = 'w';
    taxi.ai.target = nextIntersection(1500, 3374, 'w'); taxi.speed = 200;
    Game.cars.push(taxi);
    var van = makeCar('van', 900, 3426, 0);
    van.driver = 'traffic'; van.ai.mode = 'traffic'; van.ai.dir = 'e';
    van.ai.target = nextIntersection(900, 3426, 'e'); van.speed = 170;
    Game.cars.push(van);
    Game.objective = 'Free roam — cruise the beach boulevard';
    cam.x = car.x + 120; cam.y = car.y - 40;
  } else if (name === 'mission') {
    // Harbor shootout: on foot with a rifle, clearing the warehouse.
    setMissionForShot(7, 'Clear the warehouse');
    var p = placePlayerOnFoot(2940, 1620, 'rifle');
    p.ammo.rifle = 24; p.reserve.rifle = 60;
    p.aimAngle = angleTo(p.x, p.y, 3120, 1520); p.angle = p.aimAngle;
    spawnEnemy(3120, 1500, 'rifle');
    spawnEnemy(3080, 1680, 'pistol');
    spawnEnemy(3200, 1580, 'rifle');
    spawnMuzzle(p.x + Math.cos(p.aimAngle) * 22, p.y + Math.sin(p.aimAngle) * 22, p.aimAngle);
    fireBullet(p.x + Math.cos(p.aimAngle) * 30, p.y + Math.sin(p.aimAngle) * 30, p.aimAngle, 1300, 60, 'player');
    var truck = makeCar('truck', 3050, 1420, Math.PI / 2);
    truck.driver = 'none'; truck.ai.mode = 'parked';
    Game.cars.push(truck);
    spawnSmoke(3180, 1560, 3);
    setWantedStars(2);
    cam.x = 3030; cam.y = 1590; cam.zoom = 1.05;
  } else if (name === 'night') {
    // Night at the beach: neon palms, headlights, a patrol car closing in.
    Game.night = true;
    var p2 = placePlayerOnFoot(2380, 3420, 'pistol');
    p2.angle = Math.PI;
    var sport = makeCar('sport', 2520, 3426, Math.PI);
    sport.color = '#f1c40f'; sport.driver = 'none'; sport.ai.mode = 'parked';
    Game.cars.push(sport);
    var cop = spawnPoliceCar(1980, 3426);
    cop.angle = 0; cop.speed = 420;
    setWantedStars(1);
    Game.objective = 'Free roam — Solmara after dark';
    cam.x = 2300; cam.y = 3400;
  } else {
    // COVER: police chase on a boulevard — wanted stars, minimap, mission
    // objective, traffic and the rival's car all in one frame.
    setMissionForShot(4, "Chase down the rival's Veloce");
    var chase = makeCar('sport', 1500, 1826, 0);
    chase.color = '#e74c3c'; chase.driver = 'player'; chase.speed = 470;
    Game.cars.push(chase);
    placePlayerInCar(chase, 'pistol');
    var rival = makeCar('sport', 2150, 1826, 0);
    rival.color = '#7a1f8f'; rival.driver = 'mission'; rival.ai.mode = 'flee'; rival.speed = 430;
    Game.cars.push(rival);
    Game.mission.state.targetCar = rival;
    var pc1 = spawnPoliceCar(1180, 1826);
    pc1.angle = 0; pc1.speed = 520;
    var pc2 = spawnPoliceCar(1020, 1774);
    pc2.angle = 0; pc2.speed = 500;
    var t1 = makeCar('sedan', 1850, 1774, Math.PI);
    t1.driver = 'traffic'; t1.ai.mode = 'traffic'; t1.ai.dir = 'w';
    t1.ai.target = nextIntersection(1850, 1774, 'w'); t1.speed = 160;
    Game.cars.push(t1);
    var t2 = makeCar('van', 2400, 1874, 0);
    t2.driver = 'traffic'; t2.ai.mode = 'traffic'; t2.ai.dir = 'e';
    t2.ai.target = nextIntersection(2400, 1874, 'e'); t2.speed = 150;
    Game.cars.push(t2);
    setWantedStars(3);
    addSkid(chase);
    spawnSmoke(1180, 1826, 2);
    spawnSparks(1350, 1830, 4);
    cam.x = 1650; cam.y = 1810; cam.zoom = 0.95;
  }
  // Keep the camera exactly where staged (no follow smoothing in shot mode).
  Game.camera.x = cam.x; Game.camera.y = cam.y;
}
