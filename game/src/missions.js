// SOLMARA — missions.js
// Story missions (10, in order), the mission engine, and side activities:
// taxi fares and the beach street race. Dialog, toasts and banners live here.

function showToast(text) { Game.toast = text; Game.toastTimer = 3.2; }
function showBanner(title, sub) { Game.banner = title; Game.bannerSub = sub || ''; Game.bannerTimer = 3.5; }
function showDialog(who, lines) { Game.dialog = { who: who, lines: lines, i: 0 }; }

var MISSIONS = [
  { id: 'm1', title: 'Welcome to Solmara', reward: 150,
    brief: ["ROSA: Kai, you're late. The city's waiting.",
            "Get some wheels and meet me at the Marina."],
    steps: [
      { type: 'goto', x: 400, y: 470, r: 70, text: "Go to Rosa's Cafe" },
      { type: 'talk', landmark: 'cafe', text: "Talk to Rosa (E)" },
      { type: 'enterCar', text: 'Get in a car (E)' },
      { type: 'goto', x: 620, y: 3420, r: 90, inCar: true, text: 'Drive to the Marina' },
      { type: 'goto', x: 400, y: 500, r: 90, inCar: true, text: "Drive back to Rosa's" }
    ] },
  { id: 'm2', title: 'The Pickup', reward: 250,
    brief: ["ROSA: A crate came in at the harbor. Fetch it.",
            "No questions, no peeking."],
    steps: [
      { type: 'goto', x: 3010, y: 1500, r: 90, text: 'Drive to the Harbor Warehouse' },
      { type: 'collect', points: [{ x: 3010, y: 1462 }], text: 'Pick up the package (E)' },
      { type: 'goto', x: 400, y: 500, r: 90, inCar: true, text: 'Deliver the package to Rosa' }
    ] },
  { id: 'm3', title: 'Getaway', reward: 300,
    brief: ["ROSA: It was a setup — the cops were waiting!",
            "Lose them, then lay low at the safehouse."],
    onStart: function () { addWanted(45); },
    steps: [
      { type: 'escape', text: 'Lose the police (stay out of sight)' },
      { type: 'goto', x: 985, y: 2650, r: 70, text: 'Lay low at the safehouse' }
    ] },
  { id: 'm4', title: 'Protection', reward: 400,
    brief: ["ROSA: Three shops owe me. Collect — and don't",
            "take no for an answer."],
    steps: [
      { type: 'collect', points: [{ x: 1000, y: 620 }, { x: 1800, y: 2620 }, { x: 3020, y: 1820 }], text: 'Collect from 3 shops (E)' },
      { type: 'eliminate', count: 2, at: { x: 3020, y: 1820 }, text: 'Deal with the ambush' }
    ] },
  { id: 'm5', title: 'Rival Down', reward: 600,
    brief: ["ROSA: The Vipers hit our corner last night.",
            "Run their driver off the road. All of it."],
    steps: [
      { type: 'chase', text: "Chase down the rival's Veloce" },
      { type: 'eliminate', count: 3, at: null, text: 'Finish the job' }
    ] },
  { id: 'm6', title: 'Ironworks', reward: 500,
    brief: ["ROSA: You need a real gun. Go see Brick at",
            "Ironworks — then hold the shop."],
    steps: [
      { type: 'goto', x: 2595, y: 2250, r: 70, text: 'Go to Ironworks Guns' },
      { type: 'talk', landmark: 'gunshop', text: 'Buy the rifle (E) — $200', buy: 'rifle' },
      { type: 'eliminate', count: 4, at: { x: 2595, y: 2250 }, text: 'Defend the shop' }
    ] },
  { id: 'm7', title: 'The Hauler', reward: 800,
    brief: ["ROSA: A Hauler full of cargo sits at the harbor.",
            "Take it. The cops will care."],
    onStart: function () { addWanted(20); },
    steps: [
      { type: 'stealTruck', text: 'Steal the Hauler at the harbor (E)' },
      { type: 'goto', x: 3350, y: 2600, r: 100, inCar: true, text: 'Deliver the Hauler to the east docks' }
    ] },
  { id: 'm8', title: 'Warehouse War', reward: 900,
    brief: ["ROSA: The Vipers took our warehouse.",
            "Take it back. All of it."],
    steps: [
      { type: 'goto', x: 3010, y: 1500, r: 100, text: 'Go to the warehouse' },
      { type: 'eliminate', count: 6, at: { x: 3010, y: 1500 }, text: 'Clear the warehouse' }
    ] },
  { id: 'm9', title: 'The Big Score', reward: 1500,
    brief: ["ROSA: Solmara National Bank. In, out, gone.",
            "The whole city will be looking for you."],
    steps: [
      { type: 'goto', x: 1400, y: 1080, r: 70, text: 'Enter the bank' },
      { type: 'collect', points: [{ x: 1400, y: 1052 }], text: 'Grab the cash (E)' },
      { type: 'escape5', text: 'Escape to the safehouse — 5 stars!' }
    ],
    onCollect: function () { addWanted(95); } },
  { id: 'm10', title: 'King of Solmara', reward: 2000,
    brief: ["ROSA: One last ride, Kai. Survive the heat",
            "and meet me at The Palmero."],
    onStart: function () { addWanted(95); },
    steps: [
      { type: 'survive', seconds: 90, text: 'Survive the heat — stay alive!' },
      { type: 'goto', x: 2380, y: 3520, r: 90, text: 'Meet Rosa at The Palmero' }
    ] }
];

