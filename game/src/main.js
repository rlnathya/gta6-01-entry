// SOLMARA — main.js
// Entry point: boot, game loop, player movement, menus and save/load.
// Classic script (no modules) so the game runs from file:// with no server.

var STEP = 1 / 60;

function makePlayer(x, y) {
  return {
    x: x, y: y, angle: -Math.PI / 2, aimAngle: -Math.PI / 2,
    hp: PLAYER_HEALTH, armor: 0, walkPhase: 0,
    weapon: 'pistol', weapons: ['fists', 'pistol'],
    ammo: { pistol: 12, rifle: 0 }, reserve: { pistol: 48, rifle: 0 },
    fireTimer: 0, car: null, lastDamageAt: -99, kind: 'player',
    shirt: '#e67e22', pants: '#2c3e50'
  };
}

function newGame() {
  buildCity(Game.seed || 1);
  Game.cars = []; Game.peds = []; Game.cops = []; Game.enemies = [];
  Game.bullets = []; Game.particles = []; Game.pickups = []; Game.decals = [];
  Game.wanted = { heat: 0, stars: 0, hiddenTimer: 0 };
  Game.cash = 250;
  Game.missionIndex = 0; Game.missionDone = [];
  Game.mission = null; Game.race = null; Game.taxi = null;
  Game.dialog = null; Game.toast = ''; Game.banner = '';
  Game._nextMissionAt = 0;
  Game.stats = { carsStolen: 0, shotsFired: 0, kills: 0, missionsDone: 0, racesWon: 0, faresDone: 0 };
  Game.player = makePlayer(400, 640);
  Game.camera.x = 400; Game.camera.y = 640; Game.camera.zoom = 1;
  spawnTraffic(16);
  spawnParked(12);
  spawnPeds(22);
  spawnFare(); spawnFare();
  spawnPickup(1200, 620, 'health');
  spawnPickup(2600, 1000, 'armor');
  spawnPickup(1800, 2600, 'ammo');
  spawnPickup(3000, 1800, 'health');
  Game.screen = 'play';
  startMission(0);
}

function startTitleWorld() {
  buildCity(Game.seed || 1);
  Game.cars = []; Game.peds = []; Game.cops = []; Game.enemies = [];
  Game.bullets = []; Game.particles = []; Game.pickups = []; Game.decals = [];
  Game.player = makePlayer(1800, 1800);
  Game.camera.x = 1800; Game.camera.y = 1800; Game.camera.zoom = 1;
  spawnTraffic(18);
  spawnParked(12);
  spawnPeds(24);
}

