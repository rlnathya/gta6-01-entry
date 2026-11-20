// SOLMARA — city.js
// Procedural city of Solmara: road grid, blocks, buildings, parks, beach and
// harbor. All layout is seeded, so the same seed builds the same city.
// Coordinates are world pixels; the world is WORLD_SIZE x WORLD_SIZE.

var ROADS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000, 3400];
var BUILDING_COLORS = ['#e8b48a', '#d9a06b', '#c98f5f', '#e5c9a8', '#b8c4c9', '#a8b8c4', '#d8b8c8', '#c4b49a', '#e0a878', '#9fb8a8'];
var ROOF_COLORS = ['#8a6a4a', '#6a7a8a', '#7a5a4a', '#5a6a7a', '#9a8a6a'];

// Water and sand rects (south beach, east harbor).
var WATER_RECTS = [
  { x: 0, y: 3520, w: 3600, h: 80 },     // south sea
  { x: 3520, y: 0, w: 80, h: 3520 }      // east sea
];
var SAND_RECT = { x: 0, y: 3345, w: 3345, h: 175 };
var DOCK_RECT = { x: 3345, y: 0, w: 175, h: 3345 };

function buildCity(seed) {
  makeRng(seed);
  var city = {
    buildings: [], trees: [], parks: [], plazas: [],
    landmarks: {}, piers: []
  };
  // Landmark buildings (fixed, named, mission-relevant).
  addLandmark(city, 'cafe', "ROSA'S CAFE", 300, 320, 200, 130, '#e8b48a', 400, 452);
  addLandmark(city, 'bank', 'SOLMARA NATIONAL BANK', 1300, 900, 200, 150, '#c4b49a', 1400, 1052);
  addLandmark(city, 'gunshop', 'IRONWORKS GUNS', 2500, 2100, 190, 120, '#8a7a6a', 2595, 2222);
  addLandmark(city, 'hospital', 'SOLMARA GENERAL', 300, 2500, 220, 140, '#b8c4c9', 410, 2642);
  addLandmark(city, 'police', 'SMPD HEADQUARTERS', 2900, 700, 210, 140, '#5a6a8a', 3005, 842);
  addLandmark(city, 'safehouse', "KAI'S APARTMENT", 900, 2500, 170, 120, '#d9a06b', 985, 2622);
  addLandmark(city, 'warehouse', 'HARBOR WAREHOUSE', 2900, 1300, 220, 160, '#9a8a6a', 3010, 1462);
  addLandmark(city, 'palmero', 'THE PALMERO', 2250, 3370, 260, 120, '#e0a878', 2380, 3492);

  // Piers reaching into the east sea.
  city.piers = [
    { x: 3400, y: 500, w: 130, h: 26 },
    { x: 3400, y: 1500, w: 130, h: 26 },
    { x: 3400, y: 2500, w: 130, h: 26 }
  ];

  // 8x8 blocks between the road lines.
  for (var bi = 0; bi < 8; bi++) {
    for (var bj = 0; bj < 8; bj++) {
      var bx = ROADS[bi] + ROAD_W / 2;
      var by = ROADS[bj] + ROAD_W / 2;
      var bw = ROAD_GAP - ROAD_W, bh = ROAD_GAP - ROAD_W;
      // Central park: the four blocks around the city centre.
      if (bi >= 3 && bi <= 4 && bj >= 3 && bj <= 4) {
        city.parks.push({ x: bx, y: by, w: bw, h: bh });
        plantParkTrees(city, bx, by, bw, bh);
        continue;
      }
      if (landmarkOwnsBlock(bx, by, bw, bh, city)) continue;
      var roll = rnd();
      if (roll < 0.12) {
        city.plazas.push({ x: bx, y: by, w: bw, h: bh });
        plantParkTrees(city, bx, by, bw, bh, 5);
      } else {
        fillBlockWithBuildings(city, bx, by, bw, bh);
      }
    }
  }
  // Palms along the beach and sidewalk trees.
  for (var i = 0; i < 34; i++) {
    city.trees.push({ x: rndRange(80, 3260), y: rndRange(3380, 3500), palm: true, s: rndRange(0.9, 1.3) });
  }
  for (var j = 0; j < 70; j++) {
    var rx = rndPick(ROADS), ry = rndRange(120, WORLD_SIZE - 120);
    city.trees.push({ x: rx + rndPick([-72, 72]), y: ry, palm: rndChance(0.4), s: rndRange(0.8, 1.2) });
  }
  Game.city = city;
  return city;
}

function addLandmark(city, id, name, x, y, w, h, color, doorX, doorY) {
  var b = { x: x, y: y, w: w, h: h, color: color, roof: '#5a4a3a', landmark: id, name: name };
  city.buildings.push(b);
  city.landmarks[id] = { id: id, name: name, x: x, y: y, w: w, h: h, door: { x: doorX, y: doorY }, cx: x + w / 2, cy: y + h / 2 };
}