// ---- mission engine ----
function startMission(i) {
  var def = MISSIONS[i];
  if (!def) { Game.mission = null; Game.objective = ''; return; }
  Game.missionIndex = i;
  Game.mission = { def: def, step: 0, state: {}, startedAt: Game.time };
  Game.objective = def.steps[0].text;
  showDialog('ROSA', def.brief);
  if (def.onStart) def.onStart();
  prepareStep(Game.mission);
}

function currentStep() {
  return Game.mission ? Game.mission.def.steps[Game.mission.step] : null;
}

function prepareStep(m) {
  var s = currentStep();
  if (!s) return;
  m.state = {};
  Game.objective = s.text;
  if (s.type === 'chase') {
    // Spawn the rival's car, fleeing from the player.
    var car = makeCar('sport', 2200, 1000, 0);
    car.driver = 'mission';
    car.ai.mode = 'flee';
    car.color = '#7a1f8f';
    Game.cars.push(car);
    m.state.targetCar = car;
  }
  if (s.type === 'eliminate') {
    var at = s.at || { x: Game.player.x + 200, y: Game.player.y };
    for (var i = 0; i < s.count; i++) {
      spawnEnemy(at.x + rndRange(-90, 90), at.y + rndRange(-90, 90), rndChance(0.4) ? 'rifle' : 'pistol');
    }
    m.state.spawned = s.count;
  }
  if (s.type === 'stealTruck') {
    var truck = makeCar('truck', 3150, 1560, Math.PI / 2);
    truck.driver = 'none';
    truck.ai.mode = 'parked';
    Game.cars.push(truck);
    m.state.truck = truck;
  }
  if (s.type === 'survive') m.state.t = s.seconds;
}

function completeStep() {
  var m = Game.mission;
  if (!m) return;
  Game.audio.pickup();
  m.step++;
  if (m.step >= m.def.steps.length) { completeMission(); return; }
  prepareStep(m);
}

function completeMission() {
  var m = Game.mission;
  var def = m.def;
  Game.cash += def.reward;
  Game.stats.missionsDone++;
  Game.missionDone.push(def.id);
  showBanner('MISSION COMPLETE', def.title + '  •  +' + fmtMoney(def.reward));
  Game.audio.missionDone();
  saveGame();
  if (def.id === 'm10') {
    Game.mission = null;
    Game.objective = '';
    Game.screen = 'ending';
    return;
  }
  Game.mission = null;
  Game.objective = '';
  // The next mission starts after a breath.
  Game._nextMissionAt = Game.time + 2.5;
}