// ---- save / load ----
function saveGame() {
  try {
    var p = Game.player;
    var data = {
      title: Game.mission ? Game.mission.def.title : 'Free roam',
      cash: Game.cash, missionIndex: Game.missionIndex,
      missionDone: Game.missionDone,
      weapons: p.weapons, ammo: p.ammo, reserve: p.reserve,
      hp: p.hp, armor: p.armor,
      stats: Game.stats,
      savedAt: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    Game.save = data;
  } catch (e) { /* storage unavailable (file:// in some browsers): ignore */ }
}

function loadSave() {
  try {
    var raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function continueGame() {
  var s = Game.save;
  if (!s) return;
  newGame();
  Game.cash = s.cash;
  Game.missionDone = s.missionDone || [];
  Game.stats = s.stats || Game.stats;
  var p = Game.player;
  p.weapons = s.weapons || ['fists', 'pistol'];
  p.ammo = s.ammo || { pistol: 12, rifle: 0 };
  p.reserve = s.reserve || { pistol: 48, rifle: 0 };
  p.hp = s.hp || PLAYER_HEALTH;
  p.armor = s.armor || 0;
  p.weapon = p.weapons.indexOf('rifle') >= 0 ? 'rifle' : 'pistol';
  // Restart at the safehouse, on the next unfinished mission.
  p.x = 985; p.y = 2680;
  Game.camera.x = p.x; Game.camera.y = p.y;
  Game.mission = null;
  startMission(Math.min(s.missionIndex || 0, MISSIONS.length - 1));
}

// ---- per-frame update ----
function update(dt) {
  Game.time += dt;
  if (Game.toastTimer > 0) Game.toastTimer -= dt;
  if (Game.bannerTimer > 0) Game.bannerTimer -= dt;

  if (Game.screen === 'title') {
    // A dialog (e.g. How to Play) freezes the menu until dismissed.
    if (Game.dialog) {
      if (keyPressed('KeyE') || Game.mouse.clicked) interact();
      Game.mouse.clicked = false;
    } else {
      updateMenuInput('title');
    }
    updateAmbient(dt);
    updateCamera(dt);
    return;
  }
  if (Game.screen === 'pause') { updateMenuInput('pause'); return; }
  if (Game.screen === 'over') {
    if (keyPressed('Enter')) respawnAfterOver();
    return;
  }
  if (Game.screen === 'ending') {
    if (keyPressed('Enter')) { Game.screen = 'play'; Game.objective = 'Free roam — Solmara is yours.'; }
    return;
  }

  // Dialog freezes the world.
  if (Game.dialog) {
    if (keyPressed('KeyE') || Game.mouse.clicked) interact();
    Game.mouse.clicked = false;
    updateCamera(dt);
    return;
  }

  // Pause / mute / weapons.
  if (keyPressed('KeyP') || keyPressed('Escape')) { Game.screen = 'pause'; Game._menuSel = 0; Game.audio.click(); return; }
  if (keyPressed('KeyM')) Game.audio.setMuted(!Game.audio.muted);
  if (keyPressed('Digit1')) { Game.player.weapon = 'fists'; }
  if (keyPressed('Digit2') && Game.player.weapons.indexOf('pistol') >= 0) { Game.player.weapon = 'pistol'; Game.audio.click(); }
  if (keyPressed('Digit3') && Game.player.weapons.indexOf('rifle') >= 0) { Game.player.weapon = 'rifle'; Game.audio.click(); }
  if (keyPressed('KeyR')) reloadWeapon(Game.player);
  if (keyPressed('KeyE')) interact();

  updatePlayer(dt);
  updateMission(dt);
  updateTaxi(dt);
  updateRace(dt);
  updateWanted(dt);
  updateAmbient(dt);
  updateBullets(dt);
  updateParticles(dt);
  updatePickups(dt);
  updateCamera(dt);

  // Slow health regen out of combat.
  var p = Game.player;
  if (p.hp > 0 && p.hp < PLAYER_HEALTH && Game.time - p.lastDamageAt > 6) p.hp = Math.min(PLAYER_HEALTH, p.hp + 2.5 * dt);

  // Engine + siren follow the action.
  var driving = !!p.car;
  Game.audio.engine(driving ? Math.abs(p.car.speed) / p.car.maxSpeed : 0, driving);
  var policeNear = false;
  for (var i = 0; i < Game.cars.length; i++) {
    if (Game.cars[i].driver === 'police' && dist(Game.cars[i].x, Game.cars[i].y, p.x, p.y) < 700) { policeNear = true; break; }
  }
  Game.audio.siren(policeNear && Game.wanted.stars > 0, dt);
  Game.mouse.clicked = false;
  syncPrevKeys();
}

function updateAmbient(dt) {
  for (var i = 0; i < Game.cars.length; i++) updateTrafficCar(Game.cars[i], dt);
  if (Game.screen === 'play' && Game.player.car) drivePlayerCar(Game.player.car, dt);
  resolveCarCollisions();
  for (var j = 0; j < Game.peds.length; j++) updatePed(Game.peds[j], dt);
  for (var k = 0; k < Game.cops.length; k++) updateCop(Game.cops[k], dt);
  for (var e = 0; e < Game.enemies.length; e++) updateEnemy(Game.enemies[e], dt);
  // Clean up dead traffic far away and keep the streets full.
  var p = Game.player;
  for (var c = Game.cars.length - 1; c >= 0; c--) {
    var car = Game.cars[c];
    if (car.driver === 'traffic' && dist(car.x, car.y, p.x, p.y) > 1400) {
      Game.cars.splice(c, 1);
      spawnTrafficCar();
    }
  }
  for (var q = Game.peds.length - 1; q >= 0; q--) {
    if (Game.peds[q].dead) Game.peds.splice(q, 1);
  }
  if (Game.peds.length < 18 && Math.random() < dt * 0.5) spawnPeds(1);
  var fares = 0;
  for (var f = 0; f < Game.peds.length; f++) if (Game.peds[f].kind === 'fare') fares++;
  if (fares < 2 && Math.random() < dt * 0.2) spawnFare();
  // Dead enemies fade out.
  for (var g = Game.enemies.length - 1; g >= 0; g--) {
    if (Game.enemies[g].dead) Game.enemies.splice(g, 1);
  }
}

function updatePlayer(dt) {
  var p = Game.player;
  if (!p || p.hp <= 0) return;
  if (p.car) return; // driving is handled in updateAmbient via drivePlayerCar
  // On foot.
  var mx = (keyDown('KeyD', 'ArrowRight') ? 1 : 0) - (keyDown('KeyA', 'ArrowLeft') ? 1 : 0);
  var my = (keyDown('KeyS', 'ArrowDown') ? 1 : 0) - (keyDown('KeyW', 'ArrowUp') ? 1 : 0);
  var sprint = keyDown('ShiftLeft', 'ShiftRight');
  var sp = sprint ? SPRINT_SPEED : WALK_SPEED;
  if (mx !== 0 || my !== 0) {
    var len = Math.sqrt(mx * mx + my * my);
    moveWithCollision(p, mx / len * sp * dt, my / len * sp * dt, PLAYER_RADIUS);
    p.walkPhase += dt * (sprint ? 13 : 9);
    p.angle = Math.atan2(my, mx);
  }
  // Hit a pedestrian with your body while sprinting: they get knocked down.
  if (sprint) {
    for (var i = 0; i < Game.peds.length; i++) {
      var ped = Game.peds[i];
      if (!ped.dead && ped.kind !== 'fare' && dist(p.x, p.y, ped.x, ped.y) < 24) {
        damagePerson(ped, 60, 'player');
        addWanted(HEAT_HIT_PED);
        showToast('You knocked down a pedestrian!');
        break;
      }
    }
  }
  playerAttack(dt);
}

// ---- menus ----
function updateMenuInput(which) {
  var items = Game._menuItems || [];
  // P / Escape toggles back out of the pause menu.
  if (which === 'pause' && (keyPressed('KeyP') || keyPressed('Escape'))) {
    Game.screen = 'play';
    return;
  }
  if (keyPressed('ArrowUp') || keyPressed('KeyW')) {
    Game._menuSel = ((Game._menuSel || 0) + items.length - 1) % items.length;
    Game.audio.click();
  }
  if (keyPressed('ArrowDown') || keyPressed('KeyS')) {
    Game._menuSel = ((Game._menuSel || 0) + 1) % items.length;
    Game.audio.click();
  }
  if (keyPressed('Enter')) activateMenu(which, Game._menuSel || 0);
  if (Game.mouse.clicked) {
    Game.mouse.clicked = false;
    var y0 = which === 'title' ? CH * 0.52 : CH * 0.46;
    for (var i = 0; i < items.length; i++) {
      var y = y0 + i * (which === 'title' ? 52 : 48);
      if (Math.abs(Game.mouse.y - y) < 22 && Math.abs(Game.mouse.x - CW / 2) < 220) {
        Game._menuSel = i;
        activateMenu(which, i);
        return;
      }
    }
  }
  syncPrevKeys();
}

function activateMenu(which, i) {
  Game.audio.click();
  var item = (Game._menuItems || [])[i];
  if (which === 'title') {
    if (item === 'New Game') { newGame(); return; }
    if (item && item.indexOf('Continue') === 0) { continueGame(); return; }
    if (item === 'How to Play') {
      showDialog('HOW TO PLAY', [
        'WASD walk and drive. E enters cars and talks to people.',
        'Mouse aims, click shoots. 1/2/3 switch weapons, R reloads.',
        'Steal cars, run missions for Rosa, lose the police to drop your wanted level.',
        'Taxi fares ($) and the beach race pay extra. Progress auto-saves.'
      ]);
      return;
    }
  }
  if (which === 'pause') {
    if (item === 'Resume') { Game.screen = 'play'; return; }
    if (item === 'Save Game') { saveGame(); showToast('Game saved.'); Game.screen = 'play'; return; }
    if (item === 'Restart Mission') {
      if (Game.mission) resetMissionToStep(Game.mission);
      Game.screen = 'play';
      return;
    }
    if (item === 'Quit to Title') {
      saveGame();
      Game.screen = 'title';
      Game._menuSel = 0;
      startTitleWorld();
      return;
    }
  }
}

// ---- boot + loop ----
function boot() {
  var params = new URLSearchParams(window.location.search);
  var shot = params.get('shot') || '';
  var seed = parseInt(params.get('seed') || '1', 10) || 1;
  Game.seed = seed;
  var c = document.getElementById('game');
  setupCanvas(c);
  setupInput(c);
  makeAudio();
  Game.save = loadSave();
  Game._menuSel = 0;
  if (shot) {
    stageShot(shot);
    // Frozen frame: render only, no simulation, so the shot is repeatable.
    render();
    return;
  }
  startTitleWorld();
  Game.screen = 'title';
  var last = performance.now();
  var acc = 0;
  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    var steps = 0;
    while (acc >= STEP && steps < 5) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.addEventListener('error', function (e) {
  document.title = 'ERR: ' + (e.message || 'unknown');
});
window.addEventListener('DOMContentLoaded', boot);
