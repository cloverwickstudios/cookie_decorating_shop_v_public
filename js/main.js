/* ============================================================
 * main.js — game loop and input (pointer events = mouse + touch).
 * ============================================================ */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/* ---------- Input: drag-and-drop with manual hit-testing ----------
 * Drag flow:
 *   pointerdown on a bucket  -> state.drag = { color, x, y }
 *   pointermove              -> drag follows the cursor
 *   pointerup                -> hit-test cookies; drop applies frosting
 * Coordinates are converted from CSS pixels to canvas pixels because
 * the canvas is scaled to fit the window.
 */

function canvasPos(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width / r.width),
    y: (e.clientY - r.top) * (canvas.height / r.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  Sfx.unlock();                       // audio needs a user gesture to start
  const p = canvasPos(e);
  if (state.phase === 'gameover' || state.phase === 'break') {
    handleOverlayClick(p.x, p.y);     // congrats / closed-sign buttons
    return;
  }
  if (state.phase !== 'play') return; // input pauses during win/miss beats
  const bucket = bucketAt(p.x, p.y);  // hit-test the bucket row (game.js)
  if (bucket) {
    state.drag = { kind: 'icing', color: bucket.color, x: p.x, y: p.y };
    canvas.setPointerCapture(e.pointerId); // keep the drag if cursor leaves
    Sfx.pickup();
  } else if (sprinkleBowlAt(p.x, p.y)) {
    state.drag = { kind: 'sprinkles', color: null, x: p.x, y: p.y };
    canvas.setPointerCapture(e.pointerId);
    Sfx.pickup();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!state.drag) return;
  const p = canvasPos(e);
  state.drag.x = p.x;
  state.drag.y = p.y;
});

canvas.addEventListener('pointerup', (e) => {
  if (!state.drag) return;
  const p = canvasPos(e);
  // hit-test cookies that can accept this drop kind (game.js)
  const cookie = cookieAt(p.x, p.y, state.drag.kind);
  if (cookie && state.phase === 'play') {
    if (state.drag.kind === 'icing') applyFrosting(cookie, state.drag.color);
    else applySprinkles(cookie);      // matching logic in game.js
  }
  state.drag = null;                  // missed drops just return the goods
});

canvas.addEventListener('pointercancel', () => { state.drag = null; });

/* ---------- Game loop ---------- */

let lastTime = 0;

function frame(timeMs) {
  const time = timeMs / 1000;
  // Clamp dt so a backgrounded tab doesn't teleport cookies off the belt.
  const dt = Math.min(0.05, time - lastTime || 0.016);
  lastTime = time;

  updateGame(dt);        // simulation (game.js)
  drawFrame(ctx, time);  // drawing (render.js)
  requestAnimationFrame(frame);
}

/* ---------- Music autostart ----------
 * Try to start the music immediately on load. Most browsers block audio
 * until the user interacts with the page, so as a fallback the very first
 * tap / click / keypress ANYWHERE also unlocks it (not just the buckets —
 * the canvas pointerdown handler above calls Sfx.unlock() too).
 */
Sfx.unlock();
window.addEventListener('pointerdown', () => Sfx.unlock(), { once: true });
window.addEventListener('keydown', () => Sfx.unlock(), { once: true });

newOrder();              // first customer order
requestAnimationFrame(frame);