function landmarkOwnsBlock(bx, by, bw, bh, city) {
  for (var i = 0; i < city.buildings.length; i++) {
    var b = city.buildings[i];
    if (b.x >= bx - 4 && b.y >= by - 4 && b.x + b.w <= bx + bw + 4 && b.y + b.h <= by + bh + 4) return true;
  }
  return false;
}

function fillBlockWithBuildings(city, bx, by, bw, bh) {
  var n = rndInt(1, 4);
  if (n === 1) {
    city.buildings.push(makeBuilding(bx + 20, by + 20, bw - 40, bh - 40));
    return;
  }
  var cols = 2, rows = 2, gw = 16, gh = 16;
  var cw = (bw - gw) / cols, ch = (bh - gh) / rows;
  for (var i = 0; i < cols; i++) {
    for (var j = 0; j < rows; j++) {
      if (rndChance(0.18)) continue;
      var w = cw - rndRange(14, 40), h = ch - rndRange(14, 40);
      city.buildings.push(makeBuilding(bx + i * (cw + gw) + rndRange(4, 18), by + j * (ch + gh) + rndRange(4, 18), w, h));
    }
  }
}

function makeBuilding(x, y, w, h) {
  return {
    x: x, y: y, w: Math.max(46, w), h: Math.max(46, h),
    color: rndPick(BUILDING_COLORS), roof: rndPick(ROOF_COLORS)
  };
}

function plantParkTrees(city, bx, by, bw, bh, count) {
  var n = count || 14;
  for (var i = 0; i < n; i++) {
    city.trees.push({ x: rndRange(bx + 20, bx + bw - 20), y: rndRange(by + 20, by + bh - 20), palm: false, s: rndRange(0.9, 1.4) });
  }
}

// ---- queries used by physics, AI and rendering ----
function isRoad(x, y) {
  var v = false, h = false;
  for (var i = 0; i < ROADS.length; i++) {
    if (Math.abs(x - ROADS[i]) <= ROAD_W / 2) v = true;
    if (Math.abs(y - ROADS[i]) <= ROAD_W / 2) h = true;
  }
  return v ? (h ? 'vh' : 'v') : (h ? 'h' : null);
}
function inWater(x, y) {
  for (var i = 0; i < WATER_RECTS.length; i++) if (inRect(x, y, WATER_RECTS[i])) return true;
  return false;
}
function onSand(x, y) { return inRect(x, y, SAND_RECT); }

// True when a circle of radius r at (x,y) is blocked by a building, water or the edge.
function solidAt(x, y, r) {
  if (x < r || y < r || x > WORLD_SIZE - r || y > WORLD_SIZE - r) return true;
  if (inWater(x, y)) return true;
  var bs = Game.city.buildings;
  for (var i = 0; i < bs.length; i++) {
    if (circleHitsRect(x, y, r, bs[i])) return true;
  }
  return false;
}

// Move an entity with axis-separated collision so it slides along walls.
function moveWithCollision(ent, dx, dy, r) {
  var nx = ent.x + dx;
  if (!solidAt(nx, ent.y, r)) ent.x = nx;
  var ny = ent.y + dy;
  if (!solidAt(ent.x, ny, r)) ent.y = ny;
}

// A random point on a road (for traffic / pedestrian spawns).
function randomRoadPoint() {
  var horizontal = rndChance(0.5);
  var road = rndPick(ROADS);
  var along = rndRange(80, WORLD_SIZE - 80);
  return horizontal ? { x: along, y: road } : { x: road, y: along };
}
// The nearest road centre line coordinate to a value.
function nearestRoad(v) {
  var best = ROADS[0], bd = 1e9;
  for (var i = 0; i < ROADS.length; i++) {
    var d = Math.abs(v - ROADS[i]);
    if (d < bd) { bd = d; best = ROADS[i]; }
  }
  return best;
}
// Next intersection along a road from (x,y) heading in direction dir ('n','s','e','w').
function nextIntersection(x, y, dir) {
  var road = dir === 'n' || dir === 's' ? nearestRoad(x) : nearestRoad(y);
  var t = dir === 'n' || dir === 's' ? y : x;
  var cands = [];
  for (var i = 0; i < ROADS.length; i++) {
    if (dir === 'n' && ROADS[i] < t - 4) cands.push(ROADS[i]);
    if (dir === 's' && ROADS[i] > t + 4) cands.push(ROADS[i]);
    if (dir === 'w' && ROADS[i] < t - 4) cands.push(ROADS[i]);
    if (dir === 'e' && ROADS[i] > t + 4) cands.push(ROADS[i]);
  }
  if (!cands.length) return null;
  var pick = dir === 'n' || dir === 'w' ? cands[cands.length - 1] : cands[0];
  return dir === 'n' || dir === 's' ? { x: road, y: pick } : { x: pick, y: road };
}
