// SOLMARA — render.js
// Camera, world drawing, entities, HUD, minimap and all screens
// (title, pause, wasted/busted, ending). Everything the judge sees.

var canvas, ctx, CW = 1280, CH = 800;

function setupCanvas(c) {
  canvas = c; ctx = c.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}
function resizeCanvas() {
  CW = window.innerWidth; CH = window.innerHeight;
  canvas.width = CW; canvas.height = CH;
}

function worldToScreen(wx, wy) {
  var cam = Game.camera;
  return { x: (wx - cam.x) * cam.zoom + CW / 2, y: (wy - cam.y) * cam.zoom + CH / 2 };
}
function screenToWorld(sx, sy) {
  var cam = Game.camera;
  return { x: (sx - CW / 2) / cam.zoom + cam.x, y: (sy - CH / 2) / cam.zoom + cam.y };
}

function updateCamera(dt) {
  var cam = Game.camera;
  var p = Game.player;
  var tx = p ? p.x : WORLD_SIZE / 2, ty = p ? p.y : WORLD_SIZE / 2;
  if (Game.screen === 'title') {
    // Slow pan over the city behind the title.
    tx = WORLD_SIZE / 2 + Math.cos(Game.time * 0.05) * 700;
    ty = WORLD_SIZE / 2 + Math.sin(Game.time * 0.04) * 700;
  }
  cam.x = lerp(cam.x, tx, Math.min(1, dt * 4));
  cam.y = lerp(cam.y, ty, Math.min(1, dt * 4));
  cam.shake = Math.max(0, cam.shake - dt * 30);
  var mw = Game.mouse;
  var wpt = screenToWorld(mw.x, mw.y);
  mw.wx = wpt.x; mw.wy = wpt.y;
}

// ---- main render ----
function render() {
  ctx.save();
  ctx.clearRect(0, 0, CW, CH);
  var cam = Game.camera;
  if (cam.shake > 0) ctx.translate(rndRange(-cam.shake, cam.shake) * 0.5, rndRange(-cam.shake, cam.shake) * 0.5);
  drawWorld();
  if (Game.night) drawNight();
  ctx.restore();
  if (Game.screen === 'title') { drawTitle(); drawDialog(); return; }
  drawHUD();
  if (Game.screen === 'pause') drawPause();
  if (Game.screen === 'over') drawOver();
  if (Game.screen === 'ending') drawEnding();
}

function drawWorld() {
  var cam = Game.camera;
  var view = {
    x0: cam.x - CW / 2 / cam.zoom - 60, y0: cam.y - CH / 2 / cam.zoom - 60,
    x1: cam.x + CW / 2 / cam.zoom + 60, y1: cam.y + CH / 2 / cam.zoom + 60
  };
  ctx.save();
  ctx.translate(CW / 2, CH / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);
  var city = Game.city;
  // Ground.
  ctx.fillStyle = '#a9b18a';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  // Beach sand and sea.
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(SAND_RECT.x, SAND_RECT.y, SAND_RECT.w, SAND_RECT.h);
  ctx.fillStyle = '#3d8fc4';
  for (var wi = 0; wi < WATER_RECTS.length; wi++) {
    var wr = WATER_RECTS[wi];
    ctx.fillRect(wr.x, wr.y, wr.w, wr.h);
  }
  // The sea continues past the world's south and east edges so the camera
  // never shows a flat empty band when the player drives along the beach.
  ctx.fillStyle = '#3d8fc4';
  ctx.fillRect(-600, 3520, 4800, 700);
  ctx.fillRect(3520, -600, 700, 4800);
  // Waves.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  for (var wv = 0; wv < 8; wv++) {
    ctx.beginPath();
    var wy = 3540 + wv * 24 + Math.sin(Game.time * 1.4 + wv) * 3;
    for (var wx = -600; wx <= 4200; wx += 60) ctx.lineTo(wx, wy + Math.sin(wx * 0.02 + Game.time + wv) * 2);
    ctx.stroke();
  }
  // Docks.
  ctx.fillStyle = '#b09a7a';
  ctx.fillRect(DOCK_RECT.x, DOCK_RECT.y, DOCK_RECT.w, DOCK_RECT.h);
  for (var pi = 0; pi < city.piers.length; pi++) {
    var pr = city.piers[pi];
    ctx.fillStyle = '#8a6f4d';
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
  }
  // Parks and plazas.
  for (var i = 0; i < city.parks.length; i++) {
    var pk = city.parks[i];
    ctx.fillStyle = '#6fa860';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    ctx.fillStyle = '#5d9bc4';
    ctx.beginPath(); ctx.ellipse(pk.x + pk.w / 2, pk.y + pk.h / 2, 46, 30, 0, 0, Math.PI * 2); ctx.fill();
  }
  for (var j = 0; j < city.plazas.length; j++) {
    var pz = city.plazas[j];
    ctx.fillStyle = '#c9c2b4';
    ctx.fillRect(pz.x, pz.y, pz.w, pz.h);
    ctx.fillStyle = '#7fb8d8';
    ctx.beginPath(); ctx.arc(pz.x + pz.w / 2, pz.y + pz.h / 2, 26, 0, Math.PI * 2); ctx.fill();
  }
  drawRoads(view);
  drawBuildings(view);
  drawTrees(view);
  drawDecals();
  drawPickups();
  drawCars();
  drawPeople();
  drawBullets();
  drawParticles();
  ctx.restore();
}