function resetMissionToStep(m) {
  // After wasted/busted: clear mission enemies and restart the current mission.
  Game.enemies = [];
  var idx = Game.missionIndex;
  startMission(idx);
}

function updateMission(dt) {
  if (Game._nextMissionAt && Game.time >= Game._nextMissionAt) {
    Game._nextMissionAt = 0;
    startMission(Game.missionIndex + 1);
  }
  var m = Game.mission;
  if (!m) return;
  var s = currentStep();
  if (!s) return;
  var p = Game.player;
  switch (s.type) {
    case 'goto': {
      var inCarOk = !s.inCar || p.car;
      if (inCarOk && dist(p.x, p.y, s.x, s.y) < s.r) completeStep();
      break;
    }
    case 'enterCar':
      if (p.car) completeStep();
      break;
    case 'talk':
      break; // completed by interact()
    case 'collect':
      break; // completed by interact()
    case 'chase': {
      var car = m.state.targetCar;
      if (!car || car.dead || car.hp <= 0) completeStep();
      break;
    }
    case 'eliminate': {
      var alive = 0;
      for (var i = 0; i < Game.enemies.length; i++) if (!Game.enemies[i].dead) alive++;
      if (alive === 0 && m.state.spawned) completeStep();
      break;
    }
    case 'stealTruck': {
      var truck = m.state.truck;
      if (truck && p.car === truck) completeStep();
      break;
    }
    case 'escape':
      if (Game.wanted.stars === 0) completeStep();
      break;
    case 'escape5': {
      if (dist(p.x, p.y, 985, 2650) < 80 && Game.wanted.stars <= 3) completeStep();
      break;
    }
    case 'survive': {
      m.state.t -= dt;
      Game.objective = s.text + ' — ' + Math.ceil(m.state.t) + 's';
      if (m.state.t <= 0) completeStep();
      break;
    }
  }
}

// Where the current objective points (for the HUD marker and minimap).
function missionTarget() {
  var m = Game.mission;
  if (!m) return null;
  var s = currentStep();
  if (!s) return null;
  if (s.type === 'goto' || s.type === 'collect') {
    var pt = s.type === 'collect' ? s.points[0] : s;
    return { x: pt.x, y: pt.y };
  }
  if (s.type === 'talk') {
    var lm = Game.city.landmarks[s.landmark];
    return { x: lm.door.x, y: lm.door.y };
  }
  if (s.type === 'chase' && m.state.targetCar) return { x: m.state.targetCar.x, y: m.state.targetCar.y };
  if (s.type === 'eliminate') {
    for (var i = 0; i < Game.enemies.length; i++) if (!Game.enemies[i].dead) return { x: Game.enemies[i].x, y: Game.enemies[i].y };
    return null;
  }
  if (s.type === 'stealTruck' && m.state.truck) return { x: m.state.truck.x, y: m.state.truck.y };
  if (s.type === 'escape5') return { x: 985, y: 2650 };
  return null;
}

