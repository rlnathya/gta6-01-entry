// SOLMARA — input.js
// Keyboard and mouse state. Keys are tracked by code; the mouse position is
// converted to world coordinates by the camera each frame (render.js).

var KEYS = {};

function setupInput(canvas) {
  window.addEventListener('keydown', function (e) {
    if (!KEYS[e.code]) _edgeKeys[e.code] = true; // latch the press edge
    KEYS[e.code] = true;
    Game.keys[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    if (Game.audio) Game.audio.ensure();
  });
  window.addEventListener('keyup', function (e) {
    KEYS[e.code] = false;
    Game.keys[e.code] = false;
  });
  window.addEventListener('blur', function () {
    for (var k in KEYS) KEYS[k] = false;
    for (var e2 in _edgeKeys) _edgeKeys[e2] = false;
    Game.keys = {};
  });
  canvas.addEventListener('mousemove', function (e) {
    var r = canvas.getBoundingClientRect();
    Game.mouse.x = e.clientX - r.left;
    Game.mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', function (e) {
    if (e.button === 0) { Game.mouse.down = true; Game.mouse.clicked = true; }
    if (Game.audio) Game.audio.ensure();
  });
  window.addEventListener('mouseup', function (e) {
    if (e.button === 0) Game.mouse.down = false;
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

// True while any of the given key codes is held.
function keyDown() {
  for (var i = 0; i < arguments.length; i++) if (KEYS[arguments[i]]) return true;
  return false;
}
// True only on the frame the key was pressed (edge trigger).
// The edge is latched in the keydown handler itself, so even a very quick
// tap (shorter than one 60 fps frame) is never missed.
var _edgeKeys = {};
function keyPressed(code) {
  if (_edgeKeys[code]) { _edgeKeys[code] = false; return true; }
  return false;
}
function syncPrevKeys() {
  // Kept for compatibility; edges are latched in the handler now.
}