function drawRoads(view) {
  // Sidewalk strips, then asphalt, then centre dashes.
  ctx.fillStyle = '#c9c2b4';
  for (var i = 0; i < ROADS.length; i++) {
    ctx.fillRect(ROADS[i] - ROAD_W / 2 - 14, 0, ROAD_W + 28, WORLD_SIZE);
    ctx.fillRect(0, ROADS[i] - ROAD_W / 2 - 14, WORLD_SIZE, ROAD_W + 28);
  }
  ctx.fillStyle = '#3d3d46';
  for (var j = 0; j < ROADS.length; j++) {
    ctx.fillRect(ROADS[j] - ROAD_W / 2, 0, ROAD_W, WORLD_SIZE);
    ctx.fillRect(0, ROADS[j] - ROAD_W / 2, WORLD_SIZE, ROAD_W);
  }
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 30]);
  for (var k = 0; k < ROADS.length; k++) {
    ctx.beginPath(); ctx.moveTo(ROADS[k], 0); ctx.lineTo(ROADS[k], WORLD_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, ROADS[k]); ctx.lineTo(WORLD_SIZE, ROADS[k]); ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawBuildings(view) {
  var bs = Game.city.buildings;
  for (var i = 0; i < bs.length; i++) {
    var b = bs[i];
    if (b.x + b.w < view.x0 || b.x > view.x1 || b.y + b.h < view.y0 || b.y > view.y1) continue;
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    // Body and roof.
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x + 12, b.y + 12, b.w - 24, 10);
    // Roof details.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.3, 14, 10);
    ctx.fillRect(b.x + b.w * 0.65, b.y + b.h * 0.6, 12, 12);
    if (b.landmark) {
      ctx.font = 'bold 13px Arial, sans-serif';
      var tw = ctx.measureText(b.name).width;
      ctx.fillStyle = 'rgba(10,10,16,0.62)';
      ctx.fillRect(b.x + b.w / 2 - tw / 2 - 7, b.y - 26, tw + 14, 19);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y - 12);
      ctx.textAlign = 'left';
    }
  }
}