// ---- interaction (E key) ----
function interact() {
  var p = Game.player;
  // 1. Advance dialog.
  if (Game.dialog) {
    Game.dialog.i++;
    if (Game.dialog.i >= Game.dialog.lines.length) Game.dialog = null;
    return;
  }
  var m = Game.mission, s = currentStep();
  // 2. Mission talk / collect steps.
  if (m && s) {
    if (s.type === 'talk') {
      var lm = Game.city.landmarks[s.landmark];
      if (dist(p.x, p.y, lm.door.x, lm.door.y) < 60) {
        if (s.buy === 'rifle') {
          if (Game.cash < 200) { showToast('You need $200 for the rifle.'); return; }
          Game.cash -= 200;
          p.weapons.push('rifle');
          p.weapon = 'rifle';
          p.ammo.rifle = 30; p.reserve.rifle = 60;
          showToast('Rifle bought — $200');
        }
        completeStep();
        return;
      }
    }
    if (s.type === 'collect') {
      for (var i = 0; i < s.points.length; i++) {
        if (dist(p.x, p.y, s.points[i].x, s.points[i].y) < 55) {
          s.points.splice(i, 1);
          Game.audio.cash();
          if (m.def.onCollect) m.def.onCollect();
          if (s.points.length === 0) completeStep();
          else { Game.objective = s.text + ' (' + s.points.length + ' left)'; showToast('Collected — ' + s.points.length + ' left'); }
          return;
        }
      }
    }
  }
  // 3. Taxi fare pickup.
  for (var j = 0; j < Game.peds.length; j++) {
    var ped = Game.peds[j];
    if (ped.kind === 'fare' && !ped.dead && dist(p.x, p.y, ped.x, ped.y) < 50) {
      if (p.car) { startTaxi(ped); return; }
      showToast('Get a car first — the fare needs a ride.');
      return;
    }
  }
  // 4. Street race start.
  if (p.car && dist(p.x, p.y, 1800, 3400) < 90 && !Game.race) { startRace(); return; }
  // 5. Enter / exit a car.
  if (p.car) { exitCar(); return; }
  var car = nearestCarTo(p.x, p.y, 52);
  if (car) { enterCar(car); return; }
}

// ---- side activities ----
function startTaxi(fare) {
  Game.taxi = { fare: fare, dest: fare.fare.dest, pay: fare.fare.pay, timer: 120 };
  fare.dead = true; // they ride with you now
  Game.objective = 'Taxi fare — drive to the marker (' + fmtMoney(fare.fare.pay) + ')';
  showToast('Fare aboard — take them to the marker!');
  Game.audio.pickup();
}

function updateTaxi(dt) {
  var t = Game.taxi;
  if (!t) return;
  t.timer -= dt;
  var p = Game.player;
  if (!p.car) { Game.taxi = null; Game.objective = Game.mission ? currentStep().text : ''; showToast('The fare walked off.'); return; }
  if (dist(p.x, p.y, t.dest.x, t.dest.y) < 55) {
    Game.cash += t.pay;
    Game.stats.faresDone++;
    showBanner('FARE COMPLETE', '+' + fmtMoney(t.pay));
    Game.audio.cash();
    Game.taxi = null;
    Game.objective = Game.mission ? currentStep().text : '';
  } else if (t.timer <= 0) {
    Game.taxi = null;
    showToast('Too slow — the fare gave up.');
    Game.objective = Game.mission ? currentStep().text : '';
  }
}

var RACE_POINTS = [
  { x: 2600, y: 3400 }, { x: 3400, y: 2600 }, { x: 3400, y: 600 },
  { x: 1800, y: 200 }, { x: 200, y: 1800 }, { x: 1800, y: 3400 }
];

function startRace() {
  Game.race = { cp: 0, time: 0, par: 150 };
  Game.objective = 'Street race — hit the checkpoints!';
  showToast('Race! 6 checkpoints, par 2:30.');
  Game.audio.missionDone();
}

function updateRace(dt) {
  var r = Game.race;
  if (!r) return;
  r.time += dt;
  var p = Game.player;
  if (!p.car) { Game.race = null; showToast('Race over — you left the car.'); return; }
  var cp = RACE_POINTS[r.cp];
  if (dist(p.x, p.y, cp.x, cp.y) < 80) {
    r.cp++;
    Game.audio.pickup();
    if (r.cp >= RACE_POINTS.length) {
      var won = r.time <= r.par;
      if (won) {
        Game.cash += 300; Game.stats.racesWon++;
        showBanner('RACE WON', 'Beach sprint in ' + r.time.toFixed(1) + 's  •  +$300');
        Game.audio.missionDone();
      } else {
        showToast('Finished in ' + r.time.toFixed(1) + 's — par was 2:30. Try again!');
      }
      Game.race = null;
      Game.objective = Game.mission ? currentStep().text : '';
    } else {
      showToast('Checkpoint ' + r.cp + '/' + RACE_POINTS.length);
    }
  }
}