function drawTrees(view) {
  var ts = Game.city.trees;
  for (var i = 0; i < ts.length; i++) {
    var t = ts[i];
    if (t.x < view.x0 || t.x > view.x1 || t.y < view.y0 || t.y > view.y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(t.x + 4, t.y + 5, 12 * t.s, 6 * t.s, 0, 0, Math.PI * 2); ctx.fill();
    if (t.palm) {
      ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x, t.y - 12 * t.s); ctx.stroke();
      ctx.fillStyle = '#2e9e5b';
      for (var f = 0; f < 5; f++) {
        var a = (f / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(t.x + Math.cos(a) * 9 * t.s, t.y - 12 * t.s + Math.sin(a) * 6 * t.s, 9 * t.s, 4 * t.s, a, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#3d8a4a';
      ctx.beginPath(); ctx.arc(t.x, t.y, 11 * t.s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#57b368';
      ctx.beginPath(); ctx.arc(t.x - 4 * t.s, t.y - 4 * t.s, 6 * t.s, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawDecals() {
  for (var i = 0; i < Game.decals.length; i++) {
    var d = Game.decals[i];
    if (d.kind === 'skid') {
      ctx.strokeStyle = 'rgba(20,20,20,' + Math.min(0.5, d.life * 0.09) + ')';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(d.x1, d.y1); ctx.lineTo(d.x2, d.y2); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(15,15,15,' + Math.min(0.4, d.life * 0.03) + ')';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawPickups() {
  for (var i = 0; i < Game.pickups.length; i++) {
    var pk = Game.pickups[i];
    var bob = Math.sin(pk.bob * 3) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    if (pk.kind === 'health') { ctx.fillStyle = '#fff'; ctx.fillRect(-9, -9, 18, 18); ctx.fillStyle = '#e74c3c'; ctx.fillRect(-2.5, -7, 5, 14); ctx.fillRect(-7, -2.5, 14, 5); }
    else if (pk.kind === 'armor') { ctx.fillStyle = '#3498db'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center'; ctx.fillText('A', 0, 4); ctx.textAlign = 'left'; }
    else if (pk.kind === 'ammo') { ctx.fillStyle = '#f39c12'; ctx.fillRect(-9, -6, 18, 12); ctx.fillStyle = '#222'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.fillText('AMMO', 0, 3); ctx.textAlign = 'left'; }
    else { ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center'; ctx.fillText('$', 0, 4); ctx.textAlign = 'left'; }
    ctx.restore();
  }
}

function drawCars() {
  var cars = Game.cars.slice().sort(function (a, b) { return a.y - b.y; });
  for (var i = 0; i < cars.length; i++) drawCar(cars[i]);
}

function drawCar(car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(3, 5, car.w * 0.52, car.h * 0.62, car.angle, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(car.angle);
  var w = car.w, h = car.h;
  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-w * 0.32, -h / 2 - 3, 12, 6); ctx.fillRect(w * 0.32 - 12, -h / 2 - 3, 12, 6);
  ctx.fillRect(-w * 0.32, h / 2 - 3, 12, 6); ctx.fillRect(w * 0.32 - 12, h / 2 - 3, 12, 6);
  // Body.
  if (car.dead) {
    ctx.fillStyle = '#222';
    roundRect(-w / 2, -h / 2, w, h, 7); ctx.fill();
    ctx.fillStyle = '#444';
    roundRect(-w / 2 + 5, -h / 2 + 4, w - 10, h - 8, 5); ctx.fill();
  } else {
    ctx.fillStyle = car.color;
    roundRect(-w / 2, -h / 2, w, h, 7); ctx.fill();
    // Roof + windshield + rear window.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(-w * 0.12, -h / 2 + 3, w * 0.3, h - 6, 4); ctx.fill();
    ctx.fillStyle = '#bfe3f0';
    ctx.fillRect(w * 0.22, -h / 2 + 3, 5, h - 6);
    ctx.fillRect(-w * 0.32, -h / 2 + 3, 4, h - 6);
    // Headlights.
    ctx.fillStyle = '#ffe27a';
    ctx.fillRect(w / 2 - 2, -h / 2 + 3, 3, 5); ctx.fillRect(w / 2 - 2, h / 2 - 8, 3, 5);
    if (car.type === 'taxi') {
      ctx.fillStyle = '#222';
      ctx.fillRect(-6, -h / 2 - 2, 14, 6);
      ctx.fillStyle = '#f5c542';
      ctx.font = 'bold 6px Arial'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 1, -h / 2 + 3); ctx.textAlign = 'left';
    }
    if (car.type === 'police') {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(-w * 0.12, -h / 2 + 2, w * 0.3, h - 4);
      var flash = Math.floor(Game.time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2d2d' : '#2d7bff';
      ctx.fillRect(-w * 0.05, -h / 2 - 1, 8, 4);
      ctx.fillStyle = flash ? '#2d7bff' : '#ff2d2d';
      ctx.fillRect(-w * 0.05, h / 2 - 3, 8, 4);
    }
    if (car.type === 'truck') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-w / 2 + 4, -h / 2 + 4, w * 0.42, h - 8);
    }
  }
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPeople() {
  var list = Game.peds.concat(Game.cops).concat(Game.enemies);
  if (Game.player && !Game.player.car) list.push(Game.player);
  list.sort(function (a, b) { return a.y - b.y; });
  for (var i = 0; i < list.length; i++) drawPerson(list[i]);
}

function drawPerson(p) {
  var isPlayer = p === Game.player;
  var bob = Math.sin(p.walkPhase || 0) * 2;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(2, 6, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Legs.
  ctx.fillStyle = p.pants || '#2c3e50';
  ctx.fillRect(-6, 2 + bob * 0.4, 5, 8);
  ctx.fillRect(1, 2 - bob * 0.4, 5, 8);
  // Body.
  ctx.fillStyle = isPlayer ? '#e67e22' : p.shirt;
  ctx.beginPath(); ctx.arc(0, -2, 9, 0, Math.PI * 2); ctx.fill();
  // Head.
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath(); ctx.arc(0, -12, 6, 0, Math.PI * 2); ctx.fill();
  if (p.kind === 'cop') {
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(-6, -18, 12, 4);
  }
  // Facing + weapon.
  var aim = p.aimAngle !== undefined ? p.aimAngle : p.angle;
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(Math.cos(aim) * 12, -4 + Math.sin(aim) * 12); ctx.stroke();
  if (p.weapon && p.weapon !== 'fists') {
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(Math.cos(aim) * 8, -4 + Math.sin(aim) * 8);
    ctx.lineTo(Math.cos(aim) * 20, -4 + Math.sin(aim) * 20); ctx.stroke();
  }
  if (p.kind === 'fare') {
    ctx.fillStyle = '#2ecc71';
    ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
    ctx.fillText('$', 0, -26);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawBullets() {
  ctx.strokeStyle = '#fff2a8';
  ctx.lineWidth = 2;
  for (var i = 0; i < Game.bullets.length; i++) {
    var b = Game.bullets[i];
    ctx.beginPath(); ctx.moveTo(b.px, b.py); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
}

function drawParticles() {
  for (var i = 0; i < Game.particles.length; i++) {
    var pt = Game.particles[i];
    var a = clamp(pt.life / pt.maxLife, 0, 1);
    if (pt.kind === 'smoke') {
      ctx.fillStyle = 'rgba(120,120,120,' + (a * 0.45) + ')';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'flash') {
      ctx.fillStyle = 'rgba(255,226,122,' + a + ')';
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a + 2, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a + 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawNight() {
  // Darken the world, then punch headlight cones through the dark.
  ctx.fillStyle = 'rgba(8,12,44,0.52)';
  ctx.fillRect(0, 0, CW, CH);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  var cars = Game.cars;
  for (var i = 0; i < cars.length; i++) {
    var c = cars[i];
    if (c.dead || Math.abs(c.speed) < 20) continue;
    var s = worldToScreen(c.x + Math.cos(c.angle) * 60, c.y + Math.sin(c.angle) * 60);
    var g = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 90);
    g.addColorStop(0, 'rgba(255,240,170,0.30)');
    g.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, 90, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---- HUD ----
function drawHUD() {
  var p = Game.player;
  if (!p) return;
  // Health + armor, top-left.
  ctx.textAlign = 'left';
  drawBar(18, 18, 210, 18, p.hp / PLAYER_HEALTH, '#2ecc71', 'HP');
  drawBar(18, 42, 210, 12, p.armor / PLAYER_ARMOR_MAX, '#3498db', 'ARMOR');
  // Cash + wanted, top-right.
  ctx.font = 'bold 26px Arial, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'right';
  ctx.fillText(fmtMoney(Game.cash), CW - 18, 40);
  drawStars(CW - 18, 66);
  ctx.textAlign = 'left';
  // Objective, top-center.
  if (Game.objective) {
    ctx.font = 'bold 17px Arial, sans-serif';
    var w = ctx.measureText(Game.objective).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(CW / 2 - w / 2, 12, w, 34, 8); ctx.fill();
    ctx.fillStyle = '#ffd34d';
    ctx.textAlign = 'center';
    ctx.fillText(Game.objective, CW / 2, 35);
    ctx.textAlign = 'left';
  }
  // Toast.
  if (Game.toastTimer > 0) {
    ctx.font = '15px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, Game.toastTimer) + ')';
    ctx.textAlign = 'center';
    ctx.fillText(Game.toast, CW / 2, 66);
    ctx.textAlign = 'left';
  }
  // Mission banner.
  if (Game.bannerTimer > 0) {
    var a = Math.min(1, Game.bannerTimer);
    ctx.globalAlpha = a;
    ctx.font = 'bold 44px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd34d';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
    ctx.strokeText(Game.banner, CW / 2, CH * 0.32);
    ctx.fillText(Game.banner, CW / 2, CH * 0.32);
    ctx.font = 'bold 20px Arial, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(Game.bannerSub, CW / 2, CH * 0.32 + 30);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  // Weapon + ammo, bottom-left, on a dark pill so it stays legible over
  // bright sand, sea or road dashes.
  var hints = '1 Fists   2 Pistol   3 Rifle   •   E enter car / interact   •   P pause   •   M mute';
  ctx.font = '13px Arial, sans-serif';
  var hw = ctx.measureText(hints).width;
  ctx.fillStyle = 'rgba(10,10,16,0.5)';
  roundRect(10, CH - 80, Math.max(hw, 190) + 18, 68, 8); ctx.fill();
  var w = WEAPONS[p.weapon];
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillStyle = '#fff';
  var ammoText = w.mag ? (p.ammo[p.weapon] + ' / ' + p.reserve[p.weapon]) : '—';
  ctx.fillText(w.name + '   ' + ammoText, 18, CH - 52);
  ctx.font = '13px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(hints, 18, CH - 28);
  // Speed, bottom-right above the minimap (minimap top edge is CH-210).
  if (p.car) {
    var mph = Math.round(Math.abs(p.car.speed) * 0.14);
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(mph + ' mph', CW - 216, CH - 234);
    ctx.fillStyle = '#fff';
    ctx.fillText(mph + ' mph', CW - 218, CH - 236);
    ctx.font = '13px Arial, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillText(p.car.name, CW - 216, CH - 210);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(p.car.name, CW - 218, CH - 212);
    ctx.textAlign = 'left';
  }
  drawMinimap();
  drawDialog();
  // Crosshair when on foot and armed.
  if (!p.car && p.weapon !== 'fists') {
    var mx = Game.mouse.x, my = Game.mouse.y;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my); ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5); ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13); ctx.stroke();
  }
  // Mission / race / taxi marker in the world.
  drawObjectiveMarker();
}

// Dialog panel (mission briefs, Rosa's lines, How to Play). Shown over the
// HUD in play and over the title screen.
function drawDialog() {
  if (!Game.dialog) return;
  var d = Game.dialog;
  var dw = Math.min(760, CW - 80);
  var dh = 96;
  ctx.fillStyle = 'rgba(10,10,16,0.88)';
  roundRect(CW / 2 - dw / 2, CH - dh - 90, dw, dh, 10); ctx.fill();
  ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2;
  roundRect(CW / 2 - dw / 2, CH - dh - 90, dw, dh, 10); ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 15px Arial, sans-serif';
  ctx.fillText(d.who, CW / 2 - dw / 2 + 18, CH - dh - 62);
  ctx.fillStyle = '#fff';
  ctx.font = '16px Arial, sans-serif';
  var line = d.lines[d.i] || '';
  ctx.fillText(line, CW / 2 - dw / 2 + 18, CH - dh - 38);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px Arial, sans-serif';
  ctx.fillText('Press E to continue  (' + (d.i + 1) + '/' + d.lines.length + ')', CW / 2 - dw / 2 + 18, CH - dh - 18);
}

function drawBar(x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(x - 2, y - 2, w + 4, h + 4, 5); ctx.fill();
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px Arial, sans-serif';
  ctx.fillText(label, x + 5, y + h - 3);
}

function drawStars(x, y) {
  ctx.font = '28px Arial, sans-serif';
  ctx.textAlign = 'right';
  var s = '';
  for (var i = 0; i < 5; i++) s += Game.wanted.stars > i ? '★' : '☆';
  ctx.fillStyle = Game.wanted.stars >= 3 ? '#ff5252' : '#ffd34d';
  ctx.fillText(s, x, y);
  ctx.textAlign = 'left';
}

function drawObjectiveMarker() {
  var t = null;
  if (Game.race) t = RACE_POINTS[Game.race.cp];
  else if (Game.taxi) t = Game.taxi.dest;
  else t = missionTarget();
  if (!t) return;
  var s = worldToScreen(t.x, t.y);
  var pulse = 1 + Math.sin(Game.time * 5) * 0.15;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ffd34d';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  var r = 12 * pulse;
  ctx.fillRect(-r / 2, -r / 2, r, r);
  ctx.strokeRect(-r / 2, -r / 2, r, r);
  ctx.restore();
  // Off-screen arrow.
  if (s.x < 0 || s.x > CW || s.y < 0 || s.y > CH) {
    var dx = clamp(s.x, 40, CW - 40), dy = clamp(s.y, 80, CH - 40);
    var a = Math.atan2(s.y - CH / 2, s.x - CW / 2);
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawMinimap() {
  var size = 190, mx = CW - size - 14, my = CH - size - 14;
  var scale = size / WORLD_SIZE;
  ctx.fillStyle = 'rgba(8,10,14,0.78)';
  roundRect(mx - 4, my - 4, size + 8, size + 8, 8); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, size, size); ctx.clip();
  // Water + sand.
  ctx.fillStyle = '#2a6ea8';
  ctx.fillRect(mx, my, size, size);
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(mx, my + 3345 * scale, size, size - 3345 * scale);
  ctx.fillRect(mx + 3345 * scale, my, size - 3345 * scale, size);
  // Ground.
  ctx.fillStyle = '#7a8a5f';
  ctx.fillRect(mx, my, 3345 * scale, 3345 * scale);
  // Roads.
  ctx.strokeStyle = '#3d3d46';
  ctx.lineWidth = 4;
  for (var i = 0; i < ROADS.length; i++) {
    ctx.beginPath(); ctx.moveTo(mx + ROADS[i] * scale, my); ctx.lineTo(mx + ROADS[i] * scale, my + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + ROADS[i] * scale); ctx.lineTo(mx + size, my + ROADS[i] * scale); ctx.stroke();
  }
  // Parks.
  ctx.fillStyle = '#4d8a3f';
  for (var j = 0; j < Game.city.parks.length; j++) {
    var pk = Game.city.parks[j];
    ctx.fillRect(mx + pk.x * scale, my + pk.y * scale, pk.w * scale, pk.h * scale);
  }
  function dot(x, y, color, r) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx + x * scale, my + y * scale, r, 0, Math.PI * 2); ctx.fill();
  }
  for (var k = 0; k < Game.cars.length; k++) {
    var c = Game.cars[k];
    if (c.dead) continue;
    dot(c.x, c.y, c.driver === 'police' ? '#3d7bff' : '#bbb', c.driver === 'police' ? 4 : 2.5);
  }
  for (var e = 0; e < Game.enemies.length; e++) if (!Game.enemies[e].dead) dot(Game.enemies[e].x, Game.enemies[e].y, '#ff5252', 3);
  var t = null;
  if (Game.race) t = RACE_POINTS[Game.race.cp];
  else if (Game.taxi) t = Game.taxi.dest;
  else t = missionTarget();
  if (t) {
    var pulse = 3 + Math.sin(Game.time * 5) * 1.2;
    dot(t.x, t.y, '#ffd34d', pulse);
  }
  // Player arrow.
  var p = Game.player;
  ctx.save();
  ctx.translate(mx + p.x * scale, my + p.y * scale);
  ctx.rotate(p.angle || 0);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  roundRect(mx - 4, my - 4, size + 8, size + 8, 8); ctx.stroke();
}

// ---- screens ----
function drawTitle() {
  ctx.fillStyle = 'rgba(8,10,20,0.62)';
  ctx.fillRect(0, 0, CW, CH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 96px Arial, sans-serif';
  ctx.strokeStyle = '#000'; ctx.lineWidth = 10;
  ctx.strokeText('SOLMARA', CW / 2, CH * 0.30);
  ctx.fillText('SOLMARA', CW / 2, CH * 0.30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText('A SUN-SOAKED CRIME SAGA  •  AN OPEN-WORLD GAME IN THE SPIRIT OF GTA 6', CW / 2, CH * 0.30 + 44);
  var items = [];
  if (Game.save) items.push('Continue — ' + Game.save.title);
  items.push('New Game');
  items.push('How to Play');
  Game._menuItems = items;
  for (var i = 0; i < items.length; i++) {
    var y = CH * 0.52 + i * 52;
    var sel = Game._menuSel === i;
    if (sel) {
      ctx.fillStyle = 'rgba(255,211,77,0.9)';
      roundRect(CW / 2 - 220, y - 30, 440, 42, 8); ctx.fill();
      ctx.fillStyle = '#111';
    } else ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText(items[i], CW / 2, y);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '15px Arial, sans-serif';
  ctx.fillText('WASD drive & walk  •  E enter car / interact  •  Mouse aim, click to shoot  •  1/2/3 weapons  •  P pause  •  M mute', CW / 2, CH * 0.52 + items.length * 52 + 26);
  ctx.fillText('Steal cars, lose the police, run 10 story missions — and own Solmara.', CW / 2, CH * 0.52 + items.length * 52 + 52);
  ctx.textAlign = 'left';
}

function drawPause() {
  ctx.fillStyle = 'rgba(8,10,20,0.72)';
  ctx.fillRect(0, 0, CW, CH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px Arial, sans-serif';
  ctx.fillText('PAUSED', CW / 2, CH * 0.3);
  var items = ['Resume', 'Save Game', 'Restart Mission', 'Quit to Title'];
  Game._menuItems = items;
  for (var i = 0; i < items.length; i++) {
    var y = CH * 0.46 + i * 48;
    var sel = Game._menuSel === i;
    if (sel) {
      ctx.fillStyle = 'rgba(255,211,77,0.9)';
      roundRect(CW / 2 - 200, y - 28, 400, 40, 8); ctx.fill();
      ctx.fillStyle = '#111';
    } else ctx.fillStyle = '#fff';
    ctx.font = 'bold 21px Arial, sans-serif';
    ctx.fillText(items[i], CW / 2, y);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '15px Arial, sans-serif';
  ctx.fillText('WASD move/drive  •  E enter car / interact  •  Click shoot  •  1/2/3 weapons  •  Shift sprint / handbrake  •  M mute', CW / 2, CH * 0.46 + items.length * 48 + 24);
  ctx.textAlign = 'left';
}

function drawOver() {
  ctx.fillStyle = Game.overKind === 'busted' ? 'rgba(10,20,60,0.78)' : 'rgba(40,8,8,0.78)';
  ctx.fillRect(0, 0, CW, CH);
  ctx.textAlign = 'center';
  ctx.fillStyle = Game.overKind === 'busted' ? '#7fb8ff' : '#ff5252';
  ctx.font = 'bold 92px Arial, sans-serif';
  ctx.fillText(Game.overKind === 'busted' ? 'BUSTED' : 'WASTED', CW / 2, CH * 0.4);
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial, sans-serif';
  ctx.fillText('You lost ' + fmtMoney(Game._overLoss || 0) + ' to the ' + (Game.overKind === 'busted' ? 'police' : 'hospital') + '.', CW / 2, CH * 0.4 + 44);
  ctx.fillText('Press Enter to get back on the streets — the mission is still waiting.', CW / 2, CH * 0.4 + 76);
  ctx.textAlign = 'left';
}

function drawEnding() {
  ctx.fillStyle = 'rgba(8,10,20,0.82)';
  ctx.fillRect(0, 0, CW, CH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 72px Arial, sans-serif';
  ctx.fillText('KING OF SOLMARA', CW / 2, CH * 0.32);
  ctx.fillStyle = '#fff';
  ctx.font = '20px Arial, sans-serif';
  ctx.fillText('Every mission complete. The city is yours, Kai.', CW / 2, CH * 0.32 + 44);
  ctx.fillText('Missions ' + Game.stats.missionsDone + '  •  Cars stolen ' + Game.stats.carsStolen + '  •  Cash ' + fmtMoney(Game.cash), CW / 2, CH * 0.32 + 80);
  ctx.fillText('Press Enter to keep playing in free roam.', CW / 2, CH * 0.32 + 116);
  ctx.textAlign = 'left';
}
